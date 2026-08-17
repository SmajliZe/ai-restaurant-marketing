"""Wiring between the HTTP layer and the adapters it drives.

Keeping the choice of provider behind a dependency is what lets tests swap in a
fake through ``app.dependency_overrides`` instead of patching module globals.
"""

from __future__ import annotations

from app.domain.content_calendar.ports import CalendarGenerator
from app.domain.content_campaign.ports import CampaignGenerator
from app.domain.content_generation.ports import CaptionGenerator
from app.domain.marketing_assistant.ports import MarketingAssistant
from app.domain.menu_analysis.ports import MenuAnalyzer
from app.domain.style_analysis.ports import StyleAnalyzer
from app.infrastructure import (
    calendar_client,
    campaign_client,
    marketing_assistant_client,
    menu_analysis_client,
    style_analysis_client,
    vision_client,
)


def get_caption_generator() -> CaptionGenerator:
    return vision_client.generate_content


def get_calendar_generator() -> CalendarGenerator:
    return calendar_client.generate_weekly_calendar


def get_campaign_generator() -> CampaignGenerator:
    return campaign_client.generate_campaign


def get_menu_analyzer() -> MenuAnalyzer:
    return menu_analysis_client.analyze_menu


def get_marketing_assistant() -> MarketingAssistant:
    return marketing_assistant_client.chat


def get_style_analyzer() -> StyleAnalyzer:
    return style_analysis_client.analyze_style
