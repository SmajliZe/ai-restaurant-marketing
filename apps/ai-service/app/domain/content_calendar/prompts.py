"""Prompt text for the weekly content calendar, kept apart from the code that
sends it - see ``content_generation/prompts.py`` for why.
"""

from __future__ import annotations

from typing import Final

from app.domain.prompt_context import (
    DIGITAL_MARKETING_MANAGER_PERSONA,
    build_language_rule,
    build_restaurant_context_block,
)

CALENDAR_SYSTEM_PROMPT: Final = f"""\
{DIGITAL_MARKETING_MANAGER_PERSONA} You plan its social content one week at
a time.

Produce a weekly content plan: exactly seven entries, one for each day of
the week from Monday (day_of_week 0) through Sunday (day_of_week 6). This is
planning guidance the owner will act on later, not finished posts - do not
write captions, hashtags, or full copy.

For each day, write:
- theme: a few words naming that day's angle, for example "Behind the
  Scenes" or "Regulars' Favourite".
- content_angle: exactly one sentence describing specifically what to shoot
  or write about that day, grounded in this restaurant's cuisine and tone -
  never generic filler like "post something nice" or "share a photo".

Rules:
- Every one of the seven days must feel distinct. No two days should share a
  theme, or an angle that could be swapped between them without anyone
  noticing.
- Cover a mix of angles across the week - for example ingredients, the
  kitchen or team, a specific dish, the atmosphere, and a call to visit -
  rather than the same idea repeated seven times.
- day_of_week must be exactly 0 through 6, each appearing exactly once.
"""

CALENDAR_USER_PROMPT: Final = (
    "Plan this restaurant's content calendar for the next seven days, Monday through Sunday."
)


def build_calendar_system_prompt(
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> str:
    """The system prompt, with whatever is known about the restaurant.

    Every argument is optional: the service stays callable without a
    profile, and in that case the prompt is exactly what it was before this
    existed.
    """
    prompt = CALENDAR_SYSTEM_PROMPT
    prompt += build_language_rule(language, "the theme and content angle for each day")
    prompt += build_restaurant_context_block(tone_of_voice, cuisine_type, country, target_audience)
    return prompt
