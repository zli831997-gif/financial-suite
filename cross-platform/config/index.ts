import path from 'path';
import { defineConfig } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

// @finance 别名指向上游 src（逻辑层 + 存储层复用）。
// Taro 默认把解析范围锁定在工程根目录内，相对路径引用上游会被拦截，
// 必须用 webpack alias 注入。alias 在 h5/mini 两个环境分别设置才会生效。
// config 目录在 cross-platform/config/，上游 src 在 cross-platform/../src
const FINANCE_SRC = path.resolve(__dirname, '../../src');

function applyAlias(chain) {
  // webpack5 alias：@finance 作为前缀，@finance/storage → FINANCE_SRC/storage
  chain.resolve.alias.set('@finance', FINANCE_SRC);

  // 关键：Taro 的 .ts/.tsx 编译规则（#8）的 include 默认只有本工程 src/，
  // 上游 ../src 的文件不被 loader 处理 → ModuleParseError。
  // 在 webpack environment 钩子里，把上游 src 追加进该规则的 include。
  chain.plugin('include-upstream-src').use({
    apply(compiler) {
      compiler.hooks.environment.tap('include-upstream', () => {
        const rules = compiler.options.module.rules;
        for (const rule of rules) {
          if (
            rule.test &&
            String(rule.test).includes('[tj]sx') &&
            Array.isArray(rule.include)
          ) {
            if (!rule.include.includes(FINANCE_SRC)) {
              rule.include.push(FINANCE_SRC);
            }
          }
        }
      });
    },
  });
}

// FinanceHub 跨端 Taro 配置。设计稿按原工程 iPhone 390pt。
export default defineConfig<'webpack5'>(async (merge) => {
  const base = {
    projectName: 'financehub-cross-platform',
    date: '2026-6-26',
    designWidth: 390,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
      390: 750 / 390,
    },
    sourceRoot: 'src',
    outputRoot: `dist/${process.env.TARO_ENV}`,
    // plugin-html：让小程序端支持 div/span/p/h1 等 HTML 标签 + className，
    // 上游组件的标签几乎不用改就能在小程序跑。配合 Tailwind 生成 wxss。
    plugins: ['@tarojs/plugin-html'],
    defineConstants: {},
    copy: { patterns: [], options: {} },
    framework: 'react',
    compiler: 'webpack5',
    cache: { enable: false },
    webpackChain: applyAlias,
    mini: {
      webpackChain: applyAlias,
      postcss: {
        pxtransform: { enable: true, config: {} },
        cssModules: {
          enable: false,
          config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' },
        },
      },
    },
    h5: {
      webpackChain: applyAlias,
      // 相对路径：Capacitor WebView（file:// 或 https://localhost）下都能正确加载，
      // 避免 /js/xxx 绝对路径在某些 scheme 下 404。小程序产物不受影响（独立构建）。
      publicPath: './',
      staticDirectory: 'static',
      output: { filename: 'js/[name].[hash:8].js', chunkFilename: 'js/[name].[chunkhash:8].js' },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: { enable: true, config: {} },
        cssModules: {
          enable: false,
          config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' },
        },
      },
    },
  };

  process.env.BROWSERSLIST_ENV = process.env.NODE_ENV;
  if (process.env.NODE_ENV === 'development') {
    return merge({}, base, devConfig);
  }
  return merge({}, base, prodConfig);
});
