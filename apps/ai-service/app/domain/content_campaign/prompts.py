"""Prompt text for marketing campaign generation, kept apart from the code
that sends it - see ``content_generation/prompts.py`` for why.
"""

from __future__ import annotations

from typing import Final

from app.domain.prompt_context import (
    DIGITAL_MARKETING_MANAGER_PERSONA,
    as_context_value,
    build_language_rule,
    build_restaurant_context_block,
)

CAMPAIGN_SYSTEM_PROMPT: Final = f"""\
{DIGITAL_MARKETING_MANAGER_PERSONA} You build complete marketing campaigns,
one occasion at a time.

Given an occasion, build one complete, cohesive campaign around it - every
piece below should clearly belong to the same idea, not read like unrelated
fragments assembled after the fact:

- name: catchy and specific to this occasion. Never generic, like "Special
  Offer" or "Weekend Promotion" used as the name itself.
- description: a short description of the campaign and why it fits the
  occasion.
- offer: the *shape* of an offer appropriate to this restaurant's price tier
  and tone - infer the tier from cuisine_type and tone_of_voice. Suggest
  something like "a limited-time combo deal" or "a complimentary starter
  with any main course" - never invent a specific price, a discount
  percentage, or any other numeric amount.
- caption: an Instagram-ready caption for the campaign - appetite first,
  written in the first person plural, as the restaurant speaking, ending
  with a clear call to action.
- hashtags: 5 to 10 hashtags, lowercase, no spaces or punctuation inside a
  hashtag.
- story: a short text overlay, a call to action, exactly one sticker_type
  ("poll", "question", "emoji_slider", or "countdown" - whichever fits the
  occasion best), and a sticker_prompt for what the sticker itself should
  say or ask.
- cta: the campaign's own call to action - distinct from the story's, not a
  repeat of it.
- duration_suggestion: qualitative, for example "This weekend only" or
  "Throughout the month" - never specific calendar dates, since the
  restaurant decides those.

Rules:
- Hashtags must NOT include the "#" character. Return "happyhour", not
  "#happyhour".
- Never invent a specific price, a discount percentage, or any other numeric
  amount anywhere in the response - the offer is a shape, not a number.
- Never invent ingredients, dietary claims, or details about the restaurant
  you were not given.
"""


def build_campaign_system_prompt(
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> str:
    """The system prompt, with whatever is known about the restaurant.

    Every argument is optional: the service stays callable without a
    profile, and in that case the prompt is exactly what it was before this
    existed. The occasion itself is not a parameter here - see
    ``build_campaign_user_prompt`` - because it is the specific ask for this
    call, not a standing fact about the restaurant.
    """
    prompt = CAMPAIGN_SYSTEM_PROMPT
    prompt += build_language_rule(language, "the campaign")
    prompt += build_restaurant_context_block(tone_of_voice, cuisine_type, country, target_audience)
    return prompt


def build_campaign_user_prompt(occasion: str) -> str:
    """The user-turn prompt naming the occasion to build a campaign around.

    The occasion is free text a restaurant owner typed in, so it goes through
    the same collapsing and length-capping as every other untrusted field
    before it reaches the model - the same guard ``build_restaurant_context_block``
    applies to tone, cuisine, country and target audience.
    """
    occasion_value = as_context_value(occasion) or occasion.strip()
    return f"Build a marketing campaign for this occasion: {occasion_value}"
