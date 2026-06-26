import { useEffect, useState } from 'react';
import { isBrowser } from '../utils/platform';
import { addRecordFromNotification } from '@finance/logic/domain/records';

/**
 * 自动记账 hook（仅安卓 APP，小程序/H5 自动失效）。
 *
 * 监听原生 AutoBookPlugin 的 'auto-book' 事件，收到支付通知 → 去重写入记账。
 * 用动态 import 隔离 @capacitor/core：小程序构建时不会打包 Capacitor（无此依赖）。
 *
 * Capacitor 的 registerPlugin 在 H5/小程序端调用会抛错或无操作，
 * 整个监听逻辑包在 try/catch + isBrowser 里，非安卓静默跳过。
 *
 * 用法：在 App 根组件调用 const refreshKey = useAutoBook();
 *      refreshKey 变化时，记账页应重新读取 storage 刷新列表。
 */
// Capacitor 插件的最小类型（registerPlugin 返回 unknown，用结构断言）
interface AutoBookPluginProxy {
  addListener?: (event: string, cb: (data: any) => void) => Promise<any> | void;
  checkPermission?: () => Promise<{ enabled: boolean }>;
  openPermissionSettings?: () => Promise<void>;
}

export function useAutoBook(): number {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isBrowser) return; // 小程序无此能力

    let cleanup: (() => void) | undefined;
    // 动态 import，避免小程序/H5 打包时拉 Capacitor
    import('@capacitor/core')
      .then(({ registerPlugin }) => {
        try {
          const AutoBook = registerPlugin('AutoBook') as AutoBookPluginProxy;
          if (typeof AutoBook.addListener !== 'function') return;
          const handleP = AutoBook.addListener('auto-book', (data: any) => {
            const record = addRecordFromNotification({
              sourceApp: data.sourceApp,
              amount: data.amount,
              type: data.type,
              text: data.text,
              dedupeKey: data.dedupeKey,
              timestamp: data.timestamp,
            });
            if (record) setRefreshKey((k) => k + 1);
          });
          cleanup = () => {
            Promise.resolve(handleP)
              .then((h: any) => h?.remove?.())
              .catch(() => {});
          };
        } catch {
          // H5 环境无 AutoBook 插件，静默
        }
      })
      .catch(() => {
        // @capacitor/core 不存在（小程序环境），静默
      });

    return () => cleanup?.();
  }, []);

  return refreshKey;
}

/**
 * 检查自动记账权限（仅安卓，跳转系统设置授权）。
 * 小程序/H5 端调用静默返回 false，不跳转。
 */
export async function openAutoBookPermission(): Promise<boolean> {
  if (!isBrowser) return false;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const AutoBook = registerPlugin('AutoBook') as AutoBookPluginProxy;
    if (typeof AutoBook.checkPermission !== 'function') return false;
    const res = await AutoBook.checkPermission();
    if (!res.enabled) {
      await AutoBook.openPermissionSettings?.();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
