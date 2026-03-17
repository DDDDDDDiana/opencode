---
phase: 04-resource-protection
plan: "02"
subsystem: user/errors
tags: [errors, quota, model-access]
dependency_graph:
  requires: [util/error NamedError]
  provides: [QuotaError, ModelAccessError]
  affects: [session/index.ts, session/processor.ts, session/prompt.ts, provider/provider.ts]
tech_stack:
  added: [packages/opencode/src/user/errors.ts]
  patterns: [NamedError.create pattern]
key_files:
  created: [packages/opencode/src/user/errors.ts]
key_decisions:
  - Single errors.ts module for all resource-protection errors avoids duplication
metrics:
  duration_min: 2
  completed: 2026-03-17
  tasks: 1
  files: 1
---

# Phase 4 Plan 2: Error Contracts Summary

Shared error contracts `QuotaError` and `ModelAccessError` defined in `user/errors.ts` using `NamedError.create` pattern.

## Tasks Completed

| Task                     | Commit    | Files          |
| ------------------------ | --------- | -------------- |
| 1: create user/errors.ts | 761d0b9bd | user/errors.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
