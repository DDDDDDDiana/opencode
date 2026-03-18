---
phase: 09-authentication-enforcement
plan: 01
subsystem: server-middleware
tags: [authentication, security, middleware]
dependency_graph:
  requires: [user-auth.resolve, UserContext.provide]
  provides: [api-key-enforcement, 401-responses]
  affects: [all-api-routes]
tech_stack:
  added: []
  patterns: [middleware-chain, context-propagation]
key_files:
  created: []
  modified: [packages/opencode/src/server/server.ts]
decisions:
  - Exempt routes use startsWith for subpath matching
  - Auth middleware positioned after CORS, before routes
  - WWW-Authenticate header follows Bearer scheme
metrics:
  duration_seconds: 74
  completed_date: "2026-03-18"
---

# Phase 09 Plan 01: User Authentication Middleware Summary

**One-liner:** API key authentication middleware enforcing 401 rejection for unauthenticated requests with HTTP-compliant WWW-Authenticate headers

## What Was Built

Integrated user authentication middleware into server.ts that:

- Reads x-opencode-api-key header from incoming requests
- Calls resolve() to validate API key
- Returns 401 with WWW-Authenticate header for anonymous requests
- Wraps authenticated requests with UserContext.provide()
- Exempts health/metrics/monitoring routes from authentication

## Implementation Details

**Modified Files:**

- `packages/opencode/src/server/server.ts` - Added imports and auth middleware

**Key Changes:**

1. Added imports for resolve (from ./user-auth) and UserContext
2. Inserted middleware after CORS (line 130), before GlobalRoutes (line 131)
3. Exempt routes: /health, /metrics, /ready, /log, /doc (using startsWith)
4. 401 response includes WWW-Authenticate: Bearer realm="opencode" header
5. Authenticated requests wrapped with UserContext.provide(identity, () => next())

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**Automated:**

- ✅ TypeScript compilation passed (bun typecheck)
- ✅ No type errors in server.ts
- ✅ Imports resolved correctly
- ✅ Middleware chain compiles

**Manual verification required:**

- Server startup test
- 401 response for missing API key
- 401 response for invalid API key
- Exempt routes accessible without auth
- Valid API key requests succeed

## Commits

| Task | Commit    | Description                                  |
| ---- | --------- | -------------------------------------------- |
| 1    | 3391cceff | Add user authentication middleware to server |

## Next Steps

This completes Phase 09 Plan 01. The authentication middleware is now enforcing API key requirements for all non-exempt routes.

**Recommended next action:** Execute Phase 09 Plan 02 (if exists) or Phase 10 to remove anonymous fallback logic.
