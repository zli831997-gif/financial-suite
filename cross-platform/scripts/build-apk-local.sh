#!/usr/bin/env bash
# 本地一键构建 APK（需 JDK 17 + Android SDK）。
# 流程与 .github/workflows/build-apk-taro.yml 等价：
#   Taro build H5 → 覆盖主工程 dist → cap copy → gradlew assembleDebug
#
# 用法（在主工程根目录）：
#   bash cross-platform/scripts/build-apk-local.sh
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> [1/5] 安装跨端工程依赖"
(cd cross-platform && npm install)

echo "==> [2/5] 用 Taro 构建 H5 产物"
(cd cross-platform && npm run build:h5)

echo "==> [3/5] 用 Taro 产物覆盖主工程 dist"
rm -rf dist
mkdir -p dist
cp -r cross-platform/dist/h5/* dist/
echo "    dist 内容: $(ls dist/ | tr '\n' ' ')"

echo "==> [4/5] 安装主工程依赖（如未装）"
[ -d node_modules ] || npm install

echo "==> [5/5] cap copy + gradlew assembleDebug"
npx cap copy android
(cd android && ./gradlew assembleDebug)

echo ""
echo "✅ 构建完成！"
echo "📦 APK: android/app/build/outputs/apk/debug/app-debug.apk"
