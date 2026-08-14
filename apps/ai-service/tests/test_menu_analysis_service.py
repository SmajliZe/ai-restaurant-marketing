"""Domain-level rules: what the menu analysis service accepts and refuses.

Image validation (size, format) is content_generation's own rule, reused
here rather than reimplemented - see test_content_generation_service.py for
the exhaustive cases; this file only re-proves the same rejections apply
when reached through analyze_menu, plus this domain's own response shape.
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
from app.domain.menu_analysis.service import analyze_menu
from tests.conftest import GENERATED_MENU_ANALYSIS, RecordingMenuAnalyzer, make_image


async def test_returns_an_analysis_for_a_valid_image(
    jpeg_bytes: bytes,
    menu_analyzer: RecordingMenuAnalyzer,
) -> None:
    result = await analyze_menu(jpeg_bytes, menu_analyzer=menu_analyzer)

    assert result.overview.startswith("A single-page Italian dinner menu")
    assert result.pricing_notes.startswith("Pizzas range from 9 to 14 EUR")
    assert len(result.upselling_ideas) == 3
    assert len(result.cross_selling_ideas) == 3
    assert result.missing_items == [
        "No non-alcoholic drink options are listed anywhere on the menu."
    ]
    assert len(result.improvement_suggestions) == 3
    assert menu_analyzer.calls == [(jpeg_bytes, "image/jpeg")]


async def test_an_empty_missing_items_list_is_valid() -> None:
    """min_length=0 on missing_items: a menu with no obvious gaps is a
    perfectly normal result, not a malformed response."""
    result_data = {**GENERATED_MENU_ANALYSIS, "missing_items": []}
    generator = RecordingMenuAnalyzer(result=result_data)

    result = await analyze_menu(make_image(), menu_analyzer=generator)

    assert result.missing_items == []


async def test_rejects_an_image_over_the_size_limit(
    menu_analyzer: RecordingMenuAnalyzer,
) -> None:
    oversized = b"\x00" * (MAX_IMAGE_BYTES + 1)

    with pytest.raises(ImageTooLargeError, match="larger than 10 MB"):
        await analyze_menu(oversized, menu_analyzer=menu_analyzer)

    # The size check has to happen before we spend a call on the provider.
    assert menu_analyzer.calls == []


async def test_rejects_bytes_that_are_not_an_image(
    menu_analyzer: RecordingMenuAnalyzer,
) -> None:
    not_an_image = b"this is a text file, not a photo"

    with pytest.raises(InvalidImageError, match="not a readable image"):
        await analyze_menu(not_an_image, menu_analyzer=menu_analyzer)

    assert menu_analyzer.calls == []


async def test_rejects_an_empty_upload(menu_analyzer: RecordingMenuAnalyzer) -> None:
    with pytest.raises(InvalidImageError, match="empty"):
        await analyze_menu(b"", menu_analyzer=menu_analyzer)


async def test_rejects_a_decodable_image_in_an_unsupported_format(
    menu_analyzer: RecordingMenuAnalyzer,
) -> None:
    gif_bytes = make_image("GIF")

    with pytest.raises(InvalidImageError, match="Unsupported image format"):
        await analyze_menu(gif_bytes, menu_analyzer=menu_analyzer)

    assert menu_analyzer.calls == []


async def test_propagates_a_busy_provider(jpeg_bytes: bytes) -> None:
    busy = RecordingMenuAnalyzer(error=AIServiceBusyError("AI service is temporarily busy."))

    with pytest.raises(AIServiceBusyError):
        await analyze_menu(jpeg_bytes, menu_analyzer=busy)


@pytest.mark.parametrize(
    "missing_key",
    [
        "overview",
        "pricing_notes",
        "description_quality",
        "upselling_ideas",
        "cross_selling_ideas",
        "missing_items",
        "improvement_suggestions",
    ],
)
async def test_a_missing_top_level_key_raises_a_malformed_error_not_a_key_error(
    missing_key: str,
    jpeg_bytes: bytes,
) -> None:
    incomplete = dict(GENERATED_MENU_ANALYSIS)
    del incomplete[missing_key]
    generator = RecordingMenuAnalyzer(result=incomplete)

    with pytest.raises(AIResponseMalformedError, match="missing"):
        await analyze_menu(jpeg_bytes, menu_analyzer=generator)


async def test_too_few_upselling_ideas_raises_a_malformed_error(jpeg_bytes: bytes) -> None:
    invalid = {**GENERATED_MENU_ANALYSIS, "upselling_ideas": ["Only one idea."]}
    generator = RecordingMenuAnalyzer(result=invalid)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_menu(jpeg_bytes, menu_analyzer=generator)


async def test_too_many_improvement_suggestions_raises_a_malformed_error(
    jpeg_bytes: bytes,
) -> None:
    invalid = {
        **GENERATED_MENU_ANALYSIS,
        "improvement_suggestions": [f"Idea {i}" for i in range(7)],
    }
    generator = RecordingMenuAnalyzer(result=invalid)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_menu(jpeg_bytes, menu_analyzer=generator)


async def test_too_many_missing_items_raises_a_malformed_error(jpeg_bytes: bytes) -> None:
    """0 to 5 is the valid range - 6 is one too many."""
    invalid = {**GENERATED_MENU_ANALYSIS, "missing_items": [f"Gap {i}" for i in range(6)]}
    generator = RecordingMenuAnalyzer(result=invalid)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_menu(jpeg_bytes, menu_analyzer=generator)


async def test_blank_entries_are_dropped_before_the_length_check(jpeg_bytes: bytes) -> None:
    """A blank string does not count towards the minimum, since it carries no
    actual feedback - the same normalisation content_generation applies to
    hashtags is applied here to list entries."""
    padded = {
        **GENERATED_MENU_ANALYSIS,
        "upselling_ideas": ["  ", "Real idea one.", "", "Real idea two."],
    }
    generator = RecordingMenuAnalyzer(result=padded)

    with pytest.raises(AIResponseMalformedError, match="unexpected response"):
        await analyze_menu(jpeg_bytes, menu_analyzer=generator)


async def test_passes_the_restaurant_context_to_the_analyzer(
    jpeg_bytes: bytes,
    menu_analyzer: RecordingMenuAnalyzer,
) -> None:
    await analyze_menu(
        jpeg_bytes,
        menu_analyzer=menu_analyzer,
        cuisine_type="Neapolitan pizza",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    assert menu_analyzer.contexts == [
        ("Neapolitan pizza", "Italy", "German", "young professionals")
    ]


async def test_works_without_any_restaurant_context(
    jpeg_bytes: bytes,
    menu_analyzer: RecordingMenuAnalyzer,
) -> None:
    result = await analyze_menu(jpeg_bytes, menu_analyzer=menu_analyzer)

    assert result.overview
    assert menu_analyzer.contexts == [(None, None, None, None)]
