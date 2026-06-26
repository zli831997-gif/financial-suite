import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';

export type AccountType = 'cash' | 'alipay' | 'wechat' | 'debit' | 'credit';

export interface Account {
  id: string;
  name: string;
  icon: string;
  type: AccountType;
  balance: number;
  sort: number;
  creditLimit?: number; // 信用卡额度
  billDay?: number;     // 信用卡账单日
  repayDay?: number;    // 信用卡还款日
}

/**
 * 默认账户（对齐老版）。语义：活期/支付账户，余额随记账联动变动。
 * 注意与 FinanceAppState.savings（定期/理财）区分，避免同一笔钱记两处。
 */
export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: '现金', icon: '💵', type: 'cash', balance: 0, sort: 1 },
  { id: 'acc_alipay', name: '支付宝', icon: '💳', type: 'alipay', balance: 0, sort: 2 },
  { id: 'acc_wechat', name: '微信', icon: '🟢', type: 'wechat', balance: 0, sort: 3 },
  { id: 'acc_debit', name: '储蓄卡', icon: '🏦', type: 'debit', balance: 0, sort: 4 },
  { id: 'acc_credit', name: '信用卡', icon: '🏦', type: 'credit', balance: 0, sort: 5 },
];

export function getAccounts(): Account[] {
  return storage.get<Account[]>(KEYS.ACCOUNTS) ?? [];
}

function saveAccounts(accounts: Account[]): void {
  storage.set(KEYS.ACCOUNTS, accounts);
}

/** 首次初始化默认账户（fin_accounts 为空时写入）。幂等。 */
export function ensureAccounts(): Account[] {
  const existing = getAccounts();
  if (existing.length > 0) return existing;
  saveAccounts(DEFAULT_ACCOUNTS);
  return DEFAULT_ACCOUNTS;
}

export function addAccount(account: Account): Account[] {
  const updated = [...getAccounts(), account];
  saveAccounts(updated);
  return updated;
}

export function updateAccount(id: string, updates: Partial<Account>): Account[] {
  const accounts = getAccounts().map(a => (a.id === id ? { ...a, ...updates } : a));
  saveAccounts(accounts);
  return accounts;
}

export function deleteAccount(id: string): Account[] {
  const accounts = getAccounts().filter(a => a.id !== id);
  saveAccounts(accounts);
  return accounts;
}

/** 按 accountId 调整单个账户余额（记账联动用，delta 可正可负）。 */
export function adjustAccountBalance(accountId: string, delta: number): Account[] {
  const accounts = getAccounts().map(a =>
    a.id === accountId ? { ...a, balance: Math.round((a.balance + delta) * 100) / 100 } : a
  );
  saveAccounts(accounts);
  return accounts;
}

export function getAccountById(id: string): Account | undefined {
  return getAccounts().find(a => a.id === id);
}

/**
 * 账户净余额：活期/支付账户余额求和（资产）− 信用卡余额（负债）。
 * 供净资产计算用（= 记账结余，补上阶段1缺失的现金结余口径）。
 */
export function getAccountsNetBalance(): number {
  return getAccounts().reduce((sum, a) => {
    if (a.type === 'credit') return sum - (a.balance || 0); // 信用卡欠款算负债
    return sum + (a.balance || 0);
  }, 0);
}
