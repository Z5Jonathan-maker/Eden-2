"""
Unified claim access control — single source of truth.

Replaces the 4 diverging copies of _can_access_claim across:
- routes/claims.py
- routes/contracts.py
- routes/ai.py
- core.py
"""


def can_access_claim(current_user: dict, claim: dict) -> bool:
    """Check if user can access a specific claim.

    Rules:
    - admin/manager: access all claims
    - client: match by email (client_email field) OR client_id
    - adjuster/other: match by created_by, assigned_to_id, or assigned_to name
    """
    role = current_user.get("role", "client")
    user_id = current_user.get("id")

    if role in {"admin", "manager"}:
        return True

    if role == "client":
        # Check email match (primary) and client_id match (fallback)
        user_email = (current_user.get("email") or "").strip().lower()
        claim_email = (claim.get("client_email") or "").strip().lower()
        if user_email and user_email == claim_email:
            return True
        return claim.get("client_id") == user_id

    # Adjuster and other roles
    assigned_to = claim.get("assigned_to")
    assigned_to_id = claim.get("assigned_to_id")
    full_name = current_user.get("full_name")
    return (
        claim.get("created_by") == user_id
        or assigned_to_id == user_id
        or (full_name and assigned_to == full_name)
    )


def claim_visibility_filter(current_user: dict) -> dict:
    """Build a MongoDB query filter for claims visible to this user."""
    import re

    role = current_user.get("role", "client")
    user_id = current_user.get("id")

    if role in {"admin", "manager"}:
        return {}

    if role == "client":
        user_email = (current_user.get("email") or "").strip().lower()
        return {"$or": [
            {"client_email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}},
            {"client_id": user_id},
        ]} if user_email else {"client_id": user_id}

    full_name = current_user.get("full_name")
    conditions = [
        {"created_by": user_id},
        {"assigned_to_id": user_id},
    ]
    if full_name:
        conditions.append({"assigned_to": full_name})
    return {"$or": conditions}
