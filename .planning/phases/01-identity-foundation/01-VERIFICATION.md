---
phase: 01-identity-foundation
verified: 2026-03-17T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 1: Identity Foundation Verification Report

**Phase Goal:** Users can authenticate with API keys and their identity propagates through the request pipeline  
**Verified:** 2026-03-17  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                    | Status     | Evidence                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A request with a valid `x-opencode-api-key` header is accepted and the user identity is available throughout the request | ✓ VERIFIED | `server.ts:134-138` reads header, calls `resolve()`, wraps `next()` in `UserContext.provide()`                                         |
| 2   | A request with an invalid or missing API key falls back to anonymous mode without error                                  | ✓ VERIFIED | `user-auth.ts:12-30` returns `anonymous/missing` or `anonymous/invalid` — no throw, no HTTP error                                      |
| 3   | API keys are never stored in plaintext — only hashes exist in the database                                               | ✓ VERIFIED | `index.ts:68` hashes before insert; `ApiKeyTable` has only `hash` column, no plaintext field                                           |
| 4   | UserContext is accessible via ALS anywhere in the call stack, mirroring how Instance works                               | ✓ VERIFIED | `UserContext` used in `session/index.ts`, `session/prompt.ts`, `session/processor.ts`, `provider/provider.ts` — all outside middleware |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                                       | Expected                                              | Status     | Details                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `packages/opencode/src/user/user.sql.ts`                                       | UserTable + ApiKeyTable schemas                       | ✓ VERIFIED | 27 lines, both tables defined with snake_case columns, FK, index    |
| `packages/opencode/src/user/user-context.ts`                                   | UserContext ALS with provide/get/userID/authenticated | ✓ VERIFIED | 41 lines, full implementation using `Context.create`                |
| `packages/opencode/src/user/index.ts`                                          | generate, valid, hashKey, verify + User namespace     | ✓ VERIFIED | 144 lines, all helpers + User.create/get/update/remove              |
| `packages/opencode/src/server/user-auth.ts`                                    | Global middleware resolver with throttled logging     | ✓ VERIFIED | 40 lines, resolve() + 60s dedupe throttle                           |
| `packages/opencode/src/user/user-context.test.ts`                              | UserContext tests                                     | ✓ VERIFIED | 41 lines, 5 tests covering all helpers                              |
| `packages/opencode/src/user/index.test.ts`                                     | API key helper tests                                  | ✓ VERIFIED | 28 lines, 4 tests covering generate/valid/hash/verify               |
| `packages/opencode/migration/20260317144535_identity_foundation/migration.sql` | Additive identity schema migration                    | ✓ VERIFIED | Creates usage table, alters user table with quota/allowlist columns |

### Key Link Verification

| From                           | To                         | Via                     | Status  | Details                                                        |
| ------------------------------ | -------------------------- | ----------------------- | ------- | -------------------------------------------------------------- |
| `server.ts`                    | `user-auth.ts`             | `resolve()` import      | ✓ WIRED | `server.ts:51,136` imports and calls `resolve()`               |
| `server.ts`                    | `UserContext`              | `UserContext.provide()` | ✓ WIRED | `server.ts:50,137` imports and wraps `next()`                  |
| `user-auth.ts`                 | `ApiKeyTable`              | `Database.use()` query  | ✓ WIRED | `user-auth.ts:19` queries all rows, iterates and verifies      |
| `user-auth.ts` → `UserContext` | downstream consumers       | ALS propagation         | ✓ WIRED | `UserContext.userID` used in session/prompt/processor/provider |
| `storage/schema.ts`            | `UserTable`, `ApiKeyTable` | re-export               | ✓ WIRED | `schema.ts:6-7` exports both tables                            |

### Requirements Coverage

| Requirement | Source Plan  | Description                                    | Status      | Evidence                                                                 |
| ----------- | ------------ | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| AUTH-01     | Plan 1.1     | API key format and generation (`sk-<64 hex>`)  | ✓ SATISFIED | `index.ts:9-18`, `generate()` + `valid()`                                |
| AUTH-02     | Plan 1.1     | Bcrypt hashing cost 8, never persist plaintext | ✓ SATISFIED | `index.ts:21-26`, `COST=8`; `ApiKeyTable` has only `hash` column         |
| AUTH-03     | Plan 1.2/1.3 | Anonymous fallback for missing/invalid keys    | ✓ SATISFIED | `user-auth.ts:12-30`, both cases return anonymous without error          |
| AUTH-04     | Plan 1.2/1.3 | UserContext propagation via AsyncLocalStorage  | ✓ SATISFIED | `user-context.ts` uses `Context.create`; consumed in 4+ downstream files |

### Anti-Patterns Found

None detected. No TODOs, FIXMEs, placeholder returns, or stub implementations found in any phase files.

### Human Verification Required

#### 1. Bcrypt performance under load

**Test:** Send 100 concurrent requests with valid API keys  
**Expected:** All resolve correctly; no timeout or thread starvation from bcrypt  
**Why human:** Can't verify bcrypt cost-8 latency impact programmatically without a running server

#### 2. SSE/WebSocket identity stability

**Test:** Open a long-lived SSE connection with a valid API key, verify identity persists for the connection lifetime  
**Expected:** `UserContext` remains authenticated throughout the stream  
**Why human:** ALS propagation across async boundaries in long-lived connections requires runtime observation

---

_Verified: 2026-03-17_  
_Verifier: OpenCode (gsd-verifier)_
