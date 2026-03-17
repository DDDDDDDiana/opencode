# OpenCode Multi-User Isolation

## What This Is

OpenCode is an AI-powered coding assistant CLI and server. This project adds multi-user isolation to OpenCode running in service mode — enabling multiple users to share a single OpenCode server instance with fully isolated sessions, independent quotas, and per-user configuration.

## Core Value

Each user's sessions, messages, and agent interactions are completely isolated from other users — no data leakage, no shared state.

## Current State

`v1.0` is complete and ships OpenCode Multi-User Isolation.

Delivery covered API authentication, user-scoped session ownership, admin user management, usage tracking and quotas, model allowlist enforcement, and follow-up testing and typecheck cleanup. A milestone audit was reviewed before release, and the remaining gaps were accepted as tech debt.

## Current Milestone: v1.1 Isolation Boundary Tightening

**Goal:** Narrow this service to multi-user isolation and related backend safeguards while moving registration responsibilities out to the frontend and a separate service.

**Target features:**

- Complete end-to-end ownership enforcement for session-derived resources
- Preserve per-user token and usage accounting as a first-class service capability
- Clarify and enforce service boundaries around user registration and lifecycle ownership
- Close archived validation and evidence gaps from `v1.0`

## Requirements

### Validated

- ✓ OpenCode server runs with directory/workspace-based isolation — existing
- ✓ Sessions persist to SQLite via Drizzle ORM — existing
- ✓ Basic auth via `OPENCODE_SERVER_PASSWORD` env var — existing
- ✓ Instance context isolated per directory via AsyncLocalStorage — existing
- ✓ API key auth with bcrypt hashing — `v1.0`
- ✓ `UserContext` propagation alongside `Instance` — `v1.0`
- ✓ Per-user session ownership with anonymous fallback — `v1.0`
- ✓ Ownership-preserving fork and remove flows — `v1.0`
- ✓ Admin user CRUD endpoints — `v1.0`
- ✓ Per-user usage statistics API — `v1.0`
- ✓ Usage recording and quota enforcement — `v1.0`
- ✓ Model allowlist enforcement in provider resolution — `v1.0`

### Active

- [ ] Enforce session ownership on message and part routes so isolation holds end-to-end
- [ ] Preserve per-user token and usage statistics while tightening service boundaries
- [ ] Remove user registration responsibility from this project and document the new boundary clearly
- [ ] Add missing phase `*-VALIDATION.md` artifacts for archived milestone evidence

### Out of Scope

- JWT authentication — API key is sufficient for service mode; JWT adds complexity without clear benefit
- Soft quota limits (model downgrade) — hard reject on limit exceeded; simpler and more predictable
- External quota systems — SQLite persistence is sufficient; no external billing/metering integration
- UI for user management — API only; admin tooling is out of scope for v1
- User registration, signup UX, and onboarding flows — owned by the frontend and another service in `v1.1`
- Per-user file system isolation — users share the same directory context; isolation is at session/data layer only
- Holding `v1.0` for the accepted audit gaps — follow-up work moves to the next milestone

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

Current codebase snapshot:

- `v1.0` shipped across 4 phases, 17 plans, and 30 tracked tasks
- Milestone git range: `afb96e4f9` -> `8a192022f`
- Timeline: 2026-03-17 -> 2026-03-18
- Change volume: 69 files changed, +9670 / -20
- `packages/opencode/src` currently contains 51,565 lines of TypeScript

Current product boundary for `v1.1`:

- Frontend plus another service own user registration and onboarding flows
- This project remains responsible for authenticated multi-user isolation, ownership checks, and usage/token accounting
- Any user-facing identity lifecycle handled here must support isolation needs, not become a second registration system

## Constraints

- **Compatibility**: No breaking changes to existing single-user / no-auth usage — `user_id` nullable, anonymous requests still work
- **Runtime**: Bun + TypeScript, Effect 4 service patterns where applicable
- **Database**: Drizzle ORM, SQLite, migrations via `bun run db generate --name <slug>`
- **Style**: Follow AGENTS.md — single-word vars, no destructuring, functional style, snake_case SQL columns
- **No new frameworks**: Use existing patterns (ALS context, Hono middleware, Drizzle tables)

## Key Decisions

| Decision                                          | Rationale                                              | Outcome    |
| ------------------------------------------------- | ------------------------------------------------------ | ---------- |
| API key auth (not JWT)                            | Simpler, sufficient for service mode                   | ✓ Good     |
| Hard quota rejection (not soft downgrade)         | Predictable behavior, easier to reason about           | ✓ Good     |
| Parallel UserContext ALS (not extending Instance) | Keeps Instance clean, follows WorkspaceContext pattern | ✓ Good     |
| `user_id` nullable on SessionTable                | Backward compatible with existing deployments          | ✓ Good     |
| Ship `v1.0` with documented audit gaps            | Preserve release momentum and track gaps explicitly    | ⚠ Revisit |
| Registration flows live outside this service      | Keep this project focused on isolation and usage       | — Pending  |

## Next Milestone Goals

- Close the message and part ownership gap so session isolation is complete end-to-end
- Keep per-user token and usage accounting intact while boundaries shift around registration ownership
- Make the project boundary explicit so registration stays outside this service
- Restore missing validation artifacts and improve milestone evidence completeness
- Build on the shipped isolation baseline without reopening `v1.0` scope

---

_Last updated: 2026-03-18 after starting `v1.1` milestone_
