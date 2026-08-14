from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import blank_means_absent


class MenuAnalysisRequestContext(BaseModel):
    """What the caller knows about the restaurant, if anything.

    No ``tone_of_voice``, unlike every other request-context model in this
    service: menu analysis is consultative feedback, not brand-voiced
    marketing copy, so the restaurant's chosen tone should not shape it.
    """

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
        description='Language to write the feedback in, for example "German".',
    )
    target_audience: str | None = Field(
        default=None,
        description='Who the restaurant serves, for example "young professionals".',
    )

    _validate_blank = field_validator(
        "cuisine_type",
        "country",
        "language",
        "target_audience",
        mode="before",
    )(blank_means_absent)


class MenuAnalysisResponse(BaseModel):
    overview: str = Field(description="A short, plain-language summary of the menu as a whole.")
    pricing_notes: str = Field(
        description=(
            "Observations about how the menu is priced, grounded in the prices actually shown."
        )
    )
    description_quality: str = Field(
        description=(
            "How well the menu's item descriptions sell the food, grounded in "
            "the descriptions actually shown."
        )
    )
    upselling_ideas: list[str] = Field(
        min_length=3,
        max_length=6,
        description="Concrete ways to upsell, built from items already on the menu.",
    )
    cross_selling_ideas: list[str] = Field(
        min_length=3,
        max_length=6,
        description="Concrete pairings to suggest, built from items already on the menu.",
    )
    missing_items: list[str] = Field(
        min_length=0,
        max_length=5,
        description="Notable gaps in the menu. Empty when nothing stands out.",
    )
    improvement_suggestions: list[str] = Field(
        min_length=3,
        max_length=6,
        description="Concrete, actionable suggestions for improving the menu itself.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "overview": (
                        "A single-page Italian dinner menu, organised into starters, "
                        "pizzas, pastas, and desserts. Clean layout, but pricing is "
                        "inconsistent across similarly-sized dishes."
                    ),
                    "pricing_notes": (
                        "Pizzas range from 9 to 14 EUR with no clear pattern by "
                        "ingredient cost - the Margherita and the Quattro Formaggi "
                        "are priced the same despite very different ingredient lists."
                    ),
                    "description_quality": (
                        "Starter and pizza descriptions are appetising and specific "
                        '("San Marzano tomatoes, buffalo mozzarella"), but the '
                        "dessert section is just a list of names with no description."
                    ),
                    "upselling_ideas": [
                        "Offer the Quattro Formaggi as a suggested upgrade wherever "
                        "the Margherita appears.",
                        'Add a "add burrata for 3 EUR" note under the pasta section.',
                        "Suggest the larger 32cm pizza size next to the standard size.",
                    ],
                    "cross_selling_ideas": [
                        "Pair the Bruschetta starter with the house Chianti by the "
                        "glass on the same line.",
                        "Suggest the Tiramisu alongside the espresso listed in drinks.",
                        "Pair the Quattro Formaggi with the honey drizzle add-on.",
                    ],
                    "missing_items": [
                        "No non-alcoholic drink options are listed anywhere on the menu.",
                    ],
                    "improvement_suggestions": [
                        "Add short descriptions to the dessert section to match the "
                        "rest of the menu.",
                        "Re-price the pizzas so cost differences between toppings are reflected.",
                        "Group the two pasta sub-sections under one clearer heading.",
                    ],
                }
            ]
        }
    )
