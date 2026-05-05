# Prisma Environment Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Prisma to honor NODE_ENV by using separate .env files per environment

**Architecture:** Use Next.js built-in env file loading (.env, .env.development, .env.test). No code changes needed - Next.js loads the correct file based on NODE_ENV automatically.

**Tech Stack:** Next.js env files, Prisma

---

### Task 1: Update .gitignore to allow committing .env.test

**Files:**
- Modify: `.gitignore:10-12`

- [ ] **Step 1: Update .gitignore**

Current:
```
# Ignore all environment files (except templates).
/.env*
!/.env*.erb
```

Change to:
```
# Ignore all environment files (except templates).
/.env*
!/.env.test
!/.env*.erb
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: allow .env.test in gitignore"
```

---

### Task 2: Create .env.development

**Files:**
- Create: `.env.development`

- [ ] **Step 1: Create .env.development**

```bash
touch .env.development
```

Add content:
```
# Local development overrides
# DATABASE_URL defaults to .env value, add overrides here if needed
# Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moviedb_dev"
```

- [ ] **Step 2: Commit**

```bash
git add .env.development
git commit -m "chore: add .env.development for local dev overrides"
```

---

### Task 3: Verify setup works

**Files:**
- No changes

- [ ] **Step 1: Verify .env.test has correct DATABASE_URL**

```bash
cat .env.test
```

Expected output should show: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moviedb_test"`

- [ ] **Step 2: Verify prisma can connect**

```bash
npx prisma db execute --stdin <<< "SELECT 1" --database moviedb_test
```

Expected: Query executed successfully

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: configure prisma env per NODE_ENV"
```

---

## Summary of Changes

| File | Action |
|------|--------|
| `.gitignore` | Add `!/.env.test` to allow committing test env |
| `.env.development` | Create (empty, for dev overrides) |
| `.env.test` | Already exists with correct test DATABASE_URL |
| `lib/prisma.ts` | No changes needed |
| `prisma/schema.prisma` | No changes needed |

## Verification

After implementation:
- `npm run dev` → loads `.env` + `.env.development` (if NODE_ENV=development)
- `npm test` → loads `.env` + `.env.test` (if NODE_ENV=test)
- Production → DATABASE_URL from Kubernetes ConfigMap