# OpenCode Multi-User Isolation

## What This Is

OpenCode is an AI-powered coding assistant CLI and server. This project adds multi-user isolation to OpenCode running in service mode — enabling multiple users to share a single OpenCode server instance with fully isolated sessions, independent quotas, and per-user configuration.

## Core Value

Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

## Requirements

### Validated

- ✓ OpenCode server runs with directory/workspace-based isolation — existing
- ✓ Sessions persist to SQLite via Drizzle ORM — existing
- ✓ Basic auth via `OPENCODE_SERVER_PASSWORD` env var — existing
- ✓ Instance context isolated per directory via AsyncLocalStorage — existing

### Active

- [ ] User identity layer — API key authentication per request
- [ ] UserContext propagated through AsyncLocalStorage alongside Instance
- [ ] Sessions owned by users — `user_id` on SessionTable, queries filtered by user
- [ ] Per-user quotas — agent call limit, concurrent session limit, daily token cap
- [ ] Per-user model allowlist — restrict which models a user can invoke
- [ ] User management API — CRUD endpoints for users and quota configuration
- [ ] Usage tracking — per-user token consumption recorded to database
- [ ] Anonymous fallback — requests without API key see only unowned sessions (backward compatible)

### Out of Scope

- JWT authentication — API key is sufficient for service mode; JWT adds complexity without clear benefit
- Soft quota limits (model downgrade) — hard reject on limit exceeded; simpler and more predictable
- External quota systems — SQLite persistence is sufficient; no external billing/metering integration
- UI for user management — API only; admin tooling is out of scope for v1
- Per-user file system isolation — users share the same directory context; isolation is at session/data layer only

## Context

This is a brownfield project. The existing codebase has:

- `Instance` — per-directory AsyncLocalStorage context (`src/project/instance.ts`)
- `Account` module — existing OAuth account for opencode.ai cloud, NOT multi-user auth
- `SessionTable` — has `workspace_id` but no `user_id`; all sessions visible to any requester on same directory
- Server auth — single global password via `OPENCODE_SERVER_PASSWORD`; no per-user identity
- `WorkspaceContext` — parallel ALS context pattern already established (good model to follow)

Key integration points:

- `packages/opencode/src/server/server.ts` — middleware chain, add user auth here
- `packages/opencode/src/session/session.sql.ts` — add `user_id` column
- `packages/opencode/src/session/index.ts` — filter all queries by `user_id`
- `packages/opencode/src/session/prompt.ts` — enforce agent call limits in loop

## Constraints

- **Compatibility**: No breaking changes to existing single-user / no-auth usage — `user_id` nullable, anonymous requests still work
- **Runtime**: Bun + TypeScript, Effect 4 service patterns where applicable
- **Database**: Drizzle ORM, SQLite, migrations via `bun run db generate --name <slug>`
- **Style**: Follow AGENTS.md — single-word vars, no destructuring, functional style, snake_case SQL columns
- **No new frameworks**: Use existing patterns (ALS context, Hono middleware, Drizzle tables)

## Key Decisions

| Decision                                          | Rationale                                              | Outcome   |
| ------------------------------------------------- | ------------------------------------------------------ | --------- |
| API key auth (not JWT)                            | Simpler, sufficient for service mode                   | — Pending |
| Hard quota rejection (not soft downgrade)         | Predictable behavior, easier to reason about           | — Pending |
| Parallel UserContext ALS (not extending Instance) | Keeps Instance clean, follows WorkspaceContext pattern | — Pending |
| user_id nullable on SessionTable                  | Backward compatible with existing deployments          | — Pending |

---

_Last updated: 2026-03-17 after initialization_
