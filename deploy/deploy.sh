#!/usr/bin/env bash
# 一键部署 / 更新（Ubuntu / Debian / CentOS）：sudo bash deploy/deploy.sh
# 首次运行：安装 Node 22、Nginx，拉代码，注册 systemd 服务。之后再运行：拉取最新代码、备份数据库、重启服务。
set -euo pipefail
REPO="${REPO:-https://github.com/AEIOU-LIAO/AEIOU-LIAO-harvest-farm.git}"
BRANCH="${BRANCH:-main}"
DIR=/var/www/harvest-farm

need_node() { command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'; }
if ! need_node; then
  echo "安装 Node.js 22…"
  if command -v apt-get >/dev/null; then curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
  else curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && yum install -y nodejs; fi
fi
command -v nginx >/dev/null || { (apt-get update && apt-get install -y nginx git) || yum install -y nginx git; }

if [ -d "$DIR/.git" ]; then
  [ -f "$DIR/data/farm.db" ] && (cd "$DIR" && node --disable-warning=ExperimentalWarning server/cli.js backup) || true
  git -C "$DIR" fetch origin "$BRANCH" && git -C "$DIR" checkout "$BRANCH" && git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
mkdir -p data && chown -R www-data:www-data data 2>/dev/null || true
[ -f .env ] || { cp .env.example .env; echo "已生成 .env，可按需修改（例如 ADMIN_USERNAMES）"; }

cp deploy/farm.service /etc/systemd/system/harvest-farm.service
id www-data >/dev/null 2>&1 || sed -i 's/^User=www-data/User=root/' /etc/systemd/system/harvest-farm.service
systemctl daemon-reload && systemctl enable harvest-farm >/dev/null 2>&1 && systemctl restart harvest-farm

CONF=/etc/nginx/conf.d/harvest-farm.conf
[ -f "$CONF" ] || cp deploy/nginx.conf "$CONF"
# 旧版静态站点配置会和反向代理冲突，提示处理
grep -q "root /var/www/harvest-farm" "$CONF" && { cp deploy/nginx.conf "$CONF"; echo "已把旧的静态配置替换为反向代理配置"; }
nginx -t && (systemctl reload nginx 2>/dev/null || systemctl start nginx)

sleep 1; curl -fsS http://127.0.0.1:3000/api/health && echo && echo "✅ 部署完成：浏览器打开 http://<服务器IP或域名>/   运营后台：/admin.html"
