# Spec: Critical Next.js Restructure

## Goal
Fix the broken Next.js project by creating the required App Router structure and missing library utilities.

## Proposed Changes

### 1. Library Utilities
Create a root-level `lib/` directory to house shared service clients.

- `lib/prisma.ts`: Prisma Client singleton pattern to prevent multiple instances in development.
- `lib/kafka.ts`: KafkaJS producer utility for audit logging.

### 2. Next.js App Router Structure
Establish the minimal directory structure required for a functional Next.js application.

- `app/layout.tsx`: Root layout with basic HTML/body tags.
- `app/page.tsx`: Basic landing page to verify the app is running.
- `app/globals.css`: Tailwind/Global styles placeholder.

### 3. Server Actions
Move and reorganize server actions to follow Next.js conventions.

- Move `actions/movie.ts` -> `app/actions/movie.ts`.

### 4. Configuration
- Update `tsconfig.json` with path aliases (`@/*`) for cleaner imports.

## Verification Plan
1. Run `npm run build` to ensure the project compiles.
2. Run `npm run test` to verify the existing logic (after updating test imports).
