import { useEffect, useRef } from 'react';
import { Canvas, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { CSSProperties } from 'react';
import type { EChartsOption } from 'echarts';

/**
 * 跨端 ECharts 组件（精简构建）。
 *
 * 精简策略：按需 import（仅饼图+折线+必要的组件），
 * tree-shaking 后体积远小于完整包。
 *
 * 渲染：
 * - H5/Capacitor：用 echarts 直接渲染到 canvas（init）
 * - 小程序：用 Taro Canvas 2D + echarts canvas 渲染器
 *
 * 用法：<EChart option={...} height={200} />
 */
export interface EChartProps {
  option: EChartsOption;
  height?: number;
  style?: CSSProperties;
}

// 按需引入 echarts 模块（精简构建，减小体积）
// 用动态 import + 缓存，避免 H5 首屏拉全部
let echartsPromise: Promise<typeof import('echarts/core')> | null = null;
async function getEcharts() {
  if (!echartsPromise) {
    echartsPromise = import('echarts/core').then((echarts) => {
      // 仅注册需要的图表和组件
      const pie = require('echarts/charts').PieChart;
      const line = require('echarts/charts').LineChart;
      const { TitleComponent, TooltipComponent, LegendComponent, GridComponent } = require('echarts/components');
      const { CanvasRenderer } = require('echarts/renderers');
      echarts.use([pie, line, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);
      return echarts;
    });
  }
  return echartsPromise;
}

// H5 端：用一个唯一 id 找到 canvas DOM
let uid = 0;

export function EChart({ option, height = 200, style }: EChartProps) {
  const canvasId = useRef(`echart-${++uid}`).current;
  const instRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    getEcharts().then((echarts) => {
      if (disposed) return;
      try {
        // H5/Capacitor：直接 init 到 canvas DOM
        // 小程序端 Taro Canvas 会渲染成 <canvas canvasId=...>，用 createSelectorQuery 拿节点
        const query = Taro.createSelectorQuery();
        query.select(`#${canvasId}`).fields({ node: true, size: true }).exec(async (res) => {
          if (disposed) return;
          try {
            const canvas = res?.[0]?.node;
            if (canvas) {
              // 小程序 Canvas 2D 节点
              const ctx = canvas.getContext('2d');
              canvas.width = res[0].width * 2;
              canvas.height = res[0].height * 2;
              const inst = echarts.init(canvas, undefined, {
                renderer: 'canvas',
                width: res[0].width,
                height: res[0].height,
              });
              inst.setOption(option);
              instRef.current = inst;
            } else {
              // H5：document.getElementById
              const dom = document.getElementById(canvasId) as HTMLCanvasElement | null;
              if (dom && !instRef.current) {
                instRef.current = echarts.init(dom);
              }
              instRef.current?.setOption(option);
            }
          } catch (e) {
            // ECharts 初始化失败不白屏（降级为空，图表区域留白但页面可用）
            console.warn('[EChart] init failed', e);
          }
        });
      } catch (e) {
        console.warn('[EChart] query failed', e);
      }
    }).catch((e) => {
      console.warn('[EChart] echarts load failed', e);
    });
    return () => {
      disposed = true;
      try { instRef.current?.dispose(); } catch {}
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // option 变化时更新（不重新 init）
  useEffect(() => {
    instRef.current?.setOption(option, true);
  }, [option]);

  return (
    <View style={{ width: '100%', height: `${height}px`, ...style }}>
      <Canvas
        type='2d'
        id={canvasId}
        canvasId={canvasId}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

export default EChart;
