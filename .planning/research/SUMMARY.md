# Project Research Summary

**Project:** OpenCode Multi-User Isolation  
**Domain:** Brownfield multi-user isolation and usage-accounting service boundary tightening  
**Researched:** 2026-03-18  
**Confidence:** HIGH

## Executive Summary

`v1.1` is not a net-new auth or user-management build. It is a brownfield hardening milestone for an existing OpenCode service that should remain focused on three things: proving caller identity inside this service, enforcing ownership across all session-derived resources, and preserving per-user token and quota accounting. Experts build this kind of product by keeping request auth and ownership checks close to the resource graph, keeping lifecycle state minimal and local, and pushing signup/onboarding out to a dedicated frontend or identity owner.

The recommended approach is to keep the current Bun + TypeScript + Effect + Hono + Drizzle + SQLite stack stable and tighten enforcement at the seams. Session ownership remains the root policy. Messages and parts must never authorize independently; every derived-resource route should prove access to the parent session first, then proceed. User records should shrink to a local enforcement projection only: immutable IDs, status/tombstone state, quotas, allowlists, and timestamps. Usage recording, quota checks, API key auth, and AsyncLocalStorage context propagation should stay in this service.

The main risks are boundary drift and false confidence. The service can look isolated while message/part routes still leak across users, anonymous compatibility can accidentally become a bypass, and deleted users can keep readable usage paths if lifecycle state is not modeled consistently. Mitigation is opinionated: centralize `Session.require(sessionID)`, tombstone instead of orphaning ownership, gate all user-facing usage reads on active lifecycle state, and remove signup/onboarding semantics from the API surface and docs at the same time the backend hardening ships.

## Key Findings

### Recommended Stack

Research strongly favors a tightening-in-place strategy. The current runtime, middleware, ORM, and SQLite setup already fit the milestone. The important changes are schema constraints, ownership middleware, and lifecycle state handling, not framework replacement.

**Core technologies:**

- **Bun 1.3.10**: runtime, SQLite access, crypto — keep stable; foreign-key enforcement already matters to isolation integrity.
- **TypeScript 5.8.2 + Effect 4.0.0-beta.31**: typed service boundaries and request context — keep stable; add ownership helpers within existing service patterns.
- **Hono 4.10.7 + hono-openapi 1.1.2**: request boundary and typed middleware — keep stable; add reusable ownership guards for session-derived routes.
- **Drizzle ORM + SQLite 1.0.0-beta.16-ea816b6**: schema constraints, migrations, indexes, foreign keys — keep stable; tighten integrity and add lifecycle/accounting constraints.
- **Zod 4.1.8**: narrow external lifecycle payload validation — add only for bounded provisioning/sync payloads.
- **bcrypt (existing)**: API key verification — keep as-is for this milestone; do not expand auth scope.

**Critical stack changes:**

- Add an ownership-guard layer, not a new auth framework.
- Add `user.status` or `time_deleted`, `user.external_id`, and `api_key.time_revoked`.
- Add `usage.user_id -> user.id` foreign key and indexes that match real ownership/accounting queries.
- Tighten `message`/`part` integrity so cross-session mismatches become impossible.

**What should remain stable:** Bun runtime, Hono request pipeline order, `UserContext` ALS, API key auth model, `SessionTable.user_id` as ownership anchor, usage recording path, quota/model allowlist enforcement.

**What should change:** route-level ownership coverage, delete/deactivate semantics, usage endpoint lifecycle gating, user schema shape, and public user API scope.

### Expected Features

`v1.1` should behave like a policy-enforcement and accounting service, not a user-lifecycle product.

**Must have (table stakes):**

- End-to-end ownership enforcement on session-derived resources.
- Authenticated user context bound early in request handling.
- Active/disabled/deleted user gating.
- Per-user usage/token ledger preservation.
- Hard quota enforcement.
- Ownership-safe anonymous compatibility for legacy deployments.
- Validation and audit evidence restoration.

**Should have (competitive/admin ergonomics):**

- Admin-safe disable/revoke flows.
- Usage breakdowns or exports by model/session/time window.
- Cross-route isolation violation telemetry.
- Scoped API key rotation / multiple keys per user.

**Defer (v1.1.x or v2+):**

- Quota threshold warnings.
- Rich role/policy systems.
- Enterprise provisioning workflows inside this service.
- External billing/invoicing.
- Any self-service signup, onboarding, invite, recovery, or profile-management UX.

**Boundary call:** registration, signup, onboarding, password/email/MFA flows, and non-isolation profile management should move out and stay out.

### Architecture Approach

Architecture research converges on one central rule: sessions remain the ownership root. The existing request pipeline is already structurally correct — basic auth, API key resolution, `UserContext`, workspace, and instance contexts — so the milestone should preserve that order and push enforcement deeper. Add a shared `Session.require(sessionID)` helper, call it from session/message/part routes, and backstop it inside lower-level helpers like `message-v2` and session mutation functions.

**Major components:**

1. **Request boundary (`server/server.ts`, `user-auth.ts`)** — keep middleware order stable, resolve API key to active local user, reject deleted/deactivated identities.
2. **User domain (`user/*`)** — store minimal local projection for status, quotas, allowlists, external ID, and tombstone state; support upsert/deactivate rather than registration UX.
3. **Session domain (`session/*`)** — remain canonical ownership root via `Session.require(sessionID)` / shared access helper.
4. **Message/part handlers (`server/routes/session.ts`, `session/message-v2.ts`)** — treat derived resources as session-scoped only; never authorize independently.
5. **Usage domain (`user/usage.ts`, `session/processor.ts`)** — keep append-only per-user accounting and gate public reads by lifecycle state.
6. **External lifecycle boundary** — accept bounded sync/admin inputs for provision/update/deactivate only.

### Critical Pitfalls

1. **Ownership checks stop at sessions** — fix by requiring every message/part/fork/share path to resolve back through the parent session and current user.
2. **Anonymous compatibility becomes a bypass** — make no-auth behavior explicit and deployment-aware; do not let `user_id IS NULL` become accidental public access.
3. **Deleted users become dangling readable identities** — tombstone users, revoke keys, preserve ownership/accounting rows, and fail closed on `/user/:id/usage`.
4. **This service regrows into a registration system** — remove self-service lifecycle semantics and keep only bounded sync/admin controls required for isolation safety.
5. **External identity sync is treated as strongly consistent** — design sync as idempotent and replay-safe; key on immutable upstream IDs only.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Ownership Closure on Session-Derived Resources

**Rationale:** This is the core accepted gap from `v1.0`, and every other milestone claim depends on it being true end-to-end.
**Delivers:** Shared `Session.require(sessionID)` guard, route hardening for message/part/prompt paths, defense-in-depth in `message-v2` and session mutation helpers, negative authorization test matrix, restored validation evidence.
**Addresses:** End-to-end ownership enforcement, authenticated user context reuse, audit-quality authorization evidence.
**Avoids:** Ownership gaps on derived resources; anonymous fallback becoming an accidental bypass.
**Research flag:** Standard pattern — skip extra research unless a specific route graph proves unusual.

### Phase 2: Lifecycle Boundary Hardening

**Rationale:** Once ownership is correct, the next risk is bad identity state: deleted users, over-broad user CRUD, and fuzzy admin vs user boundaries.
**Delivers:** Tombstoned users or `time_deleted`, revoked keys, `User.getActive(userID)`, bounded provision/update/deactivate surface, removal of registration semantics, user-facing usage endpoints that fail closed for deleted/unknown users.
**Addresses:** Active/deleted/suspended user gating, admin-safe disable/revoke flows, boundary cleanup around registration ownership.
**Avoids:** Dangling deleted-user access, registration scope creep, admin/user boundary blur, orphaned sessions.
**Research flag:** Needs targeted phase research for upstream sync contract, admin authorization shape, and eventual-consistency handling.

### Phase 3: Accounting Integrity and Query Tightening

**Rationale:** Usage and quota correctness only matter once identity and ownership are trustworthy.
**Delivers:** `usage.user_id` referential integrity, preserved append-only accounting, lifecycle-aware usage/report predicates, shared accounting predicates, indexes for ownership and reporting paths, reconciliation tests.
**Addresses:** Per-user usage/token ledger, hard quota enforcement, scoped usage reporting/export foundations.
**Avoids:** Usage attribution drift, reporting vs enforcement drift, performance regression from unindexed ownership/accounting queries.
**Research flag:** Needs targeted research if reporting semantics for active vs deleted users become product-sensitive.

### Phase 4: Optional Admin Observability and Ergonomics

**Rationale:** Only add this after correctness, boundaries, and accounting are stable.
**Delivers:** Isolation violation telemetry, usage breakdowns/exports, scoped key rotation improvements, quota warnings if needed.
**Addresses:** Differentiators and admin ergonomics without reopening scope.
**Avoids:** Shipping nice-to-haves before trustworthiness is established.
**Research flag:** Standard patterns for telemetry/export; skip unless a specific external integration is introduced.

### Phase Ordering Rationale

- Ownership comes first because lifecycle and accounting logic are meaningless if derived resources still bypass the session root.
- Lifecycle hardening comes before accounting cleanup because tombstone and revocation rules define what “valid subject” means.
- Accounting integrity comes after lifecycle semantics so enforcement and reporting can share one canonical subject model.
- Optional admin ergonomics should stay last to avoid brownfield churn and boundary drift during a corrective milestone.
- Architecture suggests grouping by enforcement layer: ingress/auth reuse → ownership root → lifecycle state → accounting/reporting → optional ops visibility.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2:** upstream lifecycle sync contract, idempotency, replay/out-of-order handling, and admin/service-to-service auth boundary.
- **Phase 3:** exact reporting semantics for deleted users, reconciliation rules, and whether historical/internal audit access needs a separate surface.

Phases with standard patterns (skip research-phase):

- **Phase 1:** centralized object-ownership enforcement and deny-by-default authorization are well-established patterns.
- **Phase 4:** telemetry, exports, and key-rotation ergonomics are optional extensions with established implementation patterns.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                    |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Based on existing codebase fit plus official Hono, Drizzle, SQLite, and Zod guidance; the recommendation is mostly “tighten in place.”   |
| Features     | HIGH       | Strongly anchored in `PROJECT.md`, OWASP guidance, and explicit milestone boundary decisions.                                            |
| Architecture | HIGH       | Grounded in current OpenCode middleware, ALS, session, user, and usage code paths; recommendations are incremental and brownfield-aware. |
| Pitfalls     | HIGH       | Backed by OWASP authorization guidance, SQLite lifecycle constraints, webhook consistency realities, and known brownfield failure modes. |

**Overall confidence:** HIGH

### Gaps to Address

- **Anonymous legacy policy:** decide whether legacy null-owned rows remain visible by default or only under explicit deployment mode; document and test migration semantics.
- **Deleted-user reporting model:** decide whether internal audit access needs a separate admin-only endpoint while public/user-facing usage routes fail closed.
- **Upstream sync contract:** define whether this service receives admin calls, signed webhooks, or both, and how duplicate/out-of-order events are handled.
- **Message/part integrity shape:** validate the exact Drizzle/SQLite schema design for tying `part` to the correct `message` and `session` path without unnecessary denormalization.
- **Route inventory cleanup:** confirm all signup/onboarding semantics are removed from routes, docs, and any dependent frontend affordances.

## Sources

### Primary (HIGH confidence)

- OpenCode project context: `.planning/PROJECT.md` — milestone scope, constraints, out-of-scope decisions.
- Existing OpenCode code paths: `packages/opencode/src/server/server.ts`, `server/user-auth.ts`, `server/routes/session.ts`, `server/routes/user.ts`, `session/index.ts`, `session/message-v2.ts`, `session/processor.ts`, `user/index.ts`, `user/user.sql.ts`, `user/usage.ts`, `storage/db.ts`.
- Hono docs — middleware, request context, and typed guards: https://hono.dev/docs/guides/middleware and https://hono.dev/docs/api/context
- Drizzle docs — SQLite indexes, constraints, foreign keys: https://orm.drizzle.team/docs/indexes-constraints
- SQLite foreign key docs — connection enforcement and child-key indexing: https://www.sqlite.org/foreignkeys.html
- OWASP Authorization Cheat Sheet — deny-by-default and object-level authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP API Security Top 10, API1 BOLA — per-object checks for all client-supplied IDs: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP Multi-Tenant Security Cheat Sheet — tenant context propagation and offboarding patterns: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html

### Secondary (MEDIUM confidence)

- AWS SaaS Lens, Tenant Isolation — isolation as foundational shared-infra concern: https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html
- WorkOS AuthKit overview — common split between identity lifecycle UX and product-service authz: https://workos.com/docs/user-management/overview
- WorkOS Directory Sync overview — upstream provisioning/deprovisioning as separate concern: https://workos.com/docs/directory-sync/overview
- Clerk webhook sync guidance — eventual consistency and retry/replay expectations: https://clerk.com/docs/webhooks/sync-data

### Tertiary (LOW confidence)

- None. Remaining uncertainty is about local product decisions, not weak external sourcing.

---

_Research completed: 2026-03-18_
_Ready for roadmap: yes_
