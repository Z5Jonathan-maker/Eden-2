"""
Mock Eden Backend Server - For Frontend Testing
Provides basic auth and API endpoints without complex dependencies
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
from datetime import datetime, timedelta
import jwt

app = FastAPI(title="Eden Mock Backend", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Configuration
JWT_SECRET = "your_jwt_secret_key_here"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

# Mock database
USERS = {
    "test@eden.com": {
        "id": "user_123",
        "email": "test@eden.com",
        "password": "password",  # In real app, this would be hashed
        "full_name": "Test User",
        "role": "adjuster"
    }
}

CLAIMS = [
    {
        "id": "claim_1",
        "claim_number": "CLM-2026-001",
        "status": "Open",
        "property_address": "123 Main St, Miami, FL",
        "claim_date": "2026-01-15",
        "loss_type": "Water Damage",
        "estimated_value": 50000,
        "assigned_adjuster": "Test User"
    },
    {
        "id": "claim_2",
        "claim_number": "CLM-2026-002",
        "status": "Under Review",
        "property_address": "456 Oak Ave, Tampa, FL",
        "claim_date": "2026-01-20",
        "loss_type": "Wind Damage",
        "estimated_value": 75000,
        "assigned_adjuster": "Test User"
    }
]

# Models
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class User(BaseModel):
    id: str
    email: str
    full_name: str
    role: str

class Claim(BaseModel):
    id: str
    claim_number: str
    status: str
    property_address: str
    claim_date: str
    loss_type: str
    estimated_value: float
    assigned_adjuster: str

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        if email and email in USERS:
            return USERS[email]
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    raise HTTPException(status_code=401, detail="Invalid token")

# Routes
@app.on_event("startup")
async def startup():
    print("✓ Mock Eden Backend Started")
    print("✓ Available at http://localhost:8000")

@app.get("/")
async def root():
    return {
        "message": "Mock Eden Backend API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = USERS.get(request.email)
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": user["email"]})
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    )

@app.post("/api/auth/register", response_model=LoginResponse)
async def register(request: LoginRequest):
    if request.email in USERS:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = {
        "id": f"user_{len(USERS) + 1}",
        "email": request.email,
        "password": request.password,
        "full_name": request.email.split("@")[0],
        "role": "adjuster"
    }
    USERS[request.email] = new_user
    
    access_token = create_access_token({"sub": new_user["email"]})
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": new_user["id"],
            "email": new_user["email"],
            "full_name": new_user["full_name"],
            "role": new_user["role"]
        }
    )

@app.get("/api/claims/")
async def get_claims(token: str = Depends(lambda: None)):
    return {"claims": CLAIMS}

@app.get("/api/claims/{claim_id}")
async def get_claim(claim_id: str):
    for claim in CLAIMS:
        if claim["id"] == claim_id:
            return claim
    raise HTTPException(status_code=404, detail="Claim not found")

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    return {
        "totalClaims": len(CLAIMS),
        "activeClaims": sum(1 for c in CLAIMS if c["status"] != "Completed"),
        "completedThisMonth": 2,
        "pendingInspections": sum(1 for c in CLAIMS if c["status"] == "Under Review"),
        "totalValue": sum(c["estimated_value"] for c in CLAIMS),
        "avgProcessingTime": "12 days",
        "recentClaims": CLAIMS[:2]
    }

@app.get("/api/notifications")
async def get_notifications():
    return {
        "notifications": [
            {
                "id": "notif_1",
                "title": "New Claim Assigned",
                "message": "Claim CLM-2026-001 assigned to you",
                "type": "assignment",
                "timestamp": datetime.utcnow().isoformat(),
                "read": False
            }
        ]
    }

@app.get("/api/notifications/unread-count")
async def get_unread_count():
    return {"unread_count": 1, "count": 1}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
