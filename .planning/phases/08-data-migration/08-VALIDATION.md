---
phase: 8
slug: data-migration
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-18
updated: 2026-03-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                               |
| ---------------------- | --------------------------------------------------- |
| **Framework**          | bun:test (built-in)                                 |
| **Config file**        | none — uses bun test                                |
| **Quick run command**  | `cd packages/opencode && bun typecheck`             |
| **Full suite command** | `cd packages/opencode && bun test && bun typecheck` |
| **Estimated runtime**  | ~2 seconds                                          |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/opencode && bun typecheck`
- **After every plan wave:** Run `cd packages/opencode && bun test && bun typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-task Verification Map

| task ID  | Plan | Wave | Requirement      | Test Type   | Automated Command                                                              | File Exists | Status   |
| -------- | ---- | ---- | ---------------- | ----------- | ------------------------------------------------------------------------------ | ----------- | -------- |
| 08-01-01 | 01   | 1    | MIGR-02          | type        | `cd packages/opencode && bun typecheck`                                        | ✅          | ✅ green |
| 08-01-01 | 01   | 1    | MIGR-02          | integration | `cd packages/opencode && bun test src/session/schema-constraint.test.ts`       | ✅          | ✅ green |
| 08-01-02 | 01   | 1    | MIGR-01          | integration | `cd packages/opencode && bun test src/session/migration-null-handling.test.ts` | ✅          | ✅ green |
| 08-01-02 | 01   | 1    | MIGR-01, MIGR-02 | integration | `ls packages/opencode/migration/*_make_user_id_required/migration.sql`         | ✅          | ✅ green |

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
| Gaps found | 2     |
| Resolved   | 2     |
| Escalated  | 0     |

**Generated Tests:**

- `packages/opencode/src/session/schema-constraint.test.ts` — Runtime constraint validation
- `packages/opencode/src/session/migration-null-handling.test.ts` — Migration NULL handling verification

**Results:** All 2 tests passing, Phase 8 is Nyquist-compliant.
