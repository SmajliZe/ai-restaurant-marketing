# AI Restaurant Marketing

Monorepo for the AI Restaurant Marketing SaaS platform: a Next.js web application, a Python
AI service, and the TypeScript packages they share.

This repository is currently a **scaffold**. The structure, tooling and container setup are in
place; no product features, database models, authentication or business endpoints exist yet.

## Stack

| Component         | Technology                                                    |
| ----------------- | ------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| `apps/ai-service` | FastAPI on Python 3.12, Pydantic v2                           |
| Database          | PostgreSQL 17                                                 |
| Workspace         | pnpm workspaces                                               |
| Local runtime     | Docker Compose                                                |

## Requirements

- Docker with the Compose plugin (the only requirement for `docker compose up`)
- Node.js 22.12+ and pnpm 10+ — for running the web app outside Docker
- Python 3.12 — for running the AI service outside Docker

## Quick start

```bash
cp .env.example .env    # then edit the values; the stack refuses to start without them
docker compose up --build
```

| Service    | URL                        |
| ---------- | -------------------------- |
| Web        | http://localhost:3000      |
| AI service | http://localhost:8000      |
| API docs   | http://localhost:8000/docs |
| Postgres   | `localhost:5432`           |

Both application containers run in development mode with the source bind-mounted, so edits on
the host reload inside the container. Postgres data survives restarts in the `postgres-data`
named volume; `docker compose down -v` is what wipes it.

## Running without Docker

```bash
# Web
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @restaurant-ai/web dev

# AI service
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Repository layout

```
apps/
  web/                     Next.js application
    src/app/               App Router routes, layouts, route handlers
    src/modules/           Feature modules - the bulk of product code lands here
    src/components/        Cross-feature presentational components
    src/lib/               Framework-agnostic helpers and clients
    src/types/             App-local types (shared ones go in packages/shared-types)
  ai-service/              FastAPI service
    app/api/               HTTP layer: routers and request wiring
    app/domain/            Business rules; imports neither FastAPI nor a driver
    app/infrastructure/    Config, databases, third-party clients
    app/schemas/           Pydantic request/response contracts
packages/
  shared-types/            Types shared across TypeScript consumers
```

Workspace membership is declared in `pnpm-workspace.yaml`. pnpm ignores the `workspaces` field in
`package.json` (that is npm/Yarn), so the field is deliberately absent rather than duplicated.

Dependency direction is one-way: `apps/*` may depend on `packages/*`, never the reverse, and no
app imports another app — they talk over HTTP. Inside the AI service, `api` and `infrastructure`
depend on `domain`, and `domain` depends on neither.

`src/modules` is intentionally empty. A feature module owns its own components, server actions and
types, and only what is genuinely cross-cutting is promoted to `src/components` or `src/lib`.

## Configuration

Secrets are never committed. Three templates exist, each with a distinct owner:

| File                           | Used by                                           |
| ------------------------------ | ------------------------------------------------- |
| `.env.example`                 | Docker Compose (Postgres credentials, host ports) |
| `apps/web/.env.example`        | The web app when run outside Docker               |
| `apps/ai-service/.env.example` | The AI service when run outside Docker            |

Under Compose the app-level files are not read: Compose derives each service's environment from
the root `.env`, so connection strings stay consistent across the stack.

## Common commands

Run from the repository root:

| Command          | Effect                                  |
| ---------------- | --------------------------------------- |
| `pnpm dev`       | Start every workspace app in dev mode   |
| `pnpm build`     | Production build of every workspace app |
| `pnpm lint`      | ESLint, warnings treated as failures    |
| `pnpm typecheck` | `tsc --noEmit` across the workspace     |
| `pnpm format`    | Prettier write across the repository    |

In `apps/ai-service` (with the virtualenv active):

| Command         | Effect                    |
| --------------- | ------------------------- |
| `ruff check .`  | Lint                      |
| `ruff format .` | Format                    |
| `mypy`          | Type check in strict mode |

## Conventions

- Files and folders are kebab-case, except where a framework dictates otherwise (Next.js
  `layout.tsx`/`page.tsx`) or the language does (Python modules are snake_case per PEP 8).
- TypeScript runs in strict mode with `noUncheckedIndexedAccess` and unused-symbol checks;
  `tsconfig.base.json` holds the shared settings and each package extends it.
- Python runs under `mypy --strict`; Ruff enforces absolute imports so that layering violations
  are visible in review.
- Docker images are multi-stage. The web `runner` stage serves Next's standalone output and the
  AI service `runtime` stage carries only a prebuilt virtualenv — neither contains build tooling,
  and both run as a non-root user.

## Next steps

Not part of this scaffold and deliberately deferred: database schema and migrations,
authentication, and the marketing/AI endpoints themselves.
