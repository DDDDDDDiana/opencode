# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**

- TypeScript 5.8.2 - All packages (CLI, UI, backend, infra, functions)

**Secondary:**

- Rust - Desktop app via Tauri (`packages/desktop`)
- MDX/Markdown - Documentation (`packages/web/src/content/docs/`)

## Runtime

**Environment:**

- Bun 1.3.10 - Primary runtime for CLI, backend, and build scripts
- Node.js >=22 - Required for `packages/enterprise`
- Cloudflare Workers - Runtime for `packages/function` (API worker)

**Package Manager:**

- Bun 1.3.10 (workspace monorepo)
- Lockfile: `bun.lock` present

## Frameworks

**Core CLI/Backend (`packages/opencode`):**

- Effect 4.0.0-beta.31 - Functional effect system for services, layers, errors
- Hono 4.10.7 - HTTP server for local API (`src/server/`)
- SolidJS 1.9.10 - TUI rendering via `@opentui/solid`
- Zod 4.1.8 - Schema validation and type inference throughout

**Frontend App (`packages/app`, `packages/ui`):**

- SolidJS 1.9.10 - Reactive UI framework
- @solidjs/router 0.15.4 - Client-side routing
- @solidjs/start - SSR/SPA framework
- TailwindCSS 4.1.11 - Utility-first CSS
- @kobalte/core 0.13.11 - Accessible UI primitives

**Desktop (`packages/desktop`):**

- Tauri v2 - Native desktop wrapper (Rust-based)
- Vite 7.1.4 - Build tool

**Documentation/Web (`packages/web`):**

- Astro 5.7.13 - Static site + SSR framework
- @astrojs/starlight 0.34.3 - Docs theme
- @astrojs/cloudflare 12.6.3 - Cloudflare adapter

**Infrastructure:**

- SST 3.18.10 - Infrastructure as code (Cloudflare-targeted)
- Turbo 2.8.13 - Monorepo build orchestration

**Testing:**

- Bun test - Unit tests (`packages/opencode`, `packages/app`)
- Playwright 1.51.0 - E2E tests (`packages/app/e2e/`)
- @happy-dom/global-registrator 20.0.11 - DOM environment for unit tests

## Key Dependencies

**Critical:**

- `ai` 5.0.124 - Vercel AI SDK v5, core abstraction for all LLM calls
- `effect` 4.0.0-beta.31 - Service/layer architecture for the entire backend
- `drizzle-orm` 1.0.0-beta.16 - ORM for local SQLite database
- `@modelcontextprotocol/sdk` 1.25.2 - MCP client (stdio, SSE, StreamableHTTP)
- `solid-js` 1.9.10 - UI framework for both TUI and web app
- `zod` 4.1.8 - Runtime schema validation, used for all data shapes and SDK types

**AI Provider SDKs (all in `packages/opencode`):**

- `@ai-sdk/anthropic` 2.0.65
- `@ai-sdk/openai` 2.0.89
- `@ai-sdk/google` 2.0.54
- `@ai-sdk/google-vertex` 3.0.106
- `@ai-sdk/amazon-bedrock` 3.0.82
- `@ai-sdk/azure` 2.0.91
- `@ai-sdk/mistral` 2.0.27
- `@ai-sdk/groq` 2.0.34
- `@ai-sdk/xai` 2.0.51
- `@ai-sdk/cohere` 2.0.22
- `@ai-sdk/cerebras` 1.0.36
- `@ai-sdk/perplexity` 2.0.23
- `@ai-sdk/togetherai` 1.0.34
- `@ai-sdk/vercel` 1.0.33
- `@ai-sdk/deepinfra` 1.0.36
- `@ai-sdk/gateway` 2.0.30
- `@openrouter/ai-sdk-provider` 1.5.4
- `@gitlab/gitlab-ai-provider` 3.6.0

**Infrastructure:**

- `@aws-sdk/client-s3` 3.933.0 - S3 client (root-level, used in infra)
- `@aws-sdk/credential-providers` 3.993.0 - AWS credential chain for Bedrock
- `hono` 4.10.7 - API routing (local server + Cloudflare Worker)
- `drizzle-kit` 1.0.0-beta.16 - Migration generation
- `web-tree-sitter` 0.25.10 - Code parsing for context/tools
- `@parcel/watcher` 2.5.1 - File system watching
- `bun-pty` 0.4.8 - PTY for shell tool
- `@agentclientprotocol/sdk` 0.14.1 - ACP protocol support
- `@openauthjs/openauth` 0.0.0-20250322224806 - OAuth for provider auth

## Configuration

**Environment:**

- `.env` files present - not read directly; env vars accessed via `src/env/` module
- Key runtime flags in `packages/opencode/src/flag/flag.ts`
- Provider API keys loaded from env vars or stored auth (`src/auth/`)

**Build:**

- `turbo.json` - Turbo pipeline config at repo root
- `vite.config.*` - Per-package Vite configs
- `packages/opencode/script/build.ts` - CLI build script
- `packages/opencode/drizzle.config.ts` - Drizzle migration config
- `tsconfig.json` per package; uses `@tsconfig/bun` and `@typescript/native-preview` (`tsgo`)

## Platform Requirements

**Development:**

- Bun 1.3.10+
- Node.js 22+ (for enterprise package)
- Rust toolchain (for desktop Tauri build)

**Production:**

- CLI: any platform with Bun runtime (distributed as binary)
- API Worker: Cloudflare Workers
- Web/Docs: Cloudflare Pages (via Astro + `@astrojs/cloudflare`)
- Desktop: macOS, Windows, Linux (via Tauri)

---

_Stack analysis: 2026-03-17_
