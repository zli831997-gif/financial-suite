# financial-suite (1) — 工程规范

> 本文件是 Claude Code 和所有协作者在本项目工作的最高规则。**动手前先读这里。**
> 详细的新老对照、可搬运资产清单、阶段路线见同目录 `MIGRATION.md`。

## 1. 项目定位

- 老版「财务通」微信小程序的继任前端。Gemini 用 React + Vite 做了初始 UI（基本满意），现在把老版验证过的业务逻辑补进来。
- **最终目标：转回微信小程序**。所以本项目是「前端验证 + 逻辑沉淀」的工作台，不是最终产品形态。逻辑层要按"将来能整层搬走"来写。
- 老版（逻辑与数据的权威来源）：`/Users/xiaoweiwei/Desktop/financial-suite/mini-app`
- 老版设计文档（需求/PRD/功能规格）：`/Users/xiaoweiwei/Desktop/financial-suite/*.md`

## 2. 三条铁律（最高约束，任何改动不得违反）

1. **逻辑层平台无关** — 所有业务计算和领域逻辑放在 `src/logic/`，写成纯 TS 函数。禁止 `import` react / 浏览器 API / localStorage。判定标准：这些文件能被 Node、浏览器、微信小程序任意环境直接运行，改 export 就能复用。
2. **存储层抽象** — 所有数据读写走 `src/storage/` 定义的 `storage.get/set/remove` 接口，禁止任何文件直接调 `localStorage` 或 `wx.*`。当前散落在 `App.tsx` / `utils/entitySync.ts` / `components/StocksView.tsx` 的直接 localStorage 调用，迁移时必须收敛进接口。
3. **数据格式对齐老版 `fin_`** — 存储 key 用老版的 `fin_*` schema（见 `MIGRATION.md` 数据映射表），保证老版真实数据可一键导入、将来转回小程序数据无缝回流。逐步淘汰当前的 `finance_hub_*` 前缀。

## 3. 技术栈现状

- 前端：React 19 + TypeScript 5.8 + Vite 6 + Tailwind v4
- UI 依赖：lucide-react（图标）、recharts（图表）、motion（动画）、react-markdown
- 后端：Express 4（`server.ts`），**只做 Gemini AI 代理**（`/api/chat`、`/api/generate-image`），零业务逻辑、零数据持久化。用户数据 100% 在浏览器本地。
- 状态管理：React useState + props 透传（无状态库）
- 已有平台无关纯函数岛：`src/utils/financeState.ts`（税务/社保反推 + 游戏化 + 完整度），迁移时整体并入 `src/logic/`
- 待改进：tsconfig 未开 strict；无测试框架；无 ESLint；`INITIAL_STATE` 全是演示 mock 数据

## 4. 目录约定

### 目标分层（迁移逐步建立）

```
src/
├── logic/            ★ 平台无关逻辑层（铁律1：禁 react/localStorage/wx）
│   ├── calc/         纯计算（无状态无IO）：tax / salary / social / pension / annuity / deposit / netAssets
│   ├── domain/       领域行为（通过 storage 接口读写）：records / accounts / assets / entitySync / templates / gamification / profile
│   └── types.ts      所有 domain 类型（对齐老版 fin_ 结构）
├── storage/          ★ 存储抽象（铁律2）
│   ├── interface.ts  storage.get/set/remove 接口
│   └── keys.ts       所有 fin_ key 常量 + 默认结构
├── adapters/         存储适配器实现
│   └── webStorage.ts web 端（localStorage）；将来小程序端补 miniappStorage.ts
├── components/       React UI 层（只调 logic + 渲染，禁止内联业务计算）
├── App.tsx / main.tsx
└── utils/financeState.ts （旧岛，迁入 logic/ 后清空）
```

### 命名与分层规则

- `logic/calc/*` 必须是 `(input) => output` 的纯函数，不读不写任何存储。
- `logic/domain/*` 管自己的 `fin_*` key（参考老版 dataManager/assetManager/gamificationManager 各管一个 key 的模式）。
- `components/*` 只负责「调用 logic 函数 + 渲染 UI」，禁止把计算逻辑内联进组件。
- 自动记账 / 存款派息 / 打卡 必须有幂等机制（参考老版 `fin_auto_log` / `fin_interest_log` / `lastCheckinDate`）。

### 现状技术债（迁移时清理）

- 死代码：`components/VisionView.tsx`、`Sidebar.tsx`、`GenericCalculatorView.tsx`、`src/types.ts` 里的 `Asset`/`Stock` 接口
- 净资产口径三处各算（`DashboardView` / `MobileHub` / `AssetsView`），`AssetsView` 存在贷款重复扣减 bug
- 游戏化 `repairCards` 是假字段（定义后无任何使用）；徽章仅 4 个（老版 20 个）
- 打卡日期用 `toISOString()`（UTC，国内凌晨会算到前一天），需改本地时区日期
- 社保城市数据只 5 城、硬编码在组件内（老版 22 城）

## 5. 迁移原则

- **从老版搬运逻辑，不要从头重写**。老版 `mini-app/utils/` 的计算引擎是验证过的成熟算法（资产清单见 `MIGRATION.md`）。
- 组件层禁止内联业务计算；当前 `PensionView` / `AnnuityView` / `AssetsView` 的健康分/仿真计算都内联了，迁移时抽出到 `logic/calc/`。
- 改逻辑前先改文档（本规范 + `MIGRATION.md`），再改实践。
- 改完主动验证（见第 6 节），不只改不验。
- 不为了让代码跑通而注释报错或加绕过标记，找根本原因。

## 6. 验证方式

- 类型检查：`npm run lint`（= `tsc --noEmit`）—— 任何 `logic/` 改动后必跑
- 本地预览：`npm run dev`（启动 Express + Vite，浏览器实测功能）
- 构建：`npm run build`
- 改完逻辑必须：① `npm run lint` 通过 ② `npm run dev` 实操对应功能 ③ 涉及计算的，和老版同输入比对结果一致

## 7. 红线（继承用户全局规则，即使 auto-accept 也必须先问）

- 删除文件 / 目录 / git 历史
- 改 `.env`、密钥、token、CI/CD
- 数据 schema 大改或数据迁移（本项目指 localStorage 结构破坏性变更）
- git push / rebase / reset --hard / 强制推送
- 安装新全局依赖或改系统配置
- 公开发布

## 8. 待决策项（动手到相关模块前需确认）

- **UI 转小程序方案**：Taro（React→小程序，改动小，但 Tailwind/部分 web API 有限制）/ 原生小程序重写 / uni-app。倾向 Taro，待差距审计细化后定。
- **tsconfig strict**：`logic/` 是否单独强制 strict（建议是）。
- **状态管理**：是否引入轻量状态库（如 zustand）替代 props 透传，还是保持现状到转小程序时一并重做。
- **"到手"口径**：个税反推的社保比例，新版 0.105（不含公积金）、老版 0.225（含公积金12%）。默认按老版工资条口径，待确认。
