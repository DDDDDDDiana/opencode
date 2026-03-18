---
status: completed
phase: 01-identity-foundation
source: ROADMAP.md success criteria, REQUIREMENTS.md AUTH-01 to AUTH-04
started: 2026-03-17T09:21:00Z
updated: 2026-03-17T09:30:00Z
---

## Current Test

number: 1
name: Valid API key authentication
expected: |
Send a request with a valid `x-opencode-api-key` header containing a properly formatted key (sk-<64 hex>).
The request should be accepted and UserContext should contain authenticated state with the user_id.
No authentication errors should appear in the response.

## Test Results

### 1. Valid API key authentication

status: failed
issue: |
CRITICAL BUG: user-auth.ts queried ApiKeyTable.hash with plaintext key.
Hash column stores bcrypt hashes, cannot be used in WHERE clause.
FIXED: Changed to iterate all keys and verify with bcrypt.compare().
Note: Inefficient for large user counts - consider key_prefix index later.

### 2. Invalid API key fallback

status: passed
verified: |
Code correctly handles invalid keys in user-auth.ts:

- Malformed keys (line 15-17): Returns anonymous with reason "invalid"
- Unknown keys (line 18-20): Returns anonymous with reason "invalid"
- No error thrown, request continues normally

### 3. Missing API key fallback

status: passed
verified: |
Code correctly handles missing keys in user-auth.ts:13
Returns { state: "anonymous", reason: "missing" }
No error thrown, request continues normally

### 4. API key storage security

status: passed
verified: |
Schema verified in user.sql.ts:

- ApiKeyTable has `hash` column (line 18), not plaintext `key`
- Uses bcrypt with cost 8 (user/index.ts:6)
- No plaintext keys in logs (user-auth.ts only logs user_id or reason codes)

### 5. UserContext propagation

status: passed
verified: |
UserContext implementation in user-context.ts:

- Uses AsyncLocalStorage via Context.create (line 10)
- Safe get() returns anonymous when no context (lines 18-23)
- Mirrors WorkspaceContext pattern
- Integrated in server.ts middleware (line 134-137)

## Summary

Total: 5
Passed: 4
Failed: 1
Pending: 0

## Issues Found

1. **CRITICAL**: API key lookup bug in user-auth.ts - queried hash column with plaintext key (FIXED)

## Recommendations

- Add indexed `key_prefix` column to ApiKeyTable for O(1) lookup performance
- Current O(n) iteration acceptable for small user counts but won't scale

---

_Phase: 01-identity-foundation_
_UAT started: 2026-03-17_
