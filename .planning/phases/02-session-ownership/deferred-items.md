# Deferred Items - Phase 2

## Out of Scope Type Errors

The following type errors exist in untracked Phase 1 files and are not part of Phase 2 scope:

1. **src/server/user-auth.ts(4,10)**: Module '"../storage/db"' has no exported member 'db'
2. **src/user/index.ts(2,31)**: Could not find declaration file for module 'bcrypt'
3. **src/user/user-context.test.ts(8,15)**: Property 'reason' does not exist on type 'Identity'
4. **src/user/user-context.test.ts(15,35)**: Type 'string' is not assignable to parameter of type 'UserID'

These files are untracked (not committed) and belong to Phase 1 (Identity Foundation). They should be fixed when Phase 1 is executed.

## Phase 2 Session Files

All Phase 2 session-related files (src/session/*.ts) pass type checking with zero errors.
