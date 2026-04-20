import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"

type Row = Record<string, any>
type NumericMetric = { values: number[] }

const args = process.argv.slice(2)
if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
  console.error(`Usage: bun run packages/opencode/script/perf-log-summary.ts <perf-jsonl-file-or-directory> [...more]\n\nExamples:\n  bun run packages/opencode/script/perf-log-summary.ts /tmp/opencode-perf\n  bun run packages/opencode/script/perf-log-summary.ts /tmp/opencode-perf/*.jsonl`)
  process.exit(args.length === 0 ? 1 : 0)
}

function collectFiles(inputs: string[]): string[] {
  const result: string[] = []
  const visit = (item: string) => {
    if (!fs.existsSync(item)) return
    const stat = fs.statSync(item)
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(item)) visit(path.join(item, child))
      return
    }
    if (stat.isFile() && item.endsWith(".jsonl")) result.push(item)
  }
  for (const input of inputs) visit(input)
  return result.sort()
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] === undefined) return sorted[base]
  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return "-"
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function table(headers: string[], rows: string[][]): string {
  const output = []
  output.push(`| ${headers.join(" | ")} |`)
  output.push(`| ${headers.map(() => "---").join(" | ")} |`)
  for (const row of rows) output.push(`| ${row.join(" | ")} |`)
  return output.join("\n")
}

async function main() {
const files = collectFiles(args)
if (files.length === 0) {
  console.error("No .jsonl files found")
  process.exit(1)
}

const metrics = new Map<string, NumericMetric>()
const eventCounts = new Map<string, number>()
const busByType = new Map<string, number[]>()
const streamGapByRequest = new Map<string, { sessionID?: string; requestID?: string; providerID?: string; modelID?: string; values: number[] }>()
const slowRows: Row[] = []
let firstTs: string | undefined
let lastTs: string | undefined
let rowsRead = 0
let parseErrors = 0

function addMetric(name: string, value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return
  const metric = metrics.get(name) ?? { values: [] }
  metric.values.push(value)
  metrics.set(name, metric)
}

function addBusType(type: string | undefined, value: unknown) {
  if (!type || typeof value !== "number" || !Number.isFinite(value)) return
  const list = busByType.get(type) ?? []
  list.push(value)
  busByType.set(type, list)
}

function addSlow(row: Row, score: number) {
  slowRows.push({ ...row, _score: score })
  slowRows.sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
  if (slowRows.length > 25) slowRows.pop()
}

async function readFile(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    let row: Row
    try {
      row = JSON.parse(line)
    } catch {
      parseErrors++
      continue
    }
    rowsRead++
    if (typeof row.ts === "string") {
      firstTs = firstTs === undefined || row.ts < firstTs ? row.ts : firstTs
      lastTs = lastTs === undefined || row.ts > lastTs ? row.ts : lastTs
    }
    const event = String(row.event ?? "unknown")
    eventCounts.set(event, (eventCounts.get(event) ?? 0) + 1)

    switch (event) {
      case "llm.stream.event":
        addMetric("llm.stream.event.gapMs", row.gapMs)
        if (typeof row.gapMs === "number") {
          const key = `${row.sessionID ?? ""}:${row.requestID ?? ""}`
          const bucket = streamGapByRequest.get(key) ?? {
            sessionID: row.sessionID,
            requestID: row.requestID,
            providerID: row.providerID,
            modelID: row.modelID,
            values: [],
          }
          bucket.values.push(row.gapMs)
          streamGapByRequest.set(key, bucket)
          if (row.gapMs >= 1000) addSlow(row, row.gapMs)
        }
        break
      case "llm.stream.handle":
        addMetric("llm.stream.handle.durationMs", row.durationMs)
        if (typeof row.durationMs === "number" && row.durationMs >= 100) addSlow(row, row.durationMs)
        break
      case "llm.request.first":
        addMetric("llm.request.first.ttfbMs", row.ttfbMs)
        break
      case "llm.request.finish_step":
        addMetric("llm.request.finish_step.durationMs", row.durationMs)
        break
      case "bus.publish":
        addMetric("bus.publish.durationMs", row.durationMs)
        addBusType(row.type, row.durationMs)
        if (typeof row.durationMs === "number" && row.durationMs >= 50) addSlow(row, row.durationMs)
        break
      case "part_delta.publish_batch":
        addMetric("part_delta.publish_batch.durationMs", row.durationMs)
        addMetric("part_delta.publish_batch.oldestAgeMs", row.oldestAgeMs)
        break
      case "part_delta.publish_entry":
        addMetric("part_delta.publish_entry.durationMs", row.durationMs)
        addMetric("part_delta.publish_entry.ageMs", row.ageMs)
        break
      case "session.update_part":
        addMetric("session.update_part.durationMs", row.durationMs)
        break
      case "session.update_message":
        addMetric("session.update_message.durationMs", row.durationMs)
        break
      case "sse.write":
        addMetric("sse.write.durationMs", row.durationMs)
        if (typeof row.durationMs === "number" && row.durationMs >= 50) addSlow(row, row.durationMs)
        break
      case "sse.flush":
        addMetric("sse.flush.durationMs", row.durationMs)
        addMetric("sse.flush.remaining", row.remaining)
        break
      case "tool.task.execute":
        addMetric("tool.task.execute.durationMs", row.durationMs)
        break
      case "runtime.sample":
        addMetric("runtime.eventLoopLagMs", row.eventLoopLagMs)
        addMetric("runtime.rssMb", row.rssMb)
        addMetric("runtime.heapUsedMb", row.heapUsedMb)
        if (row.counters && typeof row.counters === "object") {
          for (const [name, value] of Object.entries(row.counters)) addMetric(`counter.${name}`, value)
        }
        break
    }
  }
}

for (const file of files) await readFile(file)

console.log(`# opencode perf log summary\n`)
console.log(`Files: ${files.length}`)
console.log(`Rows: ${rowsRead}${parseErrors ? ` (${parseErrors} parse errors)` : ""}`)
console.log(`Time range: ${firstTs ?? "-"} → ${lastTs ?? "-"}\n`)

const metricRows = [...metrics.entries()]
  .filter(([, metric]) => metric.values.length > 0)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, metric]) => {
    const values = metric.values
    return [
      name,
      String(values.length),
      fmt(avg(values)),
      fmt(quantile(values, 0.5)),
      fmt(quantile(values, 0.9)),
      fmt(quantile(values, 0.95)),
      fmt(quantile(values, 0.99)),
      fmt(Math.max(...values)),
    ]
  })
console.log(`## Numeric metrics\n`)
console.log(table(["metric", "n", "avg", "p50", "p90", "p95", "p99", "max"], metricRows))

const busRows = [...busByType.entries()]
  .sort((a, b) => quantile(b[1], 0.95) - quantile(a[1], 0.95))
  .slice(0, 20)
  .map(([type, values]) => [type, String(values.length), fmt(avg(values)), fmt(quantile(values, 0.95)), fmt(Math.max(...values))])
if (busRows.length) {
  console.log(`\n## Bus publish by event type\n`)
  console.log(table(["type", "n", "avg", "p95", "max"], busRows))
}

const streamRows = [...streamGapByRequest.values()]
  .filter((x) => x.values.length > 0)
  .sort((a, b) => quantile(b.values, 0.95) - quantile(a.values, 0.95))
  .slice(0, 20)
  .map((x) => [
    x.sessionID ?? "-",
    x.requestID ?? "-",
    x.providerID ?? "-",
    x.modelID ?? "-",
    String(x.values.length),
    fmt(avg(x.values)),
    fmt(quantile(x.values, 0.95)),
    fmt(Math.max(...x.values)),
  ])
if (streamRows.length) {
  console.log(`\n## Stream gap by request, worst p95 first\n`)
  console.log(table(["sessionID", "requestID", "provider", "model", "n", "avg gap", "p95 gap", "max gap"], streamRows))
}

const countRows = [...eventCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([event, count]) => [event, String(count)])
console.log(`\n## Event counts\n`)
console.log(table(["event", "count"], countRows))

if (slowRows.length) {
  console.log(`\n## Slow rows / large gaps\n`)
  const rows = slowRows.slice(0, 15).map((row) => [
    row.ts ?? "-",
    row.event ?? "-",
    row.sessionID ?? "-",
    row.requestID ?? "-",
    row.eventType ?? row.type ?? row.name ?? "-",
    fmt(row.gapMs ?? row.durationMs ?? row._score),
  ])
  console.log(table(["ts", "event", "sessionID", "requestID", "kind", "ms"], rows))
}

}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
