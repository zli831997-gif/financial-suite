import { storage } from '../../storage';
import { KEYS } from '../../storage/keys';

/**
 * 数据备份/恢复（纯逻辑，平台无关）。
 *
 * 防止换手机、重装、清缓存导致数据丢失——这是记账软件的命根子。
 *
 * 备份策略：枚举 KEYS 里所有用户数据 key（不含临时日志如 NOTIF_LOG），
 * 导出为单个 JSON。导入时按 key 还原。
 *
 * 导出/导入的实际文件 IO（下载/读取）由调用方处理（platform 层），
 * 本模块只负责 序列化/反序列化/校验。
 */

/** 需要备份的 key（用户产生的数据；不含 NOTIF_LOG 这类临时日志） */
const BACKUP_KEYS = [
  KEYS.APP_STATE,
  KEYS.RECORDS,
  KEYS.ACCOUNTS,
  KEYS.TEMPLATES,
  KEYS.STOCKS,
  KEYS.GROWTH,
  KEYS.LOANS,
  KEYS.SOCIALS,
] as const;

/** 备份文件结构 */
export interface BackupData {
  /** 固定标识，用于导入时校验 */
  __type: 'financehub-backup';
  /** 备份文件格式版本，未来字段变化时做迁移 */
  __version: 1;
  /** 备份时间（ISO） */
  exportedAt: string;
  /** app 版本（可选） */
  appVersion?: string;
  /** 各 key 对应的数据 */
  data: Record<string, unknown>;
}

/**
 * 导出当前所有用户数据为备份对象。
 */
export function exportBackup(): BackupData {
  const data: Record<string, unknown> = {};
  for (const key of BACKUP_KEYS) {
    const val = storage.get(key);
    if (val != null) data[key] = val;
  }
  return {
    __type: 'financehub-backup',
    __version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * 校验备份文件是否合法（导入前先校验，避免脏数据）。
 * @returns 错误信息，null 表示合法
 */
export function validateBackup(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return '备份文件格式错误（非对象）';
  const b = raw as Partial<BackupData>;
  if (b.__type !== 'financehub-backup') return '不是 FinanceHub 备份文件';
  if (typeof b.__version !== 'number') return '备份文件缺少版本号';
  if (!b.data || typeof b.data !== 'object') return '备份数据缺失';
  return null;
}

/**
 * 导入备份：把备份数据写回 storage。
 * 注意：会覆盖现有同 key 数据（导入即恢复，不合并）。
 * @returns 恢复的 key 数量
 */
export function importBackup(raw: unknown): { restored: number; keys: string[] } | { error: string } {
  const err = validateBackup(raw);
  if (err) return { error: err };
  const b = raw as BackupData;
  let count = 0;
  const restoredKeys: string[] = [];
  for (const key of Object.keys(b.data)) {
    storage.set(key, b.data[key]);
    count++;
    restoredKeys.push(key);
  }
  return { restored: count, keys: restoredKeys };
}

/** 备份文件名（含日期） */
export function backupFileName(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `financehub-backup-${ymd}.json`;
}
