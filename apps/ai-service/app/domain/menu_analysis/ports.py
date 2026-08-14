"""What the domain needs from an AI provider, expressed without naming one.

``app.infrastructure.menu_analysis_client.analyze_menu`` is the production
implementation; tests substitute a plain function.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol


class MenuAnalyzer(Protocol):
    """Reads a photographed menu and drafts consultative feedback on it.

    Returns the raw mapping the provider produced. Implementations are
    responsible for translating provider-specific failures into the
    exceptions in ``app.domain.content_generation.errors``.

    No ``tone_of_voice``, unlike ``CaptionGenerator``: this output is
    analytical, not brand-voiced marketing copy, so the restaurant's tone
    should not shape it. The other restaurant details are optional so the
    service stays usable without a profile behind it.
    """

    async def __call__(
        self,
        image_bytes: bytes,
        *,
        mime_type: str,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
    ) -> Mapping[str, Any]: ...
