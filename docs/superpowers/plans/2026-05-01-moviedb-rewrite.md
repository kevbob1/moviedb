# MovieDB Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the MovieDB application to Next.js 15, Prisma, and TypeScript, porting Kafka audit logging and TMDB integration.

**Architecture:** Next.js App Router. Server Components fetch TMDB on-demand. Server Actions handle Prisma mutations and publish audit events to Kafka. Integration tests use a real PostgreSQL test database with truncation between tests.

**Tech Stack:** Next.js 15, TypeScript, Node.js, Prisma (PostgreSQL), kafkajs, Jest, ts-jest.

---

### Task 1: Next.js Initialization & Prisma Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `prisma/schema.prisma`
- Create: `.env.test`

- [ ] **Step 1: Initialize package.json and install dependencies**
```bash
npm init -y
npm install next react react-dom prisma @prisma/client kafkajs
npm install -D typescript @types/node @types/react jest ts-jest @types/jest dotenv
```

- [ ] **Step 2: Initialize TypeScript config**
```bash
npx tsc --init
```
Modify `tsconfig.json` to include `"jsx": "preserve"` and `"moduleResolution": "node"`.

- [ ] **Step 3: Setup Prisma Schema**
Create `prisma/schema.prisma`:
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

- [ ] **Step 4: Create Test Environment File**
Create `.env.test`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moviedb_test"
KAFKA_BROKERS="localhost:9092"
```

- [ ] **Step 5: Generate Prisma Client & Run Format**
```bash
npx prisma generate
```

- [ ] **Step 6: Commit**
```bash
git add package.json package-lock.json tsconfig.json prisma/schema.prisma .env.test
git commit -m "chore: init next.js and prisma for moviedb rewrite"
```

### Task 2: Jest & Database Teardown Setup

**Files:**
- Create: `jest.config.js`
- Create: `__tests__/setup.ts`
- Create: `lib/prisma.ts`

- [ ] **Step 1: Create Prisma Client Singleton**
Create `lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Configure Jest**
Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/legacy-rails/'],
};
```

- [ ] **Step 3: Create Test Setup with Teardown**
Create `__tests__/setup.ts`:
```typescript
import { prisma } from '../lib/prisma';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

beforeEach(async () => {
  const tableNames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tableNames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 4: Commit**
```bash
git add jest.config.js __tests__/setup.ts lib/prisma.ts
git commit -m "test: configure jest with prisma db truncation"
```

### Task 3: Kafka Producer Service (TDD)

**Files:**
- Create: `__tests__/lib/kafka.test.ts`
- Create: `lib/kafka.ts`

- [ ] **Step 1: Write the failing test**
Create `__tests__/lib/kafka.test.ts`:
```typescript
import { publishAudit } from '../../lib/kafka';
import { Kafka } from 'kafkajs';

jest.mock('kafkajs', () => {
  const sendMock = jest.fn();
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: () => ({
        connect: jest.fn(),
        send: sendMock,
        disconnect: jest.fn(),
      }),
    })),
    __sendMock: sendMock
  };
});

describe('Kafka Producer', () => {
  it('publishes audit event in correct format', async () => {
    const { __sendMock } = require('kafkajs');
    __sendMock.mockClear();

    const before = null;
    const after = { id: '123', title: 'Test Movie' };
    
    await publishAudit('created', '123', before, after);

    expect(__sendMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(__sendMock.mock.calls[0][0].messages[0].value);
    
    expect(payload.event).toBe('movie.created');
    expect(payload.record_id).toBe('123');
    expect(payload.before).toBeNull();
    expect(payload.after.title).toBe('Test Movie');
    expect(payload.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx jest __tests__/lib/kafka.test.ts`
Expected: FAIL with "publishAudit is not a function" or module not found.

- [ ] **Step 3: Write minimal implementation**
Create `lib/kafka.ts`:
```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'moviedb',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'scram-sha-512',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined,
});

const producer = kafka.producer();

export async function publishAudit(action: string, recordId: string, before: any, after: any) {
  await producer.connect();
  await producer.send({
    topic: 'moviedb.audit',
    messages: [{
      value: JSON.stringify({
        event: `movie.${action}`,
        record_id: recordId,
        timestamp: new Date().toISOString(),
        before,
        after,
      }),
    }],
  });
  await producer.disconnect();
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx jest __tests__/lib/kafka.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add __tests__/lib/kafka.test.ts lib/kafka.ts
git commit -m "feat: implement kafka audit producer"
```

### Task 4: Movie Server Actions (TDD)

**Files:**
- Create: `__tests__/actions/movie.test.ts`
- Create: `actions/movie.ts`

- [ ] **Step 1: Write the failing test**
Create `__tests__/actions/movie.test.ts`:
```typescript
import { createMovie } from '../../actions/movie';
import { prisma } from '../../lib/prisma';
import * as kafka from '../../lib/kafka';

jest.mock('../../lib/kafka', () => ({
  publishAudit: jest.fn()
}));

describe('Movie Actions', () => {
  it('creates a movie and publishes audit event', async () => {
    const publishSpy = jest.spyOn(kafka, 'publishAudit');
    
    const result = await createMovie({
      tmdb_id: 550,
      title: 'Fight Club',
      release_date: 1999
    });

    // DB Verification
    const inDb = await prisma.movie.findUnique({ where: { id: result.id } });
    expect(inDb).not.toBeNull();
    expect(inDb?.title).toBe('Fight Club');

    // Audit Verification
    expect(publishSpy).toHaveBeenCalledWith('created', result.id, null, expect.objectContaining({ title: 'Fight Club' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx jest __tests__/actions/movie.test.ts`
*(Note: Requires PostgreSQL running locally for Prisma to connect. If not running, test will fail on DB connection).*
Expected: FAIL because `createMovie` doesn't exist.

- [ ] **Step 3: Write minimal implementation**
Create `actions/movie.ts`:
```typescript
import { prisma } from '../lib/prisma';
import { publishAudit } from '../lib/kafka';

export async function createMovie(data: { tmdb_id: number; title: string; release_date?: number }) {
  const movie = await prisma.movie.create({
    data
  });

  await publishAudit('created', movie.id, null, movie);

  return movie;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx jest __tests__/actions/movie.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add __tests__/actions/movie.test.ts actions/movie.ts
git commit -m "feat: implement createMovie action with auditing"
```
