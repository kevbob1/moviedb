# Prisma Environment Configuration Design

## Overview

Configure Prisma to honor NODE_ENV by using separate .env files per environment.

## Current State

- `lib/prisma.ts` - PrismaClient singleton (already handles dev/prod)
- `prisma/schema.prisma` - Uses `DATABASE_URL` from env
- `.env` - Contains dev DATABASE_URL
- `.env.test` - Exists (content unverified)
- No `.env.development`

## Architecture

Use Next.js built-in env file loading:

| File | NODE_ENV | Purpose |
|------|----------|---------|
| `.env` | any | Default values (commit to git) |
| `.env.development` | development | Dev overrides |
| `.env.test` | test | Test overrides |
| env vars | production | Set via Kubernetes ConfigMap |

## Configuration

### Files to create/modify

1. **`.env`** (exists)
   - Keep as base/defaults
   - DATABASE_URL for local dev

2. **`.env.development`** (new)
   - Local dev overrides (if any differ from .env)

3. **`.env.test`** (exists - verify)
   - Test DATABASE_URL (separate test database)

### Database Setup

- Dev: `moviedb_development`
- Test: `moviedb_test`

### Prisma Schema

No changes needed - already uses `env("DATABASE_URL")`.

### Prisma Client (`lib/prisma.ts`)

No changes needed - already handles dev/prod correctly.

## Testing

- `npm test` loads `.env.test` automatically
- `npm run dev` loads `.env.development` when `NODE_ENV=development`

## Open Questions

1. Should `.env.development` and `.env.test` be gitignored?
   - Recommendation: Commit `.env` and `.env.test`, gitignore `.env.development` (devs may have different local setups)