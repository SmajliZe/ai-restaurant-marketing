"""Runtime configuration.

The only module that reads ``os.environ``; everything else receives a
``Settings`` instance so it stays trivially testable.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict

load_dotenv()


class Settings(BaseModel):
    """Validated view of the process environment."""

    model_config = ConfigDict(frozen=True)

    app_name: str = "ai-service"
    environment: str = "development"
    log_level: str = "INFO"

    # Absent in the scaffold: the service must still start without them so the
    # container can be booted before any integration exists.
    database_url: str | None = None
    openai_api_key: str | None = None

    cors_allow_origins: tuple[str, ...] = ()

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "ai-service"),
        environment=os.getenv("APP_ENV", "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        database_url=os.getenv("DATABASE_URL") or None,
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        cors_allow_origins=_parse_origins(os.getenv("CORS_ALLOW_ORIGINS", "")),
    )


def _parse_origins(raw: str) -> tuple[str, ...]:
    return tuple(origin.strip() for origin in raw.split(",") if origin.strip())
