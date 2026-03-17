import { describe, test, expect } from "bun:test"
import { UserContext } from "./user-context"

describe("UserContext", () => {
  test("defaults to anonymous when no context", () => {
    const id = UserContext.get()
    expect(id.state).toBe("anonymous")
    if (id.state === "anonymous") expect(id.reason).toBe("missing")
  })

  test("provides authenticated identity", () => {
    const uid = "user_123" as import("./schema").UserID
    const result = UserContext.provide({ state: "authenticated", user_id: uid }, () => UserContext.get())
    expect(result.state).toBe("authenticated")
    if (result.state === "authenticated") {
      expect(result.user_id).toBe(uid)
    }
  })

  test("provides anonymous identity", () => {
    const result = UserContext.provide({ state: "anonymous", reason: "invalid" }, () => UserContext.get())
    expect(result.state).toBe("anonymous")
    if (result.state === "anonymous") {
      expect(result.reason).toBe("invalid")
    }
  })

  test("userID helper returns undefined for anonymous", () => {
    const id = UserContext.provide({ state: "anonymous", reason: "missing" }, () => UserContext.userID)
    expect(id).toBeUndefined()
  })

  test("authenticated helper returns correct boolean", () => {
    const uid = "user_123" as import("./schema").UserID
    const auth = UserContext.provide({ state: "authenticated", user_id: uid }, () => UserContext.authenticated)
    expect(auth).toBe(true)

    const anon = UserContext.provide({ state: "anonymous", reason: "missing" }, () => UserContext.authenticated)
    expect(anon).toBe(false)
  })
})
