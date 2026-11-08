---
id: {{YYYYMMDD-slug}}
type: decision
date: {{YYYY-MM-DD}}
topic: []
priv: private
question: {{一句话：要决定什么}}
reversibility: two-way      # one-way|two-way|unverified（不确定按 one-way 处理）
confidence: 0.0
status: pending             # pending|decided|blocked-on-precondition|done|overturned
sources_opened: 0           # 独立信息源数，默认要求 >=3
samples: 0                  # 实际样本量（看了几套/聊了几人）
packs_consulted: []         # ["pack:munger@0.1.0"]
worst_case: {{最坏结果}}
tolerable: false
cost_of_not: {{选这个意味着放弃什么}}
review_on: {{YYYY-MM-DD}}   # 到期进入月度审计
refs: []                    # ["[[20261011-e12]]", "pack:munger@0.1.0"]
---

## 可控变量三栏
- 100% 可控：
- 可影响：
- 只能承受：{{如实写，不要因为不可控就省略}}

## 探图状态
{{已看过的信息源与样本；未达标则结论只能是"暂缓 + 本周把图开大的三件事"}}

## 预演失败
{{假设 12 个月后这个决定被证明是错的，最可能的三个原因}}

## 执行前提检查
{{睡眠/身体、现金流缓冲、注意力余量。任一不足 → status: blocked-on-precondition}}

## 分歧表（装了多个包时才填）
| 包 | 结论 | 关键理由 |
|---|---|---|

## 结论与单一动作
{{决定}}
next_action: {{动作}} by {{日期}} check: {{可观测指标}}
