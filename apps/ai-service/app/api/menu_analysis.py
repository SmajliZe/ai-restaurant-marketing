"""Menu analysis endpoints."""

from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.api.dependencies import get_menu_analyzer
from app.api.upload import read_within_limit, reject_unsupported_content_type
from app.domain.menu_analysis.ports import MenuAnalyzer
from app.domain.menu_analysis.service import analyze_menu
from app.schemas.common import ErrorResponse
from app.schemas.menu_analysis import MenuAnalysisRequestContext, MenuAnalysisResponse

router = APIRouter(prefix="/menu-analysis", tags=["menu-analysis"])

_ERROR_RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    status.HTTP_413_CONTENT_TOO_LARGE: {
        "model": ErrorResponse,
        "description": "The image is larger than the 10 MB limit.",
    },
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {
        "model": ErrorResponse,
        "description": (
            "The upload is not JPEG, PNG or WebP, either by its declared content "
            "type or by its actual bytes."
        ),
    },
    status.HTTP_422_UNPROCESSABLE_CONTENT: {
        "model": ErrorResponse,
        "description": "The request is missing the image field.",
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
    "/analyze",
    response_model=MenuAnalysisResponse,
    responses=_ERROR_RESPONSES,
    summary="Analyze a photo of a menu and return consultative feedback",
)
async def analyze_menu_route(
    image: Annotated[UploadFile, File(description="JPEG, PNG or WebP photo, up to 10 MB.")],
    menu_analyzer: Annotated[MenuAnalyzer, Depends(get_menu_analyzer)],
    cuisine_type: Annotated[str | None, Form(description="What the restaurant serves.")] = None,
    country: Annotated[str | None, Form(description="Where the restaurant is.")] = None,
    language: Annotated[str | None, Form(description="Language to write the feedback in.")] = None,
    target_audience: Annotated[str | None, Form(description="Who the restaurant serves.")] = None,
) -> MenuAnalysisResponse:
    reject_unsupported_content_type(image.content_type)
    image_bytes = await read_within_limit(image)

    # Declared as separate form fields rather than a model bound with Form():
    # FastAPI would take the model as a single field named "context", which is
    # not the flat multipart shape the web app sends.
    context = MenuAnalysisRequestContext(
        cuisine_type=cuisine_type,
        country=country,
        language=language,
        target_audience=target_audience,
    )

    return await analyze_menu(
        image_bytes,
        menu_analyzer=menu_analyzer,
        cuisine_type=context.cuisine_type,
        country=context.country,
        language=context.language,
        target_audience=context.target_audience,
    )
