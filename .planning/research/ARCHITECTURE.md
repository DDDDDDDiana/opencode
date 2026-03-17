# Architecture Research

**Domain:** Isolation-boundary tightening for OpenCode multi-user service mode
**Researched:** 2026-03-18
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ External identity owner                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Frontend + separate registration service                                    │
│  - owns signup/onboarding                                                   │
│  - pushes minimal user lifecycle state into OpenCode                        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ bounded sync API / webhook / admin channel
┌────────────────────────────────▼──────────────────────────────────────────────┐
│ OpenCode request boundary                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  basic auth (stable) → API key resolve (stable) → UserContext ALS (stable)  │
│                      → WorkspaceContext ALS (stable) → Instance ALS (stable) │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
┌────────────────────────────────▼──────────────────────────────────────────────┐
│ Isolation domain services                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Session access guard   Message/part handlers   Usage recorder   Quota/model │
│  - require owned root   - require owned root    - append-only    checks      │
│  - reuse Session.get    - no direct row reads   - per user       - local     │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
┌────────────────────────────────▼──────────────────────────────────────────────┐
│ Persistence                                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ user (minimal projection + tombstone)   api_key   session(owner_id stable)  │
│ message / part (derive ownership from session)   usage (append-only ledger)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component                     | Responsibility                                                                              | Typical Implementation                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `server/server.ts`            | Keep middleware order stable and provide identity before route logic                        | Hono middleware with `resolve()` then `UserContext.provide()`          |
| `user` domain                 | Store the minimal local projection needed for authz, quotas, allowlists, and deletion state | Existing `packages/opencode/src/user/*` with small schema change       |
| `session` domain              | Remain the ownership root for all session-derived resources                                 | Existing `Session.get/list/createNext` plus a new shared access helper |
| `message-v2` + session routes | Treat messages and parts as session-scoped, never independently owned                       | Existing message/part APIs guarded by `Session` ownership check        |
| `usage` domain                | Preserve per-user token accounting even after lifecycle changes                             | Existing `Usage.record/stats` kept append-only                         |
| external lifecycle boundary   | Provision/deactivate users without reintroducing registration into this service             | Narrow sync contract, not full signup CRUD                             |

## Recommended Project Structure

```text
packages/opencode/src/
├── server/
│   ├── server.ts              # stable middleware order and ALS wiring
│   ├── user-auth.ts           # API key -> local active user resolution
│   └── routes/
│       ├── session.ts         # add ownership guard on message/part endpoints
│       └── user.ts            # narrow to sync/admin/accounting surface
├── user/
│   ├── index.ts               # upsert/deactivate/get-active helpers
│   ├── user.sql.ts            # add deletion/tombstone state, keep minimal fields
│   └── usage.ts               # stable append-only accounting API
├── session/
│   ├── index.ts               # central session access helper; stable owner root
│   ├── message-v2.ts          # defense-in-depth on page/get helpers
│   └── session.sql.ts         # keep `user_id`; do not null on deletion
└── storage/
    └── schema.ts              # stable schema exports
```

### Structure Rationale

- **`server/`:** boundary enforcement belongs at request ingress; this is where ownership gaps on message/part routes should close.
- **`user/`:** keep only local identity projection and accounting policy here; do not let it regrow into a registration system.
- **`session/`:** session remains the canonical ownership anchor; messages and parts should never invent separate ownership logic.

## Architectural Patterns

### Pattern 1: Session-rooted authorization

**What:** every read/write on messages or parts first proves access to the parent session.
**When to use:** any route or helper that accepts `sessionID`, `messageID`, or `partID`.
**Trade-offs:** one extra lookup, but it removes the current “derived resources bypass root ownership” gap.

**Example:**

```typescript
await Session.get(sessionID)
return MessageV2.get({ sessionID, messageID })
```

**Recommendation:** add a dedicated helper such as `Session.access(sessionID)` or `Session.require(sessionID)` and call it from:

- `packages/opencode/src/server/routes/session.ts`
- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/src/session/index.ts` for `removeMessage`, `removePart`, and `updatePart` defense-in-depth

This should be the main milestone change.

### Pattern 2: Local user projection, external lifecycle ownership

**What:** OpenCode keeps a small local `user` record for runtime enforcement, while registration/onboarding remain external.
**When to use:** provisioning, quota changes, allowlist changes, deletion/deactivation.
**Trade-offs:** duplicated minimal metadata locally, but avoids synchronous coupling to another service during request handling.

**Example:**

```typescript
type UserProjection = {
  id: UserID
  name: string
  quota_daily_tokens: number | null
  quota_concurrent_sessions: number | null
  model_allowlist: string | null
  time_deleted: number | null
}
```

**Recommendation:** external service sends only the fields OpenCode needs to enforce isolation and accounting. OpenCode should not call the registration service on every API request.

### Pattern 3: Tombstone instead of orphaning ownership

**What:** deleting a user revokes access but preserves `session.user_id` and `usage.user_id` for auditability.
**When to use:** user deletion, account disablement, invalid identity cleanup.
**Trade-offs:** deleted rows remain in DB, but this is cheaper than losing ownership history and exposing orphaned sessions.

**Example:**

```typescript
await User.deactivate(id)
// revoke api keys
// set user.time_deleted
// DO NOT set session.user_id = null
```

**Why:** current `User.remove()` nulls `SessionTable.user_id`, which turns deleted users’ sessions into anonymous sessions. That weakens isolation and should not survive this milestone.

## Data Flow

### Request Flow

```text
[Client request]
    ↓
[basic auth]
    ↓
[x-opencode-api-key -> user-auth.resolve]
    ↓
[UserContext.provide(identity)]
    ↓
[WorkspaceContext + Instance]
    ↓
[session/message/part route]
    ↓
[Session.require(sessionID)] -> [MessageV2 / Session mutation]
    ↓
[SQLite tables]
    ↓
[JSON / SSE response]
```

### State Management

```text
[External lifecycle owner]
    ↓ push sync
[user projection in SQLite]
    ↓ read on auth / quota / allowlist / usage endpoints
[UserContext + Session access rules]
    ↓
[session/message/part/usage behavior]
```

### Key Data Flows

1. **Lifecycle sync:** external service creates or updates a local user projection; OpenCode stores only enforcement-critical fields.
2. **Owned message access:** route resolves identity, proves session ownership once, then performs message/part read or mutation.
3. **Deleted-user shutdown:** deactivation revokes API keys and blocks future auth, while sessions and usage rows remain linked to the original `user_id`.
4. **Usage accountability:** `session/processor.ts` keeps calling `Usage.record({ userID, sessionID, tokens })`; this path should remain stable.

## Scaling Considerations

| Scale         | Architecture Adjustments                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0-1k users    | Current SQLite + ALS + row-level ownership is fine; focus on correctness, not split services                             |
| 1k-100k users | Add indexes for tombstone/status queries and avoid N+1 ownership checks on paginated message APIs                        |
| 100k+ users   | Consider moving lifecycle sync and accounting exports into dedicated workers, but keep session ownership in this service |

### Scaling Priorities

1. **First bottleneck:** auth lookup currently scans all API key rows in `user-auth.ts`; fix if needed, but do not mix this with boundary cleanup unless it blocks milestone work.
2. **Second bottleneck:** repeated session ownership reads on deep message pagination; solve with a single parent session check per request, not per part row.

## Anti-Patterns

### Anti-Pattern 1: Rebuilding registration inside OpenCode

**What people do:** keep `POST /user` as the primary signup/provisioning API and let this service own user lifecycle UX again.
**Why it's wrong:** it expands scope back beyond isolation/accounting and creates dual sources of truth.
**Do this instead:** replace broad CRUD semantics with a narrow provision/update/deactivate sync surface or keep routes internal/admin-only.

### Anti-Pattern 2: Orphan sessions on user delete

**What people do:** set `session.user_id = null` during user removal.
**Why it's wrong:** anonymous callers then match `isNull(SessionTable.user_id)` paths in `Session.get/list`, which weakens ownership guarantees.
**Do this instead:** tombstone the user, revoke keys, preserve `session.user_id` and `usage.user_id`.

### Anti-Pattern 3: Independent authorization for messages and parts

**What people do:** trust `messageID` or `partID` filters alone.
**Why it's wrong:** messages and parts are session-derived resources; their security model should not diverge from the session root.
**Do this instead:** prove session ownership first, then operate on derived rows.

## Integration Points

### External Services

| Service                         | Integration Pattern                     | Notes                                                                                   |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Frontend + registration service | Push-based lifecycle sync into OpenCode | Prefer idempotent upsert/deactivate events or internal API; avoid per-request callbacks |
| External identity owner         | Stable foreign ID only                  | OpenCode should trust externally assigned `user_id`, but own local enforcement state    |

### Internal Boundaries

| Boundary                                         | Communication              | Notes                                                                           |
| ------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------- |
| `server/server.ts` ↔ `server/user-auth.ts`      | direct call                | Keep middleware order stable: auth before workspace/instance                    |
| `server/routes/session.ts` ↔ `session/index.ts` | direct service call        | Add a shared ownership guard before all message/part endpoints                  |
| `session/message-v2.ts` ↔ `session/index.ts`    | direct service call        | Use `Session.require(sessionID)` for defense in depth on page/get               |
| `user/index.ts` ↔ `user/usage.ts`               | DB join / existence checks | `/:userID/usage` must fail closed for deleted or unknown users                  |
| `user/index.ts` ↔ `session/session.sql.ts`      | shared `user_id` contract  | `session.user_id` should remain stable and immutable after ownership assignment |

## Concrete Integration Plan

### What remains stable

- `UserContext` ALS pattern in `packages/opencode/src/user/user-context.ts`
- middleware placement of user auth before `WorkspaceContext` and `Instance` in `packages/opencode/src/server/server.ts`
- `SessionTable.user_id` as the ownership anchor in `packages/opencode/src/session/session.sql.ts`
- usage recording from `packages/opencode/src/session/processor.ts`
- quota/model allowlist checks that read local user state in `packages/opencode/src/session/index.ts` and `packages/opencode/src/provider/provider.ts`
- anonymous fallback for legacy no-auth sessions where `session.user_id IS NULL`

### Modified components

| Component                                        | Change                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `packages/opencode/src/server/routes/session.ts` | Call `Session.require(sessionID)` before message list/get/delete, part delete/update, and prompt endpoints      |
| `packages/opencode/src/session/message-v2.ts`    | Add session existence+ownership guard to `page()` and `get()` so direct callers cannot bypass route checks      |
| `packages/opencode/src/session/index.ts`         | Add central access helper; tighten `removePart` to verify `partID`, `messageID`, and `sessionID` together       |
| `packages/opencode/src/user/index.ts`            | Replace destructive `remove()` behavior with `deactivate()`/tombstone + API key revocation                      |
| `packages/opencode/src/user/user.sql.ts`         | Add `time_deleted` or equivalent status field; keep schema minimal                                              |
| `packages/opencode/src/server/user-auth.ts`      | Treat deleted/deactivated users as anonymous invalid, even if API key hash matches                              |
| `packages/opencode/src/server/routes/user.ts`    | Remove public registration semantics; keep only bounded lifecycle sync/admin/accounting routes                  |
| `packages/opencode/src/user/usage.ts`            | Gate stats reads through a user existence/activity check; do not expose deleted-user usage via current endpoint |

### New small components worth adding

| Component                    | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `Session.require(sessionID)` | single reusable ownership guard for all session-derived operations |
| `User.getActive(userID)`     | fail closed for deleted/unknown users                              |
| `User.upsertProjection(...)` | idempotent lifecycle sync from external owner                      |
| `User.deactivate(userID)`    | revoke auth without losing ownership/accounting history            |

## Sensible Build Order

1. **Fix lifecycle persistence first**
   - add tombstone/status field on `user`
   - change delete flow to revoke keys and preserve `session.user_id`
   - update `user-auth.resolve()` to reject deleted users

2. **Centralize ownership guard**
   - add `Session.require(sessionID)` in `session/index.ts`
   - reuse `Session.get()` semantics rather than inventing another policy path

3. **Wire message/part routes to the guard**
   - harden `GET /session/:sessionID/message`
   - harden `GET/DELETE /session/:sessionID/message/:messageID`
   - harden `DELETE/PATCH /session/:sessionID/message/:messageID/part/:partID`
   - harden prompt/send paths that accept `sessionID`

4. **Add defense-in-depth below the route layer**
   - update `MessageV2.page/get`
   - tighten `Session.removePart/updatePart/removeMessage`

5. **Narrow the user boundary**
   - replace broad registration CRUD with projection sync/admin controls
   - document that onboarding/signup live outside this service

6. **Preserve and validate accountability**
   - keep `Usage.record()` unchanged
   - update `/:userID/usage` to 404/410 for deleted or unknown users
   - add tests proving usage rows remain queryable for internal audit while public route fails closed

## Sources

- Local architecture context: `D:\python_projects\opencode\.planning\PROJECT.md`
- Middleware and ALS order: `D:\python_projects\opencode\packages\opencode\src\server\server.ts`
- API key resolution: `D:\python_projects\opencode\packages\opencode\src\server\user-auth.ts`
- User context: `D:\python_projects\opencode\packages\opencode\src\user\user-context.ts`
- User lifecycle and current delete behavior: `D:\python_projects\opencode\packages\opencode\src\user\index.ts`
- User schema: `D:\python_projects\opencode\packages\opencode\src\user\user.sql.ts`
- Usage ledger: `D:\python_projects\opencode\packages\opencode\src\user\usage.ts`
- Session ownership and mutations: `D:\python_projects\opencode\packages\opencode\src\session\index.ts`
- Message pagination/get helpers: `D:\python_projects\opencode\packages\opencode\src\session\message-v2.ts`
- Session/message/part routes: `D:\python_projects\opencode\packages\opencode\src\server\routes\session.ts`
- Usage recording in prompt processing: `D:\python_projects\opencode\packages\opencode\src\session\processor.ts`
- Model allowlist enforcement: `D:\python_projects\opencode\packages\opencode\src\provider\provider.ts`

---

_Architecture research for: OpenCode v1.1 isolation boundary tightening_
_Researched: 2026-03-18_
