# AGENTS.md · 内核仓库

> 给任何在此仓库工作的 agent（Codex / Claude Code / Cursor / opencode / Gemini CLI / OpenMausBot）。
> **先读这一页，再动手。**

---

## 这个仓库是什么

**内核（L0）**：结构件、采集协议、节律、记录 schema、隐私护栏、模型包模板、脚手架。

它**不含任何个人数据**。个人语料在用户自己的私有数据仓库里（L1），由 `scripts/init.mjs` 生成。
所以在这个仓库里：

- 可以改规则、改 schema、改模板、改脚手架、加官方包
- **不可以**放任何真实的人名、健康数字、账号、数据库连接串、私人复盘
- **不可以**把 `examples/` 里的虚构样例改成真实案例

这条边界是仓库能公开的唯一原因。一旦混入真实数据，换谁都无法回收。

## 三层职责

| 层 | 在哪个仓库 | 放什么 | 谁维护 |
|---|---|---|---|
| L0 kernel | 本仓库 | 规则、schema、模板、脚手架、官方包 | 公开维护 |
| L1 corpus | 用户的私有仓库 | 六类一等公民记录，UTF-8 Markdown | 用户自己 |
| L2 packs | 用户仓库 `packs/` | self（自编译）+ 借来的框架 | 用户自己 |

**内核给裁判规则，包给裁判结论。冲突时结构件优先。**

## 文件地图

```
SKILL.md              七段协议，agent 的入口
kernel/               四条硬规则
  principles.md       12 条结构件，每条带失效条件
  record-types.md     六类记录与字段
  capture.md          20 秒规则 / 8 槽位 / 隐私分级
  cadence.md          日 / 周 / 月 / 季的硬节律
templates/            八种记录的空白模板
packs/                官方包（munger、bayes）+ 模板 + 登记表
examples/             可复现样例，语料是虚构的
scripts/              init.mjs（生成数据仓库）、lint-packs.mjs（结构自检）
```

## 常用命令

```bash
node scripts/init.mjs ../my-life --time 22:30   # 生成一个数据仓库
node scripts/lint-packs.mjs ../my-life          # 检查 packs 结构是否合契约
```

两个脚本都是零依赖的 Node，不需要 npm install。

## 改规则时的硬约束

1. **每条断言必须带证据等级与推翻条件。** 没有 falsifier 的规则不许进 `kernel/principles.md`。
2. **改 schema 要向前兼容。** 已有数据仓库里的记录不能因为内核升级而读不出来；必要时写迁移说明进 `CHANGELOG.md`。
3. **模板与契约同步改。** 改了 `record-types.md` 的字段，`templates/` 对应文件必须在同一个提交里改。
4. **样例必须虚构。** 新增 `examples/` 内容时明确写出“语料是虚构的”。
5. **不引入运行时依赖。** 保持纯 Markdown + Node 标准库，这是“换模型也能接手”的前提。

## 提交前自检

```bash
# 1. 没有个人数据混进来
git diff --cached | grep -Ei "password|token|@|/Users/|C:\\\\Users|mysql://|ssh-rsa"
# 2. 包结构合规
node scripts/score.mjs --min 85
```

第二条是结构分闸门，低于 85 就别提交。
