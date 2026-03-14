from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user, require_permission
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/supplements", tags=["supplements"])

class SupplementLineItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    category: str  # roofing, siding, drywall, etc.
    quantity: float
    unit: str  # SF, LF, EA, etc.
    unit_price: float
    total: float
    carrier_approved: float = 0
    variance: float = 0
    notes: Optional[str] = None

class SupplementCreate(BaseModel):
    claim_id: str
    claim_number: str
    title: str
    description: Optional[str] = None
    line_items: List[SupplementLineItem] = []

class SupplementUpdate(BaseModel):
    status: Optional[str] = None
    carrier_response: Optional[str] = None
    carrier_approved_amount: Optional[float] = None
    carrier_response_date: Optional[str] = None
    notes: Optional[str] = None

class Supplement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: str
    claim_number: str
    supplement_number: int = 1
    title: str
    description: Optional[str] = None
    status: str = "draft"  # draft, submitted, under_review, partial_approved, approved, denied, disputed
    line_items: List[SupplementLineItem] = []
    
    # Amounts
    total_requested: float = 0
    carrier_approved_amount: float = 0
    variance: float = 0
    
    # Timeline
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    submitted_at: Optional[datetime] = None
    carrier_response_date: Optional[datetime] = None
    
    # Carrier response
    carrier_response: Optional[str] = None
    
    # Tracking
    created_by: str
    notes: Optional[str] = None

# Routes

@router.get("/claim/{claim_id}")
async def get_claim_supplements(claim_id: str, current_user: dict = Depends(get_current_active_user)):
    """Get all supplements for a claim"""
    supplements = await db.supplements.find(
        {"claim_id": claim_id},
        {"_id": 0}
    ).sort("supplement_number", 1).to_list(100)
    
    # Calculate totals
    totals = {
        "total_requested": sum(s.get("total_requested", 0) for s in supplements),
        "total_approved": sum(s.get("carrier_approved_amount", 0) for s in supplements),
        "total_outstanding": 0,
        "supplement_count": len(supplements),
        "pending_count": len([s for s in supplements if s.get("status") in ["submitted", "under_review"]]),
        "approved_count": len([s for s in supplements if s.get("status") in ["approved", "partial_approved"]])
    }
    totals["total_outstanding"] = totals["total_requested"] - totals["total_approved"]
    
    return {"supplements": supplements, "totals": totals}

@router.get("/{supplement_id}")
async def get_supplement(supplement_id: str, current_user: dict = Depends(get_current_active_user)):
    """Get a specific supplement"""
    supplement = await db.supplements.find_one({"id": supplement_id}, {"_id": 0})
    if not supplement:
        raise HTTPException(status_code=404, detail="Supplement not found")
    return supplement

@router.post("/")
async def create_supplement(data: SupplementCreate, current_user: dict = Depends(get_current_active_user)):
    """Create a new supplement"""
    # Get next supplement number for this claim
    existing = await db.supplements.count_documents({"claim_id": data.claim_id})
    supplement_number = existing + 1
    
    # Calculate totals
    total_requested = sum(item.total for item in data.line_items)
    
    supplement = Supplement(
        claim_id=data.claim_id,
        claim_number=data.claim_number,
        supplement_number=supplement_number,
        title=data.title,
        description=data.description,
        line_items=[item.dict() for item in data.line_items],
        total_requested=total_requested,
        created_by=current_user.get("id")
    )
    
    await db.supplements.insert_one(supplement.dict())
    
    result = supplement.dict()
    result.pop("_id", None)
    return result

@router.put("/{supplement_id}")
async def update_supplement(supplement_id: str, data: SupplementUpdate, current_user: dict = Depends(get_current_active_user)):
    """Update a supplement"""
    supplement = await db.supplements.find_one({"id": supplement_id})
    if not supplement:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    update_data = {}
    
    if data.status:
        update_data["status"] = data.status
        if data.status == "submitted" and not supplement.get("submitted_at"):
            update_data["submitted_at"] = datetime.now(timezone.utc).isoformat()
    
    if data.carrier_response:
        update_data["carrier_response"] = data.carrier_response
    
    if data.carrier_approved_amount is not None:
        update_data["carrier_approved_amount"] = data.carrier_approved_amount
        update_data["variance"] = supplement.get("total_requested", 0) - data.carrier_approved_amount
    
    if data.carrier_response_date:
        update_data["carrier_response_date"] = data.carrier_response_date
    
    if data.notes:
        update_data["notes"] = data.notes
    
    if update_data:
        await db.supplements.update_one({"id": supplement_id}, {"$set": update_data})
    
    updated = await db.supplements.find_one({"id": supplement_id}, {"_id": 0})
    return updated

@router.put("/{supplement_id}/line-items")
async def update_line_items(supplement_id: str, line_items: List[SupplementLineItem], current_user: dict = Depends(get_current_active_user)):
    """Update supplement line items"""
    supplement = await db.supplements.find_one({"id": supplement_id})
    if not supplement:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    items_dict = [item.dict() for item in line_items]
    total_requested = sum(item.total for item in line_items)
    carrier_approved = sum(item.carrier_approved for item in line_items)
    
    await db.supplements.update_one(
        {"id": supplement_id},
        {"$set": {
            "line_items": items_dict,
            "total_requested": total_requested,
            "carrier_approved_amount": carrier_approved,
            "variance": total_requested - carrier_approved
        }}
    )
    
    updated = await db.supplements.find_one({"id": supplement_id}, {"_id": 0})
    return updated

@router.post("/{supplement_id}/submit")
async def submit_supplement(supplement_id: str, current_user: dict = Depends(get_current_active_user)):
    """Submit a supplement to carrier"""
    supplement = await db.supplements.find_one({"id": supplement_id})
    if not supplement:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    if supplement.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Supplement already submitted")
    
    await db.supplements.update_one(
        {"id": supplement_id},
        {"$set": {
            "status": "submitted",
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Supplement submitted", "status": "submitted"}

@router.delete("/{supplement_id}")
async def delete_supplement(supplement_id: str, current_user: dict = Depends(get_current_active_user)):
    """Delete a supplement (draft only)"""
    supplement = await db.supplements.find_one({"id": supplement_id})
    if not supplement:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    if supplement.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Can only delete draft supplements")
    
    await db.supplements.delete_one({"id": supplement_id})
    return {"message": "Supplement deleted"}

@router.get("/stats/overview")
async def get_supplements_overview(current_user: dict = Depends(get_current_active_user)):
    """Get overall supplement statistics"""
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_requested": {"$sum": "$total_requested"},
            "total_approved": {"$sum": "$carrier_approved_amount"}
        }}
    ]
    
    results = await db.supplements.aggregate(pipeline).to_list(20)
    
    stats = {
        "by_status": {r["_id"]: {"count": r["count"], "requested": r["total_requested"], "approved": r["total_approved"]} for r in results},
        "total_supplements": sum(r["count"] for r in results),
        "total_requested": sum(r["total_requested"] for r in results),
        "total_approved": sum(r["total_approved"] for r in results),
        "total_outstanding": 0,
        "recovery_rate": 0
    }
    stats["total_outstanding"] = stats["total_requested"] - stats["total_approved"]
    if stats["total_requested"] > 0:
        stats["recovery_rate"] = round((stats["total_approved"] / stats["total_requested"]) * 100, 1)
    
    return stats

# Common line item categories for Florida PA
COMMON_CATEGORIES = [
    {"id": "roofing", "name": "Roofing", "common_items": ["Shingles", "Underlayment", "Decking", "Flashing", "Ridge Cap", "Starter Strip", "Ice & Water Shield"]},
    {"id": "siding", "name": "Siding", "common_items": ["Vinyl Siding", "Soffit", "Fascia", "House Wrap", "J-Channel"]},
    {"id": "gutters", "name": "Gutters", "common_items": ["Seamless Gutters", "Downspouts", "Gutter Guards", "Splash Blocks"]},
    {"id": "drywall", "name": "Drywall", "common_items": ["Drywall Sheets", "Texture Match", "Tape & Float", "Prime & Paint"]},
    {"id": "flooring", "name": "Flooring", "common_items": ["Carpet", "Vinyl Plank", "Tile", "Underlayment", "Baseboards"]},
    {"id": "painting", "name": "Painting", "common_items": ["Interior Paint", "Exterior Paint", "Prime", "Texture"]},
    {"id": "windows", "name": "Windows/Doors", "common_items": ["Window Replacement", "Door Replacement", "Screens", "Hardware"]},
    {"id": "electrical", "name": "Electrical", "common_items": ["Fixtures", "Wiring", "Panel Work", "Outlets"]},
    {"id": "plumbing", "name": "Plumbing", "common_items": ["Fixtures", "Piping", "Water Heater", "Valves"]},
    {"id": "hvac", "name": "HVAC", "common_items": ["AC Unit", "Ductwork", "Thermostat", "Air Handler"]},
    {"id": "demolition", "name": "Demolition", "common_items": ["Tear-off", "Debris Removal", "Dumpster", "Haul-off"]},
    {"id": "general", "name": "General Conditions", "common_items": ["Permits", "Supervision", "Equipment", "Temporary Protection"]},
    {"id": "op", "name": "Overhead & Profit", "common_items": ["Overhead (10%)", "Profit (10%)"]}
]

@router.get("/categories")
async def get_line_item_categories():
    """Get common line item categories for supplements"""
    return COMMON_CATEGORIES
