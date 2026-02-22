from services.ollama_config import (
    DEFAULT_OLLAMA_BASE_URL,
    DEFAULT_OLLAMA_MODEL,
    extract_ollama_error_detail,
    get_ollama_api_key,
    get_ollama_model,
    normalize_ollama_base_url,
    ollama_endpoint,
)


def test_normalize_ollama_base_url_defaults_and_api_suffix():
    assert normalize_ollama_base_url(None) == DEFAULT_OLLAMA_BASE_URL
    assert normalize_ollama_base_url("ollama.com") == DEFAULT_OLLAMA_BASE_URL
    assert normalize_ollama_base_url("https://ollama.com/api") == DEFAULT_OLLAMA_BASE_URL
    assert normalize_ollama_base_url("https://ollama.com/api/") == DEFAULT_OLLAMA_BASE_URL


def test_ollama_endpoint_avoids_double_api_prefix():
    assert ollama_endpoint("https://ollama.com", "/api/chat") == "https://ollama.com/api/chat"
    assert ollama_endpoint("https://ollama.com/api", "/api/chat") == "https://ollama.com/api/chat"


def test_get_ollama_api_key_supports_legacy_names_and_strips_whitespace():
    env = {"OLLAMA_API_TOKEN": "  token123  "}
    assert get_ollama_api_key(env) == "token123"

    env = {"OLLAMA_TOKEN": "\nabc\n"}
    assert get_ollama_api_key(env) == "abc"

    env = {}
    assert get_ollama_api_key(env) == ""


def test_get_ollama_model_uses_default_when_missing():
    assert get_ollama_model({}) == DEFAULT_OLLAMA_MODEL
    assert get_ollama_model({"OLLAMA_MODEL": "  gemma3:27b  "}) == "gemma3:27b"


def test_extract_ollama_error_detail_handles_payload_shapes():
    assert extract_ollama_error_detail({"error": "invalid key"}) == "invalid key"
    assert extract_ollama_error_detail({"message": " model not found "}) == "model not found"
    assert extract_ollama_error_detail(["one", "two"]) == "one, two"
    assert extract_ollama_error_detail("  noisy\n detail  ") == "noisy detail"
