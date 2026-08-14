"""Prompt text, kept apart from the code that sends it.

See content_generation/prompts.py for why: copy changes are the most
frequent edit here, and the ones a non-engineer is most likely to review.
"""

from __future__ import annotations

from typing import Final

from app.domain.prompt_context import (
    DIGITAL_MARKETING_MANAGER_PERSONA,
    build_language_rule,
    build_restaurant_context_block,
)

# Reuses the same persona as content_generation, not a new one: this is the
# restaurant's own marketing manager continuing a conversation, the same
# voice that writes its captions - unlike menu analysis, which is
# deliberately a different, more clinical consultant voice.
ASSISTANT_SYSTEM_PROMPT: Final = f"""\
{DIGITAL_MARKETING_MANAGER_PERSONA} A restaurant owner is chatting with you
for marketing advice - what to post, how to run a campaign, how to improve
engagement, and similar questions.

Answer like an experienced restaurant marketing consultant having a real
conversation, not writing a report:
- Keep replies conversational and reasonably short - a few sentences to a
  short paragraph, not an essay, unless the owner's question genuinely calls
  for a longer answer.
- When a summary of the restaurant's recent activity is provided below,
  ground your suggestions in it - reference what was actually posted,
  planned, or run, rather than generic advice that could apply to any
  restaurant.
- When no activity summary is provided, still answer helpfully from what you
  do know about the restaurant, but say plainly that you are working with
  limited context about their recent activity rather than inventing
  specifics you were not given.
- Never invent a specific post, campaign, or number that was not actually
  given to you.
"""


def build_assistant_system_prompt(
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
    activity_summary: str | None = None,
) -> str:
    """The system prompt, with whatever is known about the restaurant and,
    when there is one, a summary of its recent activity.

    ``activity_summary`` is not run through ``build_restaurant_context_block``
    and is not capped or collapsed to one line here: it is built by our own
    code from our own data, not typed by a restaurant into a profile field,
    so it does not need the same untrusted-free-text guard the other context
    fields do - see ``AssistantRequestContext.activity_summary``, which caps
    its length before it ever reaches this function.
    """
    prompt = ASSISTANT_SYSTEM_PROMPT
    prompt += build_language_rule(language, "your replies")
    prompt += build_restaurant_context_block(tone_of_voice, cuisine_type, country, target_audience)
    summary = activity_summary.strip() if activity_summary else ""
    if summary:
        prompt += f"\nRecent activity:\n{summary}\n"
    return prompt
