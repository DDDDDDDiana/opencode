---
phase: 5
slug: session-derived-ownership-closure
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Bun test                                                                                                                                                  |
| **Config file**        | `packages/opencode/bunfig.toml`                                                                                                                           |
| **Quick run command**  | `bun test test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000`                                      |
| **Full suite command** | `bun test test/server/session-messages.test.ts test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000` |
| **Estimated runtime**  | ~30 seconds                                                                                                                                               |

---

## Sampling Rate

- **After every task commit:** Run `bun test test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000`
- **After every plan wave:** Run `bun test test/server/session-messages.test.ts test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-task Verification Map

| task ID  | Plan | Wave | Requirement      | Test Type   | Automated Command                                                                                                    | File Exists | Status     |
| -------- | ---- | ---- | ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | SESS-09          | integration | `bun test test/server/session-messages-ownership.test.ts --timeout 30000`                                            | ✅          | ⬜ pending |
| 05-01-02 | 01   | 1    | SESS-09          | integration | `bun test test/server/session-messages-ownership.test.ts --timeout 30000`                                            | ✅          | ⬜ pending |
| 05-02-01 | 02   | 2    | SESS-07, SESS-08 | integration | `bun test test/server/session-part-ownership.test.ts --timeout 30000`                                                | ✅          | ⬜ pending |
| 05-02-02 | 02   | 2    | SESS-07, SESS-08 | integration | `bun test test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
