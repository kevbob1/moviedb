# ADR-0001: Makefile + Compose Dev Stack

## Status

Accepted (2026-07-02). Stack live; this ADR formalizes the decision and supersedes the design spec at `docs/superpowers/specs/2026-07-02-dev-container-stack-design.md`, which is deleted.

## Context

The repo originally used a VSCode `.devcontainer/` setup (custom `Dockerfile.dev`, `docker-compose.yml`, `init-db.sh`, `devcontainer.json`) for remote development. That setup coupled local development to the VSCode editor and hid the stack from the command line.

We also had no canonical entry point for app code that runs Node/TS or installs dependencies. Host-side `npm`, `prisma`, `jest`, `eslint`, `tsc` drifted from the project's Node version; host `DATABASE_URL` pointed at whatever the developer happened to have running locally; dev `node_modules` lived either on host (drift) or in an untracked location.

A sibling project (`drulebot`) had already settled on a clean pattern: top-level `Makefile` + `compose.yaml` + single `Dockerfile` with a `development` stage. Targets (`dev`, `dev-exec`, `dev-logs`, `dev-down`, `dev-reset`, `dev-rebuild`) covered the full lifecycle.

## Decision

- **Dev environment is container-first.** All app code, tests, Prisma, and `node`/`npm` invocations run inside the `web` container. Never on the host. The Makefile is the only entry point.
- **Drop the VSCode `.devcontainer/`** stack entirely. One-click VSCode remote-dev is gone. Editors attach to the running `web` container by other means if needed.
- **Single `Dockerfile`** with multiple stages. Add a `development` stage that reuses the existing `base` stage (`node:25.9.0-alpine` + `libc6-compat openssl python3 make g++`). Production stages untouched.
- **Two databases** in dev: `moviedb_development` and `moviedb_test`. `init-db.sh` creates both; `POSTGRES_DB` is intentionally unset so the default DB name matches `POSTGRES_USER` (`moviedb`).
- **Postgres version is pinned** to `postgres:18.4`.
- **`DATABASE_URL` points at the compose service** (`postgres:5432`). Host-side `npm run dev` no longer works without a local Postgres — by design. Inside the container, `localhost` resolves correctly.
- **`node_modules` is an anonymous compose volume** so the image's installed deps are not shadowed by a host `node_modules/` and aren't clobbered by `dev-rebuild`. `dev-rebuild` (no cache) does not refresh this volume — use `dev-reset` or `docker compose down -v` for that.
- **`.env` carries the compose-side secrets** (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `PORT`). `.dockerignore` excludes `*.md` and `.env*` from build context; compose bind-mounts bypass dockerignore for mounted paths.

## Consequences

- `make dev` is the only correct way to start the stack. `make dev-exec <cmd>` is the only correct way to run app code, tests, or Prisma operations.
- Host-side `npm run check` / `npm run test:db` need an override `DATABASE_URL` or a local Postgres, or they must run inside the container. Documented in AGENTS.md.
- The Helm chart and production Dockerfile are unchanged. Env injection rules (ConfigMap/Secret via `envFrom`) still apply.
- Cron jobs and scheduled tasks must be API routes, not host scripts — same constraint as the existing AGENTS.md rule, reinforced by the container-first model.
- VSCode users lose one-click remote-dev. They can still develop by attaching to the running `web` container (e.g. Dev Containers "Attach to Running Container") but it's not the polished single-click experience.

## Alternatives considered

- **Keep `.devcontainer/` for VSCode, add Makefile as a second path.** Rejected: two entry points means two sources of truth and drift.
- **Use Docker Compose profiles instead of Makefile targets.** Rejected: profiles cover service selection, not lifecycle ergonomics (logs, exec, reset). The Makefile wrapper adds little and earns its keep.
- **Use a single `postgres` database for dev and test.** Rejected: tests would need to truncate or use transactions everywhere. Two named databases keep tests honest.
- **Volume-mount `node_modules` from host.** Rejected: the dev image's `node_modules` is built against the image's OS, not the host. Anonymous volume is the only correct option.
