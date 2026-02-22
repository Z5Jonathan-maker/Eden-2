#!/usr/bin/env python3
"""
Split ai.py into logical modules

Original: 1638 lines (prompts + models + routes)
After:
- models.py (~150 lines) - Pydantic models
- prompts.py (~500 lines) - FIRM_CONTEXT, EVE_SYSTEM_PROMPT, knowledge functions
- chat.py (~300 lines) - Chat and session routes
- copilot.py (~400 lines) - Copilot action routes
- context.py (~200 lines) - Context and upload routes

Cimadevilla Operating Stack - Layer 2:
- Separate concerns for AI subsystems
- Clear boundaries between chat, copilot, and context features
"""

import os

print("Splitting ai.py (1638 lines)...")
print("=" * 60)

# Read source
with open("../routes/ai.py", 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Create output directory
os.makedirs("../routes/ai", exist_ok=True)

# Common imports for all modules
COMMON_IMPORTS = """from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import logging
import uuid
import re
import json

logger = logging.getLogger(__name__)

# Import the Emergent LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.ai_routing_policy import (
    resolve_provider_order_for_task as resolve_policy_provider_order_for_task,
    sanitize_provider_order as sanitize_policy_provider_order,
    load_runtime_routing_config as load_policy_runtime_routing_config,
)

# Get the Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
"""

# Extract sections using line numbers from grep analysis
# Models: lines 504-600 (approximately)
models_start = None
models_end = None
for i, line in enumerate(lines):
    if "class ChatMessage(BaseModel):" in line:
        models_start = i
    if models_start and "@router.post(\"/chat\"" in line:
        models_end = i - 1
        break

# Prompts/Constants: lines 27-503
prompts_start = None
prompts_end = models_start - 1 if models_start else 500
for i, line in enumerate(lines):
    if "FIRM_CONTEXT = " in line:
        prompts_start = i
        break

# Routes sections
chat_routes_start = None
copilot_routes_start = None
context_routes_start = None

for i, line in enumerate(lines):
    if "@router.post(\"/chat\"" in line:
        chat_routes_start = i
    if "@router.post(\"/claims/{claim_id}/copilot-next-actions\"" in line:
        copilot_routes_start = i
    if "@router.get(\"/claims-for-context\")" in line:
        context_routes_start = i

print(f"Models: lines {models_start+1 if models_start else 'N/A'} to {models_end+1 if models_end else 'N/A'}")
print(f"Prompts: lines {prompts_start+1 if prompts_start else 'N/A'} to {prompts_end+1}")
print(f"Chat routes start: line {chat_routes_start+1 if chat_routes_start else 'N/A'}")
print(f"Copilot routes start: line {copilot_routes_start+1 if copilot_routes_start else 'N/A'}")
print(f"Context routes start: line {context_routes_start+1 if context_routes_start else 'N/A'}")

# 1. Extract models.py
if models_start and models_end:
    models_content = f'''"""
AI Module - Pydantic Models

Request/response models for AI chat, copilot, and context features.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

{chr(10).join(lines[models_start:models_end+1])}
'''

    with open("../routes/ai/models.py", 'w', encoding='utf-8') as f:
        f.write(models_content)
    print("Created routes/ai/models.py")

# 2. Extract prompts.py
if prompts_start and prompts_end:
    prompts_content = f'''"""
AI Module - Prompts and Knowledge Base

System prompts, firm context, and knowledge retrieval functions for Eve AI.
"""

from dependencies import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

{chr(10).join(lines[prompts_start:prompts_end+1])}
'''

    with open("../routes/ai/prompts.py", 'w', encoding='utf-8') as f:
        f.write(prompts_content)
    print("Created routes/ai/prompts.py")

# 3. Extract chat routes (from chat_routes_start to copilot_routes_start)
if chat_routes_start and copilot_routes_start:
    chat_content = f'''"""
AI Module - Chat Routes

Eve AI chat interface, session management, and conversation history.
"""

{COMMON_IMPORTS}

from .models import ChatMessage, ChatRequest, ChatResponse
from .prompts import EVE_SYSTEM_PROMPT, FIRM_CONTEXT, build_eve_context_with_florida_laws, get_claim_data_for_eve

router = APIRouter()

{chr(10).join(lines[chat_routes_start:copilot_routes_start])}
'''

    with open("../routes/ai/chat.py", 'w', encoding='utf-8') as f:
        f.write(chat_content)
    print("Created routes/ai/chat.py")

# 4. Extract copilot routes (from copilot_routes_start to context_routes_start)
if copilot_routes_start and context_routes_start:
    copilot_content = f'''"""
AI Module - Copilot Routes

Claim copilot, comms copilot, and team copilot AI assistance.
"""

{COMMON_IMPORTS}

from .models import (
    ClaimCopilotAction, ClaimEvidenceGap, ClaimCopilotResponse,
    CommsCopilotRequest, CommsCopilotResponse,
    TeamCommsCopilotRequest, TeamCommsCopilotResponse
)
from .prompts import FIRM_CONTEXT

router = APIRouter()

{chr(10).join(lines[copilot_routes_start:context_routes_start])}
'''

    with open("../routes/ai/copilot.py", 'w', encoding='utf-8') as f:
        f.write(copilot_content)
    print("Created routes/ai/copilot.py")

# 5. Extract context routes (from context_routes_start to end)
if context_routes_start:
    context_content = f'''"""
AI Module - Context Routes

Claim context retrieval and document upload for AI analysis.
"""

{COMMON_IMPORTS}

router = APIRouter()

{chr(10).join(lines[context_routes_start:])}
'''

    with open("../routes/ai/context.py", 'w', encoding='utf-8') as f:
        f.write(context_content)
    print("Created routes/ai/context.py")

# 6. Create __init__.py
init_content = '''"""
AI Module - Unified Router

Eve AI assistant with chat, copilot, and context features.
Modularized from 1638-line monolith for better maintainability.
"""

from fastapi import APIRouter
from .chat import router as chat_router
from .copilot import router as copilot_router
from .context import router as context_router

router = APIRouter(prefix="/api/ai", tags=["AI"])

# Include all sub-routers
router.include_router(chat_router, tags=["Chat"])
router.include_router(copilot_router, tags=["Copilot"])
router.include_router(context_router, tags=["Context"])
'''

with open("../routes/ai/__init__.py", 'w', encoding='utf-8') as f:
    f.write(init_content)
print("Created routes/ai/__init__.py")

# Count lines
print("\n" + "=" * 60)
print("Extraction Complete!")
print("=" * 60)
print(f"\nOriginal: 1638 lines")
print(f"\nNew structure:")
print(f"  models.py: Pydantic schemas")
print(f"  prompts.py: System prompts and knowledge base")
print(f"  chat.py: Chat and session routes")
print(f"  copilot.py: Copilot action routes")
print(f"  context.py: Context and upload routes")
print(f"  __init__.py: Router aggregator")

print("\nNext Steps:")
print("1. Update server.py:")
print("   from routes.ai import router as ai_router")
print("2. Test all AI endpoints")
print("3. Verify Eve chat, copilot actions, and document upload")
print("4. Consider deprecating routes/ai.py (old file)")
