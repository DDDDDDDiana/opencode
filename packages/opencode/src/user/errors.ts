import z from "zod"
import { NamedError } from "@opencode-ai/util/error"

export const QuotaError = NamedError.create(
  "QuotaError",
  z.object({
    kind: z.enum(["agent_calls", "concurrent_sessions", "daily_tokens"]),
    limit: z.number(),
    current: z.number(),
  }),
)

export const ModelAccessError = NamedError.create(
  "ModelAccessError",
  z.object({
    model: z.string(),
    allowed: z.array(z.string()),
  }),
)
