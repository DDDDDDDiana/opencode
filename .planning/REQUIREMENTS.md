# Requirements: OpenCode Multi-User Isolation

**Defined:** 2026-03-17
**Core Value:** Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

## v1 Requirements

### User Identity

- [ ] **AUTH-01**: Server can authenticate requests via API key in `x-opencode-api-key` header
- [ ] **AUTH-02**: API keys are stored as bcrypt hashes, never plaintext
- [ ] **AUTH-03**: UserContext propagates through AsyncLocalStorage alongside Instance
- [ ] **AUTH-04**: Requests without API key fall back to anonymous mode (user_id = null)

### Session Ownership

- [x] **SESS-01**: SessionTable has nullable `user_id` column
- [x] **SESS-02**: Session.list() filters by user_id (or IS NULL for anonymous)
- [x] **SESS-03**: Session.get() enforces ownership check before returning
- [x] **SESS-04**: Session.create() assigns user_id from UserContext
- [x] **SESS-05**: Session.fork() preserves parent session's user_id
- [x] **SESS-06**: Session.remove() only allows deletion of owned sessions

### User Management

- [x] **USER-01**: UserTable stores id, name, api_key_hash, quotas, timestamps
- [x] **USER-02**: POST /user creates user and returns plaintext API key (once)
- [x] **USER-03**: GET /user/:id returns user info (excluding api_key_hash)
- [x] **USER-04**: PATCH /user/:id updates quota settings
- [x] **USER-05**: DELETE /user/:id removes user and orphans their sessions
- [x] **USER-06**: GET /user/:id/usage returns token consumption stats

### Quota Enforcement

- [x] **QUOTA-01**: Agent call limit enforced in session prompt loop
- [x] **QUOTA-02**: Concurrent session limit checked at Session.create()
- [x] **QUOTA-03**: Daily token cap checked before LLM.stream()
- [x] **QUOTA-04**: Quota exceeded returns clear error (not silent failure)

### Model Access Control

- [x] **MODEL-01**: User.model_allowlist stored as JSON string array
- [x] **MODEL-02**: Provider resolution checks allowlist before returning model
- [x] **MODEL-03**: Disallowed model returns clear error with allowed list

### Usage Tracking

- [x] **USAGE-01**: UsageTable records user_id, session_id, tokens, date
- [x] **USAGE-02**: Token counts extracted from LLM response metadata
- [x] **USAGE-03**: Usage written after each LLM.stream() completes
- [x] **USAGE-04**: GET /user/:id/usage aggregates by date

## v2 Requirements

### Advanced Quota

- **QUOTA-05**: Monthly token caps (not just daily)
- **QUOTA-06**: Per-model token limits
- **QUOTA-07**: Quota reset scheduling (cron-based)

### User Groups

- **GROUP-01**: Users belong to groups with shared quotas
- **GROUP-02**: Group-level model allowlists
- **GROUP-03**: Group admin role

### Audit Logging

- **AUDIT-01**: Log all user actions (session create/delete, quota changes)
- **AUDIT-02**: Audit log API endpoint

### Advanced Auth

- **AUTH-05**: API key expiration
- **AUTH-06**: API key scopes (read-only vs full access)
- **AUTH-07**: JWT support

## Out of Scope

| Feature                             | Reason                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| JWT authentication                  | API key sufficient for service mode; JWT adds complexity    |
| Soft quota limits (model downgrade) | Hard reject simpler and more predictable                    |
| External quota systems              | SQLite persistence sufficient; no billing integration       |
| UI for user management              | API only; admin tooling out of scope for v1                 |
| Per-user file system isolation      | Users share directory context; isolation at data layer only |
| OAuth/SSO                           | Service mode doesn't need social login                      |
| Rate limiting                       | Quota system covers resource protection                     |

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| AUTH-01     | Phase 1 | Pending  |
| AUTH-02     | Phase 1 | Pending  |
| AUTH-03     | Phase 1 | Pending  |
| AUTH-04     | Phase 1 | Pending  |
| SESS-01     | Phase 2 | Complete |
| SESS-02     | Phase 2 | Complete |
| SESS-03     | Phase 2 | Complete |
| SESS-04     | Phase 2 | Complete |
| SESS-05     | Phase 2 | Complete |
| SESS-06     | Phase 2 | Complete |
| USER-01     | Phase 3 | Complete |
| USER-02     | Phase 3 | Complete |
| USER-03     | Phase 3 | Complete |
| USER-04     | Phase 3 | Complete |
| USER-05     | Phase 3 | Complete |
| USER-06     | Phase 3 | Complete |
| QUOTA-01    | Phase 4 | Complete |
| QUOTA-02    | Phase 4 | Complete |
| QUOTA-03    | Phase 4 | Complete |
| QUOTA-04    | Phase 4 | Complete |
| MODEL-01    | Phase 4 | Complete |
| MODEL-02    | Phase 4 | Complete |
| MODEL-03    | Phase 4 | Complete |
| USAGE-01    | Phase 4 | Complete |
| USAGE-02    | Phase 4 | Complete |
| USAGE-03    | Phase 4 | Complete |
| USAGE-04    | Phase 4 | Complete |

**Coverage:**

- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-17_
_Last updated: 2026-03-17 after roadmap creation_
