from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


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
