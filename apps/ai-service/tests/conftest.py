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

from app.api.dependencies import get_caption_generator
from app.domain.content_generation.ports import CaptionGenerator
from app.infrastructure.config import Settings
from app.main import create_app

GENERATED_CAPTION: Mapping[str, Any] = {
    "recognized_dish": "Margherita pizza",
    "caption": "Blistered crust and mozzarella that pulls for days.",
    # Includes a "#" the model was asked not to send, so the tests cover the
    # normalisation the service performs.
    "hashtags": ["margherita", "#pizzanight", " ", "margherita"],
}


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
        self.result = GENERATED_CAPTION if result is None else result
        self.error = error
        self.calls: list[tuple[bytes, str]] = []

    async def __call__(self, image_bytes: bytes, *, mime_type: str) -> Mapping[str, Any]:
        self.calls.append((image_bytes, mime_type))
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
def client(caption_generator: CaptionGenerator) -> Iterator[TestClient]:
    """Application wired to the fake generator, with settings pinned.

    Settings are passed explicitly so a developer's local .env cannot change
    what the tests assert.
    """
    app = create_app(Settings(environment="test"))
    app.dependency_overrides[get_caption_generator] = lambda: caption_generator
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
