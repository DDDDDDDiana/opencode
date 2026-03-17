---
phase: 03-user-management-api
plan: "01"
subsystem: user
tags: [user, schema, crud, api-key]
dependency_graph:
  requires: []
  provides: [User.create, User.get, User.Info, UserTable-schema]
  affects: [packages/opencode/src/user]
tech_stack:
  added: []
  patterns: [drizzle-query, zod-schema, bcrypt-hash]
key_files:
  created: []
  modified:
    - packages/opencode/src/user/user.sql.ts
    - packages/opencode/src/user/index.ts
decisions:
  - "Use z.custom<UserID>() for branded type in zod schema — avoids unsafe cast"
  - "Include User.get() in same commit as User.create() — both are core CRUD, no reason to split"
  - "JSON.stringify/parse for model_allowlist — SQLite has no array type"
metrics:
  duration_min: 8
  completed_date: "2026-03-17"
  tasks_completed: 3
  files_modified: 2
requirements: [USER-01]
---

# Phase 3 Plan 1: User Schema and CRUD Summary

Extended UserTable schema with user management fields and implemented User.create() and User.get().

## What Was Built

UserTable now has `name`, `quota_agent_calls`, `quota_concurrent_sessions`, `quota_daily_tokens`, and `model_allowlist` columns. The `User` namespace in `index.ts` exposes:

- `User.Info` — zod schema mapping DB row to camelCase type
- `User.create(params)` — generates API key, hashes it, inserts user + api_key rows, returns plaintext key once
- `User.get(id)` — queries by id, throws `NotFoundError` if missing, never exposes hash

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Tasks 2 and 3 were committed together since both were implemented in a single file write.

## Self-Check: PASSED

- `packages/opencode/src/user/user.sql.ts` — FOUND (commit d11b76b9e)
- `packages/opencode/src/user/index.ts` — FOUND (commit 293b925e7)
- Type errors in user files: only pre-existing bcrypt types error (not introduced by this plan)
