"""Shared Gemini SDK wiring: the cached client, the model name, and the
translation of SDK failures into domain errors - common to every adapter
that calls Gemini, whether the call carries an image or is text-only.

Kept apart from any one adapter so the client stays a true singleton (one
connection pool for the whole process, not one per capability) and the
error-mapping logic exists in exactly one place.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from functools import lru_cache
from http import HTTPStatus
from typing import Final

from google import genai
from google.genai import errors as genai_errors

from app.domain.content_generation.errors import (
    AIServiceBusyError,
    AIServiceConfigurationError,
    AIServiceError,
    AITimeoutError,
)
from app.infrastructure.config import get_settings

# Flash-class model, currently on the Gemini free tier. Model IDs are retired
# and replaced regularly - check https://ai.google.dev/pricing for what is
# free today before changing this.
MODEL_NAME: Final = "gemini-3.6-flash"

# Long enough for a slow call to still come back; short enough that a caller
# is not left waiting on a request that will never return.
REQUEST_TIMEOUT_SECONDS: Final = 30.0


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    """Build the SDK client once; it pools connections across requests.

    ``lru_cache`` does not memoise exceptions, so a missing key keeps raising
    until the process is restarted with one configured.
    """
    api_key = get_settings().gemini_api_key
    if not api_key:
        raise AIServiceConfigurationError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=api_key)


async def call_with_standard_error_handling[T](
    call: Callable[[], Awaitable[T]],
    *,
    timeout: float = REQUEST_TIMEOUT_SECONDS,
) -> T:
    """Await ``call()`` under a timeout, translating SDK failures into the
    domain's own exceptions.

    Every adapter's SDK call looks the same from here: a coroutine that
    either returns a response or raises one of the SDK's exception types.
    What differs per adapter - the request itself, and what it does with a
    successful response - stays with the caller; this only owns the part
    that would otherwise be copied into every adapter unchanged.
    """
    try:
        return await asyncio.wait_for(call(), timeout=timeout)
    except TimeoutError as exc:
        raise AITimeoutError("The AI service took too long to respond.") from exc
    except genai_errors.ClientError as exc:
        if exc.code == HTTPStatus.TOO_MANY_REQUESTS:
            raise AIServiceBusyError(
                "AI service is temporarily busy, please try again in a moment."
            ) from exc
        raise AIServiceError("The AI service rejected the request.") from exc
    except genai_errors.APIError as exc:
        raise AIServiceError("The AI service is currently unavailable.") from exc
