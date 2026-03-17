# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**AI Model Providers:**
All providers are integrated via Vercel AI SDK v5 (`ai` package) in `packages/opencode/src/provider/provider.ts`. Bundled providers are instantiated directly; unknown providers are dynamically installed via `BunProc.install`.

- Anthropic - Claude models
  - SDK: `@ai-sdk/anthropic`
  - Auth: `ANTHROPIC_API_KEY` env var or stored auth
- OpenAI - GPT models + Responses API
  - SDK: `@ai-sdk/openai`
  - Auth: `OPENAI_API_KEY`
- Google Gemini - Generative AI models
  - SDK: `@ai-sdk/google`
  - Auth: `GOOGLE_GENERATIVE_AI_API_KEY`
- Google Vertex AI - Vertex-hosted models
  - SDK: `@ai-sdk/google-vertex`
  - Auth: Application Default Credentials via `google-auth-library`; env: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_VERTEX_LOCATION`
- Amazon Bedrock - AWS-hosted models
  - SDK: `@ai-sdk/amazon-bedrock`
  - Auth: AWS credential provider chain (`@aws-sdk/credential-providers`); env: `AWS_ACCESS_KEY_ID`, `AWS_REGION`, `AWS_PROFILE`, `AWS_BEARER_TOKEN_BEDROCK`
- Azure OpenAI - Azure-hosted OpenAI models
  - SDK: `@ai-sdk/azure`
  - Auth: `AZURE_API_KEY`, `AZURE_RESOURCE_NAME`
- OpenRouter - Multi-provider routing
  - SDK: `@openrouter/ai-sdk-provider`
  - Auth: `OPENROUTER_API_KEY`
- GitLab AI - GitLab Duo / AI Gateway
  - SDK: `@gitlab/gitlab-ai-provider`
  - Auth: `GITLAB_TOKEN` or OAuth via `@gitlab/opencode-gitlab-auth`; env: `GITLAB_INSTANCE_URL`
- Mistral - Mistral models
  - SDK: `@ai-sdk/mistral`
  - Auth: `MISTRAL_API_KEY`
- Groq - Fast inference
  - SDK: `@ai-sdk/groq`
  - Auth: `GROQ_API_KEY`
- xAI (Grok) - xAI models
  - SDK: `@ai-sdk/xai`
  - Auth: `XAI_API_KEY`
- Cohere - Cohere models
  - SDK: `@ai-sdk/cohere`
  - Auth: `COHERE_API_KEY`
- Cerebras - Cerebras inference
  - SDK: `@ai-sdk/cerebras`
  - Auth: `CEREBRAS_API_KEY`
- Perplexity - Perplexity models
  - SDK: `@ai-sdk/perplexity`
  - Auth: `PERPLEXITY_API_KEY`
- Together AI - Together inference
  - SDK: `@ai-sdk/togetherai`
  - Auth: `TOGETHER_AI_API_KEY`
- Vercel AI Gateway - Vercel-hosted gateway
  - SDK: `@ai-sdk/vercel`
  - Auth: `VERCEL_API_KEY`
- DeepInfra - DeepInfra inference
  - SDK: `@ai-sdk/deepinfra`
  - Auth: `DEEPINFRA_API_KEY`
- Cloudflare Workers AI - CF-hosted models
  - SDK: `@ai-sdk/openai-compatible`
  - Auth: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_KEY`
- Cloudflare AI Gateway - CF AI Gateway proxy
  - SDK: `ai-gateway-provider`
  - Auth: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`, `CLOUDFLARE_API_TOKEN`
- GitHub Copilot - Copilot models
  - SDK: custom `packages/opencode/src/provider/sdk/copilot.ts`
  - Auth: OAuth via GitHub
- SAP AI Core - SAP-hosted models
  - SDK: dynamic install
  - Auth: `AICORE_SERVICE_KEY`, `AICORE_DEPLOYMENT_ID`

**Model Metadata:**

- models.dev API - Provider/model catalog fetched at runtime
  - Client: `packages/opencode/src/provider/models.ts`

**GitHub:**

- GitHub App - Installation token exchange for CI actions
  - SDK: `@octokit/auth-app`, `@octokit/rest`
  - Used in: `packages/function/src/api.ts` (token exchange endpoints), `packages/opencode/src/` (repo operations)
  - Auth: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` secrets; OIDC JWT verification via `jose`

**Communication (internal tooling):**

- Discord - Support bot bridge from Feishu
  - Auth: `DISCORD_SUPPORT_BOT_TOKEN`, `DISCORD_SUPPORT_CHANNEL_ID`
  - Used in: `packages/function/src/api.ts`
- Feishu (Lark) - Incoming webhook bridge to Discord
  - Auth: `FEISHU_APP_ID`, `FEISHU_APP_SECRET`
  - Used in: `packages/function/src/api.ts`

**Email:**

- EmailOctopus - Mailing list
  - Auth: `EMAILOCTOPUS_API_KEY`
  - Used in: `infra/app.ts` (secret declared, consumed by function)

## Data Storage

**Databases:**

- SQLite (local, per-project)
  - Client: Bun's native `bun:sqlite` + Drizzle ORM (`drizzle-orm/bun-sqlite`)
  - Location: `~/.local/share/opencode/opencode.db` (resolved via `packages/opencode/src/storage/db.ts`)
  - Schema: `packages/opencode/src/storage/schema.sql.ts` + per-module `*.sql.ts` files
  - Migrations: `packages/opencode/migration/` directory, applied at startup

**File Storage:**

- Cloudflare R2 - Session share data storage
  - Binding: `Bucket` (R2Bucket) in `packages/function/src/api.ts`
  - Used for: persisting shared session JSON blobs at `share/<key>.json`

**Caching:**

- In-memory only (Maps, lazy singletons) - no external cache layer

## Authentication & Identity

**Provider Auth (`packages/opencode/src/auth/`):**

- Custom auth service backed by local SQLite storage
- Supports three auth types: `oauth` (access+refresh tokens), `api` (API key), `wellknown` (key+token)
- OAuth flows handled per-provider (GitHub, GitLab, opencode account)
- Implementation: `packages/opencode/src/auth/service.ts`

**MCP OAuth (`packages/opencode/src/mcp/`):**

- Full OAuth 2.0 PKCE flow for remote MCP servers
- Provider: `packages/opencode/src/mcp/oauth-provider.ts`
- Callback server: `packages/opencode/src/mcp/oauth-callback.ts`
- Token storage: `packages/opencode/src/mcp/auth.ts`

**Account/Console Auth (`packages/opencode/src/account/`):**

- OpenAuth-based OAuth for opencode console accounts
- SDK: `@openauthjs/openauth`
- Tokens stored locally, used for share API and enterprise features

**GitHub OIDC (CI):**

- JWT verification via `jose` + GitHub JWKS endpoint
- Used in `packages/function/src/api.ts` to exchange OIDC tokens for GitHub App installation tokens

## Monitoring & Observability

**Error Tracking:**

- Not detected (no Sentry, Datadog, etc.)

**Logs:**

- Structured logging via custom `Log` service (`packages/opencode/src/util/log.ts`)
- Cloudflare Logpush enabled on the API worker (`logpush: true` in `infra/app.ts`)
- Console logging in Cloudflare Worker functions

## CI/CD & Deployment

**Hosting:**

- CLI: distributed binary (built via `packages/opencode/script/build.ts`)
- API Worker: Cloudflare Workers (`packages/function/src/api.ts`) via SST
- Web/Docs: Cloudflare Pages via `@astrojs/cloudflare` + SST (`infra/app.ts`)
- Desktop: Tauri-built native app (`packages/desktop`)

**CI Pipeline:**

- GitHub Actions (`.github/workflows/`)
- Custom setup actions: `.github/actions/setup-bun`, `.github/actions/setup-git-committer`
- Artifact uploads via `@actions/artifact`

**IaC:**

- SST 3.18.10 (`infra/`) targeting Cloudflare
- Secrets managed as SST secrets (`sst.Secret`)

## MCP (Model Context Protocol)

**Client:** `@modelcontextprotocol/sdk` 1.25.2

- Supports three transport types:
  - `StdioClientTransport` - local subprocess MCP servers
  - `StreamableHTTPClientTransport` - remote HTTP MCP servers
  - `SSEClientTransport` - remote SSE MCP servers
- OAuth support for remote servers (PKCE flow)
- Config-driven: defined in `opencode.json` under `mcp` key
- Implementation: `packages/opencode/src/mcp/index.ts`

## LSP (Language Server Protocol)

**Client:** custom implementation in `packages/opencode/src/lsp/`

- Connects to language servers for code intelligence
- Used by file/code tools for diagnostics and completions

## Session Sharing

**Share API:** `https://opncd.ai` (legacy) or console API (enterprise)

- Endpoints: `/api/share` (create), `/api/share/:id/sync`, `/api/share/:id` (delete)
- Backed by Cloudflare Durable Objects (`SyncServer`) + R2
- WebSocket real-time sync via `/share_poll`
- Implementation: `packages/opencode/src/share/share-next.ts`, `packages/function/src/api.ts`

## Webhooks & Callbacks

**Incoming:**

- `/feishu` - Feishu webhook receiver (bridges to Discord)
- `/exchange_github_app_token` - GitHub Actions OIDC token exchange
- MCP OAuth callback server (local HTTP, ephemeral) - `packages/opencode/src/mcp/oauth-callback.ts`

**Outgoing:**

- Discord API (`discord.com/api/v10`) - support message forwarding
- Share sync API (`opncd.ai` or enterprise URL) - session data publishing
- AI provider APIs - all LLM inference calls

## Environment Configuration

**Required env vars (by feature):**

- AI providers: per-provider API key vars (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)
- AWS Bedrock: `AWS_ACCESS_KEY_ID`, `AWS_REGION` (or profile/IAM role)
- Google Vertex: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_VERTEX_LOCATION`
- Cloudflare infra: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_KEY`
- GitHub App (function): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`
- Discord bridge: `DISCORD_SUPPORT_BOT_TOKEN`, `DISCORD_SUPPORT_CHANNEL_ID`
- Feishu bridge: `FEISHU_APP_ID`, `FEISHU_APP_SECRET`

**Secrets location:**

- Production: SST secrets (Cloudflare-backed) declared in `infra/app.ts`
- Local dev: env vars or stored auth in local SQLite via `packages/opencode/src/auth/`

---

_Integration audit: 2026-03-17_
