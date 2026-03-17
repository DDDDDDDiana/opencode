# Domain Pitfalls: Multi-User Isolation Retrofit

**Domain:** Adding user identity + isolation to an existing single-user service
**Researched:** 2026-03-17
**Confidence:** HIGH — grounded in codebase analysis + Node.js ALS official docs + OWASP

---

## Critical Pitfalls

Mistakes that cause data leakage, security incidents, or full rewrites.

---

### Pitfall 1: ALS Context Lost Across Native Callbacks

**What goes wrong:** `UserContext.use()` returns `undefined` inside callbacks passed to native C/C++ addons (`@parcel/watcher`, `node-pty`, native `fs.watch`). The user identity silently disappears mid-request, causing the code to fall through to the anonymous path — or throw `Context.NotFound`.

**Why it happens:** Node.js ALS propagates through `Promise`, `setTimeout`, and `EventEmitter` automatically. It does NOT propagate through native addon callbacks because those fire outside the JS async context chain. The existing `Instance.bind()` utility exists precisely for this reason (see `instance.ts` line 109) — but it only wraps `Instance` context, not `UserContext`.

**Consequences:** Agent runs that spawn file watchers or pty processes lose user identity mid-execution. Quota checks and session ownership filters silently use `undefined` user, bypassing enforcement entirely.

**Prevention:**

- Mirror `Instance.bind()` on `UserContext` — capture and restore both contexts together.
- Wherever `Instance.bind(fn)` is called, wrap with `UserContext.bind(fn)` in the same call site.
- Add a `Context.NotFound` handler in the agent loop that hard-fails rather than silently continuing as anonymous.

**Warning signs:**

- Quota not being enforced on long-running agent sessions
- Sessions appearing in the anonymous pool after being created by an authenticated user
- `UserContext.use()` throwing `Context.NotFound` inside `@parcel/watcher` callbacks

**Phase:** UserContext ALS layer (Phase 1)

---

### Pitfall 2: Missing `user_id` Filter on Every Query Path

**What goes wrong:** `user_id` is added to `SessionTable` and the primary `list()` function is filtered — but `listGlobal()`, `children()`, `fork()`, `get()`, and `remove()` are left unfiltered. Any of these becomes a cross-user data leak.

**Why it happens:** In `session/index.ts`, there are at least 6 distinct query paths (`list`, `listGlobal`, `children`, `get`, `fork`, `remove`). The natural instinct is to fix the obvious list endpoint and miss the others. `get()` in particular is called by nearly every other function — if it doesn't enforce ownership, every downstream caller inherits the leak.

**Consequences:** User A can read, fork, or delete User B's sessions by guessing or enumerating session IDs. Session IDs use descending ULIDs which are time-ordered and guessable.

**Prevention:**

- Treat `get()` as the ownership gate: add `and(eq(SessionTable.id, id), or(eq(SessionTable.user_id, ctx.userID), isNull(SessionTable.user_id)))` — all callers inherit the check for free.
- Write an explicit test matrix: for each exported function in `session/index.ts`, assert that User A cannot access User B's resource.
- `listGlobal()` is the admin/global view — decide explicitly whether it should be user-scoped or admin-only, and enforce that decision.

**Warning signs:**

- `fork()` succeeds when called with another user's `sessionID`
- `children()` returns sessions owned by a different user
- No ownership check in `remove()` before cascade delete

**Phase:** Session ownership (Phase 2)

---

### Pitfall 3: API Keys Stored or Compared in Plaintext

**What goes wrong:** API keys are stored as raw strings in the `UserTable` and compared with `===`. If the database is ever read (backup leak, SQLite file exposure, log line), all keys are immediately usable.

**Why it happens:** The existing auth model (`OPENCODE_SERVER_PASSWORD`) is a single env var compared directly — no hashing. The natural extension is to do the same for per-user keys.

**Consequences:** A single database file leak compromises every user's API key permanently. Keys in logs (error messages, debug output) are immediately exploitable.

**Prevention:**

- Store `SHA-256(key)` in the database, never the raw key. Issue the raw key once at creation, never store it.
- Compare `SHA-256(incoming)` against stored hash — constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- Never log the raw key. Log only the first 8 chars + `...` for traceability.
- The existing `CONCERNS.md` flags direct `process.env` token access as a security risk — apply the same discipline here.

**Warning signs:**

- `user_api_key` column type is `text()` with no indication of hashing
- Key comparison done with `===` or `eq()` directly on the raw value
- API key appearing in any log line or error message

**Phase:** User identity / API key auth (Phase 1)

---

### Pitfall 4: Quota Checked Once, Not Enforced at the Enforcement Point

**What goes wrong:** Quota is checked at session creation ("can this user start a session?") but not inside the agent loop. A user who hits quota mid-run continues consuming tokens until the current agent call completes.

**Why it happens:** It feels sufficient to gate at the entry point. But `session/prompt.ts` runs a multi-turn agent loop — a single "session" can make dozens of LLM calls. The quota check needs to live inside the loop, not just at the door.

**Consequences:** A user at 0 remaining quota can still exhaust their daily token cap if they have an active session. With concurrent sessions, multiple loops run simultaneously and all read the same stale quota value before any of them writes back.

**Prevention:**

- Check quota inside the agent loop in `prompt.ts` before each LLM call, not just at `Session.create()`.
- Use a SQLite transaction with `UPDATE ... WHERE remaining > 0 RETURNING remaining` — atomic decrement that fails if quota is already 0. This prevents the TOCTOU race between concurrent sessions.
- Return a typed `QuotaExceededError` that the loop surfaces cleanly rather than a generic 500.

**Warning signs:**

- Quota check only in the HTTP handler / session creation path
- Token usage written to DB after the LLM call returns, not decremented before
- No test for two concurrent sessions racing against the same quota

**Phase:** Quota enforcement (Phase 3)

---

### Pitfall 5: Bus Events Broadcast Across User Boundaries

**What goes wrong:** `Bus.publish(Event.Updated, { info })` in `session/index.ts` fires on every session mutation. If the Bus is a global event emitter (not scoped to user), all connected SSE/WebSocket clients receive all events regardless of which user owns the session.

**Why it happens:** In single-user mode, broadcasting everything is fine — there's only one consumer. The Bus was never designed with user-scoped subscriptions. Adding `user_id` to sessions without also scoping Bus subscriptions means the event layer leaks what the DB layer now hides.

**Consequences:** User A's client receives real-time updates for User B's agent runs — session titles, diffs, cost data, message content.

**Prevention:**

- Add `userID` to event payloads on all session/message events.
- In the SSE/WebSocket handler, filter incoming Bus events against the authenticated user's ID before forwarding to the client.
- Alternatively, scope Bus instances per user — but filtering at the subscriber is simpler and consistent with the existing `WorkspaceContext` pattern.

**Warning signs:**

- Bus event payloads have no `userID` field
- SSE handler subscribes to all events without filtering
- No test asserting User B's client does not receive User A's `session.updated` event

**Phase:** Session ownership + real-time layer (Phase 2)

---

### Pitfall 6: `enterWith()` Used Instead of `run()` for UserContext

**What goes wrong:** `asyncLocalStorage.enterWith(store)` is used to set the user context in middleware instead of `asyncLocalStorage.run(store, fn)`. This "bleeds" the context for the remainder of the synchronous execution frame — subsequent unrelated event handlers on the same tick inherit the wrong user context.

**Why it happens:** `enterWith` looks simpler in middleware — no callback wrapping needed. The existing `WorkspaceContext.provide()` correctly uses `run()` (via `Context.create` → `storage.run()`), but it's easy to reach for `enterWith` when writing new middleware.

**Consequences:** Under concurrent requests, a later request's handler may briefly execute with a previous request's user context. This is a subtle, non-deterministic cross-user data access bug that only manifests under load.

**Prevention:**

- Always use `context.provide(value, fn)` (which wraps `storage.run()`) — never call `storage.enterWith()` directly.
- The existing `Context.create` utility in `util/context.ts` only exposes `provide()` and `use()` — use it for `UserContext` too, never bypass it with raw ALS access.
- The Node.js docs explicitly warn: "run() should be preferred over enterWith() unless there are strong reasons to use the latter."

**Warning signs:**

- Any call to `.enterWith()` in middleware or request handlers
- UserContext implemented as a raw `AsyncLocalStorage` rather than through `Context.create()`
- Context set before `await` without wrapping the downstream work in `run()`

**Phase:** UserContext ALS layer (Phase 1)

---

## Moderate Pitfalls

---

### Pitfall 7: Anonymous Fallback Silently Widens Access

**What goes wrong:** The `user_id nullable` backward-compatibility decision means unauthenticated requests see sessions where `user_id IS NULL`. If existing sessions were created before the migration (all have `user_id = NULL`), an anonymous request sees the entire historical session corpus.

**Why it happens:** The intent is "anonymous requests see only unowned sessions." But pre-migration sessions are all unowned by definition. The anonymous fallback becomes a full data dump for anyone who hits the server without an API key.

**Prevention:**

- On migration, backfill a sentinel `user_id` (e.g. `"legacy"`) for all existing sessions, or mark them with a `migrated_at` timestamp.
- Alternatively, make anonymous access return an empty set by default, with an explicit opt-in flag (`OPENCODE_ALLOW_ANONYMOUS=true`) for single-user deployments.
- Document the decision explicitly — "anonymous sees NULL-owned sessions" is a security policy, not just a default.

**Warning signs:**

- Migration script sets `user_id = NULL` on all existing rows (i.e. does nothing)
- No test asserting what an unauthenticated request returns after migration

**Phase:** DB migration (Phase 2)

---

### Pitfall 8: Model Allowlist Enforced Only at Request Time, Not in Agent Sub-calls

**What goes wrong:** The per-user model allowlist is checked when the user explicitly selects a model. But `session/prompt.ts` can spawn child sessions (sub-agents) that inherit or override the model. Child sessions bypass the allowlist check if it only lives in the top-level HTTP handler.

**Why it happens:** Sub-agent spawning is an internal call path, not an HTTP request — it never passes through the middleware that enforces the allowlist.

**Prevention:**

- Enforce the model allowlist inside the provider resolution layer, not just in HTTP middleware. The check should be: "does the current UserContext permit this modelID?" — called wherever a model is resolved, including sub-agent spawns.
- Add a test: create a user with a restricted allowlist, spawn a child session, assert the child cannot use a disallowed model.

**Warning signs:**

- Allowlist check only in the Hono route handler
- `createNext()` in `session/index.ts` does not consult UserContext for model validation

**Phase:** Quota + model enforcement (Phase 3)

---

### Pitfall 9: Timing-Based API Key Enumeration

**What goes wrong:** API key lookup uses a standard DB query (`WHERE api_key_hash = ?`). If the key doesn't exist, the query returns fast. If it exists but is revoked, additional logic runs. The difference in response time leaks whether a key exists.

**Why it happens:** Standard "check then act" auth logic. Not a concern in single-user mode.

**Prevention:**

- Always run the same code path regardless of lookup result — look up the key, then check status, in constant time.
- Use `crypto.timingSafeEqual` for the hash comparison step.
- Return `401` for both "key not found" and "key revoked" — don't distinguish in the response.

**Warning signs:**

- Early return on key-not-found before running the same validation steps as key-found
- Different error messages for "invalid key" vs "revoked key"

**Phase:** User identity / API key auth (Phase 1)

---

### Pitfall 10: Usage Tracking Written After LLM Response, Lost on Crash

**What goes wrong:** Token usage is recorded after the LLM call completes. If the process crashes or the request is aborted mid-stream, the usage is never written. Over time, actual consumption diverges from tracked consumption — quota becomes meaningless.

**Why it happens:** It's natural to write usage when you have the full response. Streaming responses make this harder because usage arrives at the end of the stream.

**Prevention:**

- Write a "pending" usage record before the LLM call, update it on completion. On startup, sweep for pending records older than N minutes and mark them as best-effort complete.
- Alternatively, accept some under-counting and add a safety margin to quota limits (e.g. enforce at 90% of the configured cap).
- The existing `getUsage()` in `session/index.ts` already handles the token math — the gap is persistence timing, not calculation.

**Warning signs:**

- Usage INSERT only in the success path after `streamText` resolves
- No handling for aborted streams in the usage accounting path

**Phase:** Usage tracking (Phase 3)

---

## Minor Pitfalls

---

### Pitfall 11: User Management Endpoints Not Separated from User Endpoints

**What goes wrong:** Admin endpoints (`POST /users`, `DELETE /users/:id`, `PUT /users/:id/quota`) are protected only by the same API key auth as regular user endpoints. A user who discovers the admin routes can manage other users.

**Prevention:**

- Protect admin endpoints with a separate `OPENCODE_ADMIN_KEY` env var (or the existing `OPENCODE_SERVER_PASSWORD`), checked in a dedicated middleware layer before the user auth middleware.
- Keep admin routes on a distinct path prefix (`/admin/...`) so they're easy to firewall.

**Warning signs:**

- Admin routes use the same `userAuth` middleware as session routes
- No separate admin credential check

**Phase:** User management API (Phase 2)

---

### Pitfall 12: `share_url` Leaks Sessions Across User Boundaries

**What goes wrong:** `Session.share()` creates a public URL for a session. In multi-user mode, a user can share any session they can read — but the share URL is globally accessible with no user check. If the share service doesn't embed user ownership, a shared URL from User A is indistinguishable from one from User B.

**Prevention:**

- Ensure `ShareNext.create()` embeds the `user_id` in the share payload or validates ownership before creating the share.
- `Session.share()` should verify the caller owns the session before delegating to `ShareNext`.

**Warning signs:**

- `share()` in `session/index.ts` does not check `UserContext` before calling `ShareNext.create()`
- Share tokens are opaque and don't encode ownership

**Phase:** Session ownership (Phase 2)

---

## Phase-Specific Warnings

| Phase Topic           | Likely Pitfall                                     | Mitigation                                        |
| --------------------- | -------------------------------------------------- | ------------------------------------------------- |
| UserContext ALS layer | `enterWith` bleed (Pitfall 6)                      | Use `Context.create` utility, never raw ALS       |
| UserContext ALS layer | Context lost in native callbacks (Pitfall 1)       | Mirror `Instance.bind` for UserContext            |
| API key auth          | Plaintext storage (Pitfall 3)                      | SHA-256 hash at write, timingSafeEqual at compare |
| API key auth          | Timing enumeration (Pitfall 9)                     | Constant-time lookup path                         |
| Session ownership DB  | Missing filter on non-list queries (Pitfall 2)     | Gate at `get()`, test all 6 query paths           |
| Session ownership DB  | Anonymous fallback exposes legacy data (Pitfall 7) | Backfill sentinel user_id on migration            |
| Real-time / Bus       | Events broadcast cross-user (Pitfall 5)            | Filter Bus events by userID at subscriber         |
| Quota enforcement     | Checked at entry, not in agent loop (Pitfall 4)    | Atomic decrement inside prompt loop               |
| Quota enforcement     | Sub-agent model allowlist bypass (Pitfall 8)       | Enforce at provider resolution, not HTTP layer    |
| Usage tracking        | Lost on crash (Pitfall 10)                         | Pending record pattern or startup sweep           |
| User management API   | Admin routes unprotected (Pitfall 11)              | Separate admin credential middleware              |
| Share feature         | Cross-user share leak (Pitfall 12)                 | Ownership check before ShareNext.create           |

---

## Sources

- Node.js official docs — AsyncLocalStorage, context loss troubleshooting: https://nodejs.org/api/async_context.html#troubleshooting-context-loss
- OWASP REST Security Cheat Sheet — API keys, timing attacks, error handling: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- Codebase analysis: `packages/opencode/src/util/context.ts`, `instance.ts`, `workspace-context.ts`, `session/index.ts`, `session/session.sql.ts`
- Project requirements: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`
