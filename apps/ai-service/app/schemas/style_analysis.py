from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import blank_means_absent


class StyleAnalysisRequestContext(BaseModel):
    """What the caller knows about the restaurant, if anything.

    Unlike menu analysis, this includes ``tone_of_voice``: the output here is
    a design/content plan meant to guide the restaurant's own brand voice,
    not analytical feedback on something that already exists.
    """

    cuisine_type: str | None = Field(
        default=None,
        description='What the restaurant serves, for example "Neapolitan pizza".',
    )
    tone_of_voice: str | None = Field(
        default=None,
        description='Voice the restaurant writes in, for example "luxury".',
    )
    country: str | None = Field(
        default=None,
        description='Where the restaurant is, for example "Bosnia and Herzegovina".',
    )
    language: str | None = Field(
        default=None,
        description='Language to write the plan in, for example "German".',
    )
    target_audience: str | None = Field(
        default=None,
        description='Who the restaurant serves, for example "young professionals".',
    )

    _validate_blank = field_validator(
        "cuisine_type",
        "tone_of_voice",
        "country",
        "language",
        "target_audience",
        mode="before",
    )(blank_means_absent)


class StyleAnalysisResponse(BaseModel):
    visual_style_notes: str = Field(
        description=(
            "Cross-cutting visual patterns observed across the reference profiles - lighting, "
            "color palette, crop and composition tendencies - and how to apply them originally."
        )
    )
    content_style_notes: str = Field(
        description=(
            "Cross-cutting content patterns observed across the reference profiles - caption "
            "tone and length, recurring themes - and how to apply them originally."
        )
    )
    content_pillars: list[str] = Field(
        min_length=3,
        max_length=6,
        description=(
            "Original content pillars for this restaurant, inspired by the patterns observed."
        ),
    )
    recommendations: list[str] = Field(
        min_length=3,
        max_length=6,
        description=(
            "Concrete, actionable recommendations for this restaurant's own visual and "
            "content style."
        ),
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "visual_style_notes": (
                        "Every reference profile leans on warm, low-angle lighting and a "
                        "consistent terracotta-and-cream palette across its feed grid, with "
                        "close, cropped shots that fill the frame with the dish. For this "
                        "restaurant's own Neapolitan menu, that suggests warm tungsten-style "
                        "lighting and tight crops on the crust and toppings, in a palette drawn "
                        "from its own wood-fired oven and its own tomato-and-basil colours."
                    ),
                    "content_style_notes": (
                        "Captions across the references are consistently short - one or two "
                        "sentences - and conversational, often ending in a direct question to "
                        "readers. Applied here, that points to short, first-person captions "
                        "that end with a question inviting a comment, in this restaurant's own "
                        "voice."
                    ),
                    "content_pillars": [
                        "Behind the wood-fired oven",
                        "Ingredient close-ups",
                        "Regulars and their orders",
                        "Weekend specials",
                    ],
                    "recommendations": [
                        "Shoot every dish at a low angle with warm, directional lighting.",
                        "Keep captions to one or two sentences ending in a direct question.",
                        "Build a consistent terracotta-and-cream palette across the feed grid.",
                        "Rotate through the four content pillars rather than posting ad hoc.",
                    ],
                }
            ]
        }
    )
