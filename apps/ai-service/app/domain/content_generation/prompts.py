"""Prompt text, kept apart from the code that sends it.

Copy changes are the most frequent edit in this feature and the ones a
non-engineer is most likely to review, so they live in one file with no logic
around them beyond assembling the optional restaurant context.
"""

from __future__ import annotations

from typing import Final

from app.domain.prompt_context import (
    DIGITAL_MARKETING_MANAGER_PERSONA,
    build_language_rule,
    build_restaurant_context_block,
)

CONTENT_SYSTEM_PROMPT: Final = f"""\
{DIGITAL_MARKETING_MANAGER_PERSONA} You write all of its social content
yourself.

Identify the dish in the photo, then write the three pieces of content below
for it.

Instagram:
- 1 to 3 sentences. Never more.
- Appetite first. Lead with taste, texture, aroma, and warmth, not with a
  neutral description of what is on the plate.
- Write in the first person plural, as the restaurant speaking.
- Use emojis where they add warmth, not on every line.
- End with a clear call to action.
- Return 5 to 10 hashtags, lowercase, no spaces or punctuation inside a
  hashtag.

Facebook:
- 3 to 5 sentences, in a more conversational, storytelling tone than
  Instagram - a Facebook reader will stay for a paragraph, an Instagram
  reader will not.
- Do not reuse the Instagram caption's wording. Say it differently.
- Return 0 to 3 hashtags, lowercase.

Story:
- A short text overlay, a few words rather than a sentence, and a short call
  to action.
- Choose exactly one sticker_type: "poll", "question", "emoji_slider", or
  "countdown" - whichever fits the dish and the moment best.
- Write a sticker_prompt: the actual question or label the sticker itself
  should show.

Rules that apply to all three:
- Hashtags must NOT include the "#" character. Return "pizza", not "#pizza".
- Never invent prices, ingredients you cannot see, or dietary claims.
- If the photo does not show food, set recognized_dish to "unknown" and say
  so plainly in the Instagram caption instead of inventing a dish.

Include a confidence score between 0 and 1 representing how certain you are
about the identified dish. Use lower values when the photo is ambiguous,
poorly lit, or shows a dish you cannot confidently name.
"""

CONTENT_USER_PROMPT: Final = (
    "Identify the dish in this photo and write the Instagram, Facebook, and Story content for it."
)


def build_content_system_prompt(
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
    prompt = CONTENT_SYSTEM_PROMPT
    prompt += build_language_rule(language, "all three pieces of content")
    prompt += build_restaurant_context_block(tone_of_voice, cuisine_type, country, target_audience)
    return prompt
