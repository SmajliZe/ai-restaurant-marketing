"""Shared fixtures.

No test in this suite reaches Gemini: the caption generator is always a fake
supplied through ``app.dependency_overrides`` or passed straight into the
service.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from io import BytesIO
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.dependencies import (
    get_calendar_generator,
    get_campaign_generator,
    get_caption_generator,
)
from app.domain.content_calendar.ports import CalendarGenerator
from app.domain.content_campaign.ports import CampaignGenerator
from app.domain.content_generation.ports import CaptionGenerator
from app.infrastructure.config import Settings
from app.main import create_app

GENERATED_CONTENT: Mapping[str, Any] = {
    "recognized_dish": "Margherita pizza",
    "confidence": 0.92,
    "instagram": {
        "caption": "Blistered crust and mozzarella that pulls for days.",
        # Includes a "#" the model was asked not to send, so the tests cover
        # the normalisation the service performs.
        "hashtags": ["margherita", "#pizzanight", " ", "margherita"],
    },
    "facebook": {
        "post": "There's something about a pizza straight out of the oven.",
        "hashtags": ["woodfiredpizza"],
    },
    "story": {
        "text": "Fresh out of the oven",
        "cta": "Swipe up to book a table",
        "sticker_type": "poll",
        "sticker_prompt": "Margherita or pepperoni tonight?",
    },
}

RestaurantContextArgs = tuple[str | None, str | None, str | None, str | None, str | None]


class RecordingCaptionGenerator:
    """Fake ``CaptionGenerator`` that records how it was called.

    ``result`` and ``error`` stay writable so a test can change the outcome
    after the application has already been wired to this instance.
    """

    def __init__(
        self,
        result: Mapping[str, Any] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = GENERATED_CONTENT if result is None else result
        self.error = error
        self.calls: list[tuple[bytes, str]] = []
        self.contexts: list[RestaurantContextArgs] = []

    async def __call__(
        self,
        image_bytes: bytes,
        *,
        mime_type: str,
        tone_of_voice: str | None = None,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]:
        self.calls.append((image_bytes, mime_type))
        self.contexts.append((tone_of_voice, cuisine_type, country, language, target_audience))
        if self.error is not None:
            raise self.error
        return self.result


GENERATED_CALENDAR: Mapping[str, Any] = {
    "entries": [
        {
            "day_of_week": day,
            "theme": f"Theme {day}",
            "content_angle": f"Content angle for day {day}.",
        }
        for day in range(7)
    ]
}


class RecordingCalendarGenerator:
    """Fake ``CalendarGenerator`` that records how it was called.

    ``result`` and ``error`` stay writable so a test can change the outcome
    after the application has already been wired to this instance.
    """

    def __init__(
        self,
        result: Mapping[str, Any] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = GENERATED_CALENDAR if result is None else result
        self.error = error
        self.contexts: list[RestaurantContextArgs] = []

    async def __call__(
        self,
        *,
        tone_of_voice: str | None = None,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]:
        self.contexts.append((tone_of_voice, cuisine_type, country, language, target_audience))
        if self.error is not None:
            raise self.error
        return self.result


GENERATED_CAMPAIGN: Mapping[str, Any] = {
    "name": "Aperitivo Hour",
    "description": "A relaxed after-work window built around small plates and house cocktails.",
    "offer": "A complimentary small plate with any drink order",
    "caption": "The golden hour just got better. Pull up a stool and let us take care of you.",
    "hashtags": ["aperitivo", "happyhour", "afterwork", "eatlocal", "cocktailhour"],
    "story": {
        "text": "Aperitivo hour is calling",
        "cta": "Swipe up to reserve a stool",
        "sticker_type": "countdown",
        "sticker_prompt": "Doors open in",
    },
    "cta": "Reserve your spot for aperitivo hour",
    "duration_suggestion": "Every weekday, 5-7pm",
}


class RecordingCampaignGenerator:
    """Fake ``CampaignGenerator`` that records how it was called.

    ``result`` and ``error`` stay writable so a test can change the outcome
    after the application has already been wired to this instance.
    """

    def __init__(
        self,
        result: Mapping[str, Any] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = GENERATED_CAMPAIGN if result is None else result
        self.error = error
        self.occasions: list[str] = []
        self.contexts: list[RestaurantContextArgs] = []

    async def __call__(
        self,
        occasion: str,
        *,
        tone_of_voice: str | None = None,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]:
        self.occasions.append(occasion)
        self.contexts.append((tone_of_voice, cuisine_type, country, language, target_audience))
        if self.error is not None:
            raise self.error
        return self.result


def make_image(
    image_format: str = "JPEG",
    size: tuple[int, int] = (32, 32),
    colour: str = "red",
) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, colour).save(buffer, format=image_format)
    return buffer.getvalue()


@pytest.fixture
def jpeg_bytes() -> bytes:
    return make_image("JPEG")


@pytest.fixture
def caption_generator() -> RecordingCaptionGenerator:
    return RecordingCaptionGenerator()


@pytest.fixture
def calendar_generator() -> RecordingCalendarGenerator:
    return RecordingCalendarGenerator()


@pytest.fixture
def campaign_generator() -> RecordingCampaignGenerator:
    return RecordingCampaignGenerator()


@pytest.fixture
def client(
    caption_generator: CaptionGenerator,
    calendar_generator: CalendarGenerator,
    campaign_generator: CampaignGenerator,
) -> Iterator[TestClient]:
    """Application wired to the fake generators, with settings pinned.

    Settings are passed explicitly so a developer's local .env cannot change
    what the tests assert.
    """
    app = create_app(Settings(environment="test"))
    app.dependency_overrides[get_caption_generator] = lambda: caption_generator
    app.dependency_overrides[get_calendar_generator] = lambda: calendar_generator
    app.dependency_overrides[get_campaign_generator] = lambda: campaign_generator
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
