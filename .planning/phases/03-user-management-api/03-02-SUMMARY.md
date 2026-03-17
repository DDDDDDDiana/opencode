---
phase: 03-user-management-api
plan: "02"
subsystem: user
tags: [user, quota, crud, session-orphaning]
dependency_graph:
  requires: [03-01]
  provides: [User.update, User.remove]
  affects: [session-ownership]
tech_stack:
  added: []
  patterns: [drizzle-update, session-orphaning]
key_files:
  created: []
  modified:
    - packages/opencode/src/user/index.ts
    - packages/opencode/src/session/session.sql.ts
decisions:
  - User.update() uses partial spread pattern to only set provided fields
  - User.remove() orphans sessions before delete to avoid FK constraint issues
  - session.sql.ts user_id column synced with existing migration
metrics:
  duration_min: 5
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_modified: 2
requirements: [USER-04, USER-05]
---

# Phase 3 Plan 02: User Update and Remove Summary

User.update() and User.remove() implemented with quota patching and session orphaning.

## Tasks Completed

| Task | Name                                     | Commit    | Files                                                                             |
| ---- | ---------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| 1    | Add User.update() for quota patching     | 250d337cf | packages/opencode/src/user/index.ts, packages/opencode/src/session/session.sql.ts |
| 2    | Add User.remove() with session orphaning | 250d337cf | packages/opencode/src/user/index.ts                                               |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced user_id column in session.sql.ts with existing migration**

- **Found during:** Task 2 (needed SessionTable.user_id for orphaning query)
- **Issue:** session.sql.ts was missing user_id column and index despite migration 20260317110427_add_session_user_id having already added it to the DB
- **Fix:** Added `user_id: text().$type<UserID>()` and `session_user_idx` index to SessionTable schema; added UserID type import
- **Files modified:** packages/opencode/src/session/session.sql.ts
- **Commit:** 250d337cf

## Decisions Made

- User.update() uses conditional spread `...(field !== undefined && { col: val })` so only provided fields are updated — null is a valid patch value (clears quota)
- User.remove() orphans sessions first (user_id → NULL), then deletes user — order matters to avoid FK issues
- SessionTable schema now matches the migration that was generated in Phase 2 Plan 04

## Self-Check: PASSED

- packages/opencode/src/user/index.ts — FOUND, 144 lines
- packages/opencode/src/session/session.sql.ts — FOUND, user_id column present
- Commit 250d337cf — FOUND
