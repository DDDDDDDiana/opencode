---
phase: 03-user-management-api
plan: "03"
subsystem: user
tags: [usage, drizzle, sqlite, tokens]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [usage-schema, usage-record, usage-stats]
  affects: [usage-api-endpoint]
tech_stack:
  added: []
  patterns: [drizzle-sqlite, database-use, namespace-module]
key_files:
  created:
    - packages/opencode/src/user/usage.sql.ts
    - packages/opencode/src/user/usage.ts
  modified: []
decisions:
  - "Usage.record() is synchronous (no async) — Database.use() is sync, no await needed"
  - "stats() sorts in JS not SQL — simpler, result sets are small per user"
metrics:
  duration_min: 2
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_changed: 2
requirements: [USAGE-01, USAGE-04]
---

# Phase 3 Plan 03: UsageTable Schema and Usage Namespace Summary

**One-liner:** SQLite UsageTable with Drizzle schema plus Usage.record()/stats() for per-user token tracking aggregated by date.

## What Was Built

- `usage.sql.ts` — UsageTable with user_id, session_id, tokens, date columns; indexes on user_id and date
- `usage.ts` — Usage namespace with record() (insert row) and stats() (aggregate tokens by date for a user)

## Tasks Completed

| Task | Name                                             | Commit    | Files                                   |
| ---- | ------------------------------------------------ | --------- | --------------------------------------- |
| 1    | Create UsageTable schema                         | c4f37cfb9 | packages/opencode/src/user/usage.sql.ts |
| 2    | Create Usage namespace with record() and stats() | dcc6c5a11 | packages/opencode/src/user/usage.ts     |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- UsageTable has user_id, session_id, tokens, date columns with indexes ✓
- Usage.record() inserts a usage row ✓
- Usage.stats() returns [{date, tokens}] aggregated by date for a user ✓
- Type checking passes for both files ✓
