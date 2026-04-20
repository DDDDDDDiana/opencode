import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { MessageV2 } from "@/session/message-v2"
import type { SessionID, MessageID, PartID } from "@/session/schema"

export namespace PartDeltaDispatcher {
  export type PartDeltaInput = {
    sessionID: SessionID
    messageID: MessageID
    partID: PartID
    field: string
    delta: string
  }

  type Entry = PartDeltaInput & {
    key: string
    createdAt: number
    updatedAt: number
  }

  const state = Instance.state(
    () => ({
      entries: new Map<string, Entry>(),
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
      flushing: false,
      batchMs: Number(process.env.OPENCODE_PART_DELTA_BATCH_MS ?? 50),
    }),
    async (s) => {
      if (s.timer) clearTimeout(s.timer)
      s.timer = undefined
      s.entries.clear()
    },
  )

  function keyOf(input: PartDeltaInput) {
    return `${input.sessionID}\n${input.messageID}\n${input.partID}\n${input.field}`
  }

  async function publish(entry: Entry) {
    await Bus.publish(
      MessageV2.Event.PartDelta,
      {
        sessionID: entry.sessionID,
        messageID: entry.messageID,
        partID: entry.partID,
        field: entry.field,
        delta: entry.delta,
      },
      { global: false, logLevel: "off" },
    )
  }

  export function enqueue(input: PartDeltaInput): void {
    const s = state()
    const key = keyOf(input)
    const existing = s.entries.get(key)
    if (existing) {
      existing.delta += input.delta
      existing.updatedAt = Date.now()
    } else {
      const now = Date.now()
      s.entries.set(key, {
        ...input,
        key,
        createdAt: now,
        updatedAt: now,
      })
    }
    if (!s.timer) {
      s.timer = setTimeout(() => {
        s.timer = undefined
        flushAll()
      }, s.batchMs)
    }
  }

  export async function flushAll(): Promise<void> {
    const s = state()
    if (s.flushing) return
    s.flushing = true
    if (s.timer) {
      clearTimeout(s.timer)
      s.timer = undefined
    }
    const batch = [...s.entries.values()]
    s.entries.clear()
    for (const entry of batch) {
      await publish(entry)
    }
    s.flushing = false
  }

  export async function flushPart(input: {
    sessionID: SessionID
    messageID: MessageID
    partID: PartID
  }): Promise<void> {
    const s = state()
    const matched: Entry[] = []
    for (const [key, entry] of s.entries) {
      if (
        entry.sessionID === input.sessionID &&
        entry.messageID === input.messageID &&
        entry.partID === input.partID
      ) {
        matched.push(entry)
        s.entries.delete(key)
      }
    }
    for (const entry of matched) {
      await publish(entry)
    }
  }

  export async function flushMessage(input: {
    sessionID: SessionID
    messageID: MessageID
  }): Promise<void> {
    const s = state()
    const matched: Entry[] = []
    for (const [key, entry] of s.entries) {
      if (
        entry.sessionID === input.sessionID &&
        entry.messageID === input.messageID
      ) {
        matched.push(entry)
        s.entries.delete(key)
      }
    }
    for (const entry of matched) {
      await publish(entry)
    }
  }

  export async function flushSession(input: {
    sessionID: SessionID
  }): Promise<void> {
    const s = state()
    const matched: Entry[] = []
    for (const [key, entry] of s.entries) {
      if (entry.sessionID === input.sessionID) {
        matched.push(entry)
        s.entries.delete(key)
      }
    }
    for (const entry of matched) {
      await publish(entry)
    }
  }
}
