export type StreamEvent = unknown

export type CreateEventStreamOptions = {
  maxQueue?: number
  flushMs?: number
  coalesceKey?: (event: StreamEvent) => string | undefined
  serialize?: (event: StreamEvent) => string
  onOverflow?: (queued: number) => void
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
  const coalesce = opts?.coalesceKey
  const serialize = opts?.serialize ?? JSON.stringify

  let queue: { event: StreamEvent; key: string | undefined }[] = []
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule() {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      flush()
    }, delay)
  }

  function push(event: StreamEvent) {
    if (closed) return

    const key = coalesce ? coalesce(event) : undefined

    if (key !== undefined) {
      const idx = queue.findIndex((e) => e.key === key)
      if (idx !== -1) {
        queue[idx] = { event, key }
        schedule()
        return
      }
    }

    if (queue.length >= max) {
      const victim = queue.findIndex((e) => e.key !== undefined)
      if (victim !== -1) {
        queue.splice(victim, 1)
      } else {
        if (opts?.onOverflow) opts.onOverflow(queue.length)
        close()
        return
      }
    }

    queue.push({ event, key })
    schedule()
  }

  async function flush() {
    if (closed) return

    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }

    const items = queue
    queue = []

    for (const item of items) {
      try {
        await stream.writeSSE({ data: serialize(item.event) })
      } catch {
        close()
        return
      }
    }
  }

  function close() {
    if (closed) return
    closed = true
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
