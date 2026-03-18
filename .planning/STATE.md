---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 6
current_plan: Not started
status: planning
last_updated: "2026-03-18T02:30:04.926Z"
last_activity: 2026-03-18 - Completed Phase 5 Plan 02 - Message and part mutation ownership guard
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State: OpenCode Multi-User Isolation

**Last Updated:** 2026-03-18  
**Current Phase:** 6
**Current Plan:** Not started

## Project Reference

**Core Value:** Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

**Current Focus:** `v1.1` is ready for planning around ownership closure, boundary cleanup, preserved accounting, and restored validation evidence

## Current Position

**Phase:** Phase 5 - Session-Derived Ownership Closure  
**Plan:** -  
**Status:** Ready to plan
**Last activity:** 2026-03-18 - Completed Phase 5 Plan 02 - Message and part mutation ownership guard

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

### Active TODOs

- [ ] Continue with Phase 6 and Phase 7 from `v1.1` roadmap
- [ ] Generate `v1.1` validation artifacts that prove ownership enforcement and retained accounting

### Known Blockers

- No phase `*-VALIDATION.md` files are present for `v1.0`

### Deferred Context

- Deleted-user usage fail-closed remains out of scope for `v1.1`; tracked in deferred requirements and not part of phases 5-7
- Upstream sync contract, disable/revoke flows, telemetry, exports, and signup/onboarding UX remain explicitly out of scope for this roadmap

### Recent Changes

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

**Next Action:** Run `/gsd-plan-phase 5`.

**Context for Next Session:**

- `v1.0` is archived and tagged after commit
- `v1.1` roadmap is in place with phases 5-7
- In-scope work is limited to ownership closure, preserved usage accounting, externalized registration responsibility, and validation evidence restoration
- Deleted-user fail-closed and other lifecycle hardening work remain deferred beyond this roadmap

---

_State initialized: 2026-03-17_
