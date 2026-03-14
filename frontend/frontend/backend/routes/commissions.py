"""
Commission & Fee Tracking API — PA fee structures, claim commissions,
adjuster splits, referral fees, and revenue reporting.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/commissions", tags=["Commissions"])
logger = logging.getLogger(__name__)

ADMIN_ROLES = {"admin", "manager"}
WRITE_ROLES = {"admin", "manager", "adjuster"}

VALID_PAYMENT_STATUSES = {"pending", "invoiced", "partial", "received", "paid_out"}


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class AdjusterSplitIn(BaseModel):
    adjuster_name: str
    adjuster_id: Optional[str] = None
    split_percentage: float = Field(..., ge=0, le=100)


class ExpenseIn(BaseModel):
    description: str
    amount: float = Field(..., ge=0)
    date: Optional[str] = None


class FeeStructureCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    fee_percentage: float = Field(..., gt=0, le=100)
    referral_fee_percentage: float = Field(default=0.0, ge=0, le=100)
    is_default: bool = False
    effective_date: Optional[str] = None


class FeeStructureUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    fee_percentage: Optional[float] = Field(default=None, gt=0, le=100)
    referral_fee_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    is_default: Optional[bool] = None
    effective_date: Optional[str] = None


class CommissionCreate(BaseModel):
    claim_number: Optional[str] = None
    settlement_amount: float = Field(..., ge=0)
    fee_structure_id: Optional[str] = None
    fee_percentage: Optional[float] = Field(default=None, gt=0, le=100)
    referral_source: Optional[str] = None
    referral_fee_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    referral_fee_flat: Optional[float] = Field(default=None, ge=0)
    adjuster_splits: Optional[List[AdjusterSplitIn]] = None
    expenses: Optional[List[ExpenseIn]] = None
    payment_status: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    payment_received_date: Optional[str] = None
    notes: Optional[str] = None


class CommissionUpdate(BaseModel):
    settlement_amount: Optional[float] = Field(default=None, ge=0)
    fee_structure_id: Optional[str] = None
    fee_percentage: Optional[float] = Field(default=None, gt=0, le=100)
    referral_source: Optional[str] = None
    referral_fee_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    referral_fee_flat: Optional[float] = Field(default=None, ge=0)
    adjuster_splits: Optional[List[AdjusterSplitIn]] = None
    expenses: Optional[List[ExpenseIn]] = None
    payment_status: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    payment_received_date: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_write_role(user: dict):
    if user.get("role", "client") not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions for commission operations")


def _require_admin_role(user: dict):
    if user.get("role", "client") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin or manager role required")


def _calculate_financials(
    settlement_amount: float,
    fee_percentage: float,
    referral_fee_percentage: float,
    referral_fee_flat: Optional[float],
    adjuster_splits: Optional[list],
    expenses: Optional[list],
) -> dict:
    """Compute gross_fee, referral_fee_amount, split amounts, and net_revenue."""
    gross_fee = round(settlement_amount * fee_percentage / 100, 2)

    # Referral: flat fee takes precedence; otherwise percentage of gross_fee
    if referral_fee_flat is not None and referral_fee_flat > 0:
        referral_fee_amount = round(referral_fee_flat, 2)
    else:
        referral_fee_amount = round(gross_fee * referral_fee_percentage / 100, 2)

    # Adjuster splits
    computed_splits = []
    if adjuster_splits:
        for split in adjuster_splits:
            pct = split.get("split_percentage", 0)
            amount = round(gross_fee * pct / 100, 2)
            computed_splits.append({
                "adjuster_name": split.get("adjuster_name", ""),
                "adjuster_id": split.get("adjuster_id"),
                "split_percentage": pct,
                "split_amount": amount,
            })

    # Total expenses
    total_expenses = 0.0
    if expenses:
        total_expenses = round(sum(e.get("amount", 0) for e in expenses), 2)

    net_revenue = round(gross_fee - referral_fee_amount - total_expenses, 2)

    return {
        "gross_fee": gross_fee,
        "referral_fee_amount": referral_fee_amount,
        "adjuster_splits": computed_splits,
        "total_expenses": total_expenses,
        "net_revenue": net_revenue,
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Fee Structure Endpoints
# ---------------------------------------------------------------------------

@router.post("/fee-structures", status_code=201)
async def create_fee_structure(
    body: FeeStructureCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Create a new company-wide fee structure."""
    _require_admin_role(current_user)

    now = _now_iso()

    # If marking as default, unset any existing default
    if body.is_default:
        await db.fee_structures.update_many(
            {"is_default": True},
            {"$set": {"is_default": False, "updated_at": now}},
        )

    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "fee_percentage": body.fee_percentage,
        "referral_fee_percentage": body.referral_fee_percentage,
        "is_default": body.is_default,
        "effective_date": body.effective_date or now,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now,
    }
    await db.fee_structures.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "data": doc}


@router.get("/fee-structures")
async def list_fee_structures(
    current_user: dict = Depends(get_current_active_user),
):
    """List all fee structures."""
    _require_write_role(current_user)
    structures = await db.fee_structures.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"success": True, "data": structures, "count": len(structures)}


@router.patch("/fee-structures/{structure_id}")
async def update_fee_structure(
    structure_id: str,
    body: FeeStructureUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update an existing fee structure."""
    _require_admin_role(current_user)

    existing = await db.fee_structures.find_one({"id": structure_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Fee structure not found")

    now = _now_iso()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If setting as default, unset others first
    if updates.get("is_default"):
        await db.fee_structures.update_many(
            {"is_default": True, "id": {"$ne": structure_id}},
            {"$set": {"is_default": False, "updated_at": now}},
        )

    updates["updated_at"] = now
    await db.fee_structures.update_one({"id": structure_id}, {"$set": updates})

    updated = await db.fee_structures.find_one({"id": structure_id}, {"_id": 0})
    return {"success": True, "data": updated}


# ---------------------------------------------------------------------------
# Claim Commission Endpoints
# ---------------------------------------------------------------------------

@router.post("/claims/{claim_id}", status_code=201)
async def create_claim_commission(
    claim_id: str,
    body: CommissionCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Create/calculate commission record for a claim."""
    _require_write_role(current_user)

    # Verify claim exists
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0, "id": 1, "claim_number": 1})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Check for duplicate commission
    existing = await db.commissions.find_one({"claim_id": claim_id}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Commission already exists for this claim (id: {existing['id']}). Use PATCH to update.",
        )

    # Resolve fee percentage: explicit > fee_structure > default structure
    fee_pct = body.fee_percentage
    referral_pct = body.referral_fee_percentage or 0.0
    fee_structure_id = body.fee_structure_id

    if fee_pct is None and fee_structure_id:
        structure = await db.fee_structures.find_one({"id": fee_structure_id}, {"_id": 0})
        if not structure:
            raise HTTPException(status_code=404, detail="Fee structure not found")
        fee_pct = structure.get("fee_percentage", 10.0)
        if body.referral_fee_percentage is None:
            referral_pct = structure.get("referral_fee_percentage", 0.0)

    if fee_pct is None:
        # Fall back to default fee structure
        default_structure = await db.fee_structures.find_one({"is_default": True}, {"_id": 0})
        if default_structure:
            fee_pct = default_structure.get("fee_percentage", 10.0)
            fee_structure_id = default_structure.get("id")
            if body.referral_fee_percentage is None:
                referral_pct = default_structure.get("referral_fee_percentage", 0.0)
        else:
            raise HTTPException(
                status_code=400,
                detail="No fee_percentage provided and no default fee structure configured.",
            )

    # Validate payment status
    payment_status = body.payment_status or "pending"
    if payment_status not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid payment_status. Must be one of: {', '.join(sorted(VALID_PAYMENT_STATUSES))}")

    # Prepare splits and expenses as dicts
    splits_raw = [s.model_dump() for s in body.adjuster_splits] if body.adjuster_splits else []
    expenses_raw = [e.model_dump() for e in body.expenses] if body.expenses else []

    financials = _calculate_financials(
        settlement_amount=body.settlement_amount,
        fee_percentage=fee_pct,
        referral_fee_percentage=referral_pct,
        referral_fee_flat=body.referral_fee_flat,
        adjuster_splits=splits_raw,
        expenses=expenses_raw,
    )

    now = _now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "claim_id": claim_id,
        "claim_number": body.claim_number or claim.get("claim_number", ""),
        "settlement_amount": body.settlement_amount,
        "fee_structure_id": fee_structure_id,
        "fee_percentage": fee_pct,
        "gross_fee": financials["gross_fee"],
        "referral_source": body.referral_source,
        "referral_fee_percentage": referral_pct,
        "referral_fee_flat": body.referral_fee_flat,
        "referral_fee_amount": financials["referral_fee_amount"],
        "adjuster_splits": financials["adjuster_splits"],
        "expenses": expenses_raw,
        "total_expenses": financials["total_expenses"],
        "net_revenue": financials["net_revenue"],
        "payment_status": payment_status,
        "invoice_number": body.invoice_number,
        "invoice_date": body.invoice_date,
        "payment_received_date": body.payment_received_date,
        "notes": body.notes,
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now,
    }
    await db.commissions.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "data": doc}


@router.get("/claims/{claim_id}")
async def get_claim_commission(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get commission details for a specific claim."""
    _require_write_role(current_user)

    commission = await db.commissions.find_one({"claim_id": claim_id}, {"_id": 0})
    if not commission:
        raise HTTPException(status_code=404, detail="No commission record found for this claim")
    return {"success": True, "data": commission}


@router.patch("/claims/{claim_id}")
async def update_claim_commission(
    claim_id: str,
    body: CommissionUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update commission record — recalculates financials automatically."""
    _require_write_role(current_user)

    existing = await db.commissions.find_one({"claim_id": claim_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="No commission record found for this claim")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate payment_status if provided
    if "payment_status" in updates and updates["payment_status"] not in VALID_PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid payment_status. Must be one of: {', '.join(sorted(VALID_PAYMENT_STATUSES))}")

    # Merge with existing for recalculation
    settlement = updates.get("settlement_amount", existing.get("settlement_amount", 0))
    fee_pct = updates.get("fee_percentage", existing.get("fee_percentage", 10.0))
    referral_pct = updates.get("referral_fee_percentage", existing.get("referral_fee_percentage", 0.0))
    referral_flat = updates.get("referral_fee_flat", existing.get("referral_fee_flat"))

    splits_raw = (
        [s.model_dump() for s in updates["adjuster_splits"]]
        if "adjuster_splits" in updates and updates["adjuster_splits"] is not None
        else existing.get("adjuster_splits", [])
    )
    expenses_raw = (
        [e.model_dump() for e in updates["expenses"]]
        if "expenses" in updates and updates["expenses"] is not None
        else existing.get("expenses", [])
    )

    financials = _calculate_financials(
        settlement_amount=settlement,
        fee_percentage=fee_pct,
        referral_fee_percentage=referral_pct,
        referral_fee_flat=referral_flat,
        adjuster_splits=splits_raw,
        expenses=expenses_raw,
    )

    now = _now_iso()
    set_fields = {
        **{k: v for k, v in updates.items() if k not in ("adjuster_splits", "expenses")},
        "settlement_amount": settlement,
        "fee_percentage": fee_pct,
        "referral_fee_percentage": referral_pct,
        "referral_fee_flat": referral_flat,
        "gross_fee": financials["gross_fee"],
        "referral_fee_amount": financials["referral_fee_amount"],
        "adjuster_splits": financials["adjuster_splits"],
        "expenses": expenses_raw,
        "total_expenses": financials["total_expenses"],
        "net_revenue": financials["net_revenue"],
        "updated_at": now,
    }

    await db.commissions.update_one({"claim_id": claim_id}, {"$set": set_fields})
    updated = await db.commissions.find_one({"claim_id": claim_id}, {"_id": 0})
    return {"success": True, "data": updated}


@router.delete("/claims/{claim_id}")
async def delete_claim_commission(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete a commission record for a claim."""
    _require_admin_role(current_user)

    result = await db.commissions.delete_one({"claim_id": claim_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No commission record found for this claim")
    return {"success": True, "message": "Commission record deleted"}


# ---------------------------------------------------------------------------
# Reporting Endpoints
# ---------------------------------------------------------------------------

def _parse_date_range(start_date: Optional[str], end_date: Optional[str]) -> dict:
    """Build a MongoDB date-range filter on created_at."""
    date_filter: dict = {}
    if start_date:
        date_filter["$gte"] = start_date
    if end_date:
        date_filter["$lte"] = end_date
    if date_filter:
        return {"created_at": date_filter}
    return {}


@router.get("/summary")
async def revenue_summary(
    start_date: Optional[str] = Query(None, description="ISO date string lower bound"),
    end_date: Optional[str] = Query(None, description="ISO date string upper bound"),
    current_user: dict = Depends(get_current_active_user),
):
    """Total revenue summary with optional date range filter."""
    _require_admin_role(current_user)

    match_filter = _parse_date_range(start_date, end_date)

    pipeline = [
        {"$match": match_filter} if match_filter else {"$match": {}},
        {
            "$group": {
                "_id": None,
                "total_settlements": {"$sum": "$settlement_amount"},
                "total_gross_fees": {"$sum": "$gross_fee"},
                "total_referral_fees": {"$sum": "$referral_fee_amount"},
                "total_expenses": {"$sum": "$total_expenses"},
                "total_net_revenue": {"$sum": "$net_revenue"},
                "claim_count": {"$sum": 1},
                "avg_fee_percentage": {"$avg": "$fee_percentage"},
                "avg_settlement": {"$avg": "$settlement_amount"},
            }
        },
    ]

    results = await db.commissions.aggregate(pipeline).to_list(1)

    if not results:
        return {
            "success": True,
            "data": {
                "total_settlements": 0,
                "total_gross_fees": 0,
                "total_referral_fees": 0,
                "total_expenses": 0,
                "total_net_revenue": 0,
                "claim_count": 0,
                "avg_fee_percentage": 0,
                "avg_settlement": 0,
            },
        }

    summary = results[0]
    summary.pop("_id", None)
    # Round monetary values
    for key in ("total_settlements", "total_gross_fees", "total_referral_fees",
                "total_expenses", "total_net_revenue", "avg_settlement"):
        if key in summary and summary[key] is not None:
            summary[key] = round(summary[key], 2)
    if summary.get("avg_fee_percentage") is not None:
        summary["avg_fee_percentage"] = round(summary["avg_fee_percentage"], 2)

    return {"success": True, "data": summary}


@router.get("/by-adjuster")
async def revenue_by_adjuster(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Revenue grouped by adjuster (from splits)."""
    _require_admin_role(current_user)

    match_filter = _parse_date_range(start_date, end_date)

    pipeline = [
        {"$match": match_filter} if match_filter else {"$match": {}},
        {"$unwind": "$adjuster_splits"},
        {
            "$group": {
                "_id": {
                    "adjuster_name": "$adjuster_splits.adjuster_name",
                    "adjuster_id": "$adjuster_splits.adjuster_id",
                },
                "total_split_amount": {"$sum": "$adjuster_splits.split_amount"},
                "claim_count": {"$sum": 1},
                "avg_split_percentage": {"$avg": "$adjuster_splits.split_percentage"},
            }
        },
        {"$sort": {"total_split_amount": -1}},
        {
            "$project": {
                "_id": 0,
                "adjuster_name": "$_id.adjuster_name",
                "adjuster_id": "$_id.adjuster_id",
                "total_split_amount": {"$round": ["$total_split_amount", 2]},
                "claim_count": 1,
                "avg_split_percentage": {"$round": ["$avg_split_percentage", 2]},
            }
        },
    ]

    results = await db.commissions.aggregate(pipeline).to_list(500)
    return {"success": True, "data": results, "count": len(results)}


@router.get("/by-referral")
async def revenue_by_referral(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Revenue grouped by referral source."""
    _require_admin_role(current_user)

    match_filter = _parse_date_range(start_date, end_date)
    # Only include commissions that have a referral source
    base_filter = {"referral_source": {"$ne": None, "$exists": True}}
    combined = {**base_filter, **match_filter}

    pipeline = [
        {"$match": combined},
        {
            "$group": {
                "_id": "$referral_source",
                "total_referral_fees": {"$sum": "$referral_fee_amount"},
                "total_gross_fees": {"$sum": "$gross_fee"},
                "claim_count": {"$sum": 1},
            }
        },
        {"$sort": {"total_referral_fees": -1}},
        {
            "$project": {
                "_id": 0,
                "referral_source": "$_id",
                "total_referral_fees": {"$round": ["$total_referral_fees", 2]},
                "total_gross_fees": {"$round": ["$total_gross_fees", 2]},
                "claim_count": 1,
            }
        },
    ]

    results = await db.commissions.aggregate(pipeline).to_list(500)
    return {"success": True, "data": results, "count": len(results)}


@router.get("/pipeline")
async def unpaid_pipeline(
    current_user: dict = Depends(get_current_active_user),
):
    """Unpaid commissions pipeline — pending, invoiced, and partial statuses."""
    _require_admin_role(current_user)

    pipeline = [
        {"$match": {"payment_status": {"$in": ["pending", "invoiced", "partial"]}}},
        {
            "$group": {
                "_id": "$payment_status",
                "total_gross_fees": {"$sum": "$gross_fee"},
                "total_net_revenue": {"$sum": "$net_revenue"},
                "claim_count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
        {
            "$project": {
                "_id": 0,
                "payment_status": "$_id",
                "total_gross_fees": {"$round": ["$total_gross_fees", 2]},
                "total_net_revenue": {"$round": ["$total_net_revenue", 2]},
                "claim_count": 1,
            }
        },
    ]

    status_groups = await db.commissions.aggregate(pipeline).to_list(10)

    # Also fetch the individual unpaid claims for the detail list
    unpaid_claims = (
        await db.commissions.find(
            {"payment_status": {"$in": ["pending", "invoiced", "partial"]}},
            {"_id": 0},
        )
        .sort("created_at", -1)
        .to_list(500)
    )

    # Grand totals
    grand_total_gross = round(sum(g.get("total_gross_fees", 0) for g in status_groups), 2)
    grand_total_net = round(sum(g.get("total_net_revenue", 0) for g in status_groups), 2)
    grand_count = sum(g.get("claim_count", 0) for g in status_groups)

    return {
        "success": True,
        "data": {
            "by_status": status_groups,
            "claims": unpaid_claims,
            "totals": {
                "total_gross_fees": grand_total_gross,
                "total_net_revenue": grand_total_net,
                "claim_count": grand_count,
            },
        },
    }
