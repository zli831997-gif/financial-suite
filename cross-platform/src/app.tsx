import { PropsWithChildren, useEffect } from 'react';
import { useLaunch } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import './app.css';
import './tailwind.css';
import { useAutoBook } from './hooks/useAutoBook';

/**
 * FinanceHub 跨端根组件。
 * 启动时绑定存储适配器：小程序用 wxStorageSync，H5/Capacitor 用 localStorage。
 *
 * 自动记账：安卓端监听支付通知（useAutoBook），收到后广播事件让记账页刷新。
 * 小程序/H5 无此能力，hook 内部静默跳过。
 */
function App({ children }: PropsWithChildren<Record<string, unknown>>) {
  useLaunch(() => {
    import('./adapters').then(({ bindStorage }) => bindStorage());
  });

  // 自动记账（仅安卓）：refreshKey 变化 → 广播，记账页订阅刷新
  const refreshKey = useAutoBook();
  useEffect(() => {
    if (refreshKey > 0) Taro.eventCenter.trigger('auto-book-refresh', refreshKey);
  }, [refreshKey]);

  return children;
}

export default App;
