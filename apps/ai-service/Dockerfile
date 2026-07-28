# syntax=docker/dockerfile:1

# Build context is apps/ai-service.

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH
WORKDIR /app

# Dependencies are resolved once into a venv that later stages copy verbatim,
# which keeps build toolchains out of the runtime image.
FROM base AS builder
RUN python -m venv "$VIRTUAL_ENV"
COPY requirements.txt ./
RUN pip install --requirement requirements.txt

FROM base AS dev
COPY --from=builder /opt/venv /opt/venv
COPY requirements.txt requirements-dev.txt ./
RUN pip install --requirement requirements-dev.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS runtime
RUN groupadd --system --gid 1001 appuser \
    && useradd --system --uid 1001 --gid appuser appuser
COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appuser app ./app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
