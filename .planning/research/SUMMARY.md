# Project Research Summary

**Project:** OpenCode Multi-User Isolation  
**Domain:** Multi-tenant session isolation for AI coding assistant service  
**Researched:** 2026-03-17  
**Confidence:** HIGH

## Executive Summary

OpenCode is retrofitting multi-user isolation into an existing single-user service. The architecture already has the right primitives: AsyncLocalStorage for context propagation (Instance, WorkspaceContext), Drizzle ORM with SQLite for persistence, and Hono middleware chains. Adding user identity follows the established pattern — a parallel UserContext ALS that propagates user_id through the request pipeline, with row-level filtering on all session queries.

The recommended approach is row-level isolation with nullable user_id for backward compatibility. API key authentication via Hono's bearer-auth middleware resolves user identity, UserContext propagates it through ALS, and all session queries filter by user_id. Quotas are enforced inside the agent loop before each LLM call, not just at session creation. Usage tracking records token consumption per user for quota enforcement.

The critical risk is incomplete query filtering — missing user_id checks on any query path (get, fork, remove, children) creates cross-user data leakage. The mitigation is to gate at Session.get() so all callers inherit the ownership check, and test every exported function in session/index.ts for cross-user access. Secondary risks include ALS context loss in native callbacks (mirror Instance.bind for UserContext) and Bus events broadcasting across user boundaries (filter events by userID at subscriber).

## Key Findings

### Recommended Stack

The existing stack is sufficient — no new frameworks needed. Use Hono's built-in bearer-auth middleware with async verifyToken callback for API key lookup. Hash keys with node:crypto SHA-256 (not argon2/bcrypt — API keys are high-entropy random data, not passwords). UserContext follows the exact pattern as WorkspaceContext using the existing Context.create utility.

**Core technologies:**

- **Hono bearer-auth + createMiddleware**: Extract API key from Authorization header, resolve to user, set c.var.user — already in dep tree, type-safe Variables pattern
- **node:crypto SHA-256**: Hash API keys for storage — zero deps, correct algorithm for random tokens (not passwords), fast lookup
- **AsyncLocalStorage via Context.create**: UserContext propagation — mirrors existing Instance/WorkspaceContext pattern, no new dependencies
- **Drizzle ORM sqlite-core**: Add UserTable, ApiKeyTable, UsageTable; user_id FK on SessionTable — extend existing schema conventions

**What NOT to use:**

- JWT (out of scope per PROJECT.md — adds complexity with no benefit for service mode)
- argon2/bcrypt (native addons, wrong algorithm class for API keys)
- Drizzle RLS (Postgres-only; SQLite isolation is app-layer filtering)

### Expected Features

**Must have (table stakes):**

- Per-user API key authentication — core identity mechanism; without it no isolation exists
- Session ownership — user_id on SessionTable, all queries filtered by user
- User CRUD API — admins create/delete users and issue API keys
- Hard quota enforcement — check limits before agent loop; reject if exceeded
- Token usage tracking — record consumption per session; aggregate per user
- Concurrent session limits — prevent single user monopolizing resources
- Anonymous fallback — nullable user_id; backward compatible with no-auth deployments
- API key lifecycle — revocable without deleting user

**Should have (differentiators):**

- Per-user model allowlist — restrict expensive models per user; fine-grained cost control
- Daily/monthly token caps — predictable cost management with period resets
- Multiple API keys per user — key rotation without downtime
- Usage analytics API — visibility into consumption patterns

**Defer to v2:**

- Quota warning events (UX enhancement, not blocking)
- Rate limiting (abuse protection, can add later)
- Audit log (compliance feature, not core isolation)
- User groups/roles (complexity, defer until multi-team demand)
- OAuth/SSO integration (enterprise feature, overkill for self-hosted)

### Architecture Approach

Add a parallel UserContext ALS that runs alongside Instance and WorkspaceContext. Middleware order: basicAuth → userAuthMiddleware (NEW) → workspaceAndInstanceMiddleware (existing). Auth middleware extracts API key from header, resolves to user via hash lookup, populates UserContext. All session queries add user_id filter: if UserContext.userID exists, filter by eq(user_id, UserContext.userID); else filter by isNull(user_id) for anonymous access.

**Major components:**

1. **AuthMiddleware** — Extract API key from Authorization header, hash and lookup in ApiKeyTable, populate UserContext ALS
2. **UserContext** — Store/retrieve current user identity via AsyncLocalStorage; parallel to Instance, not nested inside it
3. **Session query filtering** — Centralized at Session.get(); all 6 query paths (list, listGlobal, children, get, fork, remove) inherit user_id check
4. **Quota enforcement** — Check limits inside SessionPrompt.loop() before each LLM call; atomic decrement to prevent TOCTOU races
5. **Usage tracking** — Record tokens_in/tokens_out per session to UsageTable; aggregate for quota checks

**Database changes:**

- New tables: UserTable, ApiKeyTable, UsageTable
- Modified: SessionTable gains nullable user_id column with index
- Isolation: Row-level filtering in application code (SQLite has no RLS)

### Critical Pitfalls

1. **ALS context lost in native callbacks** — UserContext.use() returns undefined inside @parcel/watcher or node-pty callbacks; quota enforcement silently bypasses. Mirror Instance.bind() for UserContext to capture and restore both contexts together.

2. **Missing user_id filter on non-list query paths** — user_id added to list() but not get(), fork(), remove(), children(). Any unfiltered path leaks cross-user data. Gate at Session.get() so all callers inherit the check; test all 6 exported functions.

3. **API keys stored in plaintext** — Database leak compromises all keys permanently. Store SHA-256(key) only; issue raw key once at creation; compare with timingSafeEqual to prevent timing attacks.

4. **Quota checked at entry, not in agent loop** — Check at session creation misses mid-run consumption. A user at 0 quota with an active session continues until current call completes. Check inside prompt.ts loop before each LLM call; use atomic UPDATE...WHERE remaining > 0 to prevent concurrent session races.

5. **Bus events broadcast across user boundaries** — Bus.publish fires on every session mutation; if Bus is global, all SSE/WebSocket clients receive all events regardless of ownership. Add userID to event payloads; filter at subscriber before forwarding to client.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Identity Foundation

**Rationale:** UserContext and API key auth are prerequisites for all isolation features. No dependencies — can start immediately.  
**Delivers:** User identity layer, API key authentication, UserContext ALS propagation  
**Addresses:** Per-user API key authentication (table stakes), API key lifecycle (table stakes)  
**Avoids:** Pitfall 3 (plaintext keys), Pitfall 6 (enterWith bleed), Pitfall 9 (timing enumeration)  
**Stack:** Hono bearer-auth, node:crypto SHA-256, Context.create utility  
**Estimated effort:** 6-8 hours

### Phase 2: Session Ownership

**Rationale:** Depends on Phase 1 (need user identity before assigning ownership). Core isolation — sessions must belong to users.  
**Delivers:** user_id on SessionTable, filtered queries, anonymous fallback  
**Addresses:** Session ownership (table stakes), Anonymous fallback (table stakes)  
**Avoids:** Pitfall 2 (missing filters), Pitfall 5 (Bus cross-user broadcast), Pitfall 7 (anonymous exposes legacy data), Pitfall 12 (share URL leak)  
**Stack:** Drizzle schema migration, session query filtering  
**Estimated effort:** 6-8 hours

### Phase 3: Resource Protection

**Rationale:** Depends on Phase 1 + 2 (need user identity and session ownership before enforcing limits). Makes isolation production-ready.  
**Delivers:** Token usage tracking, hard quota enforcement, concurrent session limits  
**Addresses:** Hard quota enforcement (table stakes), Token usage tracking (table stakes), Concurrent session limits (table stakes)  
**Avoids:** Pitfall 4 (quota at entry only), Pitfall 8 (sub-agent allowlist bypass), Pitfall 10 (usage lost on crash)  
**Stack:** UsageTable, quota checks in prompt loop  
**Estimated effort:** 8-10 hours

### Phase 4: Fine-Grained Control (Optional)

**Rationale:** Depends on Phase 3 (quota infrastructure must exist). Differentiators, not blockers.  
**Delivers:** Per-user model allowlist, daily/monthly token caps, multiple keys per user  
**Addresses:** Per-user model allowlist (differentiator), Daily/monthly token caps (differentiator), Multiple API keys per user (differentiator)  
**Stack:** JSON model allowlist validation, period-based quota resets  
**Estimated effort:** 4-6 hours

### Phase Ordering Rationale

- **Phase 1 first** because UserContext is a dependency for all other phases — no user identity means no ownership, no quotas, no tracking
- **Phase 2 before Phase 3** because quota enforcement requires knowing which sessions belong to which users — can't enforce limits without ownership
- **Phase 3 before Phase 4** because model allowlists and token caps are refinements of the base quota system — need usage tracking infrastructure first
- **Parallel work possible:** User CRUD API (Phase 1) and UsageTable schema (Phase 3) can be built independently after UserContext exists

Architecture research shows clear dependency graph: UserContext → Auth Middleware → Session Filtering → Quota Enforcement. This maps directly to Phase 1 → Phase 2 → Phase 3. Phase 4 is additive enhancements with no new architectural patterns.

### Research Flags

**Phases with standard patterns (skip research-phase):**

- **Phase 1:** API key auth is well-documented; Hono bearer-auth + SHA-256 hashing are established patterns
- **Phase 2:** Row-level filtering with tenant_id is standard multi-tenant practice; no novel patterns
- **Phase 4:** Model allowlist and token caps are straightforward extensions of Phase 3 quota system

**Phases needing validation during planning:**

- **Phase 3:** Quota enforcement in Effect-based agent loop needs integration testing — ARCHITECTURE.md notes "specific Effect integration points need phase-level research" (MEDIUM confidence)
- **Phase 2:** Bus event filtering pattern needs verification — existing Bus implementation may not support per-user scoping; may need subscriber-side filtering

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                    |
| ------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | All technologies already in use or built-in; Hono bearer-auth verified against 4.10.7 docs               |
| Features     | HIGH       | Derived from explicit PROJECT.md requirements and standard multi-tenant patterns                         |
| Architecture | HIGH       | Grounded in codebase analysis; ALS propagation verified in Node.js official docs; patterns already exist |
| Pitfalls     | HIGH       | Based on OWASP guidance, Node.js ALS troubleshooting docs, and direct codebase inspection                |

**Overall confidence:** HIGH

### Gaps to Address

- **Quota reset schedule:** Rolling 24h window vs daily midnight UTC vs monthly billing cycle — ARCHITECTURE.md recommends rolling 24h (simpler, fairer) but needs explicit decision during Phase 3 planning
- **User registration flow:** Admin CLI vs REST endpoint vs self-service — ARCHITECTURE.md recommends admin CLI for v1; needs implementation decision in Phase 1
- **Anonymous fallback policy:** Should unauthenticated requests see legacy sessions (user_id = NULL) or empty set? Security vs backward compatibility tradeoff — needs explicit decision during Phase 2 migration
- **Bus event scoping:** Filter at subscriber vs scope Bus instances per user — ARCHITECTURE.md recommends subscriber filtering but needs verification that existing Bus supports this pattern

## Sources

### Primary (HIGH confidence)

- OpenCode codebase analysis — Instance.ts, WorkspaceContext.ts, server.ts, session/index.ts, session.sql.ts, util/context.ts
- Node.js AsyncLocalStorage documentation — https://nodejs.org/api/async_context.html (context propagation, troubleshooting context loss)
- Hono 4.10.7 official docs — bearer-auth middleware, createMiddleware factory
- Drizzle 1.0.0-beta.16 docs — sqlite-core schema patterns, RLS limitations
- OWASP REST Security Cheat Sheet — API key handling, timing attacks

### Secondary (MEDIUM confidence)

- Multi-tenant SaaS architecture patterns — row-level filtering with tenant_id (industry standard, not source-specific)
- API key hashing best practices — SHA-256 for random tokens vs argon2/bcrypt for passwords (GitHub, Stripe patterns)

### Assumptions (needs validation)

- Drizzle nullable foreign keys with ON DELETE CASCADE — assumed based on standard SQL, should verify in Drizzle docs during Phase 2
- Hono middleware execution order is sequential — assumed based on Express-like behavior, should verify during Phase 1 implementation

---

**Research completed:** 2026-03-17  
**Ready for roadmap:** Yes  
**Total estimated effort:** 24-32 hours for complete multi-user isolation (Phases 1-3)
