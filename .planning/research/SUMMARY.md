# Project Research Summary

**Project:** OpenCode v1.2 - Mandatory Authentication
**Domain:** Multi-tenant API security hardening
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

OpenCode v1.2 removes anonymous fallback and enforces mandatory API key authentication for all requests. This is a security hardening milestone that tightens multi-tenant isolation boundaries. All authentication infrastructure already exists from v1.0/v1.1 — this milestone simply changes middleware behavior to reject unauthenticated requests instead of allowing them through.

The recommended approach is minimal and surgical: add authentication middleware that rejects anonymous identity states, remove the anonymous fallback from UserContext, and ensure all session queries filter by user_id. No new stack components are needed. The entire implementation requires modifying ~20 lines of code across 3 files.

The key risk is orphaned data from anonymous sessions created before v1.2. Migration must happen before code deployment: either assign NULL user_id sessions to a system owner or delete them, then make user_id NOT NULL in the schema. Secondary risks include accidentally blocking health checks and internal routes, middleware ordering breaking authentication context, and forgetting to clean up anonymous code paths after enforcement is live.

## Key Findings

### Recommended Stack

**No new stack components needed.** All authentication infrastructure exists from v1.0/v1.1. This milestone removes anonymous fallback by changing middleware behavior and error responses.

**Core technologies:**

- Hono middleware chain — already handles CORS, logging, context setup; insert auth middleware after CORS
- UserContext ALS — already propagates identity through request lifecycle; remove anonymous fallback
- bcrypt API key verification — already implemented in resolve() function; middleware just needs to reject anonymous state
- SQLite with user_id foreign keys — already exists in SessionTable; queries need to filter by user_id

**Critical version requirements:** None. Existing dependencies sufficient.

### Expected Features

**Must have (table stakes):**

- 401 Unauthorized for missing/invalid API keys — HTTP standard, clients expect this
- WWW-Authenticate header in 401 responses — HTTP spec requirement
- Middleware-level enforcement — auth must happen before business logic
- Remove anonymous fallback from UserContext — security model requires all requests authenticated
- Consistent error response format — API clients expect structured error messages

**Should have (competitive):**

- Throttled logging for invalid keys — prevents log spam from brute force (already implemented, preserve it)
- Clear error messages distinguishing missing vs invalid — better DX (already distinguished in resolve())
- Graceful migration path documentation — helps existing deployments upgrade

**Defer (v2+):**

- Rate limiting per IP for failed auth — current throttled logging sufficient for v1.2
- Audit log for rejected attempts — security monitoring, not blocking for launch
- Webhook notifications for auth failures — overkill for initial release

### Architecture Approach

The architecture change is minimal: insert authentication middleware between CORS and WorkspaceContext setup. Middleware calls resolve() to validate API keys, rejects anonymous identity states with 401, and wraps downstream handlers in UserContext.provide(). All session queries add user_id filtering to enforce isolation. No new components, no schema changes beyond making user_id NOT NULL after migration.

**Major components:**

1. Auth middleware (NEW) — validates API key, rejects anonymous, provides UserContext
2. UserContext module (MODIFIED) — remove anonymous fallback, guarantee authenticated identity
3. Session queries (MODIFIED) — add user_id filters to list(), get(), createNext()

### Critical Pitfalls

1. **Orphaned sessions from anonymous users** — Existing sessions with user_id = NULL become inaccessible after mandatory auth. Prevention: migrate NULL sessions before deployment, make user_id NOT NULL in schema, deploy in sequence (migration → schema → code).

2. **Health check and internal routes blocked** — Health checks, metrics, admin routes fail with 401. Prevention: whitelist internal routes (/health, /metrics, /log), separate admin auth (OPENCODE_SERVER_PASSWORD) from user auth (API keys).

3. **Middleware ordering breaks authentication** — User auth runs in wrong position, causing UserContext.get() to return anonymous despite valid keys. Prevention: correct order is CORS → basicAuth → user auth → logging → workspace routing → instance setup.

4. **Missing 401 response for invalid keys** — Requests with invalid keys receive 200 OK with empty data instead of 401. Prevention: fail fast in middleware, return 401 immediately for anonymous state (except whitelisted routes).

5. **Forgotten anonymous code paths** — Code still handles anonymous users even after mandatory auth. Prevention: remove Anonymous from Identity union, delete anonymous tests, simplify UserContext.get() to throw if not authenticated, grep for "anonymous" and remove handling code.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Migration & Schema Hardening

**Rationale:** Must happen before code changes to prevent orphaned data. Database state must be clean before enforcement begins.
**Delivers:** All sessions have valid user_id, schema enforces NOT NULL constraint
**Addresses:** Orphaned sessions pitfall (critical)
**Avoids:** Data loss, inaccessible sessions, production rollback

**Tasks:**

- Write migration script to handle NULL user_id sessions (assign to system user or delete)
- Alter SessionTable.user_id to NOT NULL
- Verify no orphaned data in production before proceeding

**Research flag:** Standard pattern (database migration), no additional research needed.

### Phase 2: Middleware Implementation & Route Exemptions

**Rationale:** Core enforcement logic. Must handle both user authentication and internal route exemptions to avoid breaking infrastructure.
**Delivers:** Mandatory authentication enforced, health checks still work, admin routes use separate auth
**Addresses:** Missing 401 responses, health check blocking, middleware ordering, auth/admin boundary blur
**Uses:** Hono middleware, resolve() function, UserContext ALS
**Implements:** Auth middleware component

**Tasks:**

- Add auth middleware after CORS in server.ts
- Whitelist internal routes (/health, /metrics, /ready, /log)
- Preserve admin auth (OPENCODE_SERVER_PASSWORD) separate from user auth
- Return 401 with WWW-Authenticate header for anonymous state
- Integration test covering full middleware stack

**Research flag:** Standard pattern (middleware insertion), no additional research needed.

### Phase 3: Cleanup & Type System Hardening

**Rationale:** Remove dead code and tighten type system after enforcement is live. Prevents future regressions.
**Delivers:** No anonymous code paths, simplified type system, cleaner codebase
**Addresses:** Forgotten anonymous code paths, usage attribution drift, accounting integrity
**Avoids:** Security holes from dead code, confusion from unreachable paths

**Tasks:**

- Remove Anonymous from Identity union type
- Delete anonymous tests in user-context.test.ts
- Remove fallback logic from UserContext.get()
- Grep for "anonymous" and remove handling code
- Update resolve() to throw instead of returning anonymous state
- Add user_id filters to all session queries (list, listGlobal, get, createNext)

**Research flag:** Standard pattern (code cleanup), no additional research needed.

### Phase Ordering Rationale

- **Phase 1 first:** Database migration must happen before code deployment. Deploying enforcement with NULL user_id rows causes data loss.
- **Phase 2 second:** Middleware enforcement is the core change. Must handle route exemptions to avoid breaking infrastructure.
- **Phase 3 last:** Cleanup happens after enforcement is validated. Removing anonymous types before middleware is live would break compilation.

**Dependency chain:** Migration → Schema → Middleware → Cleanup. Each phase depends on the previous completing successfully.

### Research Flags

Phases with standard patterns (skip research-phase):

- **Phase 1:** Database migration — well-documented pattern, existing migration infrastructure
- **Phase 2:** Middleware insertion — Hono middleware pattern already used in codebase
- **Phase 3:** Code cleanup — straightforward refactoring, no external dependencies

**No phases need additional research.** All patterns are standard, infrastructure exists, and implementation is surgical.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                |
| ------------ | ---------- | ------------------------------------------------------------------------------------ |
| Stack        | HIGH       | Direct codebase inspection, all infrastructure exists                                |
| Features     | HIGH       | HTTP standards well-documented, existing resolve() function validated                |
| Architecture | HIGH       | Middleware chain analyzed, integration points identified                             |
| Pitfalls     | HIGH       | OWASP guidance, brownfield migration patterns, webhook consistency issues documented |

**Overall confidence:** HIGH

### Gaps to Address

- **Performance at scale:** API key verification uses bcrypt + table scan. Acceptable for <100 users, may need caching at 1k+ users. Monitor performance after deployment, add in-memory cache with TTL if needed.

- **Migration strategy for production:** Research assumes ability to run migration before code deployment. Validate deployment sequence with ops team: can we run migration, verify success, then deploy code? Or do we need blue-green deployment?

- **Health check route inventory:** Research identified /health, /metrics, /ready, /log as internal routes. Verify complete list of infrastructure endpoints that should bypass user auth during Phase 2 implementation.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — src/user/user-context.ts, src/server/user-auth.ts, src/user/user.sql.ts, src/server/server.ts, src/session/index.ts
- Migration files — 20260317110427_add_session_user_id, 20260317144535_identity_foundation
- .planning/PROJECT.md — Requirements and v1.2 milestone goals
- MDN HTTP 401 Unauthorized — https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
- MDN HTTP 403 Forbidden — https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403

### Secondary (MEDIUM confidence)

- OWASP Authorization Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP API Security Top 10 2023, API1 Broken Object Level Authorization — https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP Multi-Tenant Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- SQLite Foreign Key Support — https://www.sqlite.org/foreignkeys.html
- Clerk webhook sync documentation — https://clerk.com/docs/webhooks/sync-data

---

_Research completed: 2026-03-18_
_Ready for roadmap: yes_
