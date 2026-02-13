from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from dependencies import db, get_current_active_user, require_role
from models import Claim, ClaimCreate
from datetime import datetime
from typing import List
import csv
import io
import json
import logging
import re
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["data"])
SUPPORTED_DUPLICATE_STRATEGIES = ["skip", "auto_renumber", "update_blank_fields"]
SUPPORTED_IMPORT_EXTENSIONS = [".csv", ".xlsx", ".xls"]

FIELD_ALIASES = {
    "claim_number": ["claim_number", "claim number", "claim #", "claim id", "id", "file number"],
    "client_name": [
        "client_name", "client name", "insured", "insured name", "homeowner", "policyholder",
        "policyholder name", "policyholder first name", "policyholder last name"
    ],
    "client_email": [
        "client_email", "client email", "email", "e-mail", "email address",
        "policyholder email", "claim email"
    ],
    "property_address": ["property_address", "property address", "loss address", "address", "street address"],
    "date_of_loss": ["date_of_loss", "date of loss", "dol", "loss date"],
    "claim_type": ["claim_type", "claim type", "type", "loss type", "peril"],
    "policy_number": ["policy_number", "policy number", "policy #", "policy no", "policy"],
    "estimated_value": ["estimated_value", "estimated value", "estimate", "claim value", "amount", "value"],
    "description": ["description", "notes", "summary", "details", "comments"],
    "status": ["status", "claim status", "stage"],
    "priority": ["priority", "severity"],
    "assigned_to": ["assigned_to", "assigned to", "adjuster", "owner", "assignee"],
}
CANONICAL_IMPORT_FIELDS = list(FIELD_ALIASES.keys())


def _norm_header(value: str) -> str:
    value = str(value or "").strip().lower()
    value = re.sub(r"[\s\-_/]+", " ", value)
    return value


def _clean_text(value, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    if text.lower() in {"nan", "none", "null"}:
        return default
    return text


def _parse_numeric(value, default: float = 0.0) -> float:
    text = _clean_text(value, "")
    if not text:
        return default
    cleaned = re.sub(r"[^0-9\.\-]", "", text)
    if cleaned in {"", "-", ".", "-."}:
        return default
    try:
        return float(cleaned)
    except Exception:
        return default


def _resolve_field(row: dict, field_name: str) -> str:
    direct = row.get(field_name)
    if direct not in (None, ""):
        return direct

    normalized = {_norm_header(k): v for k, v in row.items()}
    for alias in FIELD_ALIASES.get(field_name, []):
        alias_value = normalized.get(_norm_header(alias))
        if alias_value not in (None, ""):
            return alias_value
    return ""


def _resolve_field_with_mapping(row: dict, field_name: str, import_mapping: dict | None = None) -> str:
    if import_mapping:
        for source_header, mapped_field in import_mapping.items():
            if mapped_field != field_name:
                continue
            mapped_value = row.get(source_header)
            if mapped_value not in (None, ""):
                return mapped_value
    return _resolve_field(row, field_name)


def _sanitize_import_mapping(raw_mapping: dict | None) -> dict:
    if not isinstance(raw_mapping, dict):
        return {}
    allowed_fields = set(CANONICAL_IMPORT_FIELDS)
    cleaned = {}
    for source_header, mapped_field in raw_mapping.items():
        source = str(source_header or "").strip()
        field_name = str(mapped_field or "").strip()
        if not source or field_name not in allowed_fields:
            continue
        cleaned[source] = field_name
    return cleaned


def _parse_import_rows(content: bytes, filename: str) -> List[dict]:
    rows: List[dict] = []
    if filename.endswith(".csv"):
        decoded = content.decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(decoded)))
    else:
        excel_engine = "openpyxl" if filename.endswith(".xlsx") else None
        frame = pd.read_excel(io.BytesIO(content), dtype=str, engine=excel_engine)
        frame = frame.where(pd.notnull(frame), None)
        rows = frame.to_dict(orient="records")
    return rows


def _build_header_mapping(headers: List[str]) -> List[dict]:
    normalized_alias_to_field = {}
    for field_name, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            normalized_alias_to_field[_norm_header(alias)] = field_name

    mappings = []
    for header in headers:
        normalized = _norm_header(header)
        mapped_field = normalized_alias_to_field.get(normalized)
        confidence = "high" if mapped_field else "none"

        if not mapped_field:
            # Lightweight heuristic fallback for near-matches
            for alias_norm, field_name in normalized_alias_to_field.items():
                if normalized and (normalized in alias_norm or alias_norm in normalized):
                    mapped_field = field_name
                    confidence = "low"
                    break

        mappings.append({
            "source_header": header,
            "mapped_field": mapped_field,
            "confidence": confidence,
        })
    return mappings


def _is_blank(value) -> bool:
    return _clean_text(value, "") == ""


def _build_duplicate_update_patch(existing: dict, candidate_values: dict) -> dict:
    patch = {}
    for field_name, incoming_value in candidate_values.items():
        current_value = existing.get(field_name)
        if field_name == "estimated_value":
            incoming_number = float(incoming_value or 0.0)
            current_number = float(current_value or 0.0)
            if current_number <= 0 and incoming_number > 0:
                patch[field_name] = incoming_number
            continue

        if _is_blank(current_value) and not _is_blank(incoming_value):
            patch[field_name] = _clean_text(incoming_value)
    return patch


async def _next_available_claim_number(base_claim_number: str) -> str:
    base = _clean_text(base_claim_number, "CLM-IMP").strip() or "CLM-IMP"
    candidate = base
    suffix = 1
    while await db.claims.find_one({"claim_number": candidate}):
        candidate = f"{base}-DUP-{suffix:03d}"
        suffix += 1
    return candidate


@router.post("/import/claims/preview")
async def preview_claims_import(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["admin"]))
):
    """Preview import header mapping and sample rows before full import."""
    try:
        filename = (file.filename or "").lower()
        if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
            raise HTTPException(status_code=400, detail="Only CSV, XLSX, or XLS files are supported")

        content = await file.read()
        rows = _parse_import_rows(content, filename)
        headers = list(rows[0].keys()) if rows else []
        header_mapping = _build_header_mapping(headers)
        unknown_headers = [m["source_header"] for m in header_mapping if not m.get("mapped_field")]
        mapped_headers = [m for m in header_mapping if m.get("mapped_field")]
        sample_rows = rows[:5]

        return {
            "success": True,
            "filename": file.filename,
            "total_rows": len(rows),
            "detected_headers": headers,
            "mapped_header_count": len(mapped_headers),
            "unknown_header_count": len(unknown_headers),
            "unknown_headers": unknown_headers,
            "header_mapping": header_mapping,
            "sample_rows": sample_rows,
            "canonical_fields": CANONICAL_IMPORT_FIELDS,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview import claims error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/import/claims/capabilities")
async def get_import_claims_capabilities(
    current_user: dict = Depends(require_role(["admin"]))
):
    """Return supported import capabilities for frontend compatibility checks."""
    return {
        "success": True,
        "supports_duplicate_strategy": True,
        "duplicate_strategies": SUPPORTED_DUPLICATE_STRATEGIES,
        "accepted_extensions": SUPPORTED_IMPORT_EXTENSIONS,
    }

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
    import_mapping: str = Form(default=""),
    duplicate_strategy: str = Form(default="skip"),
    dry_run: bool = Form(default=False),
    current_user: dict = Depends(require_role(["admin"]))
):
    """Import claims from CSV or XLSX file"""
    try:
        filename = (file.filename or "").lower()
        if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
            raise HTTPException(status_code=400, detail="Only CSV, XLSX, or XLS files are supported")
        
        # Read file content
        content = await file.read()
        rows = _parse_import_rows(content, filename)
        parsed_mapping = {}
        if import_mapping:
            try:
                parsed_mapping = _sanitize_import_mapping(json.loads(import_mapping))
            except Exception:
                parsed_mapping = {}
        
        strategy = _clean_text(duplicate_strategy, "skip").lower()
        if strategy not in set(SUPPORTED_DUPLICATE_STRATEGIES):
            strategy = "skip"

        imported = 0
        updated = 0
        would_import = 0
        skipped = 0
        errors = []
        warnings = []
        row_report = []
        
        for idx, row in enumerate(rows):
            try:
                claim_number = _clean_text(_resolve_field_with_mapping(row, "claim_number", parsed_mapping))
                client_name = _clean_text(_resolve_field_with_mapping(row, "client_name", parsed_mapping))
                client_email = _clean_text(_resolve_field_with_mapping(row, "client_email", parsed_mapping))
                property_address = _clean_text(_resolve_field_with_mapping(row, "property_address", parsed_mapping))
                date_of_loss = _clean_text(_resolve_field_with_mapping(row, "date_of_loss", parsed_mapping))
                claim_type = _clean_text(_resolve_field_with_mapping(row, "claim_type", parsed_mapping), "Other")
                policy_number = _clean_text(_resolve_field_with_mapping(row, "policy_number", parsed_mapping))
                estimated_value = _parse_numeric(_resolve_field_with_mapping(row, "estimated_value", parsed_mapping), 0.0)
                description = _clean_text(_resolve_field_with_mapping(row, "description", parsed_mapping))
                status = _clean_text(_resolve_field_with_mapping(row, "status", parsed_mapping), "New")
                priority = _clean_text(_resolve_field_with_mapping(row, "priority", parsed_mapping), "Medium")
                assigned_to = _clean_text(_resolve_field_with_mapping(row, "assigned_to", parsed_mapping), current_user["full_name"])

                # Skip rows that are effectively empty
                if not any([
                    claim_number, client_name, client_email, property_address, date_of_loss,
                    claim_type, policy_number, description
                ]):
                    skipped += 1
                    row_report.append({
                        "row": idx + 2,
                        "status": "skipped",
                        "claim_number": "",
                        "message": "Empty row"
                    })
                    continue

                # Generate stable claim number when missing
                if not claim_number:
                    claim_number = f"CLM-IMP-{datetime.now().strftime('%Y%m%d')}-{idx + 1:05d}"
                    warnings.append(f"Row {idx + 2}: claim_number missing, generated {claim_number}")
                    row_report.append({
                        "row": idx + 2,
                        "status": "warning",
                        "claim_number": claim_number,
                        "message": "claim_number missing; generated automatically"
                    })

                # Check if claim already exists
                existing = await db.claims.find_one({"claim_number": claim_number})
                if existing:
                    if strategy == "auto_renumber":
                        original_claim_number = claim_number
                        claim_number = await _next_available_claim_number(claim_number)
                        warnings.append(
                            f"Row {idx + 2}: duplicate claim_number {original_claim_number}; generated {claim_number}"
                        )
                        row_report.append({
                            "row": idx + 2,
                            "status": "warning",
                            "claim_number": claim_number,
                            "message": f"Duplicate claim_number {original_claim_number}; generated {claim_number}"
                        })
                        existing = None
                    elif strategy == "update_blank_fields":
                        candidate_values = {
                            "client_name": client_name,
                            "client_email": client_email,
                            "property_address": property_address,
                            "date_of_loss": date_of_loss,
                            "claim_type": claim_type,
                            "policy_number": policy_number,
                            "estimated_value": estimated_value,
                            "description": description,
                            "status": status,
                            "priority": priority,
                            "assigned_to": assigned_to,
                        }
                        patch = _build_duplicate_update_patch(existing, candidate_values)

                        if patch:
                            patch["updated_at"] = datetime.utcnow()
                            if dry_run:
                                would_import += 1
                                row_report.append({
                                    "row": idx + 2,
                                    "status": "would_update",
                                    "claim_number": claim_number,
                                    "message": f"Dry run: would update blank fields ({', '.join(sorted(patch.keys()))})"
                                })
                            else:
                                await db.claims.update_one({"id": existing["id"]}, {"$set": patch})
                                updated += 1
                                row_report.append({
                                    "row": idx + 2,
                                    "status": "updated",
                                    "claim_number": claim_number,
                                    "message": f"Updated blank fields: {', '.join(sorted(patch.keys()))}"
                                })
                        else:
                            skipped += 1
                            row_report.append({
                                "row": idx + 2,
                                "status": "skipped",
                                "claim_number": claim_number,
                                "message": "Duplicate claim_number; no blank fields to update"
                            })
                        continue
                    else:
                        skipped += 1
                        row_report.append({
                            "row": idx + 2,
                            "status": "skipped",
                            "claim_number": claim_number,
                            "message": "Duplicate claim_number already exists"
                        })
                        continue
                
                # Create claim object
                claim_data = ClaimCreate(
                    claim_number=claim_number,
                    client_name=client_name or "",
                    client_email=client_email or "",
                    property_address=property_address or "",
                    date_of_loss=date_of_loss or "",
                    claim_type=claim_type or "Other",
                    policy_number=policy_number or "",
                    estimated_value=estimated_value,
                    description=description or "",
                    status=status or "New",
                    priority=priority or "Medium"
                )
                
                claim_obj = Claim(**claim_data.dict())
                claim_obj.created_by = current_user["id"]
                claim_obj.assigned_to = assigned_to

                if dry_run:
                    would_import += 1
                    row_report.append({
                        "row": idx + 2,
                        "status": "would_import",
                        "claim_number": claim_number,
                        "message": "Dry run: row is valid and would be imported"
                    })
                else:
                    await db.claims.insert_one(claim_obj.dict())
                    imported += 1
                    row_report.append({
                        "row": idx + 2,
                        "status": "imported",
                        "claim_number": claim_number,
                        "message": "Imported"
                    })
                
            except Exception as row_error:
                message = str(row_error)
                errors.append(f"Row {idx + 2}: {message}")
                row_report.append({
                    "row": idx + 2,
                    "status": "error",
                    "claim_number": _clean_text(_resolve_field(row, "claim_number")),
                    "message": message
                })
        
        return {
            "success": True,
            "dry_run": dry_run,
            "duplicate_strategy": strategy,
            "imported": imported,
            "updated": updated,
            "would_import": would_import,
            "skipped": skipped,
            "errors": errors[:20],  # Limit errors shown
            "warnings": warnings[:20],
            "error_count": len(errors),
            "warning_count": len(warnings),
            "row_report": row_report[:1000],
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
