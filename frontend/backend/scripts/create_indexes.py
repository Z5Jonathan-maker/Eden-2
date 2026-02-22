#!/usr/bin/env python3
"""
MongoDB Index Creation Script for Eden 2

Creates optimized indexes for all collections based on audit findings.
Addresses N+1 query problems and improves query performance.

Run: python -m backend.scripts.create_indexes

Cimadevilla Operating Stack - Layer 2 (Scale & Systems):
- Database optimization for explosive growth
- Performance foundations for 10x scale
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "eden")


async def create_indexes():
    """Create all necessary indexes for optimal query performance"""

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print(f"🔗 Connected to MongoDB: {DATABASE_NAME}")
    print("📊 Creating indexes...\n")

    # ==================== USERS COLLECTION ====================
    print("👥 Users collection:")

    # Email: unique index for login lookups (critical path)
    await db.users.create_index("email", unique=True, name="idx_users_email_unique")
    print("  ✅ email (unique)")

    # Role: for permission filtering and user lists
    await db.users.create_index("role", name="idx_users_role")
    print("  ✅ role")

    # Active status: filter active users
    await db.users.create_index("is_active", name="idx_users_active")
    print("  ✅ is_active")

    # Compound: role + active for common queries
    await db.users.create_index([("role", 1), ("is_active", 1)], name="idx_users_role_active")
    print("  ✅ role + is_active (compound)\n")

    # ==================== CLAIMS COLLECTION ====================
    print("📋 Claims collection:")

    # Claim number: unique, frequently searched by users
    await db.claims.create_index("claim_number", unique=True, name="idx_claims_number_unique")
    print("  ✅ claim_number (unique)")

    # Status: critical for filtering claim lists
    await db.claims.create_index("status", name="idx_claims_status")
    print("  ✅ status")

    # Created by: filter claims by creator
    await db.claims.create_index("created_by", name="idx_claims_created_by")
    print("  ✅ created_by")

    # Assigned to: filter claims by assignee
    await db.claims.create_index("assigned_to", name="idx_claims_assigned_to")
    print("  ✅ assigned_to")

    # Stage: client portal filtering
    await db.claims.create_index("stage", name="idx_claims_stage")
    print("  ✅ stage")

    # Created at: sorting and date range queries
    await db.claims.create_index("created_at", name="idx_claims_created_at")
    print("  ✅ created_at")

    # Priority: filtering high-priority claims
    await db.claims.create_index("priority", name="idx_claims_priority")
    print("  ✅ priority")

    # Compound: status + assigned_to (common filter combo)
    await db.claims.create_index([("status", 1), ("assigned_to", 1)], name="idx_claims_status_assigned")
    print("  ✅ status + assigned_to (compound)")

    # Compound: created_by + status (user's claim list)
    await db.claims.create_index([("created_by", 1), ("status", 1)], name="idx_claims_creator_status")
    print("  ✅ created_by + status (compound)\n")

    # ==================== NOTES COLLECTION ====================
    print("📝 Notes collection:")

    # Claim ID: CRITICAL - fetched on every claim details page
    await db.notes.create_index("claim_id", name="idx_notes_claim_id")
    print("  ✅ claim_id (critical foreign key)")

    # Author ID: filter notes by author
    await db.notes.create_index("author_id", name="idx_notes_author_id")
    print("  ✅ author_id")

    # Created at: sorting notes chronologically
    await db.notes.create_index("created_at", name="idx_notes_created_at")
    print("  ✅ created_at")

    # Compound: claim_id + created_at (claim notes sorted)
    await db.notes.create_index([("claim_id", 1), ("created_at", -1)], name="idx_notes_claim_created")
    print("  ✅ claim_id + created_at DESC (compound)\n")

    # ==================== DOCUMENTS COLLECTION ====================
    print("📄 Documents collection:")

    # Claim ID: CRITICAL - fetched on every claim details page
    await db.documents.create_index("claim_id", name="idx_documents_claim_id")
    print("  ✅ claim_id (critical foreign key)")

    # Uploaded by: filter documents by uploader
    await db.documents.create_index("uploaded_by", name="idx_documents_uploaded_by")
    print("  ✅ uploaded_by")

    # Uploaded at: sorting documents
    await db.documents.create_index("uploaded_at", name="idx_documents_uploaded_at")
    print("  ✅ uploaded_at")

    # Type: filter by document type
    await db.documents.create_index("type", name="idx_documents_type")
    print("  ✅ type")

    # Compound: claim_id + uploaded_at (claim documents sorted)
    await db.documents.create_index([("claim_id", 1), ("uploaded_at", -1)], name="idx_documents_claim_uploaded")
    print("  ✅ claim_id + uploaded_at DESC (compound)\n")

    # ==================== INSPECTIONS COLLECTION ====================
    print("🔍 Inspections collection:")

    # Claim ID: fetch inspections for a claim
    await db.inspections.create_index("claim_id", name="idx_inspections_claim_id")
    print("  ✅ claim_id")

    # Inspector ID: filter by inspector
    await db.inspections.create_index("inspector_id", name="idx_inspections_inspector_id")
    print("  ✅ inspector_id")

    # Created at: sorting inspections
    await db.inspections.create_index("created_at", name="idx_inspections_created_at")
    print("  ✅ created_at")

    # Status: filter by inspection status
    await db.inspections.create_index("status", name="idx_inspections_status")
    print("  ✅ status\n")

    # ==================== INSPECTION_PHOTOS COLLECTION ====================
    print("📸 Inspection Photos collection:")

    # Claim ID: CRITICAL - fetch all photos for a claim
    await db.inspection_photos.create_index("claim_id", name="idx_photos_claim_id")
    print("  ✅ claim_id (critical foreign key)")

    # Inspection ID: fetch photos for specific inspection
    await db.inspection_photos.create_index("inspection_id", name="idx_photos_inspection_id")
    print("  ✅ inspection_id")

    # Created at: sorting photos
    await db.inspection_photos.create_index("created_at", name="idx_photos_created_at")
    print("  ✅ created_at")

    # Room: filter photos by room
    await db.inspection_photos.create_index("room", name="idx_photos_room")
    print("  ✅ room")

    # Category: filter by photo category
    await db.inspection_photos.create_index("category", name="idx_photos_category")
    print("  ✅ category\n")

    # ==================== NOTIFICATIONS COLLECTION ====================
    print("🔔 Notifications collection:")

    # User ID: CRITICAL - fetch user's notifications
    await db.notifications.create_index("user_id", name="idx_notifications_user_id")
    print("  ✅ user_id (critical foreign key)")

    # Is read: filter unread notifications
    await db.notifications.create_index("is_read", name="idx_notifications_is_read")
    print("  ✅ is_read")

    # Created at: sorting notifications
    await db.notifications.create_index("created_at", name="idx_notifications_created_at")
    print("  ✅ created_at")

    # Compound: user_id + is_read + created_at (user's unread notifications)
    await db.notifications.create_index(
        [("user_id", 1), ("is_read", 1), ("created_at", -1)],
        name="idx_notifications_user_read_created"
    )
    print("  ✅ user_id + is_read + created_at DESC (compound)\n")

    # ==================== SUPPLEMENTS COLLECTION ====================
    print("💰 Supplements collection:")

    # Claim ID: fetch supplements for a claim
    await db.supplements.create_index("claim_id", name="idx_supplements_claim_id")
    print("  ✅ claim_id")

    # Created at: sorting supplements
    await db.supplements.create_index("created_at", name="idx_supplements_created_at")
    print("  ✅ created_at\n")

    # ==================== HARVEST (CANVASSING) COLLECTIONS ====================
    print("🌾 Harvest/Canvassing collections:")

    # Canvassing pins
    await db.canvassing_pins.create_index("user_id", name="idx_pins_user_id")
    print("  ✅ canvassing_pins.user_id")

    await db.canvassing_pins.create_index("created_at", name="idx_pins_created_at")
    print("  ✅ canvassing_pins.created_at")

    # Geospatial index for proximity queries
    await db.canvassing_pins.create_index([("location", "2dsphere")], name="idx_pins_location_geo")
    print("  ✅ canvassing_pins.location (2dsphere geospatial)")

    # Compound: user + created_at for user's pin history
    await db.canvassing_pins.create_index(
        [("user_id", 1), ("created_at", -1)],
        name="idx_pins_user_created"
    )
    print("  ✅ canvassing_pins.user_id + created_at DESC (compound)\n")

    # ==================== TEXT SEARCH INDEXES ====================
    print("🔎 Text search indexes:")

    # Claims: search by claim number, client name, address
    await db.claims.create_index(
        [
            ("claim_number", "text"),
            ("client_name", "text"),
            ("property_address", "text")
        ],
        name="idx_claims_text_search"
    )
    print("  ✅ claims (text search: claim_number, client_name, property_address)")

    # Notes: search by content
    await db.notes.create_index([("content", "text")], name="idx_notes_text_search")
    print("  ✅ notes (text search: content)\n")

    print("=" * 60)
    print("✅ All indexes created successfully!")
    print("=" * 60)
    print("\n📊 Summary:")

    # Get index stats
    for collection_name in [
        "users", "claims", "notes", "documents", "inspections",
        "inspection_photos", "notifications", "supplements", "canvassing_pins"
    ]:
        collection = db[collection_name]
        indexes = await collection.list_indexes().to_list(length=None)
        print(f"  {collection_name}: {len(indexes)} indexes")

    print("\n🚀 Database optimized for scale!\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(create_indexes())
