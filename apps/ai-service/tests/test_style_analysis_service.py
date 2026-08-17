"""Domain-level rules: what the style analysis service accepts and refuses.

Image validation (size, format) is content_generation's own rule, reused
here rather than reimplemented - see test_content_generation_service.py for
the exhaustive cases; this file only re-proves the same rejections apply
when reached through analyze_style, plus this domain's own response shape
and its multi-image, multi-profile grouping.
"""

from __future__ import annotations

import pytest

from app.domain.content_generation.errors import (
    AIResponseMalformedError,
    AIServiceBusyError,
    ImageTooLargeError,
    InvalidImageError,
)
from app.domain.content_generation.service import MAX_IMAGE_BYTES
from app.domain.style_analysis.service import RawProfileImages, analyze_style
from tests.conftest import GENERATED_STYLE_ANALYSIS, RecordingStyleAnalyzer, make_image


def profile(feed: bytes | None = None, posts: list[bytes] | None = None) -> RawProfileImages:
    return RawProfileImages(feed=feed, posts=posts or [])


async def test_returns_a_plan_for_a_single_profile_with_a_feed_image(
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    result = await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=style_analyzer)

    assert result.visual_style_notes.startswith("References lean on warm")
    assert len(result.content_pillars) == 3
    assert len(result.recommendations) == 3
    assert len(style_analyzer.calls) == 1


async def test_groups_multiple_profiles_and_mime_types_every_image(
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    profile_a = profile(feed=make_image("JPEG"), posts=[make_image("PNG"), make_image("WEBP")])
    profile_b = profile(posts=[make_image("JPEG")])

    await analyze_style([profile_a, profile_b], style_analyzer=style_analyzer)

    [sent_profiles] = style_analyzer.calls
    assert len(sent_profiles) == 2
    assert sent_profiles[0].feed is not None
    assert sent_profiles[0].feed.mime_type == "image/jpeg"
    assert [post.mime_type for post in sent_profiles[0].posts] == ["image/png", "image/webp"]
    assert sent_profiles[1].feed is None
    assert [post.mime_type for post in sent_profiles[1].posts] == ["image/jpeg"]


async def test_a_profile_with_no_feed_is_sent_with_a_null_feed(
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    await analyze_style([profile(posts=[make_image()])], style_analyzer=style_analyzer)

    [sent_profiles] = style_analyzer.calls
    assert sent_profiles[0].feed is None
    assert len(sent_profiles[0].posts) == 1


async def test_rejects_an_image_over_the_size_limit(
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    oversized = b"\x00" * (MAX_IMAGE_BYTES + 1)

    with pytest.raises(ImageTooLargeError, match="larger than 10 MB"):
        await analyze_style([profile(feed=oversized)], style_analyzer=style_analyzer)

    assert style_analyzer.calls == []


async def test_rejects_bytes_that_are_not_an_image(
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    not_an_image = b"this is a text file, not a photo"

    with pytest.raises(InvalidImageError, match="not a readable image"):
        await analyze_style([profile(feed=not_an_image)], style_analyzer=style_analyzer)

    assert style_analyzer.calls == []


async def test_rejects_a_decodable_image_in_an_unsupported_format(
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    gif_bytes = make_image("GIF")

    with pytest.raises(InvalidImageError, match="Unsupported image format"):
        await analyze_style([profile(feed=gif_bytes)], style_analyzer=style_analyzer)

    assert style_analyzer.calls == []


async def test_validates_a_bad_post_image_even_when_the_feed_is_fine(
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    bad_post = b"this is a text file, not a photo"

    with pytest.raises(InvalidImageError):
        await analyze_style(
            [profile(feed=jpeg_bytes, posts=[bad_post])], style_analyzer=style_analyzer
        )

    assert style_analyzer.calls == []


async def test_propagates_a_busy_provider(jpeg_bytes: bytes) -> None:
    busy = RecordingStyleAnalyzer(error=AIServiceBusyError("AI service is temporarily busy."))

    with pytest.raises(AIServiceBusyError):
        await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=busy)


@pytest.mark.parametrize(
    "missing_key",
    ["visual_style_notes", "content_style_notes", "content_pillars", "recommendations"],
)
async def test_a_missing_top_level_key_raises_a_malformed_error_not_a_key_error(
    missing_key: str,
    jpeg_bytes: bytes,
) -> None:
    incomplete = dict(GENERATED_STYLE_ANALYSIS)
    del incomplete[missing_key]
    generator = RecordingStyleAnalyzer(result=incomplete)

    with pytest.raises(AIResponseMalformedError, match="missing"):
        await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=generator)


async def test_too_few_content_pillars_raises_a_malformed_error(jpeg_bytes: bytes) -> None:
    invalid = {**GENERATED_STYLE_ANALYSIS, "content_pillars": ["Only one pillar."]}
    generator = RecordingStyleAnalyzer(result=invalid)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=generator)


async def test_too_many_recommendations_raises_a_malformed_error(jpeg_bytes: bytes) -> None:
    invalid = {**GENERATED_STYLE_ANALYSIS, "recommendations": [f"Idea {i}" for i in range(7)]}
    generator = RecordingStyleAnalyzer(result=invalid)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=generator)


async def test_blank_entries_are_dropped_before_the_length_check(jpeg_bytes: bytes) -> None:
    """A blank string does not count towards the minimum, since it carries no
    actual recommendation - the same normalisation menu_analysis applies to
    its own list fields is applied here."""
    padded = {
        **GENERATED_STYLE_ANALYSIS,
        "content_pillars": ["  ", "Real pillar one.", "", "Real pillar two."],
    }
    generator = RecordingStyleAnalyzer(result=padded)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=generator)


async def test_passes_the_restaurant_context_to_the_analyzer(
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    await analyze_style(
        [profile(feed=jpeg_bytes)],
        style_analyzer=style_analyzer,
        cuisine_type="Neapolitan pizza",
        tone_of_voice="luxury",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    assert style_analyzer.contexts == [
        ("Neapolitan pizza", "luxury", "Italy", "German", "young professionals")
    ]


async def test_works_without_any_restaurant_context(
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    result = await analyze_style([profile(feed=jpeg_bytes)], style_analyzer=style_analyzer)

    assert result.visual_style_notes
    assert style_analyzer.contexts == [(None, None, None, None, None)]
