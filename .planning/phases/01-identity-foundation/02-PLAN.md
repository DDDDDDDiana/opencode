# Phase 1: Identity Foundation - Plan

**Planned:** 2026-03-17  
**Status:** Ready for execution  
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04  
**Source Context:** `01-CONTEXT.md`

## Locked Decisions

- Accept user identity from `x-opencode-api-key`.
- API keys use `sk-<64 hex>` generated from 32 random bytes.
- Persist only bcrypt hashes with cost factor `8`; never persist or log raw keys.
- Missing, malformed, and unknown keys all fall back to anonymous mode.
- `UserContext` exposes explicit `authenticated | anonymous` state and safely defaults to anonymous when absent.
- Identity parsing runs in global middleware; routes stay responsible for any future auth enforcement.

## Execution Order

1. Plan 1.1 builds the persistence and crypto primitives needed for lookup.
2. Plan 1.2 adds the request-scoped `UserContext` model and helpers.
3. Plan 1.3 wires global middleware, logging, and request propagation.
4. Plan 1.4 closes the phase with migration generation, tests, and verification.

## Plan Breakdown

### Plan 1.1: Minimal identity persistence and API key primitives

**Goal:** Add the smallest durable identity surface needed for Phase 1 authentication without pulling full user management into scope.

**Scope**

- Add minimal persistence for authenticated users and hashed API keys so a request can resolve a stable `user_id`.
- Reuse the same schema foundation later in Phase 3 instead of creating throwaway auth-only storage.
- Add helpers to mint `sk-` keys, validate format, hash with bcrypt cost `8`, and verify candidate keys without exposing plaintext.
- Export the new schema through `packages/opencode/src/storage/schema.ts` so migrations and runtime DB access pick it up.

**Critical files**

- new `packages/opencode/src/user/user.sql.ts`
- new `packages/opencode/src/user/index.ts`
- `packages/opencode/src/storage/schema.ts`
- `packages/opencode/migration/*`

**Acceptance**

- A valid API key can resolve a stable `user_id`.
- The database stores only hashed key material.
- The change is additive and remains compatible with existing anonymous deployments.

### Plan 1.2: UserContext ALS and identity helpers

**Goal:** Mirror the existing workspace context pattern so user identity is available anywhere in the request call stack.

**Scope**

- Add a dedicated `UserContext` built on `Context.create`, parallel to `WorkspaceContext` instead of extending `Instance`.
- Model identity as explicit authenticated and anonymous states, with anonymous carrying at least `missing` vs `invalid` reasons.
- Provide safe getters/helpers that return anonymous when no context is present.
- Add a small binding helper if native callback boundaries need explicit context restoration later in the phase.

**Critical files**

- new `packages/opencode/src/user/user-context.ts`
- `packages/opencode/src/util/context.ts`
- `packages/opencode/src/control-plane/workspace-context.ts`
- `packages/opencode/src/project/instance.ts`

**Acceptance**

- Downstream code can read `UserContext` without inferring auth from nullable `user_id`.
- Missing context does not throw; it safely reads as anonymous.
- The shape is stable enough for later phases to consume directly.

### Plan 1.3: Global auth middleware and structured logging

**Goal:** Resolve user identity once per request and propagate it through the existing Hono middleware chain.

**Scope**

- Insert a global middleware in `packages/opencode/src/server/server.ts` after server-level basic auth and before workspace or instance provisioning.
- Parse `x-opencode-api-key`, attempt lookup, and wrap `next()` in `UserContext.provide(...)`.
- Keep the public-route skip list intentionally small; everything non-public should still pass through identity parsing.
- Add structured logging for success and anonymous fallback, recording `user_id` or a reason code but never raw key contents.
- Add dedupe or rate limiting for repeated invalid-key logs so probes do not flood the log stream.

**Critical files**

- `packages/opencode/src/server/server.ts`
- new `packages/opencode/src/server/user-auth.ts`
- `packages/opencode/src/util/log.ts`
- `packages/opencode/src/server/routes/**/*`

**Acceptance**

- Valid keys produce authenticated `UserContext` for the full request lifetime.
- Missing or invalid keys continue as anonymous without changing the HTTP response contract.
- Logs preserve enough internal signal for debugging while avoiding secret leakage.

### Plan 1.4: Migration, verification, and regression coverage

**Goal:** Prove the phase works end to end and lock in the failure semantics before Phase 2 depends on them.

**Scope**

- Generate the Drizzle migration for the new identity schema.
- Add focused tests for key format and bcrypt helpers, anonymous fallback semantics, `UserContext` safe reads, and middleware resolution for valid, missing, and invalid keys.
- Verify the middleware order does not break existing public entry points, preflight requests, SSE setup, or workspace resolution.
- Run `bun typecheck` from `packages/opencode` and the smallest relevant test target from that package.

**Critical files**

- `packages/opencode/migration/*`
- `packages/opencode/src/server/server.ts`
- new `packages/opencode/src/server/user-auth.test.ts`
- new `packages/opencode/src/user/user-context.test.ts`

**Acceptance**

- AUTH-01 through AUTH-04 are covered by tests or direct verification steps.
- Migration output matches the intended additive schema.
- Phase 2 can rely on a stable `user_id` and anonymous reason model.

## Risks To Watch

- Do not reuse the existing account or provider auth flows for this feature; Phase 1 needs server-side multi-user identity, not console auth.
- Keep the route skip list minimal to avoid accidental unauthenticated bypasses.
- Make sure auth middleware wraps long-lived entry points at connection setup time so SSE and WebSocket requests keep a stable identity.
- Avoid leaking key material through errors, logs, or test fixtures.

## Exit Criteria

- All four Phase 1 requirements are implemented and verified.
- Phase 2 can read `UserContext` and trust it to distinguish authenticated from anonymous requests.
- The next execution step is `Plan 1.1`.

---

_Phase: 01-identity-foundation_  
_Plan created: 2026-03-17_
