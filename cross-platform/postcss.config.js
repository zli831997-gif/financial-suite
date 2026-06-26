// PostCSS 配置：Taro 4 会自动合并这份配置到它的 postcss 链。
// tailwindcss + autoprefixer 在最前，保证 className 被编译成 wxss/css。
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
