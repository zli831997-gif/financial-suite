import type { Storage } from './interface';

/**
 * 存储实例。默认惰性绑定：在浏览器环境用 localStorage（H5/Capacitor），
 * 在无 localStorage 的环境（如微信小程序）留空，等跨端入口注入适配器。
 *
 * 跨端注入：小程序等环境在应用启动时调用
 * `setStorageImpl(createMiniappStorage())` 注入平台适配器，之后 domain 层零改动复用。
 * 见 cross-platform/src/adapters/index.ts。
 *
 * 之所以用「可变实例 + 注入」而非导出工厂，是因为 domain 层
 * （records/accounts/gamification 等）都用 `import { storage }` 拿单例，
 * 必须保证它们拿到的是「注入后」的实例。用惰性对象避免在模块加载阶段
 * 就执行 createWebStorage（小程序无 localStorage 会崩）。
 */
function createInitialImpl(): Storage {
  // 浏览器环境才初始化 web 实现；否则留空，等注入
  if (typeof localStorage !== 'undefined') {
    const { createWebStorage } = require('../adapters/webStorage');
    return createWebStorage();
  }
  return { get: () => null, set: () => {}, remove: () => {}, has: () => false };
}

export const storage: Storage = createInitialImpl();

/** 运行时注入存储实现（跨端入口）。H5 端无需调用。 */
export function setStorageImpl(impl: Storage): void {
  // 保留同一引用：把注入实现的方法拷到现有对象上，避免 import 侧拿旧引用
  Object.assign(storage, impl);
}

export type { Storage } from './interface';
