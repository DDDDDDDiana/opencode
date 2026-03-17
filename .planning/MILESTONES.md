# Milestones

## v1.0

- **Status:** Completed
- **Shipped:** OpenCode Multi-User Isolation
- **Timeline:** 2026-03-17 -> 2026-03-18
- **Git range:** `afb96e4f9` -> `8a192022f`
- **Delivery stats:** 4 phases, 17 plans, 30 tasks, 69 files changed, +9670 / -20

### Accomplishments

- Added API key authentication, bcrypt hashing, and `UserContext` ALS propagation
- Enforced per-user session ownership with anonymous fallback and ownership-preserving fork/remove flows
- Added admin user CRUD endpoints and per-user usage statistics API
- Added usage recording and quota enforcement for agent calls, concurrent sessions, and daily tokens
- Enforced model allowlists during provider resolution
- Closed remaining gaps with testing and cleanup that restored session ownership coverage and a clean typecheck

### Known Gaps

- Message and part routes still bypass session ownership enforcement (`SESS-03`)
- Deleted user ids still expose `/user/:id/usage` stats (`USER-05`, `USER-06`, `USAGE-04`)
- No phase `*-VALIDATION.md` files were found

### Note

- Milestone audit completed before release; remaining gaps were accepted as tech debt for the next milestone
