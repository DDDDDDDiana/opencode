---
phase: 06-service-boundary-and-accounting-preservation
plan: 02
subsystem: user-accounting
tags: [testing, regression, usage-tracking]
dependency_graph:
  requires: [06-01]
  provides: [usage-accounting-validation]
  affects: []
tech_stack:
  added: []
  patterns: [integration-testing, real-implementation-testing]
key_files:
  created:
    - packages/opencode/test/user/usage-accounting.test.ts
  modified: []
decisions: []
metrics:
  duration_minutes: 2
  tasks_completed: 1
  files_created: 1
  completed_date: "2026-03-18"
---

# Phase 6 Plan 02: Usage Accounting Preservation Tests Summary

**One-liner:** Regression tests prove per-user usage accounting and token aggregation remain intact after boundary clarification.

## Objective

Verify that per-user usage accounting and quota enforcement continue to work correctly after boundary clarification in plan 01.

## What Was Built

Created comprehensive regression test suite at `packages/opencode/test/user/usage-accounting.test.ts` with three integration tests:

1. **Token accrual across sessions** - Verifies Usage.record() correctly accumulates tokens from multiple sessions for the same user
2. **Per-user isolation** - Proves usage totals don't leak between different users
3. **Date-based aggregation** - Confirms Usage.stats() aggregates by date correctly

All tests use real User.create(), Session.createNext(), Usage.record(), and Usage.stats() implementations - no mocks.

## Tasks Completed

| Task | Name                                  | Commit    | Files                              |
| ---- | ------------------------------------- | --------- | ---------------------------------- |
| 1    | Add usage accounting regression tests | 65a815e70 | test/user/usage-accounting.test.ts |

## Deviations from Plan

None - plan executed exactly as written. Tests passed immediately, confirming usage accounting functionality is intact.

## Requirements Satisfied

- **USAGE-05**: Token and usage accounting continues to accrue to correct user (verified by test 1 and 2)
- **USAGE-06**: Tests verify persisted usage totals are accurate (foundation for quota enforcement)

## Verification

```bash
cd packages/opencode && bun test test/user/usage-accounting.test.ts --timeout 30000
```

Result: 3 pass, 0 fail, 6 expect() calls

## Self-Check

Verifying created files and commits:

- FOUND: packages/opencode/test/user/usage-accounting.test.ts
- FOUND: 65a815e70

## Self-Check: PASSED
