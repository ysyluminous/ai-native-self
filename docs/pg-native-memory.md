# PG 原生记忆：跨机器不再依赖 git

> 2026-11-13 · 内核方法文档
> 结论：跨机器以 PG16 `mem` 为共享层，Markdown 保留为本地日志与导出，不再作为跨机同步的唯一通道。

## 1. 为什么改

git 适合版本化，不适合当跨机实时共享：

- 两台机器要同时写，会冲突、要合并、要处理代理和凭据。
- 公司电脑只能只读切片，写不进去；个人电脑的写入也不会自动出现在公司电脑。
- 手机、临时工具、网页端更难接。

PG 适合当共享层：一处写入，所有机器立刻可查；权限、行级隔离、备份都能做。

## 2. 目标结构

```
写入（任一机器）                   共享层                    读取（任一机器）
push.mjs / MCP remember ──▶ PG16 mem.doc / mem.conv ──▶ zhishu-search MCP / REST
                                  mem.entity / mem.edge          （自动路由）
本地 Markdown（追加日志/导出）──▶ 定期快照（可选）
```

- **PG 是共享真相**：文档块、会话元数据、实体、关系、任务。
- **Markdown 是本地日志与导出**：离线可读、可 git 备份、可迁移；不再要求两台机器同步同一个 git 分支。
- **检索服务只有一处**：智枢 `zhishu-search` 同时查业务数据和个人记忆。

## 3. 表结构

```sql
create schema if not exists mem;

-- 文档/块：整篇 md 或 inbox 里的单个 capture 块
create table mem.doc (
  path text primary key,        -- 文件路径 或 文件#块id
  kind text not null,           -- decision/event/entity/artifact/note/state
  title text not null default '',
  body text not null default '',
  hash text not null,
  updated_at timestamptz not null default now()
);

-- 会话元数据（全文仍在 omnihist，不搬 1.5GB）
create table mem.conv (
  id text primary key, source text, external_id text, title text, project text,
  cwd text, model text, created_at timestamptz, updated_at timestamptz,
  message_count integer, snippet text, hash text
);

-- 图谱：实体与边（来自 frontmatter 的 refs / topic）
create table mem.entity (
  id text primary key, kind text, name text, updated_at timestamptz
);
create table mem.edge (
  src text, dst text, relation text, weight integer,
  updated_at timestamptz, primary key (src, dst, relation)
);

-- 定时任务定义
create table mem.task (...);  -- 见 docs/task-registry.md
```

当前规模（2026-11-13）：文档 244、会话 2,595、实体 350、关系 269。

## 4. 写入

- 主动：`push.mjs` 写一条 → 立刻 upsert `mem.doc` → 图谱同步。
- 批量：`sync-mem-pg.py` 扫语料库 → 文档/块、实体、边。
- 会话：`omnihist sync` → `sync-mem-pg.py` 只写元数据。
- 以后加 MCP 工具 `remember`：任何 AI 直接写 PG，不必先落 md。

写入规则：`path` 或 `id` 幂等；`hash` 没变就跳过；只追加新记录，不覆盖历史结论（用 `supersede` 表示更正）。

## 5. 读取与路由

统一入口：`zhishu-search`（REST + MCP，`127.0.0.1:8765`）。

- `source=mem`：个人记忆文档与会话。
- `source=zhishu`：X、CMS、内容库。
- `source=coord`：任务、决策。
- 不传 source：跨源检索，按相关度混合。

MCP 工具已有 `search / get_document / stats / freshness / chat`；个人记忆作为 `mem.doc` / `mem.conv` 两个来源接入。
`zhishu.mjs` 会自动发现服务，失败时尝试拉起 `run.py`。

## 6. 跨机器

1. 共享 PG 建库 `mem`（同一实例，独立库）。
2. 每台机器设置用户级环境变量 `MEM_PG_DSN`（只放环境变量，不写仓库）。
3. 同步脚本与计划任务自动写共享库；不需要 git push。
4. 读端把 `MEM_DSN` 指到同一个库；服务只读。
5. 权限：写账号只授权 `mem` schema；读账号只读；不要把 postgres 超级用户发给每台机器。

## 7. 向量与图谱

- **图谱**：已落 `mem.entity` / `mem.edge`，来自 `refs` 和 `topic`；下一步加 `related(id, depth)` 查询与 MCP 工具。
- **向量**：当前共享 PG 没有 `pgvector`（只有 `pg_trgm`）。两条路：
  1. 在 PG 镜像里安装 `vector` 扩展，加 `mem.doc_embedding`；
  2. 用独立向量服务（BGE-M3）存 embedding，PG 只存引用。
- 没有向量之前，检索用 `pg_trgm` + 标题/正文权重，已能覆盖“我以前定过什么”。

## 8. 边界与取舍

- PG 做主存后，Markdown 仍是可读、可导出的备份；不把 md 删掉，避免被单一数据库锁死。
- 共享库只放结构化内容；会话全文留 omnihist，避免 1.5GB 上传。
- 凭据只存在环境变量；公开仓库里没有任何连接串。
- 多机同时写同一 `path` 时以 `updated_at` 最新为准；冲突用 `supersede` 记录，不静默覆盖历史。

## 9. 落地状态

| 项 | 状态 |
|---|---|
| 远程 `mem` 库 | ✅ 已建（与业务库同实例，独立库） |
| 文档/块同步 | ✅ 244 条 |
| 会话元数据 | ✅ 2,595 条 |
| 实体/关系 | ✅ 350 / 269 |
| 智枢检索接入 `mem` | ✅ `/search?source=mem` 可查 |
| MCP 写入 `remember` | ⏳ 下一步 |
| 向量 | ⏳ 需 pgvector 或独立向量服务 |
| 图谱查询接口 | ⏳ 下一步 |
