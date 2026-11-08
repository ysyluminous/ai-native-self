# bayes 包材料出处指针

> 本文件只放**出处指针与核验状态**，不转载原文（见根目录 `NOTICE.md` 版权规则）。
> 检索时间：2026-10-11。链接会失效；要对外做逐字引用前请取得原件（纸本或出版商页面）。
> 核验方式说明：本包用联网检索核对条目元数据，判定标准为
> **"同一条目在 ≥2 处独立参考文献列表里元数据一致（作者/年/刊/卷/页）"**。
> 这核对的是**引文是否存在**，不是**原文是否说了这句话**——两者在本包里等级不同，不得混用。

## 用于建模：元数据已核（本包记为 A）

1. **Brier, G. W. (1950). Verification of Forecasts Expressed in Terms of Probability.**
   *Monthly Weather Review* 78(1):1–3.
   DOI `10.1175/1520-0493(1950)078<0001:vofeit>2.0.CO;2`（DOI 字符串本身即元数据的一部分，已核）。
   本包据此承重使用：`BS = mean((f − o)²)`，越小越好。这是公认定义，**但本包未逐字读原文 PDF**。
2. **Tversky, A., & Kahneman, D. (1974). Judgment under Uncertainty: Heuristics and Biases.**
   *Science* 185(4157):1124–1131. Bibcode `1974Sci...185.1124T`。
   注意**作者顺序为 Tversky 第一**（中文社区常写成 Kahneman & Tversky，属引用错误）。
   DOI 未在线核对；检索请用标题。
3. **Buehler, R., Griffin, D., & Ross, M. (1994). Exploring the "planning fallacy":
   Why people underestimate their task completion times.**
   *Journal of Personality and Social Psychology* 67(3):366–381.
   本包只采用其**方向性结论**（内部视角导致低估完成时间）。
   **未核**：文中的具体实验数字（37 名学生、33.9 天 vs 55.5 天等，见 `pack.md` 诚实边界）。
4. **Bayes, T. (1763). An Essay towards solving a Problem in the Doctrine of Chances.**
   *Philosophical Transactions of the Royal Society of London* 53:370–418.
   经典纸本条目，可定位；**本包未读原文**，只据其公认结构陈述"后验 ∝ 先验 × 似然"。
5. **Peters, O. (2011). Optimal leverage from non-ergodicity.**
   *Quantitative Finance* 11(11):1593–1602. 元数据已核，未读全文。
6. **Peters, O., & Gell-Mann, M. Evaluating gambles using dynamics.**
   arXiv 预印本 `1405.0585` → `https://arxiv.org/abs/1405.0585`（本包核到该编号存在与其摘要要点：
   "No utility function is needed, but a dynamic must be specified to compute time averages"）。
   **这是学派内表述，不是领域共识**（见 `pack.md` 诚实边界第一条）。

## 用于建模：仅二手一致（本包记为 B，不升 A）

7. **Murphy, A. H. (1973). A new vector partition of the probability score.**
   *Journal of the Applied Meteorology* 12(4):595–600.
   DOI `10.1175/1520-0450(1973)012<0595:ANVPOT>2.0.CO;2`（随条目一同核到）。
   本包只取"概率分数可分解为可靠度与分辨度两类信息"这一**传统**，
   **分解的项名与公式本包未核**，禁止对外引用具体分解式。
8. **Klein, G. (2007). Performing a Project Premortem.** *Harvard Business Review* 85(9):18–19.
   刊期与页码在多处独立参考文献中一致（含 `85(9):18-19`）；HBR 原文本包未读。
   流程描述另经《思考，快与慢》中的转述交叉印证，两处一致。
9. **Flyvbjerg, B. (2008). Curbing optimism bias and strategic misrepresentation in planning:
   Reference class forecasting in practice.**（欧洲规划类期刊；**卷页未核**，
   且检索中出现过明显的元数据混淆条目，故本条只取"参照类预测三步法"这一可多源印证的方法，不取编号。）
10. **Tetlock, P. E. (2005). Expert Political Judgment: How Good Is It? How Can We Know?**
    中译本《狐狸与刺猬：专家的政治判断》，中国人民大学出版社 2013-03，季乃礼 译，337 页，
    ISBN `9787300167398`（书目元数据已核）。已核**目录章标题**：
    第三章"狐狸比刺猬有更高的校准和区分得分"、第四章"狐狸比刺猬更懂贝叶斯定理"。
    **原版出版社两说**（检索同时出现 Cambridge UP 与 Princeton UP 的著录；可能是初版与再版差异），
    引用前请看你手上的版权页。正文论证未逐页读。
11. **Kahneman, D. (2011). Thinking, Fast and Slow** 中对参照类预测的评价。
    二手记录指向 p.251；**版本与页码未核**，故本包只写"卡尼曼评价该方法重要"，不写原句、不写页码。

## 仅用于查漏（C 级，不据此建模、不承重）

- de Finetti / Ramsey 的主观概率与"下注一致性"传统：本包只作背景叙述，
  **未定位到可逐字核对的英译篇章与页码**（不同文集版本页码不一致）。
- 中文科普/自媒体对"贝叶斯思维""事前验尸提高 30%""规划谬误错误率 20–50%"的表述：
  转引链长、原始研究未定位 → 本包**拒收为事实**，在 `pack.md` 诚实边界里逐项写明。
- **按契约**：C 级不得构建模型。本包所有模型的证据行只引用上面 A/B 两组。

## 本包自设的工程参数（非文献结论，全部 `verified: false`）

| 参数 | 值 | 依据 |
|---|---|---|
| 校准台账可下结论的最小样本 | n ≥ 20 | 本包经验判断；请用你自己的台账改掉 |
| 单次置信度更新步长上限 | ≤ 0.2 | 防止情绪性跳变的工程约束，无文献支撑 |
| 极端概率（>0.95 / <0.05）的证据门槛 | 必须指名可核验证据 | 本包自设，对偶发但真实的决定性证据允许例外 |
| 高分辨度检查的最低记录数 | ≥ 10 | 本包自设 |

## 升到"可直接对外引用"需要用户提供

1. Brier 1950、Murphy 1973 的 **PDF 原件**（若要引用分解式的准确项名）；
2. Tetlock 2005 原版版权页照片（确定出版社与版次）；
3. 《思考，快与慢》你手上版本的对应页码（若要引用那句评价）；
4. 若要把"事前验尸"当方法论正式引入：Klein 2007 HBR 原文（本包目前只有二手一致的流程描述）。
