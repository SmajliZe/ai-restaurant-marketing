"""Domain-level rules: what the weekly calendar service accepts and refuses."""

from __future__ import annotations

import copy

import pytest

from app.domain.content_calendar.service import generate_weekly_calendar
from app.domain.content_generation.errors import AIResponseMalformedError, AIServiceBusyError
from app.schemas.content_calendar import CalendarRequestContext
from tests.conftest import GENERATED_CALENDAR, RecordingCalendarGenerator

EMPTY_CONTEXT = CalendarRequestContext()


async def test_returns_a_full_week(calendar_generator: RecordingCalendarGenerator) -> None:
    result = await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=calendar_generator)

    assert len(result.entries) == 7
    assert sorted(entry.day_of_week for entry in result.entries) == list(range(7))
    assert result.entries[0].theme == "Theme 0"
    assert result.entries[0].content_angle == "Content angle for day 0."


async def test_passes_the_restaurant_context_to_the_generator(
    calendar_generator: RecordingCalendarGenerator,
) -> None:
    context = CalendarRequestContext(
        tone_of_voice="luxury",
        cuisine_type="Neapolitan pizza",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    await generate_weekly_calendar(context, calendar_generator=calendar_generator)

    assert calendar_generator.contexts == [
        ("luxury", "Neapolitan pizza", "Italy", "German", "young professionals")
    ]


async def test_works_without_any_restaurant_context(
    calendar_generator: RecordingCalendarGenerator,
) -> None:
    await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=calendar_generator)

    assert calendar_generator.contexts == [(None, None, None, None, None)]


async def test_propagates_a_busy_provider() -> None:
    busy = RecordingCalendarGenerator(error=AIServiceBusyError("AI service is temporarily busy."))

    with pytest.raises(AIServiceBusyError):
        await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=busy)


async def test_rejects_a_response_missing_the_entries_key() -> None:
    generator = RecordingCalendarGenerator(result={})

    with pytest.raises(AIResponseMalformedError, match="missing"):
        await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=generator)


@pytest.mark.parametrize("entry_count", [0, 1, 6, 8, 14])
async def test_rejects_a_response_with_the_wrong_number_of_entries(entry_count: int) -> None:
    wrong_count = {
        "entries": [
            {"day_of_week": day % 7, "theme": f"Theme {day}", "content_angle": "Angle."}
            for day in range(entry_count)
        ]
    }
    generator = RecordingCalendarGenerator(result=wrong_count)

    with pytest.raises(AIResponseMalformedError, match="exactly seven days"):
        await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=generator)


async def test_rejects_a_response_with_a_duplicate_day() -> None:
    # Seven entries, but day 0 appears twice and day 6 is missing.
    duplicated = copy.deepcopy(GENERATED_CALENDAR)
    duplicated["entries"][6]["day_of_week"] = 0
    generator = RecordingCalendarGenerator(result=duplicated)

    with pytest.raises(AIResponseMalformedError, match="cover each day exactly once"):
        await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=generator)


async def test_rejects_a_response_with_a_day_out_of_range() -> None:
    out_of_range = copy.deepcopy(GENERATED_CALENDAR)
    out_of_range["entries"][0]["day_of_week"] = 7
    generator = RecordingCalendarGenerator(result=out_of_range)

    with pytest.raises(AIResponseMalformedError):
        await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=generator)


async def test_rejects_a_response_missing_a_required_field_on_one_entry() -> None:
    incomplete = copy.deepcopy(GENERATED_CALENDAR)
    del incomplete["entries"][3]["theme"]
    generator = RecordingCalendarGenerator(result=incomplete)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=generator)


async def test_entries_are_not_required_to_arrive_in_day_order() -> None:
    shuffled = {
        "entries": [
            GENERATED_CALENDAR["entries"][3],
            GENERATED_CALENDAR["entries"][0],
            GENERATED_CALENDAR["entries"][6],
            GENERATED_CALENDAR["entries"][1],
            GENERATED_CALENDAR["entries"][5],
            GENERATED_CALENDAR["entries"][2],
            GENERATED_CALENDAR["entries"][4],
        ]
    }
    generator = RecordingCalendarGenerator(result=shuffled)

    result = await generate_weekly_calendar(EMPTY_CONTEXT, calendar_generator=generator)

    assert sorted(entry.day_of_week for entry in result.entries) == list(range(7))
