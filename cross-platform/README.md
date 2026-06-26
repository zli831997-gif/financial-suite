# FinanceHub 跨端工程（cross-platform/）

独立子工程，把 FinanceHub 通过 **Taro 4** 一套源码编译出：
- **H5** —— APP 端用 Capacitor 打包（沿用上游 GitHub Actions）
- **微信小程序** —— 微信开发者工具上传

原工程（`../`）基本不动，本工程复用其 `src/logic` + `src/storage`（平台无关层）。

## 现状：全部页面已跨端迁移 ✅

- ✅ H5 + 小程序双端编译成功（12 个页面 + 自定义 tabBar）
- ✅ 跨端 UI 基础设施：Icon（emoji 映射）、MiniChart（纯 View 饼图/趋势）、Motion（CSS 动画）、cn、Card
- ✅ Tailwind v3 跨端（className 原样复用，H5 css + 小程序 wxss 都生成）
- ✅ 首页工具箱（移植 MobileHub，8 张精算卡片，复用 calc*/reverse*）
- ✅ 记账页（移植 AccountingView：明细/记一笔/固定账单/CSV）
- ✅ 报表页（移植 ReportsView：资产负债/利润/现金流三大表）
- ✅ 理财页（复利计算）、房贷页（Slider + 对比）、年金页（复利 + 税差）
- ✅ 资产页（移植 AssetsView：饼图 + healthScore 诊断 + 提前还贷仿真 + CRUD）
- ✅ 股票页（移植 StocksView：饼图 + 多市场持仓 CRUD）
- ✅ 个税页（3 Tab：月薪年终奖/劳务稿酬/期权，综合税率表）
- ✅ 社保页（4 子 Tab：比例测算/余额估算/医保报销，23 城真实比例）
- ✅ 养老金页（3 支柱：城镇职工/城乡居民/第3支柱税优 + 寿命对比）
- ✅ `tsc --noEmit` 零错误

## 目录约定

```
cross-platform/
├── config/
│   ├── index.ts          Taro 配置（含 @finance alias + 上游 include 注入）
│   ├── dev.ts / prod.ts
├── src/
│   ├── index.html        H5 模板（Taro 要求放在 sourceDir）
│   ├── app.tsx           Taro 根组件（启动时 bindStorage 注入适配器）
│   ├── app.config.ts     小程序页面/窗口配置
│   ├── app.css
│   ├── pages/index/      首页（最小验证页，逐步补全为完整 DashboardView）
│   ├── adapters/         存储适配器
│   │   ├── index.ts      bindStorage：按运行时注入 web 或 wxStorage
│   │   ├── webStorage.ts H5/Capacitor（localStorage）
│   │   └── miniappStorage.ts 小程序（wxStorageSync，经 Taro）
│   └── utils/platform.ts 跨端 API 抽象（prompt/confirm/clipboard/可见性）
├── package.json          独立依赖（Taro 4.0.9 + React 18）
├── tsconfig.json
├── project.config.json   微信开发者工具项目配置
├── babel.config.js
└── types.global.d.ts
```

## 复用上游的关键机制（已验证）

上游 `src/` 不在子工程编译范围内，直接引用会 `ModuleParseError`。两处配置解决：

1. **alias**（`config/index.ts` 的 `applyAlias`）：`@finance/*` → `../src/*`
2. **loader include**（`applyAlias` 的 environment 钩子）：把上游 `../src` 追加进
   Taro 的 `.ts/.tsx` 编译规则的 `include` 数组（默认只有本工程 src）。

源码里用 `import { calcNetAssets } from '@finance/logic/calc/netAssets'` 复用。
`tsconfig.json` 的 `paths` 做同样的别名映射（供 IDE/类型检查）。

## 存储注入（跨端核心）

上游 `src/storage/index.ts` 已改为**可注入**（H5 行为不变）：
- 浏览器环境默认初始化 localStorage 实现（向后兼容）
- 小程序等环境留空，本工程 `app.tsx` 启动时调 `bindStorage()` 注入 wxStorageSync
- domain 层（records/accounts/gamification 等）全部 `import { storage }`，
  注入后自动生效，零改动

## 开发

```bash
cd cross-platform
npm install                 # 首次（约 1100+ 包，需 Taro 全家桶）
npm run dev:h5              # H5 开发：http://localhost:10086
npm run dev:weapp           # 小程序：微信开发者工具打开本目录，编译产物在 dist/weapp
npm run build:h5            # 生产 H5 → dist/h5
npm run build:weapp         # 生产小程序 → dist/weapp
npm run lint                # tsc 类型检查
```

## 打 APK（APP 端）

跨端 H5 产物（`cross-platform/dist/h5`）经 Capacitor 打包成安卓 APP，与小程序共用同一份源码。

**自动（GitHub Actions）**：push 到 master 且改动了跨端/逻辑层文件时，`.github/workflows/build-apk-taro.yml` 自动构建 APK，artifact 名 `FinanceHub-app-taro`。

**本地（需 JDK 17 + Android SDK）**：
```bash
bash cross-platform/scripts/build-apk-local.sh
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

链路：`Taro build H5` → 覆盖主工程 `dist/`（Capacitor webDir）→ `cap copy android` → `gradlew assembleDebug`。

## 下一步（阶段 B/C）

- ⬜ 完善档案页（ProfileView 完整版，含房产/车辆编辑）
- ⬜ 接入 AI 对话页（react-markdown → 轻量自渲染）
- ⬜ 阶段 B：微信云开发（云函数 + 云数据库 + openid 登录 + pull/push 同步）
- ⬜ 阶段 C：Capacitor 包 H5 → APK；小程序真机联调数据互通

## 迁移模式（供后续页面参考）

每个组件迁移时的标准改法：
1. `lucide-react` 图标 → `<Icon name='xxx' />`（见 Icon.tsx 的 ICON_MAP，缺的补上）
2. `motion/react` 的 `<motion.div>`/`AnimatePresence` → `<Motion tapScale={0.99}>` + 条件渲染
3. `div/span/p/h1-4` → `<View>`/`<Text>`（html 插件下也可保留 div，但 View 更稳）
4. `input/textarea` → Taro 的 `<Input>`/`<Textarea>`（注意 `onInput={e => set(e.detail.value)}`）
5. `window.prompt/confirm/alert` → `confirmAsync`/`promptAsync`/`alertAsync`
6. 数据获取：上游从 props 拿 → 跨端页直接调 domain 层（`getRecords()`/`getAccounts()` 等）
7. className 全部保留（Tailwind 跨端生效）

## 注意

- **React 版本**：本工程 React 18（Taro 4 对 18 成熟），上游 React 19 互不影响。
- **appid**：`project.config.json` 的 `appid: "touristappid"` 需换成你的小程序正式 appid。
- **小程序 prompt/confirm 异步**：迁移组件时把 `if(!confirm())` 改成 `await confirmAsync()`。
- **上游唯一改动**：仅 `src/storage/index.ts`（可注入，H5 行为不变），其余原工程不动。
