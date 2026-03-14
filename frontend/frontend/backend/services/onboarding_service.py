import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List
from fastapi import HTTPException

from dependencies import db
from services.observability import get_logger

logger = get_logger("eden.onboarding")

class OnboardingService:
    """
    Service to handle new organization setup and user onboarding without human intervention.
    Objective: Onboarding Without Humans
    """
    def __init__(self, database=db):
        self.db = database

    async def initialize_organization(self, owner_user: Dict[str, Any], org_name: str) -> Dict[str, Any]:
        """
        Sets up a new organization with all necessary defaults.
        """
        try:
            org_id = str(uuid.uuid4())
            
            # 1. Create Organization Record
            organization = {
                "id": org_id,
                "name": org_name,
                "owner_id": owner_user["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
                "settings": {
                    "timezone": "America/New_York",
                    "currency": "USD",
                    "feature_flags": {
                        "ai_enabled": True,
                        "gamification_enabled": True
                    }
                }
            }
            await self.db.organizations.insert_one(organization)
            
            # 2. Update Owner User
            await self.db.users.update_one(
                {"id": owner_user["id"]},
                {"$set": {
                    "organization_id": org_id,
                    "role": "owner",  # Upgrade to owner
                    "onboarding_completed": True
                }}
            )
            
            # 3. Seed Default Data (Guardrails & Defaults)
            await self._seed_defaults(org_id)
            
            logger.audit("organization_created", owner_user["email"], org_id, {"name": org_name})
            return organization
            
        except Exception as e:
            logger.error(f"Onboarding failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to initialize organization")

    async def _seed_defaults(self, org_id: str):
        """Create sensible defaults so the org works out of the box"""
        
        # Default Claim Tags
        default_tags = [
            {"name": "Urgent", "color": "red", "org_id": org_id},
            {"name": "VIP", "color": "gold", "org_id": org_id},
            {"name": "Litigation", "color": "purple", "org_id": org_id}
        ]
        await self.db.tags.insert_many(default_tags)
        
        # Default Document Folders
        default_folders = [
            {"name": "Policy", "org_id": org_id},
            {"name": "Correspondence", "org_id": org_id},
            {"name": "Estimates", "org_id": org_id},
            {"name": "Photos", "org_id": org_id}
        ]
        await self.db.document_folders.insert_many(default_folders)
        
        # Default Gamification Badges (Starter Set)
        default_badges = [
            {"name": "First Sale", "description": "Closed your first contract", "icon": "🏆", "org_id": org_id},
            {"name": "Road Warrior", "description": "Completed 10 inspections", "icon": "🚗", "org_id": org_id}
        ]
        await self.db.badges.insert_many(default_badges)

    async def invite_user(self, org_id: str, inviter: Dict[str, Any], email: str, role: str) -> Dict[str, Any]:
        """
        Invite a new user to the organization.
        Enforces role validity.
        """
        VALID_ROLES = ["admin", "adjuster", "sales", "viewer"]
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")
            
        # Check plan limits before inviting (Placeholder for Plan Enforcement)
        # await self._check_user_limit(org_id)
        
        invite_token = str(uuid.uuid4())
        invite = {
            "token": invite_token,
            "org_id": org_id,
            "email": email,
            "role": role,
            "invited_by": inviter["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending"
        }
        await self.db.invites.insert_one(invite)
        
        # In a real system, send email here
        logger.info(f"User invited: {email} to org {org_id}")
        
        return {"message": "Invite sent", "token": invite_token}  # Return token for testing/demo
