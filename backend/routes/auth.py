from fastapi import APIRouter, HTTPException, Depends, status
from models import UserCreate, UserLogin, User, Token
from auth import get_password_hash, verify_password, create_access_token
from dependencies import db, get_current_active_user
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

@router.post("/register", response_model=User)
async def register(user_data: UserCreate):
    """Register a new user"""
    try:
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user
        user_dict = user_data.dict()
        user_dict["password"] = get_password_hash(user_dict["password"])
        
        user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
        user_dict_with_id = {**user_obj.dict(), "password": user_dict["password"]}
        
        await db.users.insert_one(user_dict_with_id)
        
        logger.info(f"User registered: {user_obj.email}")
        return user_obj
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user and return JWT token"""
    try:
        # Find user
        user = await db.users.find_one({"email": credentials.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Verify password
        if not verify_password(credentials.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Create token
        access_token = create_access_token(data={"sub": user["id"]})
        
        user_obj = User(**{k: v for k, v in user.items() if k != "password"})
        
        logger.info(f"User logged in: {user_obj.email}")
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_obj
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current logged-in user info"""
    return User(**{k: v for k, v in current_user.items() if k != "password"})

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_active_user)):
    """Logout user (client-side token removal)"""
    return {"message": "Successfully logged out"}
@router.post("/seed-test-users")
async def seed_test_users():
    """Seed test users for development/testing (creates test@eden.com and others)"""
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
        raise HTTPException(status_code=500, detail=str(e))