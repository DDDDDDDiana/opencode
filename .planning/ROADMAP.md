# Roadmap: OpenCode Multi-User Isolation

## Milestones

- ✅ `v1.0` - OpenCode Multi-User Isolation shipped 2026-03-18; archive: `.planning/milestones/v1.0-ROADMAP.md`
- ✅ `v1.1` - Isolation Boundary Tightening shipped 2026-03-18; archive: `.planning/milestones/v1.1-ROADMAP.md`

## Phases

<details>
<summary>✅ v1.0 OpenCode Multi-User Isolation (Phases 1-4) — SHIPPED 2026-03-18</summary>

- [x] Phase 1: Identity Foundation (2 plans) — completed 2026-03-18
- [x] Phase 2: Session Ownership (6 plans) — completed 2026-03-18
- [x] Phase 3: User Management API (5 plans) — completed 2026-03-18
- [x] Phase 4: Resource Protection (5 plans) — completed 2026-03-18

</details>

<details>
<summary>✅ v1.1 Isolation Boundary Tightening (Phases 5-7) — SHIPPED 2026-03-18</summary>

- [x] Phase 5: Session-Derived Ownership Closure (2 plans) — completed 2026-03-18
- [x] Phase 6: Service Boundary and Accounting Preservation (2 plans) — completed 2026-03-18
- [x] Phase 7: Validation Evidence Restoration (2 plans) — completed 2026-03-18

</details>

### 🚧 v1.2 禁止匿名模式 (Phases 8-10) — IN PROGRESS

- [ ] **Phase 8: Data Migration** - Prepare database for mandatory authentication
- [x] **Phase 9: Authentication Enforcement** - Reject unauthenticated requests (completed 2026-03-18)
- [x] **Phase 10: Code Cleanup** - Remove anonymous code paths (completed 2026-03-18)

## Phase Details

### Phase 8: Data Migration

**Goal**: All sessions have valid user_id, schema enforces NOT NULL constraint
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: MIGR-01, MIGR-02
**Success Criteria** (what must be TRUE):

1. User can query all existing sessions without encountering NULL user_id
2. Database schema rejects attempts to create sessions without user_id
3. Migration completes without data loss or orphaned sessions

**Plans**: 1 plan

Plans:

- [ ] 08-01-PLAN.md — Update SessionTable schema and generate migration for NOT NULL constraint

### Phase 9: Authentication Enforcement

**Goal**: All requests require valid API key, admin auth preserved separately
**Depends on**: Phase 8
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):

1. User receives 401 Unauthorized when sending request without API key
2. User receives 401 Unauthorized when sending request with invalid API key
3. User with valid API key can access their sessions normally
4. Admin can authenticate with OPENCODE_SERVER_PASSWORD independently of user API keys

**Plans**: 1 plan

Plans:

- [ ] 09-01-PLAN.md — Add user authentication middleware to server.ts

### Phase 10: Code Cleanup

**Goal**: Anonymous code paths removed, type system hardened
**Depends on**: Phase 9
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):

1. TypeScript compiler rejects code attempting to handle anonymous identity
2. Codebase contains no references to anonymous fallback logic

**Plans**: 1 plan

Plans:

- [ ] 10-01-PLAN.md — Remove Anonymous type and cleanup fallback logic

## Progress

| Phase                         | Plans Complete | Status      | Completed  |
| ----------------------------- | -------------- | ----------- | ---------- |
| 8. Data Migration             | 0/0            | Not started | -          |
| 9. Authentication Enforcement | 1/1            | Complete    | 2026-03-18 |
| 10. Code Cleanup              | 1/1 | Complete    | 2026-03-18 |

---

_For archived milestone details, see `.planning/milestones/`_
