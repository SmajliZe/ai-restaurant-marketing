from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ContentRequestContext(BaseModel):
    """What the caller knows about the restaurant, if anything.

    All fields are optional at the API level so the service can be exercised
    on its own - by a test, a script, or a future caller that has no profile.
    The web app always sends all of them, because it refuses to reach this
    endpoint before a profile exists.
    """

    tone_of_voice: str | None = Field(
        default=None,
        description='Voice the content should adopt, for example "luxury".',
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
        description='Language to write the content in, for example "German".',
    )
    target_audience: str | None = Field(
        default=None,
        description='Who the content should speak to, for example "young professionals".',
    )

    @field_validator(
        "tone_of_voice",
        "cuisine_type",
        "country",
        "language",
        "target_audience",
        mode="before",
    )
    @classmethod
    def _blank_means_absent(cls, value: object) -> object:
        """A form field left empty is the same as one that was never sent.

        Without this, an empty string would reach the prompt and produce
        "Write in a  tone."
        """
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


class InstagramContent(BaseModel):
    caption: str = Field(description="Instagram caption, one to three sentences.")
    hashtags: list[str] = Field(
        description='Hashtags without the leading "#", ready to be joined by the client.',
    )


class FacebookContent(BaseModel):
    post: str = Field(description="Facebook post, three to five sentences.")
    hashtags: list[str] = Field(
        description='Hashtags without the leading "#", ready to be joined by the client.',
    )


class StickerType(StrEnum):
    POLL = "poll"
    QUESTION = "question"
    EMOJI_SLIDER = "emoji_slider"
    COUNTDOWN = "countdown"


class StoryContent(BaseModel):
    text: str = Field(description="Short text overlay for the story.")
    cta: str = Field(description="Call to action for the story.")
    sticker_type: StickerType = Field(description="Which interactive sticker to attach.")
    sticker_prompt: str = Field(description="What the sticker itself should say or ask.")


class ContentResponse(BaseModel):
    recognized_dish: str = Field(description="The dish the model identified in the photo.")
    confidence: float = Field(
        ge=0,
        le=1,
        description="AI certainty about the dish recognition, from 0 to 1.",
    )
    instagram: InstagramContent
    facebook: FacebookContent
    story: StoryContent

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "recognized_dish": "Margherita pizza",
                    "confidence": 0.92,
                    "instagram": {
                        "caption": (
                            "Blistered crust, San Marzano tomatoes, and mozzarella that pulls "
                            "for days. We fired this one 90 seconds ago."
                        ),
                        "hashtags": ["margherita", "woodfiredpizza", "pizzanight", "eatlocal"],
                    },
                    "facebook": {
                        "post": (
                            "There's something about a pizza straight out of the wood-fired "
                            "oven that just hits different. Blistered crust, San Marzano "
                            "tomatoes, fresh mozzarella - simple ingredients, done right. "
                            "Come grab a table before the dinner rush. We'll have one waiting "
                            "for you."
                        ),
                        "hashtags": ["woodfiredpizza"],
                    },
                    "story": {
                        "text": "Fresh out of the oven 🔥",
                        "cta": "Swipe up to book a table",
                        "sticker_type": "poll",
                        "sticker_prompt": "Margherita or pepperoni tonight?",
                    },
                }
            ]
        }
    )


class ErrorResponse(BaseModel):
    """Body returned for every handled failure, so clients parse one shape."""

    detail: str = Field(description="Human-readable explanation, safe to show to an end user.")
