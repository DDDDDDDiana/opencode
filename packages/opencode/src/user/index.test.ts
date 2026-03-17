import { describe, test, expect } from "bun:test"
import { generate, valid, hashKey, verify } from "./index"

describe("API Key helpers", () => {
  test("generate creates sk- prefixed key", () => {
    const key = generate()
    expect(key.startsWith("sk-")).toBe(true)
    expect(key.length).toBe(67)
  })

  test("valid accepts correct format", () => {
    const key = generate()
    expect(valid(key)).toBe(true)
  })

  test("valid rejects malformed keys", () => {
    expect(valid("")).toBe(false)
    expect(valid("sk-")).toBe(false)
    expect(valid("invalid")).toBe(false)
  })

  test("hash and verify work correctly", async () => {
    const key = generate()
    const hashed = await hashKey(key)
    expect(hashed).not.toBe(key)
    expect(await verify(key, hashed)).toBe(true)
  })
})
