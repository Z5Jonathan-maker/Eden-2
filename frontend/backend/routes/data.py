from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from dependencies import db, get_current_active_user, require_role
from models import Claim, ClaimCreate
from datetime import datetime
from typing import List
import csv
import io
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["data"])

@router.get("/export/claims")
async def export_claims_csv(
    current_user: dict = Depends(require_role(["admin", "adjuster"]))
):
    """Export all claims to CSV"""
    try:
        claims = await db.claims.find({}, {"_id": 0}).to_list(10000)
        
        if not claims:
            raise HTTPException(status_code=404, detail="No claims to export")
        
        # Create CSV in memory
        output = io.StringIO()
        
        # Define CSV columns
        fieldnames = [
            'claim_number', 'client_name', 'client_email', 'property_address',
            'date_of_loss', 'claim_type', 'policy_number', 'estimated_value',
            'description', 'status', 'priority', 'assigned_to', 'created_at', 'updated_at'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        
        for claim in claims:
            # Convert datetime objects to strings
            row = {k: str(v) if isinstance(v, datetime) else v for k, v in claim.items()}
            writer.writerow(row)
        
        output.seek(0)
        
        # Return as downloadable CSV
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=claims_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export claims error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export/claims/json")
async def export_claims_json(
    current_user: dict = Depends(require_role(["admin", "adjuster"]))
):
    """Export all claims to JSON"""
    try:
        claims = await db.claims.find({}, {"_id": 0}).to_list(10000)
        
        if not claims:
            raise HTTPException(status_code=404, detail="No claims to export")
        
        # Convert datetime objects to strings
        for claim in claims:
            for key, value in claim.items():
                if isinstance(value, datetime):
                    claim[key] = value.isoformat()
        
        output = json.dumps(claims, indent=2)
        
        return StreamingResponse(
            iter([output]),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=claims_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export claims JSON error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import/claims")
async def import_claims_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["admin"]))
):
    """Import claims from CSV file"""
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
        # Read file content
        content = await file.read()
        decoded = content.decode('utf-8')
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(decoded))
        
        imported = 0
        skipped = 0
        errors = []
        
        for row in reader:
            try:
                # Check if claim already exists
                existing = await db.claims.find_one({"claim_number": row.get('claim_number')})
                if existing:
                    skipped += 1
                    continue
                
                # Create claim object
                claim_data = ClaimCreate(
                    claim_number=row.get('claim_number', f"CLM-IMP-{imported}"),
                    client_name=row.get('client_name', 'Unknown'),
                    client_email=row.get('client_email', 'unknown@example.com'),
                    property_address=row.get('property_address', 'Unknown'),
                    date_of_loss=row.get('date_of_loss', datetime.now().strftime('%Y-%m-%d')),
                    claim_type=row.get('claim_type', 'Other'),
                    policy_number=row.get('policy_number', 'Unknown'),
                    estimated_value=float(row.get('estimated_value', 0) or 0),
                    description=row.get('description', ''),
                    status=row.get('status', 'New'),
                    priority=row.get('priority', 'Medium')
                )
                
                claim_obj = Claim(**claim_data.dict())
                claim_obj.created_by = current_user["id"]
                claim_obj.assigned_to = row.get('assigned_to', current_user["full_name"])
                
                await db.claims.insert_one(claim_obj.dict())
                imported += 1
                
            except Exception as row_error:
                errors.append(f"Row {imported + skipped + 1}: {str(row_error)}")
        
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "errors": errors[:10]  # Limit errors shown
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import claims error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/template/claims")
async def get_import_template(
    current_user: dict = Depends(get_current_active_user)
):
    """Get CSV template for importing claims"""
    output = io.StringIO()
    
    fieldnames = [
        'claim_number', 'client_name', 'client_email', 'property_address',
        'date_of_loss', 'claim_type', 'policy_number', 'estimated_value',
        'description', 'status', 'priority', 'assigned_to'
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    # Add example row
    writer.writerow({
        'claim_number': 'CLM-EXAMPLE-001',
        'client_name': 'John Doe',
        'client_email': 'john@example.com',
        'property_address': '123 Main St, Miami FL 33101',
        'date_of_loss': '2024-01-15',
        'claim_type': 'Water Damage',
        'policy_number': 'POL-123456',
        'estimated_value': '25000',
        'description': 'Water damage from pipe burst',
        'status': 'New',
        'priority': 'Medium',
        'assigned_to': ''
    })
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=claims_import_template.csv"
        }
    )

@router.get("/stats")
async def get_data_stats(
    current_user: dict = Depends(require_role(["admin", "adjuster"]))
):
    """Get database statistics"""
    try:
        total_claims = await db.claims.count_documents({})
        total_users = await db.users.count_documents({})
        total_notes = await db.notes.count_documents({})
        total_notifications = await db.notifications.count_documents({})
        
        # Claims by status
        status_pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_stats = await db.claims.aggregate(status_pipeline).to_list(100)
        
        # Claims by type
        type_pipeline = [
            {"$group": {"_id": "$claim_type", "count": {"$sum": 1}}}
        ]
        type_stats = await db.claims.aggregate(type_pipeline).to_list(100)
        
        return {
            "total_claims": total_claims,
            "total_users": total_users,
            "total_notes": total_notes,
            "total_notifications": total_notifications,
            "claims_by_status": {s["_id"]: s["count"] for s in status_stats if s["_id"]},
            "claims_by_type": {t["_id"]: t["count"] for t in type_stats if t["_id"]}
        }
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
