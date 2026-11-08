---
id: met-{{name}}
type: metric
date: {{YYYY-MM-DD}}          # 台账建立日，不是观测日
topic: []
priv: private                 # 健康/财务类原件不在库时降为 secret
unit: {{percent|kcal|hours|CNY}}
source: {{原件路径或采集方式}}
verified: {{true|false}}      # 原件不在库里时必须是 false
missing_policy: 留空不补零，不伪造
---

# {{指标名，如 body-fat}}

- {{YYYY-MM-DD}} {{值}}
- {{YYYY-MM-DD}} {{值}}

<!-- 一行一观测。宽表会让 grep 失效、让补录变痛苦。
     需要结构化时由外部脚本重建 index/，索引文件不写回语料。
     Metric 台账豁免 Event/Decision 的字段要求：无 confidence、无 review_on。 -->
