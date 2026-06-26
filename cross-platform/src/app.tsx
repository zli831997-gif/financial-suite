import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import './app.css';
import './tailwind.css';

/**
 * FinanceHub 跨端根组件。
 * 启动时绑定存储适配器：小程序用 wxStorageSync，H5/Capacitor 用 localStorage。
 * 复用上游 src/storage 的接口（不重复造轮子）。
 */
function App({ children }: PropsWithChildren<Record<string, unknown>>) {
  useLaunch(() => {
    // 延迟加载适配器，避免在小程序/H5 各自环境拉错依赖
    // 见 src/adapters/index.ts —— 在入口统一绑定 storage 实现
    import('./adapters').then(({ bindStorage }) => bindStorage());
  });

  return children;
}

export default App;
