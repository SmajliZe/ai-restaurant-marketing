"""Domain-level rules: what the campaign service accepts and refuses."""

from __future__ import annotations

import copy
from typing import Any, cast

import pytest
from pydantic import ValidationError

from app.domain.content_campaign.service import generate_campaign
from app.domain.content_generation.errors import AIResponseMalformedError, AIServiceBusyError
from app.schemas.content_campaign import CampaignRequestContext
from tests.conftest import GENERATED_CAMPAIGN, RecordingCampaignGenerator

CONTEXT = CampaignRequestContext(occasion="Happy Hour")


async def test_returns_the_full_campaign(campaign_generator: RecordingCampaignGenerator) -> None:
    result = await generate_campaign(CONTEXT, campaign_generator=campaign_generator)

    assert result.name == "Aperitivo Hour"
    assert result.offer == "A complimentary small plate with any drink order"
    assert result.story.sticker_type == "countdown"
    assert result.duration_suggestion == "Every weekday, 5-7pm"


async def test_normalises_hashtags_returned_by_the_model(
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    campaign_generator.result = {
        **GENERATED_CAMPAIGN,
        # Includes a "#" and a duplicate the model was asked not to send, so
        # the test covers the normalisation the service performs, while
        # still leaving enough distinct tags to satisfy the 5-10 range.
        "hashtags": [
            "happyhour",
            "#aperitivo",
            " ",
            "happyhour",
            "eatlocal",
            "cocktails",
            "afterwork",
        ],
    }

    result = await generate_campaign(CONTEXT, campaign_generator=campaign_generator)

    assert result.hashtags == ["happyhour", "aperitivo", "eatlocal", "cocktails", "afterwork"]


async def test_passes_the_occasion_and_restaurant_context_to_the_generator(
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    context = CampaignRequestContext(
        occasion="Pizza Day",
        tone_of_voice="luxury",
        cuisine_type="Neapolitan pizza",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    await generate_campaign(context, campaign_generator=campaign_generator)

    assert campaign_generator.occasions == ["Pizza Day"]
    assert campaign_generator.contexts == [
        ("luxury", "Neapolitan pizza", "Italy", "German", "young professionals")
    ]


async def test_works_without_any_restaurant_context(
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    await generate_campaign(CONTEXT, campaign_generator=campaign_generator)

    assert campaign_generator.contexts == [(None, None, None, None, None)]


async def test_occasion_is_required() -> None:
    with pytest.raises(ValidationError):
        CampaignRequestContext()  # type: ignore[call-arg]


@pytest.mark.parametrize("blank", ["", "   ", "\n\t"])
def test_a_blank_occasion_is_rejected(blank: str) -> None:
    with pytest.raises(ValidationError, match="required"):
        CampaignRequestContext(occasion=blank)


async def test_propagates_a_busy_provider() -> None:
    busy = RecordingCampaignGenerator(error=AIServiceBusyError("AI service is temporarily busy."))

    with pytest.raises(AIServiceBusyError):
        await generate_campaign(CONTEXT, campaign_generator=busy)


async def test_rejects_a_response_missing_a_top_level_field() -> None:
    incomplete = cast("dict[str, Any]", copy.deepcopy(GENERATED_CAMPAIGN))
    del incomplete["offer"]
    generator = RecordingCampaignGenerator(result=incomplete)

    with pytest.raises(AIResponseMalformedError, match="offer"):
        await generate_campaign(CONTEXT, campaign_generator=generator)


@pytest.mark.parametrize(
    "missing_key",
    ["name", "description", "offer", "caption", "hashtags", "story", "cta", "duration_suggestion"],
)
async def test_rejects_a_response_missing_any_required_field(missing_key: str) -> None:
    incomplete = cast("dict[str, Any]", copy.deepcopy(GENERATED_CAMPAIGN))
    del incomplete[missing_key]
    generator = RecordingCampaignGenerator(result=incomplete)

    with pytest.raises(AIResponseMalformedError, match="missing"):
        await generate_campaign(CONTEXT, campaign_generator=generator)


async def test_rejects_a_response_with_too_few_hashtags() -> None:
    too_few = {**GENERATED_CAMPAIGN, "hashtags": ["one", "two"]}
    generator = RecordingCampaignGenerator(result=too_few)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await generate_campaign(CONTEXT, campaign_generator=generator)


async def test_rejects_a_response_with_an_invalid_sticker_type() -> None:
    invalid = {
        **GENERATED_CAMPAIGN,
        "story": {**GENERATED_CAMPAIGN["story"], "sticker_type": "not-a-real-sticker"},
    }
    generator = RecordingCampaignGenerator(result=invalid)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await generate_campaign(CONTEXT, campaign_generator=generator)


async def test_rejects_a_response_missing_a_field_on_the_nested_story() -> None:
    incomplete = copy.deepcopy(GENERATED_CAMPAIGN)
    del incomplete["story"]["cta"]
    generator = RecordingCampaignGenerator(result=incomplete)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await generate_campaign(CONTEXT, campaign_generator=generator)
