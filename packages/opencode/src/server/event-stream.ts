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

  let queue: { event: StreamEvent; key: string | undefined }[] = []
  let closed = false
  let flushing = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule() {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, delay)
  }

  function push(event: StreamEvent) {
    if (closed) return

    const key = coalesce ? coalesce.key(event) : undefined

    if (key !== undefined) {
      const idx = queue.findIndex((e) => e.key === key)
      if (idx !== -1) {
        const existing = queue[idx].event
        queue[idx] = {
          key,
          event: coalesce?.merge ? coalesce.merge(existing, event) : event,
        }
        schedule()
        return
      }
    }

    if (queue.length >= max) {
      opts?.onOverflow?.(queue.length)
      close()
      return
    }

    queue.push({ event, key })
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

    try {
      while (!closed && queue.length > 0) {
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
    } finally {
      flushing = false
      if (!closed && queue.length > 0) schedule()
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
