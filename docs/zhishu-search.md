# 智枢检索：推文、案例、协调、对话

kernel 现在多了一个检索入口，查的是智枢的业务数据，不是 Markdown 语料。

## 服务

```bash
cd D:\code\yunxiao\zhishu\search
python run.py
```

默认 `http://127.0.0.1:8765`，同时提供 REST 和 MCP。

## 命令行

```bash
node scripts/zhishu.mjs "eSIM 怎么开"
node scripts/zhishu.mjs "决策" --json
```

## 覆盖

- X 推文 19,793 条
- 内容库 21,216 条
- 案例 1,907 × 2
- 协调库：思路 / 方案 / 任务 / 决策
- AI 工具对话 2,481 个会话（omnihist）

## MCP

```bash
claude mcp add --transport http zhishu-search http://127.0.0.1:8765/mcp
```

工具：`search`、`get_document`、`stats`、`chat`。

## 和 history / recall 的分工

| 问什么 | 用哪个 |
|---|---|
| 我以前说过/定过什么 | `recall.mjs --history` |
| 我在哪个 AI 工具里聊过 | `history.mjs` |
| 智枢里哪条推文/案例/素材 | `zhishu.mjs` |
| 结构化统计（曝光、分类、时间） | 直接 SQL，不走检索 |

MySQL 5.7 还没接，计划先只读、再迁 PG16。详见 `zhishu/search/PLAN.md`。
