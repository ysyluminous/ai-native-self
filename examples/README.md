# examples · 可复现的实测样例

| 文件 | 是什么 |
|---|---|
| `council-run-2026-10-11.md` | **一次完整执行记录**：先 grep 我自己的历史 → 定性可逆性 → 探图复核 → 最坏值 → 前提检查 → 顾问团（munger + self）→ 分歧表 → 单一动作 → 落库 diff。里面标 `[实测]` 的命令输出是真跑过的。 |
| `life-repo/inbox/2026-H2.md` | 4 条 Event（含 AI 归档后的 refs 与 slot） |
| `life-repo/decisions/20261011-buy-house.md` | 一条 one-way 决策，含顾问团结论与裁决规则 |
| `life-repo/beliefs/bel-023.md` | 一条 `challenged` 信念，带 falsifier |
| `life-repo/metrics/body-fat.md` | 一行一观测；原件未入库故 `verified: false` |
| `life-repo/metrics/calibration.md` | **`bayes` 包的落地格式**：我说过的概率 vs 现实结果，固定行语法 `- 日期 pred: due: res: 命题`；未到期写 `res:-`，分数由月审现算不入库 |
| `life-repo/packs/self/pack.md` | 季度编译产物示例格式（3 条样本 → 自动标 `low-sample`） |

## 诚实说明（请先读）

- **语料是虚构的**：人物、房价、面试、体脂数字都不存在。真实用户数据永远不进这个仓库。
- **执行是真的**：`grep` 配方、id 唯一性自检、阳性/负对照、`secret/` 的 git 排除行为，
  都在本机 `init.mjs` 生成的真实仓库上跑过（见 `council-run` 的 `[实测]` 段）。
- `packs/munger@0.1.0` 的证据等级是 **B**（第三方转载讲稿，纸本页码未核），
  所以这份样例**故意**没有引用任何"芒格金句"作逐字引语——这是契约在生效，不是遗漏。
- 那次顾问团只跑了 **`munger + self` 两方**（`bayes` 包在那之后才建）。
  **三方对撞尚未实跑**，因此这里不假装跑过；`bayes` 会追问的两件事（参照类分布、
  "我判断不了"要不要记成带截止日的假设）写在它的四步裁决规则里，不是写在结果里。
  想看它的落地格式就用 `metrics/calibration.md`——那份语料是虚构的，行语法是真的。

## 自己复现一遍

```bash
node ../scripts/init.mjs ~/life                       # 生成你自己的空仓库
cp -r examples/life-repo/{inbox,decisions,beliefs,metrics,packs} ~/life/   # 装演示语料
cd ~/life && grep -rn "topic: .*money" inbox/ decisions/     # 应命中 4 条（3 条 Event + 决策文件本身）
```

然后在 `~/life` 里对 agent 说：

```
用芒格和我的 self 包，帮我分析 decisions/20261011-buy-house 这个决定，输出分歧表，别给我平均结论
```

装上 `bayes` 后再说一次，让它跟芒格真打：

```
用芒格和贝叶斯两个包分析同一个决定。它们在这件事上哪个先说话，按 bayes 包的裁决顺序走；
平手就把分歧本身作为结论报给我，不要代我选
```
