import type { Subprocess } from "bun"
import { resolve, dirname } from "path"
import { Instance } from "@/project/instance"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { Log } from "@/util/log"
import type { SessionID } from "./schema"
import type { MessageV2 } from "./message-v2"
import type { WorkerIpc } from "./worker-ipc"
import type { SessionPrompt } from "./prompt"
import type { PermissionID } from "@/permission/schema"
import type { PermissionNext } from "@/permission/next"
import type { QuestionID } from "@/question/schema"
import type { Question } from "@/question"
import { UserContext, type Identity } from "@/user/user-context"

const log = Log.create({ service: "session.worker-manager" })

const WORKER_ENTRY = resolve(dirname(import.meta.path), "worker.ts")
const DEFAULT_IDLE_TIMEOUT = 5 * 60_000

interface PendingPrompt {
  resolve: (result: MessageV2.WithParts) => void
  reject: (error: Error) => void
}

interface WorkerHandle {
  process: Subprocess
  sessionID: SessionID
  state: "starting" | "ready" | "busy" | "idle"
  lastActivity: number
  pendingPrompts: Map<string, PendingPrompt>
  idleTimer?: Timer
  readyPromise: Promise<void>
  readyResolve: () => void
}

interface ManagerState {
  workers: Map<SessionID, WorkerHandle>
  idleTimeout: number
  disposed: boolean
  promptIdCounter: number
}

export namespace WorkerManager {
  const state = Instance.state<ManagerState>(
    () => ({
      workers: new Map(),
      idleTimeout: DEFAULT_IDLE_TIMEOUT,
      disposed: false,
      promptIdCounter: 0,
    }),
    async (s) => {
      s.disposed = true
      const sessions = [...s.workers.keys()]
      log.info("disposing WorkerManager, shutting down workers", { count: sessions.length })
      await Promise.all(sessions.map((sid) => killWorkerInternal(s, sid)))
    },
  )

  export function setIdleTimeout(ms: number) {
    state().idleTimeout = ms
  }

  export function hasWorker(sessionID: SessionID): boolean {
    return state().workers.has(sessionID)
  }

  export function isBusy(sessionID: SessionID): boolean {
    const handle = state().workers.get(sessionID)
    if (!handle) return false
    return handle.state === "busy" || handle.state === "starting"
  }

  export function getWorkerSessionIDs(): SessionID[] {
    return [...state().workers.keys()]
  }

  function resetIdleTimer(s: ManagerState, handle: WorkerHandle) {
    if (handle.idleTimer) clearTimeout(handle.idleTimer)
    if (s.idleTimeout <= 0) return
    handle.idleTimer = setTimeout(() => {
      if (handle.state === "idle" && handle.pendingPrompts.size === 0) {
        log.info("idle timeout, killing worker", { sessionID: handle.sessionID })
        killWorkerInternal(s, handle.sessionID)
      }
    }, s.idleTimeout)
  }

  function spawn(s: ManagerState, sessionID: SessionID): WorkerHandle {
    if (s.disposed) throw new Error("WorkerManager is disposed")

    const existing = s.workers.get(sessionID)
    if (existing) return existing

    log.info("spawning worker", { sessionID })
    let readyResolve!: () => void
    const readyPromise = new Promise<void>((r) => {
      readyResolve = r
    })

    const directory = Instance.directory
    const boundHandler = Instance.bind((message: WorkerIpc.WorkerMessage) => {
      handleWorkerMessage(s, sessionID, message)
    })
    const child = Bun.spawn(["bun", "run", WORKER_ENTRY], {
      ipc: boundHandler,
      stdio: ["inherit", "inherit", "inherit"],
      env: {
        ...process.env,
      },
    })

    const handle: WorkerHandle = {
      process: child,
      sessionID,
      state: "starting",
      lastActivity: Date.now(),
      pendingPrompts: new Map(),
      readyPromise,
      readyResolve,
    }
    s.workers.set(sessionID, handle)

    child.exited.then((code) => {
      log.info("worker exited", { sessionID, code })
      const current = s.workers.get(sessionID)
      if (current === handle) {
        for (const [, pending] of handle.pendingPrompts) {
          pending.reject(new Error(`Worker process exited with code ${code}`))
        }
        handle.pendingPrompts.clear()
        s.workers.delete(sessionID)
      }
    })

    sendToWorker(handle, {
      type: "init",
      directory,
      sessionID,
    })

    return handle
  }

  function sendToWorker(handle: WorkerHandle, msg: WorkerIpc.CoordinatorMessage) {
    try {
      handle.process.send(msg)
    } catch (e) {
      log.error("failed to send to worker", { sessionID: handle.sessionID, error: e })
    }
  }

  function handleWorkerMessage(s: ManagerState, sessionID: SessionID, msg: WorkerIpc.WorkerMessage) {
    const handle = s.workers.get(sessionID)
    if (!handle) return

    switch (msg.type) {
      case "ready":
        handle.state = "idle"
        handle.readyResolve()
        resetIdleTimer(s, handle)
        log.info("worker ready", { sessionID })
        break

      case "bus.event":
        GlobalBus.emit("event", {
          directory: msg.directory,
          payload: msg.event,
        })
        Bus.forward(msg.event)
        break

      case "prompt.result": {
        const pending = handle.pendingPrompts.get(msg.id)
        if (pending) {
          handle.pendingPrompts.delete(msg.id)
          pending.resolve(msg.result)
        }
        handle.state = handle.pendingPrompts.size > 0 ? "busy" : "idle"
        handle.lastActivity = Date.now()
        if (handle.state === "idle") resetIdleTimer(s, handle)
        break
      }

      case "prompt.error": {
        const pending = handle.pendingPrompts.get(msg.id)
        if (pending) {
          handle.pendingPrompts.delete(msg.id)
          pending.reject(new Error(msg.error))
        }
        handle.state = handle.pendingPrompts.size > 0 ? "busy" : "idle"
        handle.lastActivity = Date.now()
        if (handle.state === "idle") resetIdleTimer(s, handle)
        break
      }

      case "exited":
        log.info("worker confirmed exit", { sessionID })
        break
    }
  }

  function captureIdentity(): Identity | undefined {
    try {
      return UserContext.get()
    } catch {
      return undefined
    }
  }

  async function ensureReady(sessionID: SessionID): Promise<WorkerHandle> {
    const s = state()
    let handle = s.workers.get(sessionID)
    if (!handle) handle = spawn(s, sessionID)
    await handle.readyPromise
    return handle
  }

  export async function prompt(input: SessionPrompt.PromptInput): Promise<MessageV2.WithParts> {
    const s = state()
    const identity = captureIdentity()
    const handle = await ensureReady(input.sessionID)
    const id = `p_${++s.promptIdCounter}`
    handle.state = "busy"
    if (handle.idleTimer) clearTimeout(handle.idleTimer)

    return new Promise<MessageV2.WithParts>((resolve, reject) => {
      handle.pendingPrompts.set(id, { resolve, reject })
      sendToWorker(handle, { type: "prompt", id, input, identity })
    })
  }

  export async function promptAsync(input: SessionPrompt.PromptInput): Promise<void> {
    const s = state()
    const identity = captureIdentity()
    const handle = await ensureReady(input.sessionID)
    const id = `p_${++s.promptIdCounter}`
    handle.state = "busy"
    if (handle.idleTimer) clearTimeout(handle.idleTimer)

    handle.pendingPrompts.set(id, {
      resolve: () => {},
      reject: (err) => {
        log.error("async prompt failed", { sessionID: input.sessionID, error: err })
      },
    })
    sendToWorker(handle, { type: "prompt", id, input, identity })
  }

  export async function command(input: SessionPrompt.CommandInput): Promise<MessageV2.WithParts> {
    const s = state()
    const identity = captureIdentity()
    const handle = await ensureReady(input.sessionID)
    const id = `p_${++s.promptIdCounter}`
    handle.state = "busy"
    if (handle.idleTimer) clearTimeout(handle.idleTimer)

    return new Promise<MessageV2.WithParts>((resolve, reject) => {
      handle.pendingPrompts.set(id, { resolve, reject })
      sendToWorker(handle, { type: "prompt_command", id, input, identity })
    })
  }

  export async function loop(sessionID: SessionID): Promise<MessageV2.WithParts> {
    const s = state()
    const identity = captureIdentity()
    const handle = await ensureReady(sessionID)
    const id = `p_${++s.promptIdCounter}`
    handle.state = "busy"
    if (handle.idleTimer) clearTimeout(handle.idleTimer)

    return new Promise<MessageV2.WithParts>((resolve, reject) => {
      handle.pendingPrompts.set(id, { resolve, reject })
      sendToWorker(handle, { type: "prompt_loop", id, sessionID, identity })
    })
  }

  export async function shell(input: SessionPrompt.ShellInput): Promise<MessageV2.WithParts> {
    const s = state()
    const identity = captureIdentity()
    const handle = await ensureReady(input.sessionID)
    const id = `p_${++s.promptIdCounter}`
    handle.state = "busy"
    if (handle.idleTimer) clearTimeout(handle.idleTimer)

    return new Promise<MessageV2.WithParts>((resolve, reject) => {
      handle.pendingPrompts.set(id, { resolve, reject })
      sendToWorker(handle, { type: "prompt_shell", id, input, identity })
    })
  }

  export function cancel(sessionID: SessionID) {
    const handle = state().workers.get(sessionID)
    if (!handle) return
    sendToWorker(handle, { type: "cancel", sessionID })
  }

  export function forwardPermissionReply(input: {
    requestID: PermissionID
    reply: PermissionNext.Reply
    message?: string
  }) {
    for (const handle of state().workers.values()) {
      sendToWorker(handle, {
        type: "permission.reply",
        requestID: input.requestID,
        reply: input.reply,
        message: input.message,
      })
    }
  }

  export function forwardQuestionReply(input: { requestID: QuestionID; answers: Question.Answer[] }) {
    for (const handle of state().workers.values()) {
      sendToWorker(handle, {
        type: "question.reply",
        requestID: input.requestID,
        answers: input.answers,
      })
    }
  }

  export function forwardQuestionReject(requestID: QuestionID) {
    for (const handle of state().workers.values()) {
      sendToWorker(handle, {
        type: "question.reject",
        requestID,
      })
    }
  }

  async function killWorkerInternal(s: ManagerState, sessionID: SessionID) {
    const handle = s.workers.get(sessionID)
    if (!handle) return
    if (handle.idleTimer) clearTimeout(handle.idleTimer)

    sendToWorker(handle, { type: "shutdown" })

    const exited = await Promise.race([
      handle.process.exited,
      new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 5000)),
    ])

    if (exited === "timeout") {
      log.warn("worker did not exit gracefully, killing", { sessionID })
      handle.process.kill()
      await Promise.race([handle.process.exited, new Promise((r) => setTimeout(r, 2000))])
    }

    s.workers.delete(sessionID)
  }

  export async function shutdown() {
    const s = state()
    s.disposed = true
    const sessions = [...s.workers.keys()]
    log.info("shutting down all workers", { count: sessions.length })
    await Promise.all(sessions.map((sid) => killWorkerInternal(s, sid)))
  }
}
