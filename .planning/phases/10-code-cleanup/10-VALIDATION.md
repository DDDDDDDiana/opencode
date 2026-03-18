---
phase: 10
slug: code-cleanup
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-18
updated: 2026-03-18
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Framework**          | bun:test (built-in)                                                    |
| **Config file**        | none — uses bun test                                                   |
| **Quick run command**  | `cd packages/opencode && bun test user-context.test.ts server.test.ts` |
| **Full suite command** | `cd packages/opencode && bun test && bun typecheck`                    |
| **Estimated runtime**  | ~2 seconds                                                             |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/opencode && bun test user-context.test.ts server.test.ts`
- **After every plan wave:** Run `cd packages/opencode && bun test && bun typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-task Verification Map

| task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                      | File Exists | Status   |
| -------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------------------- | ----------- | -------- |
| 10-01-01 | 01   | 1    | CLEAN-01    | type        | `cd packages/opencode && bun typecheck`                                | ✅          | ✅ green |
| 10-01-01 | 01   | 1    | CLEAN-01    | type        | `cd packages/opencode && bun test user-context.test-d.ts`              | ✅          | ✅ green |
| 10-01-01 | 01   | 1    | CLEAN-02    | unit        | `cd packages/opencode && bun test user-context.test.ts`                | ✅          | ✅ green |
| 10-01-02 | 01   | 1    | CLEAN-02    | unit        | `cd packages/opencode && bun test user-auth.test.ts`                   | ✅          | ✅ green |
| 10-01-02 | 01   | 1    | CLEAN-02    | unit        | `cd packages/opencode && bun test server.test.ts`                      | ✅          | ✅ green |
| 10-01-03 | 01   | 1    | CLEAN-03    | unit        | `cd packages/opencode && bun test user-context.test.ts server.test.ts` | ✅          | ✅ green |
| 10-01-03 | 01   | 1    | CLEAN-01/02 | integration | `cd packages/opencode && bun test codebase-clean.test.ts`              | ✅          | ✅ green |

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
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-18

---

## Validation Audit 2026-03-18

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 3     |
| Resolved   | 3     |
| Escalated  | 0     |

**Generated Tests:**

- `packages/opencode/src/user/user-context.test-d.ts` — Type-level negative tests
- `packages/opencode/src/server/user-auth.test.ts` — resolve() error scenarios
- `packages/opencode/src/user/codebase-clean.test.ts` — Grep verification for Anonymous remnants

**Results:** All 14 tests passing, typecheck clean, Phase 10 is Nyquist-compliant.
