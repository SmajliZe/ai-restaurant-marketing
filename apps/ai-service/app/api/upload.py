"""Multipart-upload handling shared by every endpoint that accepts an image.

The size and content-type checks live here once so every image-accepting
route enforces them the same way and reports the same failure the same way -
content.py and menu_analysis.py both use this rather than each keeping its
own copy.
"""

from __future__ import annotations

from typing import Final

from fastapi import UploadFile

from app.domain.content_generation.errors import ImageTooLargeError, InvalidImageError
from app.domain.content_generation.service import MAX_IMAGE_BYTES, SUPPORTED_MIME_TYPES

_READ_CHUNK_BYTES: Final = 64 * 1024


def reject_unsupported_content_type(content_type: str | None) -> None:
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


async def read_within_limit(upload: UploadFile) -> bytes:
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
