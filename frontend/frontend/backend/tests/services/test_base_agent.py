"""
Tests for ClaimPilot Pydantic models and AuditLogger.
"""

import pytest
from pydantic import ValidationError

from models import AgentInsight, AgentResult, PendingAction
from services.claimpilot.audit_logger import AuditLogger


# ------------------------------------------------------------------
# AgentInsight
# ------------------------------------------------------------------

class TestAgentInsight:
    def test_creation_with_valid_data(self):
        insight = AgentInsight(
            agent_name="weather_agent",
            claim_id="claim-001",
            insight_type="weather_correlation",
            summary="Storm confirmed on date of loss",
            confidence=0.92,
        )
        assert insight.agent_name == "weather_agent"
        assert insight.claim_id == "claim-001"
        assert insight.insight_type == "weather_correlation"
        assert insight.confidence == 0.92
        assert insight.details == {}
        assert insight.id  # auto-generated

    def test_rejects_confidence_above_one(self):
        with pytest.raises(ValidationError):
            AgentInsight(
                agent_name="agent",
                claim_id="c1",
                insight_type="t",
                summary="s",
                confidence=1.5,
            )

    def test_rejects_negative_confidence(self):
        with pytest.raises(ValidationError):
            AgentInsight(
                agent_name="agent",
                claim_id="c1",
                insight_type="t",
                summary="s",
                confidence=-0.1,
            )


# ------------------------------------------------------------------
# AgentResult
# ------------------------------------------------------------------

class TestAgentResult:
    def test_creation_with_valid_data(self):
        result = AgentResult(
            agent_name="damage_estimator",
            claim_id="claim-002",
            insight_type="estimate_review",
            summary="Estimate matches market rates",
            confidence=0.85,
            suggested_actions=["approve_estimate"],
        )
        assert result.agent_name == "damage_estimator"
        assert result.confidence == 0.85
        assert result.suggested_actions == ["approve_estimate"]
        assert result.requires_approval is False
        assert result.id

    def test_rejects_confidence_above_one(self):
        with pytest.raises(ValidationError):
            AgentResult(
                agent_name="agent",
                claim_id="c1",
                insight_type="t",
                summary="s",
                confidence=1.01,
            )

    def test_defaults(self):
        result = AgentResult(
            agent_name="a",
            claim_id="c",
            insight_type="t",
            summary="s",
            confidence=0.5,
        )
        assert result.suggested_actions == []
        assert result.requires_approval is False
        assert result.details == {}


# ------------------------------------------------------------------
# PendingAction
# ------------------------------------------------------------------

class TestPendingAction:
    def test_defaults_to_pending_status(self):
        action = PendingAction(
            agent_name="settlement_agent",
            claim_id="claim-003",
            action_type="approve_settlement",
            confidence=0.78,
        )
        assert action.status == "pending"
        assert action.reviewed_by is None
        assert action.reviewed_at is None
        assert action.reject_reason is None
        assert action.expires_at is None
        assert action.reasoning == ""

    def test_rejects_invalid_confidence(self):
        with pytest.raises(ValidationError):
            PendingAction(
                agent_name="a",
                claim_id="c",
                action_type="t",
                confidence=2.0,
            )


# ------------------------------------------------------------------
# AuditLogger
# ------------------------------------------------------------------

class TestAuditLogger:
    @pytest.mark.asyncio
    async def test_logs_successful_execution(self, mock_db):
        logger = AuditLogger(mock_db)
        audit_id = await logger.log_execution(
            agent_name="weather_agent",
            claim_id="claim-100",
            input_summary="Check weather for 2025-01-15",
            output_summary="Storm confirmed",
            confidence=0.95,
            duration_ms=320,
            status="success",
            user_id="user-001",
        )

        assert audit_id
        doc = await mock_db.claimpilot_audit.find_one({"audit_id": audit_id})
        assert doc is not None
        assert doc["agent_name"] == "weather_agent"
        assert doc["claim_id"] == "claim-100"
        assert doc["status"] == "success"
        assert doc["confidence"] == 0.95
        assert doc["duration_ms"] == 320
        assert doc["error_message"] is None
        assert doc["user_id"] == "user-001"
        assert doc["created_at"] is not None

    @pytest.mark.asyncio
    async def test_logs_failed_execution_with_error(self, mock_db):
        logger = AuditLogger(mock_db)
        audit_id = await logger.log_execution(
            agent_name="damage_estimator",
            claim_id="claim-200",
            input_summary="Estimate review",
            output_summary="",
            confidence=0.0,
            duration_ms=50,
            status="error",
            error_message="API timeout after 30s",
        )

        assert audit_id
        doc = await mock_db.claimpilot_audit.find_one({"audit_id": audit_id})
        assert doc is not None
        assert doc["status"] == "error"
        assert doc["error_message"] == "API timeout after 30s"
        assert doc["user_id"] is None
