# Testing Patterns

**Analysis Date:** 2026-03-17

## Test Framework

**Runner:**

- Bun test runner (built-in)
- Config: `packages/opencode/bunfig.toml` — `[test]` section with preload

**Assertion Library:**

- `bun:test` built-in (`expect`, `describe`, `test`, `mock`, `spyOn`, `afterEach`, `afterAll`)

**Run Commands:**

```bash
bun test --timeout 30000        # Run all tests (from packages/opencode)
bun test --timeout 30000 --coverage  # With coverage
```

> Tests CANNOT run from repo root. Always run from `packages/opencode`.

## Test File Organization

**Location:**

- Separate `test/` directory: `packages/opencode/test/`
- Mirrors `src/` structure by domain

**Naming:**

- `<module>.test.ts` pattern
- Examples: `bash.test.ts`, `session.test.ts`, `config.test.ts`, `format.test.ts`

**Structure:**

```
packages/opencode/test/
├── preload.ts              # Global test setup (env vars, log init)
├── fixture/
│   ├── fixture.ts          # tmpdir helper
│   └── fixture.test.ts     # Tests for the fixture itself
├── tool/
│   ├── bash.test.ts
│   ├── edit.test.ts
│   ├── read.test.ts
│   └── ...
├── session/
│   ├── session.test.ts
│   ├── message-v2.test.ts
│   └── ...
├── config/
│   ├── config.test.ts
│   └── ...
├── util/
│   ├── format.test.ts
│   ├── filesystem.test.ts
│   └── ...
└── storage/
    ├── db.test.ts
    └── ...
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, expect, test } from "bun:test"
import { SomeModule } from "../../src/some/module"

describe("module.feature", () => {
  test("does something specific", async () => {
    // arrange
    // act
    // assert
  })
})
```

**Patterns:**

- `describe` groups by module/feature: `"tool.bash"`, `"session.started event"`, `"util.format"`
- `test` names describe behavior: `"truncates output exceeding line limit"`, `"loads config with defaults"`
- Async tests use `async`/`await` throughout
- Optional per-test timeout: `test("name", async () => {}, { timeout: 30000 })`

## Preload Setup

**File:** `packages/opencode/test/preload.ts`

Runs before all tests and:

- Sets XDG env vars to isolated temp dirs
- Clears all provider API key env vars
- Disables default plugins (`OPENCODE_DISABLE_DEFAULT_PLUGINS=true`)
- Initializes `Log` with `print: false`
- Registers `afterAll` to close DB and clean up temp dirs

## Mocking

**Framework:** `bun:test` built-in (`mock`, `spyOn`)

**Patterns:**

```typescript
import { mock, spyOn, afterEach } from "bun:test"

// Replace a module export
Account.active = mock(() => ({ id: AccountID.make("account-1"), ... }))

// Spy on a method
const run = spyOn(BunProc, "run").mockImplementation(async (_cmd, opts) => {
  return { code: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }
})

// Restore after test
run.mockRestore()

// Mock global fetch
const originalFetch = globalThis.fetch
globalThis.fetch = mock((url) => Promise.resolve(new Response(...)))
// restore in finally block
globalThis.fetch = originalFetch
```

**What to mock:**

- External HTTP calls (`globalThis.fetch`)
- Account/auth state (`Account.active`, `Account.token`, `Auth.all`)
- Process-level side effects (`BunProc.run`)

**What NOT to mock:**

- Filesystem operations (use `tmpdir` fixture instead)
- Database (uses real SQLite in isolated temp dir)
- Core module logic

## Fixtures and Factories

**Primary fixture:** `tmpdir` in `packages/opencode/test/fixture/fixture.ts`

```typescript
import { tmpdir } from "../fixture/fixture"

// Basic temp dir
await using tmp = await tmpdir()
// tmp.path — absolute path to temp dir, auto-cleaned on scope exit

// Git repo
await using tmp = await tmpdir({ git: true })

// With opencode config
await using tmp = await tmpdir({
  config: { model: "test/model", username: "testuser" },
})

// Custom init (returns extra data)
await using tmp = await tmpdir<string>({
  init: async (dir) => {
    await Bun.write(path.join(dir, "file.txt"), "content")
    return "extra"
  },
})
// tmp.extra === "extra"

// With custom cleanup
await using tmp = await tmpdir({
  dispose: async (dir) => {
    /* cleanup */
  },
})
```

**Location:** `packages/opencode/test/fixture/fixture.ts`

**Notes:**

- Uses `await using` for automatic cleanup via `Symbol.asyncDispose`
- Dirs created in OS temp with prefix `opencode-test-`
- Paths sanitized to strip null bytes (CI fix)
- Git fixtures disable `fsmonitor` automatically

## Instance Context

Most tests that exercise project-scoped code wrap logic in `Instance.provide`:

```typescript
import { Instance } from "../../src/project/instance"

await Instance.provide({
  directory: projectRoot,
  fn: async () => {
    // test code here — Instance.directory is set
    const result = await SomeService.doThing()
    expect(result).toBeDefined()
  },
})
```

This is required for any code that reads `Instance.directory` or `Instance.project`.

## Coverage

**Requirements:** None enforced

**View Coverage:**

```bash
bun test --coverage   # from packages/opencode
```

## Test Types

**Unit Tests:**

- Pure function tests: `packages/opencode/test/util/format.test.ts`, `packages/opencode/test/util/glob.test.ts`
- Schema/data tests: `packages/opencode/test/session/message-v2.test.ts`
- Isolated with no external deps

**Integration Tests:**

- Tests that use real SQLite DB, real filesystem, real git
- Examples: `packages/opencode/test/config/config.test.ts`, `packages/opencode/test/tool/bash.test.ts`
- Use `tmpdir` fixture for isolation
- Use `Instance.provide` for project context

**E2E Tests:**

- Located in `packages/app/e2e/`
- Separate from unit/integration tests

## Common Patterns

**Async Testing:**

```typescript
test("emits event", async () => {
  await Instance.provide({
    directory: projectRoot,
    fn: async () => {
      let received: Session.Info | undefined
      const unsub = Bus.subscribe(Session.Event.Created, (event) => {
        received = event.properties.info as Session.Info
      })
      await Session.create({})
      await new Promise((resolve) => setTimeout(resolve, 100))
      unsub()
      expect(received).toBeDefined()
    },
  })
})
```

**Error Testing:**

```typescript
test("throws on invalid input", async () => {
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await expect(Config.get()).rejects.toThrow()
    },
  })
})
```

**Platform-specific tests:**

```typescript
test("windows path handling", async () => {
  if (process.platform !== "win32") return
  // windows-only test logic
})
```

**Cleanup with finally:**

```typescript
const original = process.env["SOME_VAR"]
process.env["SOME_VAR"] = "test"
try {
  // test logic
} finally {
  if (original !== undefined) process.env["SOME_VAR"] = original
  else delete process.env["SOME_VAR"]
}
```

## Test Coverage Gaps

**Snapshot tests:**

- `packages/opencode/test/tool/__snapshots__/tool.test.ts.snap` exists
- Snapshot testing used sparingly

**Areas with limited tests:**

- `packages/opencode/src/lsp/` — LSP integration
- `packages/opencode/src/pty/` — PTY/terminal
- `packages/opencode/src/agent/` — Agent orchestration (one test file)
- `packages/opencode/src/provider/` — Provider SDK wrappers

---

_Testing analysis: 2026-03-17_
