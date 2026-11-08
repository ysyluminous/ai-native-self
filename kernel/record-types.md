# 内核 · 记录类型与字段（schema v0.1）

> 语料的六类一等公民。字段写在 front matter 里（YAML），正文自由。
> 只做**向后兼容**追加：新增字段不得让老记录失效。

## 通用字段（id/type/date/topic/priv 必填，其余可空）

```yaml
id: 20261011-buy-house        # YYYYMMDD-slug，全局唯一
type: event|entity|decision|belief|artifact|metric
date: 2026-10-11
topic: [money, career]        # 小写，单数，用 / 分层：career/switch
priv: public|private|secret   # 缺省 private
refs: ["[[20261003-negotiation]]", "pack:munger@0.1.0"]
```

**类型差异**（模板已按此实现）：
- `Entity` 用 `created` / `updated`，不用单个 `date` 表示内容时间。
- `Belief` 用 `sources` 承担反链职责（等价于 refs）。
- `Metric` 台账豁免 `confidence` / `review_on`；其 `date` 是台账建立日，观测日期写在正文行内。
- 主题一律用 front matter 的 `topic:` 列表，不用 `#` 井号标签。

- `priv: public` 可用于生成对外内容；`private` 进本地私有 git；**`secret` 不进日报、不进检索索引、不进 git**。
- **secret 的位置规则**（重要）：`.gitignore` 只排除整个 `secret/` 目录，不会识别散落在 inbox 里的
  `priv: secret` 块。因此**secret 内容只能写在 `secret/` 目录下**，其它目录只允许留一行指针块
  （`refs: ["[[sec-017]]"]` + 一句非敏感描述）。
- `refs` 用 `[[id]]` 反链；跨仓库引用用 `pack:<slug>`。
- 布尔类字段统一用 `verified: true|false`、`status: <枚举>`，不要留空表示假。

---

## 1. Event（`inbox/`）

倾倒入口。**追加，不改写历史块。**

```yaml
id: 20261011-e12
type: event
date: 2026-10-11
slot: changed|decided|misjudged|avoided|body|learned|next|free
topic: [health/sleep]
priv: private
refs: []
source: text|voice|screenshot|import
```
正文：一到五行，原话优先，不修辞。有原件时正文只留摘要 + `file: attachments/2026/xxx.jpg`。

## 2. Entity（`entities/`）

人、组织、项目、资产、地点。**一个实体一页，观测追加不新建。**

```yaml
id: ent-zhangsan
type: entity
kind: person|org|project|asset|place
name: 张三
topic: [work]
priv: private
```
正文：`## 事实`（带日期与证据等级）/ `## 我的判断（inferred）` / `## 交互记录`（倒序追加）。
他人隐私默认 `priv: secret`；不记录未经同意的第三方信息。

## 3. Decision（`decisions/`）

```yaml
id: 20261011-buy-house
type: decision
date: 2026-10-11
question: 要不要在 X 城市买房
reversibility: one-way|two-way|unverified
confidence: 0.6
status: pending|decided|blocked-on-precondition|done|overturned
sources_opened: 3        # 探图数量，默认要求 >=3
samples: 12              # 实际样本（看了几套/聊了几人）
packs_consulted: [munger, self]
worst_case: 现金流锁死 18 个月，机会成本是放弃 Y
tolerable: false
cost_of_not: 继续租房，放弃学区与装修自由，保留迁移能力
review_on: 2027-04-11
```
正文：可控变量三栏 / 预演失败（这决定一年后失败了，最可能因为什么）/ 分歧表 / 结论与单一动作。

## 4. Belief（`beliefs/`）

**只放用户自己的认知。** 借来的框架通过 `refs: pack:<slug>` 关联，不写进这里。

```yaml
id: bel-023
type: belief
claim: 我在deadline前48小时的产出质量高于长期项目
kind: observation|preference|hypothesis
evidence: B            # A/B/C
sources: ["[[20260920-e04]]", "[[20261002-e11]]"]
confidence: 0.55
falsifier: 若两个长期项目连续复盘显示同等质量，则降级
last_tested: 2026-10-11
status: held|challenged|overturned|retired
```
月度审计的输入就是这张表。被推翻（overturned）的记录**不删除**，它是产出。

## 5. Artifact（`artifacts/`）

产出索引：文章、代码、教程、作品、演讲。

```yaml
id: art-014
type: artifact
name: ai-native-self v0
kind: article|code|video|talk|tool
url: ""            # 或本地路径
published: 2026-10-11
outcome: {views: 0, feedback: ""}   # 允许空，但复盘时补
```

## 6. Metric（`metrics/`）

**一行一观测，不要做成宽表**（宽表让 grep 失效、让补录变痛苦）。
台账文件：`metrics/<name>.md`，例 `metrics/body-fat.md`。

```markdown
---
id: met-body-fat
type: metric
date: 2026-10-01
topic: [health/body]
priv: private
unit: percent
source: 智能秤照片 attachments/2026/10/scale.jpg
verified: true
---

# body-fat

- 2026-10-01 26.4
- 2026-10-11 25.8
```

需要结构化时（派生索引、SQLite FTS）由外部脚本从 Markdown 重建，**索引文件不写回语料**。

---

## 目录外的例外

- `packs/self/pack.md`：季度编译产物，但它是**真相源**（用户认知模型的历史），不删。
- `reviews/`：纯派生物，可整目录删除重建；不得被 `refs` 指向。
- `attachments/`：原件。默认提交；体积大或含敏感信息时可 .gitignore，此时 Event 必须标
  `verified: false`（因为原件不在库里，只剩自述=B 级）。
