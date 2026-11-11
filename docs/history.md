# 对话召回：把 16 类 AI 工具的历史接进 kernel

kernel 原本只查语料库（Markdown 里的决策、信念、事件）。加上 `scripts/history.mjs` 后，
它还能查你和各个 AI 工具的真实对话。

## 三层分工

| 层 | 仓库 | 放什么 | 谁写 |
|---|---|---|---|
| 对话原文 | `omnihist`（`ysyluminous/omnihist`） | Claude Code、Codex、opencode、WorkBuddy、Qoder、OpenMausBot、DSH、Grok Bot、TRAE 等 16 类工具的会话 | 只读采集 |
| 个人语料 | `ai-native-self`（私有 vault） | 决策、信念、事件、实体、复盘 | 你 + AI 归档 |
| 方法 / 接口 | `ai-native-self-kernel`（本仓库） | 协议、模板、`search.mjs` / `recall.mjs` / `history.mjs` | 维护者 |

`ai-native-self` 通过 `vendor/omnihist` 子模块跟踪上游；升级用
`git submodule update --remote vendor/omnihist`。

## 安装

```bash
npm install -g github:ysyluminous/omnihist
omnihist scan
omnihist sync
```

`omnihist` 会把会话写进 `~/.omnihist/omnihist.db`（SQLite + FTS5，单文件）。

## 使用

```bash
# 只查对话
node scripts/history.mjs "协调库为什么改成五段"

# 对话 + 语料一起查
node scripts/recall.mjs "协调库" --history

# 指定来源 / 条数
node scripts/history.mjs "缓存键" --source codex --limit 5
```

返回 `source`、时间、标题、命中片段和 `conversation id`；看全文：

```bash
omnihist show <conversation-id>
```

## 深度整理（可选）

如果要做跨文档多跳检索和带引用的回答，把对话导出成 Markdown，交给 SAG Wiki：

```bash
omnihist export --all --out ~/omnihist-md
```

在 SAG Wiki 里添加 `~/omnihist-md` 和你的 vault 文件夹。SAG Wiki 用 SAG2
（BM25 + 证据判断），建库不调 LLM、不生成 embedding，结果保留原文位置。
它同时提供 CLI 和 Agent Skill，Claude Code / Codex / OpenCode 都能接。

## 边界

- 对话库只在本机，不上传；默认对常见密钥做脱敏。
- TRAE 的完整聊天库是加密的，只能读它的 session memory。
- 对话是「当时说过什么」，不等于「后来定了什么」；决策仍以 `decisions/` 里的记录为准。
