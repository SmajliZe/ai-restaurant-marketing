"""Orchestrates image validation and menu analysis."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, Final

import anyio.to_thread
from pydantic import ValidationError

from app.domain.content_generation.errors import AIResponseMalformedError
from app.domain.content_generation.service import detect_supported_mime_type
from app.domain.menu_analysis.ports import MenuAnalyzer
from app.schemas.menu_analysis import MenuAnalysisResponse

# What the provider's response must contain at the top level before we try to
# build a MenuAnalysisResponse out of it.
_REQUIRED_TOP_LEVEL_KEYS: Final = frozenset(
    {
        "overview",
        "pricing_notes",
        "description_quality",
        "upselling_ideas",
        "cross_selling_ideas",
        "missing_items",
        "improvement_suggestions",
    }
)


async def analyze_menu(
    image_bytes: bytes,
    *,
    menu_analyzer: MenuAnalyzer,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> MenuAnalysisResponse:
    """Read the menu in ``image_bytes`` and draft consultative feedback on it.

    ``cuisine_type``, ``country``, ``language`` and ``target_audience`` come
    from the calling restaurant's profile when there is one. All are
    optional, so the service stays usable without a profile behind it. No
    ``tone_of_voice``: this output is analytical, not brand-voiced marketing
    copy - see ``app.domain.menu_analysis.ports.MenuAnalyzer``.

    Reuses ``content_generation``'s image validation rather than
    reimplementing it: both domains accept the same JPEG/PNG/WebP-up-to-10MB
    upload, and a single Pillow-backed check is what keeps that rule from
    drifting between them.

    Raises:
        ImageTooLargeError: The image is over the shared size limit.
        InvalidImageError: The bytes are not a decodable image in a
            supported format.
        AIServiceError: The provider failed, or returned something unusable.
    """
    # Runs off the event loop: decoding a 10 MB image is CPU work, and blocking
    # here would stall every other request the worker is serving.
    mime_type = await anyio.to_thread.run_sync(detect_supported_mime_type, image_bytes)

    generated = await menu_analyzer(
        image_bytes,
        mime_type=mime_type,
        cuisine_type=cuisine_type,
        country=country,
        language=language,
        target_audience=target_audience,
    )
    return _to_menu_analysis_response(generated)


def _to_menu_analysis_response(generated: Mapping[str, Any]) -> MenuAnalysisResponse:
    # Checked explicitly, rather than left to the KeyError a missing key would
    # raise below, so a malformed response is always reported the same way
    # regardless of which key is missing.
    missing = _REQUIRED_TOP_LEVEL_KEYS - generated.keys()
    if missing:
        raise AIResponseMalformedError(
            f"The AI service response is missing: {', '.join(sorted(missing))}."
        )

    try:
        return MenuAnalysisResponse(
            overview=str(generated["overview"]).strip(),
            pricing_notes=str(generated["pricing_notes"]).strip(),
            description_quality=str(generated["description_quality"]).strip(),
            upselling_ideas=_normalise_list(generated["upselling_ideas"]),
            cross_selling_ideas=_normalise_list(generated["cross_selling_ideas"]),
            missing_items=_normalise_list(generated["missing_items"]),
            improvement_suggestions=_normalise_list(generated["improvement_suggestions"]),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        raise AIResponseMalformedError("The AI service returned an unexpected response.") from exc


def _normalise_list(values: Iterable[Any]) -> list[str]:
    """Strip whitespace and drop anything that turns out to be blank."""
    return [cleaned for value in values if (cleaned := str(value).strip())]
