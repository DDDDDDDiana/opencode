import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { User } from "../../user"
import { Usage } from "../../user/usage"
import type { UserID } from "../../user/schema"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const UserRoutes = lazy(() =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Create user",
        description:
          "Admin: Provision a local user projection for isolation and quota enforcement. Returns user info and plaintext API key for the provisioned user.",
        operationId: "user.create",
        responses: {
          201: {
            description: "User created",
            content: {
              "application/json": {
                schema: resolver(z.object({ user: User.Info, apiKey: z.string() })),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string(),
          quotaAgentCalls: z.number().nullable().optional(),
          quotaConcurrentSessions: z.number().nullable().optional(),
          quotaDailyTokens: z.number().nullable().optional(),
          modelAllowlist: z.string().array().nullable().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const result = await User.create({
          name: body.name,
          quotas: {
            agentCalls: body.quotaAgentCalls ?? undefined,
            concurrentSessions: body.quotaConcurrentSessions ?? undefined,
            dailyTokens: body.quotaDailyTokens ?? undefined,
            modelAllowlist: body.modelAllowlist ?? undefined,
          },
        })
        return c.json(result, 201)
      },
    )
    .get(
      "/:userID",
      describeRoute({
        summary: "Get user",
        description: "Admin: Retrieve user info by ID. Does not include the API key hash.",
        operationId: "user.get",
        responses: {
          200: {
            description: "User info",
            content: {
              "application/json": {
                schema: resolver(User.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ userID: z.string() })),
      async (c) => {
        const user = await User.get(c.req.valid("param").userID as UserID)
        return c.json(user)
      },
    )
    .patch(
      "/:userID",
      describeRoute({
        summary: "Update user",
        description: "Admin: Update quota settings or name for a provisioned user.",
        operationId: "user.update",
        responses: {
          200: {
            description: "Updated user info",
            content: {
              "application/json": {
                schema: resolver(User.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ userID: z.string() })),
      validator(
        "json",
        z.object({
          name: z.string().optional(),
          quotaAgentCalls: z.number().nullable().optional(),
          quotaConcurrentSessions: z.number().nullable().optional(),
          quotaDailyTokens: z.number().nullable().optional(),
          modelAllowlist: z.string().array().nullable().optional(),
        }),
      ),
      async (c) => {
        const user = await User.update(c.req.valid("param").userID as UserID, c.req.valid("json"))
        return c.json(user)
      },
    )
    .delete(
      "/:userID",
      describeRoute({
        summary: "Delete user",
        description: "Admin: Remove a provisioned user and orphan their sessions.",
        operationId: "user.remove",
        responses: {
          200: {
            description: "User removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ userID: z.string() })),
      async (c) => {
        await User.remove(c.req.valid("param").userID as UserID)
        return c.json(true)
      },
    )
    .get(
      "/:userID/usage",
      describeRoute({
        summary: "Get user usage",
        description: "Admin: Retrieve token usage stats aggregated by date for a user.",
        operationId: "user.usage",
        responses: {
          200: {
            description: "Usage stats",
            content: {
              "application/json": {
                schema: resolver(Usage.Stat.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ userID: z.string() })),
      async (c) => {
        const stats = Usage.stats(c.req.valid("param").userID as UserID)
        return c.json(stats)
      },
    ),
)
