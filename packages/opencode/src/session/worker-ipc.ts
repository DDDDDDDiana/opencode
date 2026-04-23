import type { SessionID, MessageID } from "./schema"
import type { PermissionID } from "@/permission/schema"
import type { QuestionID } from "@/question/schema"
import type { SessionPrompt } from "./prompt"
import type { MessageV2 } from "./message-v2"
import type { PermissionNext } from "@/permission/next"
import type { Question } from "@/question"

export namespace WorkerIpc {
  // ── Coordinator → Worker ──────────────────────────────────────────

  export type CoordinatorMessage =
    | {
        type: "init"
        directory: string
        sessionID: SessionID
      }
    | {
        type: "prompt"
        id: string
        input: SessionPrompt.PromptInput
      }
    | {
        type: "prompt_command"
        id: string
        input: SessionPrompt.CommandInput
      }
    | {
        type: "prompt_shell"
        id: string
        input: SessionPrompt.ShellInput
      }
    | {
        type: "prompt_loop"
        id: string
        sessionID: SessionID
      }
    | {
        type: "cancel"
        sessionID: SessionID
      }
    | {
        type: "permission.reply"
        requestID: PermissionID
        reply: PermissionNext.Reply
        message?: string
      }
    | {
        type: "question.reply"
        requestID: QuestionID
        answers: Question.Answer[]
      }
    | {
        type: "question.reject"
        requestID: QuestionID
      }
    | {
        type: "shutdown"
      }

  // ── Worker → Coordinator ──────────────────────────────────────────

  export type WorkerMessage =
    | {
        type: "ready"
      }
    | {
        type: "bus.event"
        directory: string
        event: { type: string; properties: any }
      }
    | {
        type: "prompt.result"
        id: string
        result: MessageV2.WithParts
      }
    | {
        type: "prompt.error"
        id: string
        error: string
      }
    | {
        type: "exited"
      }
}
