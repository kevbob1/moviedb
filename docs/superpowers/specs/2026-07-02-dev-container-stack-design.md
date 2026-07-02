# Dev Container Stack (drulebot pattern)

Replace the existing `.devcontainer/` VSCode remote-dev setup with a
top-level `Makefile` + `compose.yaml` + single-`Dockerfile`-with-`development`
-stage stack, mirroring the layout used in `../drulebot`.

## Goal

Run the full dev stack (postgres + migrate + Next.js app) via `make dev`
outside of VSCode, with the same ergonomic targets drulebot provides
(`dev-build`, `dev-rebuild`, `dev-down`, `dev-reset`, `dev-exec`,
`dev-logs`, `dev-status`).

## Decisions

| Decision | Choice |
|----------|--------|
| Existing `.devcontainer/` | **Delete.** Lose VSCode one-click remote-dev. |
| Postgres image | `postgres:18.4` |
| Databases | Two: `moviedb_development`, `moviedb_test` (drop `_production`) |
| `DATABASE_URL` host | Edit `.env`: `localhost` → `postgres` |
| Dockerfile | Add `development` stage to existing top-level `Dockerfile`; prod stages untouched |

## Files

### Deleted
- `.devcontainer/Dockerfile.dev`
- `.devcontainer/devcontainer.json`
- `.devcontainer/devcontainer-lock.json`
- `.devcontainer/docker-compose.yml`
- `.devcontainer/init-db.sh`
- `.devcontainer/` (directory itself)

### Modified

#### `Dockerfile`
Prepend a `development` stage reusing the existing `base` stage
(`node:25.9.0-alpine` + `libc6-compat openssl python3 make g++`):

```dockerfile
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

`npm install` runs the `postinstall` script (`prisma generate`); schema is
copied before install so generation succeeds. Generated client lands in
`./src/generated/prisma` (bind-mounted in compose, so also on host).

#### `.env`
Change line 1:
```
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/moviedb_development"
```
(`localhost` → `postgres`.) Breaks running `npm run dev` directly on the host
without a local postgres; acceptable per user decision.

### New

#### `compose.yaml`
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

`POSTGRES_DB` intentionally unset → default DB name = `POSTGRES_USER`
(`moviedb`); `init-db.sh` creates the two named dev/test DBs. `web` keeps an
anonymous `node_modules` volume so the image's installed deps are not
shadowed by a host `node_modules/` and aren't clobbered by `dev-rebuild`.

#### `init-db.sh` (top-level, executable)
```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE moviedb_development;
    CREATE DATABASE moviedb_test;
EOSQL
```

#### `Makefile`
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

#### `.env` additions
Add (for compose postgres service + port override):
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=3000
```

## Caveats

- Host `npm run dev` no longer works without a local postgres (DATABASE_URL
  points at compose service `postgres`). Run via `make dev`.
- `npm run check` / `npm run test:db` on host also affected — they read the
  same `.env`. For host-side test runs, override `DATABASE_URL` or run
  inside the container (`make dev-exec` then `npm run check`).
- `dev-rebuild` re-runs `npm install`; the `node_modules` anonymous volume is
  NOT reset by `--no-cache` alone — run `make dev-reset` (drops `pg-data`
  too) or `docker compose down -v` to refresh node_modules volume when
  needed.
- `.dockerignore` excludes `*.md` and `.env*` from build context; compose
  bind-mounts bypass dockerignore for the mounted paths, so src/prisma/etc.
  are available at runtime. Build context (for `npm install` inside the
  `development` stage) only needs package files + prisma — none ignored.

## Out of scope

- VSCode `.devcontainer/` restoration (deliberately removed).
- Helm/prod Dockerfile changes (prod stages unchanged).
- CI adjustments.
