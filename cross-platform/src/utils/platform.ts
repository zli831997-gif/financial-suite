/**
 * 平台抽象层（跨端地基）。
 *
 * 设计原则：
 * - 所有 UI 代码（pages/components/hooks）只许调用本文件的函数，
 *   禁止直接调 window.* / document.* / navigator.* / location.*。
 * - 本文件按「运行环境」分流：H5/Capacitor 走 Web API，微信小程序走 Taro API。
 * - 判定标准：UI 层 grep 不到 window./document./navigator./location. 即合格。
 *
 * 小程序的 Taro.* 是异步 Promise，而 H5 的 window.confirm/prompt 是同步。
 * 这里统一提供「同步版（H5 专用）」和「异步版（跨端通用，推荐）」两套，
 * 调用点尽量用异步版；确实只能同步判断的地方用同步版（仅 H5 生效）。
 */

// 运行时环境判定。微信小程序定义了 wx，且无 window/document。
const isMiniProgram =
  typeof wx !== 'undefined' && typeof window === 'undefined';

/** 是否在浏览器环境（H5 / Capacitor WebView）。 */
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/** 是否在微信小程序。 */
export { isMiniProgram };

/* --------------------------- 异步版（跨端通用，推荐） --------------------------- */

/**
 * 异步确认框。返回 true=确认 / false=取消。
 * - H5：window.confirm（同步语义，包成 Promise）
 * - 小程序：Taro.showModal（原生 Promise）
 */
export async function confirmAsync(message: string, title = '提示'): Promise<boolean> {
  if (isMiniProgram) {
    const { showModal } = await import('@tarojs/taro');
    const res = await showModal({ title, content: message });
    return res.confirm;
  }
  return window.confirm(message);
}

/**
 * 异步输入框。返回用户输入，或 null=取消。
 * - H5：window.prompt
 * - 小程序：原生无输入弹窗，这里回退 null；调用方需用自定义输入弹窗组件替代。
 *   （PIN 设置/编辑金额等场景，UI 层应改用自定义 Modal 而非依赖此函数。）
 */
export async function promptAsync(message: string, defaultValue = ''): Promise<string | null> {
  if (isMiniProgram) {
    // 小程序无同步输入框，调用方应改用自定义输入弹窗组件
    return null;
  }
  return window.prompt(message, defaultValue);
}

/** 异步提示 toast。 */
export async function alertAsync(message: string): Promise<void> {
  if (isMiniProgram) {
    const { showToast } = await import('@tarojs/taro');
    await showToast({ title: message, icon: 'none', duration: 2000 });
    return;
  }
  window.alert(message);
}

/** 复制到剪贴板。返回是否成功。 */
export async function copyText(text: string): Promise<boolean> {
  if (isMiniProgram) {
    const { setClipboardData } = await import('@tarojs/taro');
    try {
      await setClipboardData({ data: text });
      return true;
    } catch {
      return false;
    }
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级
    }
  }
  return false;
}

/* --------------------------- 同步版（仅 H5 生效，小程序回退） --------------------------- */
/* 用于现有「if (!confirm()) return」式同步判断代码，逐步迁移到异步版后可删。 */

export function confirmSync(message: string): boolean {
  if (isBrowser) return window.confirm(message);
  return true; // 小程序无同步 confirm，调用方应改用 confirmAsync
}

export function promptSync(message: string, defaultValue = ''): string | null {
  if (isBrowser) return window.prompt(message, defaultValue);
  return null;
}

export function alertSync(message: string): void {
  if (isBrowser) window.alert(message);
}

/** 刷新页面。H5 用 location.reload；小程序用 Taro.reLaunch 回首页。 */
export async function reload(): Promise<void> {
  if (isMiniProgram) {
    const { reLaunch } = await import('@tarojs/taro');
    await reLaunch({ url: '/pages/index/index' });
    return;
  }
  if (isBrowser) location.reload();
}

/** 平滑滚动某元素到顶部。H5 用 scrollIntoView；小程序需用 ScrollView 的 scrollTop。 */
export function scrollIntoViewById(id: string): void {
  if (!isBrowser) return;
  const el = document.getElementById(id);
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* --------------------------- 应用可见性（原 usePinLock 用） --------------------------- */

/**
 * 监听「切回前台」事件。
 * - H5：visibilitychange（切 tab/最小化恢复）
 * - 小程序：Taro.onAppShow
 * @returns 卸载函数
 */
export function onAppResume(cb: () => void): () => void {
  if (isMiniProgram) {
    // 动态导入避免 H5 打包时拉入 Taro 运行时
    let detach: (() => void) | null = null;
    import('@tarojs/taro').then(({ onAppShow, offAppShow }) => {
      onAppShow(cb);
      detach = () => offAppShow(cb);
    });
    return () => detach?.();
  }
  if (isBrowser) {
    const handler = () => {
      if (document.visibilityState === 'visible') cb();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }
  return () => {};
}

// 让 TS 不抱怨小程序环境下 wx 类型未定义
declare const wx: unknown;
