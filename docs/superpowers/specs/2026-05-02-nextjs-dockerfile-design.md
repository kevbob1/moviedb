# Design Spec: Next.js Dockerfile Update

## Goal
Update the project's `Dockerfile` to support a Next.js production setup, mirroring the architecture found in `../pharmacy-simulator/Dockerfile`.

## Requirements
- Use Node version `v25.9.0` (as specified in `.nvmrc`).
- Multi-stage build for minimal image size.
- Support for Prisma client generation.
- Production-ready standalone output.
- Secure execution as a non-root user.

## Proposed Changes

### 1. `next.config.js`
Create a `next.config.js` file to enable standalone output.
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
```

### 2. `Dockerfile`
Rewrite the existing Rails-based `Dockerfile` to a Next.js multi-stage build.

#### Stages:
- **Base**: `node:25.9.0-alpine`
- **Deps**: `apk add --no-cache libc6-compat python3 make g++`, `npm ci`.
- **Builder**: `npx prisma generate`, `npm run build`.
- **Runner**: 
    - Create `nodejs` group and `nextjs` user.
    - Copy `.next/standalone`, `.next/static`, `public/`, and `prisma/`.
    - Set `NODE_ENV=production`.
    - Expose `3000`.

### 3. `.dockerignore`
Create a `.dockerignore` to keep the build context clean.
- `node_modules`
- `.next`
- `out`
- `build`
- `.git`
- `.env*` (except necessary ones if any)

### 4. `BUILD.md`
Create a `BUILD.md` file with clear instructions on how to build and run the Docker image.

## Success Criteria
- `docker build` succeeds.
- Final image runs the Next.js server on port 3000.
- Prisma client is available in the production runner.
