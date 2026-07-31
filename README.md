# AI Restaurant Marketing

Monorepo for the AI Restaurant Marketing SaaS platform: a Next.js web application, a Python
AI service, and the TypeScript packages they share.

The first feature is in place end to end: upload a photo of a dish at `/generate` and the app
returns an Instagram caption with hashtags alongside a colour-corrected version of the photo.
There is still no database schema and no authentication.

## Stack

| Component         | Technology                                                    |
| ----------------- | ------------------------------------------------------------- |
| `apps/web`        | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| `apps/ai-service` | FastAPI on Python 3.12, Pydantic v2                           |
| AI                | Google Gemini (`gemini-3.6-flash`) via the `google-genai` SDK |
| Auth              | Auth.js v5 (`next-auth`), credentials + JWT sessions          |
| Database          | PostgreSQL 17 with Drizzle ORM                                |
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

Two values in `.env` need your attention before the stack will start:

- `AUTH_SECRET` signs session cookies and has no default. Generate one with
  `openssl rand -base64 32`.
- `GEMINI_API_KEY` is free from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) —
  no credit card, and the Flash models used here are on the free tier. Everything else, including
  the health checks, works without it; only caption generation returns 503.

Then apply the database migrations once:

```bash
docker compose exec web pnpm --filter @restaurant-ai/web db:migrate
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

## Accounts and the restaurant profile

Register at `/register`, sign in at `/login`, then fill in `/profile`. Passwords are hashed with
bcrypt at cost 12 and are never stored, logged, or returned; sessions are JWTs signed with
`AUTH_SECRET`, so no session table is needed.

An account owns exactly one restaurant, enforced by a unique constraint on `restaurants.owner_id`.
Only name, address, country, language, cuisine type and tone of voice are required — the rest of
the profile can be filled in whenever.

`/generate`, `/profile` and `/dashboard` are guarded by `src/proxy.ts`, which redirects an
anonymous visitor to `/login`. That is a redirect, not the authorisation: the page and the Server
Action each call `auth()` themselves, and the owner written to the database always comes from the
session rather than from the submitted form.

## Generating a caption

Through the UI, open [localhost:3000/generate](http://localhost:3000/generate) and pick a photo.
You need an account and a saved restaurant profile first — the page says so and links you there
rather than redirecting, because the caption is written in your restaurant's voice and there is
nothing sensible to write without one.

The web app then does two things at once: it asks the AI service for a caption, and it enhances
the photo locally with sharp — auto-orienting it from EXIF, stretching its tonal range, and
lifting saturation, contrast and sharpness, all at the photo's original dimensions. The two are
independent, so if the AI call fails you still get the enhanced image, and vice versa — the page
says which half did not work.

The tone of voice and cuisine type from the profile are sent along with the photo and folded into
the model's system prompt. They are read from the session's profile inside the Server Action, not
taken from the submitted form, for the same reason the profile's owner is.

Against the AI service directly:

```bash
curl -X POST http://localhost:8000/content/generate-caption \
  -F "image=@/path/to/dish.jpg;type=image/jpeg" \
  -F "tone_of_voice=luxury" \
  -F "cuisine_type=Neapolitan pizza"
```

Both context fields are optional there. The service answers the same way it always did without
them, so it stays usable on its own.

```json
{
  "recognized_dish": "Margherita pizza",
  "caption": "Blistered crust, San Marzano tomatoes, and mozzarella that pulls for days.",
  "hashtags": ["margherita", "woodfiredpizza", "eatlocal"]
}
```

JPEG, PNG and WebP are accepted, up to 10 MB. Every failure returns the same
`{"detail": "..."}` body:

| Status | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| 413    | The image is over 10 MB.                                                         |
| 415    | Not a supported image, by declared content type or by actual bytes.              |
| 422    | The `image` field is missing from the request.                                   |
| 502    | Gemini answered with something unusable.                                         |
| 503    | Gemini is rate limiting us, or `GEMINI_API_KEY` is not set. Sends `Retry-After`. |

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
    auth.ts                Auth.js, Node runtime: credentials, bcrypt, database
    auth.config.ts         The edge-safe half, shared with the proxy
    drizzle.config.ts      Migration settings
    src/proxy.ts           Route protection (Next 16's name for middleware)
    src/db/                Drizzle schema, client and migrations
    src/app/               App Router routes, layouts, route handlers
    src/modules/           Feature modules - the bulk of product code lands here
      auth/                Registration and sign-in, password hashing
      content-generation/  Server Action, sharp pipeline, upload rules, types
      restaurant-profile/  Profile repository, validation and Server Actions
    src/components/        Presentational components, grouped by feature
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
| `pnpm test`      | Vitest across the workspace             |

Database migrations, from `apps/web` with `DATABASE_URL` set:

| Command            | Effect                                        |
| ------------------ | --------------------------------------------- |
| `pnpm db:generate` | Write a migration from changes to `schema.ts` |
| `pnpm db:migrate`  | Apply pending migrations                      |
| `pnpm format`      | Prettier write across the repository          |

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

Deliberately deferred: persisting generated captions against a restaurant, password reset, and
email verification. Enhanced images are still written to the OS temp directory and served by a
route handler, which works for one instance and nothing more — real object storage replaces it
next.
