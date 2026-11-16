# 数据飞轮：每天自检，持续打通

> 2026-11-13 · 内核方法文档
> 目标：打开任何 AI 工具，只装 `ai-native-self-kernel`，就能自动用上帖子、会话、摘要、记忆、本地 md、结构化库；以后再加向量和图谱。

## 1. 边界

| 仓库 | 角色 | 放什么 | 不放什么 |
|---|---|---|---|
| `omnihist`（公开） | 子技能 / 采集器 | 16 类工具的适配器、同步方法、MCP | 任何个人内容 |
| `ai-native-self-kernel`（公开） | 唯一入口 | 协议、检索脚本、setup、飞轮自检 | 个人语料、账号、路径数据 |
| `ai-native-self`（私有） | 数据 | 决策、事件、实体、复盘、摘要、同步脚本 | 公开方法 |

`omnihist` 以 npm 依赖 + 文档引用的方式接进内核，不把它的代码复制进公开内核，也不把个人数据放进公开仓库。

## 2. 飞轮的四条链路

```
① 采集            ② 归一            ③ 索引              ④ 使用
omnihist ───────▶ SQLite 会话库 ───▶ PG mem.conv ───▶ recall / history
vault md ───────▶ Markdown 真相 ───▶ PG mem.doc  ───▶ search / q
zhishu 业务 ────▶ PG zhishu/coord ─▶ search_docs ───▶ zhishu.mjs
                                                         │
                                          ⑤ 写回 capture.mjs / decisions
                                                         │
                                                      回到 ①
```

## 3. 主动推送 + 定时增量

两条路互补：

| 方式 | 触发 | 延迟 | 用途 |
|---|---|---|---|
| 主动推送 `push.mjs` | 刚定完结论/方案 | 秒级 | 让下一个工具立刻看到 |
| 定时增量 `sync-all.ps1` | 每小时 | ≤1 小时 | 兜底、补漏 |

主动推送做三件事：写语料库（Markdown 真相）→ 刷 PG `mem.doc` → 打印刚写入的那条。
配套查询 `feed.py` 只列最近 72 小时的文档和会话，别的工具问“我最近定了什么/最先做什么”时先跑它。

```bash
node scripts/push.mjs "决定：智枢用 buildd 推送，但先不执行" --tool mausbot --type decision --topic zhishu,buildd
python scripts/feed.py --limit 10
```

## 4. 当前状态（2026-11-13）

| 数据 | 采集 | 索引 | 查询 | 状态 |
|---|---|---|---|---|
| 会话 | omnihist sync（16 类工具） | SQLite + `mem.conv` 元数据 | `history.mjs` | ✅ |
| 记忆/决策 | vault Markdown | `mem.doc` + 全文索引 | `search.mjs` / `recall.mjs` | ✅ |
| 帖子/内容 | 智枢 PG | `cms.search_docs` 117,454 条 | `zhishu.mjs` | ✅ |
| 结构化业务 | zhishu / coord PG | 直查 | SQL | ✅ |
| 定时任务定义 | WorkBuddy / OpenMausBot / Windows | `mem.task` + `state/tasks` | `tasks.py list` | ✅ |
| 向量 | — | 计划 pgvector + BGE-M3 | — | ⏳ |
| 图谱 | — | 计划 `mem.entity` / `mem.edge` | — | ⏳ |

规模参考：会话 2,586 个 / 75,310 条消息；文档 109 条；检索文档 117,454 条。

## 4. 每天的自检

`scripts/flywheel.py` 每天 07:30 跑四项：

1. omnihist 最新会话时间（>26h WARN，>72h FAIL）。
2. 用已知事实 `pdb-pg` 做 `history.mjs` 冒烟，0 命中即 FAIL。
3. 语料体检（`check.mjs`）：FAIL 数只记 WARN，因为历史语料有存量债务。
4. PG `mem` 可达、文档/会话数正常（>72h 滞后 WARN）。

输出：`state/flywheel/YYYY-MM-DD.md`，一行结论 PASS/FAIL + 每项证据。
FAIL 退出码 1，方便以后挂到别的调度器。

## 5. 一条命令装好

```bash
node scripts/setup.mjs --vault "<?????>" --install-deps --tasks
```

它做五件事（幂等）：

1. 检查 Node ≥22 与语料库目录。
2. 检查/安装 `omnihist`。
3. 把技能装进 Claude Code、WorkBuddy、Cursor、Codex、Trae。
4. 首次 `omnihist sync` + 同步到 PG `mem`。
5. Windows 下注册三个计划任务：每小时同步、每天 07:00 摘要、每天 07:30 飞轮自检。

## 6. 每次任务结束的写回

出现下面任一情况，结束前必须 `capture.mjs`：

- 定了方案、取舍、边界 → `decision`
- 跑通可复用流程 → `artifact`
- 发现用户偏好/纠正 → `event`
- 产出文件 → `artifact`（写绝对路径）

不写回，飞轮就只进不出，下一次还要重新问。

## 7. 失败处理顺序

1. `omnihist sync` 是否成功、`omnihist stats` 的 last 是否当天。
2. `sync-mem-pg.py` 是否连上 PG；`mem.doc` / `mem.conv` 是否增长。
3. `history.mjs "pdb-pg"` 是否有命中。
4. `check.mjs` 的 FAIL 是否新增（存量 55 项属于语料债务，单独清理）。
5. 三个计划任务是否 Ready、上次结果是否 0。

## 8. 后续阶段

- P3：`MEM_PG_DSN` 指向 `pdb-pg` 的 `mem` 库，跨机共享。
- P4：向量检索（BGE-M3 + pgvector，先文档后会话）。
- P5：图谱（实体/关系抽取，`mem.entity` / `mem.edge`）。
- P6：反馈闭环（命中/未命中写回，自动补摘要）。
