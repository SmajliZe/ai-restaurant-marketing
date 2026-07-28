"""Orchestrates image validation and caption generation."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from io import BytesIO
from typing import Any, Final

import anyio.to_thread
from PIL import Image
from pydantic import ValidationError

from app.domain.content_generation.errors import (
    AIServiceError,
    ImageTooLargeError,
    InvalidImageError,
)
from app.domain.content_generation.ports import CaptionGenerator
from app.schemas.content_generation import CaptionResponse

MAX_IMAGE_BYTES: Final = 10 * 1024 * 1024

# Pillow reports formats, the model wants MIME types. Membership in this mapping
# is what makes a format supported, so the two never drift apart.
MIME_TYPE_BY_PILLOW_FORMAT: Final[dict[str, str]] = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}

SUPPORTED_MIME_TYPES: Final = frozenset(MIME_TYPE_BY_PILLOW_FORMAT.values())


async def generate_content(
    image_bytes: bytes,
    *,
    caption_generator: CaptionGenerator,
) -> CaptionResponse:
    """Describe the dish in ``image_bytes`` and draft a caption for it.

    Raises:
        ImageTooLargeError: The image is over ``MAX_IMAGE_BYTES``.
        InvalidImageError: The bytes are not a decodable image in a supported
            format.
        AIServiceError: The provider failed, or returned something unusable.
    """
    # Runs off the event loop: decoding a 10 MB image is CPU work, and blocking
    # here would stall every other request the worker is serving.
    mime_type = await anyio.to_thread.run_sync(detect_supported_mime_type, image_bytes)

    generated = await caption_generator(image_bytes, mime_type=mime_type)
    return _to_caption_response(generated)


def detect_supported_mime_type(image_bytes: bytes) -> str:
    """Return the MIME type of ``image_bytes``, rejecting anything unusable.

    The format is read from the bytes rather than from a client-supplied header,
    because a caller can declare any content type it likes.
    """
    if len(image_bytes) > MAX_IMAGE_BYTES:
        limit_mb = MAX_IMAGE_BYTES // (1024 * 1024)
        raise ImageTooLargeError(f"The image is larger than {limit_mb} MB.")

    if not image_bytes:
        raise InvalidImageError("The uploaded file is empty.")

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            pillow_format = image.format
            # Confirms the payload really decodes; Image.open only reads a header.
            image.verify()
    except Exception as exc:
        # Pillow signals a bad payload through a wide family of exceptions
        # (UnidentifiedImageError, OSError, SyntaxError, DecompressionBombError),
        # and the caller only cares that the upload was unusable.
        raise InvalidImageError("The uploaded file is not a readable image.") from exc

    mime_type = MIME_TYPE_BY_PILLOW_FORMAT.get(pillow_format or "")
    if mime_type is None:
        supported = ", ".join(sorted(MIME_TYPE_BY_PILLOW_FORMAT))
        raise InvalidImageError(f"Unsupported image format. Use one of: {supported}.")

    return mime_type


def _to_caption_response(generated: Mapping[str, Any]) -> CaptionResponse:
    try:
        return CaptionResponse(
            recognized_dish=str(generated["recognized_dish"]).strip(),
            caption=str(generated["caption"]).strip(),
            hashtags=_normalise_hashtags(generated["hashtags"]),
        )
    except (KeyError, TypeError, ValidationError) as exc:
        raise AIServiceError("The AI service returned an unexpected response.") from exc


def _normalise_hashtags(hashtags: Iterable[Any]) -> list[str]:
    """Strip "#" and duplicates.

    The prompt already asks for bare tags, but a model is free to ignore that,
    and clients should not have to handle both shapes.
    """
    seen: dict[str, None] = {}
    for hashtag in hashtags:
        cleaned = str(hashtag).strip().lstrip("#").strip()
        if cleaned:
            seen.setdefault(cleaned, None)
    return list(seen)
