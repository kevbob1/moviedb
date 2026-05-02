# MovieDB Next.js Rewrite Design Specification

**Goal:** Rewrite the legacy Ruby on Rails MovieDB application into a modern Next.js 15 application using TypeScript, Node.js, and Prisma. The application must retain its core functionality of fetching movie data from TMDB and publishing strict audit events to a Kafka cluster on any data mutation.

## Architecture
The application will use the **Integrated Next.js Architecture** (App Router):
- **Frontend & Routing:** Next.js 15 App Router.
- **Data Fetching:** React Server Components (RSC) will fetch data from the external TMDB API on demand.
- **Mutations & Business Logic:** Next.js Server Actions will handle database mutations via Prisma and orchestrate the Kafka audit publishing.
- **Database:** PostgreSQL managed by Prisma ORM.

## Prisma Schema
The database will store local references and user-specific data, deferring rich metadata to TMDB via on-demand fetching.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Movie {
  id           String   @id @default(uuid())
  tmdb_id      Int      @unique
  title        String
  release_date Int?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## Kafka Integration
The application must publish events to the `moviedb.audit` topic whenever a `Movie` record is created, updated, or destroyed.

- **Client:** `kafkajs`
- **Authentication:** SASL SCRAM-SHA-512 (using `KAFKA_USERNAME` and `KAFKA_PASSWORD` env vars) or fallback to localhost for development.
- **Payload Structure:**
  ```json
  {
    "event": "movie.[created|updated|destroyed]",
    "record_id": "<uuid>",
    "timestamp": "<iso8601>",
    "before": { ... }, // null for created
    "after": { ... }   // null for destroyed
  }
  ```

## Testing Strategy
The test suite will use **Jest** and **ts-jest** with a focus on integration-style testing for the database layer, matching the developer experience of the legacy Rails app.

- **Database Isolation:** Tests will run against a dedicated real test database (`DATABASE_URL` overridden in the test environment). Between tests, data will be cleared using either Prisma interactive transaction rollbacks or a fast truncation hook in `beforeEach`.
- **Fixtures:** We will use a factory library or dedicated helper functions to generate predictable seed data.
- **External Mocking:** Both `kafkajs` (Kafka broker connections) and external HTTP requests to TMDB will be fully mocked during testing.

## Application Structure
```text
app/
├── layout.tsx          # Root layout
├── page.tsx            # Homepage (movie search)
├── movies/
│   ├── page.tsx        # Movie listing (local DB state)
│   └── [id]/
│       └── page.tsx    # Movie detail (TMDB data merged with local data)
├── actions/
│   └── movie.ts        # Server Actions (CRUD + Audit emitting)
lib/
├── prisma.ts           # Prisma client singleton
├── kafka.ts            # kafkajs producer and publish helper
└── tmdb.ts             # TMDB fetch wrappers
prisma/
└── schema.prisma       # Database schema
__tests__/
├── setup.ts            # DB connection/teardown logic
├── lib/
└── actions/
```
