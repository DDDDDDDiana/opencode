import { PerfLog } from "@/util/perf-log"

export type StreamEvent = unknown

export type CreateEventStreamOptions = {
  maxQueue?: number
  flushMs?: number
  coalesce?: {
    key(event: StreamEvent): string | undefined
    merge?(existing: StreamEvent, incoming: StreamEvent): StreamEvent
  }
  serialize?: (event: StreamEvent) => string
  onOverflow?: (queued: number) => void
  name?: string
  sessionID?: string
}

export function createEventStreamWriter(
  stream: {
    writeSSE(input: { data: string }): Promise<void> | void
    close(): void
  },
  opts?: CreateEventStreamOptions,
) {
  const max = opts?.maxQueue ?? 1000
  const delay = opts?.flushMs ?? 16
  const coalesce = opts?.coalesce
  const serialize = opts?.serialize ?? JSON.stringify
  const streamID = `${opts?.name ?? "sse"}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`

  PerfLog.counter("sse.active", 1, {
    streamID,
    name: opts?.name,
    sessionID: opts?.sessionID,
  })

  let queue: { event: StreamEvent; key: string | undefined }[] = []
  let closed = false
  let flushing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pushLogCounter = 0

  function schedule() {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, delay)
  }

  function maybeLogPush(eventType: string | undefined, coalesced: boolean) {
    pushLogCounter++
    const sampleEvery = Number(process.env.OPENCODE_PERF_LOG_SSE_PUSH_SAMPLE_EVERY ?? 100)
    const queueThreshold = Number(process.env.OPENCODE_PERF_LOG_SSE_QUEUE_LOG ?? 25)
    if (queue.length >= queueThreshold || PerfLog.shouldSampleEvery(pushLogCounter, sampleEvery)) {
      PerfLog.emit("sse.push", {
        streamID,
        name: opts?.name,
        sessionID: opts?.sessionID,
        eventType,
        queueLength: queue.length,
        coalesced,
      })
    }
  }

  function push(event: StreamEvent) {
    if (closed) return

    const key = coalesce ? coalesce.key(event) : undefined

    const eventType = (event as any)?.type
    if (key !== undefined) {
      const idx = queue.findIndex((e) => e.key === key)
      if (idx !== -1) {
        const existing = queue[idx].event
        queue[idx] = {
          key,
          event: coalesce?.merge ? coalesce.merge(existing, event) : event,
        }
        maybeLogPush(eventType, true)
        schedule()
        return
      }
    }

    if (queue.length >= max) {
      PerfLog.emit("sse.overflow", {
        streamID,
        name: opts?.name,
        sessionID: opts?.sessionID,
        eventType,
        queueLength: queue.length,
        maxQueue: max,
      })
      opts?.onOverflow?.(queue.length)
      close()
      return
    }

    queue.push({ event, key })
    maybeLogPush(eventType, false)
    schedule()
  }

  async function flush() {
    if (closed) return
    if (flushing) return
    flushing = true

    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }

    const started = Number(process.hrtime.bigint() / 1_000_000n)
    let flushed = 0
    let bytes = 0
    try {
      while (!closed && queue.length > 0) {
        const items = queue
        queue = []
        for (const item of items) {
          try {
            const data = serialize(item.event)
            bytes += data.length
            const writeStarted = Number(process.hrtime.bigint() / 1_000_000n)
            await stream.writeSSE({ data })
            flushed++
            const writeDurationMs = Number(process.hrtime.bigint() / 1_000_000n) - writeStarted
            if (writeDurationMs >= Number(process.env.OPENCODE_PERF_LOG_SSE_WRITE_MS ?? 10)) {
              PerfLog.emit("sse.write", {
                streamID,
                name: opts?.name,
                sessionID: opts?.sessionID,
                eventType: (item.event as any)?.type,
                durationMs: writeDurationMs,
                bytes: data.length,
              })
            }
          } catch {
            close()
            return
          }
        }
      }
    } finally {
      const durationMs = Number(process.hrtime.bigint() / 1_000_000n) - started
      const durationThreshold = Number(process.env.OPENCODE_PERF_LOG_SSE_FLUSH_MS ?? 5)
      const countThreshold = Number(process.env.OPENCODE_PERF_LOG_SSE_FLUSH_COUNT ?? 5)
      if (flushed >= countThreshold || durationMs >= durationThreshold || queue.length > 0) {
        PerfLog.emit("sse.flush", {
          streamID,
          name: opts?.name,
          sessionID: opts?.sessionID,
          flushed,
          bytes,
          durationMs,
          remaining: queue.length,
        })
      }
      flushing = false
      if (!closed && queue.length > 0) schedule()
    }
  }

  function close() {
    if (closed) return
    closed = true
    PerfLog.counter("sse.active", -1, {
      streamID,
      name: opts?.name,
      sessionID: opts?.sessionID,
    })
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    queue = []
  }

  function startHeartbeat(input?: {
    intervalMs?: number
    eventFactory?: () => StreamEvent
  }) {
    const ms = input?.intervalMs ?? 10_000
    const factory =
      input?.eventFactory ??
      (() => ({ type: "server.heartbeat", properties: {} }))
    const id = setInterval(() => push(factory()), ms)
    return () => clearInterval(id)
  }

  return { push, flush, close, startHeartbeat }
}
