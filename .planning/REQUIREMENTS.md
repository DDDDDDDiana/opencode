# Requirements: OpenCode Multi-User Isolation v1.2

**Defined:** 2026-03-18
**Core Value:** Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

## v1 Requirements

### Data Migration

- [ ] **MIGR-01**: Existing sessions with NULL user_id are migrated (assigned to system user or deleted)
- [ ] **MIGR-02**: SessionTable.user_id column altered to NOT NULL constraint

### Authentication Enforcement

- [x] **AUTH-01**: Middleware rejects requests without valid API key with 401 Unauthorized
- [x] **AUTH-02**: 401 responses include WWW-Authenticate header per HTTP spec
- [x] **AUTH-03**: Admin auth (OPENCODE_SERVER_PASSWORD/USERNAME) preserved separate from user API key auth
- [x] **AUTH-04**: Both authentication systems coexist without conflict

### Code Cleanup

- [x] **CLEAN-01**: Anonymous type removed from Identity union
- [x] **CLEAN-02**: Anonymous fallback logic removed from UserContext
- [x] **CLEAN-03**: Anonymous-related tests deleted

## v2 Requirements

### Performance

- **PERF-01**: In-memory cache for API key verification (bcrypt + table scan acceptable for <100 users)
- **PERF-02**: Rate limiting per IP for failed authentication attempts

### Observability

- **OBS-01**: Audit log for rejected authentication attempts
- **OBS-02**: Webhook notifications for authentication failures

### Infrastructure

- **INFRA-01**: Health check route inventory documented (/health, /metrics, /ready, /log)
- **INFRA-02**: Blue-green deployment strategy for migration + code deployment sequence

## Out of Scope

| Feature                            | Reason                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| Internal route whitelisting        | Research identified need but user selected minimal scope |
| WWW-Authenticate header            | HTTP spec requirement but user selected minimal scope    |
| user_id filters on session queries | Already implemented in v1.0/v1.1                         |
| Anonymous test deletion            | User selected only type removal                          |
| UserContext fallback removal       | User selected only type removal                          |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| MIGR-01     | 8     | Pending |
| MIGR-02     | 8     | Pending |
| AUTH-01     | 9     | Complete |
| AUTH-02     | 9     | Complete |
| AUTH-03     | 9     | Complete |
| AUTH-04     | 9     | Complete |
| CLEAN-01    | 10    | Complete |
| CLEAN-02    | 10    | Complete |
| CLEAN-03    | 10    | Complete |

**Coverage:**

- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-18_
_Last updated: 2026-03-18 after initial definition_
