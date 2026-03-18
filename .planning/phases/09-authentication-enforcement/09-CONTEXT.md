# Phase 9: Authentication Enforcement - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

此阶段为v1.2里程碑的第二阶段，在中间件层强制执行API key认证。目标是拒绝所有未认证请求，同时保持Admin认证独立运作。

**范围:**

- 添加中间件拒绝无效/缺失API key的请求
- 返回符合HTTP规范的401 Unauthorized响应
- 保持Admin认证(OPENCODE_SERVER_PASSWORD)独立于用户API key认证
- 确保两套认证系统无冲突共存

**不在范围内:**

- 数据库迁移(Phase 8已完成)
- 匿名代码路径清理(Phase 10)
- 性能优化(API key缓存、速率限制 - v2)
- 审计日志(v2)

</domain>

<decisions>
## Implementation Decisions

### 中间件位置

- **锁定决策:** 在CORS之后、Instance上下文之前插入用户认证中间件
- **锁定决策:** 中间件读取`x-opencode-api-key` header并调用现有的`resolve()`函数
- **锁定决策:** 认证失败直接返回401，不再回退为匿名
- **锁定决策:** 使用`UserContext.provide()`包装后续请求处理

### 401响应格式

- **锁定决策:** 包含`WWW-Authenticate: Bearer realm="opencode"` header (符合HTTP规范)
- **锁定决策:** 响应体为JSON格式: `{ error: "Unauthorized", message: "Valid API key required" }`
- **锁定决策:** 状态码固定为401，不区分"缺失"和"无效"key

### 豁免路由

- **锁定决策:** 健康检查路由(`/health`, `/metrics`, `/ready`)豁免认证
- **锁定决策:** OpenAPI文档路由(`/doc`)豁免认证
- **锁定决策:** 日志路由(`/log`)豁免认证
- **锁定决策:** 所有其他路由必须认证

### Admin与用户认证共存

- **锁定决策:** Admin认证(basicAuth)在用户认证之前执行
- **锁定决策:** Admin认证通过后，仍需执行用户认证
- **锁定决策:** Admin路由(`/user/*`)需要两层认证：先Admin basicAuth，再用户API key
- **锁定决策:** 两套认证系统独立运作，互不干扰

### OpenCode's Discretion

- 中间件函数的具体实现方式
- 错误日志的详细程度
- 豁免路由列表的具体实现方式(数组、Set、正则)

</decisions>

<specifics>
## Specific Ideas

**现有基础设施:**

- `user-auth.ts`中的`resolve()`函数已实现API key验证
- `UserContext`已建立并通过ALS传播
- Admin basicAuth中间件已在server.ts第79-87行
- CORS中间件已在第105-129行

**技术约束:**

- 使用Hono中间件模式
- 保持与现有中间件链的兼容性
- 不破坏现有的Admin认证流程

**验证要点:**

- 无API key的请求收到401
- 无效API key的请求收到401
- 有效API key的请求正常访问
- Admin可以独立于用户API key进行认证

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/opencode/src/server/user-auth.ts`: `resolve()`函数已实现API key验证逻辑
- `packages/opencode/src/user/user-context.ts`: `UserContext.provide()`用于传播身份
- `packages/opencode/src/server/server.ts`: 中间件链的主要接入点

### Established Patterns

- Hono使用`.use()`挂载全局中间件
- 中间件按顺序执行：错误处理 → Admin auth → 日志 → CORS → 用户auth → Instance上下文
- 认证中间件模式：读取header → 验证 → 设置上下文 → next()或返回错误

### Integration Points

- `packages/opencode/src/server/server.ts`: 在CORS中间件(第105行)之后插入用户认证中间件
- 中间件应在Instance上下文(第194行)之前执行
- 豁免路由检查应在中间件开头执行

</code_context>

<deferred>
## Deferred Ideas

- API key验证的内存缓存(v2 - PERF-01)
- 失败认证尝试的速率限制(v2 - PERF-02)
- 认证失败的审计日志(v2 - OBS-01)
- 认证失败的Webhook通知(v2 - OBS-02)
- 内部路由白名单(研究已识别需求但用户选择最小范围)

</deferred>

---

_Phase: 09-authentication-enforcement_
_Context gathered: 2026-03-18_
