# 丰收农场

纯前端网页种菜游戏，单文件 `index.html`，浏览器直接打开即可玩，存档保存在浏览器本地。

## 服务器一键部署（Nginx）
```bash
git clone https://github.com/AEIOU-LIAO/AEIOU-LIAO-harvest-farm.git /var/www/harvest-farm
sudo bash /var/www/harvest-farm/deploy/deploy.sh
```
以后更新：再执行一次 `sudo bash /var/www/harvest-farm/deploy/deploy.sh`。

如端口 80 已被其他站点占用，修改 `/etc/nginx/conf.d/harvest-farm.conf` 里的 `listen` 或 `server_name`。

## 开发
源码在 `src/`，修改后执行 `node src/build.js` 生成 `src/farm.html`，再复制为根目录 `index.html`。
