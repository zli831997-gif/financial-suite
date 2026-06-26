# 迁移审计与路线（MIGRATION.md）

> 阶段0 产出。新老模块对照 + 可搬运资产 + 口径差异 + 数据映射 + 阶段路线。
> 随迁移推进，把各模块判定从 ❌/⚠️ 逐步更新为 ✅。判定符号：✅新版已对齐可用 / ⚠️有实现但浅或错 / ❌缺失。

## 一、新老模块对照表

| # | 模块 | 新版现状 | 老版现状 | 判定 | 迁移动作 | 阶段 |
|---|---|---|---|---|---|---|
| 1 | 月薪反推税前 | `financeState.reverseNetSalaryToGross`，二分40次，社保比例 **0.105**（不含公积金），社保封顶硬编码占位 | `salaryReverseCalc.js`，二分30次，**0.01精度**，默认 **0.225**（含公积金） | ⚠️ | 换用老版算法+0.225口径+真实社保封顶 | 3 |
| 2 | 社保反推基数 | `reverseSocialSecurityBase`，线性除法但**与城市表脱钩**（永远用10.5%），5城 | `socialCalculator.js`，22城 + 上下限 clamp + 个人比例合计动态算 | ⚠️ | 搬22城数据+clamp+动态比例 | 3 |
| 3 | 个税（月/年终奖/劳务） | 七级累率+年终奖单独/合并+劳务+期权（内联组件） | `taxCalculator.js` 累计预扣+年终奖双方案+劳务报酬 | ⚠️ | 抽纯函数；补累计预扣；期权是新版独有保留 | 3 |
| 4 | 个税（稿酬/特许权） | 无 | 无 | ❌ | 双方都缺，作为新功能补 | 3 |
| 5 | 养老金 | 内联在 `PensionView`，无纯函数，无省份数据 | `pensionCalculator.js` 四模块完整（职工/居民/个人/FIRE）+30省数据 | ⚠️ | 抽纯函数 + 搬老版30省数据 | 5 |
| 6 | 企业年金 | 内联在 `AnnuityView` | （老版无） | ⚠️ | 新版独有，抽纯函数保留 | 5 |
| 7 | 存款单/复利 | 内联在 `DepositsView` | （公式标准） | ⚠️ | 抽纯函数 `logic/calc/deposit.ts` | 5 |
| 8 | 净资产口径 | **三处各算**（Dashboard/MobileHub/AssetsView），AssetsView 有重复扣减 bug | `netAssetsCalc.js` 单一聚合入口 | ❌ | 统一到单一 `calcNetAssets()`，修 bug | 1 |
| 9 | 记账 CRUD | 有增删，**无 update**，无转账处理 | `dataManager.js` 增删改 + 余额联动（转账有缺口） | ⚠️ | 搬 dataManager，补 update + 转账 | 2 |
| 10 | 账户余额联动 | App.tsx props 管理 | `updateBalanceForRecord()` 统一入口 | ⚠️ | 搬统一联动函数 | 2 |
| 11 | 自动记账模板 | `entitySync` 只生成模板，**不自动入账**（需手动确认划扣） | `templateEngine.js` 按 cycle/day 自动入账 + `fin_auto_log` 幂等 | ❌ | 搬 templateEngine + 幂等日志 | 2 |
| 12 | 资产实体联动 | **仅房产**，无 linkedId（靠 address 字符串），删改易成孤儿 | `entitySync.js` 房产+车，`linkedEntityId` 级联，先清后建幂等 | ⚠️ | 补车 + linkedId + 级联清理 | 4 |
| 13 | 存款派息 | 无 | `assetManager.settleInterest()` + `fin_interest_log` 月度幂等 | ❌ | 搬 settleInterest + 幂等 | 4 |
| 14 | 游戏化 | 4徽章 + `repairCards`假字段 + 打卡UTC隐患 | `gamificationManager.js` 20徽章 + 真补签卡 + 连击倍率 + 打卡幂等 | ❌ | 大幅补全，搬老版（保留 exp/points 解耦） | 2 |
| 15 | 股票持仓 | 真逻辑 + mock 行情，**独立王国**（不进主状态） | `portfolioManager.js` A股持仓 | ⚠️ | 纳入主状态 + 搬老版口径；mock 行情标注清楚 | 4 |
| 16 | 数据存储 schema | 8个 `finance_hub_*`，聚合+分散混用 | 15个 `fin_*` 分散 schema | ❌ | 重构对齐 fin_ schema（见第四节） | 1 |
| 17 | 老数据导入工具 | 无 | （老版有 JSON 全量导出） | ❌ | 写一次性导入：老版 fin_ JSON → 新版 | 1 |
| 18 | 数据导出 | 无 | JSON/CSV/Canvas长图 | ❌ | 搬老版导出 | 6 |
| 19 | PIN 应用锁 | 无 | `util.js` djb2+盐 hash | ❌ | 搬老版 | 6 |
| 20 | 预算/目标/提醒 | 仅 `budgetGoal` 单值 | `fin_budgets`/`fin_goals`/`fin_reminders` | ❌ | 搬老版 | 6 |
| 21 | CSV 账单导入 | `AccountingView` 有解析 | `billParser.js` 支付宝/微信 | ⚠️ | 对齐老版解析规则 | 2 |
| 22 | AI 理财顾问 | `server.ts` Gemini 代理 + ChatView | 无 | ✅ | 新版独有，保留 | — |
| 23 | 愿景图生成 | Gemini 图片生成 | 无 | ✅ | 新版独有，保留 | — |

## 二、老版可搬运资产清单（迁移弹药）

### 计算引擎五件套（零平台依赖，复制即用）
- `salaryReverseCalc.js` — 二分反推税前，30次迭代，0.01精度，默认比例0.225
- `socialCalculator.js` — 22城数据 + 上下限 clamp + 线性反推
- `taxCalculator.js` — 累计预扣 + 年终奖双方案 + 劳务报酬（缺稿酬/特许权）
- `pensionCalculator.js` — 职工/居民/个人养老金/FIRE 四模块 + 30省数据
- `netAssetsCalc.js` — 净资产聚合入口

### 幂等机制三套（架构成熟，换 storage 接口即可）
- `templateEngine.js` — `fin_auto_log`（按日记录已执行 templateId，保留30天）防重复生成
- `assetManager.settleInterest()` — `fin_interest_log.month` 月度派息幂等
- `gamificationManager.js` — `lastCheckinDate` 打卡幂等

### 数据模型
- 15 个 `fin_*` key 的字段结构（见第四节），一对一映射为新版 domain model
- `assetManager.calcValue` 资产口径（房产现值 / 车辆贬值 / crypto量×价 / debt 取负）

### 需补写的缺口
- `dataManager` 缺 `updateRecord` 和转账余额处理
- `taxCalculator` 缺稿酬 / 特许权使用费
- `entitySync` 不支持存款派息实体联动（派息已在 assetManager，但联动未统一）

## 三、关键口径差异（必须对齐，否则结果错）

| 项 | 新版 | 老版 | 对齐方向 |
|---|---|---|---|
| 个税反推社保比例 | 0.105（无公积金） | 0.225（含公积金12%） | 默认按老版工资条口径 0.225 |
| 社保反推城市数 | 5 城 | 22 城 | 用老版 22 城 |
| 社保反推是否按城市比例 | 否（统一10.5%） | 是（动态个人比例合计） | 用老版动态计算 |
| 游戏化徽章数 | 4 | 20 | 用老版 20 |
| 补签卡 | 假字段 | 完整机制 | 实现老版机制 |
| 净资产计算 | 三处各算 + AssetsView bug | 单一 calcNetAssets | 统一到单一函数 |
| 打卡日期 | toISOString()（UTC隐患） | 本地日期 | 改本地时区日期 |
| 实体联动覆盖 | 仅房产 | 房产+车 | 补车 + linkedEntityId 级联 |
| 自动记账 | 只存模板不入账 | 自动入账 + 幂等 | 实现自动入账 |

## 四、数据 key 映射表（fin_ 对齐）

老版 key → 新版目标 key（新版统一改用老版 schema）：

| 老版 key | 内容 | 对应新版现有 key / 状态 |
|---|---|---|
| `fin_records` | 记账记录数组 | ← `finance_hub_transactions_v2` |
| `fin_accounts` | 账户数组 | ❌ 新版无独立账户体系 |
| `fin_budgets` | 预算 `{yearMonth:{...}}` | 新版仅 `budgetGoal` 单值（待扩） |
| `fin_assets` | 资产数组（house/car/crypto/deposit/insurance/debt，带 linkedEntityId） | ← 新版 `finance_hub_app_state_v2` 里的 property/vehicle/cryptos/savings/insuranceCashValue/otherLiabilities（需拆解归入 fin_assets） |
| `fin_templates` | 自动记账模板 | ← `finance_hub_repayment_templates` |
| `fin_goals` | 财务目标 | ❌ 缺 |
| `fin_reminders` | 提醒 | ← `finance_hub_repayment_reminders` |
| `fin_user_profile` | 用户档案 | ← `app_state_v2.profile` |
| `fin_growth` | 游戏化 | ← `app_state_v2.gamification` |
| `fin_portfolio` | 股票持仓 | ← `finance_hub_stocks_v4`（纳入主状态） |
| `fin_pin` | PIN 锁 hash | ❌ 缺 |
| `fin_auto_log` | 自动记账幂等日志 | ❌ 缺 |
| `fin_interest_log` | 派息幂等日志 | ❌ 缺 |

**关键重构**：新版的聚合对象 `FinanceAppState`（property/vehicle/savings 等并列字段）要拆解归入老版的 `fin_assets` 数组（按 `type` 区分 house/car/crypto/deposit/insurance/debt），这是"实体中心化"的体现，也是老数据能导入的前提。

## 五、阶段路线

| 阶段 | 内容 | 涉及模块# | 状态 |
|---|---|---|---|
| **0** | 立规范（CLAUDE.md）+ 差距审计（本文） | — | ✅ 完成 |
| **1** | 地基（渐进式）：storage 抽象层 + key 集中管理 + 统一净资产函数 `calcNetAssets` + 所有 localStorage 收敛到接口 | 8 | ✅ |
| **2** | 记账核心 + 账户体系：domain（records/accounts）+ useBookkeeping 桥接 + 账户选择 + 余额联动 + 净资产含账户 + 旧数据迁移 | 9,10,21 | ✅ |
| **2b** | 游戏化补全：gamification domain（独立 fin_growth，20徽章/记账即打卡/补签卡/连击/exp-points 解耦/本地日期）+ 接入记账和打卡 + 全局庆祝动效 | 14 | ✅ |
| **2c** | 自动记账：templates domain（独立 fin_templates，checkAutoRecords 周期判断 + fin_auto_log 幂等）+ 启动钩子自动入账 + AccountingView 模板管理 | 11 | ✅ |
| **2d** | 老数据导入：legacyImport 工具（校验 _meta + 逐领域转换 records/accounts/growth/templates/reminders/auto_log + profile/assets→financeState）+ 档案页粘贴 JSON 导入 UI | 17 | ✅ |
| **3** | 税务/社保反推引擎：calc/tax（累计预扣+年终奖+劳务）+ calc/salary（到手反推0.225）+ calc/social（23城+反推clamp）+ financeState re-export compat + InsuranceView 23城 | 1,2,3,4 | ✅ |
| **4** | 实体联动：reminders domain（fin_reminders）+ entitySync（房/车贷款→月供模板+提醒、出租→租金，upsert 幂等）+ 档案触发 + 账单提醒（资产保持聚合） | 12 | ✅ |
| **5** | 养老金/FIRE：calc/pension（城镇职工/居民/个人养老金/FIRE + 30省 + 31档计发月数 + 7档税率）+ PensionView/MobileHub 改用（AnnuityView 年金保留） | 5 | ✅ |
| **6** | 辅助（数据安全）：数据导出/恢复（dataTransfer，FinanceHub 格式，排除 fin_pin）+ PIN应用锁（djb2+盐 + App锁屏 + 回前台 visibility） | 18 | ✅ |
| **6b** | 辅助（管理）：预算管理（fin_budgets）/ 财务目标（fin_goals）/ 提醒增删 UI | 19,20 | ⬜ |

## 六、阶段0 完成情况

- ✅ 写新版 CLAUDE.md（三铁律 + 技术栈 + 目录约定 + 迁移原则 + 验证 + 红线 + 待决策）
- ✅ 差距审计：新老模块对照表（23项）+ 可搬运资产清单 + 口径差异表 + 数据 key 映射
- 📌 待用户拍板（影响阶段1起点）：①"到手"社保比例口径（0.225 vs 0.105）②UI转小程序方案是否现在定
