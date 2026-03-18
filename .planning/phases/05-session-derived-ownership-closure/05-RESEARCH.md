---
phase: 05-session-derived-ownership-closure
date: 2026-03-18
discovery_level: 0
phase_requirements:
  - SESS-07
  - SESS-08
  - SESS-09
---

# Phase 5 Research — Session-Derived Ownership Closure

## Question

What does Phase 5 need so message- and part-derived routes enforce the same session ownership boundary already used by `Session.get()`?

## Findings

### Existing ownership primitive

- `packages/opencode/src/session/index.ts`
  - `Session.get(id)` already enforces ownership by applying `SessionTable.user_id` filtering from `UserContext.get()`.
  - Authenticated callers match `user_id`; anonymous callers only see `NULL user_id` sessions.
  - Unauthorized access intentionally returns `NotFoundError`/404.

### Current gap

- `packages/opencode/src/server/routes/session.ts`
  - `GET /:sessionID/message` calls `MessageV2.page()` directly when pagination is used.
  - `GET /:sessionID/message/:messageID` calls `MessageV2.get()` directly.
  - `DELETE /:sessionID/message/:messageID`, `DELETE /:sessionID/message/:messageID/part/:partID`, and `PATCH /:sessionID/message/:messageID/part/:partID` mutate message/part rows without first asserting session ownership.
- `packages/opencode/src/session/message-v2.ts`
  - `page()` and `get()` only scope by `session_id` and `message_id`; they do not consult `UserContext`.
- `packages/opencode/src/session/index.ts`
  - `removeMessage()`, `removePart()`, and `updatePart()` scope by ids, not ownership.

### Recommended approach

- Reuse `Session.get(sessionID)` as the single ownership guard.
- Add one shared helper in `packages/opencode/src/server/routes/session.ts` so every session-derived message/part route calls the same guard before loading or mutating protected data.
- Keep failure mode as existing 404 behavior; do not introduce 403s or route-specific auth branches.
- Preserve anonymous legacy support by allowing requests when the session has `user_id = NULL` and the caller is anonymous.

### Test strategy

- Add focused server integration coverage in `packages/opencode/test/server/`.
- Build fixtures with real `User.create()`, `Session.create()`, `Session.updateMessage()`, and `Session.updatePart()`.
- Exercise requests through `Server.Default()` using `x-opencode-api-key` headers for authenticated users and no header for anonymous callers.
- Cover:
  1. owner can read messages and message-with-parts
  2. different user gets 404 on those reads
  3. anonymous caller can still read legacy anonymous session data
  4. different user cannot delete message / delete part / patch part

## Standard Stack

- Bun test runner
- Hono routes with `validator()` / `describeRoute()`
- Existing `UserContext` + `Session.get()` ownership model
- Real SQLite-backed integration tests via `Instance.provide()`

## Architecture Patterns

- Enforce isolation at the query or route boundary, not in ad-hoc handler branches.
- Reuse existing `NotFoundError` semantics so unauthorized and missing resources stay indistinguishable.
- Prefer one shared helper for all session-derived routes to avoid future drift.

## Don't Hand Roll

- Do not add a second ownership algorithm for messages or parts.
- Do not add new auth middleware or new dependencies.
- Do not special-case authenticated vs anonymous flows beyond what `Session.get()` already does.

## Common Pitfalls

- Guarding only non-paginated message reads and forgetting `MessageV2.page()` path.
- Guarding reads but leaving delete/update part handlers unprotected.
- Returning 403 instead of preserving current 404 anti-enumeration behavior.
- Breaking anonymous backward compatibility by rejecting `NULL user_id` sessions.

## Validation Architecture

- Quick command: `bun test test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000`
- Full command: `bun test test/server/session-messages.test.ts test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000`
- Expected runtime: under 30 seconds from `packages/opencode`
- Existing test infrastructure is sufficient; no Wave 0 test scaffolding needed.
