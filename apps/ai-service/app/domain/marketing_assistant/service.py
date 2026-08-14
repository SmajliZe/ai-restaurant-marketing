"""Orchestrates history capping and assistant chat."""

from __future__ import annotations

from typing import Final

from app.domain.content_generation.errors import AIResponseMalformedError
from app.domain.marketing_assistant.ports import MarketingAssistant
from app.schemas.marketing_assistant import AssistantChatRequest, AssistantResponse

# Bounds both the cost of a call and how much of the model's context window
# one turn can spend on history alone - a long-running conversation should
# not make every new turn linearly more expensive to answer, and the model
# does not need the entire history to answer the latest question well once a
# conversation has gone on for a while.
MAX_HISTORY_MESSAGES: Final = 20


async def chat(
    request: AssistantChatRequest,
    *,
    marketing_assistant: MarketingAssistant,
) -> AssistantResponse:
    """Continue the conversation in ``request.messages`` and return the
    assistant's reply.

    Every field on ``request.context`` is optional, so the service answers
    the same way it always did when nothing is known about the caller. Only
    the most recent ``MAX_HISTORY_MESSAGES`` are sent to the provider, even
    when the caller has sent more.

    Raises:
        AIServiceError: The provider failed, refused, or returned an empty
            reply.
    """
    capped = request.messages[-MAX_HISTORY_MESSAGES:]

    reply = await marketing_assistant(
        capped,
        tone_of_voice=request.context.tone_of_voice,
        cuisine_type=request.context.cuisine_type,
        country=request.context.country,
        language=request.context.language,
        target_audience=request.context.target_audience,
        activity_summary=request.context.activity_summary,
    )
    return _to_assistant_response(reply)


def _to_assistant_response(reply: str) -> AssistantResponse:
    stripped = reply.strip()
    if not stripped:
        raise AIResponseMalformedError("The AI service returned an empty reply.")
    return AssistantResponse(reply=stripped)
