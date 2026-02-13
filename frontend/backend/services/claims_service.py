import logging
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException

from models import ClaimCreate, ClaimUpdate, Claim
from dependencies import db

# Structured logging setup
logger = logging.getLogger(__name__)

# --- 1. State Machine Definition (Enforcement Rule #3) ---
ALLOWED_TRANSITIONS = {
    "New": ["Under Review", "Archived"],
    "Under Review": ["Approved", "Denied", "New", "Archived"],
    "Approved": ["Closed", "Archived"],
    "Denied": ["Under Review", "Archived"],
    "Closed": ["Archived"],
    "Archived": ["New"] # Can be restored to New
}

class ClaimsService:
    def __init__(self, database=db):
        self.db = database

    # --- 2. Single Source of Truth (Enforcement Rule #2) ---
    async def create_claim(self, claim_data: ClaimCreate, current_user: Dict[str, Any]) -> Claim:
        """Create a new claim with all side effects (notifications, events, logs)"""
        try:
            claim_dict = claim_data.model_dump()
            claim_dict["created_by"] = current_user["id"]
            claim_dict["assigned_to"] = current_user["full_name"]
            
            # Enforce initial state
            claim_dict["status"] = "New"
            
            claim_obj = Claim(**claim_dict)
            await self.db.claims.insert_one(claim_obj.model_dump())
            
            # --- 4. Domain Events (Enforcement Rule #4) ---
            await self._dispatch_domain_event("ClaimCreated", claim_obj, current_user)
            
            return claim_obj
            
        except Exception as e:
            logger.error(f"Create claim error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def update_claim(self, claim_id: str, updates: ClaimUpdate, current_user: Dict[str, Any]) -> Claim:
        """Update a claim with STRICT status transition logic"""
        try:
            # Only adjusters and admins can update
            if current_user["role"] not in ["admin", "adjuster"]:
                raise HTTPException(status_code=403, detail="Not authorized to update claims")
            
            claim = await self.db.claims.find_one({"id": claim_id})
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")
            
            current_status = claim.get("status", "New")
            new_status = updates.status
            
            # --- 3. Lifecycle Enforcement (Enforcement Rule #3) ---
            if new_status and new_status != current_status:
                self._validate_transition(current_status, new_status)
            
            update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
            update_data["updated_at"] = datetime.now(timezone.utc)
            
            await self.db.claims.update_one(
                {"id": claim_id},
                {"$set": update_data}
            )
            
            updated_claim_doc = await self.db.claims.find_one({"id": claim_id})
            updated_claim = Claim(**updated_claim_doc)
            
            # --- 4. Domain Events (Enforcement Rule #4) ---
            await self._dispatch_domain_event("ClaimUpdated", updated_claim, current_user, 
                                            details={"changes": update_data, "old_status": current_status})
            
            return updated_claim
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Update claim error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_claims(self, filter_status: Optional[str], include_archived: bool, limit: int, current_user: Dict[str, Any]) -> List[Claim]:
        """Get all claims (filtered by role). Archived claims hidden by default."""
        try:
            query = {}
            
            # Exclude archived claims by default
            if not include_archived:
                query["is_archived"] = {"$ne": True}
            
            # Clients only see their own claims
            if current_user["role"] == "client":
                query["client_email"] = current_user["email"]
            
            # Filter by status if provided
            if filter_status and filter_status != "All":
                query["status"] = filter_status
            
            # Limit to reasonable max
            fetch_limit = min(limit, 1000)
            claims = await self.db.claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(fetch_limit)
            return [Claim(**claim) for claim in claims]
            
        except Exception as e:
            logger.error(f"Get claims error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_claim(self, claim_id: str, current_user: Dict[str, Any]) -> Claim:
        """Get specific claim by ID with permission check"""
        try:
            claim = await self.db.claims.find_one({"id": claim_id})
            
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")
            
            # Clients can only view their own claims
            if current_user["role"] == "client" and claim["client_email"] != current_user["email"]:
                raise HTTPException(status_code=403, detail="Access denied")
            
            return Claim(**claim)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get claim error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def delete_claim(self, claim_id: str, permanent: bool, current_user: Dict[str, Any]) -> Dict[str, str]:
        """Soft-delete (archive) or hard-delete a claim"""
        try:
            claim = await self.db.claims.find_one({"id": claim_id})
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")
            
            if permanent:
                # Hard delete - only for truly removing data
                result = await self.db.claims.delete_one({"id": claim_id})
                if result.deleted_count == 0:
                    raise HTTPException(status_code=404, detail="Claim not found")
                logger.info(f"Claim permanently deleted: {claim_id}")
                return {"message": "Claim permanently deleted"}
            else:
                # Soft delete - archive the claim
                await self.db.claims.update_one(
                    {"id": claim_id},
                    {
                        "$set": {
                            "status": "Archived", # Explicit status change
                            "archived_at": datetime.now(timezone.utc).isoformat(),
                            "archived_by": current_user.get("id"),
                            "is_archived": True
                        }
                    }
                )
                
                # --- 4. Domain Events (Enforcement Rule #4) ---
                # We need to create a Claim object for the event, even though we just modified it
                archived_claim = Claim(**claim) # Use old state + new status logically
                archived_claim.status = "Archived"
                
                await self._dispatch_domain_event("ClaimArchived", archived_claim, current_user)
                
                return {"message": "Claim archived successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Delete claim error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def restore_claim(self, claim_id: str, current_user: Dict[str, Any]) -> Dict[str, str]:
        """Restore an archived claim"""
        try:
            claim = await self.db.claims.find_one({"id": claim_id})
            if not claim:
                raise HTTPException(status_code=404, detail="Claim not found")
            
            if not claim.get("is_archived"):
                raise HTTPException(status_code=400, detail="Claim is not archived")
            
            await self.db.claims.update_one(
                {"id": claim_id},
                {
                    "$set": {
                        "status": "New",  # Reset to New upon restore
                        "is_archived": False,
                        "restored_at": datetime.now(timezone.utc).isoformat(),
                        "restored_by": current_user.get("id")
                    },
                    "$unset": {
                        "archived_at": "",
                        "archived_by": ""
                    }
                }
            )
            
            restored_claim = Claim(**claim)
            restored_claim.status = "New"
            
            await self._dispatch_domain_event("ClaimRestored", restored_claim, current_user)
            
            return {"message": "Claim restored successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Restore claim error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # --- Internal Enforcement Methods ---

    def _validate_transition(self, current_status: str, new_status: str):
        """
        Enforce allowed state transitions.
        Raises HTTPException if transition is invalid.
        """
        allowed = ALLOWED_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid state transition from '{current_status}' to '{new_status}'. Allowed: {allowed}"
            )

    async def _dispatch_domain_event(self, event_type: str, claim: Claim, user: Dict[str, Any], details: dict = None):
        """
        Internal Event Bus: Dispatches domain events to side-effect handlers.
        This keeps the core service logic clean.
        """
        logger.info(f"DOMAIN_EVENT: {event_type} for Claim {claim.id}")
        
        # 1. Structured Logging (Audit Trail)
        self._log_claim_event(event_type, claim.id, user["email"], details)
        
        # 2. Side Effects (Notifications, Email, SMS, Gamification)
        # In a larger system, this would be a real event bus (RabbitMQ/Kafka)
        # Here we just await the handlers directly.
        
        if event_type == "ClaimCreated":
            await self._notify_claim_created(claim, user["full_name"])
            await self._email_claim_created(claim)
            try:
                await self._sms_claim_created(claim.model_dump())
            except Exception:
                pass # Non-blocking
            await self._emit_gamification_event(user["id"], "claims.created", claim)

        elif event_type == "ClaimUpdated":
            # Handle specific update triggers (status change, assignment)
            changes = details.get("changes", {})
            old_status = details.get("old_status")
            
            if "status" in changes and changes["status"] != old_status:
                await self._notify_status_change(claim.id, claim.claim_number, old_status, changes["status"], user["full_name"])
                await self._email_status_change(claim.client_email, claim.client_name, claim.claim_number, old_status, changes["status"], claim.claim_type)
            
            if "assigned_to" in changes:
                await self._notify_claim_assigned(claim.id, claim.claim_number, changes["assigned_to"], user["full_name"])
                await self._email_assignment(claim.client_email, claim.client_name, claim.claim_number, changes["assigned_to"])

    # --- Side Effect Handlers (Private) ---

    def _log_claim_event(self, event: str, claim_id: str, user_email: str, details: dict = None):
        log_data = {
            "event": event,
            "claim_id": claim_id,
            "user": user_email,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if details:
            log_data.update(details)
        logger.info(f"AUDIT: {log_data}")

    async def _emit_gamification_event(self, user_id: str, event_type: str, claim: Claim):
        try:
            from incentives_engine.events import emit_claim_event
            await emit_claim_event(
                db=self.db,
                user_id=user_id,
                event_type=event_type,
                claim_id=claim.id,
                claim_number=claim.claim_number,
                claim_type=claim.claim_type
            )
        except Exception as e:
            logger.warning(f"Failed to emit game event: {e}")

    # Wrappers for external notification services (kept for now to minimize refactor scope outside Claims)
    async def _notify_claim_created(self, claim, creator_name):
        from routes.notifications import notify_claim_created
        await notify_claim_created(claim, creator_name)

    async def _notify_claim_assigned(self, claim_id, claim_number, assigned_to, assigner_name):
        from routes.notifications import notify_claim_assigned
        await notify_claim_assigned(claim_id, claim_number, assigned_to, assigner_name)

    async def _notify_status_change(self, claim_id, claim_number, old_status, new_status, changer_name):
        from routes.notifications import notify_status_change
        await notify_status_change(claim_id, claim_number, old_status, new_status, changer_name)

    async def _email_claim_created(self, claim):
        from services.email_service import send_claim_created_notification
        await send_claim_created_notification(claim.client_email, claim.client_name, claim.claim_number, claim.claim_type, claim.property_address)

    async def _email_status_change(self, client_email, client_name, claim_number, old_status, new_status, claim_type):
        from services.email_service import send_status_change_notification
        await send_status_change_notification(client_email, client_name, claim_number, old_status, new_status, claim_type)

    async def _email_assignment(self, client_email, client_name, claim_number, adjuster_name):
        from services.email_service import send_assignment_notification
        await send_assignment_notification(client_email, client_name, claim_number, adjuster_name)

    async def _sms_claim_created(self, claim_dict):
        from routes.messaging_sms import send_fnol_sms
        if claim_dict.get("client_phone"):
            base_url = os.environ.get("REACT_APP_BACKEND_URL", "https://eden.careclaims.com")
            status_link = f"{base_url}/status/{claim_dict['id']}"
            await send_fnol_sms(claim_dict["id"], claim_dict["client_phone"], status_link)
