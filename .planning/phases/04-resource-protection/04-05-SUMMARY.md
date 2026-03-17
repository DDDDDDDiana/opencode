---
phase: 04-resource-protection
plan: "05"
subsystem: provider/provider
tags: [model-allowlist, model-access, provider]
dependency_graph:
  requires: [user/errors.ts, user/index.ts, user/user-context.ts]
  provides: [model allowlist enforcement in Provider.getModel()]
  affects: [all callers of Provider.getModel()]
tech_stack:
  added: []
  patterns: [allowlist.includes() check, null = unlimited pattern]
key_files:
  modified: [packages/opencode/src/provider/provider.ts]
key_decisions:
  - Check modelID (short ID param) against allowlist, not info.id (full ModelID)
  - No try/catch — NotFoundError from User.get() surfaces as error (stale userID)
metrics:
  duration_min: 3
  completed: 2026-03-17
  tasks: 1
  files: 1
---

# Phase 4 Plan 5: Model Allowlist Summary

Model allowlist enforced in `Provider.getModel()` for authenticated users. Throws `ModelAccessError` with requested model and full allowed list when model not in allowlist.

## Tasks Completed

| Task                                      | Commit    | Files                |
| ----------------------------------------- | --------- | -------------------- |
| 1: allowlist check in Provider.getModel() | f5933ffda | provider/provider.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
