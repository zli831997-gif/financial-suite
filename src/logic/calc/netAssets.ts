import type { FinanceAppState } from '../../utils/financeState';
import type { Account } from '../domain/accounts';

/** 净资产分项，供各页展示用（含净值与原值，调用方按需组合）。 */
export interface NetAssetsParts {
  savings: number;
  crypto: number;
  insurance: number;
  propertyCurrentValue: number; // 房现值
  propertyLoan: number; // 房贷余额
  propertyNet: number; // 房净值 = 现值 - 房贷
  carCurrentValue: number; // 车折旧残值
  carLoan: number; // 车贷余额
  carNet: number; // 车净值 = 残值 - 车贷
  otherLiabilities: number; // 其他负债
  accountsNet: number; // 账户净余额（= 记账结余，阶段2 新增）
}

export interface NetAssetsResult {
  net: number; // 净资产（唯一权威值）
  parts: NetAssetsParts;
}

/**
 * 统一净资产口径。所有页面（首页 / 工具箱 / 资产页）必须调用此函数。
 * 口径：net = savings + crypto + 房净值 + 车净值 + 保险 - 其他负债 + 账户净余额
 * accountsNet 由调用方传入（来自 getAccountsNetBalance），保持本函数纯函数特性。
 */
export function calcNetAssets(state: FinanceAppState, accountsNet = 0): NetAssetsResult {
  const savings = state.savings.reduce((acc, s) => acc + s.amount, 0);
  const crypto = state.cryptos.reduce((acc, c) => acc + c.amount * c.price, 0);
  const insurance = state.insuranceCashValue;
  const otherLiabilities = state.otherLiabilities;

  const propertyCurrentValue = state.property?.currentValue ?? 0;
  const propertyLoan = state.property?.loanBalance ?? 0;
  const propertyNet = propertyCurrentValue - propertyLoan;

  let carCurrentValue = 0;
  if (state.vehicle) {
    const rate = state.vehicle.depreciationRate / 100;
    carCurrentValue = state.vehicle.purchasePrice * Math.pow(1 - rate, state.vehicle.age);
  }
  const carLoan = state.vehicle?.loanBalance ?? 0;
  const carNet = carCurrentValue - carLoan;

  const net = savings + crypto + propertyNet + carNet + insurance - otherLiabilities + accountsNet;

  return {
    net,
    parts: {
      savings,
      crypto,
      insurance,
      propertyCurrentValue,
      propertyLoan,
      propertyNet,
      carCurrentValue,
      carLoan,
      carNet,
      otherLiabilities,
      accountsNet,
    },
  };
}

// ═══════════════════════════════════════════
// 资产负债表（Balance Sheet）— 阶段B 新增
// 把个人当公司管：资产 - 负债 = 净资产，按流动性分组。
// 复用 calcNetAssets 的 parts 保证口径唯一，只加分组归类层。
// ═══════════════════════════════════════════

/** 报表行：一项资产或负债。 */
export interface BalanceSheetItem {
  name: string;
  amount: number;
  /** 备注（如「现值 ¥165万 / 贷款 ¥90万」），UI 可选展示 */
  detail?: string;
}

export interface BalanceSheetGroup {
  label: string; // 组名（如「流动资产」）
  items: BalanceSheetItem[];
  subtotal: number; // 小计
}

export interface BalanceSheet {
  currentAssets: BalanceSheetGroup; // 流动资产：现金/存款/crypto（可快速变现）
  nonCurrentAssets: BalanceSheetGroup; // 非流动资产：房/车/保险/养老金（锁定或长期）
  currentLiabilities: BalanceSheetGroup; // 流动负债：信用卡欠款/其他短期
  nonCurrentLiabilities: BalanceSheetGroup; // 非流动负债：房贷/车贷（长期）
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number; // 净资产（= calcNetAssets.net，唯一权威值）
  debtRatio: number; // 资产负债率 = 总负债 / 总资产
}

function round2m(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumItems(items: BalanceSheetItem[]): number {
  return round2m(items.reduce((s, it) => s + it.amount, 0));
}

/**
 * 构建资产负债表（对齐企业会计准则：流动/非流动分组）。
 * @param state      财务档案
 * @param accounts   账户数组（来自 fin_accounts；信用卡欠款算流动负债，其余算流动资产）
 *
 * 口径恒等：totalAssets − totalLiabilities = netAssets = calcNetAssets(state, accountsNet).net
 */
export function buildBalanceSheet(
  state: FinanceAppState,
  accounts: Account[] = []
): BalanceSheet {
  // 复用权威净资产口径（避免又造一套估值）
  const accountsNet = accounts.reduce((sum, a) => {
    if (a.type === 'credit') return sum - (a.balance || 0);
    return sum + (a.balance || 0);
  }, 0);
  const { parts } = calcNetAssets(state, round2m(accountsNet));

  // —— 流动资产 ——
  // 活期账户余额（现金/支付宝/微信/储蓄卡）
  const liquidAccountBalance = accounts
    .filter(a => a.type !== 'credit')
    .reduce((s, a) => s + (a.balance || 0), 0);
  const currentAssetItems: BalanceSheetItem[] = [
    { name: '活期账户余额', amount: round2m(liquidAccountBalance), detail: '现金/支付宝/微信/储蓄卡' },
    { name: '定期存款 / 理财', amount: parts.savings },
    { name: '加密资产', amount: parts.crypto },
  ].filter(it => it.amount !== 0);

  // —— 非流动资产 ——
  // 总额口径：房产按现值、车按残值（不扣贷款），贷款全部列在负债侧，会计恒等式成立。
  const nonCurrentAssetItems: BalanceSheetItem[] = [
    {
      name: '房产（现值）',
      amount: parts.propertyCurrentValue,
      detail: parts.propertyCurrentValue
        ? parts.propertyLoan
          ? `现值 ¥${parts.propertyCurrentValue.toLocaleString()} / 贷款 ¥${parts.propertyLoan.toLocaleString()}`
          : `现值 ¥${parts.propertyCurrentValue.toLocaleString()}（无贷款）`
        : undefined,
    },
    {
      name: '车辆（残值）',
      amount: parts.carCurrentValue,
      detail: parts.carCurrentValue
        ? parts.carLoan
          ? `残值 ¥${parts.carCurrentValue.toLocaleString()} / 贷款 ¥${parts.carLoan.toLocaleString()}`
          : `残值 ¥${parts.carCurrentValue.toLocaleString()}（无贷款）`
        : undefined,
    },
    { name: '保险现金价值', amount: parts.insurance },
  ].filter(it => it.amount !== 0);

  // —— 流动负债 ——
  const creditDebt = accounts
    .filter(a => a.type === 'credit')
    .reduce((s, a) => s + Math.max(0, a.balance || 0), 0);
  const currentLiabilityItems: BalanceSheetItem[] = [
    { name: '信用卡欠款', amount: round2m(creditDebt) },
    { name: '其他短期负债', amount: parts.otherLiabilities },
  ].filter(it => it.amount !== 0);

  // —— 非流动负债 ——
  const nonCurrentLiabilityItems: BalanceSheetItem[] = [
    { name: '房贷余额', amount: parts.propertyLoan },
    { name: '车贷余额', amount: parts.carLoan },
  ].filter(it => it.amount !== 0);

  const currentAssets: BalanceSheetGroup = {
    label: '流动资产',
    items: currentAssetItems,
    subtotal: sumItems(currentAssetItems),
  };
  const nonCurrentAssets: BalanceSheetGroup = {
    label: '非流动资产',
    items: nonCurrentAssetItems,
    subtotal: sumItems(nonCurrentAssetItems),
  };
  const currentLiabilities: BalanceSheetGroup = {
    label: '流动负债',
    items: currentLiabilityItems,
    subtotal: sumItems(currentLiabilityItems),
  };
  const nonCurrentLiabilities: BalanceSheetGroup = {
    label: '非流动负债',
    items: nonCurrentLiabilityItems,
    subtotal: sumItems(nonCurrentLiabilityItems),
  };

  const totalAssets = round2m(currentAssets.subtotal + nonCurrentAssets.subtotal);
  const totalLiabilities = round2m(currentLiabilities.subtotal + nonCurrentLiabilities.subtotal);
  // 净资产 = 总资产 - 总负债（总额口径，会计恒等式天然成立）
  const netAssets = round2m(totalAssets - totalLiabilities);
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;

  return {
    currentAssets,
    nonCurrentAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalAssets,
    totalLiabilities,
    netAssets: round2m(netAssets),
    debtRatio,
  };
}
