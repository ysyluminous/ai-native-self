# 从零开始：建自己的私有库，并让任何 AI 用上

> 目标：10 分钟内拥有一个只属于你的 Markdown 语料库，任何 AI 工具装上技能后都能读写它。

## 0. 两个仓库，别搞混

| 仓库 | 公开？ | 放什么 |
|---|---|---|
| `ysyluminous/ai-native-self`（本仓库） | 公开 | 方法、协议、脚本、模板 |
| 你自己的私有仓库（本页第 2 步生成） | **私有** | 你的决策、事件、实体、复盘、原文 |

公开仓库里没有任何个人数据；私有库永远不要公开。

## 1. 装内核

需要 Node 22+ 和 git。

```bash
git clone https://github.com/ysyluminous/ai-native-self.git ai-native-self-kernel
cd ai-native-self-kernel
```

国内网络直连 GitHub 不通时，给 git 配代理，例如
`git config --global http.proxy http://127.0.0.1:7897`。

## 2. 生成你的私有语料库

```bash
node scripts/init.mjs C:\work\my-life --priv private
```

- 会建 `inbox/ decisions/ entities/ reviews/ artifacts/ packs/ secret/ index/` 等目录
- 写好 `AGENTS.md` 和第一份月度倾倒文件
- 默认 `git init`，不会推任何远端
- macOS / Linux 把路径换成 `~/my-life`

## 3. 把技能装进你的 AI 工具

```bash
node adapters/install.mjs --vault C:\work\my-life --force
```

会自动装进：Claude Code、Trae、Trae CN、WorkBuddy、Cursor、Codex、OpenCode。
其他工具：把 `adapters/SKILL.md.tmpl` 渲染后的内容放进它的 skills 目录，或把安装脚本最后打印的常驻规则贴进设置。

## 4. 验证

1. 在任意已装技能的工具里开新会话，说：
   「记一下：我今天决定先用 Markdown 做唯一真相，不建数据库。」
2. 再问：「我之前定过什么？」
3. 它应该能引用刚写的那条，并给出 `inbox/YYYY-MM.<tool>.md` 的路径。

失败时按顺序查：

```bash
node scripts/check.mjs C:\work\my-life     # 结构体检
node scripts/search.mjs "Markdown" --vault C:\work\my-life   # 看索引是否活着
```

（`search.mjs` 等脚本默认读当前目录；在语料库里执行时不需要 `--vault`。）

## 5. 日常怎么用

| 场景 | 说法 | 背后 |
|---|---|---|
| 记一件事 | 「记一下：……」 | `capture.mjs` 追加到 `inbox/` |
| 查以前怎么想 | 「我以前怎么定的？」 | `recall.mjs` / `search.mjs` |
| 定完立刻共享 | 「归档这条决定」 | `push.mjs`（语料库脚本） |
| 看最近定了什么 | 「我最近定了什么？」 | `feed.py`（语料库脚本） |

写只走一个入口，别手改历史块；只追加，不改旧记录。

## 6. 可选：跨工具的完整历史

技能只让你读写语料库。要查「我在别的 AI 里说过什么」，再装对话采集器：

```bash
npm i -g github:ysyluminous/omnihist
omnihist sync
```

之后 `scripts/history.mjs "关键词"` 能查到 16 类工具的会话；`recall.mjs --history` 会把语料结论和对话原文一起给出。

## 7. 可选：PG16 共享层与每日飞轮

`docs/shared-memory.md` 和 `docs/flywheel.md` 写了参考实现：PG `mem` 文档/会话索引、每小时同步、每日摘要与自检。这部分需要 Python + psycopg；只为多机共享和自动化准备，最小用法不需要它。

## 8. 换机器

只 clone 私有库，再跑它自己的 `scripts/bootstrap.mjs`：

```bash
git clone --filter=blob:none --sparse https://github.com/<你的账号>/<私有库>.git C:\work\my-life
cd C:\work\my-life
git sparse-checkout set scripts decisions entities packs data artifacts inbox state
node scripts/bootstrap.mjs
```

它会自动拉公开内核、补目录链接、建索引、装技能、跑自检。

## 9. 三条硬规则

1. 私有库永远不公开；公开仓库里只放方法。
2. 不把令牌、密码、连接串写进任何 md。
3. 只追加，不改历史；要更正就写新记录并标注 `supersede:`。
