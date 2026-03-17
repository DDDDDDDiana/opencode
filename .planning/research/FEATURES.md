# Feature Landscape: Multi-User Isolation

**Domain:** Multi-user isolation for self-hosted AI coding assistant
**Researched:** 2026-03-17
**Confidence:** HIGH (based on project requirements and standard multi-tenant patterns)

## Table Stakes

Features users expect. Missing = isolation is incomplete or unusable.

| Feature                             | Why Expected                                                  | Complexity | Notes                                                                  |
| ----------------------------------- | ------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| **Per-user API key authentication** | Core identity mechanism; without it, no user isolation exists | Low        | Bearer token in `Authorization` header; hash stored in DB              |
| **Session ownership**               | Sessions must belong to users; shared sessions = data leakage | Low        | Add `user_id` to SessionTable, filter all queries                      |
| **User CRUD API**                   | Admins need to create/delete users and issue API keys         | Low        | REST endpoints: POST/GET/DELETE `/users`, generate keys on create      |
| **Hard quota enforcement**          | Prevent runaway usage; protect shared resources               | Medium     | Check limits before agent loop starts; reject if exceeded              |
| **Token usage tracking**            | Quotas meaningless without metering actual consumption        | Medium     | Record tokens per session/message; aggregate per user                  |
| **Concurrent session limits**       | Prevent single user monopolizing server resources             | Low        | Count active sessions per user; reject new if at limit                 |
| **Anonymous fallback**              | Backward compatibility with existing no-auth deployments      | Low        | Nullable `user_id`; unauthenticated requests see only unowned sessions |
| **API key lifecycle**               | Keys must be revocable without deleting user                  | Low        | `revoked_at` timestamp on key table; check on auth                     |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature                          | Value Proposition                                             | Complexity | Notes                                                           |
| -------------------------------- | ------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| **Per-user model allowlist**     | Fine-grained cost control; restrict expensive models per user | Low        | JSON array on user table; validate model before LLM call        |
| **Daily/monthly token caps**     | Predictable cost management; reset quotas on schedule         | Medium     | Store period start timestamp; reset counter when period expires |
| **Usage analytics API**          | Visibility into consumption patterns; helps admins optimize   | Medium     | Aggregate queries on usage table; group by user/model/time      |
| **Quota warning events**         | Proactive notification before hard limit hit                  | Low        | Emit event at 80%/90% thresholds; client can display warning    |
| **Multiple API keys per user**   | Key rotation without downtime; separate keys per client       | Low        | One-to-many user→keys; authenticate against any active key      |
| **Rate limiting (requests/min)** | Protect against abuse; complement quota system                | Medium     | In-memory sliding window per user; reject if rate exceeded      |
| **Audit log**                    | Security compliance; track who did what when                  | Medium     | Log all authenticated actions with user_id/timestamp/action     |
| **User groups/roles**            | Simplify quota management for teams; assign quotas to groups  | High       | Group table, user_group junction, inherit quotas from group     |

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature                            | Why Avoid                                                                        | What to Do Instead                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Soft quota limits (model downgrade)** | Complex fallback logic; unpredictable behavior; user confusion                   | Hard reject with clear error message; user knows exactly when limit hit |
| **JWT authentication**                  | Adds complexity (signing, expiry, refresh); API keys sufficient for service mode | API key authentication; simpler, stateless, revocable                   |
| **External billing integration**        | Scope creep; SQLite tracking sufficient for self-hosted                          | Expose usage data via API; let admins integrate externally if needed    |
| **UI for user management**              | Frontend work outside core isolation; admins comfortable with APIs/CLI           | REST API only; admins use curl/Postman or build own tooling             |
| **Per-user file system isolation**      | Massive architectural change; OpenCode designed for shared workspace             | Session/data isolation only; users share directory context              |
| **OAuth/SSO integration**               | Enterprise feature; overkill for self-hosted; adds dependencies                  | API key auth; simple, self-contained, no external dependencies          |
| **Granular permission system**          | Over-engineering; all users have same tool access in v1                          | Binary: authenticated or not; per-user permissions deferred to v2       |
| **Quota marketplace/credits**           | Monetization feature; irrelevant for self-hosted                                 | Fixed quotas set by admin; no virtual currency or purchasing            |

## Feature Dependencies

```
User CRUD API → API key authentication (must create users before issuing keys)
API key authentication → Session ownership (must identify user before assigning sessions)
Session ownership → Token usage tracking (must know which user to charge)
Token usage tracking → Hard quota enforcement (must track usage before enforcing limits)
Per-user model allowlist → API key authentication (must identify user before checking allowlist)
Multiple API keys per user → API key lifecycle (revocation must work per-key, not per-user)
User groups/roles → User CRUD API (groups are collections of users)
Audit log → API key authentication (must identify user to log actions)
```

## MVP Recommendation

**Phase 1: Core Isolation (table stakes)**

1. User CRUD API (create users, issue keys)
2. API key authentication (identify user per request)
3. Session ownership (user_id on sessions, filtered queries)
4. Anonymous fallback (nullable user_id, backward compatible)

**Phase 2: Resource Protection (table stakes)** 5. Token usage tracking (record consumption per user) 6. Hard quota enforcement (agent call limit, token cap) 7. Concurrent session limits (prevent monopolization) 8. API key lifecycle (revocation without user deletion)

**Phase 3: Fine-Grained Control (differentiators)** 9. Per-user model allowlist (cost control) 10. Daily/monthly token caps (predictable budgets) 11. Multiple API keys per user (key rotation)

**Defer to v2:**

- Usage analytics API (nice to have, not blocking)
- Quota warning events (UX enhancement, not core isolation)
- Rate limiting (abuse protection, can add later)
- Audit log (compliance feature, not isolation requirement)
- User groups/roles (complexity, defer until multi-team demand)

**Rationale:**

- Phase 1 establishes identity and ownership (isolation foundation)
- Phase 2 prevents resource exhaustion (makes isolation production-ready)
- Phase 3 adds cost control (competitive advantage for self-hosted teams)
- Deferred features are enhancements, not blockers for functional multi-user isolation

## Complexity Assessment

| Feature                    | Complexity | Reason                                                      |
| -------------------------- | ---------- | ----------------------------------------------------------- |
| API key authentication     | Low        | Standard Bearer token pattern; hash comparison              |
| Session ownership          | Low        | Add column, filter queries; straightforward DB change       |
| User CRUD API              | Low        | Basic REST endpoints; minimal business logic                |
| Anonymous fallback         | Low        | Nullable column + conditional logic; already planned        |
| API key lifecycle          | Low        | Timestamp-based revocation; simple check on auth            |
| Token usage tracking       | Medium     | Requires hooking LLM response metadata; aggregation queries |
| Hard quota enforcement     | Medium     | Multiple limit types; check before loop; error handling     |
| Concurrent session limits  | Low        | Count query + comparison; reject if exceeded                |
| Per-user model allowlist   | Low        | JSON array validation; single check before LLM call         |
| Daily/monthly token caps   | Medium     | Period tracking; reset logic; timezone considerations       |
| Multiple API keys per user | Low        | One-to-many relation; authenticate against any active key   |
| Usage analytics API        | Medium     | Aggregation queries; time-series grouping; API design       |
| Quota warning events       | Low        | Threshold checks; event emission; client integration        |
| Rate limiting              | Medium     | In-memory state; sliding window algorithm; cleanup          |
| Audit log                  | Medium     | Middleware integration; log storage; query API              |
| User groups/roles          | High       | New tables; inheritance logic; migration complexity         |

## Integration Points

**Server Layer:**

- Middleware: API key authentication before route handlers
- Routes: User management endpoints (`/users`, `/users/:id`, `/users/:id/keys`)
- Context: UserContext ALS propagation (parallel to Instance)

**Session Layer:**

- Schema: Add `user_id` to SessionTable (nullable, indexed)
- Queries: Filter by `user_id` in all session lookups
- Prompt loop: Check quotas before starting agent execution

**Storage Layer:**

- Tables: `user`, `api_key`, `usage_record`
- Migrations: Add `user_id` to existing tables (nullable for backward compat)
- Indexes: `user_id` on sessions, `user_id + created_at` on usage

**Provider Layer:**

- Hook: Capture token counts from LLM responses
- Validation: Check model allowlist before provider call

## Sources

- OpenCode PROJECT.md (project requirements and constraints)
- OpenCode ARCHITECTURE.md (existing patterns: Instance, WorkspaceContext, SessionTable)
- Standard multi-tenant SaaS patterns (API key auth, quota enforcement, usage tracking)
- Self-hosted service requirements (backward compatibility, admin APIs, resource protection)

**Confidence:** HIGH — features derived from explicit project requirements and well-established multi-tenant patterns. No external research needed; domain is standard.
