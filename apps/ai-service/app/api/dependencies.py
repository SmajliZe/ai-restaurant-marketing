"""Wiring between the HTTP layer and the adapters it drives.

Keeping the choice of provider behind a dependency is what lets tests swap in a
fake through ``app.dependency_overrides`` instead of patching module globals.
"""

from __future__ import annotations

from app.domain.content_generation.ports import CaptionGenerator
from app.infrastructure import vision_client


def get_caption_generator() -> CaptionGenerator:
    return vision_client.generate_caption
