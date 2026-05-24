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

**Pre-commit validation (run always before committing):**
```bash
npm run check
```

This runs all checks in order:
1. `db:generate-client` - Regenerate Prisma client
2. `lint` - ESLint validation (must have 0 warnings)
3. `test` - Run all tests (must have 0 failures)
4. `typecheck` - TypeScript compilation check
5. `build` - Full Next.js production build

**If any command fails, fix the issues before committing.**

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

**Inline `env` is only for values requiring secret interpolation at template time (e.g., DATABASE_URL).
