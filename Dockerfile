FROM node:25.9.0-alpine AS base

# ---------------------------------------------------------------------------
# Stage 1 – Install dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

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
RUN npm run db:generate-client

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Compile the migration script for runtime
RUN npx tsc scripts/migrate.ts --outDir . --esModuleInterop --module esnext --target es2020 --resolveJsonModule --ignoreConfig

# ---------------------------------------------------------------------------
# Stage 3 – Production runner
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl

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
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# Copy compiled migration script and its local dependency
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.js ./scripts/migrate.js
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/logger.js ./src/lib/logger.js

# Copy full node_modules for prisma migrate deploy (transitive deps too deep to enumerate)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

# These environment variables are configurable at runtime
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
