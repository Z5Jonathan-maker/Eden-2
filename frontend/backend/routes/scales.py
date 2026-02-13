"""
Scales Routes - Xactimate Estimate Comparison Engine
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging

from services.pdf_parser import parse_xactimate_pdf, EstimateData
from services.estimate_matcher import compare_estimates, ComparisonResult
from services.ai_analyzer import analyze_comparison, generate_dispute_letter
from dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scales", tags=["scales"])

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]


# Pydantic Models
class EstimateUploadResponse(BaseModel):
    id: str
    file_name: str
    estimate_type: str
    claim_number: Optional[str]
    insured_name: Optional[str]
    line_item_count: int
    total_rcv: float
    categories: Dict[str, float]
    uploaded_at: str


class ComparisonRequest(BaseModel):
    carrier_estimate_id: str
    contractor_estimate_id: str
    claim_id: Optional[str] = None


class ComparisonResponse(BaseModel):
    id: str
    carrier_estimate: Dict
    contractor_estimate: Dict
    total_variance: float
    total_variance_pct: float
    summary: Dict
    category_variances: List[Dict]
    matched_count: int
    missing_count: int
    modified_count: int
    created_at: str


class AIAnalysisRequest(BaseModel):
    comparison_id: str
    analysis_focus: str = "comprehensive"  # comprehensive, missing_items, pricing, scope


class DisputeLetterRequest(BaseModel):
    comparison_id: str
    item_ids: List[int] = Field(default_factory=list, description="Indices of items to dispute")


@router.post("/upload", response_model=EstimateUploadResponse)
async def upload_estimate(
    file: UploadFile = File(...),
    estimate_type: str = Form(...),  # carrier, contractor, pa
    claim_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload and parse an Xactimate estimate PDF"""
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if estimate_type not in ['carrier', 'contractor', 'pa']:
        raise HTTPException(status_code=400, detail="estimate_type must be 'carrier', 'contractor', or 'pa'")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse the PDF
        estimate_data = parse_xactimate_pdf(content, file.filename, estimate_type)
        
        # Warn if no line items found - this might not be an Xactimate estimate
        parsing_warning = None
        if len(estimate_data.line_items) == 0:
            parsing_warning = "No line items were extracted from this PDF. This may not be a valid Xactimate estimate format. Please ensure you're uploading an Xactimate estimate PDF, not a payment letter or other document."
            logger.warning(f"PDF {file.filename} parsed with 0 line items - may not be Xactimate format")
        
        # Generate ID
        estimate_id = str(uuid.uuid4())
        
        # Store in database
        doc = {
            'id': estimate_id,
            'user_id': current_user.get('id'),
            'claim_id': claim_id,
            'file_name': file.filename,
            'estimate_type': estimate_type,
            'claim_number': estimate_data.claim_number,
            'insured_name': estimate_data.insured_name,
            'date_of_loss': estimate_data.date_of_loss,
            'estimate_date': estimate_data.estimate_date,
            'line_items': [item.to_dict() for item in estimate_data.line_items],
            'line_item_count': len(estimate_data.line_items),  # Store count for quick access
            'total_rcv': estimate_data.total_rcv,
            'total_depreciation': estimate_data.total_depreciation,
            'total_acv': estimate_data.total_acv,
            'categories': estimate_data.categories,
            'uploaded_at': datetime.now(timezone.utc).isoformat(),
            'parsing_warning': parsing_warning
        }
        
        await db.scales_estimates.insert_one(doc)
        
        response_data = {
            "id": estimate_id,
            "file_name": file.filename,
            "estimate_type": estimate_type,
            "claim_number": estimate_data.claim_number,
            "insured_name": estimate_data.insured_name,
            "line_item_count": len(estimate_data.line_items),
            "total_rcv": estimate_data.total_rcv,
            "categories": estimate_data.categories,
            "uploaded_at": doc['uploaded_at']
        }
        
        # Include warning in response if present
        if parsing_warning:
            response_data["warning"] = parsing_warning
        
        return response_data
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading estimate: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process estimate")


@router.get("/estimates")
async def list_estimates(
    claim_id: Optional[str] = None,
    estimate_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List uploaded estimates for the current user"""
    
    query = {'user_id': current_user.get('id')}
    if claim_id:
        query['claim_id'] = claim_id
    if estimate_type:
        query['estimate_type'] = estimate_type
    
    estimates = await db.scales_estimates.find(
        query, 
        {'_id': 0, 'line_items': 0}  # Exclude heavy fields
    ).sort('uploaded_at', -1).to_list(100)
    
    # Add line_item_count for older estimates that don't have it stored
    for est in estimates:
        if 'line_item_count' not in est:
            # Count from stored line_items if available, or use 0
            full_doc = await db.scales_estimates.find_one(
                {'id': est['id']},
                {'line_items': 1}
            )
            if full_doc and full_doc.get('line_items'):
                est['line_item_count'] = len(full_doc['line_items'])
            else:
                est['line_item_count'] = 0
    
    return estimates


@router.get("/estimates/{estimate_id}")
async def get_estimate(
    estimate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed estimate data"""
    
    estimate = await db.scales_estimates.find_one(
        {'id': estimate_id, 'user_id': current_user.get('id')},
        {'_id': 0}
    )
    
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    
    return estimate


@router.delete("/estimates/{estimate_id}")
async def delete_estimate(
    estimate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an uploaded estimate"""
    
    result = await db.scales_estimates.delete_one(
        {'id': estimate_id, 'user_id': current_user.get('id')}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Estimate not found")
    
    return {"message": "Estimate deleted successfully"}


@router.post("/compare")
async def compare_estimates_endpoint(
    request: ComparisonRequest,
    current_user: dict = Depends(get_current_user)
):
    """Compare two estimates and generate a detailed variance report"""
    
    # Fetch both estimates
    carrier_doc = await db.scales_estimates.find_one(
        {'id': request.carrier_estimate_id, 'user_id': current_user.get('id')},
        {'_id': 0}
    )
    
    contractor_doc = await db.scales_estimates.find_one(
        {'id': request.contractor_estimate_id, 'user_id': current_user.get('id')},
        {'_id': 0}
    )
    
    if not carrier_doc:
        raise HTTPException(status_code=404, detail="Carrier estimate not found")
    if not contractor_doc:
        raise HTTPException(status_code=404, detail="Contractor estimate not found")
    
    try:
        # Convert docs back to EstimateData objects
        from services.pdf_parser import LineItem
        
        carrier_items = [LineItem(**item) for item in carrier_doc['line_items']]
        carrier_estimate = EstimateData(
            file_name=carrier_doc['file_name'],
            estimate_type=carrier_doc['estimate_type'],
            claim_number=carrier_doc.get('claim_number'),
            insured_name=carrier_doc.get('insured_name'),
            line_items=carrier_items,
            total_rcv=carrier_doc['total_rcv'],
            total_depreciation=carrier_doc.get('total_depreciation', 0),
            total_acv=carrier_doc.get('total_acv', 0),
            categories=carrier_doc.get('categories', {})
        )
        
        contractor_items = [LineItem(**item) for item in contractor_doc['line_items']]
        contractor_estimate = EstimateData(
            file_name=contractor_doc['file_name'],
            estimate_type=contractor_doc['estimate_type'],
            claim_number=contractor_doc.get('claim_number'),
            insured_name=contractor_doc.get('insured_name'),
            line_items=contractor_items,
            total_rcv=contractor_doc['total_rcv'],
            total_depreciation=contractor_doc.get('total_depreciation', 0),
            total_acv=contractor_doc.get('total_acv', 0),
            categories=contractor_doc.get('categories', {})
        )
        
        # Compare estimates
        comparison = compare_estimates(carrier_estimate, contractor_estimate)
        
        # Generate comparison ID and store
        comparison_id = str(uuid.uuid4())
        comparison_doc = {
            'id': comparison_id,
            'user_id': current_user.get('id'),
            'claim_id': request.claim_id,
            'carrier_estimate_id': request.carrier_estimate_id,
            'contractor_estimate_id': request.contractor_estimate_id,
            **comparison.to_dict(),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.scales_comparisons.insert_one(comparison_doc)
        
        # Return without _id
        comparison_doc.pop('_id', None)
        
        return comparison_doc
        
    except Exception as e:
        logger.error(f"Error comparing estimates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to compare estimates: {str(e)}")


@router.get("/comparisons")
async def list_comparisons(
    claim_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List saved comparisons"""
    
    query = {'user_id': current_user.get('id')}
    if claim_id:
        query['claim_id'] = claim_id
    
    # Only return summary data, not full comparison
    comparisons = await db.scales_comparisons.find(
        query,
        {
            '_id': 0,
            'matched_items': 0,
            'missing_items': 0,
            'extra_items': 0,
            'modified_items': 0
        }
    ).sort('created_at', -1).to_list(50)
    
    return comparisons


@router.get("/comparisons/{comparison_id}")
async def get_comparison(
    comparison_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get full comparison details"""
    
    comparison = await db.scales_comparisons.find_one(
        {'id': comparison_id, 'user_id': current_user.get('id')},
        {'_id': 0}
    )
    
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    return comparison


@router.post("/analyze")
async def analyze_comparison_endpoint(
    request: AIAnalysisRequest,
    current_user: dict = Depends(get_current_user)
):
    """Get AI-powered analysis of a comparison"""
    
    # Fetch the comparison
    comparison = await db.scales_comparisons.find_one(
        {'id': request.comparison_id, 'user_id': current_user.get('id')},
        {'_id': 0}
    )
    
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    try:
        # Run AI analysis
        analysis = await analyze_comparison(comparison, request.analysis_focus)
        
        # Store analysis
        analysis_id = str(uuid.uuid4())
        analysis_doc = {
            'id': analysis_id,
            'comparison_id': request.comparison_id,
            'user_id': current_user.get('id'),
            'analysis_focus': request.analysis_focus,
            **analysis,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.scales_analyses.insert_one(analysis_doc)
        
        analysis_doc.pop('_id', None)
        
        return analysis_doc
        
    except Exception as e:
        logger.error(f"Error analyzing comparison: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze comparison: {str(e)}")


@router.post("/dispute-letter")
async def generate_dispute_letter_endpoint(
    request: DisputeLetterRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a dispute letter for selected items"""
    
    # Fetch the comparison
    comparison = await db.scales_comparisons.find_one(
        {'id': request.comparison_id, 'user_id': current_user.get('id')},
        {'_id': 0}
    )
    
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    try:
        # Get items to dispute
        all_items = comparison.get('missing_items', []) + comparison.get('modified_items', [])
        
        if request.item_ids:
            items_to_dispute = [all_items[i] for i in request.item_ids if i < len(all_items)]
        else:
            # Default to all missing and high-impact modified items
            items_to_dispute = [
                item for item in all_items 
                if item.get('impact') == 'high' or item.get('status') == 'missing'
            ]
        
        claim_details = {
            'claim_number': comparison.get('carrier_estimate', {}).get('claim_number'),
            'insured_name': comparison.get('carrier_estimate', {}).get('insured_name'),
            'date_of_loss': comparison.get('carrier_estimate', {}).get('date_of_loss')
        }
        
        letter = await generate_dispute_letter(comparison, items_to_dispute, claim_details)
        
        return {
            'dispute_letter': letter,
            'items_count': len(items_to_dispute),
            'total_amount': sum(item.get('total_diff', 0) for item in items_to_dispute)
        }
        
    except Exception as e:
        logger.error(f"Error generating dispute letter: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate dispute letter: {str(e)}")


@router.get("/stats")
async def get_scales_stats(current_user: dict = Depends(get_current_user)):
    """Get usage statistics for Scales"""
    
    user_id = current_user.get('id')
    
    estimates_count = await db.scales_estimates.count_documents({'user_id': user_id})
    comparisons_count = await db.scales_comparisons.count_documents({'user_id': user_id})
    
    # Get total variance across all comparisons
    pipeline = [
        {'$match': {'user_id': user_id}},
        {'$group': {
            '_id': None,
            'total_variance_identified': {'$sum': '$total_variance'},
            'avg_variance': {'$avg': '$total_variance'}
        }}
    ]
    
    variance_stats = await db.scales_comparisons.aggregate(pipeline).to_list(1)
    variance_data = variance_stats[0] if variance_stats else {'total_variance_identified': 0, 'avg_variance': 0}
    
    return {
        'estimates_uploaded': estimates_count,
        'comparisons_completed': comparisons_count,
        'total_variance_identified': variance_data.get('total_variance_identified', 0),
        'avg_variance_per_comparison': variance_data.get('avg_variance', 0)
    }
