# Next.js Dockerfile Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Dockerfile to a Next.js multi-stage build using Node v25.9.0 and enabling standalone output.

**Architecture:** Multi-stage build (Deps -> Builder -> Runner) using Next.js standalone output for minimal production image size.

**Tech Stack:** Next.js, Prisma, Docker, Node.js v25.9.0.

---

### Task 1: Create `next.config.js`

**Files:**
- Create: `next.config.js`

- [ ] **Step 1: Create the file with standalone output enabled**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
```

- [ ] **Step 2: Verify file creation**

Run: `ls next.config.js`
Expected: File exists.

- [ ] **Step 3: Commit**

```bash
git add next.config.js
git commit -m "feat: enable standalone output in next.config.js"
```

---

### Task 2: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create the .dockerignore file**

```text
node_modules
.next
out
build
.git
.env*
Dockerfile
BUILD.md
```

- [ ] **Step 2: Verify file creation**

Run: `ls .dockerignore`
Expected: File exists.

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "feat: add .dockerignore"
```

---

### Task 3: Rewrite `Dockerfile`

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Rewrite the Dockerfile with multi-stage build**

```dockerfile
FROM node:25.9.0-alpine AS base

# ---------------------------------------------------------------------------
# Stage 1 – Install dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 – Build the application
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Set a placeholder DATABASE_URL for build time
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3 – Production runner
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Create .next directory with correct ownership for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone server and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# These environment variables are configurable at runtime
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Verify Dockerfile content**

Run: `cat Dockerfile`
Expected: Content matches the above.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: rewrite Dockerfile to Next.js multi-stage build"
```

---

### Task 4: Create `BUILD.md`

**Files:**
- Create: `BUILD.md`

- [ ] **Step 1: Create the BUILD.md file**

```markdown
# Building and Running moviedb

## Prerequisites
- Docker installed

## Build Instructions
To build the Docker image, run:

```bash
docker build -t moviedb .
```

## Run Instructions
To run the container:

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  moviedb
```

The application will be available at http://localhost:3000.
```

- [ ] **Step 2: Verify file creation**

Run: `ls BUILD.md`
Expected: File exists.

- [ ] **Step 3: Commit**

```bash
git add BUILD.md
git commit -m "docs: add build and run instructions"
```
