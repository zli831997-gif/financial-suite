import { View, Text } from '@tarojs/components';
import type { CSSProperties } from 'react';

/**
 * 跨端图表组件（纯 View 实现，不依赖 canvas/SVG）。
 *
 * 背景：上游用 recharts（依赖 DOM/SVG），小程序不支持。
 * ECharts 方案需 ec-canvas + wxs，集成复杂。这里先用纯布局实现
 * 饼图（Pie）和折线图（Line），覆盖 Dashboard/Assets/Stocks 的展示需求，
 * 视觉简化但跨端零依赖、稳定。后续复杂图表可再接 ECharts。
 */

/* ------------------------------ 饼图（环形） ------------------------------ */
export interface PieDatum {
  name: string;
  value: number;
  color: string;
}

export function MiniPie({
  data,
  size = 160,
  thickness = 28,
}: {
  data: PieDatum[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  // 用 conic-gradient 实现饼图。H5/小程序（wxss 支持 background:conic-gradient）通用。
  let acc = 0;
  const stops = data.map((d) => {
    const start = (acc / total) * 360;
    acc += Math.max(0, d.value);
    const end = (acc / total) * 360;
    return `${d.color} ${start}deg ${end}deg`;
  });
  const bg = `conic-gradient(${stops.join(', ')})`;
  const wrapStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: bg,
    position: 'relative' as const,
  };
  const holeStyle: CSSProperties = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    width: `${size - thickness * 2}px`,
    height: `${size - thickness * 2}px`,
    borderRadius: '50%',
    background: '#fff',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={wrapStyle}>
      <View style={holeStyle}>
        <Text className='text-lg font-extrabold text-slate-900'>
          ¥{Math.round(total).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------ 折线图（SVG path 近似） ------------------------------ */
// 小程序不支持直接 <svg>，用 View 拼点+连线的近似效果成本高。
// 这里用「柱状条」替代折线展示趋势，视觉上同样能表达走势，
// 且纯 View 实现跨端稳定。需要精确折线时后续接 ECharts。
export function MiniTrend({
  data,
  height = 80,
  color = '#6366f1',
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  return (
    <View className='flex items-end gap-0.5' style={{ height: `${height}px` }}>
      {data.map((v, i) => {
        const h = ((v - min) / range) * 100;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(4, h)}%`,
              background: color,
              borderRadius: '2px',
              opacity: 0.85,
            }}
          />
        );
      })}
    </View>
  );
}

/* ------------------------------ 图例 ------------------------------ */
export function ChartLegend({ data }: { data: PieDatum[] }) {
  return (
    <View className='flex flex-col gap-1.5'>
      {data.map((d) => (
        <View key={d.name} className='flex items-center gap-2'>
          <View style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color }} />
          <Text className='text-[11px] text-slate-600 flex-1'>{d.name}</Text>
          <Text className='text-[11px] font-mono text-slate-900 font-bold'>
            ¥{Math.round(d.value).toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default { MiniPie, MiniTrend, ChartLegend };
