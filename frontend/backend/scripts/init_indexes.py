"""
Initialize MongoDB indexes for Eden Claims Management System

This script creates indexes on frequently queried fields to improve performance.
Run this script once during deployment or when upgrading the database schema.

Usage:
    python scripts/init_indexes.py
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import logging

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def create_indexes():
    """Create all necessary indexes for optimal query performance"""

    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    if not mongo_url:
        raise RuntimeError("MONGO_URL environment variable is required")

    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'eden_claims')]

    logger.info("=" * 70)
    logger.info("CREATING MONGODB INDEXES")
    logger.info("=" * 70)

    try:
        # ============================================
        # USERS COLLECTION
        # ============================================
        logger.info("\n📧 Creating indexes for 'users' collection...")

        # Email - unique index for fast lookups and uniqueness constraint
        await db.users.create_index("email", unique=True, name="idx_users_email")
        logger.info("  ✓ Created unique index on 'email'")

        # ID - for fast user lookups
        await db.users.create_index("id", name="idx_users_id")
        logger.info("  ✓ Created index on 'id'")

        # Role - for role-based queries
        await db.users.create_index("role", name="idx_users_role")
        logger.info("  ✓ Created index on 'role'")

        # Active status - for filtering active users
        await db.users.create_index("is_active", name="idx_users_is_active")
        logger.info("  ✓ Created index on 'is_active'")

        # ============================================
        # CLAIMS COLLECTION
        # ============================================
        logger.info("\n📋 Creating indexes for 'claims' collection...")

        # Claim ID - unique identifier for fast lookups
        await db.claims.create_index("claim_id", unique=True, name="idx_claims_claim_id")
        logger.info("  ✓ Created unique index on 'claim_id'")

        # ID - for fast claim lookups
        await db.claims.create_index("id", name="idx_claims_id")
        logger.info("  ✓ Created index on 'id'")

        # Status - heavily queried for filtering
        await db.claims.create_index("status", name="idx_claims_status")
        logger.info("  ✓ Created index on 'status'")

        # Created date - for sorting and time-based queries
        await db.claims.create_index("created_at", name="idx_claims_created_at")
        logger.info("  ✓ Created index on 'created_at'")

        # Assigned adjuster - for filtering by assignment
        await db.claims.create_index("assigned_to", name="idx_claims_assigned_to")
        logger.info("  ✓ Created index on 'assigned_to'")

        # Client ID - for client portal views
        await db.claims.create_index("client_id", name="idx_claims_client_id")
        logger.info("  ✓ Created index on 'client_id'")

        # Compound index for status + created_at (common query pattern)
        await db.claims.create_index(
            [("status", 1), ("created_at", -1)],
            name="idx_claims_status_created"
        )
        logger.info("  ✓ Created compound index on 'status' + 'created_at'")

        # ============================================
        # NOTES COLLECTION
        # ============================================
        logger.info("\n📝 Creating indexes for 'notes' collection...")

        # Claim ID - for fetching all notes for a claim
        await db.notes.create_index("claim_id", name="idx_notes_claim_id")
        logger.info("  ✓ Created index on 'claim_id'")

        # Author ID - for filtering notes by author
        await db.notes.create_index("author_id", name="idx_notes_author_id")
        logger.info("  ✓ Created index on 'author_id'")

        # Created date - for sorting notes chronologically
        await db.notes.create_index("created_at", name="idx_notes_created_at")
        logger.info("  ✓ Created index on 'created_at'")

        # Compound index for claim_id + created_at (fetch sorted notes for claim)
        await db.notes.create_index(
            [("claim_id", 1), ("created_at", -1)],
            name="idx_notes_claim_created"
        )
        logger.info("  ✓ Created compound index on 'claim_id' + 'created_at'")

        # ============================================
        # DOCUMENTS COLLECTION
        # ============================================
        logger.info("\n📄 Creating indexes for 'documents' collection...")

        # Claim ID - for fetching all documents for a claim
        await db.documents.create_index("claim_id", name="idx_documents_claim_id")
        logger.info("  ✓ Created index on 'claim_id'")

        # Document type - for filtering by document type
        await db.documents.create_index("type", name="idx_documents_type")
        logger.info("  ✓ Created index on 'type'")

        # Uploaded date - for sorting documents
        await db.documents.create_index("uploaded_at", name="idx_documents_uploaded_at")
        logger.info("  ✓ Created index on 'uploaded_at'")

        # Compound index for claim_id + type
        await db.documents.create_index(
            [("claim_id", 1), ("type", 1)],
            name="idx_documents_claim_type"
        )
        logger.info("  ✓ Created compound index on 'claim_id' + 'type'")

        # ============================================
        # INSPECTION_PHOTOS COLLECTION
        # ============================================
        logger.info("\n📷 Creating indexes for 'inspection_photos' collection...")

        # Claim ID - for fetching all photos for a claim
        await db.inspection_photos.create_index("claim_id", name="idx_photos_claim_id")
        logger.info("  ✓ Created index on 'claim_id'")

        # Inspection ID - for fetching photos by inspection
        await db.inspection_photos.create_index("inspection_id", name="idx_photos_inspection_id")
        logger.info("  ✓ Created index on 'inspection_id'")

        # Captured date - for sorting photos
        await db.inspection_photos.create_index("captured_at", name="idx_photos_captured_at")
        logger.info("  ✓ Created index on 'captured_at'")

        # ============================================
        # SUPPLEMENTS COLLECTION
        # ============================================
        logger.info("\n💰 Creating indexes for 'supplements' collection...")

        # Claim ID - for fetching supplements by claim
        await db.supplements.create_index("claim_id", name="idx_supplements_claim_id")
        logger.info("  ✓ Created index on 'claim_id'")

        # Status - for filtering supplements by status
        await db.supplements.create_index("status", name="idx_supplements_status")
        logger.info("  ✓ Created index on 'status'")

        # Compound index for claim_id + status
        await db.supplements.create_index(
            [("claim_id", 1), ("status", 1)],
            name="idx_supplements_claim_status"
        )
        logger.info("  ✓ Created compound index on 'claim_id' + 'status'")

        # ============================================
        # HARVEST/CANVASSING COLLECTIONS
        # ============================================
        logger.info("\n🌾 Creating indexes for harvest collections...")

        # Harvest pins - user_id for user-specific pins
        await db.harvest_pins.create_index("user_id", name="idx_harvest_pins_user_id")
        logger.info("  ✓ Created index on 'harvest_pins.user_id'")

        # Harvest pins - territory_id for territory-based queries
        await db.harvest_pins.create_index("territory_id", name="idx_harvest_pins_territory_id")
        logger.info("  ✓ Created index on 'harvest_pins.territory_id'")

        # Harvest pins - status for filtering by pin status
        await db.harvest_pins.create_index("status", name="idx_harvest_pins_status")
        logger.info("  ✓ Created index on 'harvest_pins.status'")

        # Harvest pins - geospatial index for location queries (if using lat/lng)
        try:
            await db.harvest_pins.create_index(
                [("location", "2dsphere")],
                name="idx_harvest_pins_location"
            )
            logger.info("  ✓ Created geospatial index on 'harvest_pins.location'")
        except Exception as e:
            logger.warning(f"  ⚠ Skipped geospatial index (may not be applicable): {e}")

        # Harvest territories - user_id for user territories
        await db.harvest_territories.create_index("user_id", name="idx_territories_user_id")
        logger.info("  ✓ Created index on 'harvest_territories.user_id'")

        # ============================================
        # NOTIFICATIONS COLLECTION
        # ============================================
        logger.info("\n🔔 Creating indexes for 'notifications' collection...")

        # User ID - for fetching user notifications
        await db.notifications.create_index("user_id", name="idx_notifications_user_id")
        logger.info("  ✓ Created index on 'user_id'")

        # Read status - for filtering unread notifications
        await db.notifications.create_index("read", name="idx_notifications_read")
        logger.info("  ✓ Created index on 'read'")

        # Compound index for user_id + read + created_at
        await db.notifications.create_index(
            [("user_id", 1), ("read", 1), ("created_at", -1)],
            name="idx_notifications_user_read_created"
        )
        logger.info("  ✓ Created compound index on 'user_id' + 'read' + 'created_at'")

        logger.info("\n" + "=" * 70)
        logger.info("✅ ALL INDEXES CREATED SUCCESSFULLY")
        logger.info("=" * 70)

        # List all indexes for verification
        logger.info("\n📊 Index Summary:")
        collections = [
            'users', 'claims', 'notes', 'documents', 'inspection_photos',
            'supplements', 'harvest_pins', 'harvest_territories', 'notifications'
        ]

        for coll_name in collections:
            indexes = await db[coll_name].list_indexes().to_list(None)
            logger.info(f"\n  {coll_name}: {len(indexes)} indexes")
            for idx in indexes:
                logger.info(f"    - {idx['name']}")

    except Exception as e:
        logger.error(f"\n❌ Error creating indexes: {e}")
        raise

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(create_indexes())
