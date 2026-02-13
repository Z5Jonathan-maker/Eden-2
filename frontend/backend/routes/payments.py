"""
Stripe Payment Integration for Eden Subscription Plans
"""
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from dependencies import get_db, get_current_user
from services.payments_service import PaymentsService

router = APIRouter(prefix="/api/payments", tags=["payments"])

# --- Dependency Injection ---
def get_payments_service(db: AsyncIOMotorDatabase = Depends(get_db)):
    return PaymentsService(db)

# --- DTOs (Data Transfer Objects) ---
class CreateCheckoutRequest(BaseModel):
    package_id: str = Field(..., description="Package ID: starter, professional, or enterprise")
    origin_url: str = Field(..., description="Frontend origin URL for redirects")

class CheckoutResponse(BaseModel):
    url: str
    session_id: str

class PaymentStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount_total: float
    currency: str
    package_id: Optional[str] = None
    message: str

# --- Routes (Thin Layer) ---

@router.get("/packages")
async def get_packages(service: PaymentsService = Depends(get_payments_service)):
    """Get all available subscription packages"""
    return {"packages": service.get_packages()}


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    request_data: CreateCheckoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    service: PaymentsService = Depends(get_payments_service)
):
    """Create a Stripe checkout session for subscription"""
    host_url = str(request.base_url)
    return await service.create_checkout_session(
        request_data.package_id, 
        request_data.origin_url, 
        current_user,
        host_url
    )


@router.get("/status/{session_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    session_id: str,
    service: PaymentsService = Depends(get_payments_service)
):
    """Get payment status for a checkout session"""
    return await service.get_payment_status(session_id)


@router.post("/webhook/stripe")
async def handle_stripe_webhook(
    request: Request,
    service: PaymentsService = Depends(get_payments_service)
):
    """Handle Stripe webhook events"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    host_url = str(request.base_url)
    
    return await service.handle_webhook(body, signature, host_url)


@router.get("/transactions")
async def get_user_transactions(
    current_user: dict = Depends(get_current_user),
    service: PaymentsService = Depends(get_payments_service)
):
    """Get payment transactions for current user"""
    transactions = await service.get_user_transactions(current_user)
    return {"transactions": transactions}


@router.get("/subscription")
async def get_user_subscription(
    current_user: dict = Depends(get_current_user),
    service: PaymentsService = Depends(get_payments_service)
):
    """Get current user's subscription status"""
    return await service.get_user_subscription(current_user)
