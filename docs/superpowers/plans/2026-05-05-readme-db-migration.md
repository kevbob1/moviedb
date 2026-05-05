# README Database Migration Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `README.md` to document the correct database migration workflow using Prisma for both local and production environments.

**Architecture:** Documentation update replacing prototyping-focused commands with production-ready migration workflows.

**Tech Stack:** Markdown, Prisma, npm scripts.

---

### Task 1: Replace Database Section in README.md

**Files:**
- Modify: `/home/kev/git/moviedb/README.md:63-75`

- [ ] **Step 1: Replace the old Database section with the new Database Management section**

Replace lines 63-75:
```markdown
### Database Management

1. **Create a Migration (Local)**
   When you change `prisma/schema.prisma`, generate a new migration file without applying it yet:
   ```bash
   npm run db:generate:migration -- --name your_migration_name
   ```

2. **Apply Migrations (Dev)**
   Apply pending migrations to your local development database:
   ```bash
   npm run db:migrate:dev
   ```

3. **Deploy Migrations (Production)**
   Apply migrations to a production environment (uses `prisma migrate deploy` which doesn't reset data):
   ```bash
   npm run db:migrate
   ```

4. **Prisma Studio**
   Open the visual database editor to inspect or edit data:
   ```bash
   npx prisma studio
   ```
```

- [ ] **Step 2: Verify the file content**

Run: `cat /home/kev/git/moviedb/README.md`
Expected: The file should now contain the "Database Management" section instead of the old "Database" section.

- [ ] **Step 3: Commit the changes**

```bash
git add README.md
git commit -m "docs: update database migration workflow in README"
```

- [ ] **Step 4: Commit the design spec and plan**

```bash
git add docs/superpowers/specs/2026-05-05-readme-db-migration-design.md docs/superpowers/plans/2026-05-05-readme-db-migration.md
git commit -m "docs: add design spec and implementation plan for database migration docs"
```
