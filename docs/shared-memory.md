# 多 AI 共享记忆、决策与会话

> 2026-11-13 · 内核方法文档
> 适用：WorkBuddy、Claude Code、Codex、opencode、Trae、Cursor、Qoder、OpenMausBot 等
> 一句话：**一个真源、三层检索、定时同步、按需取用**。不把 1.5GB 原文塞进上下文。

## 0. 为什么会出现「同一个问题问两遍」

实例：WorkBuddy 让用户提供 Go 仓库路径和线上 PG 账号，说源码不在本机、出不了索引 SQL。
但这两件事早就定过：仓库路径和线上库地址都在私有语料库里。
用 `history.mjs` 查询对应关键词，能直接命中历史记录。

四个根因：

1. **定时同步停了**：omnihist 最后一次 sync 是 2026-11-11，之后两天的会话没进库。
2. **没有强制先查**：技能写了「先读」，但没写成硬规则，工具一急就直接问人。
3. **数据是分片的**：Markdown 语料、omnihist SQLite、智枢 PG、协调库 PG 各在一处，没有统一入口。
4. **没有上下文预算**：工具要么不查，要么把整段对话塞进上下文，干脆不敢查。

## 1. 真源与派生层

| 层 | 位置 | 放什么 | 谁是真相 |
|---|---|---|---|
| L1 语料 | 私有 vault `ai-native-self`（Markdown） | 决策、事实、事件、实体、复盘 | **是** |
| L2 会话原文 | `~/.omnihist/omnihist.db`（SQLite） | 16 类工具的完整对话 | 原文是，结论不是 |
| L3 业务库 | `zhishu` / `coord` PG | 推文、CMS、任务、协调决策 | 是（业务域内） |
| L4 共享索引 | PG16 `mem` schema | 文档索引、会话元数据、摘要、同步水位 | 派生，可重建 |

规则：

- 决策以 vault 的 `decisions/` 为准；对话只是「当时说过什么」，不能覆盖后来的决策。
- `mem` 是派生层，删了能重建；任何写操作只写 L1/L2/L3，再异步同步到 L4。
- 不把大段原文复制到 L4；L4 只存元数据、摘要和定位符。

## 2. PG16 共享层 `mem`

```sql
create schema if not exists mem;

-- 文档索引：vault 里的 md（决策、事件、实体、复盘）
create table mem.doc (
  path text primary key,          -- 相对 vault 的路径
  kind text not null,             -- decision/event/entity/review/artifact/note
  title text not null default '',
  body text not null default '',
  hash text not null,             -- sha256，内容没变就跳过
  updated_at timestamptz not null default now()
);
create index doc_body_trgm on mem.doc using gin (body gin_trgm_ops);
create index doc_title_trgm on mem.doc using gin (title gin_trgm_ops);

-- 会话元数据：不存全文，全文留在 omnihist
create table mem.conv (
  id text primary key,            -- source:external_id
  source text not null,           -- workbuddy/opencode/mausbot/...
  external_id text not null,
  title text not null default '',
  project text not null default '',
  cwd text not null default '',
  model text not null default '',
  created_at timestamptz,
  updated_at timestamptz,
  message_count integer not null default 0,
  snippet text not null default '', -- 首条用户消息前 300 字
  hash text not null
);
create index conv_updated_idx on mem.conv (updated_at desc);
create index conv_source_idx on mem.conv (source, updated_at desc);
create index conv_snippet_trgm on mem.conv using gin (snippet gin_trgm_ops);

-- 同步水位
create table mem.sync_state (
  name text primary key,
  cursor text not null default '',
  updated_at timestamptz not null default now()
);
```

设计取舍：

- **不搬 1.5GB 原文**。会话只存标题、时间、来源、首条摘要；要全文再用 `omnihist show <id>` 到原机取。
- 文档索引只存 md（当前 1.4MB），全量可放 PG，跨机可查。
- 以后要向量再单独加 `mem.doc_embedding` / `mem.conv_embedding`，不阻塞现在。

## 3. 同步管线

```
omnihist sync                 # 16 类工具 → ~/.omnihist/omnihist.db
        │
        ├─ sync-mem-pg.py     # 会话元数据 → mem.conv；vault md → mem.doc
        │
        └─ digest.mjs         # 最近 24h 摘要 → state/digests/YYYY-MM-DD.md
```

- 频率：会话同步每小时；摘要在每天 07:00。
- 增量：`mem.sync_state('conv')` 存最后 `updated_at`；文档按 `path + hash` 覆盖。
- 失败处理：单次失败不阻塞下次；连续失败 3 次就在摘要里写一行告警。
- 切换远程：脚本读 `MEM_PG_DSN`，本机默认 `postgresql://postgres:postgres@127.0.0.1:5432/mem`；
  跨机共享时指向 `pdb-pg` 的 `mem` 库。本机 PG 只做缓存，不作为唯一副本。

## 4. 检索协议（带硬预算）

### 4.1 顺序

1. `recall.mjs "<问句>"` —— 先查决策和事实（L1）。
2. `history.mjs "<问句>"` —— 再查会话（L2）。
3. `zhishu.mjs "<问句>"` —— 业务数据（L3）。
4. 都没有，才说「库里没有」，并补一句检索链路自检结果。

### 4.2 预算

| 层 | 读什么 | 上限 |
|---|---|---|
| L0 | 常驻指针（SOUL/AGENTS/SKILL 摘要） | ≤ 200 行 |
| L1 | 决策/事实命中 | 最多 10 条，每条 ≤ 200 字 |
| L2 | 会话命中 | 最多 5 条，每条只取标题+时间+片段 |
| 总计 | 一次回答引用的记忆 | ≤ 2000 字，超过就只留结论和链接 |

超过预算时：先给结论，再给「依据文件路径 / conversation id」，不要整段复述。

### 4.3 引用

回答里出现「以前定过」时，必须带一个可核对的定位：
`decisions/20261110-xxx.md` 或 `omnihist show <conversation-id>`。
没有定位就不许说「你之前说过」。

## 5. 工具合规契约（写进每个工具的技能）

每个工具在问用户之前，必须先过一遍：

1. 这个问题是不是「用户自己的事实/决策/路径/账号/偏好」？
2. 是 → 先跑 `recall` → `history` → `zhishu`。
3. 命中 → 直接用，并带定位；不命中 → 才问用户。
4. 任务结束 → 有新决策/新流程/新文件，必须 `capture.mjs` 落库。

反例（禁止）：
- 「请把仓库路径/数据库账号给我」——先查库。
- 「我不知道你之前怎么定的」——先查 `recall --history`。
- 「聊天记录太长，我看不了」——用检索，不要整段读。

## 6. 摘要与瘦身

- 每日摘要：新增会话数、新决策标题、新文件、失败项；写 `state/digests/YYYY-MM-DD.md`。
- 每周摘要：把 7 天摘要压成 10 行，旧摘要归档，不删除。
- 会话原文保留 180 天；超过后只保留摘要和 `conversation id`（原文可由用户手动导出）。
- `mem.conv.snippet` 永远 ≤ 300 字，防止索引本身变大。

## 7. 落地阶段

| 阶段 | 内容 | 状态 |
|---|---|---|
| P1 | omnihist 定时 sync + 每日摘要 | 本轮做 |
| P2 | `mem.doc` + `mem.conv` 本机 PG 同步 | 本轮做 |
| P3 | 切到 `pdb-pg` 的 `mem` 库，跨机共享 | 待做 |
| P4 | 向量/混合检索（BGE-M3 + pgvector） | 待做 |
| P5 | 反馈闭环（命中/未命中写回，自动补摘要） | 待做 |

## 8. 排障清单

- 症状：工具问用户要已有信息 → 查 `history.mjs` 是否有命中；没命中先看 omnihist 最后同步时间。
- 症状：`history.mjs` 报没有库 → `omnihist sync` 一次。
- 症状：同一决策两个版本 → 以 `decisions/` 最新 `date` 为准，旧记录用 `supersede:` 标记。
- 症状：上下文被撑爆 → 只取 L1 结论 + L2 片段，全文用 `show` 按需看。
