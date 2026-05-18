# Eliminate Prisma Mocks from movie.test.ts

## Context

AGENTS.md states: "Limit object mocking to external APIs only. Do not mock prisma objects or database reads or writes." Currently `movie.test.ts` mocks the entire `prisma` module (category A — DB access), violating this rule. The goal is to eliminate all category A mocks while keeping category B mocks (external APIs like Kafka).

## Mock Inventory

### movie.test.ts

| Mock | Category | Action |
|------|----------|--------|
| `jest.mock('../../lib/prisma')` — `prisma.movie.findUnique` | A (DB read) | Eliminate |
| `jest.mock('../../lib/prisma')` — `prisma.movie.create` | A (DB write) | Eliminate |
| `jest.mock('../../lib/kafka')` — `publishAudit` | B (external Kafka API) | Keep |

### kafka.test.ts

| Mock | Category | Action |
|------|----------|--------|
| `jest.mock('kafkajs')` | B (external Kafka broker) | Keep |

## Design

### Isolation strategy

Truncate the `movies` table between tests using `prisma.movie.deleteMany()` in `beforeEach`/`afterEach`. The project already has a `moviedb_test` database configured in `.env.test` and a `db:migrate:test` script.

### Test changes to movie.test.ts

1. Remove `jest.mock('../../lib/prisma', ...)` and all `jest.mocked(prisma.movie.*)` calls
2. Import `prisma` from `../../lib/prisma` for cleanup assertions only (the action under test imports it internally)
3. Add `beforeEach` that runs `prisma.movie.deleteMany()` to clear the table
4. **"creates a movie" test**: Call `createMovie()`, then use `prisma.movie.findUnique()` to verify the record was actually persisted. Verify `publishAudit` was called with correct arguments.
5. **"rejects duplicate tmdb_id" test**: Seed a movie with `prisma.movie.create()` first, then call `createMovie()` with the same `tmdb_id`. Expect it to throw. Verify `publishAudit` was NOT called.
6. Keep `jest.mock('../../lib/kafka')` (category B)

### Prerequisite

Tests require a running Postgres with migrations applied to `moviedb_test`. Add a `test:db` npm script: `dotenv -e .env.test -- prisma migrate deploy && jest`

### Assertions

- **"creates a movie"**: Verify `createMovie()` returns a movie object, verify row exists in DB via `prisma.movie.findUnique()`, verify `publishAudit` called with `('created', movie.id, null, {title: 'Fight Club'})`
- **"rejects duplicate tmdb_id"**: Seed movie, call `createMovie()` with same `tmdb_id`, expect throw matching "already exists", verify `publishAudit` not called
