"""Gemini adapter behaviour that does not depend on reaching Gemini.

The SDK call itself is replaced; what is under test is the translation of
credentials and provider failures into domain errors.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import pytest
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.domain.content_generation.errors import (
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
)
from app.infrastructure import config, vision_client


@pytest.fixture(autouse=True)
def _isolated_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Both the settings and the SDK client are cached for the process lifetime,
    so each test starts from an empty cache and a known environment.

    The cached factory is captured up front because other fixtures replace the
    module attribute, and teardown still has to clear the real one.
    """
    cached_client = vision_client._client

    config.get_settings.cache_clear()
    cached_client.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    yield
    config.get_settings.cache_clear()
    cached_client.cache_clear()


async def test_missing_api_key_names_the_variable(jpeg_bytes: bytes) -> None:
    with pytest.raises(AIServiceConfigurationError, match="GEMINI_API_KEY is not configured"):
        await vision_client.generate_caption(jpeg_bytes, mime_type="image/jpeg")


def _fail_with(error: Exception) -> Any:
    async def _raise(**_: object) -> None:
        raise error

    return _raise


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    return vision_client._client()


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
        await vision_client.generate_caption(jpeg_bytes, mime_type="image/jpeg")


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
        await vision_client.generate_caption(jpeg_bytes, mime_type="image/jpeg")

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
        await vision_client.generate_caption(jpeg_bytes, mime_type="image/jpeg")


def test_the_response_schema_carries_no_internal_prose() -> None:
    """Pydantic copies a model's docstring into the JSON schema's "description",
    which would ship internal notes to Gemini on every single request."""
    schema = vision_client._GeminiCaption.model_json_schema()

    assert "description" not in schema
    assert all("description" not in field for field in schema["properties"].values())


class _StubGemini:
    """Serves one canned generateContent reply and records the request.

    Exercises the real SDK - serialisation of the schema, and parsing of the
    reply - without leaving the machine.
    """

    def __init__(self) -> None:
        self.request: dict[str, Any] = {}
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

    @staticmethod
    def _reply() -> bytes:
        generated = json.dumps(
            {
                "recognized_dish": "Margherita pizza",
                "caption": "Blistered crust and mozzarella that pulls for days.",
                "hashtags": ["margherita", "pizzanight"],
            }
        )
        return json.dumps(
            {
                "candidates": [
                    {
                        "content": {"parts": [{"text": generated}], "role": "model"},
                        "finishReason": "STOP",
                    }
                ],
                "modelVersion": vision_client.MODEL_NAME,
            }
        ).encode()

    def __enter__(self) -> _StubGemini:
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._server.shutdown()
        self._server.server_close()


@pytest.fixture
def gemini_stub(monkeypatch: pytest.MonkeyPatch) -> Iterator[_StubGemini]:
    with _StubGemini() as stub:
        client = genai.Client(
            api_key="stub-key",
            http_options=types.HttpOptions(base_url=stub.base_url),
        )
        monkeypatch.setattr(vision_client, "_client", lambda: client)
        yield stub


async def test_sends_the_image_and_schema_the_way_gemini_expects(
    gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    result = await vision_client.generate_caption(jpeg_bytes, mime_type="image/jpeg")

    assert result["recognized_dish"] == "Margherita pizza"

    generation_config = gemini_stub.request["generationConfig"]
    assert generation_config["responseMimeType"] == "application/json"
    assert generation_config["responseSchema"]["required"] == [
        "recognized_dish",
        "caption",
        "hashtags",
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
    await vision_client.generate_caption(
        jpeg_bytes,
        mime_type="image/jpeg",
        tone_of_voice="luxury",
        cuisine_type="Neapolitan pizza",
    )

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "Write in a luxury tone." in instruction
    assert "It is a Neapolitan pizza restaurant." in instruction


async def test_without_context_the_system_instruction_stays_generic(
    gemini_stub: _StubGemini,
    jpeg_bytes: bytes,
) -> None:
    await vision_client.generate_caption(jpeg_bytes, mime_type="image/jpeg")

    instruction = json.dumps(gemini_stub.request["systemInstruction"])
    assert "About this restaurant" not in instruction
    assert "You write Instagram copy for restaurants." in instruction
