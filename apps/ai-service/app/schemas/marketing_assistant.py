from __future__ import annotations

from typing import Final, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import blank_means_absent

# Our own code assembles this from our own data (see the web app's
# buildActivitySummary), not a restaurant typing free text into a profile
# field, so it does not need the same injection guard as the fields below.
# It is still capped, as a sane bound on how much of the prompt one field
# can occupy.
_MAX_ACTIVITY_SUMMARY_CHARS: Final = 1500

# Matches the web app's own MAX_MESSAGE_LENGTH: a few thousand characters is
# plenty for a chat message, and the service enforces its own bound rather
# than trusting the one caller it has today to always enforce it first.
_MAX_MESSAGE_CHARS: Final = 4000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = Field(description="Who sent this turn.")
    content: str = Field(min_length=1, max_length=_MAX_MESSAGE_CHARS)


class AssistantRequestContext(BaseModel):
    """What the caller knows about the restaurant and its recent activity, if anything."""

    tone_of_voice: str | None = Field(
        default=None,
        description='Voice the restaurant writes in, for example "luxury".',
    )
    cuisine_type: str | None = Field(
        default=None,
        description='What the restaurant serves, for example "Neapolitan pizza".',
    )
    country: str | None = Field(
        default=None,
        description='Where the restaurant is, for example "Bosnia and Herzegovina".',
    )
    language: str | None = Field(
        default=None,
        description='Language to reply in, for example "German".',
    )
    target_audience: str | None = Field(
        default=None,
        description='Who the restaurant serves, for example "young professionals".',
    )
    activity_summary: str | None = Field(
        default=None,
        description=(
            "A short plain-text snapshot of the restaurant's recent activity - recent "
            "generated content, this week's planned themes, active campaigns, and the "
            "latest menu analysis - built by the caller, not typed by the restaurant."
        ),
    )

    _validate_blank = field_validator(
        "tone_of_voice",
        "cuisine_type",
        "country",
        "language",
        "target_audience",
        mode="before",
    )(blank_means_absent)

    @field_validator("activity_summary", mode="before")
    @classmethod
    def _cap_activity_summary(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped[:_MAX_ACTIVITY_SUMMARY_CHARS] or None
        return value


class AssistantChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(
        min_length=1,
        description="Conversation so far, oldest first, ending with the latest user message.",
    )
    context: AssistantRequestContext


class AssistantResponse(BaseModel):
    reply: str = Field(min_length=1, description="The assistant's reply to the latest message.")
