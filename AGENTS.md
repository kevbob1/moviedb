# Project: MovieDB (Next.js + Postgres)

## Architecture

- 3 tier architecture. (Client UI, API server, Database)
- No third party api calls from the client.  All api calls should flow through the API Server first.
- display of collections of records should be as a list.  no grids unless explicitly requested.


## Validation & Quality Checks

**Always run validation checks before completing any changes.**

### Why validation matters
Running validation checks offlines prevents:
- **Under-the-hood bugs** caught by TypeScript builds
- **Component errors** missed by linter
- **Runtime crashes** from missing React directives
- **Wasted time** fixing issues in production or dev environments

### Commands to run

Validation is authoritative only when run inside the compose `web` container. Start the stack with `make dev` when it is not already running, then run:

**Pre-commit validation (run always before committing):**
```bash
make dev-exec npm run check
```

Do not run `npm test`, `npm run build`, or any other Node/TypeScript validation command directly on the host. Host-side results are not valid validation for this repository and must not be reported as the validation result.

This runs all checks in order:
1. `db:generate-client` - Regenerate Prisma client
2. `lint` - ESLint validation (must have 0 warnings)
3. `test` - Run all tests (must have 0 failures)
4. `typecheck` - TypeScript compilation check
5. `build` - Full Next.js production build

**If any command fails inside the container, fix the issues before committing.** Report the exact `make dev-exec ...` command used and its result.

## Agent skills

### Issue tracker

GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

## Helm Chart Conventions

### Environment Variables

**All environment variables MUST be injected via ConfigMap or Secret, never hardcoded in container specs.**

| Type | Target | Example |
|------|--------|---------|
| Non-secret | `templates/configmap.yaml` | `NODE_ENV`, `JELLYFIN_URL` |
| Secrets | `templates/secret.yaml` (stringData) | `TMDB_API_KEY`, `JELLYFIN_API_KEY` |

**Container specs use `envFrom`:**
```yaml
envFrom:
  - configMapRef:
      name: {{ include "moviedb.fullname" . }}-env
  - secretRef:
      name: {{ include "moviedb.fullname" . }}
```

**Inline `env` is only for values requiring secret interpolation at template time (e.g., DATABASE_URL).**

## Deployment

The repository-root `./deploy.sh` builds and pushes the production image, then upgrades the Helm release. Before deploying, run the authoritative validation command:

```bash
make dev-exec npm run check
```

Run deployment with a timeout of at least 10 minutes because Docker image export and registry push can exceed the default command timeout:

```bash
./deploy.sh
```

A successful deployment must include all of the following in the output:

- Image build and push completed for the reported image tag.
- Helm reports the `moviedb` release as `deployed`.
- The output reports the deployed image tag and Helm revision.

If execution is canceled during Docker image export, rerun `./deploy.sh` with the longer timeout before reporting deployment failure. Report build, push, and Helm results separately when any stage fails.

## CLI & Dependency Conventions

**Never run `npx` or `tsx` in helm-deployed/production environments.** All dependencies must be installed at build time. CLI entrypoints must be defined as `npm run <name>` scripts in `package.json`. No ad-hoc package downloads at runtime.

**Cron jobs and scheduled tasks must be implemented as API routes** (`/api/cron/...`) and invoked via `curl` from Kubernetes CronJobs — not via `npm run` or `node` scripts that require `tsx`. Local dev scripts using `tsx` are acceptable.

## Development Environment

App code, tests, Prisma, and any operation that runs Node/TS or installs dependencies **MUST** run inside the docker compose `web` container. Never run `npm`, `npx`, `node`, `tsc`, `prisma`, `jest`, or `eslint` directly on the host — host Node drifts, host `DATABASE_URL` points at the compose `postgres` service (not a local DB), and the dev image's `node_modules` lives in an anonymous volume (not on host).

The Makefile + `compose.yaml` are the entry point. Never invoke `docker compose` directly for app code — go through `make`.

**Long-running tasks** — start the stack first:

```bash
make dev            # web + postgres + migrate
make dev-exec       # interactive shell into web container (or run a command — see below)
make dev-logs       # tail logs
make dev-down       # stop, keep volumes
make dev-reset      # stop, drop pg-data volume
make dev-rebuild    # rebuild dev images from scratch
```

**One-shot commands** — `make dev-exec <cmd>` runs `<cmd>` inside the web container. Stack must be up.

```bash
make dev-exec npm test                             # Jest
make dev-exec npm run check                        # full validation (lint + test + typecheck + build)
make dev-exec npm install <package>                # add a dep
make dev-exec npx prisma migrate dev -- --name x   # Prisma ops
```

Run `make help` for the full target list. See `README.md` for setup.
