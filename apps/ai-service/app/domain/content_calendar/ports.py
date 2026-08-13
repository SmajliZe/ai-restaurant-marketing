"""What the domain needs from an AI provider, expressed without naming one.

``app.infrastructure.calendar_client.generate_weekly_calendar`` is the
production implementation; tests substitute a plain function. Mirrors
``content_generation.ports.CaptionGenerator`` - individual keyword arguments
rather than a bundled context object, so the two ports stay parallel.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol


class CalendarGenerator(Protocol):
    """Plans a week of content themes and angles for one restaurant.

    Returns the raw mapping the provider produced. Implementations are
    responsible for translating provider-specific failures into the
    exceptions in ``app.domain.content_generation.errors``.

    The restaurant details are optional so the service stays usable without a
    profile behind it.
    """

    async def __call__(
        self,
        *,
        tone_of_voice: str | None = None,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]: ...
