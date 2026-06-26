#!/bin/bash
set -e
KEY=~/.ssh/lietou_aliyun
HOST=root@121.40.229.165
DIR=/var/www/finance

cd "/Users/xiaoweiwei/Desktop/financial-suite (1)"

echo "📦 上传 dist/ 到阿里云..."
ssh -i "$KEY" "$HOST" "mkdir -p $DIR"
scp -i "$KEY" -r dist/* "$HOST:$DIR/"
echo "✅ 上传完成"

echo "⚙️ 配置 nginx（加 /finance/ 路径）..."
ssh -i "$KEY" "$HOST" 'bash -s' << 'REMOTE_SCRIPT'
CONF=$(grep -rl 'cvgo.top' /etc/nginx/ 2>/dev/null | head -1)
if [ -z "$CONF" ]; then
  echo "❌ 找不到 cvgo.top 的 nginx 配置，请手动检查"
  exit 1
fi
echo "nginx 配置文件: $CONF"
if grep -q 'location /finance/' "$CONF"; then
  echo "location /finance/ 已存在，跳过"
else
  sed -i '/^}/i\    location /finance/ { alias /var/www/finance/; try_files $uri $uri/ /finance/index.html; }' "$CONF"
  echo "✅ 已添加 location /finance/"
fi
nginx -t
nginx -s reload
echo "🎉 部署成功: https://www.cvgo.top/finance/"
REMOTE_SCRIPT
