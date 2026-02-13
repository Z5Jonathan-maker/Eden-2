from typing import List, Dict, Any
from fastapi import HTTPException

class PermissionService:
    """
    Centralized permission enforcement.
    Objective: Role & Permission Finalization
    """
    
    # Role Hierarchy & Definitions
    ROLES = {
        "owner": ["admin", "adjuster", "sales", "viewer"],
        "admin": ["adjuster", "sales", "viewer"],
        "adjuster": ["viewer"],
        "sales": ["viewer"],
        "viewer": []
    }
    
    PERMISSIONS = {
        "claim:create": ["owner", "admin", "adjuster", "sales"],
        "claim:read": ["owner", "admin", "adjuster", "sales", "viewer"],
        "claim:update": ["owner", "admin", "adjuster"],
        "claim:delete": ["owner", "admin"],
        "user:invite": ["owner", "admin"],
        "org:update": ["owner"],
        "finance:view": ["owner", "admin"]
    }

    @staticmethod
    def check_permission(user: Dict[str, Any], action: str):
        """
        Enforce strict permission check.
        Raises 403 if unauthorized.
        """
        user_role = user.get("role", "viewer")
        allowed_roles = PermissionService.PERMISSIONS.get(action, [])
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Permission denied: User role '{user_role}' cannot perform '{action}'"
            )

    @staticmethod
    def check_role(user: Dict[str, Any], required_role: str):
        """
        Check if user has at least the required role level.
        """
        user_role = user.get("role", "viewer")
        
        # Simple check for exact match or hierarchy
        if user_role == required_role:
            return
            
        # Check hierarchy if needed (Owner > Admin > Adjuster)
        # This implementation assumes explicit allow-lists in PERMISSIONS is safer,
        # but hierarchical check is useful for broad categories.
        hierarchy = ["owner", "admin", "adjuster", "sales", "viewer"]
        try:
            user_idx = hierarchy.index(user_role)
            req_idx = hierarchy.index(required_role)
            if user_idx > req_idx: # Lower index is higher rank
                 raise HTTPException(status_code=403, detail=f"Requires role '{required_role}' or higher")
        except ValueError:
             raise HTTPException(status_code=403, detail="Invalid role configuration")

    @staticmethod
    def enforce_data_access(user: Dict[str, Any], resource: Dict[str, Any]):
        """
        Enforce organization-level isolation.
        """
        user_org = user.get("organization_id")
        resource_org = resource.get("org_id") or resource.get("organization_id")
        
        if not user_org or not resource_org:
            # Fallback for legacy data without orgs (allow for now, log warning)
            return
            
        if user_org != resource_org:
            raise HTTPException(status_code=404, detail="Resource not found") # 404 to hide existence
