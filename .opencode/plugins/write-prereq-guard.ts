// @ts-nocheck
// .opencode/plugins/write-prereq-guard.ts
import type { Plugin } from "@opencode-ai/plugin"
const LOG = `${process.cwd()}/.opencode/log.txt`
const TAG = "[write-prereq-guard]"
const GUARD = new Set(["write", "edit", "apply_patch", "multiedit"])
const TARGET = new Set(["tfp_coder", "tfp-coder"])
const NEED = ["get_tfp_statement_detail", "get_tfp_components_details"]
const AGENT = new Map<string, string>()
const DONE = new Map<string, Set<string>>()
const WARN = new Map<string, { agent: string; tool: string; missing: string[] }>()
const PENDING = new Map<string, Map<string, string>>()
const lines: string[] = []
let queue = Promise.resolve()
function norm(v: unknown) {
  if (typeof v !== "string") return ""
  return v.trim().toLowerCase()
}
function stamp() {
  return new Date().toISOString()
}
function text(v: unknown) {
  if (v === undefined) return ""
  if (typeof v === "string") return v
  return JSON.stringify(v)
}
function write(line: string, data?: unknown) {
  const row = data === undefined ? `${TAG} ${stamp()} ${line}` : `${TAG} ${stamp()} ${line} ${text(data)}`
  lines.push(row)
  queue = queue.then(() => Bun.write(LOG, lines.join("\n") + "\n")).catch(() => undefined)
  return queue
}
function key(sessionID: string, callID: string) {
  return `${sessionID}:${callID}`
}
function findAgent(msgs: any[]) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.info?.role === "user" && typeof m?.info?.agent === "string") return norm(m.info.agent)
  }
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (typeof m?.info?.agent === "string") return norm(m.info.agent)
  }
  return ""
}
function doneFromMsgs(msgs: any[]) {
  const set = new Set<string>()
  for (const m of msgs) {
    for (const p of m?.parts ?? []) {
      if (p?.type !== "tool") continue
      if (p?.state?.status !== "completed") continue
      const t = norm(p?.tool)
      if (t) set.add(t)
    }
  }
  return set
}
function hit(set: Set<string>, name: string) {
  const n = norm(name)
  for (const t of set) {
    if (t === n) return true
    if (t.endsWith(`_${n}`)) return true
  }
  return false
}
// 仅拦截明显写文件 bash，避免误伤读命令/测试命令
function bashWrite(args: any) {
  const cmd = typeof args?.command === "string" ? args.command : ""
  if (!cmd) return false
  return (
    />>?[^>=]/.test(cmd) ||
    /(?:^|[\s;|&])tee\s/.test(cmd) ||
    /(?:^|[\s;|&])sed\s+(-\w*i|--in-place)/.test(cmd) ||
    /open\s*\(.*['"]\s*w[a+]?\s*['"]/.test(cmd) ||
    /\.write\s*\(/.test(cmd) ||
    /writeFile(?:Sync)?\s*\(/.test(cmd)
  )
}
function doneGet(sessionID: string) {
  const set = DONE.get(sessionID)
  if (set) return set
  const next = new Set<string>()
  DONE.set(sessionID, next)
  return next
}
function pendingGet(sessionID: string) {
  const set = PENDING.get(sessionID)
  if (set) return set
  const next = new Map<string, string>()
  PENDING.set(sessionID, next)
  return next
}
function pendingDel(sessionID: string, id: string) {
  const set = PENDING.get(sessionID)
  if (!set) return
  set.delete(id)
  if (set.size === 0) PENDING.delete(sessionID)
}
function warnText(input: { agent: string; tool: string; missing: string[] }) {
  return [
    `${TAG} 警告`,
    `本次写相关工具调用已继续执行。`,
    `agent '${input.agent}' 在调用 '${input.tool}' 前建议先调用: ${input.missing.join(", ")}`,
    `请在后续步骤优先补齐这些前置查询。`,
  ].join("\n")
}
function inject(output: any, msg: string, missing: string[]) {
  if (typeof output?.output === "string") {
    output.output = `${msg}\n\n${output.output}`
    output.metadata = {
      ...(output.metadata ?? {}),
      prereq_warning: true,
      prereq_missing: missing,
    }
    return "tool"
  }
  if (Array.isArray(output?.content)) {
    output.content.unshift({
      type: "text",
      text: msg,
    })
    return "mcp"
  }
  return "none"
}
export const WritePrereqGuardPlugin: Plugin = async ({ client }) => {
  lines.length = 0
  await write("plugin init", {
    log: LOG,
    mode: "warn-visible",
    guard: [...GUARD, "bash(write)"],
    target: [...TARGET],
    need: NEED,
  })
  return {
    "chat.message": async (input) => {
      const a = norm(input.agent)
      if (!a) return
      AGENT.set(input.sessionID, a)
      await write("chat.message", { sessionID: input.sessionID, agent: a })
    },
    "tool.execute.before": async (input, output) => {
      const tool = norm(input.tool)
      const check = GUARD.has(tool) || (tool === "bash" && bashWrite(output.args))
      const id = key(input.sessionID, input.callID)
      await write("tool.execute.before enter", {
        sessionID: input.sessionID,
        callID: input.callID,
        tool: input.tool,
        toolNorm: tool,
        check,
      })
      if (!check) {
        await write("skip tool", { tool })
        return
      }
      const res = await client.session.messages({ sessionID: input.sessionID }, { throwOnError: true }).catch(() => undefined)
      const msgs = Array.isArray(res) ? res : (res as any)?.data ?? []
      await write("messages", { count: msgs.length })
      const cached = AGENT.get(input.sessionID) ?? ""
      const fromMsgs = findAgent(msgs)
      const agent = cached || fromMsgs
      await write("agent", { cached, fromMsgs, final: agent })
      if (!agent || !TARGET.has(agent)) {
        await write("skip agent", { agent })
        return
      }
      const done = doneGet(input.sessionID)
      for (const t of doneFromMsgs(msgs)) done.add(t)
      const miss = NEED.filter((x) => !hit(done, x))
      await write("prereq", {
        sessionID: input.sessionID,
        done: [...done],
        need: NEED,
        missing: miss,
      })
      if (miss.length === 0) {
        WARN.delete(id)
        pendingDel(input.sessionID, id)
        await write("allow", { tool, agent })
        return
      }
      const note = { agent, tool: input.tool, missing: miss }
      const msg = warnText(note)
      WARN.set(id, note)
      pendingGet(input.sessionID).set(id, msg)
      console.warn(msg)
      await write("warn", { reason: msg, tool, agent, missing: miss })
    },
    "tool.execute.after": async (input, output) => {
      const t = norm(input.tool)
      if (t) doneGet(input.sessionID).add(t)
      const id = key(input.sessionID, input.callID)
      const note = WARN.get(id)
      await write("tool.execute.after", {
        sessionID: input.sessionID,
        tool: t,
        warned: !!note,
      })
      if (!note) return
      WARN.delete(id)
      pendingDel(input.sessionID, id)
      const msg = warnText(note)
      const mode = inject(output, msg, note.missing)
      await write("visible", {
        sessionID: input.sessionID,
        tool: t,
        mode,
        missing: note.missing,
      })
    },
    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return
      const set = PENDING.get(input.sessionID)
      if (!set || set.size === 0) return
      const list = [...set.values()]
      PENDING.delete(input.sessionID)
      output.system.push(
        [
          "<system-reminder>",
          "The following plugin warning(s) were raised for prior tool calls and must be visible to the agent:",
          ...list,
          "</system-reminder>",
        ].join("\n\n"),
      )
      await write("system visible", {
        sessionID: input.sessionID,
        count: list.length,
      })
    },
  }
}
export default WritePrereqGuardPlugin