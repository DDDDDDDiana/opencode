import z from "zod"
import { Database, eq, sql } from "../storage/db"
import { UsageTable } from "./usage.sql"
import type { UserID } from "./schema"
import type { SessionID } from "../session/schema"

export namespace Usage {
  export const Stat = z.object({
    date: z.string(),
    tokens: z.number(),
  })
  export type Stat = z.output<typeof Stat>

  export function record(params: { userID: UserID; sessionID: SessionID; tokens: number }): void {
    Database.use((db) =>
      db
        .insert(UsageTable)
        .values({
          id: crypto.randomUUID(),
          user_id: params.userID,
          session_id: params.sessionID,
          tokens: params.tokens,
          date: new Date().toISOString().slice(0, 10),
        })
        .run(),
    )
  }

  export function stats(userID: UserID): Stat[] {
    return Database.use((db) =>
      db
        .select({ date: UsageTable.date, tokens: sql<number>`sum(${UsageTable.tokens})` })
        .from(UsageTable)
        .where(eq(UsageTable.user_id, userID))
        .groupBy(UsageTable.date)
        .all(),
    ).sort((a, b) => a.date.localeCompare(b.date))
  }
}
