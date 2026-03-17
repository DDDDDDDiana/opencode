# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**

- Source files: `kebab-case.ts` (e.g., `bash-tool.ts`, `message-v2.ts`)
- Test files: `*.test.ts` (e.g., `bash.test.ts`, `format.test.ts`)
- SQL schema files: `*.sql.ts` (e.g., `session.sql.ts`, `project.sql.ts`)
- Text description files: `*.txt` for tool descriptions (e.g., `bash.txt`)

**Functions:**

- Single word names preferred: `init`, `create`, `execute`, `build`, `parse`
- Multi-word only when necessary: `formatDuration`, `shouldLog`, `createDefaultTitle`
- Namespace methods: `Session.create`, `Config.get`, `Log.create`

**Variables:**

- Single word preferred: `log`, `ctx`, `dir`, `path`, `result`, `cfg`, `opts`
- Avoid camelCase compounds: use `pid` not `inputPID`, `dir` not `configDir`
- Inline values used once instead of intermediate variables

**Types:**

- PascalCase for classes/types: `SessionID`, `MessageID`, `PartID`
- Namespace-scoped types: `Session.Info`, `Config.Info`, `Tool.Context`

**Database:**

- Tables: `snake_case` (e.g., `session`, `message_table`, `part_table`)
- Columns: `snake_case` (e.g., `project_id`, `time_created`, `summary_additions`)
- Join columns: `<entity>_id` pattern (e.g., `session_id`, `message_id`)
- Indexes: `<table>_<column>_idx` pattern

## Code Style

**Formatting:**

- No explicit formatter config found (Bun default)
- 2-space indentation
- No semicolons
- Double quotes for strings

**Linting:**

- No ESLint/Prettier config detected
- TypeScript strict mode via `tsgo --noEmit`

## Import Organization

**Order:**

1. External packages (e.g., `import z from "zod"`, `import path from "path"`)
2. Internal absolute imports with `@/` alias (e.g., `import { Bus } from "@/bus"`)
3. Relative imports (e.g., `import { Config } from "../config/config"`)

**Path Aliases:**

- `@/` maps to `src/` root

**Type imports:**

- Use `type` keyword for type-only imports: `import type { PermissionNext } from "..."`

## Error Handling

**Patterns:**

- Avoid `try`/`catch` where possible
- Use Effect for error handling in effectified code
- Custom error classes extend `NamedError` or use `Schema.TaggedErrorClass`
- In `Effect.gen`, prefer `yield* new MyError(...)` over `yield* Effect.fail(...)`

**Error types:**

- `NotFoundError` for missing resources
- `Schema.TaggedErrorClass` for typed errors
- `Schema.Defect` for defect-like causes instead of `unknown`

## Logging

**Framework:** Custom `Log` namespace in `src/util/log.ts`

**Patterns:**

```typescript
const log = Log.create({ service: "service-name" })
log.info("message", { extra: "data" })
log.error("error message", { error })
```

**Levels:** DEBUG, INFO, WARN, ERROR

**When to log:**

- Service initialization
- Important state changes
- Errors and warnings
- Performance timing with `log.time()`

## Comments

**When to comment:**

- Complex logic requiring explanation
- TODO/FIXME for known issues
- Workarounds with issue links

**JSDoc/TSDoc:**

- Minimal usage
- Namespace exports documented with `@` tags
- Schema descriptions use `.describe()` method

## Function Design

**Size:** Keep functions focused; extract helpers when needed

**Parameters:**

- Use object parameters for multiple args: `execute(params, ctx)`
- Destructure in function body, not signature (preserves context)

**Return values:**

- Explicit return types for exported functions
- Rely on inference for internal helpers
- Use `Promise<T>` for async functions

## Module Design

**Exports:**

- Namespace pattern for related functionality: `export namespace Session { ... }`
- Named exports preferred over default exports
- Barrel files not used

**Structure:**

- One primary namespace per file
- Helper functions inside namespace
- Types defined within namespace

## Control Flow

**Conditionals:**

- Avoid `else` statements
- Prefer early returns
- Use ternaries for simple assignments

**Variables:**

- Prefer `const` over `let`
- Use ternaries instead of reassignment

**Example:**

```typescript
// Good
function foo() {
  if (condition) return 1
  return 2
}

const value = condition ? 1 : 2

// Bad
function foo() {
  if (condition) return 1
  else return 2
}

let value
if (condition) value = 1
else value = 2
```

## Async Patterns

**Promises:**

- Use `async`/`await` syntax
- Avoid callback-based APIs
- Use `Effect.callback` (not `Effect.async`) for callback-based APIs

**Effect:**

- Use `Effect.gen(function* () { ... })` for composition
- Use `Effect.fn("ServiceName.method")` for named/traced effects
- Use `Effect.fnUntraced` for internal helpers
- `Effect.fn`/`Effect.fnUntraced` accept pipeable operators as extra arguments

## Schema Definitions

**Zod:**

- Use `z.object()` for complex types
- Use `.describe()` for field documentation
- Use `.meta()` for metadata

**Drizzle:**

- Use `snake_case` for field names (no string redefinition needed)
- Example: `project_id: text().notNull()` not `projectID: text("project_id")`

**Effect Schema:**

- Use `Schema.Class` for data types with multiple fields
- Use `Schema.brand` for single-value types
- Use `Schema.TaggedErrorClass` for typed errors

## Testing Patterns

**Test structure:**

- Use `describe` for grouping related tests
- Use `test` for individual test cases
- Descriptive test names explaining what is tested

**Assertions:**

- Use `expect()` from `bun:test`
- Common matchers: `.toBe()`, `.toEqual()`, `.toContain()`, `.toBeDefined()`

**Async tests:**

- Use `async` functions
- `await` all async operations
- Optional timeout parameter: `test("name", async () => {}, { timeout: 30000 })`

## Special Patterns

**Lazy initialization:**

- Use `lazy()` helper for deferred initialization
- Example: `const parser = lazy(async () => { ... })`

**Namespaces:**

- Group related functionality
- Export types and functions together
- Use static methods for utilities

**Instance context:**

- Use `Instance.provide()` to set directory context
- Access via `Instance.directory`, `Instance.project`
- Use `Instance.bind()` for native callbacks that need ALS context

**Effect services:**

- Services use `ServiceMap.Service<Name, Name.Service>()(id)`
- Return implementations with `ServiceName.of({ ... })`
- Instance-scoped services go through `Instances` LayerMap

---

_Convention analysis: 2026-03-17_
