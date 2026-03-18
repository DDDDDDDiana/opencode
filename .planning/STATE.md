---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: 禁止匿名模式
current_phase: 9 - Authentication Enforcement
current_plan: 01
status: in_progress
last_updated: "2026-03-18T06:38:00.000Z"
last_activity: 2026-03-18 — Completed Phase 09 Plan 01
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State: OpenCode Multi-User Isolation v1.2

**Last Updated:** 2026-03-18  
**Current Phase:** 9 - Authentication Enforcement
**Current Plan:** 01

## Project Reference

**Core Value:** Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

**Current Focus:** v1.2 — Require API key authentication for all requests, remove anonymous fallback

## Current Position

**Phase:** 9 - Authentication Enforcement  
**Plan:** 01  
**Status:** Phase 09 Plan 01 complete
**Progress:** [██████████] 100%
**Last activity:** 2026-03-18 — Completed Phase 09 Plan 01 - User authentication middleware

## Accumulated Context

### Key Decisions

| Decision                                           | Rationale                                                 | Date       |
| -------------------------------------------------- | --------------------------------------------------------- | ---------- |
| API key auth (not JWT)                             | Simpler, sufficient for service mode                      | 2026-03-17 |
| Hard quota rejection (not soft downgrade)          | Predictable behavior, easier to reason about              | 2026-03-17 |
| Parallel UserContext ALS (not extending Instance)  | Keeps Instance clean, follows WorkspaceContext pattern    | 2026-03-17 |
| user_id nullable on SessionTable                   | Backward compatible with existing deployments             | 2026-03-17 |
| Use UserContext.get() not .use() in sessions       | Avoid throwing when context missing, handle anonymous     | 2026-03-17 |
| Filter list() by user_id in all cases              | Enforce isolation at query level, prevent cross-user      | 2026-03-17 |
| get() returns 404 for unauthorized access          | Indistinguishable from not found, prevents enumeration    | 2026-03-17 |
| remove() uses SQL WHERE for ownership              | Prevents cross-user deletion at query level               | 2026-03-17 |
| fork() inherits parent user_id via param           | Guarantees ownership inheritance regardless of caller     | 2026-03-17 |
| z.custom<UserID>() for branded type in zod schema  | Avoids unsafe cast, preserves type safety                 | 2026-03-17 |
| JSON.stringify/parse for model_allowlist           | SQLite has no array type, JSON string is idiomatic        | 2026-03-17 |
| User.update() conditional spread for partial patch | Only set provided fields; null is valid to clear quota    | 2026-03-17 |
| User.remove() orphans sessions before delete       | Avoids FK constraint issues, preserves session history    | 2026-03-17 |
| Usage.record() is synchronous (no async)           | Database.use() is sync, no await needed                   | 2026-03-17 |
| stats() sorts in JS not SQL                        | Simpler, result sets are small per user                   | 2026-03-17 |
| Mount /user before Instance middleware             | User endpoints need no directory context                  | 2026-03-17 |
| NotFoundError auto-maps to 404 in onError handler  | No manual catch needed in route handlers                  | 2026-03-17 |
| Ship `v1.0` with documented audit gaps             | Archive shipped work and track follow-up as tech debt     | 2026-03-18 |
| Keep registration outside this service in `v1.1`   | Preserve backend focus on isolation and accounting        | 2026-03-18 |
| Shared guard helper for all session-derived routes | Reuses Session.get() for consistent ownership enforcement | 2026-03-18 |
| Guard runs before message/part mutations           | Ensures unauthorized sessions never execute mutations     | 2026-03-18 |
| Use 'Admin:' prefix in user route descriptions     | Makes admin-facing nature explicit in OpenAPI docs        | 2026-03-18 |
| Position POST /user as provisioning                | Clarifies local projection vs registration responsibility | 2026-03-18 |
| Document registration as external in README        | Establishes clear service boundary for user lifecycle     | 2026-03-18 |
| Remove anonymous fallback in v1.2                  | Simplifies security model, enforces isolation             | 2026-03-18 |
| Migration before code deployment                   | Prevents orphaned data with NULL user_id                  | 2026-03-18 |
| Exempt routes use startsWith for subpath matching  | Supports /doc/openapi.json and similar subpaths           | 2026-03-18 |
| Auth middleware positioned after CORS              | Ensures CORS headers set before auth rejection            | 2026-03-18 |

### Active TODOs

- [x] Create migration script for NULL user_id sessions (Phase 8)
- [x] Alter SessionTable.user_id to NOT NULL (Phase 8)
- [x] Add auth middleware after CORS in server.ts (Phase 9)
- [ ] Remove Anonymous from Identity union (Phase 10)
- [ ] Delete anonymous tests and fallback logic (Phase 10)

### Known Blockers

None currently.

### Deferred Context

- Rate limiting per IP for failed auth attempts (v2)
- Audit log for rejected authentication attempts (v2)
- Webhook notifications for authentication failures (v2)
- In-memory cache for API key verification (v2)

### Recent Changes

- 2026-03-18: Completed Phase 09 Plan 01 - User authentication middleware enforces API key requirement
- 2026-03-18: Completed Phase 08 Plan 01 - Data migration for NULL user_id sessions
- 2026-03-18: Created v1.2 roadmap with 3 phases (8-10) covering 9 requirements
- 2026-03-18: v1.1 shipped (phases 5-7)
- 2026-03-18: Completed Phase 6 Plan 02 - Usage accounting preservation tests
- 2026-03-18: Completed Phase 6 Plan 01 - Service boundary and admin API clarity
- 2026-03-18: Completed Phase 5 Plan 02 - Message and part mutation ownership guard
- 2026-03-18: Completed Phase 5 Plan 01 - Session-derived message ownership guard
- 2026-03-18: Created `v1.1` roadmap with 3 phases starting at Phase 5 and mapped all 8 milestone requirements
- 2026-03-18: Archived `v1.0` milestone artifacts and recorded accepted audit gaps as tech debt
- 2026-03-17: Completed Phase 3 Plan 04 - UserRoutes (5 endpoints) created and mounted in server.ts
- 2026-03-17: Completed Phase 3 Plan 03 - UsageTable schema and Usage.record()/stats() implemented
- 2026-03-17: Completed Phase 3 Plan 02 - User.update() and User.remove() implemented, session orphaning on delete
- 2026-03-17: Completed Phase 3 Plan 01 - UserTable extended, User.create() and User.get() implemented
- 2026-03-17: Completed Phase 2 Plan 05 - remove() now propagates NotFoundError, SESS-06 satisfied
- 2026-03-17: Completed Phase 2 Plan 04 - Drizzle migration generated, zero type errors in session code
- 2026-03-17: Completed Phase 2 Plan 02 - Session get/remove/fork ownership enforcement
- 2026-03-17: Added user_id filtering to Session.get() and Session.remove()
- 2026-03-17: Fork now inherits parent user_id via createNext() parameter
- 2026-03-17: Completed Phase 2 Plan 01 - Session ownership schema and filtering
- 2026-03-17: Added user_id column to SessionTable with index
- 2026-03-17: Integrated UserContext into Session.create() and Session.list()
- 2026-03-17: Roadmap created with 4 phases covering 27 v1 requirements
- 2026-03-17: Captured Phase 1 implementation decisions in `.planning/phases/01-identity-foundation/01-CONTEXT.md`
- 2026-03-17: Planned Phase 1 in `.planning/phases/01-identity-foundation/02-PLAN.md` with 4 execution plans

## Session Continuity

**Next Action:** Execute Phase 10 to remove anonymous fallback logic and complete v1.2 milestone.

**Context for Next Session:**

- Phase 09 Plan 01 complete - authentication middleware enforcing API key requirement
- Phase 08 complete - all sessions have valid user_id, schema constraint enforced
- Final phase (10) removes anonymous fallback from Identity union and tests
- v1.2 milestone nearly complete - only cleanup phase remains
- All core security requirements (AUTH-01 through AUTH-04) satisfied

---

_State initialized: 2026-03-17_
