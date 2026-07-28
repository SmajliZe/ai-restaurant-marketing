"""Liveness endpoint used by docker-compose and future orchestrators.

Deliberately does not touch the database: it answers "is this process up",
not "is the whole system healthy".
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.infrastructure.config import Settings, get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def read_health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        environment=settings.environment,
    )
