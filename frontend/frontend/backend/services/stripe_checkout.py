"""
Stripe Checkout Integration

Thin wrapper around the Stripe Python SDK (stripe==14.3.0)
to provide a consistent interface for Eden's payment flows.
"""

import os
import logging
import stripe
from pydantic import BaseModel
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class CheckoutSessionRequest(BaseModel):
    """Request to create a Stripe checkout session"""
    amount: float
    currency: str = "usd"
    success_url: str
    cancel_url: str
    metadata: Optional[Dict] = None


class CheckoutSessionResponse(BaseModel):
    """Response from creating a Stripe checkout session"""
    session_id: str
    url: str


class CheckoutStatusResponse(BaseModel):
    """Response for payment status"""
    status: str
    payment_status: str
    amount_total: float
    currency: str


class WebhookResponse(BaseModel):
    """Response from processing a webhook event"""
    event_type: str
    event_id: str
    session_id: Optional[str] = None
    payment_status: Optional[str] = None


class StripeCheckout:
    """Stripe checkout session manager"""

    def __init__(self, api_key: str):
        """Initialize Stripe client with instance-scoped key (no global mutation)."""
        self._api_key = api_key

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        """Create a Stripe checkout session (non-blocking)."""
        import asyncio
        try:
            amount_cents = int(request.amount * 100)
            api_key = self._api_key

            def _create():
                return stripe.checkout.Session.create(
                    api_key=api_key,
                    payment_method_types=["card"],
                    line_items=[{
                        "price_data": {
                            "currency": request.currency,
                            "unit_amount": amount_cents,
                            "product_data": {
                                "name": "Eden Subscription",
                                "metadata": request.metadata or {}
                            }
                        },
                        "quantity": 1
                    }],
                    mode="payment",
                    success_url=request.success_url,
                    cancel_url=request.cancel_url,
                    metadata=request.metadata or {}
                )

            session = await asyncio.get_event_loop().run_in_executor(None, _create)

            return CheckoutSessionResponse(
                session_id=session.id,
                url=session.url
            )
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")

    async def get_session_status(self, session_id: str) -> CheckoutStatusResponse:
        """Get the status of a checkout session (non-blocking)."""
        import asyncio
        try:
            api_key = self._api_key

            def _retrieve():
                return stripe.checkout.Session.retrieve(session_id, api_key=api_key)

            session = await asyncio.get_event_loop().run_in_executor(None, _retrieve)

            return CheckoutStatusResponse(
                status=session.payment_status,
                payment_status=session.payment_status,
                amount_total=session.amount_total / 100 if session.amount_total else 0,
                currency=session.currency or "usd"
            )
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")

    # Alias used by payments_service.py
    get_checkout_status = get_session_status

    async def handle_webhook(self, body: bytes, signature: str) -> WebhookResponse:
        """Verify and parse a Stripe webhook event using the webhook secret."""
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        if not webhook_secret:
            raise RuntimeError("STRIPE_WEBHOOK_SECRET environment variable is required")

        if not signature:
            raise ValueError("Missing Stripe-Signature header")

        try:
            event = stripe.Webhook.construct_event(body, signature, webhook_secret)
        except stripe.error.SignatureVerificationError:
            logger.warning("Stripe webhook signature verification failed")
            raise ValueError("Invalid webhook signature")

        # Extract session info from supported event types
        session_id = None
        payment_status = None
        event_obj = event.get("data", {}).get("object", {})

        if event["type"] in (
            "checkout.session.completed",
            "checkout.session.expired",
            "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed",
        ):
            session_id = event_obj.get("id")
            payment_status = event_obj.get("payment_status")

        return WebhookResponse(
            event_type=event["type"],
            event_id=event["id"],
            session_id=session_id,
            payment_status=payment_status,
        )
