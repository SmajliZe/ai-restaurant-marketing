"""Application entrypoint: ``uvicorn app.main:app``."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.infrastructure.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the ASGI application.

    Written as a factory so tests can construct an app with overridden
    settings instead of mutating global state.
    """
    settings = settings or get_settings()

    app = FastAPI(
        title="AI Restaurant Marketing - AI Service",
        version="0.0.0",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )

    if settings.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_allow_origins),
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(api_router)
    return app


app = create_app()
