---
phase: "01"
plan: "02"
subsystem: identity
tags: [auth, api-key, user-context, middleware]
dependency_graph:
  requires: []
  provides: [UserContext, API key auth, user persistence]
  affects: [server middleware, session isolation]
tech_stack:
  added: [bcrypt, UserContext ALS]
  patterns: [AsyncLocalStorage, global middleware]
key_files:
  created:
    - packages/opencode/src/user/user.sql.ts
    - packages/opencode/src/user/user-context.ts
    - packages/opencode/src/user/schema.ts
    - packages/opencode/src/user/index.ts
    - packages/opencode/src/server/user-auth.ts
    - packages/opencode/src/user/user-context.test.ts
    - packages/opencode/src/user/index.test.ts
    - packages/opencode/migration/20260317144535_identity_foundation/migration.sql
  modified:
    - packages/opencode/src/storage/schema.ts
    - packages/opencode/src/server/server.ts
decisions:
  - Use bcrypt cost factor 8 for API key hashing
  - Anonymous fallback for missing/invalid keys (no HTTP error)
  - Throttled logging (60s dedupe) for invalid key attempts
  - UserContext parallel to WorkspaceContext (not extending Instance)
metrics:
  duration: 10
  completed_date: "2026-03-17"
---

# Phase 1 Plan 2: Identity Foundation Summary

**One-liner:** API key authentication with bcrypt hashing, UserContext ALS propagation, and anonymous fallback for invalid keys

## What Was Built

Implemented complete API key authentication infrastructure:

**Plan 1.1 - Persistence & Crypto:**

- UserTable and ApiKeyTable schemas with snake_case columns
- API key generation (sk-<64 hex> from 32 random bytes)
- bcrypt hashing (cost 8) and verification helpers
- Additive migration for user/api_key/usage tables

**Plan 1.2 - UserContext:**

- Authenticated/Anonymous identity types with explicit state
- UserContext.provide/get/userID/authenticated helpers
- Safe anonymous fallback when context missing

**Plan 1.3 - Middleware:**

- Global user auth middleware after CORS, before workspace resolution
- Parses x-opencode-api-key header and resolves identity
- Wraps request in UserContext.provide()
- Throttled logging (60s dedupe) for invalid keys

**Plan 1.4 - Tests:**

- UserContext tests (anonymous fallback, identity provision)
- API key tests (format validation, bcrypt verification)
- Zero type errors, all tests pass

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Satisfied

- **AUTH-01:** API key format and generation (sk-<64 hex>)
- **AUTH-02:** Bcrypt hashing with cost 8, never persist plaintext
- **AUTH-03:** Anonymous fallback for missing/invalid keys
- **AUTH-04:** UserContext propagation via AsyncLocalStorage

## Commits

| Task | Commit    | Description                                   |
| ---- | --------- | --------------------------------------------- |
| 1.1  | afe832820 | Identity persistence and API key primitives   |
| 1.2  | 86fc1a0f1 | UserContext ALS and identity helpers          |
| 1.3  | da225fb16 | Global auth middleware and structured logging |
| 1.4  | 0f6fd326a | Tests for UserContext and API key helpers     |

## Self-Check: PASSED

All created files exist. All commits verified.
