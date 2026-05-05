# Prisma Database Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Rails-style database management scripts to `package.json`.

**Architecture:** Add `npm` scripts that wrap Prisma CLI commands to provide familiar Rails-like developer experience.

**Tech Stack:** Node.js, Prisma, npm.

---

### Task 1: Update package.json Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read package.json**

Ensure we have the latest content of `package.json`.

- [ ] **Step 2: Add database scripts**

Update the `scripts` object in `package.json`.

```json
{
  "scripts": {
    "db:schema:load": "prisma db push",
    "db:generate:migration": "prisma migrate dev --create-only",
    "db:migrate": "prisma migrate deploy",
    "db:generate-client": "prisma generate"
  }
}
```

- [ ] **Step 3: Verify script syntax**

Run `npm run` (without arguments) to list scripts and ensure they appear correctly.

- [ ] **Step 4: Commit changes**

```bash
git add package.json
git commit -m "chore: add rails-style prisma database scripts"
```

### Task 2: Verify db:generate-client

**Files:**
- Modify: None (Verification only)

- [ ] **Step 1: Run generate-client**

Run: `npm run db:generate-client`
Expected: SUCCESS. Output should indicate "Generated Prisma Client".

### Task 3: Verify db:schema:load (Dry Run/Check)

**Files:**
- Modify: None (Verification only)

- [ ] **Step 1: Run schema:load**

Run: `npm run db:schema:load`
Expected: SUCCESS. Output should indicate "The database is now in sync with your Prisma schema".

### Task 4: Verify db:generate:migration (Dry Run/Check)

**Files:**
- Modify: None (Verification only)

- [ ] **Step 1: Run generate:migration**

Run: `npm run db:generate:migration -- --name initial_setup`
Expected: SUCCESS. Should create a migration file in `prisma/migrations`.

- [ ] **Step 2: Clean up test migration**

If a test migration was created, remove it to keep the repo clean.
Run: `rm -rf prisma/migrations/*initial_setup*`
