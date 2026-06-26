import { storage } from '../storage';
import { KEYS } from '../storage/keys';
import { todayStr, getDefaultGrowth } from '../logic/domain/gamification';
import type { Transaction } from '../types';
import type { Account } from '../logic/domain/accounts';
import type { GrowthState } from '../logic/domain/gamification';
import type { Template } from '../logic/domain/templates';
import type { Reminder } from '../logic/domain/reminders';
import { INITIAL_STATE } from './financeState';
import type { FinanceAppState, PropertyEntity, VehicleEntity, CryptoEntity, SavingEntity } from './financeState';

/**
 * 老版（财务通小程序）数据导入工具（平台无关）。
 * 老版导出 { _meta:{app:'财务通',...}, fin_records, fin_accounts, fin_growth, fin_templates, fin_reminders, fin_auto_log, fin_user_profile, fin_assets, ... }
 * 新版对齐 fin_ 但字段名/类型有差异，逐字段转换后写入。
 */

export interface ImportResult {
  ok: boolean;
  msg: string;
  counts: Record<string, number>;
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return isNaN(n) ? d : n;
}
function str(v: unknown, d = ''): string {
  return v == null ? d : String(v);
}

function convertRecords(oldList: any[]): Transaction[] {
  return (oldList || []).map((r): Transaction => ({
    id: str(r.id),
    type: r.type === 'income' ? 'income' : 'expense',
    amount: num(r.amount),
    category: str(r.categoryName || r.category, '其他'),
    categoryId: r.categoryId != null ? str(r.categoryId) : undefined,
    accountId: r.accountId != null ? str(r.accountId) : undefined,
    accountName: r.accountName ? str(r.accountName) : undefined,
    date: str(r.date, todayStr()),
    time: r.time ? str(r.time) : undefined,
    note: str(r.note, ''),
    important: false,
    entityId: r.entityId != null ? str(r.entityId) : undefined,
  }));
}

function convertAccounts(oldList: any[]): Account[] {
  return (oldList || []).map((a): Account => ({
    id: str(a.id),
    name: str(a.name, '账户'),
    icon: str(a.icon, '💵'),
    type: a.type || 'cash',
    balance: num(a.balance),
    sort: num(a.sort, 0),
  }));
}

function convertTemplates(oldList: any[]): Template[] {
  return (oldList || []).map((t): Template => ({
    id: str(t.id),
    name: str(t.name, '模板'),
    type: t.type === 'income' ? 'income' : 'expense',
    amount: num(t.amount),
    category: str(t.categoryName || t.category, '其他'),
    cycle: t.cycle || 'monthly',
    day: t.day != null ? num(t.day) : undefined,
    weekday: t.weekday != null ? num(t.weekday) : undefined,
    accountId: str(t.accountId || 'acc_debit'),
    accountName: t.accountName ? str(t.accountName) : undefined,
    note: str(t.note, ''),
    enabled: t.enabled !== false,
    linkedEntityId: t.linkedEntityId != null ? str(t.linkedEntityId) : undefined,
    createdAt: str(t.createdAt, todayStr()),
  }));
}

function convertReminders(oldList: any[]): Reminder[] {
  return (oldList || []).map((r): Reminder => ({
    id: str(r.id),
    type: r.type || 'custom',
    name: str(r.name, '提醒'),
    icon: str(r.icon, '⏰'),
    amount: num(r.amount),
    day: num(r.day, 1),
    linkedEntityId: r.linkedEntityId != null ? str(r.linkedEntityId) : undefined,
    note: str(r.note, ''),
    createdAt: str(r.createdAt, todayStr()),
  }));
}

function convertAutoLog(old: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (old && typeof old === 'object') {
    for (const [date, ids] of Object.entries(old)) {
      out[date] = (ids as any[]).map(id => str(id));
    }
  }
  return out;
}

function convertGrowth(old: any): GrowthState {
  return { ...getDefaultGrowth(), ...(old || {}) } as GrowthState;
}

function convertProfileAndAssets(profile: any, assets: any[]): FinanceAppState {
  const state: FinanceAppState = { ...INITIAL_STATE };

  if (profile) {
    state.profile = {
      ...state.profile,
      city: str(profile.city, state.profile.city),
      monthlyNetSalary: num(profile.monthlySalary, state.profile.monthlyNetSalary),
      age: num(profile.currentAge != null ? profile.currentAge : profile.age, state.profile.age),
      retireAge: num(profile.retireAge, state.profile.retireAge),
      socialInsuranceSelf: num(profile.socialBase, 0),
    };
  }

  const list = assets || [];
  const houses = list.filter(a => a.type === 'house');
  const cars = list.filter(a => a.type === 'car');
  const cryptos = list.filter(a => a.type === 'crypto');
  const cash = list.filter(a => a.type === 'cash');
  const insurance = list.filter(a => a.type === 'insurance');
  const debts = list.filter(a => a.type === 'debt');

  if (houses.length > 0) {
    const h = houses[0];
    const prop: PropertyEntity = {
      buyingPrice: num(h.purchasePrice || h.currentValue),
      currentValue: num(h.currentValue),
      loanBalance: num(h.loanBalance),
      loanRate: num(h.loanRate, 4),
      monthlyPayment: num(h.loanMonthly),
      payDay: num(h.loanRepayDay, 1),
      isRented: h.rental === 'rent',
      rentIncome: num(h.monthlyRent, 0),
      address: str(h.name, '我的房产'),
      isFullyPaid: num(h.loanBalance) <= 0,
    };
    state.property = prop;
    state.profile.hasHouse = true;
  }
  if (cars.length > 0) {
    const c = cars[0];
    const thisYear = new Date().getFullYear();
    state.vehicle = {
      name: str(c.name, '我的车'),
      purchasePrice: num(c.purchasePrice),
      age: Math.max(0, thisYear - num(c.purchaseYear, thisYear)),
      depreciationRate: num(c.depreciationRate, 15),
      insuranceMonth: num(c.insuranceMonth, 0),
      loanBalance: num(c.loanBalance),
      monthlyPayment: num(c.loanMonthly),
      isFullyPaid: num(c.loanBalance) <= 0,
    } as VehicleEntity;
    state.profile.hasCar = true;
  }
  state.cryptos = cryptos.map((c, i): CryptoEntity => ({
    id: str(c.id, `crypto_${i}`),
    coin: str(c.currency || c.coin, 'CRYPTO'),
    amount: num(c.holdings != null ? c.holdings : c.amount),
    price: num(c.unitPrice || c.price),
  }));
  state.savings = cash.map((c, i): SavingEntity => ({
    id: str(c.id, `save_${i}`),
    name: str(c.name, '存款'),
    amount: num(c.amount),
    annualRate: num(c.interestRate, 0),
  }));
  state.insuranceCashValue = insurance.reduce((s, a) => s + num(a.cashValue), 0);
  state.otherLiabilities = debts.reduce((s, a) => s + num(a.amount), 0);
  return state;
}

export function importFromLegacy(raw: unknown): ImportResult {
  const counts: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') {
    return { ok: false, msg: '数据格式不对，请粘贴老版导出的完整 JSON', counts };
  }
  const data = raw as Record<string, any>;
  if (data._meta?.app !== '财务通') {
    return { ok: false, msg: '校验失败：这不是「财务通」导出的数据（_meta.app 不匹配）', counts };
  }
  try {
    const records = convertRecords(data.fin_records);
    const accounts = convertAccounts(data.fin_accounts);
    const growth = convertGrowth(data.fin_growth);
    const templates = convertTemplates(data.fin_templates);
    const reminders = convertReminders(data.fin_reminders);
    const autoLog = convertAutoLog(data.fin_auto_log);
    const financeState = convertProfileAndAssets(data.fin_user_profile, data.fin_assets);

    storage.set(KEYS.RECORDS, records);
    storage.set(KEYS.ACCOUNTS, accounts);
    storage.set(KEYS.GROWTH, growth);
    storage.set(KEYS.TEMPLATES, templates);
    storage.set(KEYS.REMINDERS, reminders);
    storage.set(KEYS.AUTO_LOG, autoLog);
    storage.set(KEYS.APP_STATE, financeState);

    counts.records = records.length;
    counts.accounts = accounts.length;
    counts.templates = templates.length;
    counts.reminders = reminders.length;
    counts.assets = (data.fin_assets || []).length;
    counts.profile = data.fin_user_profile ? 1 : 0;

    return { ok: true, msg: '导入成功，即将刷新页面生效', counts };
  } catch (e) {
    return { ok: false, msg: `导入失败：${(e as Error).message}`, counts };
  }
}
