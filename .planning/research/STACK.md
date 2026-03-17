# Technology Stack: Multi-User Isolation

**Project:** OpenCode Multi-User Isolation
**Researched:** 2026-03-17
**Dimension:** API key auth, per-user isolation, quotas — Hono/Bun/SQLite service

---

## Recommended Stack

### API Key Authentication

| Technology                        | Version           | Purpose                                          | Why                                                                                               |
| --------------------------------- | ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `hono/bearer-auth`                | 4.10.7 (built-in) | Extract + validate `Authorization: Bearer <key>` | Already in the dep tree; `verifyToken` callback does async DB lookup; no new package needed       |
| `hono/factory` `createMiddleware` | 4.10.7 (built-in) | Type-safe middleware that sets `c.var.user`      | Gives typed `Variables` on the Hono context; downstream handlers get `c.var.user` without casting |

**Pattern — use `verifyToken`, not a static token list:**

```ts
// src/server/middleware/user-auth.ts
import { createMiddleware } from "hono/factory"
import { bearerAuth } from "hono/bearer-auth"
import { UserContext } from "../user/user-context"
import { UserService } from "../user/user"

// Typed Hono Variables so c.var.user is available downstream
export type UserVar = { user: { id: string; name: string } | null }

export const userAuth = createMiddleware<{ Variables: UserVar }>(async (c, next) => {
  const password = Flag.OPENCODE_SERVER_PASSWORD
  // If no multi-user mode, skip — preserves backward compat
  if (!password) {
    c.set("user", null)
    return next()
  }
  return bearerAuth({
    verifyToken: async (token, c) => {
      const user = await UserService.byKey(token) // hash-lookup in DB
      if (!user) return false
      c.set("user", user)
      return true
    },
  })(c, next)
})
```

Confidence: HIGH — verified against Hono 4.10.7 official docs (`verifyToken` option, `createMiddleware` factory).

---

### API Key Hashing

| Technology               | Version  | Purpose                   | Why                                                                                                |
| ------------------------ | -------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `node:crypto` (built-in) | Bun 1.3+ | Hash API keys for storage | Zero deps; Bun ships full Node.js `crypto` compat; SHA-256 is correct for API keys (not passwords) |

**Use SHA-256, not Argon2/bcrypt, for API keys.** This is the critical distinction:

- Passwords need slow hashing (bcrypt/argon2) because attackers can brute-force short human-chosen strings.
- API keys are 32+ bytes of cryptographically random data — brute-force is computationally infeasible regardless of hash speed. SHA-256 is correct and fast for lookup.
- `argon2` requires a native C++ addon (node-gyp, prebuilt binaries per platform/arch). This is a build-time liability for a CLI distributed as a Bun binary. Avoid it.

**Pattern:**

```ts
import { createHash, randomBytes } from "node:crypto"

// Generate: prefix makes keys identifiable in logs/leaks
export function generate() {
  return "oc_" + randomBytes(32).toString("hex") // 64 hex chars = 256 bits
}

// Hash for storage — fast lookup, no salt needed (key is already random)
export function hash(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

// Constant-time compare to prevent timing attacks
export function verify(key: string, stored: string) {
  const h = hash(key)
  // timingSafeEqual requires same-length Buffers
  return timingSafeEqual(Buffer.from(h), Buffer.from(stored))
}
```

Confidence: HIGH — standard industry pattern (Stripe, GitHub use SHA-256 for API keys); `node:crypto` is stable in Bun 1.3+.

---

### UserContext (AsyncLocalStorage)

| Technology                             | Version  | Purpose                               | Why                                                                                                    |
| -------------------------------------- | -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `node:async_hooks` `AsyncLocalStorage` | built-in | Per-request user identity propagation | Exact same mechanism as existing `WorkspaceContext` and `Instance` — zero new deps, consistent pattern |

**Follow the existing `Context.create` utility exactly:**

```ts
// src/user/user-context.ts
import { Context } from "../util/context"

interface UserCtx {
  id: string
  name: string
}

const ctx = Context.create<UserCtx | null>("user")

export const UserContext = {
  provide<R>(user: UserCtx | null, fn: () => R): Promise<R> {
    return ctx.provide(user, fn as () => Promise<R>)
  },
  get current() {
    try {
      return ctx.use()
    } catch {
      return null
    }
  },
}
```

Wire it in `server.ts` after the auth middleware resolves the user, wrapping the same `Instance.provide` call that already exists:

```ts
// Inside the existing workspace/instance middleware in server.ts
return WorkspaceContext.provide({
  workspaceID: ...,
  async fn() {
    return UserContext.provide(c.var.user ?? null, async () =>
      Instance.provide({ directory, init: InstanceBootstrap, fn: next })
    )
  },
})
```

Confidence: HIGH — `AsyncLocalStorage` is Stability 2 (stable) in Node.js docs; Bun 1.3+ fully supports it; pattern is already proven in this codebase.

---

### Drizzle Schema Additions

| Technology                | Version                  | Purpose                                                    | Why                                                                        |
| ------------------------- | ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `drizzle-orm` sqlite-core | 1.0.0-beta.16 (existing) | `UserTable`, `ApiKeyTable`; `user_id` FK on `SessionTable` | No new ORM; extend existing schema files following established conventions |

**No RLS.** Drizzle RLS is Postgres-only. SQLite has no native RLS. Isolation is enforced at the query layer — every session query filters by `user_id` in application code. This is the correct approach for SQLite.

**New tables:**

```ts
// src/user/user.sql.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const UserTable = sqliteTable("user", {
  id: text().primaryKey(), // ulid
  name: text().notNull(),
  quota_daily_tokens: integer(), // null = unlimited
  quota_max_sessions: integer(), // null = unlimited
  quota_max_calls: integer(), // null = unlimited
  model_allowlist: text({ mode: "json" }).$type<string[] | null>(),
  ...Timestamps,
  time_disabled: integer(), // null = active
})

export const ApiKeyTable = sqliteTable(
  "api_key",
  {
    id: text().primaryKey(), // ulid
    user_id: text()
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    hash: text().notNull().unique(), // sha256 hex of raw key
    name: text().notNull(), // human label e.g. "laptop"
    ...Timestamps,
    time_last_used: integer(),
    time_revoked: integer(), // null = active
  },
  (t) => [index("api_key_hash_idx").on(t.hash), index("api_key_user_idx").on(t.user_id)],
)
```

**SessionTable addition** (migration, not replace):

```ts
// Add to existing SessionTable columns:
user_id: text(),   // nullable — backward compat with anonymous/single-user mode
// Add to indexes array:
index("session_user_idx").on(table.user_id),
```

**Usage tracking table:**

```ts
// src/user/usage.sql.ts
export const UsageTable = sqliteTable(
  "usage",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    session_id: text().$type<SessionID>(),
    model: text().notNull(),
    tokens_in: integer().notNull().default(0),
    tokens_out: integer().notNull().default(0),
    ...Timestamps,
  },
  (t) => [index("usage_user_idx").on(t.user_id), index("usage_user_time_idx").on(t.user_id, t.time_created)],
)
```

Confidence: HIGH — verified against Drizzle 1.0.0-beta.16 docs and existing schema conventions in this codebase.

---

### Quota Enforcement

No new library. Enforce in application code at two points:

1. **Session creation** — query `UsageTable` for active session count, reject if over `quota_max_sessions`.
2. **Agent loop** (`src/session/prompt.ts`) — check call counter against `quota_max_calls`; check rolling 24h token sum against `quota_daily_tokens`. Hard reject with `HTTPException(429)`.

```ts
// Pattern for quota check — inline, no abstraction needed
const today = Date.now() - 86_400_000
const tokens = await db
  .select({ total: sum(UsageTable.tokens_in) + sum(UsageTable.tokens_out) })
  .from(UsageTable)
  .where(and(eq(UsageTable.user_id, uid), gte(UsageTable.time_created, today)))
if (tokens > user.quota_daily_tokens) throw new HTTPException(429, { message: "daily token quota exceeded" })
```

Confidence: MEDIUM — pattern is standard; specific Effect integration points need phase-level research.

---

## What NOT to Use

| Rejected                                 | Why                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT                                      | Out of scope per PROJECT.md; adds complexity (signing keys, expiry, refresh) with no benefit for a local service mode                        |
| `argon2` / `bcrypt`                      | Native addons with build-time complexity; wrong tool for API keys (which are already high-entropy random); SHA-256 is correct                |
| Drizzle RLS                              | Postgres-only feature; SQLite has no RLS; application-layer filtering is the right approach                                                  |
| External quota/metering service          | SQLite is sufficient per PROJECT.md; no billing integration in scope                                                                         |
| `hono/jwt` middleware                    | JWT is out of scope; bearer-auth with `verifyToken` is the right primitive                                                                   |
| `c.set("user", ...)` as sole propagation | Hono context doesn't survive outside the request handler chain (e.g. Effect fibers, Bus callbacks); ALS is required for cross-cutting access |

---

## Alternatives Considered

| Category            | Recommended                        | Alternative                    | Why Not                                                                             |
| ------------------- | ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| Key hashing         | `node:crypto` SHA-256              | `argon2`                       | Native addon; wrong algorithm class for random keys                                 |
| Key hashing         | `node:crypto` SHA-256              | `bcrypt`                       | Same — slow hash designed for passwords, not random tokens                          |
| Auth middleware     | `hono/bearer-auth` + `verifyToken` | Custom middleware from scratch | `bearerAuth` handles header parsing, 401 format, OPTIONS skip; no reason to rewrite |
| Context propagation | `Context.create` (ALS)             | `c.var.user` only              | Hono vars don't propagate into Effect fibers or native callbacks; ALS does          |
| User isolation      | App-layer `WHERE user_id = ?`      | Postgres RLS                   | SQLite doesn't support RLS; app-layer is correct and explicit                       |
| Key generation      | `crypto.randomBytes(32)` hex       | UUID v4                        | 256 bits vs 122 bits of entropy; hex is URL-safe without encoding                   |

---

## Migration Command

```bash
# From packages/opencode
bun run db generate --name add-multi-user-isolation
```

Generates `migration/<timestamp>_add-multi-user-isolation/migration.sql`.

---

## Sources

- Hono bearer-auth docs (verified): https://hono.dev/docs/middleware/builtin/bearer-auth
- Hono createMiddleware factory (verified): https://hono.dev/docs/helpers/factory
- Node.js AsyncLocalStorage (Stability 2, verified): https://nodejs.org/api/async_context.html
- Drizzle RLS docs (Postgres-only, verified): https://orm.drizzle.team/docs/rls
- node-argon2 README (native addon requirement confirmed): https://github.com/ranisalt/node-argon2
- Existing codebase patterns: `src/util/context.ts`, `src/control-plane/workspace-context.ts`, `src/session/session.sql.ts`, `src/server/server.ts`
