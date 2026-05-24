# Code Coverage Design

## Overview
Add ability to generate code coverage reports for this project.

## Approach
Use Jest's built-in coverage functionality with the `--coverage` flag. No additional dependencies required.

## Implementation

Add script to `package.json`:
```json
"test:coverage": "jest --coverage"
```

## Output
- Terminal summary shows line/branch/function/statement coverage
- HTML reports in `coverage/lcov-report/` for detailed browsing

## Usage
```bash
npm run test:coverage
```