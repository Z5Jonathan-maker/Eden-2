from fastapi import APIRouter, HTTPException, Depends, status, Response, Request
from fastapi.responses import JSONResponse
from models import UserCreate, UserLogin, User, Token, ROLES
from auth import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, validate_password_strength
from dependencies import db, get_current_active_user, require_role
from security import check_rate_limit
from datetime import datetime, timezone
import uuid
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

REGISTRATION_SECRET = os.environ.get("REGISTRATION_SECRET", "").strip()

@router.post("/register", response_model=User)
async def register(user_data: UserCreate, request: Request):
    """Register a new user. In production, requires a valid invite code."""
    # Rate limit registration attempts (raises HTTPException if exceeded)
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"register:{client_ip}", "auth")
    try:
        # In production, always require an invite/registration secret
        is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"
        if is_production:
            if not REGISTRATION_SECRET:
                raise HTTPException(
                    status_code=503,
                    detail="Registration is not configured. Contact administrator."
                )
            body = await request.json() if hasattr(request, '_body') else {}
            # Accept invite_code from the original Pydantic-parsed body won't have it,
            # so re-parse the raw body to check for extra fields
            import json
            raw_body = await request.body()
            try:
                raw = json.loads(raw_body)
            except Exception:
                raw = {}
            invite_code = raw.get("invite_code", "")
            if invite_code != REGISTRATION_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Valid invite code required for registration"
                )

        # Validate password strength
        password_error = validate_password_strength(user_data.password)
        if password_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=password_error
            )

        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Create user
        user_dict = user_data.model_dump()
        user_dict["password"] = get_password_hash(user_dict["password"])

        user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
        user_dict_with_id = {**user_obj.model_dump(), "password": user_dict["password"]}

        await db.users.insert_one(user_dict_with_id)

        logger.info(f"User registered: {user_obj.email}")
        return user_obj

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/login")
async def login(credentials: UserLogin, request: Request, response: Response):
    """Login user and set httpOnly cookie with JWT token"""
    try:
        # Rate-limit login attempts by IP
        client_ip = request.client.host if request.client else "unknown"
        check_rate_limit(f"auth:{client_ip}", "auth")

        # Find user — constant-time rejection to prevent timing oracle
        user = await db.users.find_one({"email": credentials.email})
        if not user:
            # Perform a dummy hash check so response time is indistinguishable
            verify_password(credentials.password, get_password_hash("dummy"))
            logger.warning("Login failed – unknown email: %s from IP %s", credentials.email, client_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # Verify password
        if not verify_password(credentials.password, user["password"]):
            logger.warning("Login failed – bad password for %s from IP %s", credentials.email, client_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # Create access + refresh tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})

        is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"

        # Access token cookie — short-lived (1 hour)
        response.set_cookie(
            key="eden_token",
            value=access_token,
            httponly=True,
            secure=is_production,
            samesite="none" if is_production else "lax",
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/"
        )

        # Refresh token cookie — long-lived (7 days)
        response.set_cookie(
            key="eden_refresh",
            value=refresh_token,
            httponly=True,
            secure=is_production,
            samesite="none" if is_production else "lax",
            max_age=60 * 60 * 24 * 7,
            path="/api/auth"  # Only sent to auth endpoints
        )

        user_obj = User(**{k: v for k, v in user.items() if k != "password"})
        user_dict = user_obj.model_dump()
        role = user_dict.get("role", "client")
        role_info = ROLES.get(role, ROLES.get("client", {"permissions": [], "level": 0}))
        user_dict["permissions"] = role_info["permissions"]
        user_dict["level"] = role_info["level"]

        logger.info(f"User logged in: {user_obj.email}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_dict
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current logged-in user info with role-based permissions"""
    user_data = {k: v for k, v in current_user.items() if k not in ("password", "_id")}
    role = user_data.get("role", "client")
    role_info = ROLES.get(role, ROLES.get("client", {"permissions": [], "level": 0}))
    user_data["permissions"] = role_info["permissions"]
    user_data["level"] = role_info["level"]
    return user_data

@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    """Exchange a valid refresh token for a new access token."""
    refresh = request.cookies.get("eden_refresh")
    if not refresh:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_access_token(refresh)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Verify user still exists and is active
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Issue new access token + rotate refresh token
    new_access = create_access_token(data={"sub": user_id})
    new_refresh = create_refresh_token(data={"sub": user_id})
    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"

    response.set_cookie(
        key="eden_token",
        value=new_access,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    # Rotate refresh token — old one becomes invalid on next use
    response.set_cookie(
        key="eden_refresh",
        value=new_refresh,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=60 * 60 * 24 * 7,
        path="/api/auth"
    )

    return {"access_token": new_access, "token_type": "bearer"}

@router.post("/logout")
async def logout(request: Request, response: Response, current_user: dict = Depends(get_current_active_user)):
    """Logout user, blacklist tokens, and clear httpOnly cookies"""
    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"

    # Blacklist current access token so it can't be reused
    try:
        token = request.cookies.get("eden_token")
        if not token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.lower().startswith("bearer "):
                token = auth_header.split(" ", 1)[1].strip()
        if token:
            payload = decode_access_token(token)
            if payload and payload.get("jti"):
                await db.token_blacklist.insert_one({
                    "jti": payload["jti"],
                    "user_id": payload.get("sub"),
                    "exp": payload.get("exp"),
                    "blacklisted_at": datetime.now(timezone.utc).isoformat(),
                })
    except Exception as e:
        logger.warning(f"Token blacklist on logout failed (non-fatal): {e}")

    # Clear both cookies
    response.delete_cookie(
        key="eden_token",
        path="/",
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax"
    )
    response.delete_cookie(
        key="eden_refresh",
        path="/api/auth",
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax"
    )
    logger.info(f"User logged out: {current_user.get('email', 'unknown')}")
    return {"message": "Successfully logged out"}
@router.post("/seed-test-users")
async def seed_test_users(current_user: dict = Depends(require_role(["admin"]))):
    """Seed test users for development/testing (creates test@eden.com and others)"""
    if os.environ.get("ENVIRONMENT", "development").lower() == "production":
        raise HTTPException(status_code=403, detail="Test user seeding is disabled in production")

    try:
        test_users = [
            {
                "id": str(uuid.uuid4()),
                "email": "test@eden.com",
                "full_name": "Test User",
                "role": "adjuster",
                "password": get_password_hash("password"),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "email": "admin@eden.com",
                "full_name": "Admin User",
                "role": "admin",
                "password": get_password_hash("password"),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "email": "client@eden.com",
                "full_name": "Client User",
                "role": "client",
                "password": get_password_hash("password"),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        created_count = 0
        skipped_count = 0
        
        for user_data in test_users:
            # Check if user already exists
            existing = await db.users.find_one({"email": user_data["email"]})
            if existing:
                skipped_count += 1
                logger.info(f"Test user already exists: {user_data['email']}")
            else:
                await db.users.insert_one(user_data)
                created_count += 1
                logger.info(f"Created test user: {user_data['email']}")
        
        return {
            "status": "success",
            "created": created_count,
            "skipped": skipped_count,
            "total": len(test_users),
            "message": "Test users seeding completed"
        }
        
    except Exception as e:
        logger.error(f"Test users seeding error: {e}")
        raise HTTPException(status_code=500, detail="Failed to seed test users")
