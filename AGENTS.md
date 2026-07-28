# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm monorepo (`apps/web`, `apps/ai-service`, `packages/shared-types`) for the
AI Restaurant Marketing scaffold. See `README.md` for the full setup/run reference; the notes
below only capture what is non-obvious in the Cloud VM.

### Environment (already provisioned by the startup update script)

- Node deps: `pnpm install --frozen-lockfile` (run from repo root).
- AI service deps: a Python venv lives at `apps/ai-service/.venv`; deps come from
  `apps/ai-service/requirements-dev.txt`. `python3.12-venv` (a system package) is baked into the
  VM snapshot — it is NOT installed by the update script, so do not assume `python3.12 -m venv`
  works on a fresh box without it.
- Env files are gitignored and must be recreated when missing (the update script does not create
  them, and they are needed to run outside Docker):
  - `cp apps/web/.env.example apps/web/.env.local`
  - `cp apps/ai-service/.env.example apps/ai-service/.env`

### Running services (run natively, not Docker)

Docker is NOT available in this VM, so ignore the `docker compose up` path from the README. Run
the two services directly instead:

- AI service (FastAPI, port 8000): from `apps/ai-service`, run
  `.venv/bin/uvicorn app.main:app --reload --port 8000`. Health at `/health`, interactive API
  docs at `/docs` (dev only).
- Web (Next.js, port 3000): from repo root, run `pnpm --filter @restaurant-ai/web dev`.
  `pnpm dev` also works but currently only starts the web app (ai-service has no pnpm script).

Postgres is declared in `docker-compose.yml` and env files but nothing in code connects to it yet,
so it is not required to run or test the current scaffold.

### Lint / typecheck

- TypeScript workspace: `pnpm lint` (ESLint, warnings fail) and `pnpm typecheck` from repo root.
- AI service (venv active or via `.venv/bin/`): `ruff check .` and `mypy` from `apps/ai-service`.
