"""Tests for the ClaimPilot AgentOrchestrator."""

import os

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

import pytest

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.orchestrator import (
    AgentOrchestrator,
    get_orchestrator,
    init_orchestrator,
)


# ---------------------------------------------------------------------------
# SpyAgent — concrete BaseAgent for testing
# ---------------------------------------------------------------------------


class SpyAgent(BaseAgent):
    """Minimal concrete agent that records calls for assertion."""

    agent_name: str = "spy_agent"
    requires_approval: bool = False

    def __init__(self, db) -> None:
        super().__init__(db)
        self.calls: list[AgentContext] = []

    async def execute(self, context: AgentContext) -> AgentResult:
        self.calls.append(context)
        return AgentResult(
            agent_name=self.agent_name,
            claim_id=context.claim.get("id", "unknown"),
            insight_type="test_insight",
            summary="Spy agent executed successfully.",
            confidence=0.95,
        )

    async def validate_output(self, result: AgentResult) -> bool:
        return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_claim(mock_db, claim_id: str = "claim-abc-123") -> None:
    """Insert a minimal claim document so the context builder can find it."""
    await mock_db.claims.insert_one(
        {
            "id": claim_id,
            "claim_number": "CLM-TEST-001",
            "client_name": "Test Client",
            "property_address": "1 Test Ave",
            "status": "open",
        }
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestOrchestratorRegistration:
    def test_orchestrator_registers_agent(self, mock_db):
        """Register a mock agent and verify it appears in agents dict."""
        orchestrator = AgentOrchestrator(mock_db)
        agent = SpyAgent(mock_db)

        orchestrator.register("spy_agent", agent)

        assert "spy_agent" in orchestrator.agents
        assert orchestrator.agents["spy_agent"] is agent


class TestOrchestratorRouting:
    @pytest.mark.asyncio
    async def test_orchestrator_routes_event_to_agent(self, mock_db):
        """Map an event to an agent, fire the event, verify the agent ran."""
        await _seed_claim(mock_db)

        orchestrator = AgentOrchestrator(mock_db)
        spy = SpyAgent(mock_db)
        orchestrator.register("spy_agent", spy)
        orchestrator.add_event_mapping("claim.created", ["spy_agent"])

        results = await orchestrator.handle_event("claim.created", "claim-abc-123")

        assert len(results) == 1
        assert results[0].agent_name == "spy_agent"
        assert results[0].insight_type == "test_insight"
        assert len(spy.calls) == 1
        assert spy.calls[0].claim["id"] == "claim-abc-123"

    @pytest.mark.asyncio
    async def test_orchestrator_skips_unknown_events(self, mock_db):
        """Handling an unmapped event returns an empty list."""
        orchestrator = AgentOrchestrator(mock_db)

        results = await orchestrator.handle_event("totally.unknown", "claim-abc-123")

        assert results == []


class TestOrchestratorRunAgent:
    @pytest.mark.asyncio
    async def test_run_agent_raises_for_unknown(self, mock_db):
        """run_agent raises ValueError for unregistered agents."""
        orchestrator = AgentOrchestrator(mock_db)

        with pytest.raises(ValueError, match="Agent not registered"):
            await orchestrator.run_agent("ghost_agent", "claim-abc-123")


class TestModuleSingleton:
    def test_get_orchestrator_raises_before_init(self):
        """get_orchestrator raises RuntimeError if not initialized."""
        # Reset module-level singleton
        import services.claimpilot.orchestrator as mod

        mod._orchestrator = None

        with pytest.raises(RuntimeError, match="not initialized"):
            get_orchestrator()

    def test_init_orchestrator_creates_instance(self, mock_db):
        """init_orchestrator creates and returns the singleton."""
        import services.claimpilot.orchestrator as mod

        mod._orchestrator = None

        orch = init_orchestrator(mock_db)

        assert orch is get_orchestrator()
        assert len(orch.event_map) > 0

        # Cleanup
        mod._orchestrator = None
