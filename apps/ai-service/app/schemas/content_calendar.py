from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import blank_means_absent


class CalendarRequestContext(BaseModel):
    """What the caller knows about the restaurant, if anything.

    All fields are optional at the API level so the service can be exercised
    on its own - by a test, a script, or a future caller that has no profile.
    The web app always sends all of them, because it refuses to reach this
    endpoint before a profile exists - the same rule content_generation's
    ``ContentRequestContext`` follows, which this mirrors field for field.
    """

    tone_of_voice: str | None = Field(
        default=None,
        description='Voice the plan should adopt, for example "luxury".',
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
        description='Language to write the plan in, for example "German".',
    )
    target_audience: str | None = Field(
        default=None,
        description='Who the plan should speak to, for example "young professionals".',
    )

    _validate_blank = field_validator(
        "tone_of_voice",
        "cuisine_type",
        "country",
        "language",
        "target_audience",
        mode="before",
    )(blank_means_absent)


class CalendarEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0 = Monday, 6 = Sunday.")
    theme: str = Field(description="The day's content theme, a few words.")
    content_angle: str = Field(
        description="One sentence on the specific angle to take that day.",
    )


class CalendarResponse(BaseModel):
    entries: list[CalendarEntry] = Field(
        min_length=7,
        max_length=7,
        description="Exactly seven entries, one for each day Monday through Sunday.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "entries": [
                        {
                            "day_of_week": 0,
                            "theme": "Fresh Week Kickoff",
                            "content_angle": (
                                "Show the dough being stretched this morning - Monday is about "
                                "starting the week with something made from scratch."
                            ),
                        },
                        {
                            "day_of_week": 1,
                            "theme": "Meet the Ingredients",
                            "content_angle": (
                                "Spotlight one signature ingredient, like San Marzano tomatoes, "
                                "and why it makes the difference."
                            ),
                        },
                        {
                            "day_of_week": 2,
                            "theme": "Behind the Oven",
                            "content_angle": (
                                "A quick look at the wood-fired oven mid-service - the heat, "
                                "the char, the rhythm of a busy kitchen."
                            ),
                        },
                        {
                            "day_of_week": 3,
                            "theme": "Regulars' Favourite",
                            "content_angle": (
                                "Feature the dish regulars order most, told from a "
                                "diner's-eye view."
                            ),
                        },
                        {
                            "day_of_week": 4,
                            "theme": "Weekend Is Coming",
                            "content_angle": (
                                "Build anticipation for the weekend rush with a table-booking "
                                "call to action."
                            ),
                        },
                        {
                            "day_of_week": 5,
                            "theme": "Friday Night Energy",
                            "content_angle": (
                                "Capture the room full and lively - the dish that pairs best "
                                "with a night out."
                            ),
                        },
                        {
                            "day_of_week": 6,
                            "theme": "Slow Sunday",
                            "content_angle": (
                                "A calmer, comfort-food angle for a family meal to close "
                                "out the week."
                            ),
                        },
                    ]
                }
            ]
        }
    )
