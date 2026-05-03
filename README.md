# MovieDB

A Next.js application with PostgreSQL and Kafka.

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Database**: PostgreSQL 16 + Prisma 5
- **Message Queue**: Apache Kafka 3.9
- **Language**: TypeScript

## Prerequisites

- Docker
- Dev Containers extension for VS Code (or `devcontainer` CLI)

## Development

### Using Devcontainer

This project uses a devcontainer for consistent development environment.

1.  **Start the devcontainer**:
    ```bash
    # Using VS Code
    devcontainer open .

    # Or rebuild and open
    devcontainer build --workspace-folder .
    devcontainer open --workspace-folder .
    ```

2.  **Connect to the app**:
    Once the devcontainer is running, the following services are available:

    | Service   | Port | URL                        |
    |-----------|------|----------------------------|
    | Next.js   | 3000 | http://localhost:3000      |
    | Postgres  | 5432 | postgresql://localhost:5432|
    | Kafka     | 9092 | localhost:9092             |

3.  **Environment variables**:
    The devcontainer automatically sets these variables:
    - `DATABASE_URL`: `postgresql://moviedb:new_password@db:5432/moviedb?schema=public`
    - `KAFKA_BROKERS`: `kafka:9092`

### Running the App

The devcontainer automatically runs `npm install` and `npx prisma generate` on startup.

To start the development server:

```bash
npm run dev
```

### Running Tests

```bash
npm run test
```

### Database

Prisma is configured for this project. To push schema changes to the database:

```bash
npx prisma db push
```

To open Prisma Studio (visual database editor):

```bash
npx prisma studio
```