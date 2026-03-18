import { test, expect, describe, beforeAll } from "bun:test"
import { Hono } from "hono"
import { resolve } from "./user-auth"
import { UserContext } from "../user/user-context"
import type { UserID } from "../user/schema"

describe("server authentication middleware", () => {
  let app: Hono

  beforeAll(() => {
    app = new Hono()
      .use(async (c, next) => {
        const exempt = ["/health", "/metrics", "/ready", "/log", "/doc"]
        if (exempt.some((path) => c.req.path.startsWith(path))) {
          return next()
        }

        const key = c.req.header("x-opencode-api-key")
        const identity = await resolve(key)

        if (identity.state === "anonymous") {
          return c.json(
            { error: "Unauthorized", message: "Valid API key required" },
            {
              status: 401,
              headers: { "WWW-Authenticate": 'Bearer realm="opencode"' },
            },
          )
        }

        return UserContext.provide(identity, () => next())
      })
      .get("/session", (c) => c.json({ sessions: [] }))
      .get("/health", (c) => c.json({ status: "ok" }))
      .get("/metrics", (c) => c.text("metrics"))
      .get("/ready", (c) => c.json({ ready: true }))
      .get("/log", (c) => c.text("logs"))
      .get("/doc", (c) => c.text("docs"))
      .get("/doc/openapi.json", (c) => c.json({ openapi: "3.0.0" }))
  })

  test("no API key returns 401", async () => {
    const res = await app.request("/session")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: "Unauthorized", message: "Valid API key required" })
    expect(res.headers.get("WWW-Authenticate")).toBe('Bearer realm="opencode"')
  })

  test("invalid API key returns 401", async () => {
    const res = await app.request("/session", {
      headers: { "x-opencode-api-key": "invalid-key-12345" },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: "Unauthorized", message: "Valid API key required" })
  })

  test("/health accessible without API key", async () => {
    const res = await app.request("/health")
    expect(res.status).toBe(200)
  })

  test("/metrics accessible without API key", async () => {
    const res = await app.request("/metrics")
    expect(res.status).toBe(200)
  })

  test("/ready accessible without API key", async () => {
    const res = await app.request("/ready")
    expect(res.status).toBe(200)
  })

  test("/log accessible without API key", async () => {
    const res = await app.request("/log")
    expect(res.status).toBe(200)
  })

  test("/doc accessible without API key", async () => {
    const res = await app.request("/doc")
    expect(res.status).toBe(200)
  })

  test("/doc subpaths accessible without API key", async () => {
    const res = await app.request("/doc/openapi.json")
    expect(res.status).toBe(200)
  })
})
