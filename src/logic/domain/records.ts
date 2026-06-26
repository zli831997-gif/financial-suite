import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';
import type { Transaction } from '../../types';
import { adjustAccountBalance, ensureAccounts } from './accounts';

let _idSeq = 0;
/** ID 生成：时间戳 + 自增序列（移植老版 dataManager.genId），避免批量撞 ID。 */
export function genId(): string {
  _idSeq += 1;
  return `${Date.now()}_${_idSeq}`;
}

export function getRecords(): Transaction[] {
  return storage.get<Transaction[]>(KEYS.RECORDS) ?? [];
}

function saveRecords(records: Transaction[]): void {
  storage.set(KEYS.RECORDS, records);
}

/** 记账→账户余额联动：expense 减、income 加；reverse=true 回退（删除时）。 */
function updateBalanceForRecord(record: Transaction, reverse = false): void {
  if (!record.accountId) return;
  const sign = reverse ? -1 : 1;
  let delta = 0;
  if (record.type === 'expense') delta = -sign * record.amount;
  else if (record.type === 'income') delta = sign * record.amount;
  if (delta !== 0) adjustAccountBalance(record.accountId, delta);
}

export function addRecord(record: Transaction): Transaction[] {
  const newRecord: Transaction = { ...record, id: record.id || genId() };
  const updated = [...getRecords(), newRecord];
  saveRecords(updated);
  updateBalanceForRecord(newRecord);
  // TODO(阶段2b): 接 gamification.onRecordCreated(newRecord) 触发打卡/积分/徽章
  return updated;
}

export function deleteRecord(id: string): Transaction[] {
  const records = getRecords();
  const target = records.find(r => r.id === id);
  const updated = records.filter(r => r.id !== id);
  saveRecords(updated);
  if (target) updateBalanceForRecord(target, true); // 回退账户余额
  return updated;
}

/** 更新单条记录（如标记重要），不涉及账户余额。 */
export function updateRecord(id: string, updates: Partial<Transaction>): Transaction[] {
  const records = getRecords().map(r => (r.id === id ? { ...r, ...updates } : r));
  saveRecords(records);
  return records;
}

/** 一次性迁移：旧 finance_hub_transactions_v2 → fin_records（补默认账户）。幂等。 */
export function migrateLegacyTransactions(): void {
  const legacy = storage.get<Transaction[]>(KEYS.TRANSACTIONS);
  if (!legacy || legacy.length === 0) return;
  // 已有 fin_records 数据则不覆盖，仅清掉旧 key
  if (getRecords().length > 0) {
    storage.remove(KEYS.TRANSACTIONS);
    return;
  }
  const migrated: Transaction[] = legacy.map(t => ({
    ...t,
    accountId: t.accountId ?? 'acc_wechat',
    accountName: t.accountName ?? '微信',
    time: t.time ?? '12:00',
  }));
  saveRecords(migrated);
  migrated.forEach(rec => updateBalanceForRecord(rec)); // 补齐账户余额联动
  storage.remove(KEYS.TRANSACTIONS);
}

/** 演示数据（首次打开 fin_records 为空时兜底，让用户有数据可看）。 */
export const DEMO_RECORDS: Transaction[] = [
  { id: 'demo_1', date: '2026-06-21', type: 'expense', amount: 35, category: '餐饮', note: '早午餐咖啡', accountId: 'acc_wechat', accountName: '微信', time: '12:30' },
  { id: 'demo_2', date: '2026-06-20', type: 'income', amount: 15000, category: '工资', note: '6月份实发工资', accountId: 'acc_debit', accountName: '储蓄卡', time: '09:00' },
];

/**
 * 初始化记账数据：确保账户 → 迁移旧数据 → 兜底演示数据。
 * 返回当前 fin_records（供 React state 初始化）。
 */
export function ensureRecords(): Transaction[] {
  ensureAccounts();
  migrateLegacyTransactions();
  const existing = getRecords();
  if (existing.length > 0) return existing;
  // 兜底演示数据，并联动账户余额
  saveRecords(DEMO_RECORDS);
  DEMO_RECORDS.forEach(rec => updateBalanceForRecord(rec));
  return DEMO_RECORDS;
}
