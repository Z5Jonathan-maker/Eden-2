from typing import Dict, Any
from fastapi import HTTPException
from dependencies import db
from services.observability import get_logger

logger = get_logger("eden.limits")

class LimitEnforcementService:
    """
    Enforce technical plan limits.
    Objective: Pricing & Plan Boundaries
    """
    
    PLAN_LIMITS = {
        "starter": {
            "users": 1,
            "active_claims": 25,
            "ai_queries": 50,
            "storage_gb": 5
        },
        "professional": {
            "users": 5,
            "active_claims": 999999, # Effectively unlimited
            "ai_queries": 999999,
            "storage_gb": 100
        },
        "enterprise": {
            "users": 999999,
            "active_claims": 999999,
            "ai_queries": 999999,
            "storage_gb": 1000
        }
    }

    @staticmethod
    async def check_user_limit(org_id: str):
        """Check if organization has reached user limit"""
        # Get org plan
        org = await db.organizations.find_one({"id": org_id})
        if not org:
            return # Should not happen
            
        plan_id = org.get("subscription", {}).get("plan", "starter")
        limit = LimitEnforcementService.PLAN_LIMITS.get(plan_id, LimitEnforcementService.PLAN_LIMITS["starter"])["users"]
        
        current_count = await db.users.count_documents({"organization_id": org_id})
        
        if current_count >= limit:
            logger.warning(f"User limit reached for org {org_id} (Plan: {plan_id})")
            raise HTTPException(
                status_code=402, # Payment Required
                detail=f"User limit reached for {plan_id} plan. Please upgrade to add more users."
            )

    @staticmethod
    async def check_claim_limit(org_id: str):
        """Check if organization has reached active claim limit"""
        # Get org plan
        org = await db.organizations.find_one({"id": org_id})
        if not org:
            return
            
        plan_id = org.get("subscription", {}).get("plan", "starter")
        limit = LimitEnforcementService.PLAN_LIMITS.get(plan_id, LimitEnforcementService.PLAN_LIMITS["starter"])["active_claims"]
        
        # Count non-archived claims
        current_count = await db.claims.count_documents({
            "org_id": org_id,
            "status": {"$ne": "Archived"}
        })
        
        if current_count >= limit:
            logger.warning(f"Claim limit reached for org {org_id} (Plan: {plan_id})")
            raise HTTPException(
                status_code=402,
                detail=f"Active claim limit reached for {plan_id} plan. Please upgrade or archive old claims."
            )
