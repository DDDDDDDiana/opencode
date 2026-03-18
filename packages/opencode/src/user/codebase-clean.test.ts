import { test, expect } from "bun:test"
import { $ } from "bun"

test("codebase has no Anonymous type remnants", async () => {
  const result = await $`grep -r "type Anonymous" src/user/ src/server/user-auth.ts`.nothrow()
  expect(result.exitCode).toBe(0)
})
