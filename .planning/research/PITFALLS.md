# Pitfalls Research

**Domain:** Brownfield multi-user isolation hardening with externalized user lifecycle
**Researched:** 2026-03-18
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Ownership checks stop at sessions, not session-derived resources

**What goes wrong:**
The service correctly filters `session` reads by `user_id`, but message, part, fork, share, event, or usage-detail routes still trust `session_id` or `message_id` alone. Isolation looks complete in happy-path testing while object-level authorization is still broken underneath.

**Why it happens:**
This is a brownfield retrofit. Teams patch the obvious top-level table first, but derived resources already have their own handlers, joins, and lookup helpers. OWASP explicitly calls out object-level authorization gaps when every function using client-supplied IDs is not checked.

**How to avoid:**

- Make ownership resolution flow through one server-side gate: resolve resource → resolve owning session → resolve owning user.
- Require every message/part/fork/share lookup to join back to the owning session and user context.
- Add a negative test matrix for every route that accepts session-derived IDs.
- Deny by default when ownership cannot be proven.

**Warning signs:**

- Message and part handlers fetch by primary key without a user predicate.
- Some routes return `404`, others `403`, and others succeed for the same unauthorized probe.
- Tests cover session list/get but not message, part, fork, or share endpoints.

**Phase to address:**
Phase 1 — End-to-end ownership enforcement for session-derived resources

---

### Pitfall 2: “Anonymous compatibility” quietly becomes an authorization bypass

**What goes wrong:**
To preserve no-auth or legacy behavior, brownfield code keeps nullable `user_id` and fallback paths. New ownership logic then treats missing user context as valid access to null-owned or legacy rows, widening access instead of preserving compatibility safely.

**Why it happens:**
Backward compatibility is real, but nullable ownership turns “unknown owner” into “public owner” unless the policy is explicit. In an existing system, historical rows often predate current rules.

**How to avoid:**

- Define anonymous access as a policy, not a fallback accident.
- Separate legacy rows from intentionally anonymous rows.
- Make unauthenticated behavior opt-in and explicit for deployments that still need it.
- Add migration-time backfill or a sentinel ownership state instead of leaving semantics ambiguous.

**Warning signs:**

- Queries use `user_id IS NULL` as a convenience branch with no deployment guard.
- Post-migration behavior for old rows is undocumented.
- Unauthorized probes succeed only when auth headers are omitted.

**Phase to address:**
Phase 1 — End-to-end ownership enforcement for session-derived resources

---

### Pitfall 3: Deleted or invalid users become dangling identities with live data paths

**What goes wrong:**
User deletion or invalidation removes the current account record but leaves sessions, usage rows, API keys, cached identity snapshots, or reports still addressable. `/user/:id/usage` and related reporting endpoints can then expose historical data for identities that should no longer be queryable through this service.

**Why it happens:**
SQLite foreign keys do not save you unless they are enabled and modeled correctly, and brownfield services often have partial references only. Teams also mix “delete user,” “revoke auth,” and “hide user from API” into one unclear state transition.

**How to avoid:**

- Pick one lifecycle contract: active, disabled, deleted, or tombstoned.
- Gate usage/report endpoints on current lifecycle state, not just row existence.
- Revoke keys before lifecycle transition is finalized.
- Use explicit referential strategy for sessions and usage: keep historical accounting with tombstones, not orphaned free-form IDs.
- Verify SQLite foreign key enforcement is actually enabled per connection if relying on it.

**Warning signs:**

- Usage tables reference raw user IDs with no validated parent state.
- Deleted users disappear from admin CRUD but still appear in reporting queries.
- Different code paths disagree on whether deleted means hidden, revoked, or purged.

**Phase to address:**
Phase 2 — Identity lifecycle boundary hardening

---

### Pitfall 4: This service quietly re-grows into a second registration system

**What goes wrong:**
While trying to preserve compatibility, the backend keeps adding invite, signup, profile creation, default quota bootstrap, welcome email, or account recovery behavior. The milestone says registration moved out, but the service still owns meaningful lifecycle creation logic.

**Why it happens:**
Brownfield systems already have admin CRUD and user tables, so it feels cheap to keep “just one more” lifecycle endpoint. Product-boundary drift happens incrementally, not with one large mistake.

**How to avoid:**

- Write a hard boundary: this service accepts authenticated, provisioned identities and enforces isolation, quotas, and usage only.
- Allow only the minimum lifecycle mutations needed for isolation safety: disable, revoke, rotate, tombstone, and lookup.
- Remove or reject self-service registration semantics from API surface and docs.
- Treat any endpoint that creates a user without an upstream owner as boundary regression.

**Warning signs:**

- New endpoints create users from email/username rather than trusted upstream identifiers.
- Quota defaults or onboarding state are assigned inside this service.
- Frontend teams depend on this backend for “temporary” registration steps.

**Phase to address:**
Phase 2 — Identity lifecycle boundary hardening

---

### Pitfall 5: External identity sync is treated as strongly consistent

**What goes wrong:**
The service depends on webhook-driven or asynchronous user sync from another service and assumes create/update/delete events arrive once, in order, and immediately. Usage or ownership code then runs before the local identity view is updated, producing false rejects, wrong quota attachment, or ghost users.

**Why it happens:**
Official webhook guidance is explicit that deliveries can fail, retry, and be eventually consistent. Brownfield integrations still often code as if “user created upstream” means “user exists locally right now.”

**How to avoid:**

- Treat upstream identity sync as eventually consistent.
- Make lifecycle events idempotent and replay-safe.
- Prefer immutable upstream IDs as the only binding key.
- Decide what happens when usage arrives for a user not yet materialized locally: reject, buffer, or lazily create a minimal tombstone/projection.
- Never key local ownership off mutable fields like email.

**Warning signs:**

- Webhook handlers are not idempotent.
- User creation depends on event order.
- Local rows are linked by email, name, or provider-specific mutable profile data.
- Retries create duplicates or quota resets.

**Phase to address:**
Phase 2 — Identity lifecycle boundary hardening

---

### Pitfall 6: Usage accounting survives, but attribution drifts from the real actor

**What goes wrong:**
Token and quota accounting still records totals, but the actor binding is no longer trustworthy. Some usage is written under anonymous, stale, deleted, or replacement user IDs after boundary changes. Reports look numerically plausible while per-user enforcement and auditability are wrong.

**Why it happens:**
Brownfield milestones usually preserve the counter pipeline first and revisit identity binding later. That is backward: accounting correctness depends on stable ownership keys.

**How to avoid:**

- Record usage against an immutable internal subject key, not display identity.
- Make user resolution happen before provider calls and before usage persistence.
- Store enough audit context to explain attribution changes later.
- Add invariants: no usage row without a valid subject state for authenticated flows.

**Warning signs:**

- Usage can be inserted before user resolution completes.
- The same person has multiple user IDs after sync changes.
- Quota enforcement uses one identifier while reporting uses another.

**Phase to address:**
Phase 3 — Usage/quota accounting integrity

---

### Pitfall 7: Quota enforcement and usage reporting read from different truths

**What goes wrong:**
Request-time quota checks use one query path, while admin reports and `/user/:id/usage` aggregate from another. After isolation tightening, one path excludes deleted/invalid users, another includes them, and a third still counts anonymous or legacy rows. Enforcement and reporting drift apart.

**Why it happens:**
In brownfield systems, enforcement code and analytics/reporting code are usually added at different times by different phases. Once lifecycle semantics change, both need the same subject-state rules.

**How to avoid:**

- Define one canonical accounting model for active, disabled, deleted, and anonymous subjects.
- Reuse shared predicates/helpers for both enforcement and reporting.
- Snapshot subject state intentionally if historical reporting must differ from current authorization state.
- Add reconciliation tests comparing quota totals, usage aggregates, and admin views for the same subject.

**Warning signs:**

- Report totals differ from enforcement totals for the same user and period.
- Deleted users vanish from one endpoint but still count against quota elsewhere.
- Engineers explain discrepancies as “just reporting lag” without a documented model.

**Phase to address:**
Phase 3 — Usage/quota accounting integrity

---

### Pitfall 8: Auth and admin boundaries blur during cleanup

**What goes wrong:**
User-scoped credentials can still hit admin lifecycle endpoints, or admin tooling bypasses normal ownership predicates “because it is internal.” Tightening one boundary then reopens another via maintenance endpoints.

**Why it happens:**
Brownfield code often reuses existing middleware chains. Once routes are shuffled during milestone cleanup, privilege boundaries get inherited accidentally instead of designed.

**How to avoid:**

- Separate user-authenticated routes from admin/service-to-service routes.
- Require explicit admin authorization for lifecycle operations.
- Make internal maintenance endpoints obey the same object-ownership rules unless there is an audited admin override path.
- Add route inventory tests, not just handler tests.

**Warning signs:**

- Admin and user routes share the same auth guard.
- “Internal only” endpoints skip ownership checks.
- There is no explicit permission model for disable/delete/usage-read operations.

**Phase to address:**
Phase 2 — Identity lifecycle boundary hardening

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                                     | Immediate Benefit            | Long-term Cost                                                      | When Acceptable                                                   |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Keep nullable `user_id` semantics vague                      | Preserves compatibility fast | Permanent ambiguity between legacy, anonymous, and broken ownership | Only during a tightly scoped migration with explicit cleanup date |
| Sync whole user profiles locally “just in case”              | Fewer upstream lookups       | Recreates registration/lifecycle ownership and increases drift      | Rarely                                                            |
| Treat deleted users as hard-deleted everywhere               | Simpler CRUD                 | Breaks historical usage attribution and auditability                | Never for systems that retain quotas/usage history                |
| Let reporting use ad hoc SQL separate from enforcement logic | Fast analytics iteration     | Accounting drift and policy mismatch                                | Never                                                             |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration                | Common Mistake                                           | Correct Approach                                                                         |
| -------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Upstream identity service  | Trust webhook order and single delivery                  | Make handlers idempotent, replay-safe, and keyed by immutable upstream ID                |
| Frontend registration flow | Let frontend call this service to create bootstrap users | Accept only already-provisioned identities or explicit admin/service actions             |
| Provider/token accounting  | Attribute usage before stable user resolution            | Bind subject first, then call provider, then persist usage against immutable subject key |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap                                                                          | Symptoms                                           | Prevention                                                                                             | When It Breaks                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Ownership checks implemented as repeated per-row lookups                      | Message/part endpoints get slower as history grows | Use indexed joins from derived resource back to session and user                                       | Noticeable once sessions have deep histories         |
| Reporting queries scan historical usage for deleted and active users together | Admin usage endpoints become slow and inconsistent | Index subject state and reporting dimensions; separate current-state filters from historical snapshots | Moderate data volume                                 |
| Lifecycle sync retries create duplicate local identities                      | Quota/report rows fragment across multiple IDs     | Enforce unique immutable upstream ID and idempotency keys                                              | As soon as webhook retries or partial failures occur |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake                                                                | Risk                                                          | Prevention                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Checking ownership only at route entry                                 | Cross-user reads via nested resource paths                    | Enforce ownership in the data access layer for every object lookup |
| Trusting mutable identity fields like email for linkage                | Account takeover or mis-attributed usage after profile change | Link only on immutable upstream/user IDs                           |
| Allowing deleted or disabled identities to retain readable usage views | Historical data disclosure after offboarding                  | Gate reporting on lifecycle state and admin policy                 |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall                                                                           | User Impact                                | Better Approach                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Returning different errors for unauthorized vs deleted vs never-existed resources | Users can infer other users’ objects exist | Normalize external responses; keep detail in audit logs                         |
| Silent quota/accounting reattribution after identity cleanup                      | Users dispute usage they cannot explain    | Preserve audit trail showing subject mapping and lifecycle state at record time |
| Frontend still exposing signup affordances backed by removed APIs                 | Broken onboarding and support confusion    | Remove stale docs/UI at the same time boundary changes ship                     |

## "Looks Done But Isn't" Checklist

- [ ] **Message/part ownership:** Often missing join-back to owning session — verify every derived-resource route fails cross-user probes.
- [ ] **Deleted-user handling:** Often missing usage/report gating — verify deleted or invalid subjects cannot be queried through user-facing endpoints.
- [ ] **Boundary cleanup:** Often missing API surface removal — verify this service no longer exposes signup/onboarding semantics.
- [ ] **Accounting integrity:** Often missing reconciliation — verify quota enforcement totals match reporting totals under active, disabled, and deleted states.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                | Recovery Cost | Recovery Steps                                                                                                                                    |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session-derived ownership leak         | HIGH          | Freeze affected routes, add centralized ownership gate, run cross-user regression suite, review access logs for exposure window                   |
| Dangling deleted-user identities       | MEDIUM        | Tombstone affected subjects, revoke credentials, patch reporting predicates, backfill lifecycle state on historical rows                          |
| Accounting drift after boundary change | HIGH          | Reconcile usage from provider/session logs, repair subject mapping, reissue quota balances if needed, add invariant tests before reopening writes |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                                      | Prevention Phase                                | Verification                                                              |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Ownership checks stop at sessions            | Phase 1 — End-to-end ownership enforcement      | Cross-user tests for session, message, part, fork, share, and event paths |
| Anonymous compatibility becomes bypass       | Phase 1 — End-to-end ownership enforcement      | Migration and no-auth tests prove legacy handling is explicit             |
| Dangling deleted-user identities             | Phase 2 — Identity lifecycle boundary hardening | Deleted/disabled subjects cannot authenticate or query usage views        |
| Service re-grows registration duties         | Phase 2 — Identity lifecycle boundary hardening | Route inventory and docs show no signup/onboarding ownership here         |
| External sync treated as strongly consistent | Phase 2 — Identity lifecycle boundary hardening | Replay, retry, out-of-order webhook tests stay correct                    |
| Usage attribution drift                      | Phase 3 — Usage/quota accounting integrity      | Every usage row maps to one immutable subject key with audit context      |
| Reporting vs enforcement drift               | Phase 3 — Usage/quota accounting integrity      | Reconciliation tests match report totals to quota decisions               |
| Boundary blur between admin and user auth    | Phase 2 — Identity lifecycle boundary hardening | Admin-only routes reject user credentials and are explicitly audited      |

## Sources

- OWASP Authorization Cheat Sheet — validate permissions on every request, deny by default, centralize authorization checks: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP API Security Top 10 2023, API1 Broken Object Level Authorization — object-level checks required for every function using client-supplied IDs: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP Multi-Tenant Security Cheat Sheet — tenant context propagation, offboarding, audit, and cross-tenant isolation patterns: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- SQLite Foreign Key Support — FK enforcement must be enabled per connection; row lifecycle strategy matters for orphan prevention: https://www.sqlite.org/foreignkeys.html
- Clerk official docs, Sync data with webhooks — webhook sync is eventually consistent and retry-prone; do not assume strong consistency: https://clerk.com/docs/webhooks/sync-data
- Project context: `D:\python_projects\opencode\.planning\PROJECT.md`

---

_Pitfalls research for: OpenCode v1.1 isolation boundary tightening_
_Researched: 2026-03-18_
