"""
Stripe Checkout Integration

Thin wrapper around the Stripe Python SDK (stripe==14.3.0)
to provide a consistent interface for Eden's payment flows.
"""

import stripe
from pydantic import BaseModel
from typing import Optional, Dict


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


class StripeCheckout:
    """Stripe checkout session manager"""
    
    def __init__(self, api_key: str, webhook_url: str = None):
        """Initialize Stripe client"""
        stripe.api_key = api_key
        self.webhook_url = webhook_url
    
    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        """Create a Stripe checkout session"""
        try:
            # Convert amount from dollars to cents
            amount_cents = int(request.amount * 100)
            
            # Create the session
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price_data": {
                            "currency": request.currency,
                            "unit_amount": amount_cents,
                            "product_data": {
                                "name": "Eden Subscription",
                                "metadata": request.metadata or {}
                            }
                        },
                        "quantity": 1
                    }
                ],
                mode="payment",
                success_url=request.success_url,
                cancel_url=request.cancel_url,
                metadata=request.metadata or {}
            )
            
            return CheckoutSessionResponse(
                session_id=session.id,
                url=session.url
            )
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
    
    async def get_session_status(self, session_id: str) -> CheckoutStatusResponse:
        """Get the status of a checkout session"""
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            return CheckoutStatusResponse(
                status=session.payment_status,
                payment_status=session.payment_status,
                amount_total=session.amount_total / 100 if session.amount_total else 0,
                currency=session.currency or "usd"
            )
        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
