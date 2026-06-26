import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';
import type { Transaction } from '../../types';
import { todayStr, addDaysStr } from './gamification';

/**
 * 自动记账模板 domain — 移植自老版 templateEngine.js（平台无关，wx→storage）。
 * 固定账单（房贷/工资等）按周期自动入账，fin_auto_log 防同日重复。
 * 日期复用 gamification domain 的本地时区工具。
 */

export type Cycle = 'monthly' | 'weekly' | 'daily';

export interface Template {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  cycle: Cycle;
  day?: number;      // monthly: 每月几号（1-31）
  weekday?: number;  // weekly: 每周几（0=周日，1-6=周一到周六）
  accountId: string;
  accountName?: string;
  note: string;
  enabled: boolean;
  linkedEntityId?: string; // 关联实体（房产/车），阶段4 entitySync 用
  createdAt: string;
}

let _idSeq = 0;
function genId(): string {
  _idSeq += 1;
  return `tpl_${Date.now()}_${_idSeq}`;
}

/** 默认模板（对齐老版 getDefaultTemplates）。用户可在 AccountingView 编辑对齐实际。 */
export function getDefaultTemplates(): Template[] {
  const now = todayStr();
  return [
    { id: 'tpl_salary', name: '工资', type: 'income', amount: 15000, category: '工资', cycle: 'monthly', day: 10, accountId: 'acc_debit', accountName: '储蓄卡', note: '月度工资', enabled: true, createdAt: now },
    { id: 'tpl_rent', name: '房租', type: 'expense', amount: 3000, category: '住房', cycle: 'monthly', day: 1, accountId: 'acc_debit', accountName: '储蓄卡', note: '月度房租', enabled: true, createdAt: now },
    { id: 'tpl_loan', name: '房贷', type: 'expense', amount: 5000, category: '住房', cycle: 'monthly', day: 20, accountId: 'acc_debit', accountName: '储蓄卡', note: '房贷月供', enabled: true, createdAt: now },
    { id: 'tpl_phone', name: '话费', type: 'expense', amount: 99, category: '其他', cycle: 'monthly', day: 5, accountId: 'acc_alipay', accountName: '支付宝', note: '手机月套餐', enabled: true, createdAt: now },
  ];
}

export function getTemplates(): Template[] {
  return storage.get<Template[]>(KEYS.TEMPLATES) ?? [];
}

function saveTemplates(t: Template[]): void {
  storage.set(KEYS.TEMPLATES, t);
}

/** 首次写入默认模板（幂等，已有数据不覆盖）。 */
export function ensureTemplates(): Template[] {
  const existing = getTemplates();
  if (existing.length > 0) return existing;
  const defaults = getDefaultTemplates();
  saveTemplates(defaults);
  return defaults;
}

export function addTemplate(t: Omit<Template, 'id' | 'createdAt'>): Template[] {
  const newTpl: Template = { ...t, id: genId(), createdAt: todayStr() };
  const updated = [...getTemplates(), newTpl];
  saveTemplates(updated);
  return updated;
}

export function updateTemplate(id: string, updates: Partial<Template>): Template[] {
  const updated = getTemplates().map(t => (t.id === id ? { ...t, ...updates } : t));
  saveTemplates(updated);
  return updated;
}

export function deleteTemplate(id: string): Template[] {
  const updated = getTemplates().filter(t => t.id !== id);
  saveTemplates(updated);
  return updated;
}

export function getByLinkedEntity(linkedId: string): Template[] {
  return getTemplates().filter(t => t.linkedEntityId === linkedId);
}

export function deleteByLinkedEntity(linkedId: string): Template[] {
  const updated = getTemplates().filter(t => t.linkedEntityId !== linkedId);
  saveTemplates(updated);
  return updated;
}

// ========== fin_auto_log：{ 'YYYY-MM-DD': templateId[] } ==========
type AutoLog = Record<string, string[]>;

function getAutoLog(): AutoLog {
  return storage.get<AutoLog>(KEYS.AUTO_LOG) ?? {};
}

/** 某模板今天是否已自动入账（UI 显示「今日已自动」用）。 */
export function isAutoLoggedToday(templateId: string): boolean {
  const log = getAutoLog();
  return (log[todayStr()] ?? []).includes(templateId);
}

/** 模板今天是否该执行（按周期）。 */
function shouldExecuteToday(tpl: Template, now: Date): boolean {
  switch (tpl.cycle) {
    case 'monthly': return now.getDate() === (tpl.day ?? 1);
    case 'weekly': return now.getDay() === (tpl.weekday ?? 1);
    case 'daily': return true;
    default: return false;
  }
}

/**
 * 检查今天该自动入账的模板，返回待入账记录 + 对应 templateId（不写日志、不入账）。
 * 调用方入账后应调 logExecution 记录已执行，保证幂等。
 */
export function checkAutoRecords(): { record: Transaction; templateId: string }[] {
  const today = todayStr();
  const now = new Date();
  const log = getAutoLog();
  const todayLog = log[today] ?? [];
  const out: { record: Transaction; templateId: string }[] = [];

  for (const tpl of getTemplates()) {
    if (!tpl.enabled) continue;
    if (todayLog.includes(tpl.id)) continue; // 幂等：今天已执行
    if (!shouldExecuteToday(tpl, now)) continue;

    out.push({
      templateId: tpl.id,
      record: {
        id: `auto_${tpl.id}_${today}`,
        type: tpl.type,
        amount: tpl.amount,
        category: tpl.category,
        accountId: tpl.accountId,
        accountName: tpl.accountName,
        date: today,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        note: `【自动】${tpl.name}`,
        entityId: tpl.linkedEntityId,
      },
    });
  }
  return out;
}

/** 记录已执行的 templateId（幂等）+ 清理30天前日志，防 storage 膨胀。 */
export function logExecution(templateIds: string[]): void {
  if (templateIds.length === 0) return;
  const today = todayStr();
  const log = getAutoLog();
  if (!log[today]) log[today] = [];
  for (const id of templateIds) {
    if (!log[today].includes(id)) log[today].push(id);
  }
  // 清理30天前
  const cutoff = addDaysStr(today, -30);
  for (const date of Object.keys(log)) {
    if (date < cutoff) delete log[date];
  }
  storage.set(KEYS.AUTO_LOG, log);
}
