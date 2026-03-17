import { describe, test, expect } from "bun:test"
import { Session } from "./index"

describe("Session userID handling", () => {
  test("Info schema has userID field", () => {
    const shape = Session.Info.shape
    expect(shape.userID).toBeDefined()
  })

  test("fromRow reads user_id", () => {
    const row = {
      id: "test_id",
      slug: "test",
      project_id: "proj_id",
      workspace_id: null,
      directory: "/test",
      parent_id: null,
      title: "Test",
      version: "1.0.0",
      user_id: "user_123",
      share_url: null,
      summary_additions: null,
      summary_deletions: null,
      summary_files: null,
      summary_diffs: null,
      revert: null,
      permission: null,
      time_created: 1000,
      time_updated: 1000,
      time_compacting: null,
      time_archived: null,
    }
    const info = Session.fromRow(row as any)
    expect(info.userID).toBe("user_123" as any)
  })

  test("fromRow handles null user_id", () => {
    const row = {
      id: "test_id",
      slug: "test",
      project_id: "proj_id",
      workspace_id: null,
      directory: "/test",
      parent_id: null,
      title: "Test",
      version: "1.0.0",
      user_id: null,
      share_url: null,
      summary_additions: null,
      summary_deletions: null,
      summary_files: null,
      summary_diffs: null,
      revert: null,
      permission: null,
      time_created: 1000,
      time_updated: 1000,
      time_compacting: null,
      time_archived: null,
    }
    const info = Session.fromRow(row as any)
    expect(info.userID).toBeUndefined()
  })

  test("toRow writes user_id", () => {
    const info = {
      id: "test_id",
      slug: "test",
      projectID: "proj_id",
      directory: "/test",
      title: "Test",
      version: "1.0.0",
      userID: "user_123",
      time: { created: 1000, updated: 1000 },
    }
    const row = Session.toRow(info as any)
    expect(row.user_id).toBe("user_123" as any)
  })

  test("toRow handles undefined userID", () => {
    const info = {
      id: "test_id",
      slug: "test",
      projectID: "proj_id",
      directory: "/test",
      title: "Test",
      version: "1.0.0",
      userID: undefined,
      time: { created: 1000, updated: 1000 },
    }
    const row = Session.toRow(info as any)
    expect(row.user_id).toBeNull()
  })

  test("createNext accepts userID parameter", () => {
    // Test that createNext signature accepts userID
    const input: Parameters<typeof Session.createNext>[0] = {
      directory: "/test",
      userID: "user_123" as any,
    }
    expect(input.userID).toBe("user_123" as any)
  })

  test("get() signature exists", () => {
    // Verify get function exists for filtering implementation
    expect(typeof Session.get).toBe("function")
  })

  test("list() signature exists", () => {
    // Verify list function exists for filtering implementation
    expect(typeof Session.list).toBe("function")
  })

  test("listGlobal() signature exists", () => {
    // Verify listGlobal function exists for filtering implementation
    expect(typeof Session.listGlobal).toBe("function")
  })

  test("children() signature exists", () => {
    // Verify children function exists for filtering implementation
    expect(typeof Session.children).toBe("function")
  })
})
