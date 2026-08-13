"""Orchestrates weekly content-calendar generation."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Final

from pydantic import ValidationError

from app.domain.content_calendar.ports import CalendarGenerator
from app.domain.content_generation.errors import AIResponseMalformedError
from app.schemas.content_calendar import CalendarEntry, CalendarRequestContext, CalendarResponse

_EXPECTED_DAYS: Final = list(range(7))


async def generate_weekly_calendar(
    context: CalendarRequestContext,
    *,
    calendar_generator: CalendarGenerator,
) -> CalendarResponse:
    """Plan a week of content themes and angles for the restaurant described
    by ``context``.

    Every field on ``context`` is optional, so the service answers the same
    way it always did when nothing is known about the caller.

    Raises:
        AIServiceError: The provider failed, refused, or returned something
            unusable - including a week that does not have exactly one entry
            for each of the seven days.
    """
    generated = await calendar_generator(
        tone_of_voice=context.tone_of_voice,
        cuisine_type=context.cuisine_type,
        country=context.country,
        language=context.language,
        target_audience=context.target_audience,
    )
    return _to_calendar_response(generated)


def _to_calendar_response(generated: Mapping[str, Any]) -> CalendarResponse:
    # Checked explicitly, rather than left to the KeyError a missing key
    # would raise below, so a malformed response is always reported the same
    # way regardless of what exactly is wrong with it.
    if "entries" not in generated:
        raise AIResponseMalformedError("The AI service response is missing: entries.")

    entries = generated["entries"]
    if not isinstance(entries, list) or len(entries) != 7:
        raise AIResponseMalformedError(
            "The AI service did not return exactly seven days of content."
        )

    try:
        parsed_entries = [
            CalendarEntry(
                day_of_week=entry["day_of_week"],
                theme=str(entry["theme"]).strip(),
                content_angle=str(entry["content_angle"]).strip(),
            )
            for entry in entries
        ]
    except (KeyError, TypeError, ValidationError) as exc:
        raise AIResponseMalformedError("The AI service returned an unexpected response.") from exc

    # A week that is the right length but repeats or skips a day is just as
    # unusable as one with the wrong number of entries - each of the seven
    # days must appear exactly once.
    days = sorted(entry.day_of_week for entry in parsed_entries)
    if days != _EXPECTED_DAYS:
        raise AIResponseMalformedError("The AI service's week did not cover each day exactly once.")

    return CalendarResponse(entries=parsed_entries)
