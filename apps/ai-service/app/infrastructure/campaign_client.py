"""Gemini adapter for marketing campaign generation.

Thin on purpose, mirroring ``calendar_client.py``: it owns the request shape,
the response schema, and what to do with the parsed result. The client, the
model name, and the translation of SDK failures into domain errors are
shared with every other Gemini adapter - see
``app.infrastructure.gemini_client``. Like the calendar's call, this one is
text-only: there is no photo to send.
"""

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from google.genai import types
from pydantic import BaseModel

from app.domain.content_campaign.prompts import (
    build_campaign_system_prompt,
    build_campaign_user_prompt,
)
from app.domain.content_generation.errors import AIRefusalError, AIResponseMalformedError
from app.infrastructure import gemini_client
from app.infrastructure.gemini_client import call_with_standard_error_handling

# See the matching comment in vision_client.py for why these are plain
# assignments rather than `import ... as ...`.
MODEL_NAME = gemini_client.MODEL_NAME
_REQUEST_TIMEOUT_SECONDS = gemini_client.REQUEST_TIMEOUT_SECONDS
_client = gemini_client.get_client


# The JSON shape Gemini is constrained to return. Deliberately not
# CampaignResponse - see the note in vision_client.py's _GeminiContent for why
# the model's contract and the client's contract are kept apart. This means
# story is a private mirror of content_generation's StoryContent rather than
# the public schema class itself: the public one carries Field descriptions
# for API documentation, and those would otherwise ship to Gemini on every
# request.
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


class _GeminiCampaign(BaseModel):
    name: str
    description: str
    offer: str
    caption: str
    hashtags: list[str]
    story: _GeminiStoryContent
    cta: str
    duration_suggestion: str


async def generate_campaign(
    occasion: str,
    *,
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> Mapping[str, Any]:
    """Ask Gemini to build a complete marketing campaign for ``occasion``.

    Implements ``app.domain.content_campaign.ports.CampaignGenerator``.
    """
    client = _client()
    contents: list[types.PartUnion] = [build_campaign_user_prompt(occasion)]

    response = await call_with_standard_error_handling(
        lambda: client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=build_campaign_system_prompt(
                    tone_of_voice,
                    cuisine_type,
                    country,
                    language,
                    target_audience,
                ),
                response_mime_type="application/json",
                response_schema=_GeminiCampaign,
            ),
        ),
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.text:
        raise AIRefusalError("The AI service declined to build a campaign.")

    parsed = response.parsed
    if not isinstance(parsed, _GeminiCampaign):
        raise AIResponseMalformedError("The AI service returned an unexpected response.")

    return parsed.model_dump()
