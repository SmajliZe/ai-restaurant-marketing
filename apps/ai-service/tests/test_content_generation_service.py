"""Domain-level rules: what the service accepts and what it refuses."""

from __future__ import annotations

import pytest

from app.domain.content_generation.errors import (
    AIServiceBusyError,
    AIServiceError,
    ImageTooLargeError,
    InvalidImageError,
)
from app.domain.content_generation.service import MAX_IMAGE_BYTES, generate_content
from tests.conftest import RecordingCaptionGenerator, make_image


async def test_returns_caption_for_a_valid_image(
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    result = await generate_content(jpeg_bytes, caption_generator=caption_generator)

    assert result.recognized_dish == "Margherita pizza"
    assert result.caption == "Blistered crust and mozzarella that pulls for days."
    assert caption_generator.calls == [(jpeg_bytes, "image/jpeg")]


async def test_normalises_hashtags_returned_by_the_model(
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    result = await generate_content(jpeg_bytes, caption_generator=caption_generator)

    # The "#" is stripped, the blank entry dropped, and the duplicate collapsed.
    assert result.hashtags == ["margherita", "pizzanight"]


@pytest.mark.parametrize(
    ("image_format", "expected_mime_type"),
    [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")],
)
async def test_detects_the_mime_type_from_the_bytes(
    image_format: str,
    expected_mime_type: str,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    image_bytes = make_image(image_format)

    await generate_content(image_bytes, caption_generator=caption_generator)

    assert caption_generator.calls[0][1] == expected_mime_type


async def test_rejects_an_image_over_the_size_limit(
    caption_generator: RecordingCaptionGenerator,
) -> None:
    oversized = b"\x00" * (MAX_IMAGE_BYTES + 1)

    with pytest.raises(ImageTooLargeError, match="larger than 10 MB"):
        await generate_content(oversized, caption_generator=caption_generator)

    # The size check has to happen before we spend a call on the provider.
    assert caption_generator.calls == []


async def test_the_size_limit_is_inclusive(
    caption_generator: RecordingCaptionGenerator,
) -> None:
    at_limit = b"\x00" * MAX_IMAGE_BYTES

    # Turned away for being unreadable rather than oversized, which is only
    # possible if a payload of exactly the limit clears the size check.
    with pytest.raises(InvalidImageError):
        await generate_content(at_limit, caption_generator=caption_generator)


async def test_rejects_bytes_that_are_not_an_image(
    caption_generator: RecordingCaptionGenerator,
) -> None:
    not_an_image = b"this is a text file, not a photo"

    with pytest.raises(InvalidImageError, match="not a readable image"):
        await generate_content(not_an_image, caption_generator=caption_generator)

    assert caption_generator.calls == []


async def test_rejects_an_empty_upload(caption_generator: RecordingCaptionGenerator) -> None:
    with pytest.raises(InvalidImageError, match="empty"):
        await generate_content(b"", caption_generator=caption_generator)


async def test_rejects_a_decodable_image_in_an_unsupported_format(
    caption_generator: RecordingCaptionGenerator,
) -> None:
    """A GIF is a real image, so only the format check can turn it away."""
    gif_bytes = make_image("GIF")

    with pytest.raises(InvalidImageError, match="Unsupported image format"):
        await generate_content(gif_bytes, caption_generator=caption_generator)

    assert caption_generator.calls == []


async def test_propagates_a_busy_provider(jpeg_bytes: bytes) -> None:
    busy = RecordingCaptionGenerator(error=AIServiceBusyError("AI service is temporarily busy."))

    with pytest.raises(AIServiceBusyError):
        await generate_content(jpeg_bytes, caption_generator=busy)


async def test_rejects_a_response_missing_required_fields(jpeg_bytes: bytes) -> None:
    incomplete = RecordingCaptionGenerator(result={"caption": "No dish name in here."})

    with pytest.raises(AIServiceError, match="unexpected response"):
        await generate_content(jpeg_bytes, caption_generator=incomplete)


async def test_passes_the_restaurant_context_to_the_generator(
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    await generate_content(
        jpeg_bytes,
        caption_generator=caption_generator,
        tone_of_voice="luxury",
        cuisine_type="Neapolitan pizza",
    )

    assert caption_generator.contexts == [("luxury", "Neapolitan pizza")]


async def test_works_without_any_restaurant_context(
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    result = await generate_content(jpeg_bytes, caption_generator=caption_generator)

    assert result.recognized_dish == "Margherita pizza"
    assert caption_generator.contexts == [(None, None)]
