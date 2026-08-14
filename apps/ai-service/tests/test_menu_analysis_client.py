"""Gemini adapter behaviour that does not depend on reaching Gemini.

Mirrors test_vision_client.py: image-based, the same SDK call is replaced,
and what is under test is the translation of credentials and provider
failures into domain errors, plus this domain's own response schema.
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Literal

import pytest
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.domain.content_generation.errors import (
    AIRefusalError,
    AIResponseMalformedError,
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
    AITimeoutError,
)
from app.infrastructure import config, menu_analysis_client


@pytest.fixture(autouse=True)
def _isolated_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Both the settings and the SDK client are cached for the process lifetime,
    so each test starts from an empty cache and a known environment.

    The cached factory is captured up front because other fixtures replace the
    module attribute, and teardown still has to clear the real one.
    """
    cached_client = menu_analysis_client._client

    config.get_settings.cache_clear()
    cached_client.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    yield
    config.get_settings.cache_clear()
    cached_client.cache_clear()


async def test_missing_api_key_names_the_variable(jpeg_bytes: bytes) -> None:
    with pytest.raises(AIServiceConfigurationError, match="GEMINI_API_KEY is not configured"):
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")


def _fail_with(error: Exception) -> Any:
    async def _raise(**_: object) -> None:
        raise error

    return _raise


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    return menu_analysis_client._client()


async def test_a_quota_rejection_becomes_a_retryable_error(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
    jpeg_bytes: bytes,
) -> None:
    quota_exceeded = genai_errors.ClientError(
        429, {"error": {"message": "Quota exceeded", "status": "RESOURCE_EXHAUSTED"}}
    )
    monkeypatch.setattr(configured.aio.models, "generate_content", _fail_with(quota_exceeded))

    with pytest.raises(AIServiceBusyError, match="temporarily busy"):
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")


async def test_other_client_errors_are_not_reported_as_retryable(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
    jpeg_bytes: bytes,
) -> None:
    bad_request = genai_errors.ClientError(
        400, {"error": {"message": "Bad request", "status": "INVALID_ARGUMENT"}}
    )
    monkeypatch.setattr(configured.aio.models, "generate_content", _fail_with(bad_request))

    with pytest.raises(AIServiceError) as raised:
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")

    assert not isinstance(raised.value, AIServiceBusyError)


async def test_a_provider_outage_becomes_a_service_error(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
    jpeg_bytes: bytes,
) -> None:
    outage = genai_errors.ServerError(
        503, {"error": {"message": "Overloaded", "status": "UNAVAILABLE"}}
    )
    monkeypatch.setattr(configured.aio.models, "generate_content", _fail_with(outage))

    with pytest.raises(AIServiceError, match="currently unavailable"):
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")


async def test_a_slow_provider_times_out(
    configured: Any,
    monkeypatch: pytest.MonkeyPatch,
    jpeg_bytes: bytes,
) -> None:
    async def _hang(**_: object) -> None:
        await asyncio.sleep(1)

    monkeypatch.setattr(menu_analysis_client, "_REQUEST_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(configured.aio.models, "generate_content", _hang)

    with pytest.raises(AITimeoutError, match="took too long"):
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")


def test_the_response_schema_carries_no_internal_prose() -> None:
    """Pydantic copies a model's docstring into the JSON schema's "description",
    which would ship internal notes to Gemini on every single request."""
    schema = menu_analysis_client._GeminiMenuAnalysis.model_json_schema()

    _assert_no_description(schema)


def _assert_no_description(schema: dict[str, Any]) -> None:
    assert "description" not in schema
    for field_schema in schema.get("properties", {}).values():
        assert "description" not in field_schema
    for def_schema in schema.get("$defs", {}).values():
        _assert_no_description(def_schema)


ReplyMode = Literal["ok", "blocked", "malformed"]


class _StubGemini:
    """Serves one canned generateContent reply and records the request.

    Exercises the real SDK - serialisation of the schema, and parsing of the
    reply - without leaving the machine.
    """

    def __init__(self, mode: ReplyMode = "ok", delay_seconds: float = 0) -> None:
        self.request: dict[str, Any] = {}
        self.mode = mode
        self.delay_seconds = delay_seconds
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:
                length = int(self.headers["Content-Length"])
                stub.request = json.loads(self.rfile.read(length))
                if stub.delay_seconds:
                    time.sleep(stub.delay_seconds)
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
                    "modelVersion": menu_analysis_client.MODEL_NAME,
                }
            ).encode()

        if self.mode == "malformed":
            generated_text = "this is not valid json {"
        else:
            generated_text = json.dumps(
                {
                    "overview": "A single-page Italian dinner menu.",
                    "pricing_notes": "Pizzas range from 9 to 14 EUR.",
                    "description_quality": "Starter descriptions are appetising.",
                    "upselling_ideas": ["Idea one.", "Idea two.", "Idea three."],
                    "cross_selling_ideas": ["Pair one.", "Pair two.", "Pair three."],
                    "missing_items": [],
                    "improvement_suggestions": ["Fix one.", "Fix two.", "Fix three."],
                }
            )

        return json.dumps(
            {
                "candidates": [
                    {
                        "content": {"parts": [{"text": generated_text}], "role": "model"},
                        "finishReason": "STOP",
                    }
                ],
                "modelVersion": menu_analysis_client.MODEL_NAME,
            }
        ).encode()

    def __enter__(self) -> _StubGemini:
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._server.shutdown()
        self._server.server_close()


def _gemini_stub(
    monkeypatch: pytest.MonkeyPatch, mode: ReplyMode = "ok", delay_seconds: float = 0
) -> Iterator[_StubGemini]:
    with _StubGemini(mode=mode, delay_seconds=delay_seconds) as stub:
        client = genai.Client(
            api_key="stub-key",
            http_options=types.HttpOptions(base_url=stub.base_url),
        )
        monkeypatch.setattr(menu_analysis_client, "_client", lambda: client)
        yield stub


@pytest.fixture
def gemini_stub(monkeypatch: pytest.MonkeyPatch) -> Iterator[_StubGemini]:
    yield from _gemini_stub(monkeypatch, mode="ok")


@pytest.fixture
def blocked_gemini_stub(monkeypatch: pytest.MonkeyPatch) -> Iterator[_StubGemini]:
    yield from _gemini_stub(monkeypatch, mode="blocked")


@pytest.fixture
def malformed_gemini_stub(monkeypatch: pytest.MonkeyPatch) -> Iterator[_StubGemini]:
    yield from _gemini_stub(monkeypatch, mode="malformed")


async def test_sends_the_image_and_schema_the_way_gemini_expects(
    gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    result = await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")

    assert result["overview"]
    assert result["missing_items"] == []

    generation_config = gemini_stub.request["generationConfig"]
    assert generation_config["responseMimeType"] == "application/json"
    response_schema = generation_config["responseSchema"]
    assert response_schema["required"] == [
        "overview",
        "pricing_notes",
        "description_quality",
        "upselling_ideas",
        "cross_selling_ideas",
        "missing_items",
        "improvement_suggestions",
    ]
    assert gemini_stub.request["systemInstruction"]

    inline_data = [
        part["inlineData"]
        for part in gemini_stub.request["contents"][0]["parts"]
        if "inlineData" in part
    ]
    assert [part["mimeType"] for part in inline_data] == ["image/jpeg"]


async def test_the_restaurant_context_reaches_the_system_instruction(
    gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    await menu_analysis_client.analyze_menu(
        jpeg_bytes,
        mime_type="image/jpeg",
        cuisine_type="Neapolitan pizza",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "It is a Neapolitan pizza restaurant." in instruction
    assert "The restaurant is in Italy." in instruction
    assert "Write for young professionals." in instruction
    assert "Write the feedback in German" in instruction
    # No tone_of_voice field exists on this request context at all.
    assert "Write in a" not in instruction


async def test_without_context_the_system_instruction_stays_generic(
    gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "About this restaurant" not in instruction
    assert "menu consultant" in instruction


async def test_a_blocked_response_is_reported_as_a_refusal(
    blocked_gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    with pytest.raises(AIRefusalError, match="declined to analyze"):
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")


async def test_non_json_output_is_reported_as_malformed(
    malformed_gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await menu_analysis_client.analyze_menu(jpeg_bytes, mime_type="image/jpeg")
