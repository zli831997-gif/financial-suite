import { View, Text } from '@tarojs/components';
import { useEffect, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Icon } from '../components/Icon';

/**
 * 自定义底部 tabBar。
 * 小程序自定义 tabBar 要求文件位于 src/custom-tab-bar/index。
 * 用 Icon 组件 + Tailwind 渲染，免去图标图片资源。
 * 当前选中项通过路由 path 判断（每次页面显示时刷新）。
 */

const TABS = [
  { pagePath: '/pages/index/index', text: '工具箱', icon: 'dashboard' },
  { pagePath: '/pages/accounting/index', text: '记账', icon: 'wallet' },
  { pagePath: '/pages/reports/index', text: '报表', icon: 'pieChart' },
  { pagePath: '/pages/profile/index', text: '我的', icon: 'user' },
];

export default function CustomTabBar() {
  const [selectedPath, setSelectedPath] = useState(TABS[0].pagePath);

  // 每次 tabBar 页面显示时，根据当前路由刷新选中态
  useDidShow(() => {
    const path = Taro.getCurrentInstance().router?.path || '';
    setSelectedPath(path);
  });
  useEffect(() => {
    const path = Taro.getCurrentInstance().router?.path || '';
    setSelectedPath(path);
  }, []);

  return (
    <View
      className='flex bg-white border-t border-slate-100'
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const active = selectedPath.includes(tab.pagePath);
        return (
          <View
            key={tab.pagePath}
            className='flex-1 flex flex-col items-center justify-center py-2'
            onClick={() => Taro.switchTab({ url: tab.pagePath })}
          >
            <Icon name={tab.icon} size={20} className={active ? 'text-indigo-600' : 'text-slate-400'} />
            <Text
              className={`text-[10px] mt-0.5 ${active ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}
            >
              {tab.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
