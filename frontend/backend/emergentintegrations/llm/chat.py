"""
Stub for emergentintegrations.llm.chat
Placeholders for local development. Real LLM calls use OpenAI/Anthropic.
"""

class LlmChat:
    """Stub for LLM Chat"""
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "LLM integration not available in local development. "
            "Configure OpenAI_API_KEY or ANTHROPIC_API_KEY for production."
        )


class UserMessage:
    """Stub for UserMessage"""
    def __init__(self, content: str, *args, **kwargs):
        self.content = content
