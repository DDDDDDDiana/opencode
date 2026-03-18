# Phase 8: Data Migration - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning
**Source:** Roadmap requirements (discuss phase skipped)

<domain>
## Phase Boundary

此阶段为v1.2里程碑的第一阶段,准备数据库以强制执行身份验证。目标是确保所有现有会话都有有效的user_id,并修改schema以防止将来创建匿名会话。

**范围:**

- 迁移或删除NULL user_id的现有会话
- 将SessionTable.user_id列改为NOT NULL约束
- 确保零数据丢失和零孤立会话

**不在范围内:**

- 身份验证中间件(Phase 9)
- 匿名代码路径清理(Phase 10)
- 用户注册或API密钥管理

</domain>

<decisions>
## Implementation Decisions

### 迁移策略

- **锁定决策:** 使用Drizzle迁移系统生成SQL
- **锁定决策:** 迁移必须在代码部署之前完成(防止孤立数据)
- **锁定决策:** 对NULL user_id会话的处理:分配给系统用户或删除(由实现决定)

### Schema变更

- **锁定决策:** SessionTable.user_id从nullable改为NOT NULL
- **锁定决策:** 保留现有索引和外键约束

### 数据完整性

- **锁定决策:** 迁移完成后验证零NULL user_id
- **锁定决策:** 验证schema拒绝没有user_id的INSERT

### OpenCode's Discretion

- NULL会话的具体处理方式(系统用户 vs 删除)
- 迁移脚本的事务边界
- 回滚策略(如果需要)

</decisions>

<specifics>
## Specific Ideas

**现有基础设施:**

- UserTable已存在(来自v1.0)
- SessionTable.user_id列已存在但nullable
- Drizzle迁移系统已配置

**技术约束:**

- 使用Drizzle schema定义和迁移生成
- SQLite数据库(ALTER TABLE支持有限)
- 必须保持向后兼容直到迁移完成

**验证要点:**

- 查询所有会话不遇到NULL user_id
- Schema拒绝创建没有user_id的会话
- 迁移完成无数据丢失

</specifics>

<deferred>
## Deferred Ideas

- 迁移性能优化(数据量小,不需要)
- 蓝绿部署策略(v2 - INFRA-02)
- 迁移审计日志(v2 - OBS-01)
- 回滚自动化(手动回滚足够)

</deferred>

---

_Phase: 08-data-migration_
_Context gathered: 2026-03-18 (discuss phase skipped)_
