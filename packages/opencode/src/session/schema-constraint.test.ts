import { describe, expect, test } from "bun:test"
import { Database } from "../storage/db"
import { SessionTable } from "./session.sql"
import { SessionID } from "./schema"

describe("SessionTable user_id NOT NULL constraint", () => {
  test("database rejects NULL user_id", () => {
    const now = Date.now()
    expect(() =>
      Database.use((db) =>
        db
          .insert(SessionTable)
          .values({
            id: SessionID.make(crypto.randomUUID()),
            project_id: "test-project" as any,
            user_id: null as any,
            slug: "test",
            directory: "/test",
            title: "test",
            version: "0.0.0",
            time_created: now,
            time_updated: now,
          })
          .run(),
      ),
    ).toThrow()
  })
})
