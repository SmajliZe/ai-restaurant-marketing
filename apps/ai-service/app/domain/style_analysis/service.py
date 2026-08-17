"""Orchestrates image validation and style analysis."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, Final, NamedTuple

import anyio.to_thread
from pydantic import ValidationError

from app.domain.content_generation.errors import AIResponseMalformedError
from app.domain.content_generation.service import detect_supported_mime_type
from app.domain.style_analysis.ports import ReferenceImage, ReferenceProfileImages, StyleAnalyzer
from app.schemas.style_analysis import StyleAnalysisResponse

# What the provider's response must contain at the top level before we try to
# build a StyleAnalysisResponse out of it.
_REQUIRED_TOP_LEVEL_KEYS: Final = frozenset(
    {"visual_style_notes", "content_style_notes", "content_pillars", "recommendations"}
)


class RawProfileImages(NamedTuple):
    """One reference profile's screenshots, as uploaded - not yet mime-typed."""

    feed: bytes | None
    posts: list[bytes]


async def analyze_style(
    profiles: list[RawProfileImages],
    *,
    style_analyzer: StyleAnalyzer,
    cuisine_type: str | None = None,
    tone_of_voice: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> StyleAnalysisResponse:
    """Read the reference profile screenshots in ``profiles`` and draft an
    original design and content plan for the restaurant described by the
    other arguments.

    Every restaurant-context argument is optional, so the service stays
    usable without a profile behind it. Whether at least one image was
    actually provided is the caller's responsibility to check - see
    ``app.api.style_analysis``, which rejects an empty request with a 422
    before this is ever reached, rather than letting it fail confusingly
    further down.

    Reuses ``content_generation``'s image validation rather than
    reimplementing it, once per image: every domain that accepts an upload
    in this service accepts the same JPEG/PNG/WebP-up-to-10MB image, and a
    single Pillow-backed check is what keeps that rule from drifting between
    them.

    Raises:
        ImageTooLargeError: An image is over the shared size limit.
        InvalidImageError: An image's bytes are not a decodable image in a
            supported format.
        AIServiceError: The provider failed, or returned something unusable.
    """
    typed_profiles = [await _detect_profile_mime_types(profile) for profile in profiles]

    generated = await style_analyzer(
        typed_profiles,
        cuisine_type=cuisine_type,
        tone_of_voice=tone_of_voice,
        country=country,
        language=language,
        target_audience=target_audience,
    )
    return _to_style_analysis_response(generated)


async def _detect_profile_mime_types(profile: RawProfileImages) -> ReferenceProfileImages:
    feed = None
    if profile.feed is not None:
        # Runs off the event loop: decoding an image is CPU work, and blocking
        # here would stall every other request the worker is serving.
        mime_type = await anyio.to_thread.run_sync(detect_supported_mime_type, profile.feed)
        feed = ReferenceImage(profile.feed, mime_type)

    posts = []
    for post_bytes in profile.posts:
        mime_type = await anyio.to_thread.run_sync(detect_supported_mime_type, post_bytes)
        posts.append(ReferenceImage(post_bytes, mime_type))

    return ReferenceProfileImages(feed=feed, posts=posts)


def _to_style_analysis_response(generated: Mapping[str, Any]) -> StyleAnalysisResponse:
    # Checked explicitly, rather than left to the KeyError a missing key would
    # raise below, so a malformed response is always reported the same way
    # regardless of which key is missing.
    missing = _REQUIRED_TOP_LEVEL_KEYS - generated.keys()
    if missing:
        raise AIResponseMalformedError(
            f"The AI service response is missing: {', '.join(sorted(missing))}."
        )

    try:
        return StyleAnalysisResponse(
            visual_style_notes=str(generated["visual_style_notes"]).strip(),
            content_style_notes=str(generated["content_style_notes"]).strip(),
            content_pillars=_normalise_list(generated["content_pillars"]),
            recommendations=_normalise_list(generated["recommendations"]),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        raise AIResponseMalformedError("The AI service returned an unexpected response.") from exc


def _normalise_list(values: Iterable[Any]) -> list[str]:
    """Strip whitespace and drop anything that turns out to be blank."""
    return [cleaned for value in values if (cleaned := str(value).strip())]
