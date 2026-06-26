import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';
import { todayStr } from './gamification';

/**
 * 账单提醒 domain（平台无关，wx→storage）。
 * 还款/续保等到期提醒，entitySync 从房/车贷款派生，也可手动加。
 */

export type ReminderType = 'loan' | 'insurance' | 'rent' | 'custom';

export interface Reminder {
  id: string;
  type: ReminderType;
  name: string;
  icon: string;
  amount: number;
  day: number;       // 每月几号（1-31）
  linkedEntityId?: string; // 关联实体（entitySync 派生用）
  note: string;
  createdAt: string;
}

let _idSeq = 0;
function genId(): string {
  _idSeq += 1;
  return `rem_${Date.now()}_${_idSeq}`;
}

export function getReminders(): Reminder[] {
  return storage.get<Reminder[]>(KEYS.REMINDERS) ?? [];
}

function saveReminders(r: Reminder[]): void {
  storage.set(KEYS.REMINDERS, r);
}

export function addReminder(r: Omit<Reminder, 'id' | 'createdAt'>): Reminder[] {
  const newR: Reminder = { ...r, id: genId(), createdAt: todayStr() };
  saveReminders([...getReminders(), newR]);
  return getReminders();
}

export function updateReminder(id: string, updates: Partial<Reminder>): Reminder[] {
  const updated = getReminders().map(r => (r.id === id ? { ...r, ...updates } : r));
  saveReminders(updated);
  return updated;
}

export function deleteReminder(id: string): Reminder[] {
  const updated = getReminders().filter(r => r.id !== id);
  saveReminders(updated);
  return updated;
}

export function deleteByLinkedEntity(linkedId: string): Reminder[] {
  const updated = getReminders().filter(r => r.linkedEntityId !== linkedId);
  saveReminders(updated);
  return updated;
}

export function getByLinkedEntity(linkedId: string): Reminder[] {
  return getReminders().filter(r => r.linkedEntityId === linkedId);
}
