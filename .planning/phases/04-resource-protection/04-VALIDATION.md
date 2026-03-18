---
phase: 4
slug: resource-protection
status: backfilled
nyquist_compliant: false
created: 2026-03-18
---

# Phase 4 — Validation Strategy

> Backfilled validation documentation for v1.0 Phase 4

---

## Test Infrastructure

| Property               | Value                                 |
| ---------------------- | ------------------------------------- |
| **Framework**          | Bun test                              |
| **Config file**        | `packages/opencode/bunfig.toml`       |
| **Quick run command**  | `bun test test/user/ --timeout 30000` |
| **Full suite command** | `bun test test/user/ --timeout 30000` |
| **Estimated runtime**  | ~10 seconds                           |

---

## Sampling Rate

Reconstructed - original sampling not documented during v1.0 execution.

Recommended for future work:

- After every task commit: Run quota and usage tests
- Before verification: Full test suite must be green
- Max feedback latency: 10 seconds

---

## Per-task Verification Map

| Task ID  | Requirement | Test Type | Automated Command                        | Evidence                                    |
| -------- | ----------- | --------- | ---------------------------------------- | ------------------------------------------- |
| 04-01-01 | USAGE-01-03 | manual    | Code review of usage.ts and processor.ts | Usage recording after LLM calls             |
| 04-02-01 | QUOTA-04    | manual    | Code review of errors.ts                 | QuotaError and ModelAccessError definitions |
| 04-03-01 | QUOTA-02-03 | manual    | Code review of session/index.ts          | Concurrent session and token cap checks     |
| 04-04-01 | QUOTA-01    | manual    | Code review of prompt.ts                 | Agent call limit enforcement                |
| 04-05-01 | MODEL-01-03 | manual    | Code review of provider.ts               | Model allowlist enforcement                 |

---

## Wave 0 Requirements

Not applicable - backfilled documentation.

---

## Manual-Only Verifications

All Phase 4 verifications were manual code review based. No automated tests existed during v1.0 for quota enforcement and usage tracking.

Per VERIFICATION.md:

- Agent call quota enforced (verified via prompt.ts inspection)
- Concurrent session limit checked (verified via createNext() inspection)
- Daily token cap enforced (verified via processor.ts inspection)
- Quota errors are clear and structured (verified via errors.ts inspection)
- Model allowlist enforced (verified via provider.ts inspection)
- Usage recorded after each LLM call (verified via processor.ts inspection)

---

## Validation Sign-Off

- [x] All tasks have manual verification documented
- [x] Code references point to actual implementation files
- [x] Backfilled nature clearly documented in frontmatter
- [x] Evidence extracted from existing VERIFICATION.md

**Approval:** Backfilled from v1.0 artifacts on 2026-03-18
