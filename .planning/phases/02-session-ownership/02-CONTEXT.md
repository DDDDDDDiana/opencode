# Phase 2: Session Ownership - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

每个 session 归属于一个用户，跨用户数据访问不可能。SessionTable 添加 `user_id` 列，所有 CRUD 操作按所有权过滤。已认证用户的新 session 自动标记其 user_id；匿名请求只能看到 user_id IS NULL 的 session。现有部署无需迁移即可继续工作。

</domain>

<decisions>
## Implementation Decisions

### 所有权检查行为

- `Session.get()` 和 `Session.remove()` 访问不属于调用方的 session 时，统一返回 404（假装不存在）
- 不区分"session 不存在"和"无权限访问"两种情况 — 对外都是 404
- 内部实现：直接在 SQL 查询中加 `user_id` 过滤条件，查不到就是 404，不需要先查再判断
- 不向调用方泄露其他用户 session 的存在性 — 符合最小信息暴露原则

### Fork 所有权规则

- `Session.fork()` 严格继承 parent session 的 `user_id`（包括 NULL）
- 不管请求方是 authenticated 还是 anonymous，fork 出的 session 的 `user_id` 永远等于 parent 的 `user_id`
- Fork 前先检查 parent 所有权：使用 `Session.get()` 的逻辑（按 user_id 过滤），无权限就 404
- Authenticated 用户 fork 匿名 session（user_id IS NULL）时，新 session 仍然是 NULL — 不改归属

### 迁移与遗留 session

- 添加 `user_id` 列时，所有现有 session 的 `user_id` 保持 NULL
- 不尝试回填或推断归属 — 向后兼容，单用户部署升级后行为不变
- 匿名请求能看到所有 `user_id IS NULL` 的 session，包括迁移前的遗留 session
- 单用户部署（无 API key 配置）升级后，所有请求都是匿名，能看到所有历史 session — 无感知升级

### Session.list() 作用域边界

- Authenticated 用户只看到 `user_id = 请求方 user_id` 的 session — 严格隔离
- Authenticated 用户看不到 `user_id IS NULL` 的 session（包括遗留 session）
- Anonymous 请求只看到 `user_id IS NULL` 的 session
- `user_id` 过滤叠加在现有过滤参数（directory, workspaceID, roots, search, limit）之上 — 作为全局约束
- 现有过滤参数继续生效，`user_id` 过滤不覆盖它们

### Session.create() 归属分配

- Authenticated 请求创建的 session，`user_id` 自动设置为请求方的 user_id
- Anonymous 请求创建的 session，`user_id` 保持 NULL
- 从 `UserContext` 读取当前用户身份（Phase 1 已建立）

### OpenCode's Discretion

- `user_id` 列的具体 SQL 类型（text 或 integer）— 与 UserTable 的 id 类型保持一致
- 迁移文件的命名 slug
- Session CRUD 函数内部如何读取 `UserContext`（直接调用还是封装 helper）

</decisions>

<specifics>
## Specific Ideas

- 所有权检查的核心原则：对外统一 404，不泄露其他用户数据的存在性
- Fork 继承 parent owner 是 ROADMAP 明确要求，不因请求方身份改变
- 向后兼容是关键约束：现有单用户部署升级后，匿名请求能看到所有历史 session

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/opencode/src/session/session.sql.ts`: SessionTable 定义，需添加 `user_id` 列
- `packages/opencode/src/session/index.ts`: Session CRUD 函数（list, get, create, fork, remove），需添加 user_id 过滤
- `packages/opencode/src/util/context.ts`: UserContext ALS 已在 Phase 1 建立，可直接读取当前用户身份
- `packages/opencode/migration/`: Drizzle 迁移目录，需生成新迁移添加 `user_id` 列

### Established Patterns

- Drizzle ORM + SQLite，列名使用 `snake_case`
- Session.list() 使用 generator 函数返回 `Generator<Info>`，过滤逻辑在 SQL 查询中
- Session.get() 返回 `Promise<Info>`，查不到时抛 `SessionNotFound` 错误
- Session.create() 和 Session.fork() 返回 `Promise<Info>`
- UserContext 通过 ALS 传播，读取方式类似 WorkspaceContext（有 context 返回值，无 context 返回 undefined）

### Integration Points

- `packages/opencode/src/session/session.sql.ts`: 添加 `user_id: text().references(() => UserTable.id)` 列（nullable）
- `packages/opencode/src/session/index.ts`:
  - `Session.list()` 的 SQL 查询添加 `user_id` WHERE 条件
  - `Session.get()` 和 `Session.remove()` 的 SQL 查询添加 `user_id` WHERE 条件
  - `Session.create()` 从 UserContext 读取 user_id 并写入
  - `Session.fork()` 先检查 parent 所有权，然后继承 parent 的 user_id
- `packages/opencode/migration/`: 运行 `bun run db generate --name add_session_user_id` 生成迁移

</code_context>

<deferred>
## Deferred Ideas

无 — 讨论保持在 Phase 2 范围内

</deferred>

---

_Phase: 02-session-ownership_
_Context gathered: 2026-03-17_
