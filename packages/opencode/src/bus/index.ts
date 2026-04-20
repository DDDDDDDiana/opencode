import z from "zod"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { BusEvent } from "./bus-event"
import { GlobalBus } from "./global"

export namespace Bus {
  const log = Log.create({ service: "bus" })
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
    const pending: Array<void | Promise<void>> = []
    const s = state()

    for (const sub of s.subscriptions.get(def.type) ?? []) {
      pending.push(sub(payload))
    }

    if (opts?.sessionID) {
      for (const sub of s.sessionSubscriptions.get(opts.sessionID) ?? []) {
        pending.push(sub(payload))
      }
    }

    if (opts?.wildcard !== false) {
      for (const sub of s.subscriptions.get("*") ?? []) {
        pending.push(sub(payload))
      }
    }

    if (opts?.global !== false) {
      GlobalBus.emit("event", {
        directory: Instance.directory,
        payload,
      })
    }
    return Promise.all(pending)
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
