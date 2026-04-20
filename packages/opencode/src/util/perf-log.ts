import { createWriteStream, mkdirSync, type WriteStream } from "fs"
import path from "path"
import os from "os"
import { Global } from "../global"

type Fields = Record<string, unknown>

type CounterMap = Map<string, number>

export namespace PerfLog {
  const enabledValue = /^(1|true|yes|on|debug)$/i.test(process.env.OPENCODE_PERF_LOG ?? "")
  const redactKey = /authorization|api[_-]?key|secret|password|credential|cookie|bearer/i
  const counters: CounterMap = new Map()
  let stream: WriteStream | undefined
  let filepath = ""
  let seq = 0
  let runtimeTimer: ReturnType<typeof setInterval> | undefined
  let runtimeExpected = 0

  export function enabled() {
    return enabledValue
  }

  export function file() {
    ensure()
    return filepath
  }

  function ensure() {
    if (!enabledValue) return
    if (stream) return

    const dir = process.env.OPENCODE_PERF_LOG_DIR || path.join(Global.Path.data, "perf")
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    filepath = path.join(dir, `${stamp}-${process.pid}.jsonl`)
    stream = createWriteStream(filepath, { flags: "a" })

    writeRaw({
      event: "perf_log.start",
      file: filepath,
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    })

    if (process.env.OPENCODE_PERF_LOG_RUNTIME !== "0") {
      startRuntimeSampler(Number(process.env.OPENCODE_PERF_LOG_RUNTIME_MS ?? 1000))
    }
  }

  function startRuntimeSampler(intervalMs: number) {
    if (runtimeTimer) return
    runtimeExpected = Date.now() + intervalMs
    runtimeTimer = setInterval(() => {
      const now = Date.now()
      const lag = Math.max(0, now - runtimeExpected)
      runtimeExpected = now + intervalMs
      const memory = process.memoryUsage()
      emit("runtime.sample", {
        intervalMs,
        eventLoopLagMs: lag,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
        externalMb: Math.round((memory.external / 1024 / 1024) * 10) / 10,
        loadavg: os.loadavg(),
        counters: Object.fromEntries(counters),
      })
    }, intervalMs)
    runtimeTimer.unref?.()
  }

  function writeRaw(fields: Fields) {
    if (!stream) return
    const now = Date.now()
    const record = clean({
      ts: new Date(now).toISOString(),
      ms: now,
      hrMs: Number(process.hrtime.bigint() / 1_000_000n),
      seq: ++seq,
      ...fields,
    })
    stream.write(JSON.stringify(record) + "\n")
  }

  export function emit(event: string, fields?: Fields) {
    if (!enabledValue) return
    ensure()
    writeRaw({ event, ...(fields ?? {}) })
  }

  export function counter(name: string, delta: number, fields?: Fields) {
    if (!enabledValue) return
    const next = (counters.get(name) ?? 0) + delta
    counters.set(name, next)
    emit("counter", { name, delta, value: next, ...(fields ?? {}) })
  }

  export function span(event: string, fields?: Fields) {
    if (!enabledValue) {
      return { end(_extra?: Fields) {} }
    }
    const start = Number(process.hrtime.bigint() / 1_000_000n)
    return {
      end(extra?: Fields) {
        const end = Number(process.hrtime.bigint() / 1_000_000n)
        emit(event, {
          ...(fields ?? {}),
          ...(extra ?? {}),
          durationMs: end - start,
        })
      },
    }
  }

  export function shouldSampleEvery(count: number, every: number) {
    if (every <= 1) return true
    return count % every === 0
  }

  function clean(input: unknown, depth = 0): unknown {
    if (input === undefined) return undefined
    if (input === null) return null
    if (typeof input === "bigint") return Number(input)
    if (typeof input === "string") return input.length > 4096 ? input.slice(0, 4096) + "…" : input
    if (typeof input === "number" || typeof input === "boolean") return input
    if (input instanceof Error) {
      return {
        name: input.name,
        message: input.message,
      }
    }
    if (typeof input !== "object") return String(input)
    if (depth >= 5) return "[depth-limit]"
    if (Array.isArray(input)) return input.slice(0, 50).map((item) => clean(item, depth + 1))

    const output: Fields = {}
    for (const [key, value] of Object.entries(input as Fields)) {
      if (redactKey.test(key)) {
        output[key] = "[redacted]"
        continue
      }
      const cleaned = clean(value, depth + 1)
      if (cleaned !== undefined) output[key] = cleaned
    }
    return output
  }
}
