# Changelog

遵循 [Keep a Changelog](https://keepachangelog.com/) 与语义化版本。
**向后兼容承诺**：语料 schema 只做追加式字段新增；破坏性变更必须提供迁移脚本且不删除用户数据。

## 0.1.0 — 2026-10-11

首个可用版本：框架 + 扩展契约，不含任何人物模型包。

### Added
- `SKILL.md`：七段协议（采集 / 归档 / 蒸馏 / 检索 / 决策 / 模型包 / 备份）+ 一致性自检。
- `kernel/principles.md`：12 条**中立结构件**，每条带失效条件；含"内核如何批评模型包"的优先级规则。
- `kernel/record-types.md`：六类一等公民（Event/Entity/Decision/Belief/Artifact/Metric）与字段差异。
- `kernel/capture.md`：20 秒规则、8 个槽位、多通道、隐私分级、反羞耻条款、**12 周冷启动时间表**。
- `kernel/cadence.md`：日/周/月/季节律；季度 `packs/self/` 编译与恢复演练（"没演练过的备份不算备份"）。
- `packs/README.md`：模型包契约 v0.1 — 必填 front matter、8 个必备章节、12 项 lint、
  特殊领域强制护栏（医学/修行/投资/两性）、low-evidence 降级规则、建包流程与压力测试。
- `packs/registry.md`：官方包登记表（仅 `self` 与 `_template` 已发布；其余明确标为计划中）。
- `packs/_template/pack.md`：自建包骨架。
- `templates/`：8 份记录模板，与 schema 字段一一对齐。
- `scripts/init.mjs`：零依赖、**幂等**脚手架；生成语料仓库骨架 + `AGENTS.md`（内含硬约束、
  装包与 lint 命令）+ `.gitignore`（排除 `secret/`、`index/`）。
  **本轮实测修掉一个真 bug**：`--time` 未传时 `opt('time')` 二次取值返回 undefined，
  导致生成的 `AGENTS.md` 与提示行写成"每晚 undefined 倾倒"；现在三种输入（缺省 / `07:15` / 非法值）
  都实测正确，且第二次运行仍是 0 覆盖。
- `scripts/lint-packs.mjs`：包**结构** lint（零依赖）。查字段齐全 / `auto-trigger: false` /
  `domain-na` 非空 / 8 个必备章节 / 四件套数量与模型数一致 / 启发式条数 / 压力测试 ≥3 /
  lint 表 12 行无 fail / 有冲突必有裁决顺序 / method 包不得有扮演模式 / **registry ↔ 磁盘一致**。
  自带 `--selftest` 阳性对照（4 处人为破坏必须全部报出、原文必须全 pass）——
  这一版就在自检下暴露了两个自己的 bug：`[]` 被当成非空列表、`exec` 结果当正则用。
- `PRIVACY.md`：本地优先、零外发（含联网 query 限制）、secret 位置规则、删除权与 git 历史的诚实说明。
- `NOTICE.md`：设计灵感出处（三点主张的中立化改写）、人物包版权与姓名权规则、非专业建议声明。
- `packs/munger/pack.md` + `sources/links.md`：第一个真实模型包（6 模型 / 7 启发式 / 双模式 /
  冲突表 / 材料清单 / financial 护栏 / 3 问压力测试）。证据等级 **B**；未核金句标 `verified: false`；
  流传甚广但查不到原始出处的争议言论**按契约不收录**，并在诚实边界里写明原因。
- `packs/bayes/pack.md` + `sources/links.md`：第二个包，`kind: method`（**没有扮演模式**，只有分析者模式）。
  6 模型（信念度可下注性检验 / 更新必须由新证据支付 / 外部视角与参照类 / 概率颗粒化 /
  **Brier 分数校准协议** / 时间平均≠期望值）+ 10 条启发式 + 与 `munger` 的**四步裁决规则**。
  证据等级 **A**，含义按契约写明：引文条目可定位（Brier 1950、Tversky & Kahneman 1974、
  Buehler-Griffin-Ross 1994、Bayes 1763、Peters 2011、arXiv:1405.0585），**不含逐字核对原文**。
  包内自设的工程参数（n≥20、步长 ≤0.2）全部标 `verified: false`；
  二手流传的实验数字（37 名学生、错误率 20-50%、事前验尸 30%）一律**拒收为事实**。
- 契约补三处（都是这两个包暴露出来的洞）：
  ① `packs/README.md` 定义**两种 A 级不得混用**（人物包的 A=逐字原件；方法包的 A=引文可定位≠原文已读）；
  ② 必备章节第 7 条从"冲突表"扩为"**冲突表 + 裁决顺序**"，lint 第 10 项同步；
  ③ `_template/pack.md` 增补 lint 12 项自检表与 `status` 字段；两个真包也各自补了自检表。
- `SKILL.md` 协议五第 6 步：顾问团遇相反建议时先查裁决顺序，顺序缺失或平手则**把分歧本身作为结论**上报，
  不许代选；协议六补等级与裁决顺序要求。
- `examples/`：可复现样例 —— 一次完整顾问团执行记录（含实测 grep 输出与阳性/负对照）+ 演示语料仓库。
  新增 `life-repo/metrics/calibration.md`（`bayes` 的概率台账：`- 日期 pred: due: res: 命题`，
  派生分数不写进语料）；那次顾问团只跑了两方（`munger + self`），文末的三方对撞**明确标为推演、未实测**。
  复现提示改为**实测 4 条**命中，并解释为什么历史文档里的"应命中 2 条"是错的（追加式语料会变长）。

### Known gaps（v0.1 明确没做）
- 没有 `backup.mjs`（远端配置与恢复演练目前靠协议文字约束）。
- 没有索引脚本（按冷启动时间表，第 12 周之前不需要）。
- 没有 `README_EN.md`。
- 内容包只有 2 个：`munger`（B 级）、`bayes`（方法包）。`nan-huaijin` / `ni-haixia` / `alan`
  仍在 `packs/registry.md` 的**计划中**区，缺 A/B 级材料就不发布。
- `examples/council-run-2026-10-11.md` 是在 `munger + self` 下真跑的一次；**加入 `bayes` 后的三方顾问团
  尚未实跑**，四步裁决规则目前只有契约推演，没有执行记录。
- 未在 Codex/Claude Code/Cursor/Gemini CLI 四家 runtime 上逐一实机验证装载行为。

## 2026-10-18 - 结构 v2：X 域八件套迁入 自媒体/X/（详情见 inbox e60）

## 2026-10-19 - 人物库上线：人物.md 索引 + packs/sun-yuchen 0.1.0（详情见 inbox e64）
