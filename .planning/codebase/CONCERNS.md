# Codebase Concerns

**Analysis Date:** 2026-03-17

## Tech Debt

**Type Safety Erosion:**

- Issue: Widespread use of `any` type (111+ instances) and type suppressions (`@ts-ignore`, `@ts-expect-error`)
- Files: `packages/opencode/src/acp/agent.ts`, `packages/opencode/src/provider/provider.ts`, `packages/opencode/src/plugin/index.ts`, `packages/opencode/src/session/prompt.ts`
- Impact: Loss of type safety, potential runtime errors, harder refactoring
- Fix approach: Gradually replace `any` with proper types; remove suppressions by fixing underlying type issues

**Environment Variable Management:**

- Issue: Direct `process.env` access scattered throughout codebase instead of centralized Env API
- Files: `packages/opencode/src/provider/provider.ts` (lines 260-266, 478-490), `packages/opencode/src/config/config.ts`, `packages/opencode/src/bun/index.ts`
- Impact: Inconsistent environment handling, harder to test, unclear scope of Env API
- Fix approach: Clarify Env API scope and migrate all `process.env` access to use it consistently

**Permission Ruleset Persistence:**

- Issue: Permission rulesets not saved to disk yet
- Files: `packages/opencode/src/permission/service.ts` (line 229)
- Impact: User permission preferences lost between sessions
- Fix approach: Implement disk persistence for permission rulesets

**GitHub Copilot Integration Workarounds:**

- Issue: Hacky implementation with disabled features and commented-out code
- Files: `packages/opencode/src/plugin/copilot.ts` (lines 44-56)
- Impact: Messages API disabled due to rate limits, unclear migration path
- Fix approach: Re-enable once rate limits improve or migrate to models.dev presets

**Legacy Code Maintenance Burden:**

- Issue: Code marked for removal but still maintained
- Files: `packages/opencode/src/provider/provider.ts` (line 130: "TODO: kill this code so we dont have to maintain it")
- Impact: Ongoing maintenance cost for deprecated GitHub Copilot OpenAI compatibility layer
- Fix approach: Remove `@ai-sdk/github-copilot` compatibility code once migration complete

**Tool Invocation Logic Duplication:**

- Issue: Tool invocation logic not centralized
- Files: `packages/opencode/src/session/prompt.ts` (line 354)
- Impact: Inconsistent tool handling, harder to maintain
- Fix approach: Centralize tool invocation logic into single abstraction

**Task Tool Input Limitations:**

- Issue: Task tool cannot accept complex input structures
- Files: `packages/opencode/src/session/prompt.ts` (line 1858)
- Impact: Limited subtask capabilities
- Fix approach: Redesign task tool schema to support richer input types

## Known Bugs

**Bun Cache Issue:**

- Symptoms: Cache-related failures in certain environments
- Files: `packages/opencode/src/bun/index.ts` (line 84), `packages/opencode/src/config/config.ts` (line 297)
- Trigger: Proxied environments or CI builds
- Workaround: `--no-cache` flag added for proxied/CI environments
- Reference: https://github.com/oven-sh/bun/issues/19936

**Bun Symlink Issue:**

- Symptoms: Symlink handling failures
- Files: `packages/opencode/src/provider/provider.ts` (line 1172)
- Trigger: Specific Bun runtime scenarios
- Workaround: Type suppression with `@ts-ignore`
- Reference: https://github.com/oven-sh/bun/issues/16682

**AI SDK Logging Warnings:**

- Symptoms: Unwanted warnings logged to stdout
- Files: `packages/opencode/src/server/server.ts` (line 50)
- Trigger: AI SDK initialization
- Workaround: Global variable set to suppress warnings
- Reference: https://github.com/vercel/ai/blob/2dc67e0ef538307f21368db32d5a12345d98831b/packages/ai/src/logger/log-warnings.ts#L85

## Security Considerations

**Direct Environment Token Access:**

- Risk: Sensitive tokens accessed directly from process.env without proper validation
- Files: `packages/opencode/src/provider/provider.ts` (AWS_BEARER_TOKEN_BEDROCK, AICORE_SERVICE_KEY)
- Current mitigation: Token checks before usage
- Recommendations: Centralize credential management, add validation layer, audit logging

**Console Logging in Production:**

- Risk: Sensitive data potentially logged to console
- Files: `packages/opencode/src/cli/cmd/github.ts`, `packages/opencode/src/cli/cmd/db.ts`, `packages/opencode/src/cli/cmd/debug/*.ts`
- Current mitigation: Limited to CLI commands
- Recommendations: Replace console.log with structured logging, sanitize outputs

**Error Message Exposure:**

- Risk: Detailed error messages may leak implementation details
- Files: Multiple catch blocks throughout `packages/opencode/src/acp/agent.ts`, `packages/opencode/src/session/prompt.ts`
- Current mitigation: Error transformation via MessageV2.fromError
- Recommendations: Audit error messages for sensitive information disclosure

## Performance Bottlenecks

**Large File Processing:**

- Problem: Several files exceed 1500+ lines
- Files: `packages/opencode/src/lsp/server.ts` (2097 lines), `packages/opencode/src/session/prompt.ts` (1971 lines), `packages/opencode/src/acp/agent.ts` (1743 lines), `packages/opencode/src/provider/sdk/copilot/responses/openai-responses-language-model.ts` (1732 lines)
- Cause: Monolithic file structure, lack of modularization
- Improvement path: Split into smaller, focused modules; extract reusable components

**Synchronous File Operations:**

- Problem: Some file operations may block event loop
- Files: `packages/opencode/src/util/filesystem.ts`, `packages/opencode/src/file/index.ts`
- Cause: Mix of sync and async file operations
- Improvement path: Audit and convert remaining sync operations to async

## Fragile Areas

**Error Handling Inconsistency:**

- Files: Multiple files with bare `catch (e)` blocks
- Why fragile: Silent error swallowing in `packages/opencode/src/global/index.ts` (line 52: `catch (e) {}`), inconsistent error handling patterns
- Safe modification: Always log errors, use typed error handling
- Test coverage: Error paths often untested

**Plugin System Type Safety:**

- Files: `packages/opencode/src/plugin/index.ts` (lines 121-124, 137-138)
- Why fragile: Multiple type suppressions with "try-counter" comments indicating failed fix attempts
- Safe modification: Avoid modifying plugin typing without comprehensive tests
- Test coverage: Plugin integration tests needed

**Provider Authentication Flow:**

- Files: `packages/opencode/src/provider/provider.ts` (lines 260-275, 478-490)
- Why fragile: Complex environment variable juggling, direct process.env mutation
- Safe modification: Test with all supported auth providers (AWS Bedrock, SAP AI Core)
- Test coverage: Auth flow integration tests

**Message Versioning:**

- Files: `packages/opencode/src/session/message-v2.ts`, imports throughout codebase
- Why fragile: MessageV2 exists but no MessageV1 cleanup visible, migration state unclear
- Safe modification: Understand version migration strategy before modifying message structures
- Test coverage: Message serialization/deserialization tests critical

## Scaling Limits

**Session Message Storage:**

- Current capacity: Database-backed but no apparent pagination/archival
- Limit: Long-running sessions may accumulate large message histories
- Scaling path: Implement message compaction, archival strategy, pagination

**LSP Server Complexity:**

- Current capacity: Single 2097-line file handling all LSP operations
- Limit: Difficult to extend, test, and maintain
- Scaling path: Refactor into protocol handlers, extract language-specific logic

**Provider Model Registry:**

- Current capacity: In-memory model registry loaded from models.dev
- Limit: Registry size grows with provider additions
- Scaling path: Lazy loading, caching strategy, model filtering

## Dependencies at Risk

**Drizzle ORM Beta:**

- Risk: Using beta version `1.0.0-beta.16-ea816b6`
- Impact: Potential breaking changes, migration issues
- Migration plan: Monitor for stable 1.0 release, test migration path

**Effect Library Beta:**

- Risk: Using beta version `4.0.0-beta.31`
- Impact: Ongoing Effect migration may face breaking changes
- Migration plan: Complete Flag → Effect.Config migration, stabilize service layer

**AI SDK Rapid Evolution:**

- Risk: Multiple `@ai-sdk/*` packages with frequent updates
- Impact: Breaking changes in streaming, tool calling, provider APIs
- Migration plan: Pin versions, test thoroughly before upgrades

## Missing Critical Features

**Permission Persistence:**

- Problem: User permission decisions not persisted
- Blocks: Consistent permission UX across sessions
- Priority: High

**Centralized Tool Invocation:**

- Problem: Tool invocation logic scattered across codebase
- Blocks: Consistent tool behavior, easier testing
- Priority: Medium

**Structured Logging:**

- Problem: Mix of console.log and proper logging
- Blocks: Production debugging, observability
- Priority: Medium

**Error Recovery Strategies:**

- Problem: Many catch blocks log but don't recover
- Blocks: Resilient operation, better UX
- Priority: Medium

## Test Coverage Gaps

**Provider Authentication:**

- What's not tested: AWS Bedrock token flow, SAP AI Core auth
- Files: `packages/opencode/src/provider/provider.ts`
- Risk: Auth failures in production
- Priority: High

**Plugin System:**

- What's not tested: Plugin loading, hook execution, type safety boundaries
- Files: `packages/opencode/src/plugin/index.ts`
- Risk: Plugin failures break core functionality
- Priority: High

**Error Handling Paths:**

- What's not tested: Most catch blocks and error transformations
- Files: `packages/opencode/src/acp/agent.ts`, `packages/opencode/src/session/prompt.ts`
- Risk: Unhandled errors in production
- Priority: Medium

**Message Versioning:**

- What's not tested: MessageV2 serialization edge cases, migration paths
- Files: `packages/opencode/src/session/message-v2.ts`
- Risk: Data corruption, session failures
- Priority: Medium

**LSP Operations:**

- What's not tested: Complex LSP scenarios, multi-file operations
- Files: `packages/opencode/src/lsp/server.ts`
- Risk: IDE integration failures
- Priority: Low

---

_Concerns audit: 2026-03-17_
