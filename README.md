# AI Restaurant Marketing

Monorepo for the AI Restaurant Marketing SaaS platform: a Next.js web application, a Python
AI service, and the TypeScript packages they share.

The first feature is in place: upload a photo of a dish and the AI service identifies it and
drafts an Instagram caption with hashtags. There is still no database schema, no authentication
and no web UI for it — the endpoint is consumed directly for now.

## Stack

| Component         | Technology                                                    |
| ----------------- | ------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| `apps/ai-service` | FastAPI on Python 3.12, Pydantic v2                           |
| AI                | Google Gemini (`gemini-3.6-flash`) via the `google-genai` SDK |
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

Caption generation needs a Gemini API key. Create one for free at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) — no credit card, and the Flash
models used here are on the free tier — then set `GEMINI_API_KEY` in `.env`. Everything else,
including the health checks, works without it; only `/content/generate-caption` returns 503.

| Service    | URL                        |
| ---------- | -------------------------- |
| Web        | http://localhost:3000      |
| AI service | http://localhost:8000      |
| API docs   | http://localhost:8000/docs |
| Postgres   | `localhost:5432`           |

Both application containers run in development mode with the source bind-mounted, so edits on
the host reload inside the container. Postgres data survives restarts in the `postgres-data`
named volume; `docker compose down -v` is what wipes it.

## Generating a caption

```bash
curl -X POST http://localhost:8000/content/generate-caption \
  -F "image=@/path/to/dish.jpg;type=image/jpeg"
```

```json
{
  "recognized_dish": "Margherita pizza",
  "caption": "Blistered crust, San Marzano tomatoes, and mozzarella that pulls for days.",
  "hashtags": ["margherita", "woodfiredpizza", "eatlocal"]
}
```

JPEG, PNG and WebP are accepted, up to 10 MB. Every failure returns the same
`{"detail": "..."}` body: 422 when the upload is rejected, 503 when Gemini is rate limiting us
or the key is missing, 502 when Gemini answers with something unusable.

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
    app/api/               HTTP layer: routers, dependencies, error mapping
    app/domain/            Business rules; imports neither FastAPI nor an AI SDK
    app/infrastructure/    Config, databases, third-party clients
    app/schemas/           Pydantic request/response contracts
    tests/                 pytest suite; never calls a real provider
packages/
  shared-types/            Types shared across TypeScript consumers
```

Workspace membership is declared in `pnpm-workspace.yaml`. pnpm ignores the `workspaces` field in
`package.json` (that is npm/Yarn), so the field is deliberately absent rather than duplicated.

Dependency direction is one-way: `apps/*` may depend on `packages/*`, never the reverse, and no
app imports another app — they talk over HTTP. Inside the AI service, `api` and `infrastructure`
depend on `domain`, and `domain` depends on neither. Where the domain needs a capability an
adapter provides, it declares a `Protocol` in `domain/<feature>/ports.py` and the API layer
supplies the implementation — which is also what lets tests pass in a fake.

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
| `pytest`        | Run the test suite        |
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

Deliberately deferred: database schema and migrations, authentication, persisting generated
captions, and the web UI that will call `/content/generate-caption`.
