# Critical Next.js Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Next.js project by creating the required App Router structure and missing library utilities.

**Architecture:** We will create a root-level `lib/` for shared services, set up the `app/` directory for the App Router, and reorganize server actions into `app/actions/`.

**Tech Stack:** Next.js (App Router), Prisma, KafkaJS, TypeScript, Tailwind CSS.

---

### Task 1: Initialize Library Utilities

**Files:**
- Create: `lib/prisma.ts`
- Create: `lib/kafka.ts`

- [ ] **Step 1: Create `lib/prisma.ts`**
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Create `lib/kafka.ts`**
```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'moviedb',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();

export async function publishAudit(
  action: 'created' | 'updated' | 'deleted',
  recordId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<void> {
  try {
    await producer.connect();
    await producer.send({
      topic: 'movie.audit',
      messages: [{
        value: JSON.stringify({
          event: `movie.${action}`,
          record_id: recordId,
          before,
          after,
          timestamp: new Date().toISOString()
        })
      }]
    });
  } catch (error) {
    console.error('Failed to publish audit event to Kafka:', error);
  } finally {
    await producer.disconnect();
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add lib/
git commit -m "chore: add prisma and kafka library utilities"
```

---

### Task 2: Setup App Router Scaffold

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Create `app/layout.tsx`**
```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MovieDB',
  description: 'Movie database application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `app/page.tsx`**
```typescript
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">MovieDB</h1>
      <p className="text-gray-600">Welcome to the movie database application.</p>
    </main>
  );
}
```

- [ ] **Step 3: Create `app/globals.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #000000;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}
```

- [ ] **Step 4: Commit**
```bash
git add app/
git commit -m "chore: scaffold app router with layout and root page"
```

---

### Task 3: Reorganize Server Actions

**Files:**
- Modify: `app/actions/movie.ts` (Move from `actions/movie.ts`)
- Delete: `actions/` (If empty)

- [ ] **Step 1: Move server actions**
```bash
mkdir -p app/actions
mv actions/movie.ts app/actions/movie.ts
```

- [ ] **Step 2: Verify `app/actions/movie.ts` imports**
The imports should remain correct as `../lib/prisma` and `../lib/kafka` since both `app/actions/` and the original `actions/` are at the same depth relative to the root (where `lib/` now lives).

- [ ] **Step 3: Commit**
```bash
git add app/actions/
git rm actions/movie.ts
git commit -m "refactor: move server actions to app/actions"
```

---

### Task 4: Configure TypeScript Path Aliases

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Update `tsconfig.json`**
Add `baseUrl` and `paths` to `compilerOptions`.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    // ... existing options
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add tsconfig.json
git commit -m "chore: configure typescript path aliases"
```

---

### Task 5: Update Tests and Verify

**Files:**
- Modify: `__tests__/actions/movie.test.ts`
- Modify: `__tests__/lib/kafka.test.ts`
- Modify: `jest.config.js`

- [ ] **Step 1: Update test imports in `__tests__/actions/movie.test.ts`**
```typescript
// From
import { createMovie } from '../../actions/movie';
// To
import { createMovie } from '../../app/actions/movie';
```

- [ ] **Step 2: Update `jest.config.js` module mapping**
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
},
```

- [ ] **Step 3: Verify build**
Run: `npm run build`
Expected: Success

- [ ] **Step 4: Verify tests**
Run: `npm run test`
Expected: Success

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "test: update imports and verify project"
```
