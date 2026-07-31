"""Content generation endpoints."""

from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.api.dependencies import get_caption_generator
from app.domain.content_generation.errors import ImageTooLargeError, InvalidImageError
from app.domain.content_generation.ports import CaptionGenerator
from app.domain.content_generation.service import (
    MAX_IMAGE_BYTES,
    SUPPORTED_MIME_TYPES,
    generate_content,
)
from app.schemas.content_generation import (
    CaptionRequestContext,
    CaptionResponse,
    ErrorResponse,
)

router = APIRouter(prefix="/content", tags=["content"])

_READ_CHUNK_BYTES: Final = 64 * 1024

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
        "description": "The AI provider failed or returned something unusable.",
    },
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "model": ErrorResponse,
        "description": "The AI provider is rate limiting us, or is not configured.",
    },
}


@router.post(
    "/generate-caption",
    response_model=CaptionResponse,
    responses=_ERROR_RESPONSES,
    summary="Generate an Instagram caption from a photo of a dish",
)
async def generate_caption(
    image: Annotated[UploadFile, File(description="JPEG, PNG or WebP photo, up to 10 MB.")],
    caption_generator: Annotated[CaptionGenerator, Depends(get_caption_generator)],
    tone_of_voice: Annotated[str | None, Form(description="Voice to write in.")] = None,
    cuisine_type: Annotated[str | None, Form(description="What the restaurant serves.")] = None,
) -> CaptionResponse:
    _reject_unsupported_content_type(image.content_type)
    image_bytes = await _read_within_limit(image)

    # Declared as separate form fields rather than a model bound with Form():
    # FastAPI would take the model as a single field named "context", which is
    # not the flat multipart shape the web app sends.
    context = CaptionRequestContext(tone_of_voice=tone_of_voice, cuisine_type=cuisine_type)

    return await generate_content(
        image_bytes,
        caption_generator=caption_generator,
        tone_of_voice=context.tone_of_voice,
        cuisine_type=context.cuisine_type,
    )


def _reject_unsupported_content_type(content_type: str | None) -> None:
    """Cheap rejection before anything is read off the wire.

    The declared type is a hint, not proof - the service re-derives the real
    format from the bytes - but it lets an obviously wrong upload fail fast.
    """
    # Browsers append parameters such as "; charset=..." to Content-Type.
    declared = (content_type or "").split(";")[0].strip().lower()
    if declared not in SUPPORTED_MIME_TYPES:
        supported = ", ".join(sorted(SUPPORTED_MIME_TYPES))
        raise InvalidImageError(
            f"Unsupported content type '{declared or 'unknown'}'. Use one of: {supported}."
        )


async def _read_within_limit(upload: UploadFile) -> bytes:
    """Buffer the upload, aborting as soon as it exceeds the limit.

    Reading in chunks keeps an oversized upload from being held in memory in
    full just to be rejected afterwards.
    """
    chunks: list[bytes] = []
    total = 0

    while chunk := await upload.read(_READ_CHUNK_BYTES):
        total += len(chunk)
        if total > MAX_IMAGE_BYTES:
            limit_mb = MAX_IMAGE_BYTES // (1024 * 1024)
            raise ImageTooLargeError(f"The image is larger than {limit_mb} MB.")
        chunks.append(chunk)

    return b"".join(chunks)
