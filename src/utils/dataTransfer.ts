import { storage } from '../storage';
import { KEYS } from '../storage/keys';

/**
 * 数据导出/恢复（新版 FinanceHub 格式，平台无关）。
 * 导出枚举各业务 key（排除 fin_pin）；恢复校验 _meta.app + 写回。
 * 与 legacyImport（老版→新版）独立。
 */

const EXPORT_KEYS = [
  KEYS.RECORDS,
  KEYS.ACCOUNTS,
  KEYS.GROWTH,
  KEYS.TEMPLATES,
  KEYS.AUTO_LOG,
  KEYS.REMINDERS,
  KEYS.APP_STATE,
  KEYS.STOCKS,
  KEYS.VISION_IMG,
];

export function exportData(): string {
  const data: Record<string, unknown> = {
    _meta: { app: 'FinanceHub', version: '1.0', exportDate: new Date().toISOString() },
  };
  for (const key of EXPORT_KEYS) {
    const v = storage.get(key);
    if (v != null) data[key] = v;
  }
  return JSON.stringify(data, null, 2);
}

export function restoreData(json: string): { ok: boolean; msg: string } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, msg: 'JSON 格式错误，请粘贴完整有效的 JSON' };
  }
  const meta = parsed._meta as { app?: string } | undefined;
  if (!meta || meta.app !== 'FinanceHub') {
    return { ok: false, msg: '校验失败：这不是 FinanceHub 导出的数据' };
  }
  try {
    for (const key of EXPORT_KEYS) {
      if (parsed[key] !== undefined) storage.set(key, parsed[key]);
    }
    return { ok: true, msg: '恢复成功，即将刷新页面生效' };
  } catch (e) {
    return { ok: false, msg: `恢复失败：${(e as Error).message}` };
  }
}
