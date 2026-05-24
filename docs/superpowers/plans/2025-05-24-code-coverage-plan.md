# Code Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add npm script to generate code coverage reports via Jest.

**Architecture:** Use Jest's built-in coverage with `--coverage` flag. No new dependencies needed.

**Tech Stack:** Jest, npm scripts

---

### Task 1: Add coverage script to package.json

**Files:**
- Modify: `package.json:10-26`

- [ ] **Step 1: Add test:coverage script**

```json
"test:coverage": "jest --coverage"
```

Add this to the "scripts" section in package.json (after "test" script).

- [ ] **Step 2: Run the coverage command to verify it works**

Run: `npm run test:coverage`
Expected: Tests run with coverage output in terminal and HTML reports in `coverage/`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add test:coverage script for code coverage reports"
```

---

**Spec Coverage:**
- ✅ Generate coverage reports on demand (via `npm run test:coverage`)

**Verification:**
- `npm run test:coverage` runs successfully and produces coverage output