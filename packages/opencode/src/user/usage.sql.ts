import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"
import type { UserID } from "./schema"
import type { SessionID } from "../session/schema"

export const UsageTable = sqliteTable(
  "usage",
  {
    id: text().primaryKey(),
    user_id: text().$type<UserID>().notNull(),
    session_id: text().$type<SessionID>().notNull(),
    tokens: integer().notNull(),
    date: text().notNull(), // ISO date string "YYYY-MM-DD"
    ...Timestamps,
  },
  (table) => [index("usage_user_idx").on(table.user_id), index("usage_date_idx").on(table.date)],
)
