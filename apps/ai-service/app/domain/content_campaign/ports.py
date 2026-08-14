"""What the domain needs from an AI provider, expressed without naming one.

``app.infrastructure.campaign_client.generate_campaign`` is the production
implementation; tests substitute a plain function. Mirrors
``content_calendar.ports.CalendarGenerator`` - individual keyword arguments,
plus the one new required ``occasion`` argument this domain needs.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol


class CampaignGenerator(Protocol):
    """Builds a complete marketing campaign around one occasion for one restaurant.

    Returns the raw mapping the provider produced. Implementations are
    responsible for translating provider-specific failures into the
    exceptions in ``app.domain.content_generation.errors``.

    The restaurant details are optional so the service stays usable without a
    profile behind it; the occasion is not, since a campaign needs something
    to be about.
    """

    async def __call__(
        self,
        occasion: str,
        *,
        tone_of_voice: str | None = None,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]: ...
