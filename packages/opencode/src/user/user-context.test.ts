import { describe, test, expect } from "bun:test"
import { UserContext } from "./user-context"

describe("UserContext", () => {
  test("provides authenticated identity", () => {
    const uid = "user_123" as import("./schema").UserID
    const result = UserContext.provide({ state: "authenticated", user_id: uid }, () => UserContext.get())
    expect(result.state).toBe("authenticated")
    expect(result.user_id).toBe(uid)
  })

  test("userID helper returns user_id for authenticated", () => {
    const uid = "user_456" as import("./schema").UserID
    const id = UserContext.provide({ state: "authenticated", user_id: uid }, () => UserContext.userID)
    expect(id).toBe(uid)
  })
})
