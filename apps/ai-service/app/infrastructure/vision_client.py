"""Gemini adapter for dish recognition and social content drafting.

Thin on purpose: it owns the request shape, the response schema, and what to
do with the parsed result. The client, the model name, and the translation of
SDK failures into domain errors are shared with every other Gemini adapter -
see ``app.infrastructure.gemini_client``.
"""

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from google.genai import types
from pydantic import BaseModel

from app.domain.content_generation.errors import AIRefusalError, AIResponseMalformedError
from app.domain.content_generation.prompts import (
    CONTENT_USER_PROMPT,
    build_content_system_prompt,
)
from app.infrastructure import gemini_client
from app.infrastructure.gemini_client import call_with_standard_error_handling

# Module-level assignments rather than `import ... as ...`: mypy's strict mode
# does not treat a renaming import as re-exported, which would make
# `vision_client.MODEL_NAME` and `vision_client._client` invisible to a type
# checker even though both are valid, monkeypatchable module attributes at
# runtime - and tests rely on patching exactly these two names.
MODEL_NAME = gemini_client.MODEL_NAME
_REQUEST_TIMEOUT_SECONDS = gemini_client.REQUEST_TIMEOUT_SECONDS
_client = gemini_client.get_client


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

    response = await call_with_standard_error_handling(
        lambda: client.aio.models.generate_content(
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
