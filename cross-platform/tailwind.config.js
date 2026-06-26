/** @type {import('tailwindcss').Config} */
// 与上游 Tailwind v4 配置对齐，用 v3 写法（Taro 小程序对 v3 支持成熟）。
// content 同时扫描本工程 src 和上游 ../src，让所有 className 都被生成。
// 设计稿宽度 390，preflight 关闭（小程序不兼容 base 样式重置）。
const path = require('path');

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
    path.resolve(__dirname, '../src/**/*.{js,ts,jsx,tsx}'),
  ],
  // 关闭 preflight：小程序的 view/text 等组件不需要 HTML reset，
  // preflight 会注入 *{margin:0} 之类的全局样式，在小程序里多余且可能冲突。
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // 上游用了一些非标准间距/色阶，这里补齐，保证 className 原样可用
      spacing: {
        '4.5': '1.125rem',
        '3.5': '0.875rem',
        '2.5': '0.625rem',
        '1.5': '0.375rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '3xs': '0 1px 0 0 rgb(0 0 0 / 0.02)',
      },
      colors: {
        // slate 中间档（上游自造）
        slate: {
          805: '#1e293b',
          455: '#64748b',
          150: '#eef2f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
