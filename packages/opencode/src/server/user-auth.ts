import { Log } from "../util/log"
import { UserContext } from "../user/user-context"
import { valid, verify } from "../user"
import { Database } from "../storage/db"
import { ApiKeyTable } from "../user/user.sql"
import type { UserID } from "../user/schema"

const log = Log.create({ service: "user-auth" })
const seen = new Map<string, number>()

export async function resolve(key: string | undefined) {
  if (!key) return { state: "anonymous" as const, reason: "missing" as const }

  if (!valid(key)) {
    throttle(key, "malformed")
    return { state: "anonymous" as const, reason: "invalid" as const }
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
  return { state: "anonymous" as const, reason: "invalid" as const }
}

function throttle(key: string, reason: string) {
  const now = Date.now()
  const last = seen.get(key)
  if (!last || now - last > 60000) {
    log.info("anonymous", { reason })
    seen.set(key, now)
  }
}
