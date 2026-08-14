"""Marketing campaign endpoints."""

from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_campaign_generator
from app.domain.content_campaign.ports import CampaignGenerator
from app.domain.content_campaign.service import generate_campaign
from app.schemas.common import ErrorResponse
from app.schemas.content_campaign import CampaignRequestContext, CampaignResponse

router = APIRouter(prefix="/campaign", tags=["campaign"])

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
    response_model=CampaignResponse,
    responses=_ERROR_RESPONSES,
    summary="Build a complete marketing campaign for an occasion",
)
async def generate_campaign_route(
    context: CampaignRequestContext,
    campaign_generator: Annotated[CampaignGenerator, Depends(get_campaign_generator)],
) -> CampaignResponse:
    # A JSON body, the same as /calendar/generate: there is no file riding
    # alongside it, so CampaignRequestContext can be the request model
    # directly instead of being reassembled from separate Form() fields.
    return await generate_campaign(context, campaign_generator=campaign_generator)
