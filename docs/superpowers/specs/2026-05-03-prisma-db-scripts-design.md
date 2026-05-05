# Design Spec: Rails-style Prisma Database Scripts

## Overview
Add a set of `npm` scripts to `package.json` that wrap Prisma CLI commands using naming conventions familiar to Ruby on Rails / ActiveRecord users.

## Requirements
- Map Prisma commands to Rails-style names: `db:schema:load`, `db:generate:migration`, `db:migrate`, and `db:generate-client`.
- Support both local development workflows and production deployment workflows.

## Proposed Changes

### `package.json` Scripts
Update the `scripts` section with the following mappings:

| Script Name | Prisma Command | Analogy | Purpose |
| :--- | :--- | :--- | :--- |
| `db:schema:load` | `prisma db push` | `rails db:schema:load` | Syncs DB with `schema.prisma` directly. |
| `db:generate:migration` | `prisma migrate dev --create-only` | `rails generate migration` | Creates a migration file without applying it. |
| `db:migrate` | `prisma migrate deploy` | `rails db:migrate` | Applies pending migrations to the DB. |
| `db:generate-client` | `prisma generate` | ORM generation | Generates the Prisma Client. |

## Verification Plan
- Run `npm run db:generate-client` to ensure the client is generated.
- Run `npm run db:schema:load` to verify DB synchronization.
- Run `npm run db:generate:migration -- --name test_migration` to verify migration file creation.
- Run `npm run db:migrate` to verify migration deployment.
