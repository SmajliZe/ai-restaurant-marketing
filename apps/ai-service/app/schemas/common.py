"""Schema pieces shared by more than one domain's request/response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


def blank_means_absent(value: object) -> object:
    """A form or JSON field left blank is the same as one that was never sent.

    Without this, an empty string would reach a prompt and produce something
    like "Write in a  tone." Wired into a model with
    ``field_validator(...)(blank_means_absent)`` rather than a decorated
    classmethod, so every domain's optional restaurant-context fields apply
    the exact same rule instead of each redefining it. Runs with
    ``mode="before"`` so it is ahead of the ``str | None`` type coercion.
    """
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


class ErrorResponse(BaseModel):
    """Body returned for every handled failure, so clients parse one shape."""

    detail: str = Field(description="Human-readable explanation, safe to show to an end user.")
