#!/usr/bin/env bash
# 一键部署 / 更新：sudo bash deploy/deploy.sh
set -e
REPO="${REPO:-https://github.com/AEIOU-LIAO/AEIOU-LIAO-harvest-farm.git}"
DIR=/var/www/harvest-farm
command -v nginx >/dev/null || { (apt-get update && apt-get install -y nginx git) || yum install -y nginx git; }
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
CONF=/etc/nginx/conf.d/harvest-farm.conf
[ -f "$CONF" ] || cp "$DIR/deploy/nginx.conf" "$CONF"
nginx -t && (systemctl reload nginx 2>/dev/null || systemctl start nginx)
echo "部署完成：浏览器打开 http://<服务器IP>/"
