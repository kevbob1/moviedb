# Design Spec: README Database Migration Documentation

## Overview
This spec outlines updates to `README.md` to document the database migration workflow using Prisma. It replaces the existing "Database" section with a comprehensive "Database Management" section covering local development and production.

## Context
The project uses Prisma for ORM. Existing `package.json` scripts provide the necessary commands for migrations, but the current `README.md` incorrectly suggests using `prisma db push` for local development instead of the preferred strict migration workflow.

## Proposed Changes

### README.md
Replace the current "Database" section (lines 63-75) with the following structure:

#### Database Management

1. **Create a Migration (Local)**
   When you change `prisma/schema.prisma`, generate a new migration file:
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

## Verification Plan
1. **Manual Review**: Verify the commands match the scripts in `package.json`.
2. **Path Check**: Ensure absolute paths are used during implementation.
3. **Markdown Lint**: Ensure the resulting README is valid markdown.
