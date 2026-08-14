"""What the domain needs from an AI provider, expressed without naming one.

``app.infrastructure.marketing_assistant_client.chat`` is the production
implementation; tests substitute a plain function.
"""

from __future__ import annotations

from typing import Protocol

from app.schemas.marketing_assistant import ChatMessage


class MarketingAssistant(Protocol):
    """Continues a conversation and returns the assistant's raw reply text.

    Returns plain text rather than a mapping, unlike every other generator
    Protocol in this service: a chat reply has no rigid shape to validate,
    so there is nothing for the service to destructure here. Implementations
    are responsible for translating provider-specific failures into the
    exceptions in ``app.domain.content_generation.errors``.

    The restaurant details are optional so the service stays usable without
    a profile behind it, the same as every other domain in this service.
    """

    async def __call__(
        self,
        messages: list[ChatMessage],
        *,
        tone_of_voice: str | None = None,
        cuisine_type: str | None = None,
        country: str | None = None,
        language: str | None = None,
        target_audience: str | None = None,
        activity_summary: str | None = None,
    ) -> str: ...
