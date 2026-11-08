# 包登记表（registry）

> 本表只登记**实际存在**的包。计划中的不算存在。
> 此文件是**官方发布列表**；你自己的包登记在你数据仓库的 `packs/registry.md` 里，不要提交到这里。

## 已发布

| slug | kind | version | evidence | domain-fit | 维护 | 状态 |
|---|---|---|---|---|---|---|
| `self` | self | 由季度编译生成 | A/B（你的实际记录） | 全部（你自己的行为） | 用户 + agent | 契约内置，非预制 |
| `munger` | person | 0.1.0 | **B** | decision, investing, cognition, self-audit | official | experimental |
| `bayes` | method | 0.1.0 | **A**（引文元数据） | decision, forecasting, self-audit, risk-sizing | official | experimental |
| `_template` | — | 0.1.0 | — | — | official | 模板，不用于分析 |

`munger` 0.1.0 的承重限制（按契约）：全部证据为第三方转载讲稿与书籍章节指针，**纸本页码未核**。
可以进决策顾问团，但**不得**作为逐字引语来源；`verified: false` 的金句（激励金句、三筐法）
只能当记忆锚点。升到 A 需要用户提供纸本段落页码，见 `packs/munger/sources/links.md`。

`bayes` 0.1.0 的承重限制：A 级的含义是**引文条目可定位**（刊名/卷/页/DOI 已核），不是原文逐字已读。
可进顾问团；但① 任何分解式、页码、实验数字都不得对外引用；② 模型 6（时间平均 vs 期望值）来自
**非共识学派**，输出时必须带上这一句；③ 包内所有工程参数（n≥20、步长 0.2）为自设，`verified: false`。
`bayes` 与 `munger` 在"判断不了的事该不该放下"上是**真分歧**，裁决规则见
`packs/bayes/pack.md` 的「冲突记录」——顾问团必须输出分歧表，不得平均两方结论。

## 自建包放哪

人物包、方法论包都是数据文件，不属于内核。做法是在你自己的数据仓库里复制模板：

```bash
cp -r packs/_template ~/life/packs/<slug>
```

然后只在自己的 `packs/registry.md` 登记。**内核仓库不收录个人包**：一个人物的蒸馏结论
带窗口快照与证据等级，换个人就不成立，混进公共列表会误导别人。

## 回流的条件

想把自建包回流给社区：目录原样保留（`packs/<slug>/`），附 lint 12 项 pass 记录与
压力测试 3 问的结果。**不接受缺少失效条件的包**，也不接受把未证实数字当事实的包。

维护方式与 issue 模板见仓库根 `README.md`。
