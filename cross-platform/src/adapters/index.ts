import { setStorageImpl } from '@finance/storage';
import { isMiniProgram } from '../utils/platform';

/**
 * 绑定存储适配器到上游 storage 单例。
 * - 微信小程序：wxStorageSync（经 Taro）
 * - H5/Capacitor：localStorage
 *
 * 在 app.tsx 的 useLaunch 里调用。注入后 domain 层零改动复用。
 */
export function bindStorage(): void {
  if (isMiniProgram) {
    // 动态导入，避免 H5 打包时拉入 Taro 小程序适配器
    import('./miniappStorage').then(({ createMiniappStorage }) => {
      setStorageImpl(createMiniappStorage());
    });
  } else {
    import('./webStorage').then(({ createWebStorage }) => {
      setStorageImpl(createWebStorage());
    });
  }
}
