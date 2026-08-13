"""Content calendar endpoints."""

from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_calendar_generator
from app.domain.content_calendar.ports import CalendarGenerator
from app.domain.content_calendar.service import generate_weekly_calendar
from app.schemas.common import ErrorResponse
from app.schemas.content_calendar import CalendarRequestContext, CalendarResponse

router = APIRouter(prefix="/calendar", tags=["calendar"])

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
    "/generate",
    response_model=CalendarResponse,
    responses=_ERROR_RESPONSES,
    summary="Plan a week of content themes and angles for a restaurant",
)
async def generate_calendar_route(
    context: CalendarRequestContext,
    calendar_generator: Annotated[CalendarGenerator, Depends(get_calendar_generator)],
) -> CalendarResponse:
    # A JSON body rather than form fields: unlike /content/generate there is
    # no file riding alongside it, so CalendarRequestContext can be the
    # request model directly instead of being reassembled from separate
    # Form() fields.
    return await generate_weekly_calendar(context, calendar_generator=calendar_generator)
