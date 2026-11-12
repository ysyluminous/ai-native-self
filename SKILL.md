---
name: ai-native-self
description: |
  Personal AI-native knowledge base: turn your own life — events, decisions, thoughts,
  health and money data — into git-versioned Markdown an AI can read, distill, and recall.
  Use when the user wants to log/record/dump daily events, archive a decision, run a weekly
  or monthly review, audit their own beliefs, look up something from their past, install or
  author a thinking-model pack (Munger, Nan Huaijin, Nian Haixia, or their own), back up or
  migrate their life data, or bootstrap a personal life-data repo.
  Triggers on: 「记一下」「今天…」「帮我决策」「这个怎么决定」「先开图」「周复盘」「月度信念审计」
  「把我的记录整理进库」「查我以前怎么想的」「装一个芒格模型包」「给XXX建一个包」「备份人生数据」
  「初始化我的人生仓库」, "log this", "file this", "should I decide", "review my week",
  "audit my beliefs", "back up my life data", "set up my life repo", "install a pack".
  Do NOT use this skill to answer a general question that has nothing to do with the user's
  own records, corpus, reviews, decisions-in-repo, or model packs. A pack invoked by name
  (e.g. 「用芒格的视角」) follows that pack's own dual-mode rules, not this skill's voice.
license: MIT
compatibility: Codex, Claude Code, Cursor, Gemini CLI, and other Agent Skills-compatible runtimes
metadata:
  author: ai-native-self
  repository: https://github.com/ysyluminous/ai-native-self
  version: 0.2.0
  storage: Markdown + git + grep (no DB, no embedding, no lock-in)
  layers: kernel(read-only) / corpus(user-owned) / packs(pluggable)
---

# AI-native self · 个人 AI 原生基座

> 一句话：**你只管倾倒，AI 负责归档、蒸馏、召回、质疑。**
> 这个 skill 只提供操作系统。思维内容来自可插拔的模型包，不绑定任何一个人。

## 先读：三层边界（不能混淆）

| 层 | 归谁 | 位置 | 可否被写 |
|---|---|---|---|
| **kernel 内核** | 本仓库维护者，版本化 | 本 skill 目录（只读） | 只读。用户 `git pull` 升级，数据不动 |
| **corpus 语料** | 用户所有，私有 git 仓库 | 用户指定的数据仓库 | 唯一真相源，纯 Markdown |
| **packs 模型包** | 维护者或用户自建 | `packs/<slug>/`（数据仓库内） | 借来的框架，**永不**写进 `beliefs/` |

派生物（日报、周报、索引、摘要）可以随时删除重建，**永远不是真相源**。
内核升级 ≠ 数据迁移：任何升级都不得要求用户重写已归档的记录。

## 使用边界与安全（先读）

- 本 skill 不是医疗、法律、投资、心理治疗服务。涉及身体指标、用药、法律义务、投资决策时，
  只给"框架 + 需要专业确认的清单"，并明确标注这一点。
- **AI 读不到 = 不存在**；但**AI 写下的推断 ≠ 用户的事实**。任何从语料推断出的结论都要标
  `inferred`，并在写入 `beliefs/` 前征得用户确认。
- 语料是用户一生中最敏感的数据。硬约束见 `PRIVACY.md`，核心三条：本地优先、绝不外发语料、
  `priv: secret` 的内容不进日报、不进索引、不进 git（默认）。
- 模型包（包括名人类）一律**不自动触发**；只有用户点名或显式说"用某个包"才启用。
  双模式与角色扮演的护栏由该包自己声明。
- 不允许用记录代替行动：每次复盘必须收敛到**一个可检查的动作 + 一个检查日期**。

## 禁止清单（违反即停止）

破坏性操作一律不做，除非用户当次明确要求并说明目标：

- `rm -rf`、`git reset --hard`、任何 `--force` 推送 —— 回滚一律用 `git revert`
- 把数据仓库推到**公开仓库**；语料只进私有远端
- 把密码、令牌、连接串写进任何文件（只读环境变量）
- 批量改写或删除 `inbox/` 历史块
- 静默跳过失败：出错必须报出来，不吞异常
## 启动（首次运行，三问后开工）

1. **数据仓库在哪**：让用户给一个本地路径（默认 `~/life`）。没有就创建。
   运行脚手架：`node <skill>/scripts/init.mjs <path>`，然后 `git init`。
2. **隐私默认值**：`priv` 缺省是 `private`（本地 git 提交）还是 `secret`（不提交）？默认 private。
3. **日节律时间**：用户什么时候愿意花 30 秒（如每晚 22:30）。记进数据仓库根的 `AGENTS.md`。

之后的所有协议都针对**那个数据仓库**执行。本 skill 目录只被读，不被写。
一次完整执行的记录可参照 `examples/council-run-2026-10-11.md`（检索→定性→探图→前提→顾问团→分歧表→落库）。

## 语料的六类一等公民

字段定义见 `kernel/record-types.md`，模板见 `templates/`。目录约定：

```
<life-repo>/
├── inbox/            # Event：唯一的倾倒入口，按半年一文件 inbox/2026-H2.md
├── entities/         # 人、组织、项目、资产、地点（一个实体一页）
├── decisions/        # 决策：一决策一文件，含可逆性、开图、最坏值、复盘日期
├── beliefs/          # 我自己的认知：带证据等级、confidence、推翻条件
├── artifacts/        # 产出：文章、代码、作品、教程（产出的索引，原文可外链）
├── metrics/          # 数字台账：体重、睡眠、支出、心率、收入…一行一观测
├── reviews/          # 派生物：daily/ weekly/ monthly/ quarterly/（可整目录删除重建）
├── attachments/      # 原件：截图、账单、手环导出、录音转写（可 .gitignore）
├── packs/            # 模型包：self/（我自己的编译产物）+ <slug>/（借来的）
├── secret/           # 默认 .gitignore 排除：不进 git、不进索引、不进日报
└── index/            # 派生索引（如 SQLite FTS），同样不进 git
```

规则：**一条记录一个块，块首是 front matter**。这让 `grep` 就能定位，不需要数据库。
命名：`YYYYMMDD-<slug>` 作为 id，全局唯一、可排序、可反链。
主题用 front matter 的 `topic:` 列表（不用 `#` 井号标签，避免与 Markdown 标题冲突）。

## 协议一 · 采集（capture）

细则见 `kernel/capture.md`。

**写入只走一个入口**：`node <skill>/scripts/capture.mjs "<内容>" --topic <主题>`。它负责算 id、
按月×工具分片、隐私路由（`--priv secret` 直写 `secret/`）、追加块、重建索引。不要手拼 front matter。

1. 用户说任何"记一下 / 今天…"→ 追加一条 Event 到当期 `inbox/` 文件末尾。**不要重写历史块。**
2. **20 秒规则**：一次倾倒超过 20 秒就是设计错误。不追问细节、不做评判、不要求填表。
3. 用户倾倒完，AI 在**同一次回复里**完成归档：分类、打 tag、补 `refs`，把出现的实体/决策/
   数字分别落进 `entities/ decisions/ metrics/`，然后回一句"已归档 3 条，1 个决策待补最坏值"。
4. 原件（截图、账单、转写）落到 `attachments/YYYY/`，Event 里只留一行摘要 + 路径。
5. 永远不要在 inbox 里做道德评价。inbox 是永久私密区。

## 协议二 · 归档与写入

- 写入前先看是否已有同 id / 同实体的记录：**按业务键合并，不重复建页**（`entities/张三.md`
  只有一页，追加观测而不是新建）。
- `decisions/` 只在用户真的做了决定、或明确说"帮我决策"时创建。想→做之间，用 `status: pending`。
- `beliefs/` 的写入必须满足：有证据等级 + 有推翻条件 + 用户确认过措辞。
  借来的框架（packs）只能以 `refs: pack:munger` 关联，不写进 beliefs。
- 每次写入后跑一致性自检（见最后）。

## 协议三 · 蒸馏（节律）

细则见 `kernel/cadence.md`。用户可直接说触发语。

| 节律 | 输入 | 产出 | 硬约束 |
|---|---|---|---|
| 日 | 30 秒倾倒 | 可选日报 | 日报是派生物，丢了不心疼 |
| 周 | 7 天 inbox | `reviews/weekly/` + 实体更新 | 必须输出 1 个可检查动作 |
| 月 | 4 周 + 到期决策 | `reviews/monthly/` + 信念审计 | 必须列出"本月被推翻的信念" |
| 季 | 全部语料 | `packs/self/pack.md` 重编译 | 必须与上季度 self 做 diff |

**季度 self 包**是本 skill 的核心机制：从实际记录里编译出"我这季度真的按什么活"，
而不是我以为的我。它与用户装的借来包并列存在、可比对、可冲突，但只有被行为反复验证的信念
才能进 self 包。

## 问题路由（用户只提问，不要让他先跑命令）

用户问一句话时，先判断，再自己调用；不要把命令丢回给用户。

| 问题 | 走哪 |
|---|---|
| 个人事实、决策、以前怎么想 | `scripts/recall.mjs` |
| 在哪个 AI 工具里说过/做过 | `scripts/history.mjs` |
| 智枢推文、CMS、素材、协调任务/决策 | `scripts/zhishu.mjs` |
| 曝光/分类/时间等统计 | 直接 SQL，不走检索 |
| 通用知识 | 不用检索 |

如果当前工具已接 `zhishu-search` MCP，优先调 `search` 工具；没有就运行对应脚本。查不到就说没找到，不要用模型常识补。

## 协议四 · 检索（grep 优先，无 DB）

**先用脚本，再退回 grep**：`scripts/search.mjs`（全文，中文二元切分）/ `scripts/q.mjs`（结构化：
到期决策、低置信信念、断链、secret 越界…）/ `scripts/recall.mjs`（"我以前怎么想的"）。
下面是它们的底层等价配方，脚本不可用时照抄；两者必须给出同样的命中。

约定与配方（全库检索默认排除派生物与私密区：`--exclude-dir=secret --exclude-dir=index --exclude-dir=.git`）：

- 按主题：`grep -rn "topic: .*money" inbox/ decisions/`
- 按时间：`grep -n "^date: 2026-10" inbox/*.md`
- 按实体：`grep -rln "张三" --include="*.md" .`
- 按反链：`grep -rn "refs:.*20261011-buy-house" --include="*.md" .`
- 低置信信念（待验证）：`grep -rn "^confidence: 0\.[0-4]" beliefs/`
- 到期决策：`grep -rn "review_on: 202" decisions/ | sort`
- 分层主题（`career/switch`）：`grep -rn "career/switch" --include="*.md" .`

回答"我以前怎么想的"这类问题时的**强制顺序**：先 grep 语料 → 找到就引用原文与 id →
找不到就明说"库里没有这条记录"，不得用模型常识补一个答案冒充用户的历史。
**报告 0 命中之前先跑阳性对照**：查一条你确定存在的 id，确认检索链路活着。

**对话原文**：如果问题是"我在哪个工具里说过 / 聊过 / 让哪个 AI 做过"，先跑
`node scripts/history.mjs "<问句>"`（读 omnihist 收进来的 16 类工具历史），或
`node scripts/recall.mjs "<问句>" --history`，把语料结论和对话原文一起给出。
两者都返回 `source` 和 `conversation id`；要看全文用 `omnihist show <id>`。
没有 omnihist 库时明说"对话库还没装 / 没同步"，不要假装查过。

**智枢业务数据**：推文、内容、案例、素材、选题、协调任务/决策，跑
`node scripts/zhishu.mjs "<问句>"`。服务在 `127.0.0.1:8765`，没起来就先启动
`D:\code\yunxiao\zhishu\search\run.py`。结构化统计（曝光、分类、时间）直接写 SQL，
不要绕检索。

## 协议五 · 决策

模板 `templates/decision.md`，结构件见 `kernel/principles.md`。流程：

1. **定性**：可逆（two-way door，快决）还是不可逆（one-way door，慢决）。不可逆 → 强制进入开图。
2. **开图**：列出需要的信息源与最小样本量（默认 ≥3 个独立来源），未达标只能得"暂缓"，
   不能得"就这样吧"。
3. **可控变量清单**：先列 100% 可控的，再谈外部条件。
4. **最坏值与可承受性**：写出最坏结果，以及"能承受吗"。不能承受 → 改方案，不改预期。
5. **前提检查**：睡眠、身体、现金流缓冲等执行前提不足时，结论降级为"待条件满足"。
6. **顾问团（可选）**：点名 2-4 个模型包，逐个套一遍，输出**分歧表**而不是平均结论。
   冲突必须显式呈现；不允许把互相矛盾的框架糊成一段正确的废话。
   两包给出相反结论时，**先查各包的裁决顺序**再决定谁先说话；顺序缺失或仍然平手 →
   把"两包在此分歧、且分歧取决于 <哪个假设>"本身作为结论报告给用户，不许代选。
7. **落库**：写 `decisions/YYYYMMDD-<slug>.md`，含 `review_on` 日期。到期自动进入月度审计。

## 协议六 · 模型包扩展（pack）

契约、必填字段、必备章节、禁止事项见 `packs/README.md`。要点：

- 新增一个包 = 用户说「给 XXX 建一个包」→ 按契约生成骨架 → 先声明需要的**材料等级**（A 原始可核验 /
  B 转述署名 / C 二手摘要），并说明只有 C 级材料时包会被标记为 `low-evidence`、不得用于决策依据。
- **装官方包**（`munger`、`bayes` 等随 skill 发布的包）：它们是**数据文件**，要复制进用户的数据仓库，
  不是独立 skill —— `cp -r <skill_root>/packs/bayes ~/life/packs/`。复制后包与语料同仓库、同备份、
  同一次 `git log` 可审计。升级 = 覆盖目录 + 在下次月审里主动对比新旧版本；已归档记录仍写当时的
  `pack:<slug>@<version>`，**历史不改写**。
- 每个模型必须四件套：一句话、证据（带等级）、应用条件、**失效条件与反例**。缺失效条件不许入库。
- 每个包必须有「诚实边界」章节：利益立场、时代局限、不可外推领域、二创污染。
- 包不得自动触发、不得写进 beliefs、不得把未证实数字当事实、不得作群体化断言。
- **证据等级 A 的两种含义不得混用**：人物/学派包的 A = 逐字可核的原件；
  方法/工具包的 A = 引文条目可定位（刊名/卷/页/DOI 一致），**不等于原文已读**。见 `packs/README.md`。
- `kind: method|tool|self` 的包**只有分析者模式**，不扮演任何人（契约第 6 条）。
- 入库要附 **lint 12 项 pass 记录**与压力测试 3 问结果；有冲突的包必须给**裁决顺序**，
  否则顾问团会在真分歧上卡住（例：`bayes` 与 `munger` 在"太难该不该放下"上的四步规则）。

## 协议七 · 备份与可移植

- 默认：数据仓库是**私有** git 仓库。远端由用户自己配（做法：私有 GitHub + 一个异地副本）。
- 每次季度审计做一次**恢复演练**：`git clone` 到临时目录，跑一遍 grep 配方，确认可读。
  没做过恢复演练的备份不算备份。
- 换 runtime/模型：只需把 skill 仓库重新 clone 到新位置，数据仓库不动。
- 导出：所有数据都是 UTF-8 Markdown，纯文本可被任何工具读；`attachments/` 原件保留原始格式。
- 明确不做：不上传到任何第三方服务、不做云端同步、不做账号体系。

## 一致性自检（每次批量写入后）

一条命令：`node <skill>/scripts/check.mjs`（`FAIL` 阻断提交，`WARN` 只提示节律与派生层；
`--selftest` 自带阳性对照）。下面是它执行的规则，脚本不可用时照此手工做一遍。

1. id 唯一：`grep -rho "^id: .*" --include="*.md" --exclude-dir=secret --exclude-dir=index . | sort | uniq -d` 应为空。
2. 孤儿反链：`refs` 指向的 id 是否存在。
3. `review_on` 是否落在未来（pending）或已被复盘（done）。
4. `beliefs/` 里每条都有 `falsifier`（推翻条件）与 `evidence`。
5. 派生物目录（`reviews/`）没有成为任何 `refs` 的目标（真相源不能依赖派生物）。
6. 阳性对照：自检脚本自己也要验证——先故意查一条已知存在的记录，确认检索链路活着，
   再报告"0 命中"。

## 已知失败模式与对策（这个 skill 真正在解决的问题）

| 坑 | 对策 |
|---|---|
| 摩擦太大，两周放弃 | 单一入口 + 20 秒规则 + AI 代劳归档 |
| 不知道记什么 | 8 个固定槽位，允许只填一个 |
| 记了不读，变成坟场 | 周/月/季是硬约束，复盘不出动作视为未完成 |
| 一上来搭大系统 | v0 只准用 inbox；第 4 周才开 decisions/beliefs |
| 工具锁定，换 AI 就丢 | 纯 Markdown + git，派生物可重建 |
| AI 顺着我说，强化幻觉 | 强制失效条件、分歧表、月度"被推翻信念"清单 |
| 隐私焦虑 | 本地优先 + secret 不入库 + `PRIVACY.md` 硬约束 |

## 版本与升级

- 内核与契约走 semver，见 `CHANGELOG.md`。语料 schema 只做**向后兼容**追加字段；
  破坏性变更必须附带迁移脚本，且不删用户数据。
- 已发布模型包升级不影响已归档记录（记录里保存的是当时的 `pack@version` 引用）。
