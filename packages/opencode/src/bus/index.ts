import z from "zod"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { BusEvent } from "./bus-event"
import { GlobalBus } from "./global"
import { PerfLog } from "@/util/perf-log"

export namespace Bus {
  const log = Log.create({ service: "bus" })
  let publishLogCounter = 0
  type Subscription = (event: any) => void

  export const InstanceDisposed = BusEvent.define(
    "server.instance.disposed",
    z.object({
      directory: z.string(),
    }),
  )

  const state = Instance.state(
    () => {
      const subscriptions = new Map<any, Subscription[]>()
      const sessionSubscriptions = new Map<string, Subscription[]>()

      return {
        subscriptions,
        sessionSubscriptions,
      }
    },
    async (entry) => {
      const event = {
        type: InstanceDisposed.type,
        properties: {
          directory: Instance.directory,
        },
      }

      const seen = new Set<Subscription>()
      const notify = (sub: Subscription) => {
        if (seen.has(sub)) return
        seen.add(sub)
        sub(event)
      }

      for (const sub of entry.subscriptions.get("*") ?? []) notify(sub)
      for (const subs of entry.sessionSubscriptions.values()) {
        for (const sub of subs) notify(sub)
      }
    },
  )

  export type PublishOptions = {
    global?: boolean
    logLevel?: "info" | "debug" | "off"
    wildcard?: boolean
    sessionID?: string
  }

  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    opts?: PublishOptions,
  ) {
    const payload = {
      type: def.type,
      properties,
    }
    const level = opts?.logLevel ?? "info"
    if (level === "info") {
      log.info("publishing", {
        type: def.type,
      })
    } else if (level === "debug") {
      log.debug("publishing", {
        type: def.type,
      })
    }

    const started = PerfLog.enabled() ? Number(process.hrtime.bigint() / 1_000_000n) : 0
    const s = state()
    const directSubscribers = s.subscriptions.get(def.type) ?? []
    const sessionSubscribers = opts?.sessionID ? (s.sessionSubscriptions.get(opts.sessionID) ?? []) : []
    const wildcardSubscribers = opts?.wildcard !== false ? (s.subscriptions.get("*") ?? []) : []
    const pending: Array<void | Promise<void>> = []

    for (const sub of directSubscribers) pending.push(sub(payload))
    for (const sub of sessionSubscribers) pending.push(sub(payload))
    for (const sub of wildcardSubscribers) pending.push(sub(payload))

    if (opts?.global !== false) {
      GlobalBus.emit("event", {
        directory: Instance.directory,
        payload,
      })
    }
    try {
      return await Promise.all(pending)
    } finally {
      if (PerfLog.enabled()) {
        const durationMs = Number(process.hrtime.bigint() / 1_000_000n) - started
        const sampleEvery = Number(process.env.OPENCODE_PERF_LOG_BUS_SAMPLE_EVERY ?? 100)
        const thresholdMs = Number(process.env.OPENCODE_PERF_LOG_BUS_MS ?? 10)
        const highVolume = def.type === "message.part.delta"
        publishLogCounter++
        if (!highVolume || durationMs >= thresholdMs || PerfLog.shouldSampleEvery(publishLogCounter, sampleEvery)) {
          PerfLog.emit("bus.publish", {
            type: def.type,
            sessionID: opts?.sessionID,
            global: opts?.global !== false,
            wildcard: opts?.wildcard !== false,
            directSubscribers: directSubscribers.length,
            sessionSubscribers: sessionSubscribers.length,
            wildcardSubscribers: wildcardSubscribers.length,
            pending: pending.length,
            durationMs,
          })
        }
      }
    }
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: z.infer<Definition["properties"]> }) => void,
  ) {
    return raw(def.type, callback)
  }

  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => "done" | undefined,
  ) {
    const unsub = subscribe(def, (event) => {
      if (callback(event)) unsub()
    })
  }

  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback)
  }

  export function subscribeSession(
    sessionID: string,
    callback: (event: any) => void | Promise<void>,
  ) {
    log.info("subscribing", { type: "session", sessionID })
    const sessions = state().sessionSubscriptions
    let match = sessions.get(sessionID) ?? []
    match.push(callback)
    sessions.set(sessionID, match)

    return () => {
      log.info("unsubscribing", { type: "session", sessionID })
      const match = sessions.get(sessionID)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
      if (match.length === 0) sessions.delete(sessionID)
    }
  }

  function raw(type: string, callback: (event: any) => void) {
    log.info("subscribing", { type })
    const subscriptions = state().subscriptions
    let match = subscriptions.get(type) ?? []
    match.push(callback)
    subscriptions.set(type, match)

    return () => {
      log.info("unsubscribing", { type })
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
    }
  }
}
