import { randomBytes } from "crypto"
import { hash, compare } from "bcrypt"
import z from "zod"
import type { ApiKey, UserID } from "./schema"
import { Database, NotFoundError, eq } from "../storage/db"
import { UserTable, ApiKeyTable } from "./user.sql"

const PREFIX = "sk-"
const COST = 8

export function generate(): ApiKey {
  const bytes = randomBytes(32)
  return `${PREFIX}${bytes.toString("hex")}` as ApiKey
}

export function valid(key: string): key is ApiKey {
  return key.startsWith(PREFIX) && key.length === 67
}

export async function hashKey(key: ApiKey): Promise<string> {
  return hash(key, COST)
}

export async function verify(key: ApiKey, hashed: string): Promise<boolean> {
  return compare(key, hashed)
}

export type { UserID, ApiKey } from "./schema"

export namespace User {
  export const Info = z.object({
    id: z.custom<UserID>(),
    name: z.string(),
    quotaAgentCalls: z.number().nullable(),
    quotaConcurrentSessions: z.number().nullable(),
    quotaDailyTokens: z.number().nullable(),
    modelAllowlist: z.array(z.string()).nullable(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  export type Info = z.output<typeof Info>

  function fromRow(row: typeof UserTable.$inferSelect): Info {
    return {
      id: row.id,
      name: row.name,
      quotaAgentCalls: row.quota_agent_calls ?? null,
      quotaConcurrentSessions: row.quota_concurrent_sessions ?? null,
      quotaDailyTokens: row.quota_daily_tokens ?? null,
      modelAllowlist: row.model_allowlist ? JSON.parse(row.model_allowlist) : null,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export async function create(params: {
    name: string
    quotas?: {
      agentCalls?: number
      concurrentSessions?: number
      dailyTokens?: number
      modelAllowlist?: string[]
    }
  }): Promise<{ user: Info; apiKey: ApiKey }> {
    const id = crypto.randomUUID() as UserID
    const key = generate()
    const hashed = await hashKey(key)
    const now = Date.now()

    const row = Database.use((db) => {
      db.insert(UserTable)
        .values({
          id,
          name: params.name,
          quota_agent_calls: params.quotas?.agentCalls ?? null,
          quota_concurrent_sessions: params.quotas?.concurrentSessions ?? null,
          quota_daily_tokens: params.quotas?.dailyTokens ?? null,
          model_allowlist: params.quotas?.modelAllowlist ? JSON.stringify(params.quotas.modelAllowlist) : null,
          time_created: now,
          time_updated: now,
        })
        .run()
      db.insert(ApiKeyTable)
        .values({
          id: crypto.randomUUID(),
          user_id: id,
          hash: hashed,
          time_created: now,
          time_updated: now,
        })
        .run()
      return db.select().from(UserTable).where(eq(UserTable.id, id)).get()!
    })

    return { user: fromRow(row), apiKey: key }
  }

  export async function get(id: UserID): Promise<Info> {
    const row = Database.use((db) => db.select().from(UserTable).where(eq(UserTable.id, id)).get())
    if (!row) throw new NotFoundError({ message: `User not found: ${id}` })
    return fromRow(row)
  }
}
