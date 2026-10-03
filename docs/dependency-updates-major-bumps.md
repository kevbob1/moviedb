# Major Version Dependency Updates (Deferred)

**Date:** 2026-10-02  
**Context:** Safe semver-compatible updates applied; major version bumps deferred to avoid breaking changes.

## Skipped Major Version Bumps

These packages have major version updates available but were intentionally skipped:

### Production Dependencies

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `dotenv` | ^18.0.5 | 18.0.5 | ✅ Updated 2026-10-02, no breaking changes |
| `motion` | ^14.0.0 | 14.0.0 | ✅ Updated 2026-10-02, no breaking changes |
| `nodemailer` | ^10.0.13 | 10.0.13 | ✅ Updated 2026-10-02, no breaking changes |
| `pino` | ^10.4.0 | 10.4.0 | ✅ Updated 2026-10-02, no breaking changes |

### Development Dependencies

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@testing-library/jest-dom` | ^7.0.1 | 7.0.1 | ✅ Updated 2026-10-02, requires `@testing-library/dom` peer |
| `eslint` | ^9.39.5 | 10.12.0 | ❌ Reverted: `eslint-plugin-react` incompatible with ESLint 10 API |
| `typescript` | ^6.0.3 | 7.0.2 | ✅ Updated 2026-10-03 via official side-by-side recipe (see below) |

## Migration Notes

When tackling these updates:

1. **Review changelogs** for each package before upgrading
2. **Update one at a time** to isolate any breaking changes
3. **Run full validation** after each update: `make dev-exec npm run check`
4. **Pay special attention to:**
   - `motion` 12→14: Likely API changes, check component usage
   - `nodemailer` 7→10: Review email sending code for API changes

### TypeScript 6→7 side-by-side (2026-10-03)

TypeScript 7.0 is the native (Go) port and **ships no JS API** — tooling like
`typescript-eslint` (transitive dep of `eslint-config-next`) hard-fails on import
when it detects TS 7.0. Applied Microsoft's official side-by-side recipe from the
[TS 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0):

```json
"devDependencies": {
  "@typescript/native": "npm:typescript@~7.0.2",
  "typescript": "npm:@typescript/typescript6@^6.0.2"
}
```

- `tsc` / `npm run typecheck` resolves to the native TS 7.0.2 binary (`@typescript/native` alias, `8–12x` faster builds)
- `typescript` resolves to `@typescript/typescript6` 6.0.3, which re-exports the TS 6 API for typescript-eslint, ts-node, tsx, and Next's build-time type checking
- `npx tsc6` available for explicitly invoking the TS 6 compiler
- Full validation (`make dev-exec npm run check`) passing: lint 0 warnings, 389 tests, typecheck clean, build successful
- typescript-eslint gains native TS 7 support in TS 7.1 (tracking: typescript-eslint#10940) — revisit aliases then

### Completed Updates (2026-10-02)

Phase 1 (Development Dependencies):
- ✅ `@testing-library/jest-dom` 6→7: Working, added `@testing-library/dom` peer dependency
- ❌ `eslint` 9→10: Reverted — `eslint-plugin-react` (via `eslint-config-next`) is incompatible with ESLint 10 API
- ✅ `typescript` 6→7: Completed 2026-10-03 via side-by-side install (failed on first attempt before the side-by-side recipe was applied)

Tooling changes:
- ✅ Replaced `ts-jest` with `@swc/jest` to remove the `typescript <7` peer dependency constraint
- ✅ Added `allowScripts` config for native/binary package install scripts

Phase 2 (Production Dependencies - Medium Risk) completed successfully:
- ✅ `dotenv` 17→18: No breaking changes
- ✅ `pino` 9→10: Logger config compatible

Phase 3 (Production Dependencies - High Risk) completed successfully:
- ✅ `nodemailer` 7→10: No API changes required
- ✅ `motion` 12→14: `motion/react` API remains compatible

## Current Status

All semver-compatible updates have been applied and validated:
- ✅ 25 packages updated
- ✅ Lint: 0 warnings
- ✅ Tests: 389 passing
- ✅ Typecheck: clean
- ✅ Build: successful

## Related Changes

- `compose.yaml`: Updated `postgres:18.4` → `18.6`
- `compose.yaml`: Changed config file mounts from `:ro` to `:rw`
- `src/components/NeedsMatchSyncControl.test.tsx`: Added `bfcacheId: ''` to mock (required by Next 16.3.8)
