"""Gemini adapter for reading reference Instagram profile screenshots and
drafting an original design and content plan from them.

Thin on purpose, the same as vision_client.py and menu_analysis_client.py:
it owns the request shape, the response schema, and what to do with the
parsed result. Unlike either of those, this one sends multiple images
grouped into up to three labelled profiles rather than a single image, so
the model can reason about what recurs across profiles rather than treating
every screenshot as one undifferentiated pile - see
``app.domain.style_analysis.ports.ReferenceProfileImages``. The client, the
model name, and the translation of SDK failures into domain errors are
still shared with every other Gemini adapter - see
``app.infrastructure.gemini_client``.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from google.genai import types
from pydantic import BaseModel

from app.domain.content_generation.errors import AIRefusalError, AIResponseMalformedError
from app.domain.style_analysis.ports import ReferenceProfileImages
from app.domain.style_analysis.prompts import (
    STYLE_ANALYSIS_USER_PROMPT,
    build_style_analysis_system_prompt,
)
from app.infrastructure import gemini_client
from app.infrastructure.gemini_client import call_with_standard_error_handling

# Module-level assignments rather than `import ... as ...`: mypy's strict mode
# does not treat a renaming import as re-exported, which would make
# `style_analysis_client.MODEL_NAME` and `style_analysis_client._client`
# invisible to a type checker even though both are valid, monkeypatchable
# module attributes at runtime - and tests rely on patching exactly these two
# names.
MODEL_NAME = gemini_client.MODEL_NAME
_REQUEST_TIMEOUT_SECONDS = gemini_client.REQUEST_TIMEOUT_SECONDS
_client = gemini_client.get_client


# The JSON shape Gemini is constrained to return.
#
# Deliberately not StyleAnalysisResponse: this is the contract with the model
# provider, that one is the contract with our clients, and adding a field to
# our API should never change what we ask the model for.
#
# Documented in comments rather than a docstring on purpose - Pydantic copies
# a docstring into the JSON schema's "description", which would ship these
# notes to the model in every request.
class _GeminiStyleAnalysis(BaseModel):
    visual_style_notes: str
    content_style_notes: str
    content_pillars: list[str]
    recommendations: list[str]


async def analyze_style(
    profiles: list[ReferenceProfileImages],
    *,
    cuisine_type: str | None = None,
    tone_of_voice: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> Mapping[str, Any]:
    """Ask Gemini to find cross-cutting patterns in the reference profiles
    and draft an original plan from them.

    Implements ``app.domain.style_analysis.ports.StyleAnalyzer``.
    """
    client = _client()
    contents: list[types.PartUnion] = [STYLE_ANALYSIS_USER_PROMPT]
    for index, profile in enumerate(profiles, start=1):
        if profile.feed is not None:
            contents.append(f"Reference profile {index} - feed overview:")
            contents.append(
                types.Part.from_bytes(data=profile.feed.data, mime_type=profile.feed.mime_type)
            )
        if profile.posts:
            contents.append(f"Reference profile {index} - individual posts:")
            for post in profile.posts:
                contents.append(types.Part.from_bytes(data=post.data, mime_type=post.mime_type))

    response = await call_with_standard_error_handling(
        lambda: client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=build_style_analysis_system_prompt(
                    cuisine_type,
                    tone_of_voice,
                    country,
                    language,
                    target_audience,
                ),
                # Constrains decoding to the schema, so the response is parsed
                # rather than scraped out of prose.
                response_mime_type="application/json",
                response_schema=_GeminiStyleAnalysis,
            ),
        ),
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.text:
        # Reached when there is no candidate at all, for example when the
        # response is blocked by a safety filter before any plan is drafted.
        raise AIRefusalError("The AI service declined to analyze these reference profiles.")

    parsed = response.parsed
    if not isinstance(parsed, _GeminiStyleAnalysis):
        # Text came back, but it was not valid JSON, or it did not match the
        # schema we asked for.
        raise AIResponseMalformedError("The AI service returned an unexpected response.")

    return parsed.model_dump()
