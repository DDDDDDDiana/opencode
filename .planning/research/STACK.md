# Stack Research: Mandatory Authentication

**Domain:** Enforcing mandatory API key authentication (removing anonymous fallback)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

**No new stack components needed.** All authentication infrastructure exists from v1.0/v1.1. This milestone removes anonymous fallback by changing middleware behavior and error responses.

## Existing Stack (Already Validated)

### Authentication Infrastructure

| Component            | Location                   | Purpose                                                                    | Status   |
| -------------------- | -------------------------- | -------------------------------------------------------------------------- | -------- |
| UserContext ALS      | `src/user/user-context.ts` | Propagates Identity (Authenticated \| Anonymous) through request lifecycle | ✓ Exists |
| resolve()            | `src/server/user-auth.ts`  | Validates API key against bcrypt hashes in ApiKeyTable                     | ✓ Exists |
| ApiKeyTable          | `src/user/user.sql.ts`     | Stores bcrypt hashed API keys with user_id foreign key                     | ✓ Exists |
| UserTable            | `src/user/user.sql.ts`     | User records with quotas and model allowlist                               | ✓ Exists |
| SessionTable.user_id | Migration `20260317110427` | Nullable user_id column with index                                         | ✓ Exists |

### Middleware Chain

| Layer            | File                    | Current Behavior                                   |
| ---------------- | ----------------------- | -------------------------------------------------- |
| Basic auth       | `server.ts:79-87`       | Optional OPENCODE_SERVER_PASSWORD check            |
| CORS             | `server.ts:105-130`     | Allows preflight OPTIONS without auth              |
| Instance context | `server.ts:194-220`     | Provides directory-scoped AsyncLocalStorage        |
| WorkspaceRouter  | `server.ts:221`         | Routes remote workspace requests                   |
| **User auth**    | **Missing integration** | **Should resolve API key → UserContext.provide()** |
| Route handlers   | `server.ts:244+`        | Access UserContext.userID for filtering            |

## Minimal Changes Required

### 1. Add User Auth Middleware

**Location:** `src/server/server.ts` after WorkspaceRouterMiddleware (line ~221)

**What to add:**

```typescript
.use(async (c, next) => {
  const key = c.req.header("x-opencode-api-key")
  const identity = await resolve(key)

  if (identity.state === "anonymous") {
    return c.json({ error: "Unauthorized", reason: identity.reason }, 401)
  }

  return UserContext.provide(identity, () => next())
})
```

**Why this works:**

- `resolve()` already exists in `src/server/user-auth.ts`
- Returns `{ state: "authenticated", user_id }` or `{ state: "anonymous", reason }`
- UserContext.provide() already exists
- Rejecting anonymous state enforces mandatory auth

**Import needed:**

```typescript
import { resolve } from "./user-auth"
import { UserContext } from "../user/user-context"
```

### 2. Remove Anonymous Fallback from UserContext

**Location:** `src/user/user-context.ts:25-30`

**Current code:**

```typescript
get(): Identity {
  try {
    return ctx.use()
  } catch {
    return ANONYMOUS_MISSING  // ← Remove this fallback
  }
}
```

**Change to:**

```typescript
get(): Identity {
  return ctx.use()  // Throw if missing - should never happen after middleware
}
```

**Why:** After middleware enforces auth, UserContext should always exist. Fallback hides bugs.

### 3. Error Response Format

**Use existing pattern:** Hono's `c.json(error, status)` with HTTPException for consistency

**Format:**

```json
{
  "error": "Unauthorized",
  "reason": "missing" | "invalid"
}
```

## What NOT to Add

| Avoid                    | Why                                                                       |
| ------------------------ | ------------------------------------------------------------------------- |
| JWT tokens               | API keys sufficient; JWT adds complexity without benefit (per PROJECT.md) |
| OAuth flows              | Service mode uses direct API keys, not user-facing OAuth                  |
| Rate limiting middleware | Quota enforcement already exists in User module                           |
| API key rotation         | Out of scope for v1.2; admin creates new keys via `/user` API             |
| Session-level auth       | Sessions already filtered by user_id; middleware handles request-level    |
| Custom error classes     | Use Hono's HTTPException; consistent with existing error handling         |
| New auth framework       | All infrastructure exists; just enforce at middleware boundary            |

## Integration Points

### Middleware Order (Critical)

```
1. OPTIONS preflight bypass (line 79-82)
2. Basic auth (OPENCODE_SERVER_PASSWORD) (line 83-87)
3. Request logging (line 88-104)
4. CORS (line 105-130)
5. Instance context (line 194-220)
6. WorkspaceRouter (line 221)
7. **→ User auth middleware (NEW - insert here)**
8. Route handlers (line 244+)
```

**Why this order:**

- After Instance context: needs Database access (Instance-scoped)
- Before routes: all handlers assume UserContext exists
- After WorkspaceRouter: remote workspaces handle their own auth

### Routes That Use UserContext

| Route           | File                           | Usage                                    |
| --------------- | ------------------------------ | ---------------------------------------- |
| `/session/*`    | `src/server/routes/session.ts` | Filter sessions by UserContext.userID    |
| `/user/*`       | `src/server/routes/user.ts`    | Admin API (no filtering, creates users)  |
| Agent execution | `src/session/prompt.ts`        | Quota enforcement via UserContext.userID |

**Note:** `/user/*` routes are admin APIs - they don't filter by current user. Middleware still validates API key exists.

## Testing Strategy

### Manual Testing

```bash
# Missing API key
curl http://localhost:3000/session
# Expected: 401 {"error":"Unauthorized","reason":"missing"}

# Invalid API key
curl -H "x-opencode-api-key: invalid" http://localhost:3000/session
# Expected: 401 {"error":"Unauthorized","reason":"invalid"}

# Valid API key
curl -H "x-opencode-api-key: oc_..." http://localhost:3000/session
# Expected: 200 [sessions for that user]
```

### Unit Tests

**Test cases:**

- `resolve(undefined)` returns `{ state: "anonymous", reason: "missing" }`
- `resolve("invalid")` returns `{ state: "anonymous", reason: "invalid" }`
- `resolve(validKey)` returns `{ state: "authenticated", user_id }`
- Middleware rejects anonymous with 401
- UserContext.get() throws when not provided (after removing fallback)

## Migration Impact

**Breaking change:** Deployments must provision users before upgrading to v1.2

**Migration steps:**

1. Before upgrade: Create users via `POST /user` (returns API key)
2. Distribute API keys to clients
3. Upgrade server
4. Clients add `x-opencode-api-key` header to all requests

**Rollback:** Revert to v1.1 - anonymous fallback still works with nullable user_id

## Performance Considerations

**API key verification cost:**

- bcrypt.compare() per request for each stored key
- Current implementation: O(n) where n = number of users
- Acceptable for small deployments (<100 users)
- Future optimization: cache key→user_id mapping with TTL

**No caching in v1.2:** Keep implementation simple. Add caching if performance issues observed.

## Security Notes

**API key transmission:**

- Header: `x-opencode-api-key: oc_...`
- HTTPS required in production (not enforced by code)
- No key in URL/query params (prevents logging leaks)

**Bcrypt hashing:**

- Already implemented in `src/user/index.ts`
- Keys hashed before storage in ApiKeyTable
- `resolve()` uses `verify(plaintext, hash)` for comparison

**Throttling:**

- `user-auth.ts` already throttles invalid key logging (60s window)
- Prevents log spam from brute force attempts
- Does not block requests (logging only)

## Sources

- **HIGH confidence:** Direct codebase inspection
  - `src/user/user-context.ts` — UserContext ALS implementation
  - `src/server/user-auth.ts` — resolve() authentication logic
  - `src/user/user.sql.ts` — UserTable and ApiKeyTable schema
  - `migration/20260317110427_add_session_user_id/migration.sql` — user_id column
  - `migration/20260317144535_identity_foundation/migration.sql` — quota fields
  - `.planning/PROJECT.md` — Requirements and constraints

---

_Stack research for: Mandatory authentication enforcement_
_Researched: 2026-03-18_
