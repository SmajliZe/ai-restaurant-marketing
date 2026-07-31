"""Gemini adapter for dish recognition and caption drafting.

Thin on purpose: it owns the SDK call, the response schema, and the translation
of SDK failures into domain errors. Everything else belongs in
``app.domain.content_generation``.
"""

from __future__ import annotations

from collections.abc import Mapping
from functools import lru_cache
from http import HTTPStatus
from typing import Any, Final

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.domain.content_generation.errors import (
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
)
from app.domain.content_generation.prompts import CAPTION_USER_PROMPT, build_caption_system_prompt
from app.infrastructure.config import get_settings

# Flash-class model with image input, currently on the Gemini free tier.
# Model IDs are retired and replaced regularly - check
# https://ai.google.dev/pricing for what is free today before changing this.
MODEL_NAME: Final = "gemini-3.6-flash"


# The JSON shape Gemini is constrained to return.
#
# Deliberately not CaptionResponse: this is the contract with the model provider,
# that one is the contract with our clients, and adding a field to our API should
# never change what we ask the model for.
#
# Documented in comments rather than a docstring on purpose - Pydantic copies a
# docstring into the JSON schema's "description", which would ship these notes to
# the model in every request.
class _GeminiCaption(BaseModel):
    recognized_dish: str
    caption: str
    hashtags: list[str]


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


async def generate_caption(
    image_bytes: bytes,
    *,
    mime_type: str,
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
) -> Mapping[str, Any]:
    """Ask Gemini to identify the dish and draft a caption.

    Implements ``app.domain.content_generation.ports.CaptionGenerator``.
    """
    client = _client()
    contents: list[types.PartUnion] = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        CAPTION_USER_PROMPT,
    ]

    try:
        response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=build_caption_system_prompt(tone_of_voice, cuisine_type),
                # Constrains decoding to the schema, so the response is parsed
                # rather than scraped out of prose.
                response_mime_type="application/json",
                response_schema=_GeminiCaption,
            ),
        )
    except genai_errors.ClientError as exc:
        if exc.code == HTTPStatus.TOO_MANY_REQUESTS:
            raise AIServiceBusyError(
                "AI service is temporarily busy, please try again in a moment."
            ) from exc
        raise AIServiceError("The AI service rejected the request.") from exc
    except genai_errors.APIError as exc:
        raise AIServiceError("The AI service is currently unavailable.") from exc

    parsed = response.parsed
    if not isinstance(parsed, _GeminiCaption):
        # Reached when the model returns no candidate at all, for example when
        # the response is blocked by a safety filter.
        raise AIServiceError("The AI service returned an unexpected response.")

    return parsed.model_dump()
