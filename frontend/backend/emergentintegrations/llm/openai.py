"""
Stub for emergentintegrations.llm.openai
"""

class OpenAISpeechToText:
    """Stub for OpenAI Speech-to-Text"""
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "Speech-to-text requires OPENAI_API_KEY. Configure in production."
        )
    
    async def transcribe(self, *args, **kwargs):
        raise NotImplementedError("OpenAI API key not configured")


class LlmChat:
    """Stub for LLM Chat (alias)"""
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "LLM integration not available. Configure OpenAI or Anthropic API keys."
        )


class UserMessage:
    """Stub for UserMessage (alias)"""
    def __init__(self, content: str, *args, **kwargs):
        self.content = content
