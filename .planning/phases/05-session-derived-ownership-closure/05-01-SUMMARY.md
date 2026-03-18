---
phase: 05-session-derived-ownership-closure
plan: 01
subsystem: server-routes
tags: [ownership, isolation, message-routes]
dependency_graph:
  requires: [Session.get, MessageV2.page, MessageV2.get]
  provides: [guarded-message-reads]
  affects: [session-routes]
tech_stack:
  added: []
  patterns: [shared-guard-helper]
key_files:
  created: [packages/opencode/test/server/session-messages-ownership.test.ts]
  modified: [packages/opencode/src/server/routes/session.ts]
decisions:
  - Shared guard helper reuses Session.get() for ownership enforcement
  - Guard runs before any message data loads (MessageV2.page/get)
  - No new middleware added, keeps route-level isolation simple
metrics:
  duration: 106
  completed: 2026-03-18T02:23:00Z
---

# Phase 05 Plan 01: Session-Derived Message Ownership Guard Summary

**One-liner:** Shared session-root guard enforces ownership on message reads via Session.get() reuse

## Objective

Added one reusable session-root ownership guard to server message routes so all session-derived message reads reuse existing `Session.get()` isolation behavior, closing the route-level ownership gap without inventing a second auth model.

## What Was Built

**Shared Guard Helper** (`packages/opencode/src/server/routes/session.ts`)

- Created `guard(sessionID)` helper inside SessionRoutes lazy function
- Calls `Session.get(sessionID)` to enforce ownership before message data loads
- Reused in GET `/:sessionID/message` (both paginated and plain list paths)
- Reused in GET `/:sessionID/message/:messageID`
- Removed duplicate `Session.get()` calls from message list handlers

**Integration Tests** (`packages/opencode/test/server/session-messages-ownership.test.ts`)

- Test 1: Owner API key can load paginated message history for owned session
- Test 2: Different user gets 404 from both paginated message history and single-message reads
- Test 3: Anonymous caller can still read legacy anonymous session messages
- Uses real User.create(), Session.create(), Session.updateMessage(), Session.updatePart()
- Exercises Server.Default() with x-opencode-api-key header

## Deviations from Plan

None - plan executed exactly as written.

## Tasks Completed

| Task | Name                                            | Commit    | Files                                                            |
| ---- | ----------------------------------------------- | --------- | ---------------------------------------------------------------- |
| 1    | Add shared session-root guard for message reads | ad15567ae | packages/opencode/src/server/routes/session.ts                   |
| 2    | Add message ownership integration coverage      | 936ad07bd | packages/opencode/test/server/session-messages-ownership.test.ts |

## Verification

All tests pass:

```bash
cd packages/opencode
bun test test/server/session-messages-ownership.test.ts --timeout 30000
# 3 pass, 0 fail, 6 expect() calls
```

## Key Decisions

1. **Shared guard helper reuses Session.get()** - Avoids duplicating ownership logic, leverages existing UserContext-aware session isolation
2. **Guard runs before message data loads** - Ensures MessageV2.page/get never execute for unauthorized sessions
3. **No new middleware added** - Keeps route-level isolation simple and explicit per endpoint

## Impact

- **SESS-09 satisfied**: Session-derived message routes now enforce ownership via shared guard
- **Cross-user message reads fail with 404**: Same behavior as unauthorized session reads, prevents enumeration
- **Anonymous legacy sessions still work**: Guard respects UserContext.get() anonymous state
- **No duplicate ownership logic**: Single guard helper reused across all message read endpoints

## Next Steps

Continue with remaining Phase 05 plans to complete session-derived ownership closure.

## Self-Check: PASSED

- FOUND: ad15567ae
- FOUND: 936ad07bd
- FOUND: packages/opencode/src/server/routes/session.ts
- FOUND: packages/opencode/test/server/session-messages-ownership.test.ts
