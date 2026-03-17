---
phase: 04-resource-protection
plan: "04"
subsystem: session/prompt
tags: [quota, agent-calls, prompt-loop]
dependency_graph:
  requires: [user/errors.ts, user/index.ts, user/user-context.ts]
  provides: [agent call quota enforcement in prompt loop]
  affects: [SessionPrompt.loop()]
tech_stack:
  added: []
  patterns: [step counter check after increment, fresh User.get() each iteration]
key_files:
  modified: [packages/opencode/src/session/prompt.ts]
key_decisions:
  - Check step > quotaAgentCalls after step++ so step=1 on first call and limit=1 allows exactly 1 call
  - User.get() called fresh each iteration so quota updates take effect immediately
metrics:
  duration_min: 3
  completed: 2026-03-17
  tasks: 1
  files: 1
---

# Phase 4 Plan 4: Agent Call Quota Summary

Agent call quota enforced in `SessionPrompt.loop()` after `step++` each iteration. Throws `QuotaError` with `kind=agent_calls` when step exceeds `quotaAgentCalls`.

## Tasks Completed

| Task                                     | Commit    | Files             |
| ---------------------------------------- | --------- | ----------------- |
| 1: agent call quota check in prompt loop | 4098cdbe7 | session/prompt.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
