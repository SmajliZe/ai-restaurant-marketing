"""Maps domain failures onto HTTP responses.

Registered once for the whole application so endpoints stay free of try/except
blocks and every route reports the same failure the same way.
"""

from __future__ import annotations

from typing import Final

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.content_generation.errors import (
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
    ImageTooLargeError,
    InvalidImageError,
)
from app.schemas.content_generation import ErrorResponse

# Seconds. Long enough for a per-minute quota window to roll over.
_RETRY_AFTER_SECONDS: Final = 30


def install_exception_handlers(app: FastAPI) -> None:
    """Starlette resolves handlers along the exception's MRO, so registering
    ``AIServiceError`` last makes it the fallback for its own subclasses."""
    app.add_exception_handler(RequestValidationError, _handle_request_validation)
    app.add_exception_handler(InvalidImageError, _handle_unprocessable)
    app.add_exception_handler(ImageTooLargeError, _handle_unprocessable)
    app.add_exception_handler(AIServiceBusyError, _handle_busy)
    app.add_exception_handler(AIServiceConfigurationError, _handle_unavailable)
    app.add_exception_handler(AIServiceError, _handle_bad_gateway)


def _error_response(
    status_code: int,
    exc: Exception,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(detail=str(exc))
    return JSONResponse(status_code=status_code, content=body.model_dump(), headers=headers)


async def _handle_request_validation(_: Request, exc: Exception) -> JSONResponse:
    """Collapse FastAPI's list-shaped body into the same object as every other
    failure, so a client never has to parse two shapes for one status code."""
    detail = _summarise(exc) if isinstance(exc, RequestValidationError) else str(exc)
    body = ErrorResponse(detail=detail)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=body.model_dump(),
    )


def _summarise(exc: RequestValidationError) -> str:
    problems = [
        f"{'.'.join(str(part) for part in error['loc'] if part != 'body') or 'request'}: "
        f"{error['msg']}"
        for error in exc.errors()
    ]
    return "; ".join(problems) or "The request could not be validated."


async def _handle_unprocessable(_: Request, exc: Exception) -> JSONResponse:
    return _error_response(status.HTTP_422_UNPROCESSABLE_CONTENT, exc)


async def _handle_busy(_: Request, exc: Exception) -> JSONResponse:
    return _error_response(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        exc,
        headers={"Retry-After": str(_RETRY_AFTER_SECONDS)},
    )


async def _handle_unavailable(_: Request, exc: Exception) -> JSONResponse:
    return _error_response(status.HTTP_503_SERVICE_UNAVAILABLE, exc)


async def _handle_bad_gateway(_: Request, exc: Exception) -> JSONResponse:
    return _error_response(status.HTTP_502_BAD_GATEWAY, exc)
