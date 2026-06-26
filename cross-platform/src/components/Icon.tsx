import { Text } from '@tarojs/components';
import type { CSSProperties } from 'react';

/**
 * 跨端图标组件。
 *
 * 背景：上游用 lucide-react（SVG React 组件），小程序不支持。
 * 这里用「名称 → emoji」映射做跨端替代，零依赖、视觉简化。
 * 后续可平滑替换为图标字体库（如 Taroify icons）而无需改调用方。
 *
 * 用法：<Icon name='wallet' size={18} className='text-blue-600' />
 */
const ICON_MAP: Record<string, string> = {
  // 通用
  chevronRight: '›',
  arrowRight: '→',
  arrowUpRight: '↗',
  check: '✓',
  checkCircle: '✅',
  info: 'ℹ',
  help: '？',
  shield: '🔒',
  sparkles: '✨',
  coins: '🪙',
  award: '🏆',
  scale: '⚖',
  target: '🎯',
  home: '🏠',
  send: '➤',
  user: '👤',
  bot: '🤖',
  loader: '⏳',
  image: '🖼',
  close: '✕',
  plus: '＋',
  minus: '－',
  // 模块图标（对应 ModuleType）
  receipt: '🧾',        // 个税
  briefcaseMedical: '💼',// 五险一金
  landmark: '🏛',       // 养老金
  piggyBank: '🐷',      // 年金
  pieChart: '🥧',       // 净资产
  trendingUp: '📈',     // 股票
  banknote: '💵',       // 理财
  messageSquare: '💬',  // AI
  wallet: '👛',         // 记账
  dashboard: '📊',      // 首页
};

interface IconProps {
  name: keyof typeof ICON_MAP | string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  const glyph = ICON_MAP[name] ?? name;
  return (
    <Text
      className={className}
      style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-block', ...style }}
    >
      {glyph}
    </Text>
  );
}

export default Icon;
