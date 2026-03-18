# OpenCode Multi-User Isolation

## What This Is

OpenCode is an AI-powered coding assistant CLI and server. This project adds multi-user isolation to OpenCode running in service mode — enabling multiple users to share a single OpenCode server instance with fully isolated sessions, independent quotas, and per-user configuration.

## Core Value

Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

## Current Milestone: v1.2 禁止匿名模式

**Goal:** Require API key authentication for all requests — remove anonymous fallback

**Target features:**

- Reject all requests without valid API key
- Remove anonymous session access
- Enforce authentication at middleware level

## Requirements

### Validated

- ✓ OpenCode server runs with directory/workspace-based isolation — v1.0
- ✓ Sessions persist to SQLite via Drizzle ORM — v1.0
- ✓ Basic auth via `OPENCODE_SERVER_PASSWORD` env var — v1.0
- ✓ Instance context isolated per directory via AsyncLocalStorage — v1.0
- ✓ User identity layer — API key authentication per request — v1.0
- ✓ UserContext propagated through AsyncLocalStorage alongside Instance — v1.0
- ✓ Sessions owned by users — `user_id` on SessionTable, queries filtered by user — v1.0
- ✓ Per-user quotas — agent call limit, concurrent session limit, daily token cap — v1.0
- ✓ Per-user model allowlist — restrict which models a user can invoke — v1.0
- ✓ User management API — CRUD endpoints for users and quota configuration — v1.0
- ✓ Usage tracking — per-user token consumption recorded to database — v1.0
- ✓ Anonymous fallback — requests without API key see only unowned sessions — v1.0, v1.1
- ✓ Session-derived routes enforce ownership — v1.1
- ✓ Service boundary clarity with admin API documentation — v1.1
- ✓ Usage accounting preserved across ownership changes — v1.1

### Active

- [ ] Mandatory authentication — all requests require valid API key
- [ ] Remove anonymous fallback logic from UserContext
- [ ] Return 401 Unauthorized for missing/invalid API keys

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

- **Breaking change**: v1.2 removes anonymous access — deployments must provision users before upgrade
- **Runtime**: Bun + TypeScript, Effect 4 service patterns where applicable
- **Database**: Drizzle ORM, SQLite, migrations via `bun run db generate --name <slug>`
- **Style**: Follow AGENTS.md — single-word vars, no destructuring, functional style, snake_case SQL columns
- **No new frameworks**: Use existing patterns (ALS context, Hono middleware, Drizzle tables)

## Key Decisions

| Decision                                          | Rationale                                              | Outcome |
| ------------------------------------------------- | ------------------------------------------------------ | ------- |
| API key auth (not JWT)                            | Simpler, sufficient for service mode                   | ✓ Good  |
| Hard quota rejection (not soft downgrade)         | Predictable behavior, easier to reason about           | ✓ Good  |
| Parallel UserContext ALS (not extending Instance) | Keeps Instance clean, follows WorkspaceContext pattern | ✓ Good  |
| user_id nullable on SessionTable                  | Backward compatible with existing deployments          | ✓ Good  |
| Remove anonymous fallback in v1.2                 | Simplifies security model, enforces isolation          | Pending |

---

_Last updated: 2026-03-18 after v1.2 milestone start_
