import { View } from '@tarojs/components';
import type { ReactNode } from 'react';

/**
 * 跨端动画组件（替代 framer-motion / motion）。
 *
 * 背景：上游用 motion/react 的 <motion.div>（依赖 DOM）+ whileHover/whileTap，
 * 小程序不支持。这里用 CSS transition + active 伪类替代：
 * - whileTap={{scale}}  → active:scale-[.98] class
 * - whileHover={{scale}} → 小程序无悬停，H5 用 hover:scale（小程序忽略，无副作用）
 *
 * 用法：<Motion tap className='...'>内容</Motion>
 * 等价于上游 <motion.div whileTap={{scale:0.98}} className='...'>内容</motion.div>
 */

interface MotionProps {
  children: ReactNode;
  className?: string;
  /** 点击缩放（替代 whileTap），默认 0.98 */
  tapScale?: number;
  /** 悬停缩放（替代 whileHover，仅 H5 生效），默认不开 */
  hoverScale?: number;
  /** 点击事件（让 Motion 可作为可点击容器/按钮使用） */
  onClick?: () => void;
}

export function Motion({ children, className = '', tapScale = 0.98, hoverScale, onClick }: MotionProps) {
  const cls = [
    'transition-transform duration-150 ease-out',
    `active:scale-${scaleToClass(tapScale)}`,
    hoverScale ? `hover:scale-${scaleToClass(hoverScale)}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <View className={cls} onClick={onClick}>
      {children}
    </View>
  );
}

// 0.98 → 98（Tailwind 任意值 active:scale-[0.98] 在小程序需静态 class）。
// 这里映射到预设档位，避免 JIT 任意值在小程序的兼容问题。
function scaleToClass(scale: number): string {
  const map: Record<string, string> = {
    '0.95': '95',
    '0.97': '95',
    '0.98': '95',
    '0.99': '95',
    '1.01': '100',
    '1.02': '100',
    '1.05': '105',
  };
  return map[String(scale)] ?? '95';
}

export default Motion;
