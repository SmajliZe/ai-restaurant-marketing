"""What the domain needs from an AI provider, expressed without naming one.

``app.infrastructure.style_analysis_client.analyze_style`` is the production
implementation; tests substitute a plain function.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, NamedTuple, Protocol


class ReferenceImage(NamedTuple):
    """One screenshot, already validated and mime-typed."""

    data: bytes
    mime_type: str


class ReferenceProfileImages(NamedTuple):
    """One reference profile's screenshots.

    ``feed`` and ``posts`` are kept apart, rather than one flat list, so an
    adapter can label them differently in the request to Gemini - a feed
    screenshot shows the grid's overall aesthetic, individual post
    screenshots show closer per-post detail, and that distinction is worth
    preserving through to the model. Either can be empty: a profile is only
    required to contribute at least one image somewhere across all profiles,
    not to be complete in every slot.
    """

    feed: ReferenceImage | None
    posts: list[ReferenceImage]


class StyleAnalyzer(Protocol):
    """Reads reference profile screenshots and drafts an original design and
    content plan for this restaurant.

    Returns the raw mapping the provider produced. Implementations are
    responsible for translating provider-specific failures into the
    exceptions in ``app.domain.content_generation.errors``.

    The restaurant details are optional so the service stays usable without
    a profile behind it, the same as every other domain in this service.
    """

    async def __call__(
        self,
        profiles: list[ReferenceProfileImages],
        *,
        cuisine_type: str | None = None,
        tone_of_voice: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]: ...
