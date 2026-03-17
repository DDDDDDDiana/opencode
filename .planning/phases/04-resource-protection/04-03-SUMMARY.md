---
phase: 04-resource-protection
plan: "03"
subsystem: session/index, session/processor
tags: [quota, concurrent-sessions, daily-tokens]
dependency_graph:
  requires: [user/errors.ts, user/index.ts, user/usage.ts, user/user-context.ts]
  provides: [concurrent session quota enforcement, daily token cap enforcement]
  affects: [Session.createNext(), SessionProcessor.process()]
tech_stack:
  added: []
  patterns: [count() drizzle query, Usage.stats() today filter]
key_files:
  modified: [packages/opencode/src/session/index.ts, packages/opencode/src/session/processor.ts]
key_decisions:
  - count() imported from drizzle-orm via db.ts re-export (export * from drizzle-orm)
  - Daily token check uses today = new Date().toISOString().slice(0, 10) matching Usage.record() format
metrics:
  duration_min: 4
  completed: 2026-03-17
  tasks: 2
  files: 2
---

# Phase 4 Plan 3: Quota Enforcement Summary

Concurrent session quota enforced in `Session.createNext()` and daily token cap enforced before `LLM.stream()` in processor.ts. Both throw `QuotaError` with structured data.

## Tasks Completed

| Task                                        | Commit    | Files                |
| ------------------------------------------- | --------- | -------------------- |
| 1: concurrent session quota in createNext() | ecf3b28d9 | session/index.ts     |
| 2: daily token cap before LLM.stream()      | ecf3b28d9 | session/processor.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
