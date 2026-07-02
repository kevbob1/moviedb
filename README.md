# MovieDB

A Next.js application with PostgreSQL.

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Database**: PostgreSQL 18.4 + Prisma 5
- **Language**: TypeScript

## Prerequisites

- Docker (with `docker compose` v2)

## Development

### Using Make + Compose

This project uses a top-level `Makefile` + `compose.yaml` for a consistent dev environment. The stack runs three services: `web` (Next.js), `postgres`, and `migrate` (one-shot Prisma deploy).

1.  **Start the dev stack**:
    ```bash
    make dev
    ```

2.  **Connect to the app**:
    Once the stack is running, the following services are available:

    | Service   | Port | URL                        |
    |-----------|------|----------------------------|
    | Next.js   | 3000 | http://localhost:3000      |
    | Postgres  | 5432 | postgresql://localhost:5432|

3.  **Environment variables**:
    `DATABASE_URL` in `.env` points at the compose `postgres` service:
    `postgresql://postgres:postgres@postgres:5432/moviedb_development`

### Running Commands in the Container

Any operation that runs Node/TS code, Prisma, or installs dependencies **must** run inside the `web` container. Use `make dev-exec` (stack must be up — `make dev` in another shell):

```bash
make dev-exec npm test                 # run Jest
make dev-exec npm run check            # full validation
make dev-exec npm install <package>    # add a dep
make dev-exec npx prisma migrate dev   # Prisma ops
```

`make dev-exec` with no args drops into an interactive shell inside the web container.

### Stack Management

```bash
make help         # list all targets
make dev          # start stack (web + postgres + migrate)
make dev-down     # stop, keep volumes
make dev-reset    # stop, drop pg-data volume (fresh DB)
make dev-rebuild  # rebuild dev images from scratch
make dev-logs     # tail logs
make dev-status   # show container state
```

### Database Management

Use `make dev-exec` to run Prisma CLI commands inside the container:

```bash
# Apply pending migrations (idempotent)
make dev-exec c='npm run db:migrate'

# Create a new migration (dev)
make dev-exec c='npm run db:migrate:dev -- --name your_migration_name'

# Regenerate Prisma client
make dev-exec c='npm run db:generate-client'

# Open Prisma Studio
make dev-exec c='npm run db:studio'
```

Or open a shell (`make dev-exec`) and run npm scripts directly.
