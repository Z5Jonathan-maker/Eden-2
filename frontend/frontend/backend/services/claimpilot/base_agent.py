"""
Abstract base class for all ClaimPilot agents.

Provides guardrails, audit logging, retry logic, and frozen-claim detection.
Every concrete agent inherits from BaseAgent and implements execute() + validate_output().
"""

import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

from models import AgentResult
from services.ai_service import flag_sensitive_content, strip_legal_promises
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.audit_logger import AuditLogger

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base for all ClaimPilot agents."""

    agent_name: str = "unnamed_agent"
    requires_approval: bool = False
    llm_provider: str = "gemini_flash"
    max_retries: int = 2
    timeout_seconds: int = 30

    def __init__(self, db) -> None:
        self._db = db
        self.audit = AuditLogger(db)

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult:
        """Run the agent's core logic. Subclasses must implement."""

    @abstractmethod
    async def validate_output(self, result: AgentResult) -> bool:
        """Return True if the result passes quality checks."""

    async def run(self, context: AgentContext) -> Optional[AgentResult]:
        """Execute with guardrails, retries, and audit logging.

        1. Block frozen claims
        2. Retry up to max_retries + 1 attempts
        3. Apply guardrails (strip legal promises, flag sensitive content)
        4. Validate output
        5. Audit-log and store insight on success
        """
        claim_id = context.claim.get("id", "unknown")

        # --- Frozen-claim gate ---
        if context.is_frozen:
            logger.info(
                "agent=%s claim=%s SKIPPED (frozen)",
                self.agent_name,
                claim_id,
            )
            return None

        # --- Retry loop ---
        attempts = self.max_retries + 1
        for attempt in range(1, attempts + 1):
            start = time.monotonic()
            try:
                result = await self.execute(context)

                # --- Guardrails ---
                cleaned_summary, legal_warnings = strip_legal_promises(result.summary)
                sensitive_warnings = flag_sensitive_content(cleaned_summary)

                all_warnings = legal_warnings + sensitive_warnings
                if all_warnings:
                    logger.warning(
                        "agent=%s claim=%s guardrail_warnings=%s",
                        self.agent_name,
                        claim_id,
                        all_warnings,
                    )

                # Build cleaned result (immutable — new object)
                result = AgentResult(
                    agent_name=result.agent_name,
                    claim_id=result.claim_id,
                    insight_type=result.insight_type,
                    summary=cleaned_summary,
                    details=result.details,
                    confidence=result.confidence,
                    suggested_actions=result.suggested_actions,
                    requires_approval=result.requires_approval,
                )

                # --- Validation ---
                if not await self.validate_output(result):
                    logger.warning(
                        "agent=%s claim=%s attempt=%d/%d validation_failed",
                        self.agent_name,
                        claim_id,
                        attempt,
                        attempts,
                    )
                    continue

                duration_ms = int((time.monotonic() - start) * 1000)

                # --- Audit log ---
                await self.audit.log_execution(
                    agent_name=self.agent_name,
                    claim_id=claim_id,
                    input_summary=f"context for {claim_id}",
                    output_summary=result.summary[:500],
                    confidence=result.confidence,
                    duration_ms=duration_ms,
                    status="success",
                )

                # --- Store insight ---
                insight_doc = {
                    "agent_name": self.agent_name,
                    "claim_id": claim_id,
                    "insight_type": result.insight_type,
                    "summary": result.summary,
                    "details": result.details,
                    "confidence": result.confidence,
                    "created_at": result.created_at.isoformat(),
                }
                await self._db.claimpilot_insights.insert_one(insight_doc)

                return result

            except Exception:
                duration_ms = int((time.monotonic() - start) * 1000)
                logger.exception(
                    "agent=%s claim=%s attempt=%d/%d error",
                    self.agent_name,
                    claim_id,
                    attempt,
                    attempts,
                )
                if attempt == attempts:
                    await self.audit.log_execution(
                        agent_name=self.agent_name,
                        claim_id=claim_id,
                        input_summary=f"context for {claim_id}",
                        output_summary="",
                        confidence=0.0,
                        duration_ms=duration_ms,
                        status="error",
                        error_message="All retries exhausted",
                    )

        # All retries failed (validation failures, not exceptions)
        await self.audit.log_execution(
            agent_name=self.agent_name,
            claim_id=claim_id,
            input_summary=f"context for {claim_id}",
            output_summary="",
            confidence=0.0,
            duration_ms=0,
            status="error",
            error_message="All retries exhausted — validation failed",
        )
        return None
