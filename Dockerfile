FROM node:25.9.0-alpine AS base
RUN apk add --no-cache openssl libc6-compat

# ---------------------------------------------------------------------------
# Stage 1 – Install dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache python3 make g++
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

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
