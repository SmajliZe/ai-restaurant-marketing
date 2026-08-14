"""Gemini adapter for reading a photographed menu and drafting consultative
feedback on it.

Thin on purpose, the same as vision_client.py: it owns the request shape, the
response schema, and what to do with the parsed result. The client, the model
name, and the translation of SDK failures into domain errors are shared with
every other Gemini adapter - see ``app.infrastructure.gemini_client``.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from google.genai import types
from pydantic import BaseModel

from app.domain.content_generation.errors import AIRefusalError, AIResponseMalformedError
from app.domain.menu_analysis.prompts import (
    MENU_ANALYSIS_USER_PROMPT,
    build_menu_analysis_system_prompt,
)
from app.infrastructure import gemini_client
from app.infrastructure.gemini_client import call_with_standard_error_handling

# Module-level assignments rather than `import ... as ...`: mypy's strict mode
# does not treat a renaming import as re-exported, which would make
# `menu_analysis_client.MODEL_NAME` and `menu_analysis_client._client`
# invisible to a type checker even though both are valid, monkeypatchable
# module attributes at runtime - and tests rely on patching exactly these two
# names.
MODEL_NAME = gemini_client.MODEL_NAME
_REQUEST_TIMEOUT_SECONDS = gemini_client.REQUEST_TIMEOUT_SECONDS
_client = gemini_client.get_client


# The JSON shape Gemini is constrained to return.
#
# Deliberately not MenuAnalysisResponse: this is the contract with the model
# provider, that one is the contract with our clients, and adding a field to
# our API should never change what we ask the model for.
#
# Documented in comments rather than a docstring on purpose - Pydantic copies
# a docstring into the JSON schema's "description", which would ship these
# notes to the model in every request.
class _GeminiMenuAnalysis(BaseModel):
    overview: str
    pricing_notes: str
    description_quality: str
    upselling_ideas: list[str]
    cross_selling_ideas: list[str]
    missing_items: list[str]
    improvement_suggestions: list[str]


async def analyze_menu(
    image_bytes: bytes,
    *,
    mime_type: str,
    cuisine_type: str | None = None,
    country: str | None = None,
    language: str | None = None,
    target_audience: str | None = None,
) -> Mapping[str, Any]:
    """Ask Gemini to read the photographed menu and draft feedback on it.

    Implements ``app.domain.menu_analysis.ports.MenuAnalyzer``.
    """
    client = _client()
    contents: list[types.PartUnion] = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        MENU_ANALYSIS_USER_PROMPT,
    ]

    response = await call_with_standard_error_handling(
        lambda: client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=build_menu_analysis_system_prompt(
                    cuisine_type,
                    country,
                    language,
                    target_audience,
                ),
                # Constrains decoding to the schema, so the response is parsed
                # rather than scraped out of prose.
                response_mime_type="application/json",
                response_schema=_GeminiMenuAnalysis,
            ),
        ),
        timeout=_REQUEST_TIMEOUT_SECONDS,
    )

    if not response.text:
        # Reached when there is no candidate at all, for example when the
        # response is blocked by a safety filter before any feedback is drafted.
        raise AIRefusalError("The AI service declined to analyze this menu.")

    parsed = response.parsed
    if not isinstance(parsed, _GeminiMenuAnalysis):
        # Text came back, but it was not valid JSON, or it did not match the
        # schema we asked for.
        raise AIResponseMalformedError("The AI service returned an unexpected response.")

    return parsed.model_dump()
