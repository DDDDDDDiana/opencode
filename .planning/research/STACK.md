# Stack Research

**Domain:** Isolation boundary tightening for an existing multi-user OpenCode service
**Researched:** 2026-03-18
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology           | Version               | Purpose                                                     | Why Recommended                                                                                                                                                          |
| -------------------- | --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bun                  | 1.3.10                | Runtime, SQLite access, crypto                              | Keep it unchanged. The service already uses Bun successfully, and the current DB layer already enables `PRAGMA foreign_keys = ON`, which matters for boundary integrity. |
| TypeScript + Effect  | 5.8.2 + 4.0.0-beta.31 | Typed service boundaries and request/context propagation    | Keep unchanged. Use Effect services for ownership/identity gate helpers instead of adding a second backend framework.                                                    |
| Hono + hono-openapi  | 4.10.7 + 1.1.2        | HTTP routes, middleware, typed request boundary enforcement | Keep unchanged, but add reusable ownership middleware for session-derived resources so message/part routes fail before handler logic runs.                               |
| Drizzle ORM + SQLite | 1.0.0-beta.16-ea816b6 | Schema enforcement, migrations, indexes, foreign keys       | This milestone needs stronger DB constraints, not a new database. Drizzle already supports SQLite foreign keys, composite keys, and indexes.                             |

### Supporting Libraries

| Library                             | Version  | Purpose                                                                     | When to Use                                                                                                                                               |
| ----------------------------------- | -------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zod                                 | 4.1.8    | Validate external identity references and boundary-safe admin/sync payloads | Use for any user provisioning or deactivation payload accepted from the frontend/admin service. Validate only IDs, names, status, quotas, and allowlists. |
| hono/factory `createMiddleware`     | 4.10.7   | Typed ownership guards for `session`, `message`, and `part` routes          | Use when a route touches session-derived resources and must resolve ownership once, then short-circuit with 404/403.                                      |
| `bun:sqlite` foreign keys + indexes | built-in | DB-level integrity for resource chains and retained accounting              | Use for `session -> message -> part` integrity and `usage -> user` retention rules.                                                                       |
| bcrypt                              | existing | Existing API key verification                                               | Keep as-is for this milestone. Do not expand auth scope just because registration is moving elsewhere.                                                    |

### Development Tools

| Tool            | Purpose                                             | Notes                                                                                   |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| drizzle-kit     | Generate migrations for new constraints and columns | Use for `status/time_deleted`, revocation fields, composite indexes, and FK tightening. |
| `bun typecheck` | Verify typed middleware and schema changes          | Run from `packages/opencode`, per repo rules.                                           |

## Stack-Level Changes Needed

### 1. Keep the runtime/web stack; add an ownership-guard layer

Do **not** add a new auth framework.

Use Hono middleware plus the existing `UserContext` pattern to enforce ownership at the route boundary:

- session routes: resolve session by current user context
- message routes: resolve owning session first, then message
- part routes: resolve owning session first, then part

Why this matters: the current gap is not missing auth technology. It is incomplete reuse of the existing auth identity at every session-derived boundary.

### 2. Tighten the SQLite schema instead of denormalizing ownership everywhere

Recommended schema changes:

- add `user.status` or `time_deleted`
- add `user.external_id` if another service is the source of truth
- add `api_key.time_revoked`
- add a foreign key from `usage.user_id` to `user.id`
- add stronger message/part integrity constraints

Most important DB tightening:

1. **Retain user rows as tombstones instead of hard deleting them**
   - replace destructive delete flows with `status = "disabled" | "deleted"` or `time_deleted`
   - revoke API keys instead of deleting accounting history
2. **Make accounting rows point at a real user row**
   - `usage.user_id` should reference `user.id`
   - do not null out retained usage rows
3. **Enforce session-derived integrity in the DB**
   - `message.session_id -> session.id` already exists indirectly through route logic; keep using session as the ownership root
   - `part.session_id` should be tied to the owning session path, ideally with a composite relation between message and part so a part cannot reference a message from one session and a session from another

Why this matters: stricter isolation comes from making invalid cross-session states impossible, not just unlikely.

### 3. Add indexes for real isolation queries

Current code filters heavily by `user_id`, `project_id`, `workspace_id`, and archival state.

Add or adjust indexes around the actual access paths used in `src/session/index.ts`:

- `session(project_id, user_id, time_updated)`
- `session(user_id, time_archived, time_updated)` for global/user listing
- `usage(user_id, date)` for retained daily token stats
- any child-key indexes required by new foreign keys

Why this matters: SQLite foreign key docs explicitly recommend indexing child keys, and ownership enforcement should not regress into table scans as user counts grow.

### 4. Narrow the user model to isolation metadata only

This service still needs a user record, but only for isolation and accounting.

The user table should hold:

- internal `id`
- optional upstream `external_id`
- display `name`
- `status`/`time_deleted`
- quotas
- model allowlist
- timestamps

It should **not** hold:

- email verification state
- password hashes
- signup tokens
- invite flows
- profile onboarding fields
- session-cookie or JWT refresh metadata

Why this matters: removing registration responsibility does **not** mean removing user identity entirely. It means storing only the minimum metadata required to isolate requests and account for usage.

### 5. Add an upstream identity integration point, not a registration system

If another service owns registration, this service should integrate through one narrow path:

- admin-only provisioning/sync endpoint, or
- signed webhook/event ingestion endpoint

Use Zod for payload validation. Accept only:

- external user ID
- display name
- active/deleted/disabled state
- quotas
- model allowlist

Do not accept or generate signup artifacts.

Why this matters: this keeps the service aligned with its new boundary while still letting an upstream system create, disable, and reconcile user identities.

## Installation

```bash
# Core
# no new runtime packages required

# Supporting
# no new packages required

# Dev dependencies
# no new packages required
```

## Alternatives Considered

| Recommended                                        | Alternative                                   | When to Use Alternative                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hono ownership middleware + existing `UserContext` | New auth framework                            | Only if the product later expands into full SSO/session auth, which this milestone explicitly avoids.                                                  |
| Tombstoned users with revoked keys                 | Hard-delete users                             | Only if retained accounting is no longer required, which conflicts with this milestone.                                                                |
| Session-root ownership with tighter FK chain       | Add `user_id` to every message and part row   | Only if direct child-table ownership queries become dominant and duplication is worth the consistency cost. For now, keep ownership rooted at session. |
| Narrow sync/provisioning endpoint                  | Rebuild signup/onboarding inside this service | Never for this milestone.                                                                                                                              |

## What NOT to Use

| Avoid                                                                   | Why                                                                                   | Use Instead                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Auth.js / Clerk / Better Auth / Ory / Supabase Auth inside this service | Expands scope into registration and user-lifecycle product work                       | Keep API key auth here and let the upstream service own registration.     |
| JWT/session-cookie rollout                                              | `PROJECT.md` explicitly keeps JWT out of scope and API key auth is already sufficient | Keep current API key auth.                                                |
| New password, invite, reset, verification tables                        | Recreates the registration surface this milestone is removing                         | Store only isolation/accounting metadata.                                 |
| Hard-delete user records by default                                     | Breaks retained usage accounting or forces lossy nulling                              | Tombstone users, revoke keys, and hide usage endpoints for deleted users. |
| New database or external billing/metering stack                         | Unnecessary for this milestone; SQLite is already sufficient                          | Tighten Drizzle schema and queries in place.                              |

## Stack Patterns by Variant

**If the upstream identity service pushes lifecycle events:**

- Keep Hono + Zod
- Add one signed sync/webhook endpoint
- Persist `external_id`, `status`, and quota fields only

**If this service remains admin-provisioned for now:**

- Keep current admin endpoints
- Reframe them as provisioning/deactivation, not signup
- Do not add email/password or onboarding behavior

## Version Compatibility

| Package A            | Compatible With                          | Notes                                                                                            |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Bun 1.3.10           | Drizzle bun-sqlite 1.0.0-beta.16-ea816b6 | Existing repo already uses this successfully and enables SQLite foreign keys at connection open. |
| Hono 4.10.7          | hono-openapi 1.1.2                       | Good fit for typed route middleware and request validation.                                      |
| Hono 4.10.7          | Zod 4.1.8                                | Matches the current validation stack.                                                            |
| Effect 4.0.0-beta.31 | Existing `Context.create` / ALS pattern  | Good fit for keeping identity and ownership helpers inside existing service boundaries.          |

## Sources

- Hono Context docs — request-scoped variables via `c.set` / `c.get`: https://hono.dev/docs/api/context
- Hono middleware guide — early exit and typed custom middleware: https://hono.dev/docs/guides/middleware
- Drizzle indexes and constraints docs — SQLite foreign keys, composite keys, indexes: https://orm.drizzle.team/docs/indexes-constraints
- SQLite foreign key docs — enforcement requires `PRAGMA foreign_keys = ON`, child-key indexes recommended: https://www.sqlite.org/foreignkeys.html
- Zod docs — current Zod 4 status and validation role: https://zod.dev/
- Existing codebase: `packages/opencode/src/storage/db.ts`, `packages/opencode/src/server/server.ts`, `packages/opencode/src/server/user-auth.ts`, `packages/opencode/src/session/session.sql.ts`, `packages/opencode/src/session/index.ts`, `packages/opencode/src/user/index.ts`, `packages/opencode/src/user/user.sql.ts`, `packages/opencode/src/user/usage.sql.ts`

---

_Stack research for: OpenCode Multi-User Isolation v1.1 boundary tightening_
_Researched: 2026-03-18_
