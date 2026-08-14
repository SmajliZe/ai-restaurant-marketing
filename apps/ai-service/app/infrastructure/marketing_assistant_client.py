"""Gemini adapter for continuing a marketing-advice conversation.

Unlike every other adapter in this service, this one sends a real multi-turn
message list rather than a single-shot prompt (plus an image, for
vision_client.py and menu_analysis_client.py) and gets free text back rather
than a JSON object constrained by ``response_schema``. A chat reply has no
rigid shape to validate - it is either a usable reply or it is not - so a
schema would only add a wrapper object with nothing left to check once the
service's own "is this empty" rule is applied; plain text generation is the
right tool here. The client, the model name, and the translation of SDK
failures into domain errors are still shared with every other Gemini
adapter - see ``app.infrastructure.gemini_client``.
"""

from __future__ import annotations

from typing import Final, cast

from google.genai import types

from app.domain.content_generation.errors import AIRefusalError
from app.domain.marketing_assistant.prompts import build_assistant_system_prompt
from app.infrastructure import gemini_client
from app.infrastructure.gemini_client import call_with_standard_error_handling
from app.schemas.marketing_assistant import ChatMessage

# Module-level assignments rather than `import ... as ...`: mypy's strict mode
# does not treat a renaming import as re-exported, which would make
# `marketing_assistant_client.MODEL_NAME` and `marketing_assistant_client._client`
# invisible to a type checker even though both are valid, monkeypatchable
# module attributes at runtime - and tests rely on patching exactly these two
# names.
MODEL_NAME = gemini_client.MODEL_NAME
_REQUEST_TIMEOUT_SECONDS = gemini_client.REQUEST_TIMEOUT_SECONDS
_client = gemini_client.get_client

# Gemini's multi-turn roles are "user" and "model" - "model" is what our own
# domain calls "assistant", so every prior assistant turn is translated on
# the way into the request.
_GEMINI_ROLE_BY_MESSAGE_ROLE: Final[dict[str, str]] = {"user": "user", "assistant": "model"}


async def chat(
    messages: list[ChatMessage],
    *,
    tone_of_voice: str | None = None,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
    activity_summary: str | None = None,
) -> str:
    """Ask Gemini to continue the conversation in ``messages``.

    Implements ``app.domain.marketing_assistant.ports.MarketingAssistant``.
    """
    client = _client()
    contents = [
        types.Content(
            role=_GEMINI_ROLE_BY_MESSAGE_ROLE[message.role],
            parts=[types.Part.from_text(text=message.content)],
        )
        for message in messages
    ]

    response = await call_with_standard_error_handling(
        lambda: client.aio.models.generate_content(
            model=MODEL_NAME,
            # mypy infers `list[Content]` here, and the SDK's ContentListUnion
            # alias is invariant in a way that does not accept it even though
            # every element is a valid member - a plain list of Content is
            # exactly what multi-turn chat is documented to take.
            contents=cast("types.ContentListUnion", contents),
            config=types.GenerateContentConfig(
                system_instruction=build_assistant_system_prompt(
                    tone_of_voice,
                    cuisine_type,
                    country,
                    language,
                    target_audience,
                    activity_summary,
                ),
            ),
        ),
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.text:
        # Reached when there is no candidate at all, for example when the
        # response is blocked by a safety filter before any reply is drafted.
        raise AIRefusalError("The AI service declined to reply.")

    return response.text
