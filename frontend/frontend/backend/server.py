from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Request, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import List
import asyncio
import os
import logging
import time
import uuid
import traceback
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging early — before any getLogger() calls
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

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
from routes.workbooks import router as workbooks_router
from routes.users import router as users_router
from routes.supplements import router as supplements_router
from routes.scales import router as scales_router
from routes.payments import router as payments_router
from routes.settings import router as settings_router
from routes.admin import router as admin_router
from routes.uploads import router as uploads_router
from routes.inspection import router as inspection_photos_router
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
from services.ollama_config import get_ollama_api_key
from routes.knowledge_base import router as knowledge_base_router
from routes.florida_statutes import router as florida_statutes_router
from routes.client_status import router as client_status_router
from routes.harvest import router as harvest_v2_router
from routes.harvest_territories import router as harvest_territories_router
from routes.messaging_sms import router as messaging_sms_router
from routes.bots import router as bots_router
from routes.twilio_voice import router as twilio_voice_router
from routes.voice_assistant_console import router as voice_assistant_console_router
from routes.harvest_rewards_campaigns import router as harvest_rewards_campaigns_router
from routes.incentives import router as incentives_engine_router
from routes.battle_pass import router as battle_pass_router
from routes.mycard import router as mycard_router
from routes.comm_conversations import router as comm_conversations_router
from routes.integrations import router as integrations_services_router
from routes.imagery import router as imagery_router
from routes.evidence import router as evidence_router
from routes.ops_manifest import router as ops_manifest_router
from routes.tasks import router as tasks_router
from routes.garden_dashboard import router as garden_dashboard_router
from routes.email_intelligence import router as email_intelligence_router
from routes.claimpilot import router as claimpilot_router
from routes.photo_analysis import router as photo_analysis_router
from routes.calendar import router as calendar_router
from routes.commissions import router as commissions_router
from routes.compliance import router as compliance_router
from routes.intake import router as intake_router
from routes.email_log import router as email_log_router
from routes.gmail_sync import router as gmail_sync_router
from routes.pdf_extract import router as pdf_extract_router
from feature_flags import feature_flags_router
from websocket_manager import manager
from auth import decode_access_token, get_password_hash

# ============================================
# ENVIRONMENT VALIDATION
# ============================================
# MongoDB and JWT validation happens in dependencies.py
# Import single shared Motor client (avoids dual connection pool)
from dependencies import client, db

jwt_secret = os.environ.get('JWT_SECRET_KEY')
if not jwt_secret:
    raise RuntimeError(
        "❌ JWT_SECRET_KEY environment variable is required.\n"
        "   See .env.example for configuration."
    )

from middleware import StructuredLoggingMiddleware, CSRFProtectionMiddleware
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """Startup: seed data, ensure admin, init gamification, create indexes, start scheduler."""
    await log_startup_config()
    await seed_university_data()
    await ensure_admin_user()
    await ensure_workbooks_exist()
    await initialize_harvest_gamification()
    await initialize_background_scheduler()
    await initialize_claimpilot()
    await ensure_database_indexes()
    yield
    # Shutdown: close DB client and stop scheduler
    logging.info("Eden server shutting down")
    client.close()
    try:
        from workers.scheduler import stop_scheduler
        stop_scheduler()
    except Exception as e:
        logging.error(f"Failed to stop scheduler: {e}")


async def ensure_database_indexes():
    """Create all database indexes at startup (idempotent)."""
    try:
        await db.inspection_photos.create_index(
            [("claim_id", 1), ("sha256_hash", 1)],
            background=True, sparse=True
        )
        await db.notifications.create_index(
            [("user_id", 1), ("is_read", 1), ("created_at", -1)],
            background=True
        )
        await db.notifications.create_index(
            [("user_id", 1), ("created_at", -1)],
            background=True
        )
        await db.contracts.create_index(
            [("claim_id", 1), ("status", 1)],
            background=True
        )
        await db.florida_statutes.create_index(
            [("body_text", "text"), ("heading", "text"), ("section_number", "text")],
            background=True
        )
        await db.claims.create_index(
            [("assigned_to_id", 1), ("status", 1)],
            background=True
        )
        await db.claims.create_index(
            [("client_email", 1)],
            background=True
        )
        # Token blacklist: TTL index auto-deletes expired entries after 24h buffer
        await db.token_blacklist.create_index(
            "blacklisted_at",
            expireAfterSeconds=60 * 60 * 24 * 8,  # 8 days (refresh token lifetime + 1 day buffer)
            background=True
        )
        await db.token_blacklist.create_index("jti", unique=True, background=True)
        # ClaimPilot indexes
        await db.claimpilot_insights.create_index([("claim_id", 1), ("created_at", -1)], background=True)
        await db.claimpilot_pending.create_index([("status", 1), ("created_at", -1)], background=True)
        await db.claimpilot_audit.create_index([("agent_name", 1), ("created_at", -1)], background=True)
        # Calendar indexes
        await db.calendar_events.create_index([("assigned_to_id", 1), ("start_time", 1)], background=True)
        await db.calendar_events.create_index([("claim_id", 1), ("start_time", 1)], background=True)
        await db.calendar_events.create_index([("start_time", 1), ("status", 1)], background=True)
        await db.calendar_events.create_index([("parent_event_id", 1)], background=True, sparse=True)
        # Compliance deadline indexes
        await db.compliance_deadlines.create_index([("claim_id", 1), ("deadline_date", 1)], background=True)
        await db.compliance_deadlines.create_index([("status", 1), ("deadline_date", 1)], background=True)
        await db.compliance_deadlines.create_index([("deadline_type", 1)], background=True)
        await db.compliance_alerts.create_index([("acknowledged", 1), ("created_at", -1)], background=True)
        await db.compliance_alerts.create_index([("deadline_id", 1)], background=True)
        # Intake submission indexes
        await db.intake_submissions.create_index("submission_token", unique=True, background=True)
        await db.intake_submissions.create_index([("status", 1), ("submitted_at", -1)], background=True)
        await db.intake_submissions.create_index([("how_did_you_hear", 1)], background=True)
        logging.info("Database indexes ensured successfully")
    except Exception as e:
        logging.warning(f"Could not create database indexes: {e}")


# Create the main app with lifespan handler (replaces deprecated on_event)
app = FastAPI(title="Eden Claims Management API", lifespan=lifespan)

# Add Structured Logging Middleware
app.add_middleware(StructuredLoggingMiddleware)

# CORS — registered immediately after app creation, before route registration
cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
cors_origin_regex = os.environ.get("CORS_ALLOW_ORIGIN_REGEX", "").strip() or None

cors_options = {
    "allow_credentials": True,
    "allow_origins": cors_origins,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    "expose_headers": ["X-RateLimit-Remaining", "Retry-After"],
}
if cors_origin_regex:
    cors_options["allow_origin_regex"] = cors_origin_regex

app.add_middleware(CORSMiddleware, **cors_options)

# CSRF — reject state-changing requests without X-Requested-With header
# (registered after CORS so preflight OPTIONS pass through first)
app.add_middleware(CSRFProtectionMiddleware)


# ============================================
# SECURITY HEADERS MIDDLEWARE
# ============================================
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    if os.environ.get("ENVIRONMENT", "").lower() == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Startup logging
logger = logging.getLogger("eden.startup")

async def log_startup_config():
    """Log environment configuration at startup"""
    logger.info("="*70)
    logger.info("EDEN BACKEND STARTING")
    logger.info("="*70)
    logger.info(f"Environment: {os.environ.get('ENVIRONMENT', 'unknown')}")

    # Mask sensitive parts of MongoDB URL
    mongo_url = os.environ.get("MONGO_URL", "")
    masked_mongo = mongo_url[:50] + "..." if len(mongo_url) > 50 else mongo_url
    logger.info(f"Database: {masked_mongo}")
    logger.info(f"Database Name: {os.environ.get('DB_NAME', 'eden_claims')}")
    logger.info(f"JWT Algorithm: {os.environ.get('JWT_ALGORITHM', 'HS256')}")
    logger.info(f"CORS Origins: {os.environ.get('CORS_ORIGINS', 'not configured')}")
    logger.info(f"Frontend URL: {os.environ.get('FRONTEND_URL', 'not configured')}")
    logger.info(f"Base URL: {os.environ.get('BASE_URL', 'not configured')}")
    logger.info("-"*70)
    logger.info("INTEGRATION CONFIG:")
    logger.info(f"  GOOGLE_CLIENT_ID: {'SET' if os.environ.get('GOOGLE_CLIENT_ID') else 'MISSING'}")
    logger.info(f"  GOOGLE_CLIENT_SECRET: {'SET' if os.environ.get('GOOGLE_CLIENT_SECRET') else 'MISSING'}")
    logger.info(f"  SIGNNOW_CLIENT_ID: {'SET' if os.environ.get('SIGNNOW_CLIENT_ID') else 'MISSING'}")
    logger.info(f"  SIGNNOW_CLIENT_SECRET: {'SET' if os.environ.get('SIGNNOW_CLIENT_SECRET') else 'MISSING'}")
    logger.info(f"  GAMMA_API_KEY: {'SET' if os.environ.get('GAMMA_API_KEY') else 'MISSING'}")
    logger.info(f"  STRIPE_SECRET_KEY: {'SET' if os.environ.get('STRIPE_SECRET_KEY') else 'MISSING'}")
    logger.info(f"  OLLAMA_API_KEY: {'SET' if get_ollama_api_key() else 'MISSING'}")
    logger.info(f"  OLLAMA_BASE_URL: {os.environ.get('OLLAMA_BASE_URL', 'not set')}")
    logger.info(f"  OPENAI_API_KEY: {'SET' if os.environ.get('OPENAI_API_KEY') else 'MISSING'}")
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
    
    # Get client IP — only trust proxy headers behind known reverse proxies
    # In production (Render), the direct client is the Render proxy
    trusted_proxies = os.environ.get("TRUSTED_PROXIES", "").split(",")
    direct_ip = request.client.host if request.client else "unknown"

    if direct_ip in trusted_proxies or os.environ.get("BEHIND_PROXY", "").lower() == "true":
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not client_ip:
            client_ip = request.headers.get("x-real-ip", direct_ip)
    else:
        client_ip = direct_ip
    
    # Check rate limit (600 requests/minute with 60s block after exceeding)
    is_limited, remaining, reset_time = rate_limiter.is_rate_limited(
        key=client_ip,
        limit=600,
        window=60,
        block_duration=60
    )
    
    if is_limited:
        return JSONResponse(
            status_code=429,
            content={
                "error": "Too Many Requests",
                "message": "Rate limit exceeded. Please slow down.",
                "retry_after": int(reset_time - time.time()) if reset_time else 60
            },
            headers={"Retry-After": str(int(reset_time - time.time()) if reset_time else 60)}
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
            "database": "ok" if db_status == "connected" else "error",
            "storage": storage_status
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/ai/ping")
async def ai_ping():
    """Public endpoint — tests Ollama Cloud connectivity (no auth needed)."""
    import httpx
    from services.ollama_config import normalize_ollama_base_url, ollama_endpoint, get_ollama_model

    key = get_ollama_api_key()
    base = normalize_ollama_base_url(os.environ.get("OLLAMA_BASE_URL"))
    model = get_ollama_model()
    url = ollama_endpoint(base, "/api/chat")

    if not key:
        return {"status": "no_key", "detail": "AI provider not configured"}

    try:
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
        payload = {"model": model, "messages": [{"role": "user", "content": "Say OK"}], "stream": False}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            return {"status": "ok", "model": model}
        else:
            return {"status": "error", "http_code": resp.status_code}
    except Exception as e:
        logger.error(f"AI ping failed: {e}")
        return {"status": "error", "detail": "AI service unreachable"}


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
app.include_router(workbooks_router)
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
app.include_router(evidence_router)
app.include_router(ops_manifest_router)

# Include integrations routers
app.include_router(integrations_router)
app.include_router(integrations_services_router)
app.include_router(google_router)
app.include_router(signnow_router)
app.include_router(imagery_router)
app.include_router(tasks_router)
app.include_router(garden_dashboard_router)
app.include_router(email_intelligence_router)
app.include_router(claimpilot_router)
app.include_router(photo_analysis_router)
app.include_router(calendar_router)
app.include_router(commissions_router)
app.include_router(compliance_router)
app.include_router(intake_router)
app.include_router(email_log_router)
app.include_router(gmail_sync_router)
app.include_router(pdf_extract_router)


async def ensure_workbooks_exist():
    """Ensure workbooks collection has data — seed if empty"""
    try:
        count = await db.workbooks.count_documents({})
        if count == 0:
            logging.info("No workbooks found — seeding sample workbooks...")
            from routes.workbooks import seed_workbooks
            await seed_workbooks()
            count = await db.workbooks.count_documents({})
            logging.info(f"Workbooks seeded: {count} workbooks created")
        else:
            logging.info(f"Workbooks OK: {count} workbooks in database")
    except Exception as e:
        logging.error(f"Failed to ensure workbooks: {e}")


async def initialize_harvest_gamification():
    """Initialize Harvest v2 gamification - seed badges and Daily Blitz"""
    try:
        from routes.harvest_scoring_engine import init_scoring_engine, initialize_harvest_gamification as init_gamification
        init_scoring_engine(db)
        await init_gamification()
        logging.info("Harvest gamification initialized: badges seeded, Daily Blitz created")
    except Exception as e:
        logging.error(f"Failed to initialize Harvest gamification: {e}")


async def initialize_claimpilot():
    """Initialize ClaimPilot AI agent orchestrator (non-critical)."""
    try:
        from services.claimpilot.orchestrator import init_orchestrator
        init_orchestrator(db)
        logging.info("ClaimPilot AI agents initialized")
    except Exception as e:
        logging.warning("ClaimPilot initialization failed (non-critical): %s", e)


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

        admin_email = os.environ.get("ADMIN_EMAIL", "admin@eden.com")
        admin_name = os.environ.get("ADJUSTER_NAME", "System Admin")
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "full_name": admin_name,
            "role": "admin",
            "password": get_password_hash(admin_password),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logging.info(
            "Created admin user %s using ADMIN_INITIAL_PASSWORD bootstrap", admin_email
        )

    # Also ensure existing admin can log in with current password if ADMIN_INITIAL_PASSWORD is set
    admin_email_env = os.environ.get("ADMIN_EMAIL", "").strip()
    admin_password_env = os.environ.get("ADMIN_INITIAL_PASSWORD", "").strip()
    if admin_email_env and admin_password_env:
        existing = await db.users.find_one({"email": admin_email_env})
        if existing:
            await db.users.update_one(
                {"email": admin_email_env},
                {"$set": {"password": get_password_hash(admin_password_env), "role": "admin"}}
            )
            logging.info("Updated password for admin user %s", admin_email_env)

# WebSocket endpoint for real-time notifications
@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = None):
    """WebSocket endpoint for real-time notifications.

    Auth flow (in priority order):
    1. Query-param token  — ``/ws/notifications?token=<jwt>``
    2. Message-based auth — first message ``{"type":"auth","token":"<jwt>"}``
    The frontend uses method 2 (avoids leaking tokens in access logs).
    """
    import json as _json

    user_id = None
    try:
        # --- Method 1: query-param token (legacy / direct clients) ---
        if token:
            payload = decode_access_token(token)
            if not payload or not payload.get("sub"):
                await websocket.close(code=4001, reason="Invalid token")
                return
            user_id = payload["sub"]
            await manager.connect(websocket, user_id)
        else:
            # --- Method 2: message-based auth (frontend) ---
            # Accept first so the client can send the auth message.
            await websocket.accept()
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            except (asyncio.TimeoutError, WebSocketDisconnect):
                try:
                    await websocket.close(code=4001, reason="Auth timeout")
                except Exception:
                    pass
                return

            try:
                auth_msg = _json.loads(raw)
            except (ValueError, TypeError):
                try:
                    await websocket.close(code=4001, reason="Invalid auth message")
                except Exception:
                    pass
                return

            auth_token = auth_msg.get("token") if isinstance(auth_msg, dict) else None
            if not auth_token:
                try:
                    await websocket.close(code=4001, reason="Missing token")
                except Exception:
                    pass
                return

            payload = decode_access_token(auth_token)
            if not payload or not payload.get("sub"):
                try:
                    await websocket.close(code=4001, reason="Invalid token")
                except Exception:
                    pass
                return

            user_id = payload["sub"]
            # Register via manager (enforces per-user connection cap)
            await manager.register_accepted(websocket, user_id)

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

logger = logging.getLogger(__name__)



