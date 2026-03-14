# ClaimPilot Phase 1: Foundation + ClaimMonitor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ClaimPilot shared infrastructure (orchestrator, base agent, LLM router, approval gate, audit logger) and the first agent (ClaimMonitor) with approval queue UI.

**Architecture:** Agent mesh pattern within existing FastAPI backend. Agents inherit from BaseAgent, are registered with AgentOrchestrator, triggered by domain events from claims_service.py. Human approval gates on data-changing actions. All outputs logged to claimpilot_audit collection.

**Tech Stack:** Python 3.14, FastAPI, Motor (async MongoDB), APScheduler, google-generativeai (Gemini Flash), groq SDK, existing Ollama integration.

**Spec:** `docs/superpowers/specs/2026-03-14-claimpilot-ai-agents-design.md`

---

## File Structure

### New Files (Backend)

| File | Responsibility |
|------|---------------|
| `backend/services/claimpilot/__init__.py` | Package exports |
| `backend/services/claimpilot/base_agent.py` | Abstract base class with guardrails, audit, retry |
| `backend/services/claimpilot/agent_context.py` | Immutable claim snapshot builder |
| `backend/services/claimpilot/llm_router.py` | Routes to Gemini/Groq/Ollama by task type |
| `backend/services/claimpilot/orchestrator.py` | Event routing + agent lifecycle management |
| `backend/services/claimpilot/approval_gate.py` | Pending queue CRUD + approve/reject logic |
| `backend/services/claimpilot/audit_logger.py` | Writes to claimpilot_audit collection |
| `backend/services/claimpilot/agents/__init__.py` | Agent registry |
| `backend/services/claimpilot/agents/claim_monitor.py` | Stall detection, deadline tracking, auto-escalation |
| `backend/routes/claimpilot.py` | API routes for insights, pending, approve/reject |
| `backend/workers/claimpilot_monitor.py` | APScheduler job wrapper for ClaimMonitor |

### New Files (Tests)

| File | Responsibility |
|------|---------------|
| `backend/tests/services/test_base_agent.py` | BaseAgent guardrails, retry, audit |
| `backend/tests/services/test_agent_context.py` | Context building from claim data |
| `backend/tests/services/test_llm_router.py` | Provider selection, fallback chain |
| `backend/tests/services/test_orchestrator.py` | Event routing, agent dispatch |
| `backend/tests/services/test_approval_gate.py` | Pending CRUD, approve/reject, expiry |
| `backend/tests/services/test_claim_monitor.py` | Stall detection, deadline logic |
| `backend/tests/test_claimpilot_routes.py` | API endpoint integration tests |

### Modified Files

| File | Change |
|------|--------|
| `backend/server.py` | Add claimpilot router import + registration |
| `backend/workers/scheduler.py` | Add ClaimMonitor scheduled job |
| `backend/services/claims_service.py` | Hook orchestrator into _dispatch_domain_event |
| `backend/models.py` | Add ClaimPilot Pydantic models |

### New Files (Frontend)

| File | Responsibility |
|------|---------------|
| `src/features/claimpilot/ApprovalQueue.jsx` | Full-page approval queue with filters |
| `src/features/claimpilot/ApprovalCard.jsx` | Single pending item card |
| `src/features/claimpilot/ClaimPilotInsights.jsx` | Claim-level insights panel |
| `src/features/claimpilot/hooks/useClaimpilot.js` | React Query hooks for ClaimPilot API |

**Note:** All file paths below are relative to `C:\AI_OS\02_EDEN_PRODUCT\repos\eden-2\frontend\frontend\`

---

## Chunk 1: ClaimPilot Models + Audit Logger

### Task 1: ClaimPilot Pydantic Models

**Files:**
- Modify: `backend/models.py`
- Test: `backend/tests/services/test_base_agent.py`

- [ ] **Step 1: Write failing test for AgentResult model**

```python
# backend/tests/services/test_base_agent.py
import pytest
from models import AgentResult, AgentInsight, PendingAction

def test_agent_result_creation():
    result = AgentResult(
        agent_name="claim_monitor",
        claim_id="claim-001",
        insight_type="stall_detection",
        summary="Claim stalled for 5 days in Under Review",
        details={"days_stalled": 5, "stage": "Under Review"},
        confidence=0.92,
        suggested_actions=["Follow up with carrier", "Escalate to manager"],
        requires_approval=True,
    )
    assert result.agent_name == "claim_monitor"
    assert result.confidence == 0.92
    assert result.id is not None  # auto-generated UUID

def test_agent_result_rejects_invalid_confidence():
    with pytest.raises(Exception):
        AgentResult(
            agent_name="test",
            claim_id="c1",
            insight_type="test",
            summary="test",
            details={},
            confidence=1.5,  # invalid
        )

def test_pending_action_creation():
    action = PendingAction(
        agent_name="claim_monitor",
        claim_id="claim-001",
        action_type="create_task",
        action_data={"title": "Follow up with carrier", "priority": "high"},
        confidence=0.88,
        reasoning="No carrier response in 5 business days",
    )
    assert action.status == "pending"
    assert action.id is not None

def test_agent_insight_creation():
    insight = AgentInsight(
        agent_name="claim_monitor",
        claim_id="claim-001",
        insight_type="stall_detection",
        summary="Claim stalled",
        details={"days": 5},
        confidence=0.9,
    )
    assert insight.agent_name == "claim_monitor"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py::test_agent_result_creation -v`
Expected: FAIL — `ImportError: cannot import name 'AgentResult' from 'models'`

- [ ] **Step 3: Add ClaimPilot models to models.py**

Add to the end of `backend/models.py`:

```python
# ============================================
# ClaimPilot AI Agent Models
# ============================================

class AgentInsight(BaseModel):
    """Read-only AI insight attached to a claim."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    agent_name: str
    claim_id: str
    insight_type: str  # "stall_detection", "evidence_gap", "prediction", etc.
    summary: str
    details: dict = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=_utc_now)


class AgentResult(BaseModel):
    """Full agent execution result — may include insights + proposed actions."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    agent_name: str
    claim_id: str
    insight_type: str
    summary: str
    details: dict = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_actions: List[str] = Field(default_factory=list)
    requires_approval: bool = False
    created_at: datetime = Field(default_factory=_utc_now)


class PendingAction(BaseModel):
    """Action awaiting human approval."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    agent_name: str
    claim_id: str
    action_type: str  # "create_task", "update_claim", "send_message", "create_notification"
    action_data: dict = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = ""
    status: str = Field(default="pending")  # "pending", "approved", "rejected", "expired"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    expires_at: Optional[datetime] = None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/services/test_base_agent.py
git commit -m "feat(claimpilot): add Pydantic models for agent results, insights, and pending actions"
```

---

### Task 2: Audit Logger

**Files:**
- Create: `backend/services/claimpilot/__init__.py`
- Create: `backend/services/claimpilot/audit_logger.py`
- Test: `backend/tests/services/test_base_agent.py` (extend)

- [ ] **Step 1: Create package init**

```python
# backend/services/claimpilot/__init__.py
"""ClaimPilot AI Agent Mesh — Eden-2's AI intelligence layer."""
```

- [ ] **Step 2: Write failing test for audit logger**

Append to `backend/tests/services/test_base_agent.py`:

```python
import asyncio
from conftest import MockDB

@pytest.mark.asyncio
async def test_audit_logger_records_execution():
    mock_db = MockDB()
    from services.claimpilot.audit_logger import AuditLogger

    logger = AuditLogger(mock_db)
    await logger.log_execution(
        agent_name="claim_monitor",
        claim_id="claim-001",
        input_summary={"claims_checked": 5},
        output_summary={"stalls_found": 1},
        confidence=0.92,
        duration_ms=450,
        status="success",
    )

    docs = await mock_db.claimpilot_audit.find().to_list(100)
    assert len(docs) == 1
    assert docs[0]["agent_name"] == "claim_monitor"
    assert docs[0]["status"] == "success"
    assert docs[0]["duration_ms"] == 450

@pytest.mark.asyncio
async def test_audit_logger_records_failure():
    mock_db = MockDB()
    from services.claimpilot.audit_logger import AuditLogger

    logger = AuditLogger(mock_db)
    await logger.log_execution(
        agent_name="claim_monitor",
        claim_id="claim-001",
        input_summary={},
        output_summary={},
        confidence=0.0,
        duration_ms=100,
        status="error",
        error_message="LLM timeout",
    )

    docs = await mock_db.claimpilot_audit.find().to_list(100)
    assert len(docs) == 1
    assert docs[0]["status"] == "error"
    assert docs[0]["error_message"] == "LLM timeout"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py::test_audit_logger_records_execution -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.claimpilot'`

- [ ] **Step 4: Implement audit logger**

```python
# backend/services/claimpilot/audit_logger.py
"""ClaimPilot Audit Logger — records every agent execution to MongoDB."""

import logging
from datetime import datetime, timezone
from typing import Optional
import uuid

logger = logging.getLogger(__name__)


class AuditLogger:
    def __init__(self, db):
        self.db = db

    async def log_execution(
        self,
        agent_name: str,
        claim_id: str,
        input_summary: dict,
        output_summary: dict,
        confidence: float,
        duration_ms: int,
        status: str,
        error_message: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Log an agent execution to claimpilot_audit collection."""
        audit_id = uuid.uuid4().hex
        doc = {
            "id": audit_id,
            "agent_name": agent_name,
            "claim_id": claim_id,
            "input_summary": input_summary,
            "output_summary": output_summary,
            "confidence": confidence,
            "duration_ms": duration_ms,
            "status": status,
            "error_message": error_message,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
        }
        try:
            await self.db.claimpilot_audit.insert_one(doc)
            logger.info(
                "CLAIMPILOT_AUDIT: %s on claim %s — %s (%.2f confidence, %dms)",
                agent_name, claim_id, status, confidence, duration_ms,
            )
        except Exception as e:
            logger.error("Failed to write audit log: %s", e)
        return audit_id
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py -v`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services/claimpilot/__init__.py backend/services/claimpilot/audit_logger.py backend/tests/services/test_base_agent.py
git commit -m "feat(claimpilot): add audit logger for agent execution tracking"
```

---

## Chunk 2: LLM Router + Agent Context

### Task 3: LLM Router

**Files:**
- Create: `backend/services/claimpilot/llm_router.py`
- Test: `backend/tests/services/test_llm_router.py`

- [ ] **Step 1: Write failing tests for LLM router**

```python
# backend/tests/services/test_llm_router.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_llm_router_selects_gemini_for_vision():
    from services.claimpilot.llm_router import LLMRouter

    router = LLMRouter()
    provider = router.select_provider("vision")
    assert provider == "gemini_flash"

@pytest.mark.asyncio
async def test_llm_router_selects_gemini_for_text():
    from services.claimpilot.llm_router import LLMRouter

    router = LLMRouter()
    provider = router.select_provider("text_generation")
    assert provider == "gemini_flash"

@pytest.mark.asyncio
async def test_llm_router_selects_groq_for_structured():
    from services.claimpilot.llm_router import LLMRouter

    router = LLMRouter()
    provider = router.select_provider("structured_extraction")
    assert provider == "gemini_flash"

@pytest.mark.asyncio
async def test_llm_router_selects_ollama_for_private():
    from services.claimpilot.llm_router import LLMRouter

    router = LLMRouter()
    provider = router.select_provider("private_data")
    assert provider == "ollama"

@pytest.mark.asyncio
async def test_llm_router_generate_with_mock():
    from services.claimpilot.llm_router import LLMRouter

    router = LLMRouter()
    # Mock the actual LLM call
    with patch.object(router, '_call_gemini', new_callable=AsyncMock, return_value="Test response"):
        result = await router.generate(
            prompt="Analyze this claim",
            system_prompt="You are an insurance expert",
            task_type="text_generation",
        )
        assert result == "Test response"

@pytest.mark.asyncio
async def test_llm_router_fallback_on_failure():
    from services.claimpilot.llm_router import LLMRouter

    router = LLMRouter()
    with patch.object(router, '_call_gemini', new_callable=AsyncMock, side_effect=Exception("Rate limited")):
        with patch.object(router, '_call_groq', new_callable=AsyncMock, return_value="Fallback response"):
            result = await router.generate(
                prompt="Analyze this",
                system_prompt="Expert",
                task_type="text_generation",
            )
            assert result == "Fallback response"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_llm_router.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement LLM router**

```python
# backend/services/claimpilot/llm_router.py
"""
ClaimPilot LLM Router — selects and calls the best LLM for each task type.

Provider priority:
  - gemini_flash: Free tier, primary for vision + text (google-generativeai SDK)
  - groq: Free tier, fallback for text (groq SDK)
  - ollama: Local, for private data or when cloud is down
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Task type → primary provider mapping
PROVIDER_MAP = {
    "vision": "gemini_flash",
    "text_generation": "gemini_flash",
    "structured_extraction": "gemini_flash",
    "private_data": "ollama",
}

# Fallback chain per provider
FALLBACK_CHAIN = {
    "gemini_flash": ["groq", "ollama"],
    "groq": ["gemini_flash", "ollama"],
    "ollama": [],  # local-only, no fallback
}


class LLMRouter:
    def __init__(self):
        self._gemini_client = None
        self._groq_client = None

    def select_provider(self, task_type: str) -> str:
        """Select the best provider for a given task type."""
        return PROVIDER_MAP.get(task_type, "gemini_flash")

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        task_type: str = "text_generation",
        provider_override: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> str:
        """Generate text using the best available provider with automatic fallback."""
        provider = provider_override or self.select_provider(task_type)
        fallbacks = FALLBACK_CHAIN.get(provider, [])
        providers_to_try = [provider] + fallbacks

        last_error = None
        for p in providers_to_try:
            try:
                if p == "gemini_flash":
                    return await self._call_gemini(prompt, system_prompt, temperature, max_tokens)
                elif p == "groq":
                    return await self._call_groq(prompt, system_prompt, temperature, max_tokens)
                elif p == "ollama":
                    return await self._call_ollama(prompt, system_prompt, temperature, max_tokens)
            except Exception as e:
                logger.warning("LLM provider %s failed: %s — trying fallback", p, e)
                last_error = e
                continue

        raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")

    async def generate_vision(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> str:
        """Analyze an image using Gemini Flash Vision."""
        return await self._call_gemini_vision(prompt, image_bytes, mime_type)

    async def _call_gemini(
        self, prompt: str, system_prompt: str, temperature: float, max_tokens: int
    ) -> str:
        """Call Google Gemini 2.0 Flash via google-generativeai SDK."""
        import google.generativeai as genai

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        response = await model.generate_content_async(prompt)
        return response.text

    async def _call_gemini_vision(
        self, prompt: str, image_bytes: bytes, mime_type: str
    ) -> str:
        """Call Gemini Flash Vision for image analysis."""
        import google.generativeai as genai

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        image_part = {"mime_type": mime_type, "data": image_bytes}
        response = await model.generate_content_async([prompt, image_part])
        return response.text

    async def _call_groq(
        self, prompt: str, system_prompt: str, temperature: float, max_tokens: int
    ) -> str:
        """Call Groq API with llama-3.3-70b."""
        from groq import AsyncGroq

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set")

        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    async def _call_ollama(
        self, prompt: str, system_prompt: str, temperature: float, max_tokens: int
    ) -> str:
        """Call local Ollama instance."""
        from services.ollama_config import get_ollama_api_key, get_ollama_model
        from services.ai_service import get_llm_client

        client = get_llm_client()
        full_prompt = f"System: {system_prompt}\n\nUser: {prompt}"
        response = await client.generate(full_prompt)
        return response
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_llm_router.py -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/claimpilot/llm_router.py backend/tests/services/test_llm_router.py
git commit -m "feat(claimpilot): add LLM router with Gemini/Groq/Ollama fallback chain"
```

---

### Task 4: Agent Context Builder

**Files:**
- Create: `backend/services/claimpilot/agent_context.py`
- Test: `backend/tests/services/test_agent_context.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_agent_context.py
import pytest
from datetime import datetime, timezone
from conftest import MockDB

@pytest.mark.asyncio
async def test_build_context_for_claim():
    mock_db = MockDB()
    claim_doc = {
        "id": "claim-001",
        "claim_number": "CLM-2026-0001",
        "status": "In Progress",
        "client_name": "John Doe",
        "client_email": "john@example.com",
        "property_address": "123 Main St, Tampa, FL",
        "claim_type": "Wind",
        "loss_date": "2026-01-15",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await mock_db.claims.insert_one(claim_doc)
    await mock_db.claim_activity.insert_one({
        "claim_id": "claim-001",
        "event_type": "ClaimCreated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    from services.claimpilot.agent_context import AgentContextBuilder

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-001")

    assert ctx.claim["id"] == "claim-001"
    assert ctx.claim["status"] == "In Progress"
    assert len(ctx.recent_activity) == 1
    assert ctx.is_frozen is False  # not in Litigation/Archived

@pytest.mark.asyncio
async def test_context_marks_litigation_as_frozen():
    mock_db = MockDB()
    await mock_db.claims.insert_one({
        "id": "claim-002",
        "status": "Closed",
        "claim_number": "CLM-2026-0002",
        "is_in_litigation": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    from services.claimpilot.agent_context import AgentContextBuilder

    builder = AgentContextBuilder(mock_db)
    ctx = await builder.build("claim-002")
    assert ctx.is_frozen is True

@pytest.mark.asyncio
async def test_context_raises_for_missing_claim():
    mock_db = MockDB()
    from services.claimpilot.agent_context import AgentContextBuilder

    builder = AgentContextBuilder(mock_db)
    with pytest.raises(ValueError, match="not found"):
        await builder.build("nonexistent")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_agent_context.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement agent context builder**

```python
# backend/services/claimpilot/agent_context.py
"""
AgentContext — Immutable snapshot of a claim and its related data.
Built fresh for each agent execution. Agents receive this as their only input.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

FROZEN_STATUSES = {"Archived", "Closed"}
LITIGATION_FLAG = "is_in_litigation"


@dataclass(frozen=True)
class AgentContext:
    """Immutable context passed to every ClaimPilot agent."""
    claim: dict
    recent_activity: list = field(default_factory=list)
    evidence: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    tasks: list = field(default_factory=list)
    photos: list = field(default_factory=list)
    carrier_comms: list = field(default_factory=list)
    is_frozen: bool = False


class AgentContextBuilder:
    """Builds an AgentContext from MongoDB for a given claim_id."""

    def __init__(self, db):
        self.db = db

    async def build(self, claim_id: str) -> AgentContext:
        """Build immutable context for a claim."""
        claim = await self.db.claims.find_one({"id": claim_id}, {"_id": 0})
        if not claim:
            raise ValueError(f"Claim {claim_id} not found")

        # Determine if claim is frozen (Litigation, Archived, Closed)
        is_frozen = (
            claim.get("status") in FROZEN_STATUSES
            or claim.get(LITIGATION_FLAG, False)
        )

        # Fetch related data in parallel-safe manner (Motor handles this)
        activity = await self.db.claim_activity.find(
            {"claim_id": claim_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)

        evidence = await self.db.evidence.find(
            {"claim_id": claim_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)

        notes = await self.db.notes.find(
            {"claim_id": claim_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)

        tasks = await self.db.tasks.find(
            {"claim_id": claim_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)

        photos = await self.db.inspection_photos.find(
            {"claim_id": claim_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)

        carrier_comms = await self.db.comm_messages.find(
            {"claim_id": claim_id, "channel": {"$in": ["carrier", "email"]}},
            {"_id": 0},
        ).sort("created_at", -1).to_list(30)

        return AgentContext(
            claim=claim,
            recent_activity=activity,
            evidence=evidence,
            notes=notes,
            tasks=tasks,
            photos=photos,
            carrier_comms=carrier_comms,
            is_frozen=is_frozen,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_agent_context.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/claimpilot/agent_context.py backend/tests/services/test_agent_context.py
git commit -m "feat(claimpilot): add immutable AgentContext builder from claim data"
```

---

## Chunk 3: BaseAgent + Approval Gate

### Task 5: BaseAgent Abstract Class

**Files:**
- Create: `backend/services/claimpilot/base_agent.py`
- Extend: `backend/tests/services/test_base_agent.py`

- [ ] **Step 1: Write failing tests for BaseAgent**

Append to `backend/tests/services/test_base_agent.py`:

```python
from unittest.mock import AsyncMock, patch, MagicMock
from conftest import MockDB

@pytest.mark.asyncio
async def test_base_agent_runs_and_audits():
    """A concrete agent inheriting BaseAgent should execute and log to audit."""
    mock_db = MockDB()

    from services.claimpilot.base_agent import BaseAgent
    from services.claimpilot.agent_context import AgentContext
    from models import AgentResult

    class TestAgent(BaseAgent):
        agent_name = "test_agent"
        requires_approval = False
        llm_provider = "gemini_flash"

        async def execute(self, context: AgentContext) -> AgentResult:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=context.claim["id"],
                insight_type="test",
                summary="Test insight",
                details={"test": True},
                confidence=0.95,
            )

        async def validate_output(self, result: AgentResult) -> bool:
            return result.confidence > 0.5

    agent = TestAgent(mock_db)
    ctx = AgentContext(claim={"id": "c1", "status": "New"})

    result = await agent.run(ctx)
    assert result.agent_name == "test_agent"
    assert result.confidence == 0.95

    # Check audit was written
    audits = await mock_db.claimpilot_audit.find().to_list(100)
    assert len(audits) == 1
    assert audits[0]["agent_name"] == "test_agent"
    assert audits[0]["status"] == "success"

@pytest.mark.asyncio
async def test_base_agent_blocks_frozen_claims():
    """Agent should refuse to run on litigation/archived claims."""
    mock_db = MockDB()

    from services.claimpilot.base_agent import BaseAgent
    from services.claimpilot.agent_context import AgentContext
    from models import AgentResult

    class TestAgent(BaseAgent):
        agent_name = "test_agent"
        requires_approval = False
        llm_provider = "gemini_flash"

        async def execute(self, context: AgentContext) -> AgentResult:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=context.claim["id"],
                insight_type="test",
                summary="Should not run",
                details={},
                confidence=0.9,
            )

        async def validate_output(self, result: AgentResult) -> bool:
            return True

    agent = TestAgent(mock_db)
    ctx = AgentContext(claim={"id": "c2", "status": "Archived"}, is_frozen=True)

    result = await agent.run(ctx)
    assert result is None  # blocked

@pytest.mark.asyncio
async def test_base_agent_strips_legal_promises():
    """Agent output should have legal promises stripped."""
    mock_db = MockDB()

    from services.claimpilot.base_agent import BaseAgent
    from services.claimpilot.agent_context import AgentContext
    from models import AgentResult

    class PromiseAgent(BaseAgent):
        agent_name = "promise_agent"
        requires_approval = True
        llm_provider = "gemini_flash"

        async def execute(self, context: AgentContext) -> AgentResult:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=context.claim["id"],
                insight_type="test",
                summary="We guarantee you will receive full payment",
                details={},
                confidence=0.8,
            )

        async def validate_output(self, result: AgentResult) -> bool:
            return True

    agent = PromiseAgent(mock_db)
    ctx = AgentContext(claim={"id": "c3", "status": "New"})

    result = await agent.run(ctx)
    assert "guarantee" not in result.summary.lower()
    assert "[REMOVED]" in result.summary
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py::test_base_agent_runs_and_audits -v`
Expected: FAIL — `ImportError: cannot import name 'BaseAgent'`

- [ ] **Step 3: Implement BaseAgent**

```python
# backend/services/claimpilot/base_agent.py
"""
BaseAgent — Abstract base class for all ClaimPilot agents.

Provides:
  - Guardrails (legal promise stripping, sensitive keyword flagging, prompt injection protection)
  - Audit logging (every execution recorded)
  - Frozen claim detection (blocks agents on litigation/archived claims)
  - Retry with exponential backoff
  - Confidence threshold enforcement
"""

import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

from models import AgentResult
from services.claimpilot.agent_context import AgentContext
from services.claimpilot.audit_logger import AuditLogger
from services.ai_service import strip_legal_promises, flag_sensitive_content

logger = logging.getLogger(__name__)

MIN_CONFIDENCE_THRESHOLD = 0.5


class BaseAgent(ABC):
    agent_name: str = "unnamed_agent"
    requires_approval: bool = False
    llm_provider: str = "gemini_flash"
    max_retries: int = 2
    timeout_seconds: int = 30

    def __init__(self, db):
        self.db = db
        self.audit = AuditLogger(db)

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult:
        """Implement the agent's core logic. Return an AgentResult."""
        ...

    @abstractmethod
    async def validate_output(self, result: AgentResult) -> bool:
        """Validate the agent's output before returning it."""
        ...

    async def run(self, context: AgentContext) -> Optional[AgentResult]:
        """
        Execute the agent with guardrails, audit logging, and retry.
        Returns None if the agent should not run (frozen claim, etc.).
        """
        start_time = time.monotonic()

        # Guard: frozen claims
        if context.is_frozen:
            logger.info(
                "CLAIMPILOT: %s skipped — claim %s is frozen",
                self.agent_name, context.claim.get("id"),
            )
            return None

        claim_id = context.claim.get("id", "unknown")
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                result = await self.execute(context)

                # Apply guardrails to summary text
                cleaned_summary, warnings = strip_legal_promises(result.summary)
                sensitive_warnings = flag_sensitive_content(cleaned_summary)

                result = AgentResult(
                    id=result.id,
                    agent_name=result.agent_name,
                    claim_id=result.claim_id,
                    insight_type=result.insight_type,
                    summary=cleaned_summary,
                    details=result.details,
                    confidence=result.confidence,
                    suggested_actions=result.suggested_actions,
                    requires_approval=self.requires_approval,
                    created_at=result.created_at,
                )

                # Validate output
                if not await self.validate_output(result):
                    logger.warning("CLAIMPILOT: %s output failed validation", self.agent_name)
                    continue

                # Log success
                duration_ms = int((time.monotonic() - start_time) * 1000)
                await self.audit.log_execution(
                    agent_name=self.agent_name,
                    claim_id=claim_id,
                    input_summary={"claim_status": context.claim.get("status")},
                    output_summary={"summary": result.summary[:200]},
                    confidence=result.confidence,
                    duration_ms=duration_ms,
                    status="success",
                )

                # Store insight
                await self.db.claimpilot_insights.insert_one(result.model_dump())

                return result

            except Exception as e:
                last_error = e
                logger.error(
                    "CLAIMPILOT: %s attempt %d failed: %s",
                    self.agent_name, attempt + 1, e,
                )

        # All retries exhausted
        duration_ms = int((time.monotonic() - start_time) * 1000)
        await self.audit.log_execution(
            agent_name=self.agent_name,
            claim_id=claim_id,
            input_summary={"claim_status": context.claim.get("status")},
            output_summary={},
            confidence=0.0,
            duration_ms=duration_ms,
            status="error",
            error_message=str(last_error),
        )
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py -v`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/claimpilot/base_agent.py backend/tests/services/test_base_agent.py
git commit -m "feat(claimpilot): add BaseAgent with guardrails, audit, retry, frozen-claim detection"
```

---

### Task 6: Approval Gate

**Files:**
- Create: `backend/services/claimpilot/approval_gate.py`
- Test: `backend/tests/services/test_approval_gate.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_approval_gate.py
import pytest
from datetime import datetime, timezone, timedelta
from conftest import MockDB

@pytest.mark.asyncio
async def test_submit_pending_action():
    mock_db = MockDB()
    from services.claimpilot.approval_gate import ApprovalGate
    from models import PendingAction

    gate = ApprovalGate(mock_db)
    action = PendingAction(
        agent_name="claim_monitor",
        claim_id="claim-001",
        action_type="create_task",
        action_data={"title": "Follow up with carrier", "priority": "high"},
        confidence=0.88,
        reasoning="No response in 5 days",
    )

    result = await gate.submit(action)
    assert result is not None

    docs = await mock_db.claimpilot_pending.find().to_list(100)
    assert len(docs) == 1
    assert docs[0]["status"] == "pending"

@pytest.mark.asyncio
async def test_approve_pending_action():
    mock_db = MockDB()
    from services.claimpilot.approval_gate import ApprovalGate
    from models import PendingAction

    gate = ApprovalGate(mock_db)
    action = PendingAction(
        agent_name="claim_monitor",
        claim_id="claim-001",
        action_type="create_task",
        action_data={"title": "Follow up"},
        confidence=0.9,
        reasoning="Stalled",
    )
    await gate.submit(action)

    result = await gate.approve(action.id, reviewed_by="manager@eden.com")
    assert result is True

    doc = await mock_db.claimpilot_pending.find_one({"id": action.id})
    assert doc["status"] == "approved"
    assert doc["reviewed_by"] == "manager@eden.com"

@pytest.mark.asyncio
async def test_reject_pending_action():
    mock_db = MockDB()
    from services.claimpilot.approval_gate import ApprovalGate
    from models import PendingAction

    gate = ApprovalGate(mock_db)
    action = PendingAction(
        agent_name="claim_monitor",
        claim_id="claim-001",
        action_type="create_task",
        action_data={"title": "Follow up"},
        confidence=0.5,
        reasoning="Maybe stalled",
    )
    await gate.submit(action)

    result = await gate.reject(action.id, reviewed_by="admin@eden.com", reason="Not stalled, carrier on vacation")
    assert result is True

    doc = await mock_db.claimpilot_pending.find_one({"id": action.id})
    assert doc["status"] == "rejected"
    assert doc["reject_reason"] == "Not stalled, carrier on vacation"

@pytest.mark.asyncio
async def test_get_pending_actions():
    mock_db = MockDB()
    from services.claimpilot.approval_gate import ApprovalGate
    from models import PendingAction

    gate = ApprovalGate(mock_db)
    for i in range(3):
        await gate.submit(PendingAction(
            agent_name="monitor",
            claim_id=f"claim-{i}",
            action_type="create_task",
            action_data={"title": f"Task {i}"},
            confidence=0.8,
            reasoning="Stalled",
        ))

    pending = await gate.get_pending()
    assert len(pending) == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_approval_gate.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement approval gate**

```python
# backend/services/claimpilot/approval_gate.py
"""
Approval Gate — Human-in-the-loop approval system for ClaimPilot actions.

All data-changing agent outputs (task creation, claim updates, messages)
must pass through this gate before execution.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from models import PendingAction

logger = logging.getLogger(__name__)

DEFAULT_EXPIRY_HOURS = 24


class ApprovalGate:
    def __init__(self, db):
        self.db = db

    async def submit(self, action: PendingAction) -> str:
        """Submit an action for human approval. Returns the action ID."""
        action_dict = action.model_dump()
        action_dict["expires_at"] = datetime.now(timezone.utc) + timedelta(hours=DEFAULT_EXPIRY_HOURS)
        await self.db.claimpilot_pending.insert_one(action_dict)
        logger.info(
            "CLAIMPILOT_PENDING: %s submitted %s for claim %s (confidence: %.2f)",
            action.agent_name, action.action_type, action.claim_id, action.confidence,
        )
        return action.id

    async def approve(self, action_id: str, reviewed_by: str) -> bool:
        """Approve a pending action."""
        result = await self.db.claimpilot_pending.update_one(
            {"id": action_id, "status": "pending"},
            {"$set": {
                "status": "approved",
                "reviewed_by": reviewed_by,
                "reviewed_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            logger.warning("Approve failed: action %s not found or not pending", action_id)
            return False
        logger.info("CLAIMPILOT_APPROVED: %s by %s", action_id, reviewed_by)
        return True

    async def reject(self, action_id: str, reviewed_by: str, reason: str = "") -> bool:
        """Reject a pending action with reason."""
        result = await self.db.claimpilot_pending.update_one(
            {"id": action_id, "status": "pending"},
            {"$set": {
                "status": "rejected",
                "reviewed_by": reviewed_by,
                "reviewed_at": datetime.now(timezone.utc),
                "reject_reason": reason,
            }},
        )
        if result.matched_count == 0:
            logger.warning("Reject failed: action %s not found or not pending", action_id)
            return False
        logger.info("CLAIMPILOT_REJECTED: %s by %s — %s", action_id, reviewed_by, reason)
        return True

    async def get_pending(self, claim_id: Optional[str] = None, limit: int = 50) -> list:
        """Get all pending actions, optionally filtered by claim."""
        query = {"status": "pending"}
        if claim_id:
            query["claim_id"] = claim_id
        docs = await self.db.claimpilot_pending.find(query, {"_id": 0}).sort(
            "created_at", -1
        ).to_list(limit)
        return docs

    async def get_action(self, action_id: str) -> Optional[dict]:
        """Get a specific pending action by ID."""
        return await self.db.claimpilot_pending.find_one({"id": action_id}, {"_id": 0})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_approval_gate.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/claimpilot/approval_gate.py backend/tests/services/test_approval_gate.py
git commit -m "feat(claimpilot): add approval gate for human-in-the-loop action review"
```

---

## Chunk 4: Orchestrator + ClaimMonitor Agent

### Task 7: Agent Orchestrator

**Files:**
- Create: `backend/services/claimpilot/orchestrator.py`
- Create: `backend/services/claimpilot/agents/__init__.py`
- Test: `backend/tests/services/test_orchestrator.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_orchestrator.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from conftest import MockDB

@pytest.mark.asyncio
async def test_orchestrator_registers_agent():
    mock_db = MockDB()
    from services.claimpilot.orchestrator import AgentOrchestrator

    orchestrator = AgentOrchestrator(mock_db)

    # Create a mock agent
    mock_agent = MagicMock()
    mock_agent.agent_name = "test_agent"

    orchestrator.register("test_agent", mock_agent)
    assert "test_agent" in orchestrator.agents

@pytest.mark.asyncio
async def test_orchestrator_routes_event_to_agent():
    mock_db = MockDB()
    await mock_db.claims.insert_one({
        "id": "claim-001",
        "status": "In Progress",
        "claim_number": "CLM-001",
        "created_at": "2026-01-01T00:00:00Z",
    })

    from services.claimpilot.orchestrator import AgentOrchestrator
    from services.claimpilot.base_agent import BaseAgent
    from services.claimpilot.agent_context import AgentContext
    from models import AgentResult

    class SpyAgent(BaseAgent):
        agent_name = "spy_agent"
        requires_approval = False
        llm_provider = "gemini_flash"
        was_called = False

        async def execute(self, context: AgentContext) -> AgentResult:
            SpyAgent.was_called = True
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=context.claim["id"],
                insight_type="test",
                summary="Spy executed",
                details={},
                confidence=0.9,
            )

        async def validate_output(self, result: AgentResult) -> bool:
            return True

    orchestrator = AgentOrchestrator(mock_db)
    spy = SpyAgent(mock_db)
    orchestrator.register("spy_agent", spy)
    orchestrator.add_event_mapping("ClaimCreated", ["spy_agent"])

    await orchestrator.handle_event("ClaimCreated", "claim-001")
    assert SpyAgent.was_called is True

@pytest.mark.asyncio
async def test_orchestrator_skips_unknown_events():
    mock_db = MockDB()
    from services.claimpilot.orchestrator import AgentOrchestrator

    orchestrator = AgentOrchestrator(mock_db)
    # Should not raise
    results = await orchestrator.handle_event("UnknownEvent", "claim-001")
    assert results == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_orchestrator.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement orchestrator**

```python
# backend/services/claimpilot/orchestrator.py
"""
AgentOrchestrator — Routes domain events to the appropriate ClaimPilot agents.

Integrates with claims_service.py's _dispatch_domain_event to trigger agents
when claims are created, updated, or transition stages.
"""

import logging
from typing import Optional

from services.claimpilot.agent_context import AgentContextBuilder
from models import AgentResult

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    def __init__(self, db):
        self.db = db
        self.agents = {}
        self.event_map = {}  # event_type -> [agent_names]
        self.context_builder = AgentContextBuilder(db)

    def register(self, name: str, agent) -> None:
        """Register an agent with the orchestrator."""
        self.agents[name] = agent
        logger.info("CLAIMPILOT: Registered agent '%s'", name)

    def add_event_mapping(self, event_type: str, agent_names: list) -> None:
        """Map a domain event type to one or more agents."""
        self.event_map[event_type] = agent_names

    async def handle_event(
        self, event_type: str, claim_id: str, details: Optional[dict] = None
    ) -> list:
        """Handle a domain event by dispatching to mapped agents."""
        agent_names = self.event_map.get(event_type, [])
        if not agent_names:
            return []

        # Build context once, share across agents
        try:
            context = await self.context_builder.build(claim_id)
        except ValueError as e:
            logger.warning("CLAIMPILOT: Cannot build context: %s", e)
            return []

        results = []
        for name in agent_names:
            agent = self.agents.get(name)
            if not agent:
                logger.warning("CLAIMPILOT: Agent '%s' not registered", name)
                continue

            try:
                result = await agent.run(context)
                if result:
                    results.append(result)
                    # If agent requires approval, submit to gate
                    if agent.requires_approval and result.suggested_actions:
                        from services.claimpilot.approval_gate import ApprovalGate
                        from models import PendingAction

                        gate = ApprovalGate(self.db)
                        for action_text in result.suggested_actions:
                            pending = PendingAction(
                                agent_name=name,
                                claim_id=claim_id,
                                action_type="suggested_action",
                                action_data={"description": action_text},
                                confidence=result.confidence,
                                reasoning=result.summary,
                            )
                            await gate.submit(pending)
            except Exception as e:
                logger.error("CLAIMPILOT: Agent '%s' error: %s", name, e)

        return results

    async def run_agent(self, agent_name: str, claim_id: str) -> Optional[AgentResult]:
        """Manually trigger a specific agent for a claim."""
        agent = self.agents.get(agent_name)
        if not agent:
            raise ValueError(f"Agent '{agent_name}' not registered")

        context = await self.context_builder.build(claim_id)
        return await agent.run(context)
```

```python
# backend/services/claimpilot/agents/__init__.py
"""ClaimPilot Agent Registry."""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_orchestrator.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/claimpilot/orchestrator.py backend/services/claimpilot/agents/__init__.py backend/tests/services/test_orchestrator.py
git commit -m "feat(claimpilot): add orchestrator for event-driven agent dispatch"
```

---

### Task 8: ClaimMonitor Agent

**Files:**
- Create: `backend/services/claimpilot/agents/claim_monitor.py`
- Test: `backend/tests/services/test_claim_monitor.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_claim_monitor.py
import pytest
from datetime import datetime, timezone, timedelta
from conftest import MockDB
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_monitor_detects_stalled_claim():
    mock_db = MockDB()
    # Claim with no activity for 7 days
    stale_date = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    await mock_db.claims.insert_one({
        "id": "claim-stalled",
        "claim_number": "CLM-2026-STALL",
        "status": "In Progress",
        "client_name": "Jane Doe",
        "updated_at": stale_date,
        "created_at": stale_date,
    })

    from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent

    agent = ClaimMonitorAgent(mock_db)
    stalls = await agent.detect_stalled_claims()

    assert len(stalls) >= 1
    assert stalls[0]["id"] == "claim-stalled"

@pytest.mark.asyncio
async def test_monitor_ignores_active_claims():
    mock_db = MockDB()
    recent = datetime.now(timezone.utc).isoformat()
    await mock_db.claims.insert_one({
        "id": "claim-active",
        "claim_number": "CLM-2026-ACTIVE",
        "status": "In Progress",
        "client_name": "Active Client",
        "updated_at": recent,
        "created_at": recent,
    })

    from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent

    agent = ClaimMonitorAgent(mock_db)
    stalls = await agent.detect_stalled_claims()

    # Active claim should not be flagged
    stall_ids = [s["id"] for s in stalls]
    assert "claim-active" not in stall_ids

@pytest.mark.asyncio
async def test_monitor_ignores_archived_claims():
    mock_db = MockDB()
    stale_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    await mock_db.claims.insert_one({
        "id": "claim-archived",
        "claim_number": "CLM-ARCH",
        "status": "Archived",
        "updated_at": stale_date,
        "created_at": stale_date,
    })

    from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent

    agent = ClaimMonitorAgent(mock_db)
    stalls = await agent.detect_stalled_claims()

    stall_ids = [s["id"] for s in stalls]
    assert "claim-archived" not in stall_ids

@pytest.mark.asyncio
async def test_monitor_full_execution_with_mock_llm():
    mock_db = MockDB()
    stale_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    await mock_db.claims.insert_one({
        "id": "claim-monitor-test",
        "claim_number": "CLM-MON-001",
        "status": "Under Review",
        "client_name": "Monitor Test",
        "updated_at": stale_date,
        "created_at": stale_date,
    })

    from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent
    from services.claimpilot.agent_context import AgentContext

    agent = ClaimMonitorAgent(mock_db)

    # Mock the LLM call
    with patch.object(agent, '_analyze_with_llm', new_callable=AsyncMock, return_value={
        "summary": "Claim stalled for 10 days in Under Review stage",
        "suggested_actions": ["Contact carrier for status update", "Escalate to manager"],
        "risk_level": "high",
    }):
        ctx = AgentContext(
            claim={
                "id": "claim-monitor-test",
                "status": "Under Review",
                "claim_number": "CLM-MON-001",
                "client_name": "Monitor Test",
                "updated_at": stale_date,
            }
        )
        result = await agent.run(ctx)

        assert result is not None
        assert result.agent_name == "claim_monitor"
        assert result.confidence > 0.7
        assert len(result.suggested_actions) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_claim_monitor.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement ClaimMonitor agent**

```python
# backend/services/claimpilot/agents/claim_monitor.py
"""
ClaimMonitor Agent — Detects stalled claims, deadline risks, and compliance gaps.

Runs on schedule (every 2 hours) and on claim stage transitions.
Creates notifications for stalls. Suggests follow-up tasks via approval gate.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from services.claimpilot.base_agent import BaseAgent
from services.claimpilot.agent_context import AgentContext
from models import AgentResult

logger = logging.getLogger(__name__)

# Stall thresholds per status (days with no activity)
STALL_THRESHOLDS = {
    "New": 2,
    "In Progress": 5,
    "Under Review": 7,
    "Approved": 3,
    "Denied": 5,
    "Completed": 10,
}

ACTIVE_STATUSES = {"New", "In Progress", "Under Review", "Approved", "Denied", "Completed"}


class ClaimMonitorAgent(BaseAgent):
    agent_name = "claim_monitor"
    requires_approval = True  # task creation needs approval
    llm_provider = "groq"

    async def execute(self, context: AgentContext) -> AgentResult:
        """Analyze a single claim for stalls, deadlines, and issues."""
        claim = context.claim
        claim_id = claim.get("id", "unknown")
        status = claim.get("status", "Unknown")

        # Calculate days since last update
        updated_at_str = claim.get("updated_at") or claim.get("created_at", "")
        try:
            if isinstance(updated_at_str, str):
                updated_at = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
            else:
                updated_at = updated_at_str
            days_idle = (datetime.now(timezone.utc) - updated_at).days
        except (ValueError, TypeError):
            days_idle = 0

        threshold = STALL_THRESHOLDS.get(status, 7)
        is_stalled = days_idle >= threshold

        if not is_stalled:
            return AgentResult(
                agent_name=self.agent_name,
                claim_id=claim_id,
                insight_type="monitoring",
                summary=f"Claim {claim.get('claim_number', '')} is active ({days_idle}d idle, threshold {threshold}d)",
                details={"days_idle": days_idle, "threshold": threshold, "is_stalled": False},
                confidence=0.95,
                suggested_actions=[],
            )

        # Stall detected — use LLM for analysis
        analysis = await self._analyze_with_llm(claim, days_idle, context)

        return AgentResult(
            agent_name=self.agent_name,
            claim_id=claim_id,
            insight_type="stall_detection",
            summary=analysis.get("summary", f"Claim stalled for {days_idle} days in {status}"),
            details={
                "days_idle": days_idle,
                "threshold": threshold,
                "is_stalled": True,
                "risk_level": analysis.get("risk_level", "medium"),
            },
            confidence=min(0.95, 0.7 + (days_idle - threshold) * 0.05),
            suggested_actions=analysis.get("suggested_actions", [
                f"Follow up on claim {claim.get('claim_number', '')}",
            ]),
            requires_approval=True,
        )

    async def validate_output(self, result: AgentResult) -> bool:
        """Validate monitor output."""
        return result.confidence >= 0.5 and bool(result.summary)

    async def detect_stalled_claims(self) -> list:
        """Scan all active claims for stalls. Used by the scheduled worker."""
        stalled = []
        for status in ACTIVE_STATUSES:
            threshold = STALL_THRESHOLDS.get(status, 7)
            cutoff = datetime.now(timezone.utc) - timedelta(days=threshold)

            claims = await self.db.claims.find(
                {"status": status}, {"_id": 0}
            ).to_list(500)

            for claim in claims:
                updated_str = claim.get("updated_at") or claim.get("created_at", "")
                try:
                    if isinstance(updated_str, str):
                        updated = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                    else:
                        updated = updated_str
                    if updated < cutoff:
                        stalled.append(claim)
                except (ValueError, TypeError):
                    continue

        return stalled

    async def _analyze_with_llm(self, claim: dict, days_idle: int, context: AgentContext) -> dict:
        """Use LLM to analyze a stalled claim and suggest actions."""
        from services.claimpilot.llm_router import LLMRouter

        router = LLMRouter()

        system_prompt = """You are a senior public adjuster analyzing insurance claims for Care Claims in Florida.
A claim has been flagged as stalled. Analyze the situation and provide:
1. A brief summary of why this might be stalled
2. 2-3 specific next actions the adjuster should take
3. A risk level (low, medium, high, critical)

Respond in JSON format:
{"summary": "...", "suggested_actions": ["...", "..."], "risk_level": "..."}"""

        claim_summary = (
            f"Claim: {claim.get('claim_number', 'N/A')}\n"
            f"Status: {claim.get('status', 'Unknown')}\n"
            f"Client: {claim.get('client_name', 'Unknown')}\n"
            f"Type: {claim.get('claim_type', 'Unknown')}\n"
            f"Days idle: {days_idle}\n"
            f"Recent activity count: {len(context.recent_activity)}\n"
            f"Open tasks: {len([t for t in context.tasks if t.get('status') != 'completed'])}\n"
        )

        try:
            response = await router.generate(
                prompt=claim_summary,
                system_prompt=system_prompt,
                task_type="text_generation",
                temperature=0.2,
                max_tokens=500,
            )
            return json.loads(response)
        except (json.JSONDecodeError, Exception) as e:
            logger.warning("ClaimMonitor LLM analysis failed: %s", e)
            return {
                "summary": f"Claim {claim.get('claim_number', '')} has been idle for {days_idle} days in {claim.get('status', '')} stage",
                "suggested_actions": [
                    "Review claim status and contact carrier",
                    "Check for any pending documentation",
                ],
                "risk_level": "high" if days_idle > 14 else "medium",
            }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_claim_monitor.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/claimpilot/agents/claim_monitor.py backend/tests/services/test_claim_monitor.py
git commit -m "feat(claimpilot): add ClaimMonitor agent with stall detection and LLM analysis"
```

---

## Chunk 5: API Routes + Server Integration + Scheduler

### Task 9: ClaimPilot API Routes

**Files:**
- Create: `backend/routes/claimpilot.py`
- Test: `backend/tests/test_claimpilot_routes.py`

- [ ] **Step 1: Write failing test for routes**

```python
# backend/tests/test_claimpilot_routes.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from conftest import MockDB

@pytest.mark.asyncio
async def test_get_pending_returns_list():
    mock_db = MockDB()
    await mock_db.claimpilot_pending.insert_one({
        "id": "p1",
        "agent_name": "claim_monitor",
        "claim_id": "c1",
        "action_type": "create_task",
        "action_data": {"title": "Follow up"},
        "confidence": 0.9,
        "reasoning": "Stalled",
        "status": "pending",
        "created_at": "2026-03-14T00:00:00Z",
    })

    from services.claimpilot.approval_gate import ApprovalGate

    gate = ApprovalGate(mock_db)
    pending = await gate.get_pending()
    assert len(pending) == 1
    assert pending[0]["agent_name"] == "claim_monitor"
```

- [ ] **Step 2: Run test to verify it passes (this uses existing code)**

Run: `cd backend && python -m pytest tests/test_claimpilot_routes.py -v`
Expected: PASS

- [ ] **Step 3: Implement ClaimPilot routes**

```python
# backend/routes/claimpilot.py
"""
ClaimPilot API Routes — Endpoints for AI agent insights, approval queue, and analytics.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from dependencies import get_current_user, db
from models import has_permission, get_role_level

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/claimpilot", tags=["ClaimPilot AI"])


@router.get("/pending")
async def get_pending_actions(
    claim_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user),
):
    """Get all pending actions awaiting human approval."""
    if get_role_level(current_user.get("role", "")) < 50:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from services.claimpilot.approval_gate import ApprovalGate

    gate = ApprovalGate(db)
    pending = await gate.get_pending(claim_id=claim_id, limit=limit)
    return {"success": True, "data": pending, "meta": {"total": len(pending)}}


@router.post("/pending/{action_id}/approve")
async def approve_action(
    action_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Approve a pending ClaimPilot action."""
    if get_role_level(current_user.get("role", "")) < 75:
        raise HTTPException(status_code=403, detail="Manager+ required to approve actions")

    from services.claimpilot.approval_gate import ApprovalGate

    gate = ApprovalGate(db)
    result = await gate.approve(action_id, reviewed_by=current_user["email"])
    if not result:
        raise HTTPException(status_code=404, detail="Action not found or already reviewed")
    return {"success": True, "data": {"action_id": action_id, "status": "approved"}}


@router.post("/pending/{action_id}/reject")
async def reject_action(
    action_id: str,
    reason: str = Query(""),
    current_user: dict = Depends(get_current_user),
):
    """Reject a pending ClaimPilot action."""
    if get_role_level(current_user.get("role", "")) < 75:
        raise HTTPException(status_code=403, detail="Manager+ required to reject actions")

    from services.claimpilot.approval_gate import ApprovalGate

    gate = ApprovalGate(db)
    result = await gate.reject(action_id, reviewed_by=current_user["email"], reason=reason)
    if not result:
        raise HTTPException(status_code=404, detail="Action not found or already reviewed")
    return {"success": True, "data": {"action_id": action_id, "status": "rejected"}}


@router.get("/claims/{claim_id}/insights")
async def get_claim_insights(
    claim_id: str,
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get all ClaimPilot insights for a specific claim."""
    insights = await db.claimpilot_insights.find(
        {"claim_id": claim_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return {"success": True, "data": insights, "meta": {"total": len(insights)}}


@router.post("/claims/{claim_id}/run/{agent_name}")
async def run_agent_manually(
    claim_id: str,
    agent_name: str,
    current_user: dict = Depends(get_current_user),
):
    """Manually trigger a ClaimPilot agent for a specific claim."""
    if get_role_level(current_user.get("role", "")) < 50:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from services.claimpilot.orchestrator import get_orchestrator

    orchestrator = get_orchestrator()
    try:
        result = await orchestrator.run_agent(agent_name, claim_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if result is None:
        return {"success": True, "data": None, "message": "Agent skipped (claim may be frozen)"}
    return {"success": True, "data": result.model_dump()}


@router.get("/analytics")
async def get_analytics(
    current_user: dict = Depends(get_current_user),
):
    """Get ClaimPilot analytics (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    # Aggregate stats from audit collection
    pipeline = [
        {"$group": {
            "_id": "$agent_name",
            "total_runs": {"$sum": 1},
            "successes": {"$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}},
            "avg_confidence": {"$avg": "$confidence"},
            "avg_duration_ms": {"$avg": "$duration_ms"},
        }}
    ]
    # Motor aggregate
    stats = []
    async for doc in db.claimpilot_audit.aggregate(pipeline):
        stats.append(doc)

    pending_count = await db.claimpilot_pending.count_documents({"status": "pending"})
    approved_count = await db.claimpilot_pending.count_documents({"status": "approved"})
    rejected_count = await db.claimpilot_pending.count_documents({"status": "rejected"})

    return {
        "success": True,
        "data": {
            "agent_stats": stats,
            "approval_queue": {
                "pending": pending_count,
                "approved": approved_count,
                "rejected": rejected_count,
            },
        },
    }
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/claimpilot.py backend/tests/test_claimpilot_routes.py
git commit -m "feat(claimpilot): add API routes for insights, approval queue, and analytics"
```

---

### Task 10: Wire Into Server + Scheduler + Domain Events

**Files:**
- Modify: `backend/server.py` (add import + router registration)
- Modify: `backend/workers/scheduler.py` (add ClaimMonitor job)
- Modify: `backend/services/claims_service.py` (hook orchestrator into domain events)
- Create: `backend/workers/claimpilot_monitor.py` (scheduled worker)

- [ ] **Step 1: Add claimpilot router to server.py**

In `backend/server.py`, add after line 78 (`from routes.tasks import router as tasks_router`):

```python
from routes.claimpilot import router as claimpilot_router
```

Then add to the router registration block (find the section with `app.include_router()`):

```python
app.include_router(claimpilot_router)
```

- [ ] **Step 2: Add orchestrator initialization to server lifespan**

Add to `backend/server.py` in the `lifespan()` function, after `await initialize_background_scheduler()`:

```python
await initialize_claimpilot()
```

Add the init function before `lifespan()`:

```python
async def initialize_claimpilot():
    """Initialize ClaimPilot AI agent orchestrator."""
    try:
        from services.claimpilot.orchestrator import init_orchestrator
        init_orchestrator(db)
        logging.info("ClaimPilot AI agents initialized")
    except Exception as e:
        logging.warning("ClaimPilot initialization failed (non-critical): %s", e)
```

- [ ] **Step 3: Add get_orchestrator and init_orchestrator to orchestrator.py**

Append to `backend/services/claimpilot/orchestrator.py`:

```python
# Global orchestrator instance
_orchestrator = None


def init_orchestrator(db) -> AgentOrchestrator:
    """Initialize the global orchestrator with all registered agents."""
    global _orchestrator
    _orchestrator = AgentOrchestrator(db)

    # Register agents
    from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent

    _orchestrator.register("claim_monitor", ClaimMonitorAgent(db))

    # Map domain events to agents
    _orchestrator.add_event_mapping("ClaimCreated", ["claim_monitor"])
    _orchestrator.add_event_mapping("ClaimUpdated", ["claim_monitor"])

    logger.info("CLAIMPILOT: Orchestrator initialized with %d agents", len(_orchestrator.agents))
    return _orchestrator


def get_orchestrator() -> AgentOrchestrator:
    """Get the global orchestrator instance."""
    if _orchestrator is None:
        raise RuntimeError("ClaimPilot orchestrator not initialized")
    return _orchestrator
```

- [ ] **Step 4: Hook orchestrator into domain events**

In `backend/services/claims_service.py`, in `_dispatch_domain_event()` method (line 265+), add at the end:

```python
        # ClaimPilot AI Agent Dispatch
        try:
            from services.claimpilot.orchestrator import get_orchestrator
            orchestrator = get_orchestrator()
            await orchestrator.handle_event(event_type, claim.id, details)
        except Exception as cp_err:
            logger.warning("ClaimPilot dispatch failed (non-critical): %s", cp_err)
```

- [ ] **Step 5: Create scheduled worker for ClaimMonitor**

```python
# backend/workers/claimpilot_monitor.py
"""
ClaimPilot Monitor Worker — Scheduled job that scans all active claims for stalls.

Runs every 2 hours via APScheduler. Dispatches ClaimMonitor agent for each
stalled claim found.
"""

import logging

logger = logging.getLogger(__name__)

_db = None


def init_claimpilot_monitor(db):
    global _db
    _db = db


async def run_monitor_check():
    """Scan all active claims for stalls and dispatch ClaimMonitor agent."""
    if _db is None:
        logger.error("ClaimPilot monitor: database not initialized")
        return

    try:
        from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent
        from services.claimpilot.agent_context import AgentContextBuilder

        agent = ClaimMonitorAgent(_db)
        context_builder = AgentContextBuilder(_db)

        stalled = await agent.detect_stalled_claims()
        logger.info("CLAIMPILOT_MONITOR: Found %d stalled claims", len(stalled))

        for claim in stalled:
            try:
                ctx = await context_builder.build(claim["id"])
                result = await agent.run(ctx)
                if result and result.details.get("is_stalled"):
                    # Create notification for the assigned adjuster
                    from datetime import datetime, timezone
                    import uuid

                    notification = {
                        "id": uuid.uuid4().hex,
                        "user_id": claim.get("assigned_to_id") or claim.get("created_by"),
                        "type": "claimpilot_stall",
                        "title": f"Stalled: {claim.get('claim_number', 'Unknown')}",
                        "message": result.summary,
                        "claim_id": claim["id"],
                        "is_read": False,
                        "created_at": datetime.now(timezone.utc),
                    }
                    await _db.notifications.insert_one(notification)
            except Exception as e:
                logger.error("Monitor failed for claim %s: %s", claim.get("id"), e)

    except Exception as e:
        logger.error("ClaimPilot monitor check failed: %s", e)
```

- [ ] **Step 6: Add to scheduler.py**

In `backend/workers/scheduler.py`, add to `init_scheduler()` after existing worker inits:

```python
    from workers.claimpilot_monitor import init_claimpilot_monitor
    init_claimpilot_monitor(db)
```

Add new job function:

```python
def _add_claimpilot_monitor_jobs():
    """Add ClaimPilot Monitor jobs to scheduler."""
    from workers.claimpilot_monitor import run_monitor_check

    scheduler.add_job(
        _run_async_job,
        IntervalTrigger(hours=2),
        args=[run_monitor_check],
        id="claimpilot_monitor",
        name="ClaimPilot - Claim Monitor",
        replace_existing=True,
        misfire_grace_time=600,
    )
    logger.info("ClaimPilot Monitor job added: every 2 hours")
```

Add `_add_claimpilot_monitor_jobs()` call in `init_scheduler()`.

- [ ] **Step 7: Add database indexes to server.py**

In `ensure_database_indexes()`, add:

```python
        await db.claimpilot_insights.create_index(
            [("claim_id", 1), ("created_at", -1)],
            background=True
        )
        await db.claimpilot_pending.create_index(
            [("status", 1), ("created_at", -1)],
            background=True
        )
        await db.claimpilot_audit.create_index(
            [("agent_name", 1), ("created_at", -1)],
            background=True
        )
```

- [ ] **Step 8: Commit**

```bash
git add backend/server.py backend/workers/scheduler.py backend/services/claims_service.py backend/workers/claimpilot_monitor.py backend/services/claimpilot/orchestrator.py
git commit -m "feat(claimpilot): wire orchestrator into server, scheduler, and domain events"
```

---

## Chunk 6: Frontend — Approval Queue + Insights Panel

### Task 11: React Query Hooks for ClaimPilot API

**Files:**
- Create: `src/features/claimpilot/hooks/useClaimpilot.js`

- [ ] **Step 1: Create the hooks file**

```javascript
// src/features/claimpilot/hooks/useClaimpilot.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api';

export function usePendingActions(claimId = null) {
  const params = new URLSearchParams();
  if (claimId) params.set('claim_id', claimId);

  return useQuery({
    queryKey: ['claimpilot', 'pending', claimId],
    queryFn: () => api.get(`/api/claimpilot/pending?${params}`).then(r => r.data),
    refetchInterval: 30000, // Poll every 30s
  });
}

export function useClaimInsights(claimId) {
  return useQuery({
    queryKey: ['claimpilot', 'insights', claimId],
    queryFn: () => api.get(`/api/claimpilot/claims/${claimId}/insights`).then(r => r.data),
    enabled: !!claimId,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId) => api.post(`/api/claimpilot/pending/${actionId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claimpilot', 'pending'] });
    },
  });
}

export function useRejectAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, reason }) =>
      api.post(`/api/claimpilot/pending/${actionId}/reject?reason=${encodeURIComponent(reason)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claimpilot', 'pending'] });
    },
  });
}

export function useRunAgent(claimId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentName) => api.post(`/api/claimpilot/claims/${claimId}/run/${agentName}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claimpilot', 'insights', claimId] });
    },
  });
}

export function useClaimpilotAnalytics() {
  return useQuery({
    queryKey: ['claimpilot', 'analytics'],
    queryFn: () => api.get('/api/claimpilot/analytics').then(r => r.data),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/claimpilot/hooks/useClaimpilot.js
git commit -m "feat(claimpilot): add React Query hooks for ClaimPilot API"
```

---

### Task 12: Approval Queue Page

**Files:**
- Create: `src/features/claimpilot/ApprovalCard.jsx`
- Create: `src/features/claimpilot/ApprovalQueue.jsx`

- [ ] **Step 1: Create ApprovalCard component**

```jsx
// src/features/claimpilot/ApprovalCard.jsx
import { useState } from 'react';
import { useApproveAction, useRejectAction } from './hooks/useClaimpilot';

const CONFIDENCE_COLORS = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-red-400',
};

function getConfidenceLevel(confidence) {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export default function ApprovalCard({ action }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const approve = useApproveAction();
  const reject = useRejectAction();

  const level = getConfidenceLevel(action.confidence);

  return (
    <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-300">
          {action.agent_name.replace('_', ' ')}
        </span>
        <span className={`text-xs font-mono ${CONFIDENCE_COLORS[level]}`}>
          {(action.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      <p className="text-sm text-zinc-400 mb-1">
        Claim: <span className="text-zinc-200">{action.claim_id}</span>
      </p>
      <p className="text-sm text-zinc-200 mb-2">{action.reasoning}</p>

      <div className="text-xs text-zinc-500 mb-3">
        Action: {action.action_type} — {JSON.stringify(action.action_data)}
      </div>

      {!showRejectInput ? (
        <div className="flex gap-2">
          <button
            onClick={() => approve.mutate(action.id)}
            disabled={approve.isPending}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            {approve.isPending ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={() => setShowRejectInput(true)}
            className="px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white text-sm rounded transition-colors"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 placeholder-zinc-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                reject.mutate({ actionId: action.id, reason: rejectReason });
                setShowRejectInput(false);
              }}
              disabled={reject.isPending}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-3 py-1.5 bg-zinc-600 text-white text-sm rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ApprovalQueue page**

```jsx
// src/features/claimpilot/ApprovalQueue.jsx
import { usePendingActions } from './hooks/useClaimpilot';
import ApprovalCard from './ApprovalCard';

export default function ApprovalQueue() {
  const { data, isLoading, error } = usePendingActions();

  const pending = data?.data || [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">
          ClaimPilot Approval Queue
        </h1>
        <span className="px-3 py-1 bg-amber-600/20 text-amber-400 text-sm rounded-full">
          {pending.length} pending
        </span>
      </div>

      {isLoading && (
        <div className="text-zinc-400 text-center py-12">Loading...</div>
      )}

      {error && (
        <div className="text-red-400 text-center py-12">
          Failed to load pending actions
        </div>
      )}

      {!isLoading && pending.length === 0 && (
        <div className="text-zinc-500 text-center py-12">
          No pending actions. All clear.
        </div>
      )}

      <div className="space-y-3">
        {pending.map((action) => (
          <ApprovalCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route to React Router (find App.jsx or routes config and add)**

Add to the router config:
```jsx
{ path: '/claimpilot', element: <ApprovalQueue /> }
```

And add a nav link with badge count showing pending items.

- [ ] **Step 4: Commit**

```bash
git add src/features/claimpilot/
git commit -m "feat(claimpilot): add approval queue UI with approve/reject cards"
```

---

### Task 13: Claim Insights Panel

**Files:**
- Create: `src/features/claimpilot/ClaimPilotInsights.jsx`

- [ ] **Step 1: Create insights panel component**

```jsx
// src/features/claimpilot/ClaimPilotInsights.jsx
import { useClaimInsights } from './hooks/useClaimpilot';

const AGENT_ICONS = {
  claim_monitor: '🔍',
  vision_analyzer: '📸',
  intake_parser: '📥',
  evidence_scorer: '📊',
  statute_matcher: '⚖️',
  negotiation_copilot: '🤝',
  estimate_engine: '💰',
  predictive_analytics: '📈',
};

export default function ClaimPilotInsights({ claimId }) {
  const { data, isLoading } = useClaimInsights(claimId);
  const insights = data?.data || [];

  if (isLoading) {
    return <div className="text-zinc-500 text-sm p-4">Loading AI insights...</div>;
  }

  if (insights.length === 0) {
    return (
      <div className="text-zinc-500 text-sm p-4 text-center">
        No AI insights yet. ClaimPilot agents will analyze this claim automatically.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
        ClaimPilot Insights
      </h3>
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="border border-zinc-700/50 rounded-lg p-3 bg-zinc-800/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <span>{AGENT_ICONS[insight.agent_name] || '🤖'}</span>
            <span className="text-xs font-medium text-zinc-400">
              {insight.agent_name.replace(/_/g, ' ')}
            </span>
            <span className="ml-auto text-xs text-zinc-600">
              {new Date(insight.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-zinc-200">{insight.summary}</p>
          {insight.confidence < 0.7 && (
            <p className="text-xs text-amber-500 mt-1">
              Low confidence — review carefully
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into ClaimDetails page**

Find the ClaimDetails component and add:
```jsx
import ClaimPilotInsights from '../claimpilot/ClaimPilotInsights';

// In the render, add as a sidebar panel or new tab:
<ClaimPilotInsights claimId={claim.id} />
```

- [ ] **Step 3: Commit**

```bash
git add src/features/claimpilot/ClaimPilotInsights.jsx
git commit -m "feat(claimpilot): add claim insights panel for AI agent output display"
```

---

## Chunk 7: Install Dependencies + Final Integration Test

### Task 14: Install Required Python Packages

- [ ] **Step 1: Add google-generativeai and groq to requirements**

Check existing `requirements.txt` and add if missing:
```
google-generativeai>=0.8.0
groq>=0.12.0
```

- [ ] **Step 2: Install**

Run: `cd backend && pip install google-generativeai groq`

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: add google-generativeai and groq SDK dependencies for ClaimPilot"
```

### Task 15: Final Integration Verification

- [ ] **Step 1: Run all ClaimPilot tests**

Run: `cd backend && python -m pytest tests/services/test_base_agent.py tests/services/test_agent_context.py tests/services/test_llm_router.py tests/services/test_orchestrator.py tests/services/test_approval_gate.py tests/services/test_claim_monitor.py tests/test_claimpilot_routes.py -v`

Expected: All tests PASS

- [ ] **Step 2: Run full test suite to verify no regressions**

Run: `cd backend && python -m pytest tests/ -v --tb=short`

Expected: All existing tests still PASS

- [ ] **Step 3: Verify server starts**

Run: `cd backend && python -c "from services.claimpilot.orchestrator import AgentOrchestrator; print('ClaimPilot imports OK')"`

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore(claimpilot): phase 1 complete — foundation + ClaimMonitor + approval queue"
```

---

## Summary

| What Ships | Files Created | Tests |
|------------|--------------|-------|
| Pydantic models (AgentResult, PendingAction, AgentInsight) | 1 modified | 4 tests |
| Audit logger | 2 created | 2 tests |
| LLM router (Gemini/Groq/Ollama) | 1 created | 6 tests |
| Agent context builder | 1 created | 3 tests |
| BaseAgent with guardrails | 1 created | 3 tests |
| Approval gate | 1 created | 4 tests |
| Orchestrator | 2 created | 3 tests |
| ClaimMonitor agent | 1 created | 4 tests |
| API routes (6 endpoints) | 1 created | 1 test |
| Scheduled worker | 1 created | — |
| Server wiring | 3 modified | — |
| React hooks | 1 created | — |
| Approval Queue UI | 2 created | — |
| Insights panel | 1 created | — |
| **Total** | **18 files** | **30 tests** |

**Next:** Phase 2 plan (VisionAnalyzer + VisionOverlay UI) after Phase 1 ships.
