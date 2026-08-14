"""Single place where feature routers are mounted onto the application."""

from __future__ import annotations

from fastapi import APIRouter

from app.api import calendar, campaign, content, health, menu_analysis

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(content.router)
api_router.include_router(calendar.router)
api_router.include_router(campaign.router)
api_router.include_router(menu_analysis.router)
