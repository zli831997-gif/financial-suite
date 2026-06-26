import type { PropertyEntity, VehicleEntity } from './financeState';
import {
  addTemplate, updateTemplate, deleteTemplate,
  getByLinkedEntity as getTemplatesByEntity,
  deleteByLinkedEntity as deleteTemplatesByEntity,
  type Template,
} from '../logic/domain/templates';
import {
  addReminder, updateReminder, deleteReminder,
  getByLinkedEntity as getRemindersByEntity,
  deleteByLinkedEntity as deleteRemindersByEntity,
  type Reminder,
} from '../logic/domain/reminders';

/**
 * 实体联动：房产/车变更时，幂等派生 记账模板（fin_templates）+ 还款提醒（fin_reminders）。
 * upsert 保留 id（避免改档案→模板 id 变→fin_auto_log 失效→重复自动入账）。
 * 资产保持聚合 financeState（不独立），这里直接读 property/vehicle。
 */

type TemplateDefaults = Omit<Template, 'id' | 'createdAt' | 'linkedEntityId'>;
type ReminderDefaults = Omit<Reminder, 'id' | 'createdAt' | 'linkedEntityId'>;

/** upsert 联动模板：存在则 update（保留 id），不存在则 add；多条时只留第一条。 */
function upsertLinkedTemplate(linkedId: string, defaults: TemplateDefaults): void {
  const existing = getTemplatesByEntity(linkedId);
  if (existing.length > 0) {
    updateTemplate(existing[0].id, defaults);
    existing.slice(1).forEach(t => deleteTemplate(t.id)); // 清多余脏数据
  } else {
    addTemplate({ ...defaults, linkedEntityId: linkedId });
  }
}

/** upsert 联动提醒。 */
function upsertLinkedReminder(linkedId: string, defaults: ReminderDefaults): void {
  const existing = getRemindersByEntity(linkedId);
  if (existing.length > 0) {
    updateReminder(existing[0].id, defaults);
    existing.slice(1).forEach(r => deleteReminder(r.id));
  } else {
    addReminder({ ...defaults, linkedEntityId: linkedId });
  }
}

/** 移除某联动 key 的模板 + 提醒（已还清/无贷款时）。 */
function removeLinked(linkedId: string): void {
  deleteTemplatesByEntity(linkedId);
  deleteRemindersByEntity(linkedId);
}

/**
 * 房产/车变更时同步派生模板与提醒（幂等）。
 * - 房贷 → 月供模板(day=payDay) + 还款提醒
 * - 房出租 → 租金收入模板(day=1)
 * - 车贷 → 月供模板(day=15，vehicle 无 payDay 用默认) + 还款提醒
 */
export function syncEntityAll(property: PropertyEntity | null, vehicle: VehicleEntity | null): void {
  // —— 房产贷款 ——
  if (property && !property.isFullyPaid && property.monthlyPayment > 0) {
    upsertLinkedTemplate('property-loan', {
      name: '房贷月供', type: 'expense', amount: property.monthlyPayment, category: '住房',
      cycle: 'monthly', day: property.payDay, accountId: 'acc_debit', accountName: '储蓄卡',
      note: '房贷月供(联动房产)', enabled: true,
    });
    upsertLinkedReminder('property-loan', {
      type: 'loan', name: '房贷还款', icon: '🏠', amount: property.monthlyPayment, day: property.payDay, note: '房贷月供还款(联动)',
    });
  } else {
    removeLinked('property-loan');
  }

  // —— 房产出租 ——
  if (property && property.isRented && property.rentIncome > 0) {
    upsertLinkedTemplate('property-rent', {
      name: '房租收入', type: 'income', amount: property.rentIncome, category: '其他',
      cycle: 'monthly', day: 1, accountId: 'acc_debit', accountName: '储蓄卡',
      note: '租金收入(联动房产)', enabled: true,
    });
  } else {
    removeLinked('property-rent');
  }

  // —— 车贷 ——
  if (vehicle && !vehicle.isFullyPaid && vehicle.monthlyPayment > 0) {
    upsertLinkedTemplate('vehicle-loan', {
      name: '车贷月供', type: 'expense', amount: vehicle.monthlyPayment, category: '交通',
      cycle: 'monthly', day: 15, accountId: 'acc_debit', accountName: '储蓄卡',
      note: '车贷月供(联动车辆)', enabled: true,
    });
    upsertLinkedReminder('vehicle-loan', {
      type: 'loan', name: '车贷还款', icon: '🚗', amount: vehicle.monthlyPayment, day: 15, note: '车贷月供还款(联动)',
    });
  } else {
    removeLinked('vehicle-loan');
  }
}
