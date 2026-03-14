"""
Agent Orchestrator for ClaimPilot.

Routes domain events to registered agents, manages the agent lifecycle,
and submits actions requiring approval through the ApprovalGate.
"""

import logging
from typing import Optional

from models import AgentResult, PendingAction
from services.claimpilot.agent_context import AgentContextBuilder
from services.claimpilot.approval_gate import ApprovalGate
from services.claimpilot.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# Default event-to-agent mappings
DEFAULT_EVENT_MAPPINGS = {
    "ClaimCreated": ["claim_monitor", "intake_parser", "evidence_scorer", "statute_matcher", "predictive_analytics"],
    "ClaimUpdated": ["claim_monitor", "evidence_scorer", "statute_matcher", "predictive_analytics"],
    "ClaimArchived": [],
    "ClaimRestored": ["claim_monitor"],
    "PhotoUploaded": ["vision_analyzer", "evidence_scorer"],
    "EvidenceIngested": ["evidence_scorer", "estimate_engine"],
    "CarrierResponseReceived": ["negotiation_copilot", "statute_matcher"],
    "StageTransition": ["claim_monitor", "predictive_analytics", "statute_matcher"],
    "EstimateRequested": ["estimate_engine"],
}


class AgentOrchestrator:
    """Central router that dispatches domain events to registered agents."""

    def __init__(self, db) -> None:
        self._db = db
        self.agents: dict[str, BaseAgent] = {}
        self.event_map: dict[str, list[str]] = {}
        self.context_builder = AgentContextBuilder(db)
        self._approval_gate = ApprovalGate(db)

    def register(self, name: str, agent: BaseAgent) -> None:
        """Register an agent instance by name."""
        self.agents[name] = agent
        logger.info("orchestrator | registered agent=%s", name)

    def add_event_mapping(self, event_type: str, agent_names: list[str]) -> None:
        """Map a domain event type to a list of agent names."""
        self.event_map[event_type] = agent_names

    async def handle_event(
        self,
        event_type: str,
        claim_id: str,
        details: Optional[dict] = None,
    ) -> list[AgentResult]:
        """Route a domain event to all mapped agents.

        Returns a list of AgentResult objects (one per agent that produced output).
        """
        agent_names = self.event_map.get(event_type)
        if not agent_names:
            logger.debug("orchestrator | no agents mapped for event=%s", event_type)
            return []

        try:
            context = await self.context_builder.build(claim_id)
        except ValueError:
            logger.warning(
                "orchestrator | claim not found claim_id=%s event=%s",
                claim_id,
                event_type,
            )
            return []

        results: list[AgentResult] = []
        for name in agent_names:
            agent = self.agents.get(name)
            if agent is None:
                logger.warning("orchestrator | agent not registered name=%s", name)
                continue

            result = await agent.run(context)
            if result is None:
                continue

            # Submit actions requiring approval through the gate
            if agent.requires_approval and result.suggested_actions:
                for action_desc in result.suggested_actions:
                    pending = PendingAction(
                        agent_name=agent.agent_name,
                        claim_id=claim_id,
                        action_type=action_desc,
                        confidence=result.confidence,
                        reasoning=result.summary,
                    )
                    await self._approval_gate.submit(pending)

            results.append(result)

        return results

    async def run_agent(self, agent_name: str, claim_id: str) -> Optional[AgentResult]:
        """Manually trigger a specific agent by name.

        Raises:
            ValueError: If agent_name is not registered.
        """
        agent = self.agents.get(agent_name)
        if agent is None:
            raise ValueError(f"Agent not registered: {agent_name}")

        context = await self.context_builder.build(claim_id)
        return await agent.run(context)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_orchestrator: Optional[AgentOrchestrator] = None


def init_orchestrator(db) -> AgentOrchestrator:
    """Create and configure the global AgentOrchestrator singleton."""
    global _orchestrator  # noqa: PLW0603
    _orchestrator = AgentOrchestrator(db)

    # Register agents
    from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent
    from services.claimpilot.agents.vision_analyzer import VisionAnalyzerAgent
    from services.claimpilot.agents.intake_parser import IntakeParserAgent
    from services.claimpilot.agents.evidence_scorer import EvidenceScorerAgent
    from services.claimpilot.agents.negotiation_copilot import NegotiationCopilotAgent
    from services.claimpilot.agents.statute_matcher import StatuteMatcherAgent
    from services.claimpilot.agents.predictive_analytics import PredictiveAnalyticsAgent
    from services.claimpilot.agents.estimate_engine import EstimateEngineAgent

    _orchestrator.register("claim_monitor", ClaimMonitorAgent(db))
    _orchestrator.register("vision_analyzer", VisionAnalyzerAgent(db))
    _orchestrator.register("intake_parser", IntakeParserAgent(db))
    _orchestrator.register("evidence_scorer", EvidenceScorerAgent(db))
    _orchestrator.register("negotiation_copilot", NegotiationCopilotAgent(db))
    _orchestrator.register("statute_matcher", StatuteMatcherAgent(db))
    _orchestrator.register("predictive_analytics", PredictiveAnalyticsAgent(db))
    _orchestrator.register("estimate_engine", EstimateEngineAgent(db))

    # Register default event mappings
    for event_type, agent_names in DEFAULT_EVENT_MAPPINGS.items():
        _orchestrator.add_event_mapping(event_type, agent_names)

    logger.info(
        "orchestrator | initialized with %d agents, %d event mappings",
        len(_orchestrator.agents),
        len(DEFAULT_EVENT_MAPPINGS),
    )
    return _orchestrator


def get_orchestrator() -> AgentOrchestrator:
    """Return the global orchestrator instance.

    Raises:
        RuntimeError: If init_orchestrator() has not been called.
    """
    if _orchestrator is None:
        raise RuntimeError("Orchestrator not initialized — call init_orchestrator(db) first")
    return _orchestrator
