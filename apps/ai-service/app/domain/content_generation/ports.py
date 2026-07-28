"""What the domain needs from an AI provider, expressed without naming one.

``app.infrastructure.vision_client.generate_caption`` is the production
implementation; tests substitute a plain function.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol


class CaptionGenerator(Protocol):
    """Describes a dish in an image and drafts social copy for it.

    Returns the raw mapping the provider produced. Implementations are
    responsible for translating provider-specific failures into the exceptions
    in ``app.domain.content_generation.errors``.
    """

    async def __call__(self, image_bytes: bytes, *, mime_type: str) -> Mapping[str, Any]: ...
