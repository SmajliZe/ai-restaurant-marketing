from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import blank_means_absent
from app.schemas.content_generation import StoryContent


class CampaignRequestContext(BaseModel):
    """What the caller knows about the restaurant, and the occasion to build
    a campaign around.

    ``occasion`` is required - unlike every other domain's context, a
    campaign needs something to be about. Everything else is optional, at
    the API level, for the same reason content_generation's
    ``ContentRequestContext`` is: the service stays usable without a profile
    behind it, and the web app always sends the rest because it refuses to
    reach this endpoint before a profile exists.
    """

    occasion: str = Field(description='What the campaign is for, for example "Happy Hour".')

    tone_of_voice: str | None = Field(
        default=None,
        description='Voice the campaign should adopt, for example "luxury".',
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
        description='Language to write the campaign in, for example "German".',
    )
    target_audience: str | None = Field(
        default=None,
        description='Who the campaign should speak to, for example "young professionals".',
    )

    @field_validator("occasion", mode="before")
    @classmethod
    def _occasion_is_required(cls, value: object) -> object:
        """Unlike the fields below, a blank occasion is not "absent" - it is
        invalid, since the whole request has nothing to build a campaign
        around."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped == "":
                raise ValueError("Occasion is required.")
            return stripped
        return value

    _validate_blank = field_validator(
        "tone_of_voice",
        "cuisine_type",
        "country",
        "language",
        "target_audience",
        mode="before",
    )(blank_means_absent)


class CampaignResponse(BaseModel):
    name: str = Field(description="A catchy campaign name, specific to the occasion.")
    description: str = Field(description="A short description of the campaign.")
    offer: str = Field(
        description=(
            "The shape of a suggested offer appropriate to the restaurant, e.g. "
            '"a limited-time combo deal" - never a specific price or discount.'
        ),
    )
    caption: str = Field(description="Instagram-ready caption for the campaign.")
    hashtags: list[str] = Field(
        min_length=5,
        max_length=10,
        description='Hashtags without the leading "#", ready to be joined by the client.',
    )
    story: StoryContent
    cta: str = Field(description="The campaign's own call to action.")
    duration_suggestion: str = Field(
        description=(
            'A qualitative suggested duration, e.g. "This weekend only" - never specific '
            "calendar dates."
        ),
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "Aperitivo Hour",
                    "description": (
                        "A relaxed after-work window built around small plates and house "
                        "cocktails, to turn the quiet late-afternoon stretch into a reason "
                        "to stop by."
                    ),
                    "offer": "A complimentary small plate with any drink order",
                    "caption": (
                        "The golden hour just got better. Pull up a stool, order something "
                        "cold, and let us send out a little something to go with it. See "
                        "you after work. 🥂"
                    ),
                    "hashtags": [
                        "aperitivo",
                        "happyhour",
                        "afterwork",
                        "eatlocal",
                        "cocktailhour",
                    ],
                    "story": {
                        "text": "Aperitivo hour is calling 🥂",
                        "cta": "Swipe up to reserve a stool",
                        "sticker_type": "countdown",
                        "sticker_prompt": "Doors open in",
                    },
                    "cta": "Reserve your spot for aperitivo hour",
                    "duration_suggestion": "Every weekday, 5-7pm",
                }
            ]
        }
    )
