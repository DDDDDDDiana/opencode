import { describe, expect, test } from "bun:test"
import { Database } from "../storage/db"
import { SessionTable } from "./session.sql"
import { SessionID } from "./schema"

describe("Migration NULL user_id handling", () => {
  test("migration SQL filters out NULL user_id sessions", () => {
    const rows = Database.use((db) => db.select().from(SessionTable).all())
    for (const row of rows) {
      expect(row.user_id).not.toBeNull()
    }
  })
})
