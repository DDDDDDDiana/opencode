import { Instance } from "@/project/instance"
import { GlobalBus } from "@/bus/global"
import { SessionPrompt } from "./prompt"
import { PermissionNext } from "@/permission/next"
import { Question } from "@/question"
import { Plugin } from "@/plugin"
import { Format } from "@/format"
import { LSP } from "@/lsp"
import { VcsService } from "@/project/vcs"
import { Snapshot } from "@/snapshot"
import { Truncate } from "@/tool/truncation"
import { Log } from "@/util/log"
import { runPromiseInstance } from "@/effect/runtime"
import type { WorkerIpc } from "./worker-ipc"

const log = Log.create({ service: "session.worker" })

async function WorkerBootstrap() {
  log.info("bootstrapping worker", { directory: Instance.directory })
  await Plugin.init()
  await Format.init()
  await LSP.init()
  await runPromiseInstance(VcsService.use((s) => s.init()))
  Snapshot.init()
  Truncate.init()
}

function send(msg: WorkerIpc.WorkerMessage) {
  process.send!(msg)
}

function bridgeGlobalBus() {
  const original = GlobalBus.emit.bind(GlobalBus)
  const patched = (eventName: string | symbol, ...args: any[]): boolean => {
    if (eventName === "event") {
      const data = args[0] as { directory?: string; payload: any }
      send({
        type: "bus.event",
        directory: data.directory ?? "",
        event: data.payload,
      })
    }
    return original(eventName as "event", ...(args as [any]))
  }
  ;(GlobalBus as any).emit = patched
}

async function handleMessage(msg: WorkerIpc.CoordinatorMessage) {
  switch (msg.type) {
    case "prompt": {
      try {
        const result = await SessionPrompt.prompt(msg.input)
        send({ type: "prompt.result", id: msg.id, result })
      } catch (e: any) {
        log.error("prompt failed", { error: e })
        send({ type: "prompt.error", id: msg.id, error: e?.message ?? String(e) })
      }
      break
    }

    case "prompt_command": {
      try {
        const result = await SessionPrompt.command(msg.input)
        send({ type: "prompt.result", id: msg.id, result })
      } catch (e: any) {
        log.error("command failed", { error: e })
        send({ type: "prompt.error", id: msg.id, error: e?.message ?? String(e) })
      }
      break
    }

    case "prompt_shell": {
      try {
        const result = await SessionPrompt.shell(msg.input)
        send({ type: "prompt.result", id: msg.id, result })
      } catch (e: any) {
        log.error("shell failed", { error: e })
        send({ type: "prompt.error", id: msg.id, error: e?.message ?? String(e) })
      }
      break
    }

    case "prompt_loop": {
      try {
        const result = await SessionPrompt.loop({ sessionID: msg.sessionID })
        send({ type: "prompt.result", id: msg.id, result })
      } catch (e: any) {
        log.error("loop failed", { error: e })
        send({ type: "prompt.error", id: msg.id, error: e?.message ?? String(e) })
      }
      break
    }

    case "cancel": {
      SessionPrompt.cancel(msg.sessionID)
      break
    }

    case "permission.reply": {
      await PermissionNext.reply({
        requestID: msg.requestID,
        reply: msg.reply,
        message: msg.message,
      })
      break
    }

    case "question.reply": {
      await Question.reply({
        requestID: msg.requestID,
        answers: msg.answers,
      })
      break
    }

    case "question.reject": {
      await Question.reject(msg.requestID)
      break
    }

    case "shutdown": {
      log.info("shutdown requested")
      await Instance.disposeAll()
      send({ type: "exited" })
      setTimeout(() => process.exit(0), 100)
      break
    }
  }
}

async function main() {
  const initMsg = await new Promise<WorkerIpc.CoordinatorMessage & { type: "init" }>((resolve) => {
    process.once("message", (msg: WorkerIpc.CoordinatorMessage) => {
      if (msg.type === "init") resolve(msg as any)
    })
  })

  const { directory } = initMsg

  await Instance.provide({
    directory,
    init: WorkerBootstrap,
    async fn() {
      bridgeGlobalBus()
      send({ type: "ready" })
      log.info("worker ready", { directory })

      process.on("message", (msg: WorkerIpc.CoordinatorMessage) => {
        Instance.provide({
          directory,
          fn: () => handleMessage(msg),
        })
      })

      await new Promise<void>(() => {})
    },
  })
}

main().catch((e) => {
  log.error("worker fatal", { error: e })
  process.exit(1)
})
