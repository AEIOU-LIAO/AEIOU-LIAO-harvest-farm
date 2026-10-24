'use strict';
/* =====================================================
   丰收农场 · HTTP 服务（零依赖：Node 22 + node:sqlite）
   ===================================================== */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');

// ---- 读取 .env（不依赖 dotenv）----
(function loadEnv() { const f = path.join(ROOT, '.env'); if (!fs.existsSync(f)) return; fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); })();

const CFG = require('../shared/config');
const U = require('./util');
const { open, SCHEMA_VERSION } = require('./db');
const { Game } = require('./game');
const { Admin } = require('./admin');
const { Villagers } = require('./npc');

const ENV = {
  port: +(process.env.PORT || 3000), host: process.env.HOST || '0.0.0.0', db: path.resolve(ROOT, process.env.DB_PATH || 'data/farm.db'),
  prod: process.env.NODE_ENV === 'production', cors: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  tzMin: +(process.env.TZ_OFFSET_MIN || 480), backupDir: path.resolve(ROOT, process.env.BACKUP_DIR || 'data/backups'), backupKeep: +(process.env.BACKUP_KEEP || 7), backupHours: +(process.env.BACKUP_HOURS || 24),
  trustProxy: process.env.TRUST_PROXY === '1', testClock: process.env.FARM_TEST_CLOCK === '1' && process.env.NODE_ENV !== 'production',
  admins: (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean), quiet: process.env.QUIET === '1',
  npcCount: process.env.NPC_COUNT === undefined ? 24 : +process.env.NPC_COUNT, npcTickSec: +(process.env.NPC_TICK_SEC || 30),
};
const VERSION = '2.0.0';

function createApp(opts) {
  opts = Object.assign({}, ENV, opts || {});
  CFG.setTz(opts.tzMin);
  const db = open(opts.db), game = new Game(db, { tzMin: opts.tzMin }), admin = new Admin(game), lim0 = new U.Limiter();
  const lim = { take: (...a) => opts.noRateLimit ? true : lim0.take(...a) };
  opts.admins.forEach(n => db.run("UPDATE users SET role='admin' WHERE username=?", n));
  const vill = new Villagers(game);
  if (opts.npcCount > 0) db.tx(() => vill.ensure(Math.min(80, opts.npcCount)));
  const npcTick = () => { try { db.tx(() => vill.tick(opts.npcTickSec)); } catch (e) { if (!opts.quiet) console.error('[npc]', e.message); } };

  // ---- 指标：内存累计，定时落库 ----
  const mem = {}; const mbump = (k, n) => mem[k] = (mem[k] || 0) + (n || 1);
  const flush = () => { const ks = Object.keys(mem); if (!ks.length) return; try { db.tx(() => ks.forEach(k => { game.metric(k, mem[k]); delete mem[k]; })); } catch (e) { } };
  const timers = [setInterval(flush, 15000), ...(opts.npcCount > 0 ? [setInterval(npcTick, opts.npcTickSec * 1000)] : []), setInterval(() => { try { db.run('DELETE FROM idem WHERE at<?', game.now() - 86400000); } catch (e) { } }, 3600000)];

  // ---- 路由 ----
  const routes = [];
  const R = (method, pat, flags, fn) => { const keys = []; const re = new RegExp('^' + pat.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$'); routes.push({ method, re, keys, flags, fn }); };
  const st = uid => game.snapshot(uid);
  const fv = (uid, owner, result, out) => { const u = game.user(uid); return { result, out, me: game.me(u), inv: game.inv(uid), badges: game.badges(uid), farm: game.farmView(uid, owner), now: game.now() }; };
  const own = (uid, result, out) => ({ result, out, state: st(uid) });
  const idx = b => U.int(b.idx, '土地', 0, CFG.NPLOTS - 1);
  const id = v => U.int(v, 'ID', 1, Number.MAX_SAFE_INTEGER);

  // 公共
  R('GET', '/api/health', {}, () => ({ ok: true, version: VERSION, schema: SCHEMA_VERSION, now: game.now() }));
  R('GET', '/api/config', {}, () => game.publicConfig());
  R('POST', '/api/auth/guest', { authLimit: 1, guestLimit: 1 }, (c) => { const uid = game.createUser(c.body.name); return { token: game.newSession(uid, c.ua), state: st(uid) }; });
  R('POST', '/api/auth/register', { authLimit: 1, guestLimit: 1 }, (c) => { const uid = game.createUser(c.body.name, c.body.username, c.body.password); return { token: game.newSession(uid, c.ua), state: st(uid) }; });
  R('POST', '/api/auth/login', { authLimit: 1 }, (c) => { const u = game.login(c.body.username, c.body.password); if (u.banned) throw U.forbid('账号已被封禁：' + (u.ban_reason || '违反规则')); return { token: game.newSession(u.id, c.ua), state: st(u.id) }; });
  R('POST', '/api/auth/recover', { authLimit: 1 }, (c) => { const r = game.recover(c.body.username, c.body.code, c.body.password); return { token: game.newSession(r.user.id, c.ua), recovery: r.recovery, state: st(r.user.id) }; });
  R('GET', '/api/invite/:code', {}, (c) => { const u = db.get('SELECT * FROM users WHERE code=? AND banned=0', String(c.params.code)); if (!u) throw U.notFound('邀请链接无效'); return game.publicUser(u); });
  R('POST', '/api/telemetry', { optAuth: 1 }, (c) => { const ms = Math.round(Number(c.body.loadMs)); if (ms > 0 && ms < 60000) { mbump('load_n'); mbump('load_ms', ms); } return {}; });

  // 账号
  R('POST', '/api/auth/logout', { auth: 1, allowBanned: 1 }, (c) => { db.run('DELETE FROM sessions WHERE token_hash=?', c.tokenHash); return {}; });
  R('POST', '/api/auth/bind', { auth: 1, authLimit: 1 }, (c) => game.bind(c.uid, c.body.username, c.body.password));
  R('POST', '/api/auth/password', { auth: 1, authLimit: 1 }, (c) => { game.changePassword(c.uid, c.body.old, c.body.password); return { token: game.newSession(c.uid, c.ua) }; });
  R('GET', '/api/state', { auth: 1 }, (c) => st(c.uid));
  R('POST', '/api/me/profile', { auth: 1 }, (c) => { game.updateProfile(c.uid, c.body); return { state: st(c.uid) }; });
  R('POST', '/api/me/migrate', { auth: 1 }, (c) => ({ result: game.migrate(c.uid, c.body), state: st(c.uid) }));
  R('GET', '/api/me/export', { auth: 1, allowBanned: 1 }, (c) => game.exportData(c.uid));
  R('POST', '/api/me/delete', { auth: 1, authLimit: 1, allowBanned: 1 }, (c) => { game.deleteAccount(c.uid, c.body.password, c.body.confirm); return {}; });

  // 自己的农场
  R('POST', '/api/farm/plant', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.plant(c.uid, idx(c.body), U.int(c.body.crop, '种子', 0, CFG.CROPS.length - 1), o), o); });
  R('POST', '/api/farm/harvest', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.harvest(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/care', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.care(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/shovel', { auth: 1 }, (c) => own(c.uid, game.shovel(c.uid, idx(c.body))));
  R('POST', '/api/farm/fert', { auth: 1 }, (c) => own(c.uid, game.fert(c.uid, idx(c.body))));
  R('POST', '/api/farm/expand', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.expand(c.uid, c.body.idx === undefined || c.body.idx === null ? -1 : idx(c.body), o), o); });
  R('POST', '/api/farm/red', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.red(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/harvest-all', { auth: 1 }, (c) => { const l = game.plots(c.uid).filter(P => P.u && P.c >= 0 && P.p >= 1).map(P => P.idx); if (!l.length) throw U.conflict('还没有成熟的作物', 'none'); const b = game.batch(c.uid, (i, o) => game.harvest(c.uid, i, o), l); return own(c.uid, b.res, b.out); });
  R('POST', '/api/farm/care-all', { auth: 1 }, (c) => { const l = []; game.plots(c.uid).forEach(P => { if (P.u && P.c >= 0) ['d', 'w', 'b'].forEach(k => { if (P.pr[k]) l.push(P.idx); }); }); if (!l.length) throw U.conflict('农田都很健康', 'none'); const b = game.batch(c.uid, (i, o) => game.care(c.uid, i, o), l); return own(c.uid, b.res, b.out); });
  R('POST', '/api/farm/plant-all', { auth: 1 }, (c) => { const crop = U.int(c.body.crop, '种子', 0, CFG.CROPS.length - 1); const l = game.plots(c.uid).filter(P => P.u && P.c < 0).map(P => P.idx); if (!l.length) throw U.conflict('没有空地了', 'none'); const b = game.batch(c.uid, (i, o) => game.plant(c.uid, i, crop, o), l); if (!b.res.some(r => !r.err)) throw U.conflict(b.res[0].err, b.res[0].code); return own(c.uid, b.res, b.out); });
  R('POST', '/api/shop/buy', { auth: 1 }, (c) => own(c.uid, game.buy(c.uid, String(c.body.item), c.body.n)));
  R('POST', '/api/shop/dog', { auth: 1 }, (c) => own(c.uid, game.buyDog(c.uid)));
  R('POST', '/api/dog/feed', { auth: 1 }, (c) => own(c.uid, game.feedDog(c.uid)));
  R('POST', '/api/wh/sell', { auth: 1 }, (c) => own(c.uid, game.sell(c.uid, String(c.body.item), c.body.n)));
  R('POST', '/api/wh/sell-all', { auth: 1 }, (c) => own(c.uid, game.sellAll(c.uid)));
  R('POST', '/api/checkin', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.checkin(c.uid, o), o); });
  R('GET', '/api/tasks', { auth: 1 }, (c) => game.tasks(c.uid));
  R('POST', '/api/tasks/claim', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.claimTask(c.uid, String(c.body.kind), String(c.body.id), o), o); });
  R('GET', '/api/achievements', { auth: 1 }, (c) => game.achievements(c.uid));
  R('POST', '/api/achievements/claim', { auth: 1 }, (c) => own(c.uid, game.claimAch(c.uid, String(c.body.id))));
  R('GET', '/api/orders', { auth: 1 }, (c) => game.orders(c.uid));
  R('POST', '/api/orders/deliver', { auth: 1 }, (c) => { const o = {}; return own(c.uid, game.deliver(c.uid, U.int(c.body.slot, '订单', 0, 2), o), o); });
  R('POST', '/api/orders/refresh', { auth: 1 }, (c) => own(c.uid, game.refreshOrder(c.uid, U.int(c.body.slot, '订单', 0, 2))));
  R('GET', '/api/codex', { auth: 1 }, (c) => game.codexList(c.uid));
  R('GET', '/api/cosmetics', { auth: 1 }, (c) => game.cosmetics(c.uid));
  R('POST', '/api/cosmetics/buy', { auth: 1 }, (c) => own(c.uid, game.buyCosmetic(c.uid, String(c.body.kind), String(c.body.id))));

  // 社交
  R('GET', '/api/friends', { auth: 1 }, (c) => game.friends(c.uid));
  R('GET', '/api/friends/search', { auth: 1, searchLimit: 1 }, (c) => game.search(c.uid, c.query.q));
  R('POST', '/api/friends/request', { auth: 1 }, (c) => game.requestFriend(c.uid, id(c.body.id)));
  R('POST', '/api/friends/add', { auth: 1 }, (c) => game.addFriend(c.uid, id(c.body.id)));
  R('GET', '/api/neighbors', { auth: 1 }, (c) => game.neighbors(c.uid));
  R('POST', '/api/friends/respond', { auth: 1 }, (c) => game.respondRequest(c.uid, id(c.body.id), !!c.body.accept));
  R('POST', '/api/friends/remove', { auth: 1 }, (c) => game.removeFriend(c.uid, id(c.body.id)));
  R('POST', '/api/friends/block', { auth: 1 }, (c) => game.block(c.uid, id(c.body.id), !!c.body.on));
  R('POST', '/api/invite/accept', { auth: 1 }, (c) => game.acceptInvite(c.uid, c.body.code));
  R('GET', '/api/farm/:id', { auth: 1 }, (c) => { const o = id(c.params.id); return { farm: game.visit(c.uid, o), now: game.now() }; });
  R('POST', '/api/farm/:id/steal', { auth: 1 }, (c) => { const o = id(c.params.id), out = {}; return fv(c.uid, o, game.steal(c.uid, o, idx(c.body), out), out); });
  R('POST', '/api/farm/:id/help', { auth: 1 }, (c) => { const o = id(c.params.id), out = {}; return fv(c.uid, o, game.help(c.uid, o, idx(c.body), out), out); });
  R('POST', '/api/farm/:id/steal-all', { auth: 1 }, (c) => { const o = id(c.params.id); const l = game.farmView(c.uid, o).plots.filter(p => p.canSteal).map(p => p.idx); if (!l.length) throw U.conflict('没有可以摘的果实了', 'none'); const b = game.batch(c.uid, (i, out) => game.steal(c.uid, o, i, out), l); return fv(c.uid, o, b.res, b.out); });
  R('POST', '/api/farm/:id/help-all', { auth: 1 }, (c) => { const o = id(c.params.id); const l = []; game.plots(o).forEach(P => { if (P.u && P.c >= 0) ['d', 'w', 'b'].forEach(k => { if (P.pr[k]) l.push(P.idx); }); }); if (!l.length) throw U.conflict('这里不需要帮忙', 'none'); const b = game.batch(c.uid, (i, out) => game.help(c.uid, o, i, out), l); return fv(c.uid, o, b.res, b.out); });
  R('GET', '/api/guestbook/:id', { auth: 1 }, (c) => game.guestbook(c.uid, id(c.params.id)));
  R('POST', '/api/guestbook/hide', { auth: 1 }, (c) => game.hideGuestbook(c.uid, id(c.body.id)));
  R('POST', '/api/guestbook/:id', { auth: 1 }, (c) => game.postGuestbook(c.uid, id(c.params.id), c.body.phrase));
  R('GET', '/api/messages', { auth: 1 }, (c) => game.messages(c.uid));
  R('POST', '/api/messages/read', { auth: 1 }, (c) => game.readMessages(c.uid));

  // 集市 / 排行 / 赛季
  R('GET', '/api/market', { auth: 1 }, (c) => game.market(c.uid, c.query.item || ''));
  R('POST', '/api/market/list', { auth: 1 }, (c) => ({ result: game.listItem(c.uid, String(c.body.item), c.body.qty, c.body.price), state: st(c.uid) }));
  R('POST', '/api/market/cancel', { auth: 1 }, (c) => ({ result: game.cancelListing(c.uid, id(c.body.id)), state: st(c.uid) }));
  R('POST', '/api/market/buy', { auth: 1 }, (c) => ({ result: game.buyListing(c.uid, id(c.body.id)), state: st(c.uid) }));
  R('GET', '/api/rank', { auth: 1 }, (c) => game.leaderboard(c.uid, String(c.query.dim || 'lv'), c.query.scope === 'global' ? 'global' : 'friends'));
  R('GET', '/api/season', { auth: 1 }, (c) => game.season(c.uid));
  R('POST', '/api/season/claim', { auth: 1 }, (c) => own(c.uid, game.claimSeason(c.uid)));

  // 运营后台
  R('GET', '/api/admin/stats', { admin: 1 }, () => admin.stats());
  R('GET', '/api/admin/players', { admin: 1 }, (c) => admin.players(c.query.q));
  R('GET', '/api/admin/player/:id', { admin: 1 }, (c) => admin.player(id(c.params.id)));
  R('POST', '/api/admin/ban', { admin: 1 }, (c) => admin.ban(c.uid, id(c.body.id), !!c.body.on, c.body.reason));
  R('POST', '/api/admin/adjust', { admin: 1 }, (c) => admin.adjust(c.uid, id(c.body.id), c.body));
  R('POST', '/api/admin/role', { admin: 1 }, (c) => admin.setRole(c.uid, id(c.body.id), String(c.body.role)));
  R('GET', '/api/admin/events', { admin: 1 }, () => admin.events());
  R('POST', '/api/admin/events', { admin: 1 }, (c) => admin.saveEvent(c.uid, c.body));
  R('POST', '/api/admin/events/delete', { admin: 1 }, (c) => admin.deleteEvent(c.uid, id(c.body.id)));
  R('GET', '/api/admin/config', { admin: 1 }, () => admin.getConfig());
  R('POST', '/api/admin/config', { admin: 1 }, (c) => admin.setConfig(c.uid, String(c.body.key), c.body.value));
  R('GET', '/api/admin/audit', { admin: 1 }, () => admin.auditLog());
  R('GET', '/api/admin/errors', { admin: 1 }, () => admin.errors());
  R('GET', '/api/admin/suspects', { admin: 1 }, () => admin.suspects());

  // 测试专用：拨动服务器时钟（生产环境不可用）
  if (opts.testClock) { R('POST', '/api/test/clock', {}, (c) => { game.clockOffset += Number(c.body.ms) || 0; return { now: game.now() }; }); R('POST', '/api/test/npc-tick', {}, () => { vill.tick(opts.npcTickSec); return {}; }); }

  // ---- 静态页面 ----
  const pages = { '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/admin.html': 'admin.html', '/vendor/three.min.js': 'vendor/three.min.js' }; const pcache = {};
  function serveStatic(req, res, p) {
    const f = path.join(ROOT, pages[p]); let st; try { st = fs.statSync(f); } catch (e) { res.writeHead(404); return res.end('Not found'); }
    let c = pcache[f]; if (!c || c.m !== st.mtimeMs) { const raw = fs.readFileSync(f); c = pcache[f] = { m: st.mtimeMs, raw, gz: zlib.gzipSync(raw) }; }
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const js = /\.js$/.test(f);
    res.writeHead(200, Object.assign(secHeaders(), { 'Content-Type': js ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': js ? 'public, max-age=604800' : 'no-cache' }, gz ? { 'Content-Encoding': 'gzip' } : {}));
    res.end(req.method === 'HEAD' ? undefined : gz ? c.gz : c.raw);
  }
  const secHeaders = () => ({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });

  // ---- 请求处理 ----
  function send(res, status, obj, cors) { const body = JSON.stringify(obj); res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, cors)); res.end(body); }
  function readBody(req) { return new Promise((resolve, reject) => { let n = 0; const chunks = []; req.on('data', d => { n += d.length; if (n > 64 * 1024) { reject(U.bad('请求太大')); req.destroy(); } else chunks.push(d); }); req.on('end', () => { if (!n) return resolve({}); try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); } catch (e) { reject(U.bad('请求格式不对')); } }); req.on('error', reject); }); }
  async function handle(req, res) {
    const t0 = process.hrtime.bigint(), url = new URL(req.url, 'http://x'), p = url.pathname;
    const origin = req.headers.origin, cors = origin && opts.cors.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' } : {};
    if (!p.startsWith('/api/')) { if ((req.method === 'GET' || req.method === 'HEAD') && pages[p]) return serveStatic(req, res, p); res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const ip = (opts.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
    let route, m; for (const r of routes) { if (r.method === req.method && (m = r.re.exec(p))) { route = r; break; } }
    let status = 200;
    try {
      if (!route) throw U.notFound('接口不存在');
      if (!lim.take('ip:' + ip, 40, 120)) throw new U.ApiError(429, 'rate', '操作太频繁了，请稍后再试');
      if (route.flags.authLimit && !lim.take('auth:' + ip, 0.3, 12)) throw new U.ApiError(429, 'rate', '尝试次数太多，请稍后再试');
      if (route.flags.guestLimit && !lim.take('guest:' + ip, 20 / 3600, 20)) throw new U.ApiError(429, 'rate', '注册太频繁了，请稍后再试');
      const c = { params: {}, query: Object.fromEntries(url.searchParams), ip, ua: req.headers['user-agent'] || '' };
      route.keys.forEach((k, i) => c.params[k] = decodeURIComponent(m[i + 1]));
      c.body = req.method === 'POST' ? await readBody(req) : {};
      const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const result = db.tx(() => {
        if (route.flags.auth || route.flags.admin || route.flags.optAuth) {
          const a = game.auth(tok);
          if (!a && !route.flags.optAuth) throw new U.ApiError(401, 'auth', '请先登录');
          if (a) {
            if (a.user.banned && !route.flags.allowBanned) throw new U.ApiError(403, 'banned', '账号已被封禁：' + (a.user.ban_reason || '违反规则'));
            if (route.flags.admin && a.user.role !== 'admin') throw U.forbid('需要管理员权限');
            c.uid = a.user.id; c.tokenHash = a.tokenHash;
            if (!lim.take('u:' + c.uid, 15, 45)) throw new U.ApiError(429, 'rate', '操作太频繁了，请稍后再试');
            if (route.flags.searchLimit && !lim.take('s:' + c.uid, 0.5, 10)) throw new U.ApiError(429, 'rate', '搜索太频繁了');
          }
        }
        const ik = req.method === 'POST' && c.uid ? String(req.headers['idempotency-key'] || '').slice(0, 80) : '';
        if (ik) { const prev = db.get('SELECT resp FROM idem WHERE user_id=? AND key=?', c.uid, ik); if (prev) { const r = JSON.parse(prev.resp); r.replayed = true; return r; } }
        const r = route.fn(c);
        if (ik) db.run('INSERT INTO idem (user_id,key,resp,at) VALUES (?,?,?,?)', c.uid, ik, JSON.stringify(r), game.now());
        return r;
      });
      send(res, 200, Object.assign({ ok: true }, Array.isArray(result) ? { list: result } : result), cors);
    } catch (e) {
      if (e instanceof U.ApiError) { status = e.status; send(res, e.status, { ok: false, code: e.code, error: e.message }, cors); }
      else if (e && /CHECK constraint failed/.test(e.message)) { status = 409; send(res, 409, { ok: false, code: 'constraint', error: '数量不足或数据冲突，请刷新后重试' }, cors); }
      else if (e && /UNIQUE constraint failed/.test(e.message)) { status = 409; send(res, 409, { ok: false, code: 'duplicate', error: '操作已经处理过了' }, cors); }
      else {
        status = 500; if (!opts.quiet) console.error('[error]', req.method, p, e && e.stack || e);
        try { db.run('INSERT INTO errors (at,route,msg) VALUES (?,?,?)', game.now(), req.method + ' ' + (route ? route.re.source : p), String(e && e.message || e).slice(0, 500)); } catch (_) { }
        send(res, 500, { ok: false, code: 'server', error: '服务器开小差了，请稍后再试' }, cors);
      }
    } finally {
      mbump('api_calls'); if (status >= 500) mbump('api_errors'); mbump('api_ms', Math.round(Number(process.hrtime.bigint() - t0) / 1e6));
    }
  }

  // ---- 备份：VACUUM INTO，保留最近 N 份 ----
  function backup() {
    if (opts.db === ':memory:') return null; fs.mkdirSync(opts.backupDir, { recursive: true });
    const name = 'farm-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16) + '.db', f = path.join(opts.backupDir, name);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
    const all = fs.readdirSync(opts.backupDir).filter(n => /^farm-.*\.db$/.test(n)).sort(); all.slice(0, Math.max(0, all.length - opts.backupKeep)).forEach(n => fs.unlinkSync(path.join(opts.backupDir, n)));
    return f;
  }
  if (opts.backupHours > 0 && opts.db !== ':memory:') timers.push(setInterval(() => { try { const f = backup(); if (!opts.quiet) console.log('[backup]', f); } catch (e) { console.error('[backup] 失败', e.message); } }, opts.backupHours * 3600000));
  timers.forEach(t => t.unref());

  const server = http.createServer((req, res) => { handle(req, res).catch(e => { try { send(res, 500, { ok: false, error: 'server' }); } catch (_) { } }); });
  server.keepAliveTimeout = 30000;
  const close = () => new Promise(r => { timers.forEach(clearInterval); flush(); server.close(() => { try { db.close(); } catch (e) { } r(); }); server.closeAllConnections && server.closeAllConnections(); });
  return { server, db, game, admin, vill, backup, close, opts };
}

module.exports = { createApp, VERSION };

if (require.main === module) {
  const app = createApp();
  app.server.listen(ENV.port, ENV.host, () => console.log(`🌾 丰收农场 v${VERSION} 已启动：http://${ENV.host === '0.0.0.0' ? 'localhost' : ENV.host}:${ENV.port}  数据库：${ENV.db}${ENV.testClock ? '  [测试时钟已开启]' : ''}`));
  const stop = () => { console.log('正在关闭…'); app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
