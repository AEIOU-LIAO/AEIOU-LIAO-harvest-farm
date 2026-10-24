# 🌾 丰收农场 v2 · 多人联网版

一款 3D 画面的网页农场游戏：种菜、收获、去别人家摘菜、帮忙浇水除虫、集市买卖、排行榜、成就、赛季活动。手机和电脑浏览器都能玩。

- **3D 场景**：基于 Three.js（r149，已放在 `vendor/`，不依赖外部 CDN）。实时光照与阴影、昼夜和雨天、草地随风摆动；24 种作物按生长阶段使用不同的 3D 模型；画质会根据帧率自动调整。
- **开放世界**：不用加好友，所有玩家的农场都能直接串门、摘菜、帮忙；好友只是一键收藏，不需要对方同意。
- **拟真 NPC 玩家**：服务器运行一批 NPC，在其他玩家眼里和真人没有区别，详见下文。
- **真实多人**：偷菜、互助、留言都作用在对方的真实数据上。
- **服务器权威**：金币、经验、作物生长、偷菜结果、交易全部由服务器计算并持久化；浏览器只负责显示与发请求。
- **零依赖**：只需要 Node.js 22.13 或更高版本。数据库用 Node 内置的 SQLite（单个文件），不需要 `npm install`，也不需要额外的数据库服务。

---

## 目录结构

```
index.html          游戏页面（由 src/ 构建出的单文件，可直接被 Node 服务或静态托管提供）
admin.html          运营后台页面
shared/config.js    前后端共用：作物、规则、任务、成就、装扮、生长算法、时区
server/             服务端
  index.js          HTTP 服务、路由、鉴权、幂等、限流、备份、指标
  game.js           游戏逻辑（全部在数据库事务中执行）
  admin.js          运营后台接口
  db.js             SQLite 表结构与版本化迁移
  util.js           密码哈希、令牌、限流、输入校验
  npc.js            拟真 NPC 玩家（作息、经营、社交、集市）
  cli.js            运维命令（备份/恢复/设管理员/重置密码）
src/                前端源码（world3d 3D 场景，game 客户端逻辑，ui 弹窗，icons 矢量图标，net 网络层，avatar2d 头像）
vendor/three.min.js Three.js r149（MIT 许可，见 vendor/THREE-LICENSE.txt）
test/api.test.js    自动化测试（15 组，含并发偷菜、幂等、权限、交易守恒、NPC）
deploy/             一键部署脚本、systemd 服务、Nginx 反向代理配置
docs/ACCEPTANCE.md  功能验收矩阵、测试结果、未解决问题
```

## NPC 玩家

前期真人少，服务器默认运行 24 个 NPC（`.env` 里的 `NPC_COUNT` 可以调整，设为 0 就关闭）。

- **看起来像真人**：网名按真实风格生成，比如“晚风与你”“Kevin_88”“爱吃草莓的兔子”“张伟”；等级、注册时间、头像、称号、头像框、累计数据都和等级相符。
- **有自己的作息**：每个 NPC 属于一种作息类型（上班族、学生、夜猫子、早起的人、居家、重度玩家、偶尔玩），只在对应时段上线，在线时头像亮绿点。离线时作物照常生长、成熟，可以被人摘。
- **按规则经营**：上线后签到、领奖励、收菜、卖菜、交订单、照料、补种（晚上种长周期作物，白天种短的）、扩地、喂狗。金币按真实规则赚和花。
- **会社交**：串门、偷菜、帮忙、留言、加好友。谁偷过它，它会优先去“回访”。
- **不打扰**：每个真人每天被 NPC 偷菜最多 4 次、帮忙最多 6 次、买走挂单最多 6 次。
- **数据不注水**：NPC 在排行榜里正常显示，但赛季奖励只在真人之间排名发放；运营后台的玩家列表会标出 NPC，各项指标不计入 NPC。

> 提醒：将来如果加入真实充值，用不公开身份的机器人去刺激真人消费，可能涉及消费者保护和反不正当竞争方面的风险，请届时咨询专业人士。

## 本地运行

```bash
node --version            # 需要 v22.13 以上
npm start                 # 或：node server/index.js
# 浏览器打开 http://localhost:3000
```

开发时可以用 `npm run dev`：数据存到 `data/dev.db`，并开启“测试时钟”（`POST /api/test/clock {"ms":60000}` 可以让服务器时间快进，用来测试作物成熟）。

修改 `src/` 或 `shared/config.js` 之后执行 `npm run build` 重新生成 `index.html`（CI 会检查两者是否一致）。页面需要和 `vendor/three.min.js` 放在一起部署。

画质默认为“高”，帧率持续偏低时会自动降到“中”或“低”。也可以在网址后加 `?q=mid` 或 `?q=low` 强制指定。

## 部署

### 方案 A（推荐）：在自己的 Linux 服务器上运行

游戏页面和接口都由同一个 Node 服务提供，Nginx 只做反向代理和 HTTPS。不需要购买任何新服务。

```bash
# 首次部署（会安装 Node 22 和 Nginx、注册 systemd 服务、配置反向代理）
git clone https://github.com/AEIOU-LIAO/AEIOU-LIAO-harvest-farm.git /var/www/harvest-farm
sudo bash /var/www/harvest-farm/deploy/deploy.sh

# 以后更新：同一条命令（会先自动备份数据库，再拉代码、重启服务）
sudo bash /var/www/harvest-farm/deploy/deploy.sh
```

部署完成后：

1. 把域名（如 `farm.peiqi1.top`）的 DNS 指向这台服务器，修改 `/etc/nginx/conf.d/harvest-farm.conf` 里的 `server_name`，然后执行 `sudo certbot --nginx -d farm.peiqi1.top` 开启 HTTPS。
2. 在游戏里注册账号，然后设为管理员：`cd /var/www/harvest-farm && sudo node server/cli.js make-admin 你的账号`，再打开 `https://你的域名/admin.html`。

也可以用 Docker：`docker compose up -d --build`（数据保存在 `./data`）。

### 方案 B：前端继续放在 EdgeOne，接口放在自己的服务器

EdgeOne 静态托管不能运行 Node 和数据库，所以接口仍然要部署在一台服务器上（按方案 A 部署即可），再让 EdgeOne 上的页面去调用它：

1. 给接口服务配一个 HTTPS 域名，例如 `api.peiqi1.top`（必须是 HTTPS，否则 HTTPS 页面会被浏览器拦截）。
2. 在服务器的 `.env` 里设置 `CORS_ORIGINS=https://farm.peiqi1.top`，然后重启服务。
3. 构建指定接口地址的页面并提交：`API_BASE=https://api.peiqi1.top npm run build`。

> ⚠️ **合并到 main 之前请先确定用哪种方案。** 当前 EdgeOne 会自动发布 main 分支的 `index.html`。如果直接合并、接口还没部署，线上页面会提示“连接不上服务器”。建议先在服务器上用 `BRANCH=v2-multiplayer sudo -E bash deploy/deploy.sh` 部署验证，确认没问题后再合并。

### 环境隔离

开发、测试、生产只是不同的配置，通过 `.env`（参考 `.env.example`）区分：

| 环境 | 建议配置 |
|---|---|
| 开发 | `npm run dev`，使用 `data/dev.db`，开测试时钟 |
| 测试 | `npm test` 使用内存数据库，互不影响；也可以在另一个目录部署 `BRANCH=v2-multiplayer`，用 `PORT=3001`、`DB_PATH=data/staging.db` |
| 生产 | `NODE_ENV=production`（测试时钟强制关闭），`DB_PATH=data/farm.db`，开启自动备份 |

### 数据库迁移、备份与恢复

- 迁移：表结构变更写在 `server/db.js` 的 `MIGRATIONS` 数组里。服务启动时按版本号依次执行，每一步都在事务中完成，失败会回滚且服务不会启动。
- 自动备份：默认每 24 小时用 `VACUUM INTO` 生成一份一致性快照到 `data/backups/`，保留最近 7 份；`deploy.sh` 每次更新前也会先备份一次。
- 手动备份：`node server/cli.js backup`
- 恢复：先停止服务（`sudo systemctl stop harvest-farm`），执行 `node server/cli.js restore data/backups/farm-xxxx.db`（当前数据库会先另存一份），再启动服务。

## 运营后台（/admin.html）

只有 `role=admin` 的账号能访问，所有写操作都会记入审计日志。

- **数据概览**：注册、DAU、次留/七留、好友添加率、偷菜参与率、订单完成率、接口错误率与耗时、页面加载耗时、近 14 天趋势。
- **玩家**：搜索、查看库存和金币流水、封禁/解封（同时下架挂单、踢下线）、补偿或扣除金币和物品（必须填写原因）、设置管理员。
- **活动**：在线创建经验、收购价、变异几率、产量的倍率活动，设置起止时间，立即生效，不用改代码。
- **数值配置**：在线覆盖作物的种子价、时长、产量、单价、经验、解锁等级，以及偷菜、市场等规则数值。
- **风控**：今日偷菜最多、金币收入最多、大额集市成交、同一对玩家之间的频繁交易（可能是小号转移金币）。
- **审计日志 / 错误**：管理员操作记录，最近的服务器异常。

运维命令：

```bash
node server/cli.js make-admin <账号>
node server/cli.js reset-password <账号> <新密码>
node server/cli.js info
```

## 测试

```bash
npm test          # 15 组接口测试，约 15 秒
```

覆盖内容包括：账号与跨设备登录、邀请链接与一键加好友、开放互访与屏蔽、拟真 NPC（接口不泄露身份、按作息上线经营、偷菜帮忙买货、赛季奖励不被抢）、偷菜数量守恒、40 个请求并发偷同一块地、重复提交（幂等键）、保护期、狗狗拦截、每日上限、新手保底、互助、集市并发购买与金币守恒、奖励不可重复领取、排行榜不可篡改、后台权限、活动与配置生效、封禁、导出与注销、限流、生长与时区计算。端到端浏览器测试和压测结果见 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。

## 成本与容量

- **费用**：方案 A 在现有服务器上运行，没有新增费用。不依赖任何付费第三方服务。
- **资源**：服务进程常驻内存约 75 MB，200 名测试玩家的压测中最高约 125 MB。数据库单文件，每位玩家约几十 KB。24 个 NPC 每 30 秒运行一次，CPU 占用很低。
- **前端**：首次加载约 830 KB（其中 three.js 约 600 KB，开启 gzip 后约 150 KB，浏览器会缓存一周）。3D 场景每帧约 180 次绘制调用、12 万到 16 万个三角形。
- **性能**：在本机压测中，50 个并发连接下每秒约 1100 次请求，95% 的请求在 90 毫秒内完成，没有出错。每位在线玩家约 15 秒轮询一次，单进程可以支撑上千人同时在线。
- **升级路径**：玩家规模明显超过单机能力时，可以把 `server/db.js` 换成 PostgreSQL（业务代码都通过 `db.get/all/run/tx` 访问数据库，改动集中），再部署多个 Node 实例。

## 合规提醒

本项目目前用于开发与测试。如果将来面向中国大陆公众正式运营，需要另行评估游戏版号、实名认证与防沉迷、隐私政策和个人信息保护等要求，正式上线前请咨询专业人士。
