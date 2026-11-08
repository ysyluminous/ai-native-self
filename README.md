# ai-native-self · 个人 AI 原生基座

> 「AI 只能读懂机器读得懂的东西。没被 AI 读到的记录，等于不存在。」

**把你自己的思想、决策、吃喝拉撒，变成 AI 读得懂、蒸馏得动、换模型也能接手的语料。**
这不是笔记软件，是一个**只给你自己用的认知流水线 + 可插拔的思维框架插槽**。

纯 Markdown + git。没有数据库、没有向量库、没有账号、没有云。

- 读法：`SKILL.md` 是协议，`kernel/` 是硬规则，`templates/` 是字段模板
- 用法：clone 下来，一条命令生成你自己的私有语料仓库，然后只管往里倾倒

---

## 30 秒理解

| 传统 PKM / 云端 AI 记忆 | ai-native-self |
|---|---|
| 你负责整理、分类、打标签 | 你只管倾倒，AI 负责归档（20 秒规则） |
| 记了就躺在文件夹里 | 日 / 周 / 月 / 季硬节律蒸馏，复盘不出动作视为未完成 |
| 存在某家云上，换工具就丢 | 纯 Markdown + 你自己的私有 git，换模型也能接手 |
| AI 记忆在它那边，不可审计 | 每条断言带证据等级、置信度、推翻条件 |
| 内置一套"正确"的方法论 | 内核中立：思维内容是可插拔的模型包 |

一句话：**别的工具帮你把别人蒸馏成 skill，这个项目帮你把自己蒸馏成语料。**

## 三层架构：职责不混

```
L0 kernel  内核（本仓库，公开，只读）     结构件 / 采集协议 / 节律 / schema / 隐私护栏
L1 corpus  语料（你的私有仓库，不在这）   唯一真相源，六类记录，UTF-8 Markdown
L2 packs   模型包（可插拔）              self（自己编译的）+ 借来的框架
派生物      reviews/ index/             随时删除重建，永远不是真相源
```

**内核给裁判规则，包给裁判结论。冲突时结构件优先。**

这个仓库只装 L0。你的数据在你自己的仓库里，永远不进这里 —— 这是它能公开的唯一原因。

## 安装

```bash
# 方式一：作为 Agent Skill 安装（Codex / Claude Code / Cursor / Gemini CLI / opencode）
npx skills add ysyluminous/ai-native-self

# 方式二：直接 clone 到 skill 目录
git clone https://github.com/ysyluminous/ai-native-self ~/.codex/skills/ai-native-self
```

然后在任何目录生成你自己的语料仓库：

```bash
node ~/.codex/skills/ai-native-self/scripts/init.mjs ~/life --time 22:30
```

脚手架是**幂等**的：不覆盖任何已有文件，重复跑只会补缺。

## 五分钟上手

```bash
cd ~/life
git init
```

打开 agent，说：

```
记一下：今天跟供应商谈崩了，对方要预付 50%，我没答应
```

它会做三件事，在同一条回复里：

1. 在 `inbox/2026-H2.md` 追加一条 Event（不追问、不评判）
2. 把出现的实体、决策、数字分别落到 `entities/ decisions/ metrics/`
3. 回一句进度：「已归档 3 条，1 个决策待补最坏值」

之后每天 30 秒倾倒，第四周说「周复盘」，第十二周说「季度编译我」。
节律写在 [`kernel/cadence.md`](kernel/cadence.md)：复盘不收敛到一个可检查的动作 + 一个检查日期，就算没做完。

## 目录结构

```
<你的语料仓库>/
├── inbox/          Event：唯一倾倒入口，半年一文件，只追加
├── entities/       人、组织、项目、资产、地点（一个实体一页）
├── decisions/      一决策一文件：可逆性、开图、最坏值、复盘日期
├── beliefs/        你自己的认知：证据等级、confidence、推翻条件
├── artifacts/      产出：文章、代码、作品
├── metrics/        数字台账：体重、睡眠、支出、心率，一行一观测
├── reviews/        派生物：日 / 周 / 月 / 季
├── attachments/    原件：截图、账单、录音转写
├── packs/          模型包：self/ + 借来的
├── secret/         默认 git 排除：不进 git、不进索引、不进日报
└── index/          派生索引，可删可重建
```

字段定义在 [`kernel/record-types.md`](kernel/record-types.md)，空白模板在 [`templates/`](templates/)。

## 六类一等公民

| 类型 | 回答什么问题 | 关键字段 |
|---|---|---|
| Event | 那天发生了什么 | 时间、原文、refs |
| Decision | 我怎么定的，能不能反悔 | 可逆性、最坏值、review_on |
| Entity | 这个人/项目到哪一步了 | 关系、状态、最近接触 |
| Belief | 我凭什么这么想 | 证据等级、置信度、**推翻条件** |
| Metric | 身体和钱到底怎么走的 | 指标、值、单位、测量方式 |
| Artifact | 我做出过什么 | 标题、外链、关联决策 |

每条记录一个块，块首是 YAML front matter —— 所以 `grep` 就能定位，不需要数据库。

## 思维框架是可插拔的

官方随仓库带两个包，复制进你的仓库就能用：

```bash
cp -r packs/bayes ~/life/packs/
cp -r packs/munger ~/life/packs/
node scripts/lint-packs.mjs ~/life      # 结构自检，12 项
```

包的登记与限制见 [`packs/registry.md`](packs/registry.md)：证据等级是 B 的包不得当逐字引语，
带失效条件的包才收。想建自己的包，从 [`packs/_template/pack.md`](packs/_template/pack.md) 开始。

## 可测评 · 可迭代

这个仓库自己给自己打分：

```bash
node scripts/score.mjs          # 九维结构分，0–100
node scripts/score.mjs --min 85 # 低于阈值退出码 1，可挂 CI
node scripts/init.mjs /tmp/demo --no-git   # 冒烟：能不能生成一套干净仓库
node scripts/lint-packs.mjs examples/life-repo
```

**分数只升不降。** 每轮只改一个维度，改完独立评分，涨了保留、掉了 `git revert`。
完整规则见 [`docs/evolution.md`](docs/evolution.md)。当前基线写在里面，随时可复算。

## 它不做什么

- 不帮你写内容，不替你判断，不替你决定 —— 它只保证你的记录被诚实读到
- 不联网、不上传、不做 embedding、不调用任何第三方服务
- 不内置任何"正确"的价值观；名人类的包不自动触发
- 不替代医生、律师、投资顾问；涉及这些领域只作思路框架

## 隐私

硬约束见 [`PRIVACY.md`](PRIVACY.md)：本地优先、绝不外发语料、`priv: secret` 不进日报/索引/git。
这个仓库本身不含任何个人数据；你在自己的私有仓库里写的一切，也永远不会回到这里。

## 贡献

- 改规则：每条断言必须带**证据等级**与**推翻条件**，缺了不收
- 改 schema：必须向前兼容，并在 [`CHANGELOG.md`](CHANGELOG.md) 写迁移说明
- 改模板：与 `kernel/record-types.md` 在同一个提交里改
- 提交前：`node scripts/score.mjs --min 85` 必须过；动过 `packs/` 规则的话，再在自己语料仓库上跑一次 `node scripts/lint-packs.mjs <你的语料仓库>`
- 样例必须虚构；真实用户数据不许进 `examples/`

细读 [`AGENTS.md`](AGENTS.md)，那是给 agent 的贡献指南。

## 许可证

MIT。见 [LICENSE](LICENSE)。

评测与进化机制受 [darwin-skill](https://github.com/alchaincyf/darwin-skill)（MIT）与微软研究院
SkillLens / SkillOpt 的思路启发，用于本项目的结构评分与棘轮回滚。
