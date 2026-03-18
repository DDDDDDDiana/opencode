---
phase: 07
slug: validation-evidence-restoration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-18
---

# Phase 07 — Validation Strategy

> Documentation phase: Validation via artifact completeness checks.

---

## Test Infrastructure

| Property               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Framework**          | Bash file checks                                                                      |
| **Config file**        | none — documentation phase                                                            |
| **Quick run command**  | `test -f .planning/milestones/v1.1-VALIDATION.md`                                     |
| **Full suite command** | `ls .planning/phases/0{1..4}/*-VALIDATION.md .planning/milestones/v1.1-VALIDATION.md` |
| **Estimated runtime**  | <1 second                                                                             |

---

## Sampling Rate

- **After every task commit:** Verify created files exist
- **After every plan wave:** Check all 5 documents present
- **Before `/gsd-verify-work`:** All artifacts indexed and complete
- **Max feedback latency:** <1 second

---

## Per-task Verification Map

| task ID  | Plan | Wave | Requirement | Test Type  | Automated Command                                 | File Exists | Status   |
| -------- | ---- | ---- | ----------- | ---------- | ------------------------------------------------- | ----------- | -------- |
| 07-01-01 | 01   | 1    | EVID-01     | file check | `ls .planning/phases/0{1..4}/*-VALIDATION.md`     | ✅          | ✅ green |
| 07-02-01 | 02   | 1    | EVID-01     | file check | `test -f .planning/milestones/v1.1-VALIDATION.md` | ✅          | ✅ green |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                 | Requirement | Why Manual                | Test Instructions                                                                       |
| ------------------------ | ----------- | ------------------------- | --------------------------------------------------------------------------------------- |
| Document content quality | EVID-01     | Human review needed       | Maintainer reads v1.1-VALIDATION.md and confirms it indexes Phase 5-6 artifacts clearly |
| Backfilled accuracy      | EVID-01     | Historical reconstruction | Maintainer verifies Phase 1-4 VALIDATION.md files reference actual test files from v1.0 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency <1s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-18
