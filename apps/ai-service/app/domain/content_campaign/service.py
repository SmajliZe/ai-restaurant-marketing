"""Orchestrates marketing campaign generation."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, Final

from pydantic import ValidationError

from app.domain.content_campaign.ports import CampaignGenerator
from app.domain.content_generation.errors import AIResponseMalformedError
from app.schemas.content_campaign import CampaignRequestContext, CampaignResponse
from app.schemas.content_generation import StoryContent

# What the provider's response must contain at the top level before we try to
# build a CampaignResponse out of it.
_REQUIRED_TOP_LEVEL_KEYS: Final = frozenset(
    {
        "name",
        "description",
        "offer",
        "caption",
        "hashtags",
        "story",
        "cta",
        "duration_suggestion",
    }
)


async def generate_campaign(
    context: CampaignRequestContext,
    *,
    campaign_generator: CampaignGenerator,
) -> CampaignResponse:
    """Build a complete marketing campaign for the occasion described by
    ``context``.

    Every field on ``context`` besides ``occasion`` is optional, so the
    service answers the same way it always did when nothing else is known
    about the caller.

    Raises:
        AIServiceError: The provider failed, refused, or returned something
            unusable - including a response missing any of the campaign's
            required fields.
    """
    generated = await campaign_generator(
        context.occasion,
        tone_of_voice=context.tone_of_voice,
        cuisine_type=context.cuisine_type,
        country=context.country,
        language=context.language,
        target_audience=context.target_audience,
    )
    return _to_campaign_response(generated)


def _to_campaign_response(generated: Mapping[str, Any]) -> CampaignResponse:
    # Checked explicitly, rather than left to the KeyError a missing key
    # would raise below, so a malformed response is always reported the same
    # way regardless of which field is missing.
    missing = _REQUIRED_TOP_LEVEL_KEYS - generated.keys()
    if missing:
        raise AIResponseMalformedError(
            f"The AI service response is missing: {', '.join(sorted(missing))}."
        )

    try:
        story = generated["story"]
        return CampaignResponse(
            name=str(generated["name"]).strip(),
            description=str(generated["description"]).strip(),
            offer=str(generated["offer"]).strip(),
            caption=str(generated["caption"]).strip(),
            hashtags=_normalise_hashtags(generated["hashtags"]),
            story=StoryContent(
                text=str(story["text"]).strip(),
                cta=str(story["cta"]).strip(),
                sticker_type=story["sticker_type"],
                sticker_prompt=str(story["sticker_prompt"]).strip(),
            ),
            cta=str(generated["cta"]).strip(),
            duration_suggestion=str(generated["duration_suggestion"]).strip(),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        raise AIResponseMalformedError("The AI service returned an unexpected response.") from exc


def _normalise_hashtags(hashtags: Iterable[Any]) -> list[str]:
    """Strip "#" and duplicates.

    The prompt already asks for bare tags, but a model is free to ignore that,
    and clients should not have to handle both shapes.
    """
    seen: dict[str, None] = {}
    for hashtag in hashtags:
        cleaned = str(hashtag).strip().lstrip("#").strip()
        if cleaned:
            seen.setdefault(cleaned, None)
    return list(seen)
