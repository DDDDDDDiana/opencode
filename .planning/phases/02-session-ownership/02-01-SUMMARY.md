---
phase: 02-session-ownership
plan: 01
subsystem: session
tags: [session, ownership, isolation, user-context]
completed: 2026-03-17T10:20:47Z
duration_minutes: 14

dependency_graph:
  requires:
    - packages/opencode/src/user/user-context.ts
    - packages/opencode/src/user/schema.ts
  provides:
    - user_id column on SessionTable
    - user-filtered Session.list()
    - user-tagged Session.create()
  affects:
    - packages/opencode/src/session/session.sql.ts
    - packages/opencode/src/session/index.ts

tech_stack:
  added: []
  patterns:
    - UserContext integration for session ownership
    - Nullable user_id for backward compatibility

key_files:
  created: []
  modified:
    - packages/opencode/src/session/session.sql.ts
    - packages/opencode/src/session/index.ts

decisions:
  - decision: Use UserContext.get() not .use() in session operations
    rationale: Avoid throwing when context missing, gracefully handle anonymous
    alternatives: [use() with try/catch, separate authenticated/anonymous APIs]
  - decision: Filter list() by user_id in all cases (authenticated and anonymous)
    rationale: Enforce isolation at query level, prevent accidental cross-user access
    alternatives: [application-level filtering, separate list functions]

metrics:
  tasks_completed: 3
  tasks_planned: 3
  files_modified: 2
  commits: 3
  lines_added: 17
  lines_removed: 0
---

# Phase 02 Plan 01: Session Ownership Schema and Filtering

**One-liner:** Added user_id column to SessionTable with filtering in list/create operations for per-user session isolation

## Overview

Implemented session ownership by adding user_id column to SessionTable and integrating UserContext to filter session operations. Authenticated users now see only their sessions, anonymous users see only unowned sessions.

## Tasks Completed

### Task 1: Add user_id column to SessionTable

**Status:** ✅ Complete  
**Commit:** a60e79b55

Added nullable user_id column to SessionTable after workspace_id with index for efficient queries. Imported UserID type from user schema. Column is nullable for backward compatibility with existing sessions.

**Files modified:**

- packages/opencode/src/session/session.sql.ts

**Changes:**

- Added `user_id: text().$type<UserID>()` column
- Added `index("session_user_idx").on(table.user_id)`
- Imported UserID type from ../user/schema

### Task 2: Tag sessions with user_id on creation

**Status:** ✅ Complete  
**Commit:** 7649bc2da

Updated Session.createNext() to read UserContext and set user_id on new sessions. Authenticated users get their ID, anonymous users get NULL. Updated Info type, fromRow, and toRow to handle userID field.

**Files modified:**

- packages/opencode/src/session/index.ts

**Changes:**

- Added userID field to Session.Info type (optional)
- Updated fromRow to map user_id → userID
- Updated toRow to map userID → user_id
- Set userID from UserContext in createNext
- Imported UserContext and UserID type

### Task 3: Filter Session.list() by user_id

**Status:** ✅ Complete  
**Commit:** edf9ef5df

Added user_id filtering to Session.list() generator. Authenticated users see only sessions where user_id matches their ID. Anonymous users see only sessions where user_id IS NULL.

**Files modified:**

- packages/opencode/src/session/index.ts

**Changes:**

- Read UserContext at start of list()
- Add eq(SessionTable.user_id, ctx.user_id) for authenticated
- Add isNull(SessionTable.user_id) for anonymous
- Filtering applied before other conditions

## Verification

- ✅ SessionTable has user_id column with index
- ✅ Session.createNext() sets user_id from UserContext
- ✅ Session.list() filters by user_id based on authenticated/anonymous state
- ✅ Type checking passes (no new errors in session files)

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Satisfied

- **SESS-01:** Session creation tags owner (authenticated) or NULL (anonymous)
- **SESS-02:** Session.list() returns only owned sessions for authenticated users
- **SESS-05:** Anonymous requests see only NULL user_id sessions

## Next Steps

Plan 02-02 will add user_id filtering to Session.get() and other read operations to complete session isolation.

## Self-Check: PASSED

All commits verified:

- a60e79b55: Task 1 commit exists
- 7649bc2da: Task 2 commit exists
- edf9ef5df: Task 3 commit exists

All files verified:

- packages/opencode/src/session/session.sql.ts: FOUND
- packages/opencode/src/session/index.ts: FOUND
- .planning/phases/02-session-ownership/02-01-SUMMARY.md: FOUND
