# Dev Container Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `.devcontainer/` with a top-level `Makefile` + `compose.yaml` + `development` Dockerfile stage mirroring `../drulebot`, runnable via `make dev`.

**Architecture:** Single `Dockerfile` gains a `development` stage (reusing `base`). `compose.yaml` defines three services — `postgres`, `migrate` (one-shot `prisma migrate deploy`), `web` (`next dev`) — with bind-mounted source and an anonymous `node_modules` volume. `Makefile` wraps `docker compose` with ergonomic targets. `.env` is the single config source.

**Tech Stack:** Docker, docker compose v2, postgres 18.4, Next.js, Prisma, Make.

**Spec:** `docs/superpowers/specs/2026-07-02-dev-container-stack-design.md`

---

### Task 1: Add `development` stage to `Dockerfile`

**Files:**
- Modify: `Dockerfile` (insert new stage between the `base` definition and the `deps` stage)

- [ ] **Step 1: Read current `Dockerfile` to confirm the `base` stage and insertion point**

Run: `cat Dockerfile`
Expected: first non-comment lines define `FROM node:25.9.0-alpine AS base` followed by `RUN apk add ...`.

- [ ] **Step 2: Insert the `development` stage**

Insert immediately after the `base` stage's `RUN apk add ...` line (before the `# Stage 1 – Install dependencies` comment / `FROM base AS deps`):

```dockerfile
# ---------------------------------------------------------------------------
# Stage – development (used by docker compose; shares base with prod build)
# ---------------------------------------------------------------------------
FROM base AS development
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY package.json package-lock.json ./
RUN npm install
ENV NODE_ENV=development
ENV PATH=/app/node_modules/.bin:$PATH
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

- [ ] **Step 3: Verify the stage is selectable**

Run: `docker build --target development -t moviedb-dev:check .`
Expected: build succeeds; `npm install` runs and `prisma generate` (postinstall) completes without error.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "build: add development stage to Dockerfile for compose dev stack"
```

---

### Task 2: Update `.env`

**Files:**
- Modify: `.env` (line 1 + append three vars)

- [ ] **Step 1: Edit DATABASE_URL host**

Change line 1 from:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moviedb_development"
```
to:
```
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/moviedb_development"
```

- [ ] **Step 2: Append compose vars**

Append to end of `.env`:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=3000
```

- [ ] **Step 3: Verify**

Run: `grep -E '^(DATABASE_URL|POSTGRES_USER|POSTGRES_PASSWORD|PORT)=' .env`
Expected output includes the four lines with `postgres` host and the three appended vars.

- [ ] **Step 4: Commit**

```bash
git add .env
git commit -m "config: point DATABASE_URL at compose postgres host; add POSTGRES_* and PORT"
```

Note: `.env` is typically gitignored. If `git diff --cached .env` shows nothing because it's ignored, skip the commit and instead ensure `.env.example` is updated (see Task 6). Check with `git check-ignore .env`.

---

### Task 3: Create top-level `init-db.sh`

**Files:**
- Create: `init-db.sh`

- [ ] **Step 1: Write the file**

Create `init-db.sh`:
```bash
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE moviedb_development;
    CREATE DATABASE moviedb_test;
EOSQL
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x init-db.sh`
Expected: `ls -l init-db.sh` shows `-rwxrwxr-x` (or similar with `x`).

- [ ] **Step 3: Verify syntax**

Run: `bash -n init-db.sh`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add init-db.sh
git commit -m "build: add init-db.sh creating dev and test databases"
```

---

### Task 4: Create `compose.yaml`

**Files:**
- Create: `compose.yaml`

- [ ] **Step 1: Write the file**

Create `compose.yaml`:
```yaml
services:
  postgres:
    image: postgres:18.4
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh:ro
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 2s
      timeout: 2s
      retries: 20
      start_period: 5s

  migrate:
    build:
      context: .
      target: development
    command: ["npx", "prisma", "migrate", "deploy"]
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./src:/app/src:rw
      - ./prisma:/app/prisma:rw
      - ./package.json:/app/package.json:ro
      - ./package-lock.json:/app/package-lock.json:ro
      - ./tsconfig.json:/app/tsconfig.json:ro
      - ./prisma.config.ts:/app/prisma.config.ts:ro
    restart: "no"

  web:
    build:
      context: .
      target: development
    command: ["npm", "run", "dev"]
    env_file: .env
    ports:
      - "127.0.0.1:${PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    volumes:
      - ./src:/app/src:rw
      - ./prisma:/app/prisma:rw
      - ./public:/app/public:ro
      - ./package.json:/app/package.json:ro
      - ./package-lock.json:/app/package-lock.json:ro
      - ./tsconfig.json:/app/tsconfig.json:ro
      - ./prisma.config.ts:/app/prisma.config.ts:ro
      - ./next.config.ts:/app/next.config.ts:ro
      - ./postcss.config.mjs:/app/postcss.config.mjs:ro
      - node_modules:/app/node_modules
    restart: unless-stopped

volumes:
  pg-data:
  node_modules:
```

- [ ] **Step 2: Validate syntax**

Run: `docker compose config -q`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add compose.yaml
git commit -m "build: add compose.yaml with postgres, migrate, web services"
```

---

### Task 5: Create `Makefile`

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write the file**

Create `Makefile` (indent with TAB characters, not spaces):
```makefile
.PHONY: help dev dev-build dev-rebuild dev-down dev-reset dev-exec dev-logs dev-status

.DEFAULT_GOAL := help

help:        ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "; printf "Targets:\n"} {printf "  %-15s %s\n", $$1, $$2}'

dev:         ## Start dev stack (web + postgres)
	docker compose up

dev-build:   ## Build dev images (cached layers)
	docker compose build

dev-rebuild: ## Rebuild dev images from scratch (fresh npm install)
	docker compose build --no-cache

dev-down:    ## Stop stack, keep volumes
	docker compose down

dev-reset:   ## Stop stack, drop pg-data volume (fresh DB)
	docker compose down -v

dev-exec:    ## Exec interactive shell into web container
	docker compose exec web bash

dev-logs:    ## Tail logs
	docker compose logs -f

dev-status:  ## Show dev container state
	docker compose ps
```

- [ ] **Step 2: Verify**

Run: `make help`
Expected: prints `Targets:` followed by each target name and its `##` description.

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "build: add Makefile wrapping docker compose dev commands"
```

---

### Task 6: Delete `.devcontainer/`

**Files:**
- Delete: `.devcontainer/` (entire directory)

- [ ] **Step 1: Remove the directory**

Run: `git rm -r .devcontainer`
Expected: lists the four removed files (`Dockerfile.dev`, `devcontainer.json`, `devcontainer-lock.json`, `docker-compose.yml`, `init-db.sh`).

- [ ] **Step 2: Commit**

```bash
git commit -m "build: remove .devcontainer VSCode remote-dev setup (replaced by top-level compose)"
```

---

### Task 7: End-to-end verification

**Files:** none

- [ ] **Step 1: Build dev images**

Run: `make dev-build`
Expected: `development` stage builds for both `migrate` and `web`; `npm install` + `prisma generate` complete; exit 0.

- [ ] **Step 2: Start the stack**

Run: `make dev`
Expected in logs: postgres becomes healthy, `migrate` runs `prisma migrate deploy` and exits 0, `web` starts `next dev` and prints `Ready - started server on 0.0.0.0:3000`.

- [ ] **Step 3: Confirm the app responds**

From another shell: `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/`
Expected: an HTTP status code (200 or a redirect 3xx), not `000` (connection refused).

- [ ] **Step 4: Confirm databases exist**

Run: `docker compose exec postgres psql -U postgres -lqt | grep moviedb`
Expected: lines for `moviedb`, `moviedb_development`, `moviedb_test`.

- [ ] **Step 5: Confirm migrations applied**

Run: `docker compose exec postgres psql -U postgres -d moviedb_development -c '\dt _prisma_migrations'`
Expected: table exists (Prisma migrations table).

- [ ] **Step 6: Confirm `make dev-exec` works**

Run: `make dev-exec` then inside run `node -e "console.log(process.env.DATABASE_URL)"` and `exit`.
Expected: DATABASE_URL printed with host `postgres`.

- [ ] **Step 7: Tear down (keep volumes)**

Run: `make dev-down`
Expected: containers removed, `pg-data` and `node_modules` volumes retained.

- [ ] **Step 8: Sanity-run the project validation suite inside the container**

Run: `make dev` (start), then `make dev-exec` and inside run:
```bash
npm run check
```
Expected: `db:generate-client`, `lint`, `test`, `typecheck`, `build` all pass.
If `test` fails because the test DB connection string still references `localhost` or a different DB, inspect `jest.config.ts` / `package.json` `test:db` script and confirm the test DB URL resolves to `postgres:5432/moviedb_test` inside the container. Adjust the env/script if needed and commit the fix.

Then `exit` and `make dev-down`.

---

## Self-Review Notes

- Spec coverage: development stage (Task 1), .env edit (Task 2), init-db.sh (Task 3), compose.yaml (Task 4), Makefile (Task 5), .devcontainer deletion (Task 6), e2e verification incl. postgres image 18.4, 2 DBs, DATABASE_URL host=postgres (Task 7). All spec sections covered.
- Placeholder scan: none — all steps contain exact code/commands.
- Type consistency: service names `postgres`/`migrate`/`web` used consistently across compose.yaml, Makefile (`dev-exec` → `web`), and verification steps.
- The `npm run check` inside-container step (7.8) may surface a test-DB connection mismatch not anticipated by the spec; flagged inline with a remediation path rather than left vague.
