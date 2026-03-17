# Architecture Patterns: Multi-User Isolation

**Domain:** Multi-tenant session isolation in AsyncLocalStorage-based Node.js backend  
**Researched:** 2026-03-17  
**Confidence:** HIGH

## Executive Summary

OpenCode uses AsyncLocalStorage for per-directory context isolation (Instance) and per-workspace context (WorkspaceContext). Adding user identity follows the same pattern: a parallel UserContext ALS that propagates through the request pipeline alongside existing contexts.

Multi-tenant SaaS backends typically use one of three isolation strategies:

1. **Database-per-tenant** — separate databases (overkill for OpenCode)
2. **Schema-per-tenant** — separate schemas in one database (still too heavy)
3. **Row-level filtering** — single schema with tenant_id on every table (✓ recommended)

OpenCode already has the infrastructure for #3: Drizzle ORM with SQLite, middleware chain in Hono, and ALS context propagation. The architecture adds a `user_id` column to SessionTable and filters all queries by the current user from UserContext.

## Recommended Architecture

```
HTTP Request
    ↓
[Auth Middleware] ← Extract API key, resolve user_id
    ↓
[UserContext.provide()] ← Store user in ALS
    ↓
[WorkspaceContext.provide()] ← Existing workspace isolation
    ↓
[Instance.provide()] ← Existing directory isolation
    ↓
[Route Handler] → Session.list() → WHERE user_id = UserContext.userID
```

### Component Boundaries

| Component             | Responsibility                                  | Reads From                       | Writes To                |
| --------------------- | ----------------------------------------------- | -------------------------------- | ------------------------ |
| **AuthMiddleware**    | Extract API key from header, resolve to user_id | Request headers, UserTable       | UserContext ALS          |
| **UserContext**       | Store/retrieve current user identity via ALS    | AsyncLocalStorage                | N/A (read-only accessor) |
| **Session queries**   | Filter by user_id from UserContext              | UserContext.userID, SessionTable | SessionTable             |
| **User management**   | CRUD operations for users and quotas            | UserTable, QuotaTable            | UserTable, QuotaTable    |
| **Quota enforcement** | Check limits before agent calls                 | UserContext.userID, UsageTable   | UsageTable (on success)  |

### Data Flow

**Request → User Identity → Query Filtering**

1. **Middleware extracts identity**

   ```typescript
   // In server.ts middleware chain (after basicAuth, before Instance.provide)
   const apiKey = c.req.header("x-api-key")
   const user = apiKey ? await User.fromApiKey(apiKey) : undefined

   return UserContext.provide({
     userID: user?.id,
     async fn() {
       // Continue to WorkspaceContext → Instance → routes
     },
   })
   ```

2. **UserContext propagates through ALS**

   ```typescript
   // src/user/user-context.ts (new file, mirrors WorkspaceContext pattern)
   const context = Context.create<{ userID?: UserID }>("user")

   export const UserContext = {
     async provide<R>(input: { userID?: UserID; fn: () => R }) {
       return context.provide({ userID: input.userID }, input.fn)
     },
     get userID() {
       try {
         return context.use().userID
       } catch {
         return undefined // Anonymous requests
       }
     },
   }
   ```

3. **Session queries filter by user**

   ```typescript
   // In Session.list() - add condition
   const conditions = [eq(SessionTable.project_id, project.id)]

   if (UserContext.userID) {
     conditions.push(eq(SessionTable.user_id, UserContext.userID))
   } else {
     // Anonymous: only see sessions with no owner
     conditions.push(isNull(SessionTable.user_id))
   }
   ```

4. **Session creation stamps user**
   ```typescript
   // In Session.createNext()
   const result: Info = {
     // ... existing fields
     userID: UserContext.userID, // Nullable - backward compatible
   }
   ```

## Patterns to Follow

### Pattern 1: Parallel ALS Context

**What:** UserContext runs alongside Instance and WorkspaceContext, not nested inside them

**When:** Need per-request identity that's independent of directory/workspace

**Why:** Keeps concerns separated - user auth is orthogonal to project context

**Example:**

```typescript
// server.ts middleware order
.use(basicAuthMiddleware)           // Global password (existing)
.use(userAuthMiddleware)            // NEW: API key → UserContext
.use(workspaceAndInstanceMiddleware) // Existing: WorkspaceContext + Instance
.route("/session", SessionRoutes())
```

**Source:** Node.js AsyncLocalStorage docs (https://nodejs.org/api/async_context.html) - multiple ALS instances can coexist safely

### Pattern 2: Nullable Foreign Key for Backward Compatibility

**What:** `user_id` column is nullable, queries filter by `user_id = X OR user_id IS NULL`

**When:** Adding multi-tenancy to existing single-tenant system

**Why:** Existing sessions without user_id remain accessible in anonymous mode

**Example:**

```typescript
// Migration: 0001_add_user_id.sql
ALTER TABLE session ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE;
CREATE INDEX session_user_idx ON session(user_id);

// Query logic
if (UserContext.userID) {
  conditions.push(eq(SessionTable.user_id, UserContext.userID))
} else {
  conditions.push(isNull(SessionTable.user_id)) // Anonymous sees only unowned
}
```

### Pattern 3: Centralized Query Filtering

**What:** All session queries go through Session.list() / Session.get() which apply user filter

**When:** Need consistent isolation across all access paths

**Why:** Prevents accidental data leakage from ad-hoc queries

**Example:**

```typescript
// BAD: Direct query bypasses user filter
Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, id)))

// GOOD: Use Session.get() which applies user filter
export const get = fn(SessionID.zod, async (id) => {
  const conditions = [eq(SessionTable.id, id)]

  if (UserContext.userID) {
    conditions.push(eq(SessionTable.user_id, UserContext.userID))
  } else {
    conditions.push(isNull(SessionTable.user_id))
  }

  const row = Database.use((db) =>
    db
      .select()
      .from(SessionTable)
      .where(and(...conditions))
      .get(),
  )
  if (!row) throw new NotFoundError({ message: `Session not found: ${id}` })
  return fromRow(row)
})
```

### Pattern 4: Quota Check in Agent Loop

**What:** Before each agent iteration, check user's remaining quota

**When:** Need to enforce per-user limits on expensive operations

**Why:** Prevents runaway costs, ensures fair resource allocation

**Example:**

```typescript
// In SessionPrompt.loop() before LLM.stream()
if (UserContext.userID) {
  const quota = await Quota.check(UserContext.userID)
  if (quota.agentCalls >= quota.limit) {
    throw new QuotaExceededError("Agent call limit reached")
  }
  await Quota.increment(UserContext.userID, "agentCalls")
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Extending Instance with User Identity

**What:** Adding `user` field to Instance context

**Why bad:** Instance is per-directory, user is per-request. Multiple users can share same directory. Mixing concerns makes Instance lifecycle unclear.

**Instead:** Separate UserContext ALS that runs in parallel

### Anti-Pattern 2: Middleware Order Confusion

**What:** Placing UserContext.provide() after Instance.provide()

**Why bad:** Instance.provide() caches per directory. If user context is inside Instance, all users in same directory share context.

**Instead:** UserContext → WorkspaceContext → Instance (outer to inner)

### Anti-Pattern 3: Forgetting Anonymous Fallback

**What:** Queries that assume UserContext.userID is always present

**Why bad:** Breaks backward compatibility with existing no-auth deployments

**Instead:** Always handle `UserContext.userID === undefined` case

```typescript
// BAD
conditions.push(eq(SessionTable.user_id, UserContext.userID))

// GOOD
if (UserContext.userID) {
  conditions.push(eq(SessionTable.user_id, UserContext.userID))
} else {
  conditions.push(isNull(SessionTable.user_id))
}
```

### Anti-Pattern 4: Client-Side User Filtering

**What:** Fetching all sessions, then filtering by user in application code

**Why bad:** Leaks data to client, doesn't scale, easy to forget

**Instead:** Database-level WHERE clause on every query

## Database Schema Changes

### New Tables

```sql
-- User table
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);
CREATE INDEX user_api_key_idx ON user(api_key);

-- Quota configuration per user
CREATE TABLE quota (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  agent_calls_limit INTEGER NOT NULL DEFAULT 1000,
  concurrent_sessions_limit INTEGER NOT NULL DEFAULT 10,
  daily_token_cap INTEGER NOT NULL DEFAULT 1000000,
  allowed_models TEXT, -- JSON array of model IDs
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);

-- Usage tracking
CREATE TABLE usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES session(id) ON DELETE SET NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost REAL NOT NULL,
  time_created INTEGER NOT NULL
);
CREATE INDEX usage_user_time_idx ON usage(user_id, time_created);
```

### Modified Tables

```sql
-- Add user_id to session table
ALTER TABLE session ADD COLUMN user_id TEXT REFERENCES user(id) ON DELETE CASCADE;
CREATE INDEX session_user_idx ON session(user_id);
```

## Build Order and Dependencies

### Phase 1: Foundation (no dependencies)

1. **UserContext** — ALS context for user identity (mirrors WorkspaceContext)
2. **User schema** — UserTable, QuotaTable, UsageTable in Drizzle
3. **Migration** — Add user_id to SessionTable (nullable)

### Phase 2: Authentication (depends on Phase 1)

4. **Auth middleware** — Extract API key, resolve user, populate UserContext
5. **User CRUD** — Create/read/update/delete users and quotas

### Phase 3: Isolation (depends on Phase 1, 2)

6. **Session filtering** — Update Session.list(), Session.get() to filter by user_id
7. **Session ownership** — Stamp user_id on Session.createNext()

### Phase 4: Enforcement (depends on Phase 1, 2, 3)

8. **Quota checks** — Enforce limits in SessionPrompt.loop()
9. **Usage tracking** — Record token consumption per user

### Dependency Graph

```
UserContext ──┬──> Auth Middleware ──> User CRUD
              │
              └──> Session Filtering ──> Quota Enforcement
                          │
                          └──> Usage Tracking
```

**Critical path:** UserContext → Auth Middleware → Session Filtering  
**Parallel work:** User CRUD and Usage Tracking can be built independently after Phase 1

## Integration Points

### Existing: server.ts Middleware Chain

**Current flow:**

```typescript
.use(basicAuth)                    // Line 79-87
.use(loggingMiddleware)            // Line 88-104
.use(cors)                         // Line 105-130
.use(workspaceAndInstanceMiddleware) // Line 194-220
```

**New flow:**

```typescript
.use(basicAuth)                    // Existing global password
.use(userAuthMiddleware)           // NEW: API key → UserContext (insert here)
.use(loggingMiddleware)
.use(cors)
.use(workspaceAndInstanceMiddleware) // Existing
```

**Why this order:** User auth must run before Instance.provide() so UserContext is available to all downstream code, but after basicAuth so global password still protects the entire API.

### Existing: Session.list() Query Building

**Current logic (line 540-581):**

```typescript
const conditions = [eq(SessionTable.project_id, project.id)]

if (WorkspaceContext.workspaceID) {
  conditions.push(eq(SessionTable.workspace_id, WorkspaceContext.workspaceID))
}
// ... other filters
```

**Add user filter:**

```typescript
if (UserContext.userID) {
  conditions.push(eq(SessionTable.user_id, UserContext.userID))
} else {
  conditions.push(isNull(SessionTable.user_id))
}
```

**Impact:** All session list endpoints automatically filter by user. No route-level changes needed.

### Existing: Session.createNext()

**Current logic (line 297-338):**

```typescript
const result: Info = {
  id: SessionID.descending(input.id),
  projectID: Instance.project.id,
  workspaceID: input.workspaceID,
  // ...
}
```

**Add user stamp:**

```typescript
const result: Info = {
  // ... existing fields
  userID: UserContext.userID, // Nullable
}
```

**Impact:** New sessions automatically owned by current user. Anonymous sessions have userID = undefined.

## Scalability Considerations

| Concern               | At 10 users           | At 100 users                | At 1000 users                             |
| --------------------- | --------------------- | --------------------------- | ----------------------------------------- |
| **Query performance** | No indexes needed     | Add `session_user_idx`      | Composite index `(user_id, time_updated)` |
| **ALS overhead**      | Negligible (<1ms)     | Negligible                  | Negligible (ALS is O(1) lookup)           |
| **Database size**     | Single SQLite file    | Single SQLite file          | Consider partitioning by user_id          |
| **Quota checks**      | In-memory cache OK    | Cache quota config per user | Redis for distributed quota tracking      |
| **API key lookup**    | Table scan acceptable | Index on `user.api_key`     | Consider JWT to avoid DB lookup           |

**Current scope:** 10-100 users. Single SQLite file with indexes is sufficient. No distributed systems needed.

## Security Considerations

### API Key Storage

**Recommendation:** Hash API keys before storing in database

```typescript
// User.create()
const apiKey = crypto.randomBytes(32).toString("hex") // Give to user
const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex")
db.insert(UserTable).values({ id, api_key: apiKeyHash })

// User.fromApiKey()
const hash = crypto.createHash("sha256").update(apiKey).digest("hex")
const user = db.select().from(UserTable).where(eq(UserTable.api_key, hash)).get()
```

**Why:** If database is compromised, attacker can't use hashed keys to authenticate

### Timing Attack Prevention

**Recommendation:** Use constant-time comparison for API key validation

```typescript
import { timingSafeEqual } from "crypto"

function compareApiKeys(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
```

**Why:** Prevents timing attacks that could leak API key characters

### SQL Injection Prevention

**Status:** Already protected by Drizzle ORM parameterized queries

**Verification:** All queries use `eq()`, `and()`, etc. - no string concatenation

## Open Questions and Gaps

### Question 1: User Registration Flow

**Gap:** How do users get API keys? Admin-only creation or self-service?

**Options:**

- Admin CLI command: `opencode user create --name "Alice"`
- REST endpoint: `POST /user` (requires admin auth)
- Self-service: `POST /user/register` (requires email verification)

**Recommendation for v1:** Admin CLI command. Self-service adds complexity (email, verification, rate limiting).

### Question 2: Quota Reset Schedule

**Gap:** When do daily token caps reset? Per-user 24h window or global midnight UTC?

**Options:**

- Rolling 24h window: Track `usage.time_created`, sum last 24h
- Daily reset: Reset all quotas at midnight UTC
- Monthly billing cycle: Reset on user's signup anniversary

**Recommendation for v1:** Rolling 24h window. Simpler than scheduled jobs, fairer to users.

### Question 3: Quota Exceeded Behavior

**Gap:** What happens mid-session when quota is exceeded?

**Options:**

- Hard stop: Abort current agent call, return error
- Graceful degradation: Finish current call, block next call
- Warning: Allow overage up to 10%, then hard stop

**Recommendation:** Graceful degradation. Check quota before loop iteration, not during. Prevents partial tool executions.

## Sources

**HIGH confidence:**

- Node.js AsyncLocalStorage documentation (https://nodejs.org/api/async_context.html) - Official Node.js docs, verified ALS propagation behavior and multiple instance safety
- OpenCode codebase analysis - Instance.ts, WorkspaceContext.ts, server.ts, Session/index.ts - Direct inspection of existing patterns

**MEDIUM confidence:**

- Multi-tenant database patterns - Industry standard practice (row-level filtering with tenant_id), not specific to one source but widely documented across SaaS architecture literature

**Assumptions (not verified):**

- Drizzle ORM supports nullable foreign keys with ON DELETE CASCADE - assumed based on standard SQL support, should verify in Drizzle docs
- Hono middleware execution order is sequential - assumed based on Express-like behavior, should verify in Hono docs

---

**Next steps for roadmap:**

1. Create UserContext (1-2 hours, no dependencies)
2. Add user schema + migration (2-3 hours, depends on #1)
3. Implement auth middleware (3-4 hours, depends on #1, #2)
4. Update session queries (4-6 hours, depends on #1, #2, #3)
5. Add quota enforcement (4-6 hours, depends on all above)

**Total estimated effort:** 14-21 hours for complete multi-user isolation
