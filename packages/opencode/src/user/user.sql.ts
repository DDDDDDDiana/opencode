import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"
import type { UserID } from "./schema"

export const UserTable = sqliteTable("user", {
  id: text().$type<UserID>().primaryKey(),
  name: text().notNull(),
  quota_agent_calls: integer(),
  quota_concurrent_sessions: integer(),
  quota_daily_tokens: integer(),
  model_allowlist: text(),
  ...Timestamps,
})

export const ApiKeyTable = sqliteTable(
  "api_key",
  {
    id: text().primaryKey(),
    user_id: text()
      .$type<UserID>()
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    hash: text().notNull(),
    ...Timestamps,
  },
  (table) => [index("api_key_user_idx").on(table.user_id)],
)
