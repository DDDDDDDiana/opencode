# Feature Research

**Domain:** Multi-user isolation and usage accountability service (post-v1.0 boundary tightening)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Feature Landscape

### Scope framing for this milestone

For services like this, the normal split is:

- **Keep in the isolation service:** anything required to prove requester identity inside this service, bind requests to a user, enforce ownership on every resource hop, meter usage, enforce quotas, and safely disable deleted users.
- **Make optional/admin-facing:** operational visibility and admin ergonomics that help manage isolation or spending, but are not required for correctness.
- **Move out:** registration, signup, onboarding, password/email flows, and end-user lifecycle UX. Those belong to the frontend or an upstream identity/provisioning system.

That means `v1.1` should behave more like a **policy enforcement and accounting service** than a full user-management product.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = the isolation boundary is not credible.

| Feature                                                       | Why Expected                                                                                                     | Complexity | Notes                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| End-to-end ownership enforcement on session-derived resources | Multi-user systems are expected to prevent horizontal access across messages, parts, forks, deletes, and lookups | MEDIUM     | Must stay. This is the core hardening item for `v1.1`; all derived-resource routes need deny-by-default ownership checks    |
| Authenticated user context bound early in request handling    | Isolation depends on a validated user context, not route-by-route ad hoc parsing                                 | LOW        | Must stay. Existing API key auth + `UserContext` ALS already fits this boundary                                             |
| Active/deleted/suspended user gating                          | Deleted or invalid identities must not keep reading usage or touching resources                                  | LOW        | Must stay. Minimal lifecycle state is acceptable because it protects isolation; this is not the same as owning registration |
| Per-user usage/token ledger                                   | Quotas and accountability are meaningless without durable usage attribution                                      | MEDIUM     | Must stay. Keep recording usage by user and exposing scoped usage stats                                                     |
| Hard quota enforcement                                        | Shared services are expected to stop runaway spend or abuse deterministically                                    | MEDIUM     | Must stay. Current project decision to hard-reject is the right table-stakes behavior                                       |
| Ownership-safe anonymous compatibility                        | Existing single-user/no-auth installs should not break while multi-user paths stay isolated                      | MEDIUM     | Must stay for brownfield compatibility. Requires careful nullable `user_id` handling without creating bypasses              |
| Audit-quality authorization/validation evidence               | Isolation services are expected to prove checks exist, not just claim they do                                    | MEDIUM     | Must stay for this milestone because `v1.0` shipped with accepted evidence gaps                                             |

### Differentiators (Competitive Advantage)

Valuable features that improve operator trust or admin ergonomics, but are not the first thing to build.

| Feature                                            | Value Proposition                                                                           | Complexity | Notes                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| Cross-route isolation violation telemetry          | Makes boundary regressions visible quickly instead of discovering them after an incident    | MEDIUM     | Optional hardening differentiator. Log denied cross-user access attempts and surface patterns |
| Usage breakdowns by model/session/time window      | Helps admins explain cost, tune quotas, and spot abuse without external billing tools       | MEDIUM     | Keep if lightweight. Strong fit because usage accountability remains in scope                 |
| Admin-safe disable/revoke flows                    | Lets operators immediately freeze a compromised user without deleting historical accounting | LOW        | Good ergonomics. Separate `disabled` from `deleted` so audit and usage records remain intact  |
| Scoped API key rotation and multiple keys per user | Improves operational safety for integrations without weakening isolation                    | LOW        | Useful if this service continues to authenticate via API keys                                 |
| Quota threshold warnings for admins                | Gives operators time to intervene before hard failures                                      | LOW        | Nice-to-have. Keep as admin ergonomics, not end-user onboarding UX                            |
| Usage export/report endpoints                      | Simplifies downstream finance or compliance workflows without integrating external billing  | MEDIUM     | Good differentiator if export remains strictly scoped and read-only                           |

### Anti-Features (Commonly Requested, Often Problematic)

Features that sound reasonable but violate the new service boundary or create brownfield churn.

| Feature                                                          | Why Requested                                                    | Why Problematic                                                                                                              | Alternative                                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Self-service signup/registration                                 | Teams want one service to “just create users too”                | Recreates the boundary this milestone is explicitly trying to remove; drags in verification, abuse controls, and identity UX | Accept provisioned users from the frontend/upstream service; keep only minimal local identity state needed for isolation |
| Invite flows, password reset, email verification, MFA UX         | Feels like part of “user management”                             | These are identity/onboarding concerns, not isolation/accounting concerns; they expand the attack surface                    | Delegate to upstream identity provider or frontend-owned auth service                                                    |
| Rich profile management                                          | Seems harmless once users exist                                  | Adds CRUD surface with little isolation value and becomes a shadow account system                                            | Store only fields required for ownership, status, and admin diagnostics                                                  |
| Full lifecycle onboarding workflows                              | Product teams often want setup steps near the backend APIs       | Mixes education/activation UX with enforcement logic and muddies responsibilities                                            | Publish clear API contracts/errors so the frontend can own onboarding                                                    |
| External billing, invoicing, or credit wallets                   | Usage accounting can tempt teams into building monetization here | Large scope jump; out of line with project constraints and not required for quota enforcement                                | Keep internal usage ledger + export endpoints only                                                                       |
| Fine-grained org/role builder for arbitrary business permissions | Teams often ask for “permissions while we’re here”               | High-complexity policy system that distracts from the concrete ownership gap in session-derived resources                    | Keep simple ownership + admin override rules; revisit only if actual multi-org policy needs appear                       |
| SCIM/enterprise provisioning inside this service                 | Sounds aligned because it touches user lifecycle                 | Provisioning belongs to the upstream identity/user service unless enterprise sync itself becomes a product goal              | Consume upstream user state changes or mirrored records instead of owning provisioning workflows                         |

## Capability Boundary: Keep vs Move Out

### Must stay in this service

| Capability                                                 | Why it stays                                                     | Category                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------- |
| Request authentication for this service                    | Needed to know who is making the call before enforcing ownership | Required hardening        |
| Local user/status record (`active`, `disabled`, `deleted`) | Needed to gate access and protect usage/accounting endpoints     | Required hardening        |
| Resource ownership checks                                  | The main reason this service exists                              | Required hardening        |
| Usage recording and per-user totals                        | Required for accountability and quota enforcement                | Required hardening        |
| Quota checks and limit rejection                           | Prevents abusive or accidental resource exhaustion               | Required hardening        |
| Admin revoke/disable controls                              | Needed to contain incidents without relying on registration UX   | Optional admin ergonomics |
| Scoped usage reporting/export                              | Directly tied to accountability                                  | Optional admin ergonomics |

### Should move out of this service

| Capability                                                   | Why it moves out                                          | Category           |
| ------------------------------------------------------------ | --------------------------------------------------------- | ------------------ |
| Signup and user creation UX                                  | Registration is no longer this service’s job              | Boundary violation |
| Invite acceptance and welcome flows                          | Onboarding UX belongs in frontend/upstream identity       | Boundary violation |
| Password/email/MFA recovery flows                            | Identity assurance is separate from isolation enforcement | Boundary violation |
| Profile editing/preferences unrelated to quotas or ownership | Not needed to enforce isolation                           | Boundary violation |
| Marketing-style onboarding/checklists                        | No backend isolation value                                | Boundary violation |

## Feature Dependencies

```text
Authenticated user context
    └──requires──> active/deleted/suspended user gating
                           └──requires──> ownership-safe anonymous compatibility

Authenticated user context
    └──requires──> end-to-end ownership enforcement
                           └──requires──> audit-quality authorization tests/evidence

Authenticated user context
    └──requires──> per-user usage/token ledger
                           └──requires──> hard quota enforcement
                                            └──enhances──> quota threshold warnings

Per-user usage/token ledger
    └──enhances──> usage breakdowns / exports

Self-service signup / onboarding UX ──conflicts──> boundary-tight isolation service scope
Rich profile management ──conflicts──> minimal local identity state
External billing platform work ──conflicts──> milestone focus on accounting, not monetization
```

### Dependency Notes

- **Ownership enforcement requires authenticated user context:** every message/part/session-derived lookup must know the caller before it can deny by default.
- **Usage ledger requires authenticated user context:** usage without durable attribution cannot support quotas or accountability.
- **Hard quota enforcement requires the usage ledger:** limits must be based on persisted, user-scoped consumption, not ephemeral counters.
- **Deleted-user gating requires local user status:** the service needs enough identity state to reject stale/deleted users even if registration lives elsewhere.
- **Authorization evidence requires ownership enforcement:** the missing `*-VALIDATION.md` and route coverage should be treated as proof that hardening is complete.
- **Signup/onboarding features conflict with milestone scope:** they convert the service back into a second registration system and should stay out.

## MVP Definition

### Launch With (v1.1 milestone)

- [x] End-to-end ownership enforcement for session-derived resources — closes the main isolation gap left after `v1.0`
- [x] Authenticated user context + user status gating — needed to reject deleted/invalid identities safely
- [x] Per-user usage/token ledger preservation — keeps accountability intact while boundaries move
- [x] Hard quota enforcement — still the simplest reliable spend-control behavior
- [x] Validation and audit evidence restoration — needed to trust the hardening work in a brownfield codebase

### Add After Validation (v1.1.x)

- [ ] Cross-route isolation violation telemetry — add once core checks are complete and stable
- [ ] Usage breakdowns / exports — add when admins need deeper accountability than raw totals
- [ ] Scoped API key rotation improvements — add when operational pain appears in real deployments
- [ ] Quota threshold warnings for admins — add when operators need proactive intervention tools

### Future Consideration (v2+)

- [ ] Rich admin policy layers beyond ownership/admin override — defer until concrete authorization complexity appears
- [ ] Enterprise provisioning integrations directly in this service — only revisit if product boundary changes again
- [ ] External billing integrations — only if the product becomes a monetization platform, not just an isolation service

## Feature Prioritization Matrix

| Feature                                    | User Value | Implementation Cost | Priority          |
| ------------------------------------------ | ---------- | ------------------- | ----------------- |
| End-to-end ownership enforcement           | HIGH       | MEDIUM              | P1                |
| Authenticated user context + status gating | HIGH       | LOW                 | P1                |
| Per-user usage/token ledger                | HIGH       | MEDIUM              | P1                |
| Hard quota enforcement                     | HIGH       | MEDIUM              | P1                |
| Validation/audit evidence restoration      | HIGH       | MEDIUM              | P1                |
| Cross-route isolation telemetry            | MEDIUM     | MEDIUM              | P2                |
| Usage breakdowns / exports                 | MEDIUM     | MEDIUM              | P2                |
| Scoped API key rotation ergonomics         | MEDIUM     | LOW                 | P2                |
| Quota threshold warnings                   | MEDIUM     | LOW                 | P3                |
| Rich role/policy builder                   | LOW        | HIGH                | P3                |
| Self-service signup / onboarding           | LOW        | HIGH                | P3 (do not build) |

**Priority key:**

- P1: Must have for this milestone
- P2: Should have if milestone scope permits
- P3: Defer or explicitly avoid

## Competitor / Ecosystem Pattern Analysis

| Feature Area                       | Common ecosystem split                                                          | Our Approach                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Authentication / registration      | Often delegated to identity products such as AuthKit/User Management platforms  | Keep only request auth needed by this service; move signup/onboarding UX out    |
| Provisioning / deprovisioning      | Often handled by upstream directory or lifecycle tooling                        | Consume user state changes; keep local status only for isolation and accounting |
| Authorization / resource isolation | Kept inside the product service because it knows the resource graph             | Keep ownership enforcement here; do not outsource resource semantics            |
| Usage accounting / quotas          | Usually product-local because only the product can meter meaningful consumption | Keep the token/usage ledger and quota checks here                               |
| Admin visibility                   | Added as light operational tooling, not full account-management UX              | Prefer minimal admin APIs and exports over broad user-management features       |

## Sources

- Project context: `D:\python_projects\opencode\.planning\PROJECT.md` — explicit `v1.1` scope, active requirements, and out-of-scope items. **Confidence: HIGH**
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html — validates deny-by-default, per-request checks, object-level authorization, and logging/testing expectations. **Confidence: HIGH**
- OWASP Multi-Tenant Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html — validates tenant context propagation, composite ownership checks, per-tenant quotas, and audit requirements. **Confidence: HIGH**
- AWS SaaS Lens, Tenant Isolation: https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html — supports treating isolation as foundational and business-critical in shared infrastructure. **Confidence: HIGH**
- WorkOS AuthKit overview: https://workos.com/docs/user-management/overview — shows registration/authentication/email verification/MFA commonly live in a dedicated identity layer. **Confidence: MEDIUM**
- WorkOS Directory Sync overview: https://workos.com/docs/directory-sync/overview — shows provisioning/deprovisioning is often an upstream lifecycle-management concern rather than a product-service concern. **Confidence: MEDIUM**

---

_Feature research for: OpenCode Multi-User Isolation `v1.1` boundary tightening_
_Researched: 2026-03-18_
