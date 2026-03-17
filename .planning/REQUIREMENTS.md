# Requirements: OpenCode Multi-User Isolation

**Defined:** 2026-03-18
**Core Value:** Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

## v1 Requirements

Requirements for milestone `v1.1`. Each maps to exactly one roadmap phase.

### Session Isolation

- [ ] **SESS-07**: User can read messages only when the parent session belongs to that user
- [ ] **SESS-08**: User can read parts only when the parent session belongs to that user
- [ ] **SESS-09**: User-facing session-derived routes use one shared ownership guard before loading protected data

### Service Boundary

- [ ] **BNDR-01**: Admin can manage the local user projection needed for isolation and quotas without exposing signup or onboarding flows from this service
- [ ] **BNDR-02**: Service API and planning docs describe registration as external to this project

### Usage Accounting

- [ ] **USAGE-05**: User-scoped token and usage accounting continues to work after boundary cleanup
- [ ] **USAGE-06**: Quota enforcement continues to use persisted per-user usage totals after boundary cleanup

### Validation Evidence

- [ ] **EVID-01**: Maintainer can review milestone validation artifacts that prove ownership enforcement and retained usage accounting for `v1.1`

## v2 Requirements

Deferred from `v1.1`. Tracked, but not included in this roadmap.

### Lifecycle

- **LIFE-01**: Deleted or disabled users are uniformly fail-closed across user-facing reads
- **LIFE-02**: This service accepts an explicit upstream provision, update, and deactivate sync contract

### Usage Semantics

- **USAGE-07**: `/user/:id/usage` semantics are tightened for deleted or invalid users

### Operations

- **OPER-01**: Admin can export scoped usage breakdowns by time window, model, or session
- **OPER-02**: Admin can disable access or revoke keys without deleting historical accounting
- **OPER-03**: Maintainer can inspect isolation telemetry for denied cross-user access attempts

## Out of Scope

| Feature                                           | Reason                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| Signup and registration UX                        | Owned by the frontend and another service, not this isolation service |
| Onboarding flows                                  | Product activation belongs outside this backend                       |
| Password reset, email verification, and MFA flows | Identity assurance is outside the `v1.1` boundary                     |
| Rich profile management                           | Not required to enforce isolation or quota/accounting rules           |
| Billing, invoicing, or external monetization      | Large scope jump unrelated to this milestone's isolation focus        |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| SESS-07     | Phase 5 | Pending |
| SESS-08     | Phase 5 | Pending |
| SESS-09     | Phase 5 | Pending |
| BNDR-01     | Phase 6 | Pending |
| BNDR-02     | Phase 6 | Pending |
| USAGE-05    | Phase 6 | Pending |
| USAGE-06    | Phase 6 | Pending |
| EVID-01     | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-18_
_Last updated: 2026-03-18 after `v1.1` roadmap creation_
