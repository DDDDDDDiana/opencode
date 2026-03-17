# Retrospective

## Milestone: v1.0 - Multi-User Isolation

**Shipped:** 2026-03-18
**Phases:** 4 | **Plans:** 17

### What Was Built

- API key auth, bcrypt-backed credential storage, and `UserContext` ALS propagation
- User-scoped session ownership with anonymous fallback and ownership-preserving fork/remove flows
- Admin user CRUD endpoints and per-user usage statistics APIs
- Quota enforcement for agent calls, concurrent sessions, and daily tokens
- Model allowlist enforcement during provider resolution

### What Worked

- Phase-based planning kept scope explicit and requirements traceable
- Gap-closure plans made it easy to re-verify high-risk session ownership logic
- Existing ALS and Drizzle patterns reduced implementation risk in a brownfield codebase

### What Was Inefficient

- Session ownership verification passed at phase level while message-level routes still escaped milestone integration coverage
- Summary frontmatter was inconsistent, which reduced the value of automated milestone extraction
- Nyquist validation artifacts were never produced, leaving verification evidence incomplete

### Patterns Established

- Use `UserContext` as the user identity carrier parallel to `Instance`
- Enforce isolation at query boundaries, not just route handlers
- Treat audit output as a release gate even when the final decision is to accept debt

### Key Lessons

- Integration audits need to cover nested resources, not only top-level CRUD paths
- Deletion flows should be audited against all secondary read surfaces, especially reporting endpoints
- Milestone evidence is stronger when validation artifacts are produced consistently during execution

### Cost Observations

- Model mix: not captured for this milestone
- Sessions: not captured for this milestone
- Notable: most milestone work landed in a single two-day burst, which increased the value of explicit audit and archive steps

## Cross-Milestone Trends

| Milestone | Scope                | Key Risk                          | Outcome                              |
| --------- | -------------------- | --------------------------------- | ------------------------------------ |
| v1.0      | Multi-user isolation | Cross-phase auth/ownership wiring | Shipped with accepted follow-up debt |
