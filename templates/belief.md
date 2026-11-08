---
id: bel-{{NNN}}
type: belief
date: {{YYYY-MM-DD}}
topic: []
priv: private
claim: {{一句话陈述，必须可判断真假}}
kind: hypothesis            # observation|preference|hypothesis
evidence: B                 # A实测/原件 B自述记录 C记忆或AI推断
sources: []                 # ["[[20261011-e12]]"]
confidence: 0.5
falsifier: {{什么证据出现我会改}}     # 必填；没有推翻条件就不是信念
last_tested: {{YYYY-MM-DD}}
status: held                # held|challenged|overturned|retired
---

## 支撑
{{带 id 与等级的证据，逐条}}

## 反例与张力
{{与自己其他记录冲突的地方}}

<!-- 借来的框架不写在这里：用 refs: ["pack:<slug>"] 关联，行为被反复验证后才能升为 belief -->
