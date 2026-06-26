import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';
import type { FinanceAppState } from '../../utils/financeState';

/**
 * 资产 domain — 搬自老版 assetManager.js（平台无关，wx→storage）。
 * 6 类资产（house/car/crypto/cash/insurance/debt）+ calcValue 估值 + getSummary 汇总。
 *
 * 双写镜像：web 运行时 financeState 是源，本 domain 通过 syncAssetsFromFinanceState 维护镜像。
 * 转小程序时直接用本 domain（fin_assets 格式对齐老版）。
 */

export type AssetType = 'house' | 'car' | 'crypto' | 'cash' | 'insurance' | 'debt';

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  icon: string;
  note?: string;
  createdAt: string;
  linkedEntityId?: string;
  // house
  currentValue?: number;
  loanBalance?: number;
  loanMonthly?: number;
  loanRepayDay?: number;
  rental?: 'rent' | 'owner';
  monthlyRent?: number;
  // car
  purchasePrice?: number;
  purchaseYear?: number;
  depreciationRate?: number;
  insuranceMonth?: number;
  insuranceFee?: number;
  // crypto
  holdings?: number;
  unitPrice?: number;
  // cash
  amount?: number;
  interestRate?: number;
  // insurance
  cashValue?: number;
  // debt（复用 amount）
}

export const TYPE_DEFS: Record<AssetType, { name: string; icon: string }> = {
  house: { name: '房产', icon: '🏠' },
  car: { name: '车辆', icon: '🚗' },
  crypto: { name: '虚拟资产', icon: '₿' },
  cash: { name: '存款/理财', icon: '💰' },
  insurance: { name: '保险现金价值', icon: '🛡️' },
  debt: { name: '负债', icon: '💳' },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 单项现值（资产为正，debt 为负） */
export function calcValue(a: Asset): number {
  if (!a) return 0;
  switch (a.type) {
    case 'house': return a.currentValue || 0;
    case 'car': {
      const rate = a.depreciationRate != null ? a.depreciationRate : 0.15;
      const years = Math.max(0, new Date().getFullYear() - (a.purchaseYear || new Date().getFullYear()));
      return Math.round((a.purchasePrice || 0) * Math.pow(1 - rate, years));
    }
    case 'crypto': return round2((a.holdings || 0) * (a.unitPrice || 0));
    case 'cash': return a.amount || 0;
    case 'insurance': return a.cashValue || 0;
    case 'debt': return -(a.amount || 0);
    default: return 0;
  }
}

export interface AssetSummary {
  totalAssets: number;
  totalLiabilities: number;
  net: number;
  byType: Record<AssetType, number>;
  passiveIncome: number;
  monthlyFixed: number;
  count: number;
}

export function getSummary(): AssetSummary {
  const all = getAssets();
  let totalAssets = 0, totalLiabilities = 0, passiveIncome = 0, monthlyFixed = 0;
  const byType: Record<AssetType, number> = { house: 0, car: 0, crypto: 0, cash: 0, insurance: 0, debt: 0 };
  all.forEach(a => {
    const v = calcValue(a);
    if (a.type === 'debt') {
      totalLiabilities += Math.abs(v);
      byType.debt += Math.abs(v);
    } else {
      totalAssets += v;
      byType[a.type] += v;
    }
    if ((a.type === 'house' || a.type === 'car') && (a.loanBalance || 0) > 0) {
      totalLiabilities += a.loanBalance || 0;
    }
    if (a.type === 'house' && a.rental === 'rent') passiveIncome += a.monthlyRent || 0;
    if (a.type === 'cash' && (a.interestRate || 0) > 0 && (a.amount || 0) > 0) {
      passiveIncome += (a.amount || 0) * (a.interestRate || 0) / 12;
    }
    if ((a.loanMonthly || 0) > 0) monthlyFixed += a.loanMonthly || 0;
  });
  return {
    totalAssets: Math.round(totalAssets),
    totalLiabilities: Math.round(totalLiabilities),
    net: Math.round(totalAssets - totalLiabilities),
    byType,
    passiveIncome: Math.round(passiveIncome),
    monthlyFixed: Math.round(monthlyFixed),
    count: all.length,
  };
}

// ========== CRUD ==========

export function getAssets(type?: AssetType): Asset[] {
  const all = storage.get<Asset[]>(KEYS.ASSETS) ?? [];
  return type ? all.filter(a => a.type === type) : all;
}

function saveAssets(list: Asset[]): void {
  storage.set(KEYS.ASSETS, list);
}

let _idSeq = 0;
function genId(): string {
  _idSeq += 1;
  return `ast_${Date.now()}_${_idSeq}`;
}

export function addAsset(asset: Omit<Asset, 'id' | 'createdAt'>): Asset[] {
  const newAsset: Asset = { ...asset, id: genId(), createdAt: new Date().toISOString() };
  const updated = [...getAssets(), newAsset];
  saveAssets(updated);
  return updated;
}

export function updateAsset(id: string, updates: Partial<Asset>): Asset[] {
  const updated = getAssets().map(a => (a.id === id ? { ...a, ...updates } : a));
  saveAssets(updated);
  return updated;
}

export function deleteAsset(id: string): Asset[] {
  saveAssets(getAssets().filter(a => a.id !== id));
  return getAssets();
}

export function deleteByLinkedEntity(linkedId: string): Asset[] {
  saveAssets(getAssets().filter(a => a.linkedEntityId !== linkedId));
  return getAssets();
}

// ========== 双写镜像：financeState 聚合 → fin_assets 分散 ==========

/**
 * financeState 聚合资产 → fin_assets 分散（镜像写入）。
 * 每次 financeState 变化时调，保持 fin_assets 同步。
 * property→house, vehicle→car, cryptos→crypto[], savings→cash[], insurance→insurance, otherLiabilities→debt。
 */
export function syncAssetsFromFinanceState(state: FinanceAppState): Asset[] {
  const assets: Asset[] = [];
  const now = new Date().toISOString();

  if (state.property) {
    const p = state.property;
    assets.push({
      id: 'ast_property', type: 'house', name: p.address || '房产', icon: '🏠', createdAt: now,
      currentValue: p.currentValue, loanBalance: p.loanBalance, loanMonthly: p.monthlyPayment,
      loanRepayDay: p.payDay, rental: p.isRented ? 'rent' : 'owner', monthlyRent: p.rentIncome,
    });
  }
  if (state.vehicle) {
    const v = state.vehicle;
    assets.push({
      id: 'ast_vehicle', type: 'car', name: v.name || '车辆', icon: '🚗', createdAt: now,
      purchasePrice: v.purchasePrice, purchaseYear: new Date().getFullYear() - v.age,
      depreciationRate: v.depreciationRate / 100, loanBalance: v.loanBalance, loanMonthly: v.monthlyPayment,
    });
  }
  state.cryptos.forEach((c, i) => {
    assets.push({
      id: `ast_crypto_${i}`, type: 'crypto', name: c.coin, icon: '₿', createdAt: now,
      holdings: c.amount, unitPrice: c.price,
    });
  });
  state.savings.forEach((s, i) => {
    assets.push({
      id: `ast_cash_${i}`, type: 'cash', name: s.name, icon: '💰', createdAt: now,
      amount: s.amount, interestRate: s.annualRate,
    });
  });
  if (state.insuranceCashValue) {
    assets.push({
      id: 'ast_insurance', type: 'insurance', name: '商业保险', icon: '🛡️', createdAt: now,
      cashValue: state.insuranceCashValue,
    });
  }
  if (state.otherLiabilities) {
    assets.push({
      id: 'ast_debt', type: 'debt', name: '其他负债', icon: '💳', createdAt: now,
      amount: state.otherLiabilities,
    });
  }

  saveAssets(assets);
  return assets;
}

/** 首次迁移：fin_assets 为空 → 从 financeState 同步。 */
export function ensureAssets(state: FinanceAppState): Asset[] {
  if (getAssets().length === 0) {
    return syncAssetsFromFinanceState(state);
  }
  return getAssets();
}

// TODO(转小程序): settleInterest（存款派息 + fin_interest_log 幂等）—— web 不调（双写方案用 financeState savings），
// 转小程序时加（调 records.addRecord 生成利息收入记录）。
