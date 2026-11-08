---
id: ent-{{slug}}
type: entity
kind: person                # person|org|project|asset|place
name: {{显示名}}
topic: []
priv: private               # 可识别的第三方身份/敏感诊断默认 secret（内容只写在 secret/ 下）
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
refs: []
---

## 事实
{{带日期与证据等级：- 2026-10-11 说了 X（A：聊天记录 attachments/…）}}

## 我的判断（inferred）
{{允许被推翻；标注是哪次复盘写的}}

## 交互记录（倒序追加）
- {{YYYY-MM-DD}} {{一事一行，含 id 指向 inbox 块}}
