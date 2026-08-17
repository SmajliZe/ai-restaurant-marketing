"""Style analysis endpoints.

Multipart field naming: up to three reference profiles, each with one feed
screenshot and up to three favourite-post screenshots, as twelve explicit,
individually optional fields - ``profile_1_feed``, ``profile_1_post_1``
through ``profile_1_post_3``, ``profile_2_feed``, and so on through
``profile_3_post_3``. Explicit named fields rather than an indexed
array-style name (``profiles[0][feed]``) because FastAPI's multipart
parsing has no native support for that shape, and twelve named fields is
small enough to stay readable while documenting exactly what the endpoint
accepts in the OpenAPI schema - a caller can see every slot without reading
this file.
"""

from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.dependencies import get_style_analyzer
from app.api.upload import read_within_limit, reject_unsupported_content_type
from app.domain.style_analysis.ports import StyleAnalyzer
from app.domain.style_analysis.service import RawProfileImages, analyze_style
from app.schemas.common import ErrorResponse
from app.schemas.style_analysis import StyleAnalysisRequestContext, StyleAnalysisResponse

router = APIRouter(prefix="/style-analysis", tags=["style-analysis"])

_ERROR_RESPONSES: Final[dict[int | str, dict[str, Any]]] = {
    status.HTTP_413_CONTENT_TOO_LARGE: {
        "model": ErrorResponse,
        "description": "An image is larger than the 10 MB limit.",
    },
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {
        "model": ErrorResponse,
        "description": (
            "An upload is not JPEG, PNG or WebP, either by its declared content "
            "type or by its actual bytes."
        ),
    },
    status.HTTP_422_UNPROCESSABLE_CONTENT: {
        "model": ErrorResponse,
        "description": "The request is missing every image field - at least one is required.",
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

_FeedFile = Annotated[
    UploadFile | None, File(description="This profile's feed overview screenshot.")
]
_PostFile = Annotated[UploadFile | None, File(description="One of this profile's favourite posts.")]


@router.post(
    "/analyze",
    response_model=StyleAnalysisResponse,
    responses=_ERROR_RESPONSES,
    summary="Analyze up to three reference Instagram profiles and draft an original style plan",
)
async def analyze_style_route(
    style_analyzer: Annotated[StyleAnalyzer, Depends(get_style_analyzer)],
    profile_1_feed: _FeedFile = None,
    profile_1_post_1: _PostFile = None,
    profile_1_post_2: _PostFile = None,
    profile_1_post_3: _PostFile = None,
    profile_2_feed: _FeedFile = None,
    profile_2_post_1: _PostFile = None,
    profile_2_post_2: _PostFile = None,
    profile_2_post_3: _PostFile = None,
    profile_3_feed: _FeedFile = None,
    profile_3_post_1: _PostFile = None,
    profile_3_post_2: _PostFile = None,
    profile_3_post_3: _PostFile = None,
    cuisine_type: Annotated[str | None, Form(description="What the restaurant serves.")] = None,
    tone_of_voice: Annotated[
        str | None, Form(description="Voice the restaurant writes in.")
    ] = None,
    country: Annotated[str | None, Form(description="Where the restaurant is.")] = None,
    language: Annotated[str | None, Form(description="Language to write the plan in.")] = None,
    target_audience: Annotated[str | None, Form(description="Who the restaurant serves.")] = None,
) -> StyleAnalysisResponse:
    profile_uploads: list[tuple[UploadFile | None, list[UploadFile | None]]] = [
        (profile_1_feed, [profile_1_post_1, profile_1_post_2, profile_1_post_3]),
        (profile_2_feed, [profile_2_post_1, profile_2_post_2, profile_2_post_3]),
        (profile_3_feed, [profile_3_post_1, profile_3_post_2, profile_3_post_3]),
    ]

    if all(feed is None and all(post is None for post in posts) for feed, posts in profile_uploads):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="At least one reference image is required.",
        )

    profiles: list[RawProfileImages] = []
    for feed_upload, post_uploads in profile_uploads:
        feed_bytes = await _validate_and_read(feed_upload) if feed_upload is not None else None
        post_bytes = [
            await _validate_and_read(post_upload)
            for post_upload in post_uploads
            if post_upload is not None
        ]
        # Skips a profile that ended up with nothing: an unused slot in the
        # form contributes no image, so it should not become an empty,
        # labelled "Reference profile" the model has nothing to look at.
        if feed_bytes is not None or post_bytes:
            profiles.append(RawProfileImages(feed=feed_bytes, posts=post_bytes))

    # Declared as separate form fields rather than a model bound with Form():
    # FastAPI would take the model as a single field named "context", which is
    # not the flat multipart shape the web app sends.
    context = StyleAnalysisRequestContext(
        cuisine_type=cuisine_type,
        tone_of_voice=tone_of_voice,
        country=country,
        language=language,
        target_audience=target_audience,
    )

    return await analyze_style(
        profiles,
        style_analyzer=style_analyzer,
        cuisine_type=context.cuisine_type,
        tone_of_voice=context.tone_of_voice,
        country=context.country,
        language=context.language,
        target_audience=context.target_audience,
    )


async def _validate_and_read(upload: UploadFile) -> bytes:
    reject_unsupported_content_type(upload.content_type)
    return await read_within_limit(upload)
