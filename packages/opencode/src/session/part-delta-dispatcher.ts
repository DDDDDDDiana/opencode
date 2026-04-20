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
      flushTail: Promise.resolve() as Promise<void>,
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

  function serialize(task: () => Promise<void>): Promise<void> {
    const s = state()
    const run = s.flushTail.then(task, task)
    s.flushTail = run.catch(() => {})
    return run
  }

  function takeEntries(predicate: (entry: Entry) => boolean): Entry[] {
    const s = state()
    const result: Entry[] = []
    for (const [key, entry] of s.entries) {
      if (!predicate(entry)) continue
      result.push(entry)
      s.entries.delete(key)
    }
    return result
  }

  async function publishEntry(entry: Entry) {
    await Bus.publish(
      MessageV2.Event.PartDelta,
      {
        sessionID: entry.sessionID,
        messageID: entry.messageID,
        partID: entry.partID,
        field: entry.field,
        delta: entry.delta,
      },
      {
        global: false,
        logLevel: "off",
        wildcard: false,
        sessionID: entry.sessionID,
      },
    )
  }

  async function publishBatch(entries: Entry[]) {
    for (const entry of entries) {
      await publishEntry(entry)
    }
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
        void flushAll()
      }, s.batchMs)
    }
  }

  export async function flushAll(): Promise<void> {
    return serialize(async () => {
      const s = state()
      if (s.timer) {
        clearTimeout(s.timer)
        s.timer = undefined
      }
      await publishBatch(takeEntries(() => true))
    })
  }

  export async function flushPart(input: {
    sessionID: SessionID
    messageID: MessageID
    partID: PartID
  }): Promise<void> {
    return serialize(async () => {
      await publishBatch(
        takeEntries(
          (entry) =>
            entry.sessionID === input.sessionID &&
            entry.messageID === input.messageID &&
            entry.partID === input.partID,
        ),
      )
    })
  }

  export async function flushMessage(input: {
    sessionID: SessionID
    messageID: MessageID
  }): Promise<void> {
    return serialize(async () => {
      await publishBatch(
        takeEntries(
          (entry) =>
            entry.sessionID === input.sessionID &&
            entry.messageID === input.messageID,
        ),
      )
    })
  }

  export async function flushSession(input: {
    sessionID: SessionID
  }): Promise<void> {
    return serialize(async () => {
      await publishBatch(
        takeEntries((entry) => entry.sessionID === input.sessionID),
      )
    })
  }
}
