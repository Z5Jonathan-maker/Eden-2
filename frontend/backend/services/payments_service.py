import logging
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException

from dependencies import db
from services.stripe_checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

# Structured logging setup
logger = logging.getLogger(__name__)

# --- 1. Subscription Packages Definition (Single Source of Truth) ---
SUBSCRIPTION_PACKAGES = {
    "starter": {
        "name": "Solo",
        "amount": 79.00,
        "currency": "usd",
        "description": "For independent adjusters",
        "features": [
            "Up to 25 active claims",
            "Scales - 5 comparisons/month",
            "Eve AI - 50 queries/month",
            "Care Claims University access",
            "Mobile PWA access",
            "Email support"
        ]
    },
    "professional": {
        "name": "Professional",
        "amount": 149.00,
        "currency": "usd",
        "description": "For PA firms & teams",
        "features": [
            "Unlimited claims",
            "Scales - Unlimited comparisons",
            "Eve AI - Unlimited queries",
            "Full University + Certifications",
            "Google Workspace integration",
            "Priority support",
            "Client portal access",
            "Custom branding"
        ]
    },
    "enterprise": {
        "name": "Enterprise",
        "amount": 249.00,
        "currency": "usd",
        "description": "For large organizations",
        "features": [
            "Everything in Professional",
            "Dedicated account manager",
            "SignNow e-signatures",
            "Gamma integrations",
            "API access",
            "SLA guarantee",
            "Custom training",
            "White-label option"
        ]
    }
}

class PaymentsService:
    def __init__(self, database=db):
        self.db = database
        self.stripe_api_key = os.environ.get("STRIPE_API_KEY")

    def get_packages(self) -> List[Dict[str, Any]]:
        """Get all available subscription packages"""
        return [
            {
                "id": pkg_id,
                "name": pkg["name"],
                "amount": pkg["amount"],
                "currency": pkg["currency"],
                "description": pkg["description"],
                "features": pkg["features"]
            }
            for pkg_id, pkg in SUBSCRIPTION_PACKAGES.items()
        ]

    async def create_checkout_session(self, package_id: str, origin_url: str, current_user: Dict[str, Any], host_url: str) -> Dict[str, str]:
        """Create a Stripe checkout session for subscription"""
        try:
            # 1. Validate inputs
            if not self.stripe_api_key:
                raise HTTPException(status_code=500, detail="Stripe API key not configured")
                
            pkg_id_lower = package_id.lower()
            if pkg_id_lower not in SUBSCRIPTION_PACKAGES:
                raise HTTPException(status_code=400, detail=f"Invalid package: {package_id}")
            
            package = SUBSCRIPTION_PACKAGES[pkg_id_lower]
            
            # 2. Prepare URLs
            base_origin = origin_url.rstrip('/')
            success_url = f"{base_origin}/dashboard?session_id={{CHECKOUT_SESSION_ID}}&payment=success"
            cancel_url = f"{base_origin}/?payment=cancelled"
            webhook_url = f"{host_url.rstrip('/')}/api/payments/webhook/stripe"
            
            # 3. Initialize Stripe
            stripe_checkout = StripeCheckout(api_key=self.stripe_api_key, webhook_url=webhook_url)
            
            # 4. Prepare Metadata
            user_id = str(current_user.get("_id", current_user.get("id", "")))
            metadata = {
                "user_id": user_id,
                "user_email": current_user.get("email", ""),
                "package_id": pkg_id_lower,
                "package_name": package["name"],
                "source": "eden_subscription"
            }
            
            # 5. Create Session Request
            checkout_request = CheckoutSessionRequest(
                amount=package["amount"],
                currency=package["currency"],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata
            )
            
            # 6. Execute Stripe Call
            session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
            
            # 7. Persist Transaction (Audit Trail)
            transaction = {
                "session_id": session.session_id,
                "user_id": user_id,
                "user_email": current_user.get("email", ""),
                "package_id": pkg_id_lower,
                "package_name": package["name"],
                "amount": package["amount"],
                "currency": package["currency"],
                "payment_status": "pending",
                "status": "initiated",
                "metadata": metadata,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await self.db.payment_transactions.insert_one(transaction)
            
            # 8. Dispatch Event (PaymentInitiated)
            self._log_payment_event("PaymentInitiated", session.session_id, current_user.get("email"), {"package": pkg_id_lower})
            
            return {"url": session.url, "session_id": session.session_id}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Create checkout error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_payment_status(self, session_id: str) -> Dict[str, Any]:
        """Get payment status and sync with Stripe"""
        try:
            if not self.stripe_api_key:
                raise HTTPException(status_code=500, detail="Stripe API key not configured")
                
            stripe_checkout = StripeCheckout(api_key=self.stripe_api_key, webhook_url="")
            
            # 1. Fetch from Stripe
            status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
            
            # 2. Sync Local DB
            transaction = await self.db.payment_transactions.find_one({"session_id": session_id})
            
            if transaction:
                # Update if changed
                if transaction.get("payment_status") != status.payment_status:
                    await self._update_transaction_status(session_id, status.status, status.payment_status)
                    
                    # Activate Subscription if paid
                    if status.payment_status == "paid" and transaction.get("payment_status") != "paid":
                        await self._activate_subscription(transaction)
            
            # 3. Format Response
            message = self._get_status_message(status)
            
            return {
                "status": status.status,
                "payment_status": status.payment_status,
                "amount_total": status.amount_total / 100,
                "currency": status.currency,
                "package_id": transaction.get("package_id") if transaction else None,
                "message": message
            }
            
        except Exception as e:
            logger.error(f"Get payment status error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def handle_webhook(self, body: bytes, signature: str, host_url: str) -> Dict[str, str]:
        """Process Stripe Webhooks securely"""
        try:
            if not self.stripe_api_key:
                raise HTTPException(status_code=500, detail="Stripe API key not configured")
                
            webhook_url = f"{host_url.rstrip('/')}/api/payments/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=self.stripe_api_key, webhook_url=webhook_url)
            
            # 1. Verify & Parse
            webhook_response = await stripe_checkout.handle_webhook(body, signature)
            
            # 2. Process Event
            if webhook_response.session_id:
                # Update transaction
                await self.db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {
                        "$set": {
                            "payment_status": webhook_response.payment_status,
                            "webhook_event_type": webhook_response.event_type,
                            "webhook_event_id": webhook_response.event_id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                # Activate if paid
                if webhook_response.payment_status == "paid":
                    transaction = await self.db.payment_transactions.find_one({"session_id": webhook_response.session_id})
                    if transaction:
                        await self._activate_subscription(transaction)
                        self._log_payment_event("PaymentSucceeded", webhook_response.session_id, transaction.get("user_email"))
            
            return {"status": "success", "event_type": webhook_response.event_type}
            
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            raise HTTPException(status_code=400, detail=str(e))

    async def get_user_transactions(self, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get transaction history for a user"""
        try:
            user_email = current_user.get("email", "")
            transactions = await self.db.payment_transactions.find(
                {"user_email": user_email},
                {"_id": 0}
            ).sort("created_at", -1).to_list(50)
            return transactions
        except Exception as e:
            logger.error(f"Get transactions error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_user_subscription(self, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """Get current subscription status"""
        subscription = current_user.get("subscription", {})
        
        if subscription and subscription.get("plan"):
            package = SUBSCRIPTION_PACKAGES.get(subscription.get("plan"), {})
            return {
                "has_subscription": True,
                "plan": subscription.get("plan"),
                "plan_name": package.get("name", subscription.get("plan")),
                "status": subscription.get("status", "unknown"),
                "started_at": subscription.get("started_at"),
                "features": package.get("features", [])
            }
        
        return {
            "has_subscription": False,
            "plan": None,
            "status": "none",
            "message": "No active subscription"
        }

    # --- Internal Helpers ---

    async def _update_transaction_status(self, session_id: str, status: str, payment_status: str):
        await self.db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": status,
                "payment_status": payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

    async def _activate_subscription(self, transaction: Dict[str, Any]):
        """Enable the subscription features for the user"""
        user_id = transaction.get("user_id")
        
        # Handle both ObjectId string and email lookup for safety
        if user_id and len(user_id) == 24:
            query = {"_id": user_id}
        else:
            query = {"email": transaction.get("user_email")}
        
        await self.db.users.update_one(
            query,
            {
                "$set": {
                    "subscription": {
                        "plan": transaction.get("package_id"),
                        "status": "active",
                        "started_at": datetime.now(timezone.utc).isoformat(),
                        "payment_session_id": transaction.get("session_id")
                    }
                }
            }
        )
        self._log_payment_event("SubscriptionActivated", transaction.get("session_id"), transaction.get("user_email"))

    def _get_status_message(self, status: CheckoutStatusResponse) -> str:
        if status.payment_status == "paid":
            return "Payment successful! Your subscription is now active."
        elif status.status == "expired":
            return "Payment session expired. Please try again."
        elif status.payment_status == "unpaid":
            return "Payment is being processed..."
        else:
            return f"Payment status: {status.payment_status}"

    def _log_payment_event(self, event: str, session_id: str, user_email: str, details: dict = None):
        log_data = {
            "event": event,
            "session_id": session_id,
            "user": user_email,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if details:
            log_data.update(details)
        logger.info(f"PAYMENT_AUDIT: {log_data}")
