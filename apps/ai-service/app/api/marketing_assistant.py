"""Marketing assistant chat endpoints."""

from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_marketing_assistant
from app.domain.marketing_assistant.ports import MarketingAssistant
from app.domain.marketing_assistant.service import chat
from app.schemas.common import ErrorResponse
from app.schemas.marketing_assistant import AssistantChatRequest, AssistantResponse

router = APIRouter(prefix="/assistant", tags=["assistant"])

# No 413/415: there is no upload on this endpoint, so neither an oversized
# nor an unsupported-media-type body is a failure mode this route can hit.
_ERROR_RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    status.HTTP_422_UNPROCESSABLE_CONTENT: {
        "model": ErrorResponse,
        "description": "The request body could not be validated.",
    },
    status.HTTP_502_BAD_GATEWAY: {
        "model": ErrorResponse,
        "description": "The AI provider failed, refused, or returned something unusable.",
    },
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "model": ErrorResponse,
        "description": "The AI provider is rate limiting us, or is not configured.",
    },
    status.HTTP_504_GATEWAY_TIMEOUT: {
        "model": ErrorResponse,
        "description": "The AI provider did not respond in time.",
    },
}


@router.post(
    "/chat",
    response_model=AssistantResponse,
    responses=_ERROR_RESPONSES,
    summary="Continue a marketing-advice conversation for a restaurant",
)
async def chat_route(
    request: AssistantChatRequest,
    marketing_assistant: Annotated[MarketingAssistant, Depends(get_marketing_assistant)],
) -> AssistantResponse:
    # A JSON body rather than form fields: the same reasoning as
    # /calendar/generate - there is no file riding alongside it, so
    # AssistantChatRequest can be the request model directly.
    return await chat(request, marketing_assistant=marketing_assistant)
