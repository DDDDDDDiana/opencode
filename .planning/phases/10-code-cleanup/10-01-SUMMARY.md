---
phase: 10-code-cleanup
plan: 01
subsystem: user-authentication
tags: [type-system, cleanup, security]
dependency_graph:
  requires: [09-01]
  provides: [authenticated-only-types]
  affects: [user-context, user-auth, server-middleware]
tech_stack:
  added: []
  patterns: [error-based-auth, type-level-security]
key_files:
  created: []
  modified:
    - packages/opencode/src/user/user-context.ts
    - packages/opencode/src/server/user-auth.ts
    - packages/opencode/src/user/user-context.test.ts
    - packages/opencode/src/server/server.test.ts
    - packages/opencode/src/server/server.ts
decisions:
  - Throw errors from resolve() instead of returning anonymous state
  - Catch resolve() errors in middleware and convert to 401
  - Remove authenticated getter (always true with new type system)
metrics:
  duration_seconds: 211
  tasks_completed: 3
  files_modified: 5
  commits: 3
  completed_date: "2026-03-18"
---

# Phase 10 Plan 01: Remove Anonymous Identity Type

**One-liner:** Simplified Identity to Authenticated-only type, enforcing authentication at compile time through TypeScript type system

## Objective

Remove the Anonymous branch from the Identity union type and clean up all anonymous fallback logic, leveraging Phase 9's authentication middleware to provide compile-time guarantees that all code paths handle authenticated users only.

## What Was Built

### Type System Simplification

**Identity Type Reduction:**

- Changed `Identity` from `Authenticated | Anonymous` union to direct `Authenticated` type
- Removed `Anonymous` type definition entirely
- Removed `ANONYMOUS_MISSING` constant
- TypeScript now rejects any code attempting to handle `identity.state === "anonymous"`

**UserContext API Cleanup:**

- `get()`: Removed try-catch fallback, directly returns `ctx.use()`
- `userID`: Changed from `UserID | undefined` to `UserID` (non-optional)
- `authenticated`: Removed getter (always true by type)

### Authentication Flow Changes

**resolve() Function:**

- Return type: `Identity` → `Promise<Authenticated>`
- Missing key: `return anonymous` → `throw Error("API key missing")`
- Invalid key: `return anonymous` → `throw Error("Invalid API key")`
- Unknown key: `return anonymous` → `throw Error("Unknown API key")`
- Kept `throttle()` for logging failed attempts

**Middleware Error Handling:**

- Wrapped `resolve()` in try-catch
- Errors converted to 401 responses with WWW-Authenticate header
- Successful authentication provides Identity to UserContext

### Test Cleanup

**Removed Tests:**

- "defaults to anonymous when no context"
- "provides anonymous identity"
- "userID helper returns undefined for anonymous"
- "authenticated helper" anonymous branch

**Kept Tests:**

- "provides authenticated identity"
- "userID helper returns user_id for authenticated"
- All server middleware tests (401 responses, exempt routes)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

✅ TypeScript compilation passes with zero errors
✅ All tests pass (8 server tests, 2 user-context tests)
✅ No Anonymous type references in production code
✅ Identity is single type, not union type

## Impact

**Type Safety:**

- Compile-time guarantee that all code handles authenticated users
- Impossible to accidentally check for anonymous state
- Non-optional userID prevents undefined checks

**Code Simplification:**

- Removed 16 lines from user-context.ts
- Removed 4 anonymous test cases
- Cleaner error-based authentication flow

**Security:**

- Type system enforces authentication requirement
- No code paths can bypass authentication checks
- Completes v1.2 milestone security model

## Self-Check

Verifying created files and commits:

**Files:**
✅ packages/opencode/src/user/user-context.ts
✅ packages/opencode/src/server/user-auth.ts
✅ packages/opencode/src/user/user-context.test.ts
✅ packages/opencode/src/server/server.test.ts
✅ packages/opencode/src/server/server.ts

**Commits:**
✅ e5630e434 - Task 1: Simplify Identity type
✅ e632422ee - Task 2: Remove anonymous return paths
✅ c878e0b25 - Task 3: Remove anonymous tests

## Self-Check: PASSED

All files modified as planned, all commits created successfully.
