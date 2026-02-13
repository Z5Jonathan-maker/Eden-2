from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Request, Depends, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import List
import os
import logging
import uuid
import traceback
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import routes after loading env
from integrations import integrations_router
from integrations.google_client import router as google_router
from integrations.signnow_client import router as signnow_router
from routes.auth import router as auth_router
from routes.claims import router as claims_router
from routes.notifications import router as notifications_router
from routes.email import router as email_router
from routes.data import router as data_router
from routes.university import router as university_router, seed_university_data
from routes.users import router as users_router
from routes.supplements import router as supplements_router
from routes.scales import router as scales_router
from routes.payments import router as payments_router
from routes.settings import router as settings_router
from routes.admin import router as admin_router
from routes.uploads import router as uploads_router
from routes.inspection_photos import router as inspection_photos_router
from routes.canvassing_map import router as canvassing_map_router
from routes.weather import router as weather_router
from routes.client_education import router as client_education_router
from routes.vision_board import router as vision_board_router
from routes.transcription import router as transcription_router
from routes.harvest_gamification import router as harvest_gamification_router
from routes.harvest_scoring import router as harvest_scoring_router
from routes.contracts import router as contracts_router
from routes.oauth import router as oauth_router
from routes.ai import router as ai_router
from routes.ai_claim_workspace import router as ai_claim_workspace_router
from routes.gamma import router as gamma_router
from routes.cqil import router as cqil_router
from routes.centurion import router as centurion_router
from routes.regrid import router as regrid_router
from routes.knowledge_base import router as knowledge_base_router
from routes.florida_statutes import router as florida_statutes_router
from routes.client_status import router as client_status_router
from routes.harvest_v2 import router as harvest_v2_router
from routes.harvest_territories import router as harvest_territories_router
from routes.messaging_sms import router as messaging_sms_router
from routes.bots import router as bots_router
from routes.twilio_voice import router as twilio_voice_router
from routes.voice_assistant_console import router as voice_assistant_console_router
from routes.harvest_rewards_campaigns import router as harvest_rewards_campaigns_router
from routes.incentives_engine import router as incentives_engine_router
from routes.battle_pass import router as battle_pass_router
from routes.mycard import router as mycard_router
from routes.comm_conversations import router as comm_conversations_router
from feature_flags import feature_flags_router
from websocket_manager import manager
from auth import decode_access_token, get_password_hash

# ============================================
# ENVIRONMENT VALIDATION
# ============================================
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError(
        "❌ MONGO_URL environment variable is required.\n"
        "   See .env.example for configuration.\n"
        "   Quick start: MONGO_URL=mongodb://localhost:27017"
    )

jwt_secret = os.environ.get('JWT_SECRET_KEY')
if not jwt_secret:
    raise RuntimeError(
        "❌ JWT_SECRET_KEY environment variable is required.\n"
        "   See .env.example for configuration."
    )

# MongoDB connection with validation
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'eden_claims')]

from middleware import StructuredLoggingMiddleware

# Create the main app without a prefix
app = FastAPI(title="Eden Claims Management API")

# Add Structured Logging Middleware
app.add_middleware(StructuredLoggingMiddleware)

# Startup logging
logger = logging.getLogger("eden.startup")

@app.on_event("startup")
async def startup_event():
    """Log environment configuration at startup"""
    logger.info("="*70)
    logger.info("🚀 EDEN BACKEND STARTING")
    logger.info("="*70)
    logger.info(f"Environment: {os.environ.get('ENVIRONMENT', 'unknown')}")
    
    # Mask sensitive parts of MongoDB URL
    masked_mongo = mongo_url[:50] + "..." if len(mongo_url) > 50 else mongo_url
    logger.info(f"Database: {masked_mongo}")
    logger.info(f"Database Name: {os.environ.get('DB_NAME', 'eden_claims')}")
    logger.info(f"JWT Algorithm: {os.environ.get('JWT_ALGORITHM', 'HS256')}")
    logger.info(f"CORS Origins: {os.environ.get('CORS_ORIGINS', 'not configured')}")
    logger.info(f"Frontend URL: {os.environ.get('FRONTEND_URL', 'not configured')}")
    logger.info("="*70)




# ============================================
# GLOBAL EXCEPTION HANDLER
# ============================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler to catch unhandled exceptions.
    Logs the full traceback and returns a clean error response.
    """
    error_id = str(uuid.uuid4())[:8]
    error_logger = logging.getLogger("eden.errors")
    
    # Log the full error with traceback
    error_logger.error(f"[ERROR-{error_id}] Unhandled exception at {request.url.path}")
    error_logger.error(f"[ERROR-{error_id}] {type(exc).__name__}: {str(exc)}")
    error_logger.error(f"[ERROR-{error_id}] Traceback:\n{traceback.format_exc()}")
    
    # Return a clean error response (don't expose internal details in production)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "error_id": error_id,
            "message": "An unexpected error occurred. Please try again or contact support.",
            "path": str(request.url.path)
        }
    )


# ============================================
# RATE LIMITING (using security.py RateLimiter)
# ============================================
from security import RateLimiter

# Global rate limiter instance
rate_limiter = RateLimiter()

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware - limits requests per IP.
    Skips rate limiting for health checks and image endpoints.
    """
    # Skip for health checks and image endpoints
    path = str(request.url.path)
    if path in ["/health", "/api/"] or ("/image" in path and "token=" in str(request.url.query)):
        return await call_next(request)
    
    # Get client IP
    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.headers.get("x-real-ip", "")
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    
    # Check rate limit (120 requests/minute with 300s block after exceeding)
    is_limited, remaining, reset_time = rate_limiter.is_rate_limited(
        key=client_ip,
        limit=120,
        window=60,
        block_duration=300
    )
    
    if is_limited:
        return JSONResponse(
            status_code=429,
            content={
                "error": "Too Many Requests",
                "message": "Rate limit exceeded. Please slow down.",
                "retry_after": int(reset_time - __import__('time').time()) if reset_time else 60
            },
            headers={"Retry-After": str(int(reset_time - __import__('time').time()) if reset_time else 60)}
        )
    
    # Process request
    response = await call_next(request)
    
    # Add rate limit headers
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    
    return response

# Health check endpoint for Kubernetes probes (must be at root, not /api)
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    try:
        # Check MongoDB connectivity
        await db.command('ping')
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Check uploads directory (use env var or fallback to local)
    uploads_dir = os.environ.get("UPLOAD_DIR", str(Path(__file__).parent / "uploads"))
    storage_status = "ok" if Path(uploads_dir).exists() else "missing"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "eden-claims-api",
        "checks": {
            "database": db_status,
            "storage": storage_status
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def require_admin_user(authorization: str = Header(default=None)):
    """Require a valid bearer token for an active admin user."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Inactive or missing user")

    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


@app.get("/api/debug/info")
async def debug_info(current_user: dict = Depends(require_admin_user)):
    """Debug info endpoint - version, build date, configuration"""
    return {
        "version": "1.0.0",
        "build_date": "2026-02-05",
        "environment": os.environ.get("ENVIRONMENT", "development"),
        "features": {
            "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")),
            "stripe_enabled": bool(os.environ.get("STRIPE_SECRET_KEY")),
            "regrid_enabled": bool(os.environ.get("REGRID_API_TOKEN")),
            "oauth_google": bool(os.environ.get("GOOGLE_CLIENT_ID")),
            "oauth_signnow": bool(os.environ.get("SIGNNOW_CLIENT_ID")),
            "oauth_gamma": bool(os.environ.get("GAMMA_CLIENT_ID"))
        }
    }


@app.post("/api/demo/seed")
async def seed_demo(current_user: dict = Depends(require_admin_user)):
    """Seed demo data for testing/staging"""
    from demo_data import seed_demo_data
    result = await seed_demo_data(db)
    return result


@app.delete("/api/demo/clear")
async def clear_demo(current_user: dict = Depends(require_admin_user)):
    """Clear demo data"""
    from demo_data import clear_demo_data
    result = await clear_demo_data(db)
    return result

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Eden Claims Management API is running"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the main api router
app.include_router(api_router)

# Include auth and claims routers (they have their own /api prefix)
app.include_router(auth_router)
app.include_router(claims_router)
app.include_router(notifications_router)
app.include_router(email_router)
app.include_router(data_router)
app.include_router(university_router)
app.include_router(users_router)
app.include_router(supplements_router)
app.include_router(scales_router)
app.include_router(payments_router)
app.include_router(settings_router)
app.include_router(admin_router)
app.include_router(uploads_router)
app.include_router(inspection_photos_router)
app.include_router(canvassing_map_router)
app.include_router(weather_router)
app.include_router(client_education_router)
app.include_router(vision_board_router)
app.include_router(transcription_router)
app.include_router(harvest_gamification_router)
app.include_router(harvest_scoring_router)
app.include_router(contracts_router)
app.include_router(oauth_router)
app.include_router(ai_router)
app.include_router(ai_claim_workspace_router)
app.include_router(gamma_router)
app.include_router(cqil_router)
app.include_router(centurion_router)
app.include_router(regrid_router)
app.include_router(knowledge_base_router)
app.include_router(florida_statutes_router)
app.include_router(client_status_router)
app.include_router(harvest_v2_router)
app.include_router(harvest_territories_router)
app.include_router(messaging_sms_router)
app.include_router(bots_router)
app.include_router(twilio_voice_router)
app.include_router(voice_assistant_console_router)
app.include_router(harvest_rewards_campaigns_router)
app.include_router(incentives_engine_router)
app.include_router(battle_pass_router)
app.include_router(mycard_router)
app.include_router(comm_conversations_router)
app.include_router(feature_flags_router)

# Include integrations routers
app.include_router(integrations_router)
app.include_router(google_router)
app.include_router(signnow_router)

# Startup event to seed data
@app.on_event("startup")
async def startup_event():
    """Seed university data, ensure admin user exists, initialize gamification, and start scheduler"""
    await seed_university_data()
    await ensure_admin_user()
    await initialize_harvest_gamification()
    await initialize_background_scheduler()


async def initialize_harvest_gamification():
    """Initialize Harvest v2 gamification - seed badges and Daily Blitz"""
    try:
        from routes.harvest_scoring_engine import init_scoring_engine, initialize_harvest_gamification as init_gamification
        init_scoring_engine(db)
        await init_gamification()
        logging.info("Harvest gamification initialized: badges seeded, Daily Blitz created")
    except Exception as e:
        logging.error(f"Failed to initialize Harvest gamification: {e}")


async def initialize_background_scheduler():
    """Initialize and start the background job scheduler"""
    try:
        from workers.scheduler import init_scheduler, start_scheduler
        init_scheduler(db)
        start_scheduler()
        logging.info("Background scheduler started successfully")
    except Exception as e:
        logging.error(f"Failed to start background scheduler: {e}")

async def ensure_admin_user():
    """Ensure at least one admin user exists"""
    admin_count = await db.users.count_documents({"role": "admin"})
    if admin_count == 0:
        environment = os.environ.get("ENVIRONMENT", "development").lower()
        existing_user = await db.users.find_one({"email": "test@eden.com"})
        if existing_user and environment in ["development", "local", "test"]:
            await db.users.update_one({"email": "test@eden.com"}, {"$set": {"role": "admin"}})
            logging.warning("Upgraded test@eden.com to admin in non-production environment")
            return

        admin_password = os.environ.get("ADMIN_INITIAL_PASSWORD", "").strip()
        if not admin_password:
            logging.error(
                "No admin user exists and ADMIN_INITIAL_PASSWORD is not set. "
                "Refusing insecure default password bootstrap."
            )
            return

        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@eden.com",
            "full_name": "System Admin",
            "role": "admin",
            "password": get_password_hash(admin_password),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logging.info(
            "Created admin user admin@eden.com using ADMIN_INITIAL_PASSWORD bootstrap"
        )

# WebSocket endpoint for real-time notifications
@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = None):
    """WebSocket endpoint for real-time notifications"""
    user_id = None
    try:
        # Authenticate the WebSocket connection
        if not token:
            await websocket.close(code=4001, reason="Missing token")
            return
        
        payload = decode_access_token(token)
        if not payload:
            await websocket.close(code=4001, reason="Invalid token")
            return
        
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token payload")
            return
        
        # Accept connection and register
        await manager.connect(websocket, user_id)
        
        # Send initial connection success message
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connected successfully"
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                # Handle ping/pong for keeping connection alive
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket receive error: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if user_id:
            manager.disconnect(websocket, user_id)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    # Strict CORS - only allow configured origins. Default to local frontend
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    expose_headers=["X-RateLimit-Remaining", "Retry-After"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    # Stop background scheduler
    try:
        from workers.scheduler import stop_scheduler
        stop_scheduler()
    except Exception as e:
        logger.error(f"Failed to stop scheduler: {e}")
