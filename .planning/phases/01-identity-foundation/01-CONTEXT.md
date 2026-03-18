# Phase 1: Identity Foundation - Context

**Gathered:** 2026-03-17
**Status:** Planning complete

<domain>
## Phase Boundary

本阶段交付 API key 身份识别与 `UserContext` 传播能力：请求可通过 `x-opencode-api-key` 完成身份识别，身份信息可沿整个请求调用栈传递；缺失或无效 key 的请求以匿名模式继续。用户管理、key 发放、配额、会话归属与资源限制属于后续阶段。

</domain>

<decisions>
## Implementation Decisions

### API key 形式与存储

- API key 采用 `sk-<random>` 形式。
- 随机部分使用 32 字节随机值，并编码为 64 位 hex 字符串。
- 数据库存储仅保存 key 的哈希值，不保存明文 key。
- 哈希算法使用 `bcrypt`，cost factor 固定为 `8`。
- Phase 1 的运行时认证流程不向调用方展示或回显 API key。

### 认证失败语义

- 缺失 key、无效 key、格式错误 key 都不直接报错，统一回退为匿名请求。
- `UserContext` 或其配套内部状态需要区分匿名来源，至少区分 `missing` 与 `invalid`；格式错误 key 归入无效 key 语义处理。
- HTTP 响应不额外暴露本次请求是 authenticated 还是 anonymous。
- 当请求尝试过认证但回退匿名时，内部仍保留“曾尝试认证”的痕迹，供日志、诊断或后续策略使用。

### 路由应用范围

- 用户身份认证采用全局 middleware 挂载，而不是只挂在局部路由上。
- 仅真正公共的入口跳过该 middleware；其余请求默认都先经过身份解析。
- WebSocket、SSE 等长连接入口在连接建立时一次性确定身份，不在流中二次切换身份。
- Phase 1 的身份 middleware 只负责解析身份，不负责强制要求已认证；是否拒绝匿名请求由具体路由在后续阶段决定。

### UserContext 表达方式

- 已认证状态下，`UserContext` 最少暴露 `user_id`，不要求在 Phase 1 直接暴露完整 user 对象。
- 匿名状态使用显式 anonymous 表达，而不是 `null` 或 `undefined`。
- 下游代码读取身份时，以 `authenticated | anonymous` 这类显式状态模型为主，而不是仅通过 `user_id` 是否存在来推断。
- 若某段代码运行在没有显式提供 `UserContext` 的环境中，读取行为应安全回落为 anonymous，而不是抛错。

### 身份日志粒度

- 认证成功日志记录 `user_id`，不记录明文 key。
- 匿名回退或认证失败日志记录结果与原因码，不记录原始 key 内容。
- 日志级别按场景分层：成功认证偏向 `debug`，无效 key 或值得关注的匿名回退进入 `info` 或更高等级。
- 对重复无效 key 的日志做去重或限频，避免高频噪音和探测刷屏。

### OpenCode's Discretion

- `UserContext` 的具体字段命名与 helper 组织方式。
- “真正公共路由”的最终白名单清单，只要保持默认全局解析的原则。
- 重复无效 key 日志去重/限频的具体实现方式。
- `bcrypt` 调用封装方式与认证辅助函数的落点。

</decisions>

<specifics>
## Specific Ideas

- 认证状态应尽量对普通调用方透明：请求要么带着已认证身份继续执行，要么自然回退匿名，不额外在响应中暴露身份判定结果。
- 匿名不仅仅是“没有用户”，还要能承载来源信息，便于后续排查 `missing` 与 `invalid` 的差异。
- 本阶段不定义面向管理端的一次性 key 发放体验；那属于后续用户管理能力范围。

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/opencode/src/util/context.ts`: 已有轻量 `AsyncLocalStorage` 包装，可直接复用来实现 `UserContext`。
- `packages/opencode/src/control-plane/workspace-context.ts`: 已建立并行上下文模式，可作为 `UserContext` 的直接参考。
- `packages/opencode/src/server/server.ts`: 已有全局 Hono middleware 链和现成认证入口，适合插入用户身份解析。
- `packages/opencode/src/util/log.ts`: 现有结构化日志模式可直接承接身份成功/失败日志。

### Established Patterns

- 项目已广泛使用 `AsyncLocalStorage` 进行实例级上下文隔离，本阶段应延续“并行上下文”模式，而不是把用户身份塞进 `Instance`。
- 服务端采用 Hono 全局 `.use()` middleware 链组织横切逻辑，身份解析适合按同样方式接入。
- 数据层使用 Drizzle + SQLite，表和列遵循 `snake_case`，后续 user 相关表结构应延续相同约定。
- 错误处理偏向结构化错误和早返回；Phase 1 已确定无效 key 不直接转成对外错误响应。

### Integration Points

- `packages/opencode/src/server/server.ts`: 用户身份解析 middleware 的主要接入点。
- `packages/opencode/src/project/instance.ts` 与 `packages/opencode/src/control-plane/workspace-context.ts`: `UserContext` 的模式参考与并行关系锚点。
- `packages/opencode/src/server/routes/`: 后续各路由会消费 `UserContext`，并在后续阶段按需决定是否强制已认证。
- `packages/opencode/src/**/*.sql.ts` 与 `packages/opencode/migration/`: 后续 user/key 持久化表和迁移的落点。

</code_context>

<deferred>
## Deferred Ideas

- API key 的一次性发放、轮换、重置与面向管理员的展示策略，留到用户管理 API 阶段再定。
- 哪些具体管理路由必须拒绝匿名访问，留到后续涉及用户管理或资源保护的阶段再定。

</deferred>

---

_Phase: 01-identity-foundation_
_Context gathered: 2026-03-17_
