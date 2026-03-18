import { test, expect, describe } from "bun:test"
import { resolve } from "./user-auth"

describe("resolve error scenarios", () => {
  test("throws when API key missing", async () => {
    expect(resolve(undefined)).rejects.toThrow("API key missing")
  })

  test("throws when API key invalid", async () => {
    expect(resolve("invalid")).rejects.toThrow("Invalid API key")
  })

  test("throws when API key unknown", async () => {
    expect(resolve("sk-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")).rejects.toThrow(
      "Unknown API key",
    )
  })
})
