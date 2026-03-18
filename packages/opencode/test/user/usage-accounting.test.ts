import { describe, test, expect, afterEach } from "bun:test"
import { User, type UserID } from "../../src/user"
import { Session } from "../../src/session"
import type { SessionID } from "../../src/session/schema"
import { Usage } from "../../src/user/usage"
import { Database, eq } from "../../src/storage/db"
import { UserTable } from "../../src/user/user.sql"
import { SessionTable } from "../../src/session/session.sql"
import { UsageTable } from "../../src/user/usage.sql"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"

const cleanup: Array<{ users: UserID[]; sessions: SessionID[] }> = []

afterEach(() => {
  for (const item of cleanup) {
    Database.use((db) => {
      for (const sid of item.sessions) {
        db.delete(SessionTable).where(eq(SessionTable.id, sid)).run()
      }
      for (const uid of item.users) {
        db.delete(UsageTable).where(eq(UsageTable.user_id, uid)).run()
        db.delete(UserTable).where(eq(UserTable.id, uid)).run()
      }
    })
  }
  cleanup.length = 0
})

describe("Usage accounting", () => {
  test("accrues tokens across multiple sessions for same user", async () => {
    await using tmp = await tmpdir({ git: true })

    const result = await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { user } = await User.create({ name: "test-user" })
        const session1 = await Session.createNext({ directory: tmp.path, userID: user.id })
        const session2 = await Session.createNext({ directory: tmp.path, userID: user.id })

        cleanup.push({ users: [user.id], sessions: [session1.id, session2.id] })

        Usage.record({ userID: user.id, sessionID: session1.id, tokens: 100 })
        Usage.record({ userID: user.id, sessionID: session2.id, tokens: 200 })

        const stats = Usage.stats(user.id)
        const total = stats.reduce((sum, s) => sum + s.tokens, 0)

        return { total, statsLength: stats.length }
      },
    })

    expect(result.total).toBe(300)
    expect(result.statsLength).toBeGreaterThan(0)
  })

  test("isolates usage between different users", async () => {
    await using tmp = await tmpdir({ git: true })

    const result = await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const userA = await User.create({ name: "user-a" })
        const userB = await User.create({ name: "user-b" })
        const sessionA = await Session.createNext({ directory: tmp.path, userID: userA.user.id })
        const sessionB = await Session.createNext({ directory: tmp.path, userID: userB.user.id })

        cleanup.push({
          users: [userA.user.id, userB.user.id],
          sessions: [sessionA.id, sessionB.id],
        })

        Usage.record({ userID: userA.user.id, sessionID: sessionA.id, tokens: 100 })
        Usage.record({ userID: userB.user.id, sessionID: sessionB.id, tokens: 200 })

        const statsA = Usage.stats(userA.user.id)
        const statsB = Usage.stats(userB.user.id)
        const totalA = statsA.reduce((sum, s) => sum + s.tokens, 0)
        const totalB = statsB.reduce((sum, s) => sum + s.tokens, 0)

        return { totalA, totalB }
      },
    })

    expect(result.totalA).toBe(100)
    expect(result.totalB).toBe(200)
  })

  test("aggregates usage by date", async () => {
    await using tmp = await tmpdir({ git: true })

    const result = await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { user } = await User.create({ name: "test-user" })
        const session = await Session.createNext({ directory: tmp.path, userID: user.id })

        cleanup.push({ users: [user.id], sessions: [session.id] })

        Usage.record({ userID: user.id, sessionID: session.id, tokens: 100 })
        Usage.record({ userID: user.id, sessionID: session.id, tokens: 150 })

        const stats = Usage.stats(user.id)

        return { stats }
      },
    })

    expect(result.stats.length).toBeGreaterThan(0)
    const total = result.stats.reduce((sum, s) => sum + s.tokens, 0)
    expect(total).toBe(250)
  })
})
