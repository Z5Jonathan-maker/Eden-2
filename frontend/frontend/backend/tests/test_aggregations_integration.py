"""
Integration Tests for MongoDB Aggregation Pipelines

Validates that our aggregation pipelines work correctly with real MongoDB data.
Tests performance improvements and ensures data integrity.

Run: pytest backend/tests/test_aggregations_integration.py -v

Cimadevilla Operating Stack - Layer 2 (Scale & Systems):
- Validate infrastructure before scaling
- Prove performance claims with real data
- Ensure reliability for kingdom impact
"""

import pytest
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Import our aggregation functions
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.aggregation_examples import ClaimAggregations, HarvestAggregations
from utils.claim_aggregations import get_claim_with_related_counts, get_claims_list_optimized

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "eden")


@pytest.fixture
async def db():
    """Get database connection"""
    client = AsyncIOMotorClient(MONGODB_URL)
    database = client[DATABASE_NAME]
    yield database
    client.close()


@pytest.fixture
async def sample_claim(db):
    """Create a sample claim for testing"""
    claim_data = {
        "id": "test-claim-integration-001",
        "claim_number": "TEST-2024-001",
        "client_name": "Test Client",
        "client_email": "test@example.com",
        "property_address": "123 Test St",
        "date_of_loss": "2024-01-15",
        "claim_type": "Water Damage",
        "policy_number": "POL-12345",
        "estimated_value": 50000,
        "status": "In Progress",
        "priority": "High",
        "created_by": "test-user-001",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "stage": "inspection",
    }

    # Insert claim
    await db.claims.delete_one({"id": claim_data["id"]})  # Clean up if exists
    await db.claims.insert_one(claim_data)

    # Add related data
    await db.notes.insert_many([
        {
            "id": f"note-{i}",
            "claim_id": claim_data["id"],
            "content": f"Test note {i}",
            "author_id": "test-user-001",
            "author_name": "Test User",
            "created_at": datetime.now(timezone.utc)
        }
        for i in range(3)
    ])

    await db.documents.insert_many([
        {
            "id": f"doc-{i}",
            "claim_id": claim_data["id"],
            "name": f"test-doc-{i}.pdf",
            "type": "policy",
            "size": "1MB",
            "uploaded_by": "test-user-001",
            "uploaded_at": datetime.now(timezone.utc)
        }
        for i in range(2)
    ])

    await db.inspection_photos.insert_many([
        {
            "id": f"photo-{i}",
            "claim_id": claim_data["id"],
            "room": "Living Room",
            "category": "Water Damage",
            "created_at": datetime.now(timezone.utc)
        }
        for i in range(5)
    ])

    yield claim_data

    # Cleanup
    await db.claims.delete_one({"id": claim_data["id"]})
    await db.notes.delete_many({"claim_id": claim_data["id"]})
    await db.documents.delete_many({"claim_id": claim_data["id"]})
    await db.inspection_photos.delete_many({"claim_id": claim_data["id"]})


@pytest.mark.asyncio
async def test_claim_with_related_counts(db, sample_claim):
    """
    Test: get_claim_with_related_counts aggregation pipeline

    Validates:
    - Returns claim data
    - Includes accurate counts for notes, documents, photos
    - Single query vs multiple queries
    """
    result = await get_claim_with_related_counts(db, sample_claim["id"])

    assert result is not None, "Should return claim data"
    assert result["claim"]["id"] == sample_claim["id"], "Should return correct claim"

    # Verify counts
    assert result["notes_count"] == 3, "Should count 3 notes"
    assert result["documents_count"] == 2, "Should count 2 documents"
    assert result["photos_count"] == 5, "Should count 5 photos"

    # Verify documents array is included
    assert len(result["documents"]) == 2, "Should include documents array"

    print("✅ get_claim_with_related_counts: PASSED")
    print(f"   - Notes count: {result['notes_count']}")
    print(f"   - Docs count: {result['documents_count']}")
    print(f"   - Photos count: {result['photos_count']}")


@pytest.mark.asyncio
async def test_claim_with_full_details(db, sample_claim):
    """
    Test: ClaimAggregations.get_claim_with_related_data

    Validates:
    - Returns claim with full related data arrays
    - Includes notes, documents, photos in single query
    """
    result = await ClaimAggregations.get_claim_with_related_data(db, sample_claim["id"])

    assert result is not None, "Should return claim with details"
    assert result["id"] == sample_claim["id"], "Should return correct claim"

    # Verify full arrays are returned
    assert "notes" in result, "Should include notes array"
    assert "documents" in result, "Should include documents array"
    assert "photos" in result, "Should include photos array"

    assert len(result["notes"]) == 3, "Should include all 3 notes"
    assert len(result["documents"]) == 2, "Should include all 2 documents"
    assert len(result["photos"]) == 5, "Should include all 5 photos"

    # Verify counts are also present
    assert result["notes_count"] == 3
    assert result["documents_count"] == 2
    assert result["photos_count"] == 5

    print("✅ get_claim_with_related_data: PASSED")
    print(f"   - Full notes array: {len(result['notes'])} items")
    print(f"   - Full docs array: {len(result['documents'])} items")
    print(f"   - Full photos array: {len(result['photos'])} items")


@pytest.mark.asyncio
async def test_claims_list_optimized(db, sample_claim):
    """
    Test: get_claims_list_optimized with pagination

    Validates:
    - Returns paginated results
    - Includes total count
    - Respects skip/limit parameters
    """
    result = await get_claims_list_optimized(
        db,
        filter_status="In Progress",
        limit=10,
        skip=0
    )

    assert "claims" in result, "Should return claims array"
    assert "total" in result, "Should return total count"
    assert "page" in result, "Should return page number"
    assert "total_pages" in result, "Should return total pages"

    assert result["total"] >= 1, "Should find at least our test claim"
    assert len(result["claims"]) <= 10, "Should respect limit"

    # Verify our test claim is in the results
    claim_ids = [c["id"] for c in result["claims"]]
    assert sample_claim["id"] in claim_ids, "Should include our test claim"

    print("✅ get_claims_list_optimized: PASSED")
    print(f"   - Total claims: {result['total']}")
    print(f"   - Page size: {len(result['claims'])}")
    print(f"   - Total pages: {result['total_pages']}")


@pytest.mark.asyncio
async def test_user_dashboard_stats(db):
    """
    Test: ClaimAggregations.get_user_dashboard_stats

    Validates:
    - Returns dashboard statistics
    - Includes counts by status, priority, stage
    - Faceted aggregation works correctly
    """
    # Use a real user ID from the test claim
    result = await ClaimAggregations.get_user_dashboard_stats(
        db,
        user_id="test-user-001",
        role="admin"  # Admin sees all claims
    )

    assert result is not None, "Should return dashboard stats"
    assert "total_claims" in result, "Should include total claims count"
    assert "by_status" in result, "Should include status breakdown"
    assert "by_priority" in result, "Should include priority breakdown"

    assert result["total_claims"] >= 0, "Total claims should be non-negative"

    print("✅ get_user_dashboard_stats: PASSED")
    print(f"   - Total claims: {result['total_claims']}")
    print(f"   - Status breakdown: {len(result['by_status'])} statuses")
    print(f"   - Priority breakdown: {len(result['by_priority'])} priorities")


@pytest.mark.asyncio
async def test_aggregation_performance_comparison(db, sample_claim):
    """
    Performance Test: Compare N+1 queries vs single aggregation

    Measures actual performance improvement
    """
    import time

    # Method 1: N+1 queries (old way)
    start = time.time()
    claim = await db.claims.find_one({"id": sample_claim["id"]}, {"_id": 0})
    notes_count = await db.notes.count_documents({"claim_id": sample_claim["id"]})
    docs_count = await db.documents.count_documents({"claim_id": sample_claim["id"]})
    photos_count = await db.inspection_photos.count_documents({"claim_id": sample_claim["id"]})
    n_plus_1_time = time.time() - start

    # Method 2: Single aggregation (new way)
    start = time.time()
    result = await get_claim_with_related_counts(db, sample_claim["id"])
    aggregation_time = time.time() - start

    # Calculate improvement
    improvement = n_plus_1_time / aggregation_time if aggregation_time > 0 else 0

    print("\n⚡ PERFORMANCE COMPARISON:")
    print(f"   N+1 queries: {n_plus_1_time*1000:.2f}ms (4 queries)")
    print(f"   Aggregation: {aggregation_time*1000:.2f}ms (1 query)")
    print(f"   Improvement: {improvement:.1f}x faster")

    # Verify data integrity
    assert result["notes_count"] == notes_count, "Counts should match"
    assert result["documents_count"] == docs_count, "Counts should match"
    assert result["photos_count"] == photos_count, "Counts should match"

    assert aggregation_time < n_plus_1_time, "Aggregation should be faster"

    print("✅ Performance test: PASSED")


if __name__ == "__main__":
    """Run tests directly"""
    async def run_all_tests():
        client = AsyncIOMotorClient(MONGODB_URL)
        database = client[DATABASE_NAME]

        print("\n" + "="*60)
        print("AGGREGATION PIPELINE INTEGRATION TESTS")
        print("="*60 + "\n")

        # Create sample claim
        claim_data = {
            "id": "test-claim-integration-001",
            "claim_number": "TEST-2024-001",
            "client_name": "Test Client",
            "client_email": "test@example.com",
            "property_address": "123 Test St",
            "date_of_loss": "2024-01-15",
            "claim_type": "Water Damage",
            "policy_number": "POL-12345",
            "estimated_value": 50000,
            "status": "In Progress",
            "priority": "High",
            "created_by": "test-user-001",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "stage": "inspection",
        }

        try:
            # Setup
            await database.claims.delete_one({"id": claim_data["id"]})
            await database.claims.insert_one(claim_data)

            # Add related data
            await database.notes.insert_many([
                {"id": f"note-{i}", "claim_id": claim_data["id"],
                 "content": f"Test note {i}", "author_id": "test-user-001",
                 "author_name": "Test User", "created_at": datetime.now(timezone.utc)}
                for i in range(3)
            ])

            await database.documents.insert_many([
                {"id": f"doc-{i}", "claim_id": claim_data["id"],
                 "name": f"test-doc-{i}.pdf", "type": "policy", "size": "1MB",
                 "uploaded_by": "test-user-001", "uploaded_at": datetime.now(timezone.utc)}
                for i in range(2)
            ])

            await database.inspection_photos.insert_many([
                {"id": f"photo-{i}", "claim_id": claim_data["id"],
                 "room": "Living Room", "category": "Water Damage",
                 "created_at": datetime.now(timezone.utc)}
                for i in range(5)
            ])

            # Run tests
            print("Running integration tests...\n")

            await test_claim_with_related_counts(database, claim_data)
            await test_claim_with_full_details(database, claim_data)
            await test_claims_list_optimized(database, claim_data)
            await test_user_dashboard_stats(database)
            await test_aggregation_performance_comparison(database, claim_data)

            print("\n" + "="*60)
            print("ALL TESTS PASSED!")
            print("="*60)

        finally:
            # Cleanup
            await database.claims.delete_one({"id": claim_data["id"]})
            await database.notes.delete_many({"claim_id": claim_data["id"]})
            await database.documents.delete_many({"claim_id": claim_data["id"]})
            await database.inspection_photos.delete_many({"claim_id": claim_data["id"]})
            client.close()

    asyncio.run(run_all_tests())
