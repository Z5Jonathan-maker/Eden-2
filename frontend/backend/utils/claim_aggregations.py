"""
MongoDB aggregation pipelines for claim-related queries

These replace N+1 queries with efficient single-query aggregations.
"""

from typing import Dict, Any, Optional


async def get_claim_with_related_counts(db, claim_id: str) -> Optional[Dict[str, Any]]:
    """
    Get claim with related document/note/photo/supplement counts in a single query.

    Replaces:
        - db.claims.find_one({"id": claim_id})
        - db.documents.find({"claim_id": claim_id})
        - db.notes.count_documents({"claim_id": claim_id})
        - db.inspection_photos.count_documents({"claim_id": claim_id})
        - db.supplements.count_documents({"claim_id": claim_id, ...})

    With: Single aggregation pipeline

    Returns:
        {
            "claim": {...},
            "documents": [...],
            "documents_count": N,
            "notes_count": N,
            "photos_count": N,
            "supplements_submitted_count": N,
            "latest_submitted_supplement": {...} or None
        }
    """
    pipeline = [
        # Match the specific claim
        {"$match": {"id": claim_id}},

        # Lookup documents
        {
            "$lookup": {
                "from": "documents",
                "localField": "id",
                "foreignField": "claim_id",
                "as": "documents_data"
            }
        },

        # Lookup notes for counting
        {
            "$lookup": {
                "from": "notes",
                "localField": "id",
                "foreignField": "claim_id",
                "as": "notes_data"
            }
        },

        # Lookup photos for counting
        {
            "$lookup": {
                "from": "inspection_photos",
                "localField": "id",
                "foreignField": "claim_id",
                "as": "photos_data"
            }
        },

        # Lookup supplements
        {
            "$lookup": {
                "from": "supplements",
                "localField": "id",
                "foreignField": "claim_id",
                "pipeline": [
                    {
                        "$match": {
                            "status": {"$in": ["submitted", "under_review", "approved", "partial_approved"]}
                        }
                    }
                ],
                "as": "supplements_submitted_data"
            }
        },

        # Lookup latest submitted supplement
        {
            "$lookup": {
                "from": "supplements",
                "localField": "id",
                "foreignField": "claim_id",
                "pipeline": [
                    {"$match": {"submitted_at": {"$exists": True, "$ne": None}}},
                    {"$sort": {"submitted_at": -1}},
                    {"$limit": 1},
                    {"$project": {"_id": 0, "submitted_at": 1}}
                ],
                "as": "latest_submitted_data"
            }
        },

        # Project the final structure
        {
            "$project": {
                "_id": 0,
                "claim": "$$ROOT",
                "documents": {
                    "$map": {
                        "input": "$documents_data",
                        "as": "doc",
                        "in": {
                            "type": "$$doc.type",
                            "name": "$$doc.name",
                            "id": "$$doc.id",
                            "uploaded_at": "$$doc.uploaded_at"
                        }
                    }
                },
                "documents_count": {"$size": "$documents_data"},
                "notes_count": {"$size": "$notes_data"},
                "photos_count": {"$size": "$photos_data"},
                "supplements_submitted_count": {"$size": "$supplements_submitted_data"},
                "latest_submitted_supplement": {"$arrayElemAt": ["$latest_submitted_data", 0]}
            }
        },

        # Clean up claim object (remove joined arrays)
        {
            "$addFields": {
                "claim": {
                    "$arrayToObject": {
                        "$filter": {
                            "input": {"$objectToArray": "$claim"},
                            "cond": {
                                "$not": [
                                    {"$in": ["$$this.k", [
                                        "documents_data",
                                        "notes_data",
                                        "photos_data",
                                        "supplements_submitted_data",
                                        "latest_submitted_data"
                                    ]]}
                                ]
                            }
                        }
                    }
                }
            }
        }
    ]

    result = await db.claims.aggregate(pipeline).to_list(1)
    return result[0] if result else None


async def get_claim_with_full_details(db, claim_id: str, include_notes: bool = False, include_documents: bool = False) -> Optional[Dict[str, Any]]:
    """
    Get claim with full related data (not just counts).

    Use this for detail pages where you need the actual data, not just counts.

    Args:
        include_notes: Include full notes list (up to 100)
        include_documents: Include full documents list (up to 100)

    Returns:
        {
            "claim": {...},
            "notes": [...],  # if include_notes
            "documents": [...],  # if include_documents
            "photos_count": N,
            "supplements_count": N
        }
    """
    pipeline = [
        {"$match": {"id": claim_id}},
    ]

    # Conditionally add notes lookup
    if include_notes:
        pipeline.extend([
            {
                "$lookup": {
                    "from": "notes",
                    "localField": "id",
                    "foreignField": "claim_id",
                    "pipeline": [
                        {"$sort": {"created_at": -1}},
                        {"$limit": 100},
                        {"$project": {"_id": 0}}
                    ],
                    "as": "notes"
                }
            }
        ])

    # Conditionally add documents lookup
    if include_documents:
        pipeline.extend([
            {
                "$lookup": {
                    "from": "documents",
                    "localField": "id",
                    "foreignField": "claim_id",
                    "pipeline": [
                        {"$sort": {"uploaded_at": -1}},
                        {"$limit": 100},
                        {"$project": {"_id": 0}}
                    ],
                    "as": "documents"
                }
            }
        ])

    # Always include counts
    pipeline.extend([
        {
            "$lookup": {
                "from": "inspection_photos",
                "localField": "id",
                "foreignField": "claim_id",
                "as": "photos_data"
            }
        },
        {
            "$lookup": {
                "from": "supplements",
                "localField": "id",
                "foreignField": "claim_id",
                "as": "supplements_data"
            }
        },
        {
            "$addFields": {
                "photos_count": {"$size": "$photos_data"},
                "supplements_count": {"$size": "$supplements_data"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "photos_data": 0,
                "supplements_data": 0
            }
        }
    ])

    result = await db.claims.aggregate(pipeline).to_list(1)
    return result[0] if result else None


async def get_claims_list_optimized(db, filter_status: Optional[str] = None, assigned_to: Optional[str] = None, client_id: Optional[str] = None, limit: int = 100, skip: int = 0) -> Dict[str, Any]:
    """
    Get claims list with counts in a single efficient query.

    Replaces multiple queries with pagination support.

    Returns:
        {
            "claims": [...],
            "total": N,
            "page": N,
            "page_size": N,
            "total_pages": N
        }
    """
    # Build match filter
    match_filter = {}
    if filter_status and filter_status != "All":
        match_filter["status"] = filter_status
    if assigned_to:
        match_filter["assigned_to"] = assigned_to
    if client_id:
        match_filter["client_id"] = client_id

    # Get total count
    total = await db.claims.count_documents(match_filter)

    # Get paginated claims
    claims_cursor = db.claims.find(match_filter, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    claims = await claims_cursor.to_list(limit)

    return {
        "claims": claims,
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1
    }


async def get_user_with_claim_counts(db, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user with their claim counts and statistics.

    Useful for dashboards and profile pages.

    Returns:
        {
            "user": {...},
            "total_claims": N,
            "active_claims": N,
            "settled_claims": N
        }
    """
    pipeline = [
        {"$match": {"id": user_id}},
        {
            "$lookup": {
                "from": "claims",
                "localField": "id",
                "foreignField": "assigned_to",
                "as": "assigned_claims"
            }
        },
        {
            "$addFields": {
                "total_claims": {"$size": "$assigned_claims"},
                "active_claims": {
                    "$size": {
                        "$filter": {
                            "input": "$assigned_claims",
                            "cond": {
                                "$not": [{"$in": ["$$this.status", ["settled", "closed", "denied"]]}]
                            }
                        }
                    }
                },
                "settled_claims": {
                    "$size": {
                        "$filter": {
                            "input": "$assigned_claims",
                            "cond": {"$eq": ["$$this.status", "settled"]}
                        }
                    }
                }
            }
        },
        {
            "$project": {
                "_id": 0,
                "password": 0,
                "assigned_claims": 0
            }
        }
    ]

    result = await db.users.aggregate(pipeline).to_list(1)
    return result[0] if result else None
