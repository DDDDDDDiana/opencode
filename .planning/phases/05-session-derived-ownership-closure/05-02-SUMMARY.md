---
phase: 05-session-derived-ownership-closure
plan: 02
subsystem: server-routes
tags: [ownership, isolation, part-routes, message-mutation]
dependency_graph:
  requires: [Session.get, Session.removeMessage, Session.removePart, Session.updatePart]
  provides: [guarded-message-part-mutations]
  affects: [session-routes]
tech_stack:
  added: []
  patterns: [shared-guard-helper]
key_files:
  created: [packages/opencode/test/server/session-part-ownership.test.ts]
  modified: [packages/opencode/src/server/routes/session.ts]
decisions:
  - Guard reused from plan 05-01 for all mutation routes
  - Guard runs before Session.removeMessage/removePart/updatePart
  - Body/ID consistency check preserved in PATCH handler before guard
metrics:
  duration: 158
  completed: 2026-03-18T02:27:22Z
---

# Phase 05 Plan 02: Message and Part Mutation Ownership Guard Summary

**One-liner:** Extended shared session-root guard to message/part mutation routes for complete ownership closure

## Objective

Applied the same session-root guard from plan 05-01 to all remaining message and part mutation routes, completing end-to-end protection for session-derived resources.

## What Was Built

**Guarded Mutation Routes** (`packages/opencode/src/server/routes/session.ts`)

- Added `guard(sessionID)` to DELETE `/:sessionID/message/:messageID`
- Added `guard(sessionID)` to DELETE `/:sessionID/message/:messageID/part/:partID`
- Added `guard(sessionID)` to PATCH `/:sessionID/message/:messageID/part/:partID`
- Preserved existing body/ID consistency check in PATCH handler
- Guard runs before any mutation executes

**Regression Tests** (`packages/opencode/test/server/session-part-ownership.test.ts`)

- Test 1: Different user gets 404 when deleting another user's message, owner data remains intact
- Test 2: Different user gets 404 when deleting or patching another user's part
- Test 3: Anonymous caller can read part-bearing data from legacy anonymous session
- Uses real User.create(), Session.create(), Server.Default() with x-opencode-api-key

## Deviations from Plan

None - plan executed exactly as written.

## Tasks Completed

| Task | Name                                                  | Commit    | Files                                                        |
| ---- | ----------------------------------------------------- | --------- | ------------------------------------------------------------ |
| 1    | Guard remaining message and part route handlers       | 835d5b913 | packages/opencode/src/server/routes/session.ts               |
| 2    | Add part ownership and anonymous fallback regressions | df815fd35 | packages/opencode/test/server/session-part-ownership.test.ts |

## Verification

All tests pass:

```bash
cd packages/opencode
bun test test/server/session-messages-ownership.test.ts test/server/session-part-ownership.test.ts --timeout 30000
# 6 pass, 0 fail, 13 expect() calls
```

## Key Decisions

1. **Guard reused from plan 05-01** - Same helper covers all mutation routes, maintains consistency
2. **Guard runs before mutations** - Ensures Session.removeMessage/removePart/updatePart never execute for unauthorized sessions
3. **Body/ID consistency check preserved** - PATCH handler validates request body before guard, maintains existing safety

## Impact

- **SESS-07 and SESS-08 satisfied**: All session-derived message/part mutation routes enforce ownership
- **Cross-user mutations fail with 404**: Denied attempts return same error as unauthorized reads, prevents enumeration
- **Owner data remains intact**: Regression tests verify denied mutations don't alter stored data
- **Anonymous legacy sessions still work**: Guard respects UserContext.get() anonymous state for backward compatibility

## Next Steps

Phase 05 session-derived ownership closure is complete. Continue with remaining roadmap phases.

## Self-Check: PASSED

- FOUND: 835d5b913
- FOUND: df815fd35
- FOUND: packages/opencode/src/server/routes/session.ts
- FOUND: packages/opencode/test/server/session-part-ownership.test.ts
