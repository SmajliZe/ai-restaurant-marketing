from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CaptionRequestContext(BaseModel):
    """What the caller knows about the restaurant, if anything.

    Both fields are optional at the API level so the service can be exercised
    on its own - by a test, a script, or a future caller that has no profile.
    The web app always sends both, because it refuses to reach this endpoint
    before a profile exists.
    """

    tone_of_voice: str | None = Field(
        default=None,
        description='Voice the caption should adopt, for example "luxury".',
    )
    cuisine_type: str | None = Field(
        default=None,
        description='What the restaurant serves, for example "Neapolitan pizza".',
    )

    @field_validator("tone_of_voice", "cuisine_type", mode="before")
    @classmethod
    def _blank_means_absent(cls, value: object) -> object:
        """A form field left empty is the same as one that was never sent.

        Without this, an empty string would reach the prompt and produce
        "Write in a  tone."
        """
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


class CaptionResponse(BaseModel):
    recognized_dish: str = Field(description="The dish the model identified in the photo.")
    caption: str = Field(description="Instagram caption, one to three sentences.")
    hashtags: list[str] = Field(
        description='Hashtags without the leading "#", ready to be joined by the client.',
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "recognized_dish": "Margherita pizza",
                    "caption": (
                        "Blistered crust, San Marzano tomatoes, and mozzarella that pulls "
                        "for days. We fired this one 90 seconds ago."
                    ),
                    "hashtags": ["margherita", "woodfiredpizza", "pizzanight", "eatlocal"],
                }
            ]
        }
    )


class ErrorResponse(BaseModel):
    """Body returned for every handled failure, so clients parse one shape."""

    detail: str = Field(description="Human-readable explanation, safe to show to an end user.")
