// 开发环境配置（覆盖 config/index.ts 的 base）
export default {
  logger: { quiet: false, stats: true },
  mini: {},
  h5: {
    devServer: {
      port: 10086, // 避开上游 Vite 的 3000
      open: false,
    },
  },
};
