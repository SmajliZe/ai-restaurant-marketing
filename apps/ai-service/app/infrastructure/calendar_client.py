"""Gemini adapter for weekly content-calendar planning.

Thin on purpose, mirroring ``vision_client.py``: it owns the request shape,
the response schema, and what to do with the parsed result. The client, the
model name, and the translation of SDK failures into domain errors are
shared with every other Gemini adapter - see
``app.infrastructure.gemini_client``. This one differs from ``vision_client``
only in that the call is text-only: there is no photo to send, so no MIME
type or image bytes ever enter this module.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from google.genai import types
from pydantic import BaseModel

from app.domain.content_calendar.prompts import (
    CALENDAR_USER_PROMPT,
    build_calendar_system_prompt,
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
# CalendarResponse - see the note in vision_client.py's _GeminiContent for why
# the model's contract and the client's contract are kept apart.
class _GeminiCalendarEntry(BaseModel):
    day_of_week: int
    theme: str
    content_angle: str


class _GeminiCalendar(BaseModel):
    entries: list[_GeminiCalendarEntry]


async def generate_weekly_calendar(
    *,
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> Mapping[str, Any]:
    """Ask Gemini to plan a week of content themes and angles.

    Implements ``app.domain.content_calendar.ports.CalendarGenerator``.
    """
    client = _client()
    contents: list[types.PartUnion] = [CALENDAR_USER_PROMPT]

    response = await call_with_standard_error_handling(
        lambda: client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=build_calendar_system_prompt(
                    tone_of_voice,
                    cuisine_type,
                    country,
                    language,
                    target_audience,
                ),
                response_mime_type="application/json",
                response_schema=_GeminiCalendar,
            ),
        ),
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.text:
        raise AIRefusalError("The AI service declined to plan a calendar.")

    parsed = response.parsed
    if not isinstance(parsed, _GeminiCalendar):
        raise AIResponseMalformedError("The AI service returned an unexpected response.")

    return parsed.model_dump()
