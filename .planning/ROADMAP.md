# Roadmap: OpenCode Multi-User Isolation

## Milestones

- ✅ `v1.0` - OpenCode Multi-User Isolation shipped 2026-03-18; archive: `.planning/milestones/v1.0-ROADMAP.md`
- 🚧 `v1.1` - Isolation Boundary Tightening

## Summary

`v1.1` tightens the shipped isolation service around four scoped outcomes: end-to-end ownership enforcement on session-derived resources, preserved per-user usage accounting, explicit removal of registration responsibility from this service, and restored validation evidence.

## Phases

- [x] **Phase 5: Session-Derived Ownership Closure** - Close the remaining message and part ownership gap through one shared session-root guard.
- [x] **Phase 6: Service Boundary and Accounting Preservation** - Keep registration outside this service while preserving the local user projection, usage totals, and quota enforcement. (completed 2026-03-18)
- [ ] **Phase 7: Validation Evidence Restoration** - Restore milestone proof that ownership enforcement and retained accounting both work in `v1.1`.

## Progress

| Phase                                           | Plans Complete | Status      | Completed  |
| ----------------------------------------------- | -------------- | ----------- | ---------- |
| 5. Session-Derived Ownership Closure            | 2/2            | Complete    | 2026-03-18 |
| 6. Service Boundary and Accounting Preservation | 2/2 | Complete   | 2026-03-18 |
| 7. Validation Evidence Restoration              | 0/TBD          | Not started | -          |

## Phase Details

### Phase 5: Session-Derived Ownership Closure

**Goal**: Users can only reach messages and parts through session ownership checks, so session isolation holds end-to-end.
**Depends on**: Nothing (first phase in `v1.1`)
**Requirements**: SESS-07, SESS-08, SESS-09
**Success Criteria** (what must be TRUE):

1. A user can read messages only when the parent session belongs to that user.
2. A user can read parts only when the parent session belongs to that user.
3. Session-derived routes consistently deny cross-user access before protected message or part data is loaded.
4. Session-derived reads continue to behave correctly for legacy anonymous ownership cases without exposing another user's data.

**Plans**: 2 plans

Plans:

- [x] `05-01-PLAN.md` — Add one shared session-root ownership guard to all session-derived message read routes.
- [x] `05-02-PLAN.md` — Extend the shared guard to message/part mutations and add ownership regressions.

### Phase 6: Service Boundary and Accounting Preservation

**Goal**: The service stays focused on isolation and quota enforcement while registration moves outside it.
**Depends on**: Phase 5
**Requirements**: BNDR-01, BNDR-02, USAGE-05, USAGE-06
**Success Criteria** (what must be TRUE):

1. An admin can manage the local user projection needed for isolation and quotas without using signup or onboarding flows from this service.
2. Service API docs and planning artifacts make it clear that registration is owned by the frontend and another service.
3. Per-user token and usage totals continue to accrue to the correct user after the boundary cleanup.
4. Quota enforcement still uses persisted per-user usage totals to block over-limit work after the boundary cleanup.

**Plans**: 2 plans

Plans:

- [ ] `06-01-PLAN.md` — Update API docs and README to clarify admin provisioning boundary.
- [ ] `06-02-PLAN.md` — Add usage accounting regression tests to verify preservation.

### Phase 7: Validation Evidence Restoration

**Goal**: Maintainers can review clear archived proof that `v1.1` closed the scoped isolation gaps without regressing accounting.
**Depends on**: Phase 5, Phase 6
**Requirements**: EVID-01
**Success Criteria** (what must be TRUE):

1. A maintainer can open archived validation artifacts that show owned message and part reads succeed while cross-user reads are denied.
2. A maintainer can review archived validation artifacts showing per-user usage accounting and quota enforcement still work in `v1.1`.
3. The milestone archive clearly points to the validation evidence needed to verify the shipped `v1.1` claims.

**Plans**: TBD
