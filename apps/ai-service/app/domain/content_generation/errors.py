"""Failures this domain can produce.

Each message is written for an end user, because the API layer surfaces it
verbatim. Nothing here mentions HTTP status codes or an AI vendor; mapping to a
transport lives in ``app.api.errors``.
"""

from __future__ import annotations


class ContentGenerationError(Exception):
    """Base class, so callers can catch the whole domain in one clause."""


class InvalidImageError(ContentGenerationError):
    """The upload is not an image we can send to the model."""


class ImageTooLargeError(ContentGenerationError):
    """The upload exceeds the size the model accepts."""


class AIServiceError(ContentGenerationError):
    """The model was reachable but did not return usable content."""


class AIServiceBusyError(AIServiceError):
    """The provider rejected the call for rate limiting or quota reasons.

    Retrying later is expected to succeed, which is what separates this from
    its parent.
    """


class AIServiceConfigurationError(AIServiceError):
    """The provider is not usable because credentials are missing."""
