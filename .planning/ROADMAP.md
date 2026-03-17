# Roadmap: OpenCode Multi-User Isolation

**Created:** 2026-03-17  
**Granularity:** Standard (4 phases)  
**Coverage:** 27/27 v1 requirements mapped

## Phases

- [ ] **Phase 1: Identity Foundation** - UserContext ALS + API key authentication
- [ ] **Phase 2: Session Ownership** - user_id on sessions, filtered queries, anonymous fallback
- [ ] **Phase 3: User Management API** - CRUD endpoints + usage stats
- [ ] **Phase 4: Resource Protection** - Quotas, model allowlist, usage tracking

## Phase Details

### Phase 1: Identity Foundation

**Goal**: Users can authenticate with API keys and their identity propagates through the request pipeline  
**Depends on**: Nothing (first phase)  
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04  
**Success Criteria** (what must be TRUE):

1. A request with a valid `x-opencode-api-key` header is accepted and the user identity is available throughout the request
2. A request with an invalid or missing API key falls back to anonymous mode without error
3. API keys are never stored in plaintext — only hashes exist in the database
4. UserContext is accessible via ALS anywhere in the call stack, mirroring how Instance works
   **Plans**: TBD

### Phase 2: Session Ownership

**Goal**: Every session belongs to a user and cross-user data access is impossible  
**Depends on**: Phase 1  
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06  
**Success Criteria** (what must be TRUE):

1. User A cannot list, read, fork, or delete sessions belonging to User B
2. New sessions created by an authenticated user are automatically tagged with that user's id
3. Forked sessions inherit the parent session's owner — not the requesting user
4. Anonymous requests (no API key) see only sessions with no owner (user_id IS NULL)
5. Existing deployments with no API key configured continue to work without migration
   **Plans**: TBD

### Phase 3: User Management API

**Goal**: Admins can create and manage users, issue API keys, and inspect usage  
**Depends on**: Phase 1  
**Requirements**: USER-01, USER-02, USER-03, USER-04, USER-05, USER-06  
**Success Criteria** (what must be TRUE):

1. Admin can create a user and receive a plaintext API key exactly once — subsequent reads never expose it
2. Admin can update a user's quota settings via PATCH and changes take effect on the next request
3. Admin can delete a user — their sessions are orphaned (user_id set to NULL), not deleted
4. Admin can retrieve per-user token consumption stats aggregated by date
   **Plans**: TBD

### Phase 4: Resource Protection

**Goal**: Users cannot exceed their allocated resources and can only access permitted models  
**Depends on**: Phase 2, Phase 3  
**Requirements**: QUOTA-01, QUOTA-02, QUOTA-03, QUOTA-04, MODEL-01, MODEL-02, MODEL-03, USAGE-01, USAGE-02, USAGE-03, USAGE-04  
**Success Criteria** (what must be TRUE):

1. A user who has exhausted their agent call quota receives a clear error — the request is rejected, not silently dropped
2. A user cannot open more concurrent sessions than their limit allows
3. A user who has hit their daily token cap cannot start new LLM calls until the cap resets
4. A user attempting to use a model not on their allowlist receives an error listing the permitted models
5. Token consumption is recorded per session after each LLM call completes, and is visible via the usage API
   **Plans**: TBD

## Progress

| Phase                  | Plans Complete | Status      | Completed |
| ---------------------- | -------------- | ----------- | --------- |
| 1. Identity Foundation | 0/?            | Not started | -         |
| 2. Session Ownership   | 0/?            | Not started | -         |
| 3. User Management API | 0/?            | Not started | -         |
| 4. Resource Protection | 0/?            | Not started | -         |

---

_Roadmap created: 2026-03-17_
