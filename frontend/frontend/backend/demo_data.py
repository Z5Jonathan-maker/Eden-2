"""
Eden Demo Data Seeder

Seeds sample data for demo/staging environments:
- Sample claims
- Sample contracts
- Sample Harvest pins
- Sample Eve conversations
"""

from datetime import datetime, timedelta, timezone
import uuid
import random

# Sample client names
SAMPLE_CLIENTS = [
    {"name": "John Smith", "email": "john.smith@example.com", "phone": "555-0101"},
    {"name": "Maria Garcia", "email": "maria.garcia@example.com", "phone": "555-0102"},
    {"name": "Robert Johnson", "email": "robert.j@example.com", "phone": "555-0103"},
    {"name": "Sarah Williams", "email": "sarah.w@example.com", "phone": "555-0104"},
    {"name": "Michael Brown", "email": "michael.b@example.com", "phone": "555-0105"},
]

SAMPLE_ADDRESSES = [
    "123 Palm Beach Blvd, Miami, FL 33139",
    "456 Ocean Drive, Fort Lauderdale, FL 33301",
    "789 Sunset Lane, Tampa, FL 33602",
    "321 Bayshore Dr, Sarasota, FL 34236",
    "654 Gulf View Rd, Naples, FL 34102",
]

INSURANCE_COMPANIES = [
    "Citizens Property Insurance",
    "State Farm",
    "Universal Property",
    "Heritage Insurance",
    "Florida Peninsula"
]

CLAIM_TYPES = ["residential", "commercial"]
LOSS_TYPES = ["wind", "water", "fire", "hail"]
STATUSES = ["new", "in_review", "submitted", "negotiating", "settled"]


def generate_claim_number():
    """Generate a realistic claim number"""
    year = datetime.now().year
    rand = random.randint(10000, 99999)
    return f"CLM-{year}-{rand}"


def generate_demo_claims(count: int = 10) -> list:
    """Generate sample claims"""
    claims = []
    
    for i in range(count):
        client = random.choice(SAMPLE_CLIENTS)
        days_ago = random.randint(0, 90)
        loss_date = datetime.now(timezone.utc) - timedelta(days=days_ago + random.randint(5, 30))
        created_date = datetime.now(timezone.utc) - timedelta(days=days_ago)
        
        claim = {
            "id": str(uuid.uuid4()),
            "claim_number": generate_claim_number(),
            "client_name": client["name"],
            "client_email": client["email"],
            "client_phone": client["phone"],
            "property_address": random.choice(SAMPLE_ADDRESSES),
            "date_of_loss": loss_date.strftime("%Y-%m-%d"),
            "loss_type": random.choice(LOSS_TYPES),
            "claim_type": random.choice(CLAIM_TYPES),
            "status": random.choice(STATUSES),
            "insurance_company": random.choice(INSURANCE_COMPANIES),
            "policy_number": f"POL-{random.randint(100000, 999999)}",
            "estimated_value": random.randint(10000, 150000),
            "assigned_to": "Demo Adjuster",
            "created_at": created_date.isoformat(),
            "created_by": "demo-system",
            "is_demo": True
        }
        claims.append(claim)
    
    return claims


def generate_demo_pins(count: int = 20) -> list:
    """Generate sample canvassing pins"""
    pins = []
    
    # Miami area coordinates
    base_lat = 25.7617
    base_lng = -80.1918
    
    dispositions = ["unmarked", "NH", "NI", "CB", "AP", "SG"]
    disposition_weights = [0.1, 0.3, 0.25, 0.15, 0.15, 0.05]
    
    for i in range(count):
        # Random offset within ~5km
        lat_offset = random.uniform(-0.05, 0.05)
        lng_offset = random.uniform(-0.05, 0.05)
        
        disposition = random.choices(dispositions, disposition_weights)[0]
        
        pin = {
            "id": str(uuid.uuid4()),
            "latitude": base_lat + lat_offset,
            "longitude": base_lng + lng_offset,
            "address": f"{random.randint(100, 9999)} Demo St, Miami, FL",
            "disposition": disposition,
            "homeowner_name": f"Demo Owner {i+1}" if disposition in ["CB", "AP", "SG"] else None,
            "phone": f"555-{random.randint(1000, 9999)}" if disposition in ["CB", "AP", "SG"] else None,
            "notes": "Demo pin for testing" if random.random() > 0.7 else None,
            "user_id": "demo-user",
            "created_by_name": "Demo Rep",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))).isoformat(),
            "is_demo": True
        }
        pins.append(pin)
    
    return pins


def generate_demo_inspection_sessions(claims: list, count: int = 5) -> list:
    """Generate sample inspection sessions"""
    sessions = []
    
    for claim in claims[:count]:
        session = {
            "id": str(uuid.uuid4()),
            "claim_id": claim["id"],
            "name": f"Inspection - {claim['client_name']}",
            "status": random.choice(["completed", "in_progress"]),
            "photo_count": random.randint(5, 25),
            "rooms_documented": ["exterior_front", "roof", "living_room"],
            "created_by": "demo-adjuster@eden.com",
            "created_at": claim["created_at"],
            "is_demo": True
        }
        sessions.append(session)
    
    return sessions


async def seed_demo_data(db):
    """Seed all demo data into database"""
    from core import get_logger
    logger = get_logger(__name__)
    
    try:
        # Check if demo data already exists
        existing_demo = await db.claims.count_documents({"is_demo": True})
        if existing_demo > 0:
            logger.info(f"Demo data already exists ({existing_demo} demo claims)")
            return {"status": "skipped", "message": "Demo data already seeded"}
        
        # Generate data
        claims = generate_demo_claims(10)
        pins = generate_demo_pins(20)
        sessions = generate_demo_inspection_sessions(claims)
        
        # Insert claims
        if claims:
            await db.claims.insert_many(claims)
            logger.info(f"Seeded {len(claims)} demo claims")
        
        # Insert pins
        if pins:
            await db.canvassing_pins.insert_many(pins)
            logger.info(f"Seeded {len(pins)} demo canvassing pins")
        
        # Insert sessions
        if sessions:
            await db.inspection_sessions.insert_many(sessions)
            logger.info(f"Seeded {len(sessions)} demo inspection sessions")
        
        return {
            "status": "success",
            "data": {
                "claims": len(claims),
                "pins": len(pins),
                "sessions": len(sessions)
            }
        }
    
    except Exception as e:
        logger.error(f"Demo data seeding failed: {e}")
        return {"status": "error", "message": str(e)}


async def clear_demo_data(db):
    """Remove all demo data from database"""
    from core import get_logger
    logger = get_logger(__name__)
    
    try:
        # Delete demo data
        claims_result = await db.claims.delete_many({"is_demo": True})
        pins_result = await db.canvassing_pins.delete_many({"is_demo": True})
        sessions_result = await db.inspection_sessions.delete_many({"is_demo": True})
        
        logger.info(f"Cleared demo data: {claims_result.deleted_count} claims, {pins_result.deleted_count} pins, {sessions_result.deleted_count} sessions")
        
        return {
            "status": "success",
            "deleted": {
                "claims": claims_result.deleted_count,
                "pins": pins_result.deleted_count,
                "sessions": sessions_result.deleted_count
            }
        }
    
    except Exception as e:
        logger.error(f"Demo data clearing failed: {e}")
        return {"status": "error", "message": str(e)}


# Export
__all__ = [
    'generate_demo_claims',
    'generate_demo_pins',
    'generate_demo_inspection_sessions',
    'seed_demo_data',
    'clear_demo_data'
]
