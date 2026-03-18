import { Log } from "../util/log"
import { UserContext } from "../user/user-context"
import { valid, verify } from "../user"
import { Database } from "../storage/db"
import { ApiKeyTable } from "../user/user.sql"
import type { UserID } from "../user/schema"

const log = Log.create({ service: "user-auth" })
const seen = new Map<string, number>()

export async function resolve(key: string | undefined): Promise<import("../user/user-context").Authenticated> {
  if (!key) throw new Error("API key missing")

  if (!valid(key)) {
    throttle(key, "malformed")
    throw new Error("Invalid API key")
  }

  const rows = Database.use((db) => db.select().from(ApiKeyTable).all())

  for (const row of rows) {
    const match = await verify(key, row.hash)
    if (match) {
      log.debug("authenticated", { user_id: row.user_id })
      return { state: "authenticated" as const, user_id: row.user_id as UserID }
    }
  }

  throttle(key, "unknown")
  throw new Error("Unknown API key")
}

function throttle(key: string, reason: string) {
  const now = Date.now()
  const last = seen.get(key)
  if (!last || now - last > 60000) {
    log.info("anonymous", { reason })
    seen.set(key, now)
  }
}
