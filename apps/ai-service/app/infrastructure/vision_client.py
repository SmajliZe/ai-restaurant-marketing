"""Gemini adapter for dish recognition and social content drafting.

Thin on purpose: it owns the SDK call, the response schema, and the translation
of SDK failures into domain errors. Everything else belongs in
``app.domain.content_generation``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from enum import StrEnum
from functools import lru_cache
from http import HTTPStatus
from typing import Any, Final

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.domain.content_generation.errors import (
    AIRefusalError,
    AIResponseMalformedError,
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
    AITimeoutError,
)
from app.domain.content_generation.prompts import (
    CONTENT_USER_PROMPT,
    build_content_system_prompt,
)
from app.infrastructure.config import get_settings

# Flash-class model with image input, currently on the Gemini free tier.
# Model IDs are retired and replaced regularly - check
# https://ai.google.dev/pricing for what is free today before changing this.
MODEL_NAME: Final = "gemini-3.6-flash"

# Long enough for a vision call on a 10 MB photo; short enough that a caller
# is not left waiting on a request that will never come back.
_REQUEST_TIMEOUT_SECONDS: Final = 30.0


# The JSON shape Gemini is constrained to return.
#
# Deliberately not ContentResponse: this is the contract with the model provider,
# that one is the contract with our clients, and adding a field to our API should
# never change what we ask the model for.
#
# Documented in comments rather than a docstring on purpose - Pydantic copies a
# docstring into the JSON schema's "description", which would ship these notes to
# the model in every request.
class _GeminiInstagramContent(BaseModel):
    caption: str
    hashtags: list[str]


class _GeminiFacebookContent(BaseModel):
    post: str
    hashtags: list[str]


class _GeminiStickerType(StrEnum):
    POLL = "poll"
    QUESTION = "question"
    EMOJI_SLIDER = "emoji_slider"
    COUNTDOWN = "countdown"


class _GeminiStoryContent(BaseModel):
    text: str
    cta: str
    sticker_type: _GeminiStickerType
    sticker_prompt: str


class _GeminiContent(BaseModel):
    recognized_dish: str
    confidence: float
    instagram: _GeminiInstagramContent
    facebook: _GeminiFacebookContent
    story: _GeminiStoryContent


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    """Build the SDK client once; it pools connections across requests.

    ``lru_cache`` does not memoise exceptions, so a missing key keeps raising
    until the process is restarted with one configured.
    """
    api_key = get_settings().gemini_api_key
    if not api_key:
        raise AIServiceConfigurationError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=api_key)


async def generate_content(
    image_bytes: bytes,
    *,
    mime_type: str,
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> Mapping[str, Any]:
    """Ask Gemini to identify the dish and draft Instagram, Facebook, and Story
    content for it.

    Implements ``app.domain.content_generation.ports.CaptionGenerator``.
    """
    client = _client()
    contents: list[types.PartUnion] = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        CONTENT_USER_PROMPT,
    ]

    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=MODEL_NAME,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=build_content_system_prompt(
                        tone_of_voice,
                        cuisine_type,
                        country,
                        language,
                        target_audience,
                    ),
                    # Constrains decoding to the schema, so the response is parsed
                    # rather than scraped out of prose.
                    response_mime_type="application/json",
                    response_schema=_GeminiContent,
                ),
            ),
            timeout=_REQUEST_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise AITimeoutError("The AI service took too long to respond.") from exc
    except genai_errors.ClientError as exc:
        if exc.code == HTTPStatus.TOO_MANY_REQUESTS:
            raise AIServiceBusyError(
                "AI service is temporarily busy, please try again in a moment."
            ) from exc
        raise AIServiceError("The AI service rejected the request.") from exc
    except genai_errors.APIError as exc:
        raise AIServiceError("The AI service is currently unavailable.") from exc

    if not response.text:
        # Reached when there is no candidate at all, for example when the
        # response is blocked by a safety filter before any content is drafted.
        raise AIRefusalError("The AI service declined to answer for this photo.")

    parsed = response.parsed
    if not isinstance(parsed, _GeminiContent):
        # Text came back, but it was not valid JSON, or it did not match the
        # schema we asked for.
        raise AIResponseMalformedError("The AI service returned an unexpected response.")

    return parsed.model_dump()
