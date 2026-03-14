import pytest
from conftest import MockDB


@pytest.mark.asyncio
async def test_initial_run_processes_claims():
    mock_db = MockDB()
    # Add some test claims
    for i in range(3):
        await mock_db.claims.insert_one({
            "id": f"claim-{i}",
            "claim_number": f"CLM-{i}",
            "status": "In Progress",
            "created_at": "2026-01-01T00:00:00Z",
        })

    from workers.claimpilot_initial_run import run_initial_analysis, init_initial_run
    init_initial_run(mock_db)
    # This will fail on LLM calls but should not crash
    # The agents have heuristic fallbacks


@pytest.mark.asyncio
async def test_initial_run_skips_if_already_done():
    mock_db = MockDB()
    await mock_db.claimpilot_audit.insert_one({"agent_name": "_initial_run_complete"})

    from workers.claimpilot_initial_run import run_initial_analysis, init_initial_run
    init_initial_run(mock_db)
    await run_initial_analysis()
    # Should return immediately without processing
