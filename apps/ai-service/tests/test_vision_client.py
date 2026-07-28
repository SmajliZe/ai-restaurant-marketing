"""Gemini adapter behaviour that does not depend on reaching Gemini.

The SDK call itself is replaced; what is under test is the translation of
credentials and provider failures into domain errors.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from google.genai import errors as genai_errors

from app.domain.content_generation.errors import (
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
)
from app.infrastructure import config, vision_client


@pytest.fixture(autouse=True)
def _isolated_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Both the settings and the SDK client are cached for the process lifetime,
    so each test starts from an empty cache and a known environment."""
    config.get_settings.cache_clear()
    vision_client._client.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    yield
    config.get_settings.cache_clear()
    vision_client._client.cache_clear()


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
