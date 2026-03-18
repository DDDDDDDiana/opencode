# Architecture Research: Mandatory Authentication

**Domain:** Enforcing API key authentication for all requests
**Researched:** 2026-03-18
**Confidence:** HIGH

## Current Architecture (v1.1)

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Request Layer                        │
├─────────────────────────────────────────────────────────────┤
│  OPTIONS → basicAuth → logging → CORS                        │
├─────────────────────────────────────────────────────────────┤
│              Context Establishment (NO AUTH)                 │
├─────────────────────────────────────────────────────────────┤
│  WorkspaceContext.provide → Instance.provide                 │
│  (UserContext NOT in middleware chain)                       │
├─────────────────────────────────────────────────────────────┤
│                    Route Handlers                            │
├─────────────────────────────────────────────────────────────┤
│  Session routes: NO user filtering                           │
│  UserContext.get() returns ANONYMOUS_MISSING                 │
└─────────────────────────────────────────────────────────────┘
```

### Current State

**Authentication:**

- `user-auth.ts` exports `resolve(key)` function
- Returns `Authenticated | Anonymous` identity
- **NOT integrated into middleware chain**
- UserContext.get() falls back to ANONYMOUS_MISSING

**Session Access:**

- SessionTable has `user_id` column (nullable)
- Queries do NOT filter by user_id
- Anonymous users see ALL sessions in project

**Data Model:**

```
SessionTable.user_id: text (nullable) ← exists but unused in queries
UserTable.id: text (PK)
ApiKeyTable.user_id → UserTable.id
```

## Target Architecture (v1.2)

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Request Layer                        │
├─────────────────────────────────────────────────────────────┤
│  OPTIONS → basicAuth → logging → CORS                        │
├─────────────────────────────────────────────────────────────┤
│              Authentication Middleware (NEW)                 │
├─────────────────────────────────────────────────────────────┤
│  resolve(x-opencode-api-key)                                 │
│    ├─ Authenticated → UserContext.provide(identity, next)    │
│    └─ Anonymous → return 401 Unauthorized                    │
├─────────────────────────────────────────────────────────────┤
│              Context Establishment                           │
├─────────────────────────────────────────────────────────────┤
│  WorkspaceContext.provide → Instance.provide                 │
├─────────────────────────────────────────────────────────────┤
│                    Route Handlers                            │
├─────────────────────────────────────────────────────────────┤
│  Session routes: filter by UserContext.userID               │
│  UserContext.get() guaranteed Authenticated                  │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Middleware Chain (server.ts)

**Current order (lines 79-221):**

```typescript
app
  .use(OPTIONS bypass)           // 79-82
  .use(basicAuth if password)    // 83-87
  .use(logging)                  // 88-104
  .use(cors)                     // 105-130
  .use(WorkspaceContext setup)   // 194-220
```

**Required insertion:** After CORS, before WorkspaceContext

**New middleware:**

```typescript
.use(async (c, next) => {
  const key = c.req.header("x-opencode-api-key")
  const identity = await resolve(key)

  if (identity.state === "anonymous") {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return UserContext.provide(identity, () => next())
})
```

**Integration type:** NEW middleware insertion

### 2. UserContext Module (user/user-context.ts)

**Current behavior:**

```typescript
get(): Identity {
  try {
    return ctx.use()
  } catch {
    return ANONYMOUS_MISSING  // ← Fallback
  }
}
```

**Required change:**

```typescript
get(): Identity {
  return ctx.use()  // Let it throw if missing
}
```

**Integration type:** MODIFIED - remove fallback

### 3. Session Queries (session/index.ts)

**Current (line 548-580):**

```typescript
function* list(input) {
  const conditions = [eq(SessionTable.project_id, project.id)]
  // NO user_id filter
}
```

**Required:**

```typescript
function* list(input) {
  const uid = UserContext.userID
  const conditions = [eq(SessionTable.project_id, project.id), eq(SessionTable.user_id, uid)]
}
```

**Integration type:** MODIFIED - add user_id filter

### 4. Session Creation (session/index.ts)

**Current:**

- createNext() does NOT set user_id
- Sessions created with user_id = NULL

**Required:**

```typescript
async function createNext(input) {
  const uid = UserContext.userID
  db.insert(SessionTable).values({
    user_id: uid,
    // ...
  })
}
```

**Integration type:** MODIFIED - set user_id on insert

## Component Modifications

| Component         | Type      | Changes                            | Lines Affected |
| ----------------- | --------- | ---------------------------------- | -------------- |
| server.ts         | Modified  | Add auth middleware after CORS     | ~10 lines      |
| user-context.ts   | Modified  | Remove anonymous fallback          | -3 lines       |
| session/index.ts  | Modified  | Add user_id filter to list()       | +2 lines       |
| session/index.ts  | Modified  | Add user_id filter to listGlobal() | +2 lines       |
| session/index.ts  | Modified  | Add user_id filter to get()        | +1 line        |
| session/index.ts  | Modified  | Set user_id in createNext()        | +1 line        |
| session.sql.ts    | No change | user_id column exists              | 0 lines        |
| routes/session.ts | No change | Inherits filtering                 | 0 lines        |

## Data Flow Changes

### Before (v1.1)

```
Request (no API key required)
  ↓
basicAuth → logging → CORS
  ↓
WorkspaceContext → Instance
  ↓
Route Handler
  ↓
UserContext.get() → ANONYMOUS_MISSING
  ↓
Session.list() → WHERE project_id = ?
  ↓
Returns ALL sessions (no isolation)
```

### After (v1.2)

```
Request with x-opencode-api-key
  ↓
basicAuth → logging → CORS
  ↓
Auth Middleware
  ├─ resolve(key) → Authenticated
  └─ UserContext.provide(identity, ...)
      ↓
WorkspaceContext → Instance
  ↓
Route Handler
  ↓
UserContext.get() → Authenticated { user_id }
  ↓
Session.list() → WHERE project_id = ? AND user_id = ?
  ↓
Returns only user's sessions (isolated)
```

## Build Order

1. **Add auth middleware to server.ts**
   - Insert after CORS (line ~131)
   - Import resolve from user-auth
   - Wrap next() in UserContext.provide()
   - Return 401 for anonymous

2. **Update UserContext.get()**
   - Remove try/catch fallback
   - Let ALS throw if missing

3. **Update Session.list()**
   - Add user_id to WHERE conditions
   - Use UserContext.userID

4. **Update Session.listGlobal()**
   - Add user_id to WHERE conditions
   - Use UserContext.userID

5. **Update Session.get()**
   - Add user_id to WHERE clause
   - Prevents cross-user access

6. **Update Session.createNext()**
   - Read UserContext.userID
   - Set user_id in INSERT

## Anti-Patterns

### Anti-Pattern 1: Optional User Filtering

**What:** Make user_id filtering conditional

```typescript
if (UserContext.authenticated) {
  conditions.push(eq(SessionTable.user_id, UserContext.userID))
}
```

**Why wrong:** Creates two code paths, defeats mandatory auth

**Do instead:** Always filter by user_id, middleware guarantees it

### Anti-Pattern 2: Route-Level Auth Checks

**What:** Check auth in individual routes

```typescript
;async (c) => {
  if (!UserContext.authenticated) return c.json({ error: "Unauthorized" }, 401)
}
```

**Why wrong:** Duplicates logic, easy to forget

**Do instead:** Enforce at middleware level once

### Anti-Pattern 3: Nullable User ID Handling

**What:** Handle undefined user_id

```typescript
const uid = UserContext.userID
if (uid) conditions.push(eq(SessionTable.user_id, uid))
```

**Why wrong:** Allows bypass if middleware fails

**Do instead:** Assert user_id exists, fail loudly if missing

## Scaling Considerations

| Scale        | Bottleneck                                 | Solution                     |
| ------------ | ------------------------------------------ | ---------------------------- |
| 0-1k users   | None                                       | Current approach sufficient  |
| 1k-10k users | API key verification (bcrypt + table scan) | Add in-memory cache with TTL |
| 10k+ users   | Key lookup performance                     | Hash-based prefix lookup     |

## Sources

- server.ts - Middleware chain
- user-auth.ts - Authentication resolver
- user-context.ts - ALS context pattern
- session/index.ts - Session queries
- session.sql.ts - Schema (user_id exists)
- migration/20260317110427 - user_id column added

---

_Architecture research for: OpenCode v1.2 Mandatory Authentication_
_Researched: 2026-03-18_
