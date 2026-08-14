"""Gemini adapter behaviour that does not depend on reaching Gemini.

Mirrors test_vision_client.py's structure, but text-only multi-turn instead
of a single image-plus-prompt call: the SDK call itself is replaced, and
what is under test is the translation of credentials and provider failures
into domain errors, plus the multi-turn request shape this adapter builds
that no other adapter in this service needs to.
"""

from __future__ import annotations

import asyncio
import json
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Literal

import pytest
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.domain.content_generation.errors import (
    AIRefusalError,
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
    AITimeoutError,
)
from app.infrastructure import config, marketing_assistant_client
from app.schemas.marketing_assistant import ChatMessage


@pytest.fixture(autouse=True)
def _isolated_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Both the settings and the SDK client are cached for the process lifetime,
    so each test starts from an empty cache and a known environment.

    The cached factory is captured up front because other fixtures replace the
    module attribute, and teardown still has to clear the real one.
    """
    cached_client = marketing_assistant_client._client

    config.get_settings.cache_clear()
    cached_client.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    yield
    config.get_settings.cache_clear()
    cached_client.cache_clear()


def _messages(*turns: tuple[Literal["user", "assistant"], str]) -> list[ChatMessage]:
    return [ChatMessage(role=role, content=content) for role, content in turns]


async def test_missing_api_key_names_the_variable() -> None:
    with pytest.raises(AIServiceConfigurationError, match="GEMINI_API_KEY is not configured"):
        await marketing_assistant_client.chat(_messages(("user", "What should I post today?")))


def _fail_with(error: Exception) -> Any:
    async def _raise(**_: object) -> None:
        raise error

    return _raise


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    return marketing_assistant_client._client()


async def test_a_quota_rejection_becomes_a_retryable_error(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    quota_exceeded = genai_errors.ClientError(
        429, {"error": {"message": "Quota exceeded", "status": "RESOURCE_EXHAUSTED"}}
    )
    monkeypatch.setattr(configured.aio.models, "generate_content", _fail_with(quota_exceeded))

    with pytest.raises(AIServiceBusyError, match="temporarily busy"):
        await marketing_assistant_client.chat(_messages(("user", "Hello")))


async def test_other_client_errors_are_not_reported_as_retryable(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bad_request = genai_errors.ClientError(
        400, {"error": {"message": "Bad request", "status": "INVALID_ARGUMENT"}}
    )
    monkeypatch.setattr(configured.aio.models, "generate_content", _fail_with(bad_request))

    with pytest.raises(AIServiceError) as raised:
        await marketing_assistant_client.chat(_messages(("user", "Hello")))

    assert not isinstance(raised.value, AIServiceBusyError)


async def test_a_provider_outage_becomes_a_service_error(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    outage = genai_errors.ServerError(
        503, {"error": {"message": "Overloaded", "status": "UNAVAILABLE"}}
    )
    monkeypatch.setattr(configured.aio.models, "generate_content", _fail_with(outage))

    with pytest.raises(AIServiceError, match="currently unavailable"):
        await marketing_assistant_client.chat(_messages(("user", "Hello")))


async def test_a_slow_provider_times_out(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _hang(**_: object) -> None:
        await asyncio.sleep(1)

    monkeypatch.setattr(marketing_assistant_client, "_REQUEST_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(configured.aio.models, "generate_content", _hang)

    with pytest.raises(AITimeoutError, match="took too long"):
        await marketing_assistant_client.chat(_messages(("user", "Hello")))


ReplyMode = Literal["ok", "blocked"]


class _StubGemini:
    """Serves one canned generateContent reply and records the request.

    Exercises the real SDK - serialisation of the multi-turn contents, and
    reading back the reply text - without leaving the machine.
    """

    def __init__(self, mode: ReplyMode = "ok") -> None:
        self.request: dict[str, Any] = {}
        self.mode = mode
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                length = int(self.headers["Content-Length"])
                stub.request = json.loads(self.rfile.read(length))
                body = stub._reply()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args: object) -> None:
                pass

        self._server = HTTPServer(("127.0.0.1", 0), Handler)
        self.base_url = f"http://127.0.0.1:{self._server.server_port}"

    def _reply(self) -> bytes:
        if self.mode == "blocked":
            # No candidate at all: what a safety-blocked prompt looks like.
            return json.dumps(
                {
                    "promptFeedback": {"blockReason": "SAFETY"},
                    "modelVersion": marketing_assistant_client.MODEL_NAME,
                }
            ).encode()

        return json.dumps(
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        "Post your weekend special today - it always does "
                                        "well on a Friday."
                                    )
                                }
                            ],
                            "role": "model",
                        },
                        "finishReason": "STOP",
                    }
                ],
                "modelVersion": marketing_assistant_client.MODEL_NAME,
            }
        ).encode()

    def __enter__(self) -> _StubGemini:
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._server.shutdown()
        self._server.server_close()


def _gemini_stub(monkeypatch: pytest.MonkeyPatch, mode: ReplyMode = "ok") -> Iterator[_StubGemini]:
    with _StubGemini(mode=mode) as stub:
        client = genai.Client(
            api_key="stub-key",
            http_options=types.HttpOptions(base_url=stub.base_url),
        )
        monkeypatch.setattr(marketing_assistant_client, "_client", lambda: client)
        yield stub


@pytest.fixture
def gemini_stub(monkeypatch: pytest.MonkeyPatch) -> Iterator[_StubGemini]:
    yield from _gemini_stub(monkeypatch, mode="ok")


@pytest.fixture
def blocked_gemini_stub(monkeypatch: pytest.MonkeyPatch) -> Iterator[_StubGemini]:
    yield from _gemini_stub(monkeypatch, mode="blocked")


async def test_sends_the_reply_text_back(gemini_stub: _StubGemini) -> None:
    result = await marketing_assistant_client.chat(_messages(("user", "What should I post today?")))

    assert result == "Post your weekend special today - it always does well on a Friday."


async def test_sends_a_single_turn_as_one_user_content(gemini_stub: _StubGemini) -> None:
    await marketing_assistant_client.chat(_messages(("user", "What should I post today?")))

    contents = gemini_stub.request["contents"]
    assert len(contents) == 1
    assert contents[0]["role"] == "user"
    assert contents[0]["parts"] == [{"text": "What should I post today?"}]


async def test_sends_multi_turn_history_in_order_with_roles_translated(
    gemini_stub: _StubGemini,
) -> None:
    """Gemini's multi-turn roles are "user" and "model" - our own "assistant"
    role is translated to "model" on the way into the request."""
    await marketing_assistant_client.chat(
        _messages(
            ("user", "What should I post today?"),
            ("assistant", "Try a weekend special post."),
            ("user", "Give me an example caption."),
        )
    )

    contents = gemini_stub.request["contents"]
    assert [content["role"] for content in contents] == ["user", "model", "user"]
    assert [content["parts"][0]["text"] for content in contents] == [
        "What should I post today?",
        "Try a weekend special post.",
        "Give me an example caption.",
    ]


async def test_the_restaurant_context_reaches_the_system_instruction(
    gemini_stub: _StubGemini,
) -> None:
    await marketing_assistant_client.chat(
        _messages(("user", "What should I post today?")),
        tone_of_voice="luxury",
        cuisine_type="Neapolitan pizza",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "Write in a luxury tone." in instruction
    assert "It is a Neapolitan pizza restaurant." in instruction
    assert "The restaurant is in Italy." in instruction
    assert "Write for young professionals." in instruction
    assert "Write your replies in German" in instruction


async def test_the_activity_summary_reaches_the_system_instruction(
    gemini_stub: _StubGemini,
) -> None:
    await marketing_assistant_client.chat(
        _messages(("user", "What should I post today?")),
        activity_summary="Recently posted about the Margherita pizza.",
    )

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "Recently posted about the Margherita pizza." in instruction


async def test_without_context_the_system_instruction_stays_generic(
    gemini_stub: _StubGemini,
) -> None:
    await marketing_assistant_client.chat(_messages(("user", "What should I post today?")))

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "About this restaurant" not in instruction
    assert "Recent activity" not in instruction
    assert "Digital Marketing Manager" in instruction


async def test_does_not_ask_for_structured_json_output(gemini_stub: _StubGemini) -> None:
    """A chat reply is free text, not a rigid object - there is nothing here
    for a response_schema to constrain."""
    await marketing_assistant_client.chat(_messages(("user", "What should I post today?")))

    generation_config = gemini_stub.request.get("generationConfig", {})
    assert "responseSchema" not in generation_config
    assert generation_config.get("responseMimeType") != "application/json"


async def test_a_blocked_response_is_reported_as_a_refusal(
    blocked_gemini_stub: _StubGemini,
) -> None:
    with pytest.raises(AIRefusalError, match="declined to reply"):
        await marketing_assistant_client.chat(_messages(("user", "What should I post today?")))
