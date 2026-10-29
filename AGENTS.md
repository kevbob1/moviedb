# Project: MovieDB (Next.js + Postgres)

## Architecture

- 3 tier architecture. (Client UI, API server, Database)
- No third party api calls from the client.  All api calls should flow through the API Server first.
- display of collections of records should be as a list.  no grids unless explicitly requested.


## Validation & Quality Checks

**Run validation before completing any change to app code or dependencies.** (Tree byte-identical to the last green run counts as validated — cite that log instead of re-running.)

### Why validation matters
Running validation checks prevents:
- **Under-the-hood bugs** caught by TypeScript builds
- **Component errors** missed by linter
- **Runtime crashes** from missing React directives
- **Wasted time** fixing issues in production or dev environments

### Commands to run

Validation is authoritative only inside the compose `web` container. `docker compose ps` (read-only) tells you if the stack is up; start it with `make dev` when needed, then run:

**Pre-commit validation:**
```bash
make dev-exec npm run check
```

Report only container results. Host-side `npm`, `npx`, `node`, `tsc`, `drizzle-kit`, `jest`, or `eslint` runs are expected to fail here — host Node drifts, host `DATABASE_URL` is wrong, and the dev image's `node_modules` lives in a container volume, not on host — so a host result is never signal and must not be reported as validation. If a host `node_modules/` directory exists, ignore it; never create or use one.

This runs all checks in order:
1. `lint` - ESLint validation (must have 0 warnings)
2. `test` - Run all tests (must have 0 failures)
3. `typecheck` - TypeScript compilation check
4. `build` - Full Next.js production build

**If any command fails inside the container, fix the issues before committing.** Report the exact `make dev-exec ...` command used and its result.

### Acceptance checks for delegated work

Verify delegated work with `make dev-exec npm run check` in-container. Never accept host-executed test/build/typecheck output as evidence for or against a change: those commands fail on host by design (see above), so a host failure is not a regression and must not block completion.

For acceptance harnesses that can only run `npm`/`npx`/`node` commands on the host, use the `verify` forwarder script. It boots the compose stack if needed and runs the full check **inside** the `web` container, then prints a stable token:

```
check: run command="npm run verify" expect=VERIFY_OK
```

`npm run verify` is a forwarder only — it shells out to `make`, so no host `node_modules` is used and host Node drift is irrelevant. It is inert unless invoked; production Docker builds still run `npm run build`. Prefer it over host-executed checks, and still express delegation acceptance as plain-language criteria plus deliverables where a harness is not involved.

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

App code, tests, Drizzle migrations, and any operation that runs Node/TS or installs dependencies run inside the compose `web` container — the Validation section above is the single source of truth for this rule.

The Makefile + `compose.yaml` are the entry point. Never invoke `docker compose` directly for app code — go through `make`. Read-only status checks (`docker compose ps`) are fine.

**Long-running tasks** — start the stack first:

```bash
make dev            # web + postgres + migrate
make dev-exec       # interactive shell into web container (or run a command — see below)
make dev-logs       # tail logs
make dev-down       # stop, keep volumes
make dev-reset      # stop, drop pg-data volume
make dev-rebuild    # rebuild dev images from scratch
```

**One-shot commands** — `make dev-exec <cmd>` runs `<cmd>` inside the web container. Stack must be up. When the inner command takes its own flags, separate with `--` (`make dev-exec -- npm install --save-dev <pkg>`); without `--`, make swallows them.

```bash
make dev-exec npm test                             # Jest
make dev-exec npm run check                        # full validation (lint + test + typecheck + build)
make dev-exec npm install <package>                # add a dep
make dev-exec npx drizzle-kit generate             # migration ops
```

Run `make help` for the full target list. See `README.md` for setup.
