---
phase: 04-resource-protection
verified: 2026-03-17T15:15:50Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 4: Resource Protection Verification Report

**Phase Goal:** Users cannot exceed their allocated resources and can only access permitted models  
**Verified:** 2026-03-17T15:15:50Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                  | Status     | Evidence                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| 1   | A user who has exhausted their agent call quota receives a clear error — the request is rejected, not silently dropped | ✓ VERIFIED | QuotaError thrown in prompt.ts line 338 with kind="agent_calls", limit, and current          |
| 2   | A user cannot open more concurrent sessions than their limit allows                                                    | ✓ VERIFIED | QuotaError thrown in session/index.ts line 337 with kind="concurrent_sessions" before insert |
| 3   | A user who has hit their daily token cap cannot start new LLM calls until the cap resets                               | ✓ VERIFIED | QuotaError thrown in processor.ts line 66 before LLM.stream() with kind="daily_tokens"       |
| 4   | A user attempting to use a model not on their allowlist receives an error listing the permitted models                 | ✓ VERIFIED | ModelAccessError thrown in provider.ts line 1241 with model and allowed array                |
| 5   | Token consumption is recorded per session after each LLM call completes, and is visible via the usage API              | ✓ VERIFIED | Usage.record() called in processor.ts line 271 after finish-step with tokens.total           |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                     | Expected                                  | Status     | Details                                                          |
| -------------------------------------------- | ----------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `packages/opencode/src/user/errors.ts`       | QuotaError and ModelAccessError contracts | ✓ VERIFIED | Exports both NamedError classes with correct structured payloads |
| `packages/opencode/src/session/processor.ts` | Usage.record() in finish-step             | ✓ VERIFIED | Called after tokens assigned, guarded by UserContext.userID      |
| `packages/opencode/src/session/processor.ts` | Daily token cap before LLM.stream()       | ✓ VERIFIED | QuotaError thrown before stream, inside while(true) loop         |
| `packages/opencode/src/session/index.ts`     | Concurrent session quota in createNext()  | ✓ VERIFIED | Count query + QuotaError before Database.use insert block        |
| `packages/opencode/src/session/prompt.ts`    | Agent call quota in loop()                | ✓ VERIFIED | Check after step++, throws QuotaError when step > limit          |
| `packages/opencode/src/provider/provider.ts` | Allowlist check in getModel()             | ✓ VERIFIED | ModelAccessError thrown before return info, null = unlimited     |

### Key Link Verification

| From                           | To                          | Via                                        | Status  | Details                                                                |
| ------------------------------ | --------------------------- | ------------------------------------------ | ------- | ---------------------------------------------------------------------- |
| processor.ts finish-step       | UsageTable                  | Usage.record()                             | ✓ WIRED | Import present, called with userID + sessionID + tokens.total          |
| session/index.ts createNext()  | SessionTable                | count query filtered by user_id            | ✓ WIRED | Drizzle count() query with eq(user_id) + isNull(time_archived)         |
| session/processor.ts process() | UsageTable                  | Usage.stats() sum for today                | ✓ WIRED | Usage.stats(uid) called, today's tokens summed before LLM.stream()     |
| prompt.ts loop()               | UserTable quota_agent_calls | User.get(uid).quotaAgentCalls              | ✓ WIRED | User.get() called each iteration, quotaAgentCalls checked after step++ |
| provider.ts getModel()         | UserTable model_allowlist   | User.get(uid).modelAllowlist               | ✓ WIRED | User.get() called, modelAllowlist checked, null = skip                 |
| user/errors.ts                 | session/index.ts            | import QuotaError from @/user/errors       | ✓ WIRED | Import confirmed at line 35                                            |
| user/errors.ts                 | provider/provider.ts        | import ModelAccessError from @/user/errors | ✓ WIRED | Import confirmed at line 21                                            |

### Requirements Coverage

| Requirement | Source Plan | Description                                             | Status      | Evidence                                                    |
| ----------- | ----------- | ------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| QUOTA-01    | 04-04       | Agent call limit enforced in session prompt loop        | ✓ SATISFIED | QuotaError thrown in prompt.ts after step++ exceeds limit   |
| QUOTA-02    | 04-03       | Concurrent session limit checked at Session.create()    | ✓ SATISFIED | Count query + QuotaError in createNext() before insert      |
| QUOTA-03    | 04-03       | Daily token cap checked before LLM.stream()             | ✓ SATISFIED | Usage.stats() sum checked in processor.ts before stream     |
| QUOTA-04    | 04-02       | Quota exceeded returns clear error (not silent failure) | ✓ SATISFIED | QuotaError with kind, limit, current — thrown not swallowed |
| MODEL-01    | 04-05       | User.model_allowlist stored as JSON string array        | ✓ SATISFIED | modelAllowlist: string[] \| null on User.Info               |
| MODEL-02    | 04-05       | Provider resolution checks allowlist before returning   | ✓ SATISFIED | Check in getModel() before return info                      |
| MODEL-03    | 04-05       | Disallowed model returns clear error with allowed list  | ✓ SATISFIED | ModelAccessError({ model, allowed }) thrown                 |
| USAGE-01    | 04-01       | UsageTable records user_id, session_id, tokens, date    | ✓ SATISFIED | Usage.record() writes all four fields                       |
| USAGE-02    | 04-01       | Token counts extracted from LLM response metadata       | ✓ SATISFIED | usage.tokens.total from finish-step event                   |
| USAGE-03    | 04-01       | Usage written after each LLM.stream() completes         | ✓ SATISFIED | Usage.record() in finish-step case, after tokens assigned   |
| USAGE-04    | 04-03       | GET /user/:id/usage aggregates by date                  | ✓ SATISFIED | Covered by Phase 3 (USER-06); Usage.stats() returns by date |

### Anti-Patterns Found

| File                 | Line | Pattern                               | Severity | Impact                             |
| -------------------- | ---- | ------------------------------------- | -------- | ---------------------------------- |
| session/index.ts     | 879  | TODO: update models.dev pricing model | ℹ️ Info  | Pre-existing, unrelated to Phase 4 |
| session/prompt.ts    | 363  | TODO: centralize "invoke tool" logic  | ℹ️ Info  | Pre-existing, unrelated to Phase 4 |
| session/prompt.ts    | 1867 | TODO: task tool complex input         | ℹ️ Info  | Pre-existing, unrelated to Phase 4 |
| provider/provider.ts | 133  | @ts-ignore + TODO: kill this code     | ℹ️ Info  | Pre-existing, unrelated to Phase 4 |
| provider/provider.ts | 263  | TODO: process.env direct use          | ℹ️ Info  | Pre-existing, unrelated to Phase 4 |

No blockers. All TODOs are pre-existing and unrelated to Phase 4 changes.

### Human Verification Required

None. All success criteria are verifiable programmatically via code inspection.

### Gaps Summary

No gaps. All 5 observable truths verified, all artifacts substantive and wired, all 11 Phase 4 requirements satisfied. Type checking passes with zero errors.

---

_Verified: 2026-03-17T15:15:50Z_  
_Verifier: OpenCode (gsd-verifier)_
