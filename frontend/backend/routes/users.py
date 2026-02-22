from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user, require_permission
from models import UserCreate, UserUpdate, ROLES, has_permission
from auth import get_password_hash
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/")
async def list_users(current_user: dict = Depends(require_permission("users.read"))):
    """List all users (admin/manager only)"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return users

@router.get("/roles")
async def get_roles(current_user: dict = Depends(get_current_active_user)):
    """Get available roles and permissions"""
    user_role = current_user.get("role", "client")
    user_level = ROLES.get(user_role, ROLES["client"])["level"]
    
    # Only show roles at or below user's level
    available_roles = {}
    for role_name, role_data in ROLES.items():
        if role_data["level"] <= user_level:
            available_roles[role_name] = {
                "level": role_data["level"],
                "permissions": role_data["permissions"]
            }
    
    return {
        "current_role": user_role,
        "current_permissions": ROLES.get(user_role, ROLES["client"])["permissions"],
        "available_roles": available_roles
    }

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current user info with permissions"""
    user_role = current_user.get("role", "client")
    role_data = ROLES.get(user_role, ROLES["client"])
    
    return {
        "id": current_user.get("id"),
        "email": current_user.get("email"),
        "full_name": current_user.get("full_name"),
        "role": user_role,
        "permissions": role_data["permissions"],
        "level": role_data["level"],
        "is_active": current_user.get("is_active", True),
        "created_at": current_user.get("created_at")
    }

@router.get("/team")
async def get_team_roster(current_user: dict = Depends(get_current_active_user)):
    """Get team members for assignment picker (non-client users with name + role)"""
    team = await db.users.find(
        {"role": {"$in": ["admin", "manager", "adjuster"]}, "is_active": True},
        {"_id": 0, "id": 1, "full_name": 1, "role": 1, "email": 1},
    ).to_list(200)
    return team


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(require_permission("users.read"))):
    """Get a specific user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/")
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_permission("users.create"))):
    """Create a new user (admin only)"""
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_data.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {list(ROLES.keys())}")
    
    # Admin can't create users with higher role than themselves
    creator_level = ROLES.get(current_user.get("role", "client"), ROLES["client"])["level"]
    new_user_level = ROLES.get(user_data.role, ROLES["client"])["level"]
    if new_user_level > creator_level:
        raise HTTPException(status_code=403, detail="Cannot create user with higher role than your own")
    
    # Create user
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "full_name": user_data.full_name,
        "role": user_data.role,
        "password": get_password_hash(user_data.password),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    # Return without password
    del new_user["password"]
    new_user.pop("_id", None)
    return new_user

@router.put("/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_permission("users.update"))):
    """Update a user (admin only)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    
    if user_data.full_name is not None:
        update_data["full_name"] = user_data.full_name
    
    if user_data.role is not None:
        if user_data.role not in ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {list(ROLES.keys())}")
        
        # Can't change role to higher than your own
        creator_level = ROLES.get(current_user.get("role", "client"), ROLES["client"])["level"]
        new_role_level = ROLES.get(user_data.role, ROLES["client"])["level"]
        if new_role_level > creator_level:
            raise HTTPException(status_code=403, detail="Cannot assign role higher than your own")
        
        # Can't demote yourself if you're the only admin
        if user_id == current_user.get("id") and user_data.role != "admin":
            admin_count = await db.users.count_documents({"role": "admin", "is_active": True})
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot demote the only admin")
        
        update_data["role"] = user_data.role
    
    if user_data.is_active is not None:
        # Can't deactivate yourself
        if user_id == current_user.get("id") and not user_data.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        
        # Can't deactivate the only admin
        if not user_data.is_active and user.get("role") == "admin":
            admin_count = await db.users.count_documents({"role": "admin", "is_active": True})
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot deactivate the only admin")
        
        update_data["is_active"] = user_data.is_active
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_permission("users.delete"))):
    """Delete a user (admin only)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Can't delete yourself
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Can't delete the only admin
    if user.get("role") == "admin":
        admin_count = await db.users.count_documents({"role": "admin", "is_active": True})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the only admin")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}

@router.post("/{user_id}/reset-password")
async def reset_user_password(user_id: str, new_password: str, current_user: dict = Depends(require_permission("users.update"))):
    """Reset a user's password (admin only)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed_password = get_password_hash(new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"password": hashed_password}})
    
    return {"message": "Password reset successfully"}
