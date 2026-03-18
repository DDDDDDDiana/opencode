---
phase: 06
slug: service-boundary-and-accounting-preservation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-18
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                         |
| ---------------------- | --------------------------------------------- |
| **Framework**          | Bun test                                      |
| **Config file**        | none — uses Bun's built-in test runner        |
| **Quick run command**  | `bun test test/user/usage-accounting.test.ts` |
| **Full suite command** | `bun test test/user/`                         |
| **Estimated runtime**  | ~4 seconds                                    |

---

## Sampling Rate

- **After every task commit:** Run usage accounting tests
- **After every plan wave:** Run full user test suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 4 seconds

---

## Per-task Verification Map

| task ID  | Plan | Wave | Requirement        | Test Type   | Automated Command                             | File Exists | Status   |
| -------- | ---- | ---- | ------------------ | ----------- | --------------------------------------------- | ----------- | -------- |
| 06-01-01 | 01   | 1    | BNDR-01, BNDR-02   | manual      | README review                                 | ✅          | ✅ green |
| 06-02-01 | 02   | 1    | USAGE-05, USAGE-06 | integration | `bun test test/user/usage-accounting.test.ts` | ✅          | ✅ green |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior       | Requirement | Why Manual          | Test Instructions                                                                                      |
| -------------- | ----------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| README clarity | BNDR-02     | Human review needed | Maintainer reads Multi-User Isolation section and confirms registration is described as external       |
| API doc tone   | BNDR-01     | Human review needed | Maintainer reviews user.ts route descriptions and confirms "Admin:" prefix conveys provisioning intent |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency <4s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-18
