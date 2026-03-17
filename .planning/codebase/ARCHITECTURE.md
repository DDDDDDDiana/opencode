# Architecture

**Analysis Date:** 2026-03-17

## Pattern Overview

**Overall:** Monorepo with multi-layered AI-powered development tool architecture

**Key Characteristics:**

- Event-driven architecture with pub/sub messaging via Bus
- Instance-scoped state management using AsyncLocalStorage contexts
- SQLite database with Drizzle ORM for persistence
- Streaming LLM interactions with tool execution loop
- Plugin system for extensibility

## Layers

**CLI Layer:**

- Purpose: Command-line interface and TUI for user interaction
- Location: `packages/opencode/src/cli`
- Contains: Command handlers, TUI components, bootstrap logic
- Depends on: Session, Agent, Config, Server
- Used by: End users via terminal

**Server Layer:**

- Purpose: HTTP/WebSocket API server using Hono framework
- Location: `packages/opencode/src/server`
- Contains: REST routes, SSE event streaming, OpenAPI documentation
- Depends on: Session, Provider, Agent, Tool, MCP
- Used by: Desktop app, web app, external clients

**Session Layer:**

- Purpose: Manages conversation sessions and message processing
- Location: `packages/opencode/src/session`
- Contains: Session lifecycle, message storage, LLM streaming, processor loop
- Depends on: Database, Provider, Tool, Agent, Bus
- Used by: Server routes, CLI commands

**Agent Layer:**

- Purpose: Defines AI agent configurations with permissions and behaviors
- Location: `packages/opencode/src/agent`
- Contains: Agent definitions (build, plan, explore, general), permission rulesets
- Depends on: Config, Provider, Permission
- Used by: Session processor, Tool registry

**Tool Layer:**

- Purpose: Executable tools that agents can invoke (bash, read, write, edit, etc.)
- Location: `packages/opencode/src/tool`
- Contains: Tool definitions, registry, execution context
- Depends on: Permission, Session, Instance
- Used by: LLM streaming loop via AI SDK

**Provider Layer:**

- Purpose: LLM provider abstraction and model management
- Location: `packages/opencode/src/provider`
- Contains: Provider configs, model metadata, API adapters
- Depends on: Auth, Config
- Used by: Session LLM, Agent

**Storage Layer:**

- Purpose: SQLite database management with Drizzle ORM
- Location: `packages/opencode/src/storage`
- Contains: Database client, schema, migrations, transaction context
- Depends on: Global paths
- Used by: Session, Project, Account

**Project/Instance Layer:**

- Purpose: Per-directory project context and state isolation
- Location: `packages/opencode/src/project`
- Contains: Instance provider, project detection, VCS integration, state management
- Depends on: Database, Storage
- Used by: All layers via AsyncLocalStorage context

**Bus Layer:**

- Purpose: Event pub/sub system for cross-component communication
- Location: `packages/opencode/src/bus`
- Contains: Event definitions, subscription management, global bus
- Depends on: Instance
- Used by: Session, Server, UI components

**UI Layer:**

- Purpose: Web and desktop user interfaces
- Location: `packages/app`, `packages/desktop`
- Contains: SolidJS components, session views, file management
- Depends on: Server API
- Used by: End users via browser/desktop app

## Data Flow

**User Prompt Flow:**

1. User submits prompt via CLI/UI → Server `/session/prompt` endpoint
2. `SessionPrompt.prompt()` creates user message with parts (text, files, agents)
3. `SessionPrompt.loop()` enters processing loop
4. Retrieves message history from database via `MessageV2.stream()`
5. Resolves agent configuration and permissions
6. `LLM.stream()` calls provider API with system prompt, messages, and tools
7. `SessionProcessor.process()` handles streaming response:
   - Text deltas → stored as TextPart
   - Tool calls → executed via Tool.execute()
   - Tool results → appended to message history
8. Loop continues until finish reason is "stop" or max steps reached
9. Session summary and diff computed asynchronously
10. Events published via Bus to notify UI

**Tool Execution Flow:**

1. LLM generates tool call during streaming
2. AI SDK validates tool call against schema
3. `SessionProcessor` creates ToolPart with "running" status
4. Tool.execute() invoked with arguments and context
5. Permission check via `PermissionNext.ask()` (may prompt user)
6. Tool performs operation (file read/write, bash command, etc.)
7. Output truncated if needed via `Truncate.output()`
8. ToolPart updated with "completed" status and result
9. Result fed back to LLM in next iteration

**State Management:**

- Instance context stored in AsyncLocalStorage per directory
- Session state persisted to SQLite (messages, parts, metadata)
- Ephemeral state (abort controllers, subscriptions) in Instance.state()
- Events broadcast via Bus for UI reactivity

## Key Abstractions

**Instance:**

- Purpose: Per-directory project context isolation
- Examples: `packages/opencode/src/project/instance.ts`
- Pattern: AsyncLocalStorage context provider with lazy initialization

**Session:**

- Purpose: Conversation thread with message history
- Examples: `packages/opencode/src/session/index.ts`
- Pattern: Database-backed entity with streaming message access

**MessageV2:**

- Purpose: Structured message format with typed parts
- Examples: `packages/opencode/src/session/message-v2.ts`
- Pattern: Discriminated union of part types (text, tool, file, reasoning)

**Tool:**

- Purpose: Executable function with schema validation
- Examples: `packages/opencode/src/tool/tool.ts`, `packages/opencode/src/tool/bash.ts`
- Pattern: Zod schema + async execute function

**Agent:**

- Purpose: AI persona with permissions and behavior config
- Examples: `packages/opencode/src/agent/agent.ts`
- Pattern: Configuration object with permission ruleset

**Provider:**

- Purpose: LLM API abstraction
- Examples: `packages/opencode/src/provider/provider.ts`
- Pattern: Adapter pattern with AI SDK integration

## Entry Points

**CLI Entry:**

- Location: `packages/opencode/src/index.ts`, `packages/opencode/bin/opencode`
- Triggers: User runs `opencode` command
- Responsibilities: Parse args, bootstrap instance, execute command

**Server Entry:**

- Location: `packages/opencode/src/server/server.ts`
- Triggers: `opencode serve` or desktop app startup
- Responsibilities: Start HTTP server, handle API requests, stream events

**Desktop Entry:**

- Location: `packages/desktop/src-tauri/src/main.rs`
- Triggers: User launches desktop app
- Responsibilities: Create Tauri window, start embedded server

**Web Entry:**

- Location: `packages/app/src/index.tsx`
- Triggers: User navigates to web app
- Responsibilities: Render SolidJS app, connect to server

## Error Handling

**Strategy:** Typed errors with retry logic and user feedback

**Patterns:**

- `NamedError` base class for structured errors with serialization
- `NotFoundError` for missing database entities
- `PermissionNext.RejectedError` for denied operations
- `MessageV2.ContextOverflowError` triggers compaction
- `SessionRetry.retryable()` determines if error is transient
- Errors published via `Bus.publish(Session.Event.Error)`

## Cross-Cutting Concerns

**Logging:** Structured logging via `Log.create()` with service tags

**Validation:** Zod schemas for all API inputs and database entities

**Authentication:** Provider-specific auth stored in global config, OAuth support for OpenAI

---

_Architecture analysis: 2026-03-17_
