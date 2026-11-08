---
id: rev-m-{{YYYY}}-{{MM}}
type: review
period: monthly
derived: true
generated: {{YYYY-MM-DD}}
inputs: [{{4 份周报 id}}, {{到期决策 id}}]
---

## 1. 决策台账（到期项）
| id | 当时结论 | confidence | outcome | status |
|---|---|---|---|---|

## 2. 被推翻的信念清单（本节必须存在，空则写"本月无"）
- {{claim}} — confidence {{0.6 → 0.15}} — 触发证据 [[id]] — `status: overturned`
  <!-- 被推翻计为产出，写进 artifacts/ -->

## 3. 新假设（待用户确认后入 beliefs/）
- {{可证伪的陈述}} + falsifier

## 4. 数字面板（趋势描述，不做因果断言，标 inferred）

## 5. 下月一项重点

next_action: {{单一动作}} by {{YYYY-MM-DD}} check: {{可观测指标}}
