"""Runtime configuration.

The only module that reads ``os.environ``; everything else receives a
``Settings`` instance so it stays trivially testable.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Final

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, field_validator

load_dotenv()


class Settings(BaseModel):
    """Validated view of the process environment.

    Field defaults are the only place a fallback value is written down.
    """

    model_config = ConfigDict(frozen=True)

    app_name: str = "ai-service"
    environment: str = "development"
    log_level: str = "INFO"

    # Optional on purpose: the service must still start without them so the
    # container boots for health checks even when an integration is unconfigured.
    database_url: str | None = None
    gemini_api_key: str | None = None

    cors_allow_origins: tuple[str, ...] = ()

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_comma_separated(cls, value: object) -> object:
        if isinstance(value, str):
            return tuple(origin.strip() for origin in value.split(",") if origin.strip())
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


_ENV_VAR_BY_FIELD: Final[dict[str, str]] = {
    "app_name": "APP_NAME",
    "environment": "APP_ENV",
    "log_level": "LOG_LEVEL",
    "database_url": "DATABASE_URL",
    "gemini_api_key": "GEMINI_API_KEY",
    "cors_allow_origins": "CORS_ALLOW_ORIGINS",
}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # An empty variable is treated as unset: compose passes through blank values
    # for anything the developer left out of their .env.
    provided = {
        field: os.environ[name] for field, name in _ENV_VAR_BY_FIELD.items() if os.environ.get(name)
    }
    return Settings.model_validate(provided)
