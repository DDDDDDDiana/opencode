# Codebase Structure

**Analysis Date:** 2026-03-17

## Directory Layout

```
opencode/                          # Monorepo root
├── packages/
│   ├── opencode/                  # Core CLI + server (main package)
│   ├── app/                       # SolidJS web UI
│   ├── desktop/                   # Tauri desktop app
│   ├── ui/                        # Shared UI component library
│   ├── storybook/                 # Component development environment
│   ├── web/                       # Marketing/docs website
│   ├── sdk/js/                    # JavaScript SDK (generated)
│   ├── plugin/                    # Plugin API package
│   ├── script/                    # Build/codegen scripts
│   ├── slack/                     # Slack integration
│   ├── util/                      # Shared utilities
│   └── console/                   # Cloud console app
├── sdks/vscode/                   # VS Code extension
├── infra/                         # SST/AWS infrastructure
├── specs/                         # OpenAPI specs
├── script/                        # Root-level scripts
├── nix/                           # Nix flake configuration
├── patches/                       # Dependency patches
├── package.json                   # Workspace root (Bun workspaces)
├── turbo.json                     # Turborepo config
├── sst.config.ts                  # SST infrastructure config
└── bun.lock                       # Lockfile
```

## Directory Purposes

**`packages/opencode/src/`:**

- Purpose: Core application logic — CLI, server, AI session management
- Contains: All backend modules organized by domain
- Key files:
  - `src/index.ts` — CLI entry point
  - `src/server/server.ts` — Hono HTTP server
  - `src/session/index.ts` — Session CRUD and message management
  - `src/session/prompt.ts` — Main LLM loop orchestration
  - `src/session/processor.ts` — Streaming response handler
  - `src/session/llm.ts` — AI SDK streaming wrapper
  - `src/agent/agent.ts` — Agent definitions and config
  - `src/tool/registry.ts` — Tool registration and resolution
  - `src/tool/tool.ts` — Tool interface definition
  - `src/storage/db.ts` — SQLite/Drizzle database client
  - `src/project/instance.ts` — Per-directory context isolation
  - `src/bus/index.ts` — Event pub/sub system
  - `src/provider/provider.ts` — LLM provider abstraction

**`packages/opencode/src/tool/`:**

- Purpose: All executable tools available to agents
- Contains: `bash.ts`, `read.ts`, `write.ts`, `edit.ts`, `glob.ts`, `grep.ts`, `task.ts`, `webfetch.ts`, `websearch.ts`, `codesearch.ts`, `lsp.ts`, `todo.ts`, `question.ts`, `plan.ts`, `skill.ts`, `apply_patch.ts`, `multiedit.ts`, `batch.ts`

**`packages/opencode/src/server/routes/`:**

- Purpose: Hono route handlers grouped by domain
- Contains: `session.ts`, `project.ts`, `provider.ts`, `file.ts`, `mcp.ts`, `pty.ts`, `question.ts`, `permission.ts`, `global.ts`, `tui.ts`, `config.ts`, `experimental.ts`, `workspace.ts`

**`packages/opencode/src/cli/cmd/`:**

- Purpose: CLI command implementations
- Contains: `run.ts`, `serve.ts`, `session.ts`, `agent.ts`, `models.ts`, `providers.ts`, `mcp.ts`, `github.ts`, `pr.ts`, `export.ts`, `import.ts`, `upgrade.ts`, `tui/` (TUI components)

**`packages/opencode/migration/`:**

- Purpose: Drizzle database migrations
- Contains: Timestamped directories each with `migration.sql` and `snapshot.json`
- Generated: Yes (via `bun run db generate --name <slug>`)
- Committed: Yes

**`packages/app/src/`:**

- Purpose: SolidJS web frontend
- Contains:
  - `pages/session/` — Session view, composer, message timeline
  - `components/` — Reusable UI components
  - `context/` — SolidJS context providers
  - `hooks/` — Custom hooks
  - `i18n/` — Internationalization

**`packages/ui/src/`:**

- Purpose: Shared design system components
- Contains: `components/`, `styles/`, `theme/`, `assets/`, `hooks/`, `i18n/`

**`packages/sdk/js/src/`:**

- Purpose: Generated TypeScript SDK for the opencode API
- Contains: `gen/` — Auto-generated client code from OpenAPI spec
- Generated: Yes (via `./packages/sdk/js/script/build.ts`)

**`packages/plugin/src/`:**

- Purpose: Plugin API types and interfaces
- Contains: Tool definition types, plugin hook types

**`.opencode/`:**

- Purpose: Local opencode configuration for this repo
- Contains: `agent/`, `command/`, `tool/`, `themes/`, `glossary/`

**`.planning/`:**

- Purpose: Planning and codebase analysis documents
- Contains: `codebase/` — Architecture docs written by mapping agents

## Key File Locations

**Entry Points:**

- `packages/opencode/bin/opencode` — CLI binary
- `packages/opencode/src/index.ts` — CLI bootstrap
- `packages/opencode/src/server/server.ts` — HTTP server factory
- `packages/app/src/index.tsx` — Web app root
- `packages/desktop/src-tauri/src/main.rs` — Desktop app root

**Configuration:**

- `package.json` — Workspace config, catalog dependencies
- `turbo.json` — Turborepo pipeline config
- `sst.config.ts` — AWS infrastructure (SST)
- `packages/opencode/drizzle.config.ts` — Drizzle ORM config
- `packages/opencode/tsconfig.json` — TypeScript config
- `packages/opencode/parsers-config.ts` — Tree-sitter parser config

**Core Logic:**

- `packages/opencode/src/session/prompt.ts` — Main agent loop
- `packages/opencode/src/session/processor.ts` — Stream processing
- `packages/opencode/src/session/llm.ts` — LLM streaming
- `packages/opencode/src/agent/agent.ts` — Agent definitions
- `packages/opencode/src/tool/registry.ts` — Tool registry
- `packages/opencode/src/project/instance.ts` — Instance context

**Schema/SQL:**

- `packages/opencode/src/**/*.sql.ts` — Drizzle table definitions
- `packages/opencode/migration/` — SQL migration files

**Testing:**

- `packages/opencode/test/` — Test files
- `packages/app/e2e/` — Playwright end-to-end tests

## Naming Conventions

**Files:**

- Domain modules: `kebab-case.ts` (e.g., `session.ts`, `message-v2.ts`)
- SQL schemas: `<entity>.sql.ts` (e.g., `session.sql.ts`, `project.sql.ts`)
- Test files: `<name>.test.ts` co-located with source

**Directories:**

- All lowercase, kebab-case (e.g., `control-plane/`, `bus-event/`)

**Namespaces:**

- TypeScript namespaces match PascalCase module name (e.g., `Session`, `Agent`, `LLM`)

## Where to Add New Code

**New tool:**

- Implementation: `packages/opencode/src/tool/<name>.ts`
- Register in: `packages/opencode/src/tool/registry.ts` → `all()` array
- Follow pattern from: `packages/opencode/src/tool/bash.ts` or `packages/opencode/src/tool/read.ts`

**New server route:**

- Implementation: `packages/opencode/src/server/routes/<domain>.ts`
- Register in: `packages/opencode/src/server/server.ts` → `.route()`

**New CLI command:**

- Implementation: `packages/opencode/src/cli/cmd/<name>.ts`
- Register in: `packages/opencode/src/cli/cmd/cmd.ts`

**New agent:**

- Add to: `packages/opencode/src/agent/agent.ts` → `result` object in `state()`

**New database table:**

- Schema: `packages/opencode/src/<domain>/<entity>.sql.ts`
- Generate migration: `bun run db generate --name <slug>` from `packages/opencode/`

**New UI component:**

- Shared: `packages/ui/src/components/<name>.tsx`
- App-specific: `packages/app/src/components/<name>.tsx`

**New utility:**

- Shared helpers: `packages/opencode/src/util/<name>.ts`
- Cross-package: `packages/util/src/<name>.ts`

**New plugin hook:**

- Define type in: `packages/plugin/src/`
- Trigger in core: `Plugin.trigger("<hook.name>", context, mutable)`

## Special Directories

**`packages/opencode/migration/`:**

- Purpose: Drizzle migration SQL files
- Generated: Yes — never edit manually
- Committed: Yes

**`packages/sdk/js/src/gen/`:**

- Purpose: Auto-generated API client from OpenAPI spec
- Generated: Yes — run `./packages/sdk/js/script/build.ts`
- Committed: Yes

**`.opencode/`:**

- Purpose: Repo-local opencode config (agents, commands, tools, themes)
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**

- Purpose: Codebase analysis documents for AI planning agents
- Generated: Yes — by mapping agents
- Committed: Yes

---

_Structure analysis: 2026-03-17_
