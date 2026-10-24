'use strict';
/* =====================================================
   丰收农场 · 请求处理核心（与运行平台无关）
   - 本机 / 自己的服务器：server/index.js 用 Node http 包一层
   - EdgeOne Pages 云函数：cloud-functions/api/[[default]].js 包一层
   输入：{ method, url, headers(小写键), body(字符串), ip, secure }
   输出：{ status, headers, body }
   ===================================================== */
const CFG = require('../shared/config');
const U = require('./util');
const { open, SCHEMA_VERSION } = require('./db');
const { Game } = require('./game');
const { Admin } = require('./admin');
const { Villagers } = require('./npc');

const VERSION = require('../shared/config').VERSION;
const all = Promise.all.bind(Promise);

function envOpts(env) {
  env = env || process.env;
  return {
    tzMin: +(env.TZ_OFFSET_MIN || 480), prod: env.NODE_ENV === 'production',
    cors: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY === '1', testClock: env.FARM_TEST_CLOCK === '1' && env.NODE_ENV !== 'production',
    admins: (env.ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean), quiet: env.QUIET === '1',
    npcCount: env.NPC_COUNT === undefined ? 24 : +env.NPC_COUNT, npcTickSec: +(env.NPC_TICK_SEC || 30),
    tursoUrl: env.TURSO_DATABASE_URL || '', tursoToken: env.TURSO_AUTH_TOKEN || '',
  };
}

async function createCore(opts) {
  opts = Object.assign(envOpts(), opts || {});
  CFG.setTz(opts.tzMin);
  const db = await open({ file: opts.db || ':memory:', tursoUrl: opts.tursoUrl, tursoToken: opts.tursoToken, fetch: opts.fetch });
  const game = new Game(db, { tzMin: opts.tzMin }), admin = new Admin(game), vill = new Villagers(game), lim0 = new U.Limiter();
  await game.applyConfigOverrides();
  const lim = { take: (...a) => opts.noRateLimit ? true : lim0.take(...a) };
  if (opts.admins.length) await db.run(`UPDATE users SET role='admin' WHERE username IN (${opts.admins.map(() => '?').join(',')})`, ...opts.admins);

  // ---- 指标：内存累计，每 30 秒随请求顺手落库（不进事务，不会引起冲突） ----
  const mem = {}; let memAt = Date.now(); const mbump = (k, n) => mem[k] = (mem[k] || 0) + (n || 1);
  const flushMetrics = (force) => {
    if (!force && Date.now() - memAt < 30000) return; memAt = Date.now();
    const day = CFG.dayKey(game.now()); Object.keys(mem).forEach(k => { db.bg('INSERT INTO metrics (day,key,val) VALUES (?,?,?) ON CONFLICT(day,key) DO UPDATE SET val=val+excluded.val', day, k, mem[k]); delete mem[k]; });
  };

  /* ---- 后台任务（NPC、清理）：用租约保证多实例下同一时间只有一个在跑 ----
     本机：定时器调用；EdgeOne：前端每分钟顺手调用 /api/cron（无人在线时不需要跑） */
  async function lease(name, holdMs) {
    const now = game.now();
    await db.run('INSERT OR IGNORE INTO leases (name,until,at) VALUES (?,0,0)', name);
    const L = await db.get('SELECT until, at FROM leases WHERE name=?', name);
    if (L.until > now) return null;
    const r = await db.run('UPDATE leases SET until=?, at=? WHERE name=? AND until=?', now + holdMs, now, name, L.until);
    return r.changes ? { prevAt: L.at, now } : null;
  }
  const release = (name, nextMs) => db.run('UPDATE leases SET until=? WHERE name=?', game.now() + nextMs, name);
  let npcBusy = false;
  async function runNpc(budgetMs) {
    if (opts.npcCount <= 0 || npcBusy) return { skipped: true };
    npcBusy = true;
    try {
      const L = await lease('npc', (budgetMs || 20000) + 15000); if (!L) return { skipped: true };
      const t0 = Date.now();
      try {
        await vill.ensure(Math.min(80, opts.npcCount), budgetMs ? budgetMs / 2 : 0);
        const since = L.prevAt ? Math.max(1, Math.min(1800, (L.now - L.prevAt) / 1000)) : opts.npcTickSec;
        await vill.tick(since, budgetMs ? Math.max(1000, budgetMs - (Date.now() - t0)) : 0);
      } finally { await release('npc', Math.max(1000, opts.npcTickSec * 1000 - 2000)).catch(() => { }); }
      return { ran: true, ms: Date.now() - t0 };
    } catch (e) { if (!opts.quiet) console.error('[npc]', e && e.stack || e); return { error: true }; }
    finally { npcBusy = false; }
  }
  async function runMaint() {
    try {
      const L = await lease('maint', 60000); if (!L) return { skipped: true };
      await db.run('DELETE FROM idem WHERE at<?', game.now() - 86400000);
      await db.run('DELETE FROM sessions WHERE last_seen<?', game.now() - 90 * 86400000);
      await db.run('DELETE FROM errors WHERE id < (SELECT id FROM errors ORDER BY id DESC LIMIT 1 OFFSET 999)');
      await release('maint', 3600000);
      return { ran: true };
    } catch (e) { return { error: true }; }
  }

  // ---- 路由 ----
  const routes = [];
  const R = (method, pat, flags, fn) => { const keys = []; const re = new RegExp('^' + pat.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$'); routes.push({ method, re, keys, flags, fn }); };
  const st = uid => game.snapshot(uid);
  // 返回“结果 + 最新状态”的写操作：状态在事务最后一批读取里取（与提交合并）；幂等重放时重新读取最新状态
  const fv = (uid, owner, result, out) => ({ __view: 'fv', uid, owner, result, out });
  const own = (uid, result, out) => ({ __view: 'own', uid, result, out });
  const view = async v => {
    if (v.__view === 'own') return { result: v.result, out: v.out, state: await st(v.uid) };
    game.forget(v.uid); game.forget(v.owner);
    const [u, inv, badges, farm] = await all([game.user(v.uid), game.inv(v.uid), game.badges(v.uid), game.farmView(v.uid, v.owner)]); return { result: v.result, out: v.out, me: game.me(u), inv, badges, farm, now: game.now() };
  };
  const idx = b => U.int(b.idx, '土地', 0, CFG.MAX_PLOTS - 1);
  const id = v => U.int(v, 'ID', 1, Number.MAX_SAFE_INTEGER);
  const sick = P => { const l = []; if (P.u && P.c >= 0) ['d', 'w', 'b'].forEach(k => { if (P.pr[k]) l.push(P.idx); }); return l; };

  // 公共
  R('GET', '/api/health', { noTx: 1 }, async () => ({ ok: true, version: VERSION, schema: SCHEMA_VERSION, db: db.kind, now: game.now() }));
  R('GET', '/api/config', { noTx: 1 }, async () => game.publicConfig());
  R('POST', '/api/auth/guest', { authLimit: 1, guestLimit: 1 }, async (c) => { const uid = await game.createUser(c.body.name); const token = game.newSession(uid, c.ua); c.addDev(token); return { token, state: await st(uid) }; });
  R('POST', '/api/auth/register', { authLimit: 1, guestLimit: 1 }, async (c) => { U.checkPw2(c.body.password, c.body.password2); const uid = await game.createUser(c.body.name, c.body.username, c.body.password); const token = game.newSession(uid, c.ua); c.addDev(token); return { token, state: await st(uid) }; });
  R('POST', '/api/auth/login', { authLimit: 1 }, async (c) => { const u = await game.login(c.body.username, c.body.password); if (u.banned) throw U.forbid('账号已被封禁：' + (u.ban_reason || '违反规则')); const token = (await c.devFor(u.id)) || game.newSession(u.id, c.ua); c.addDev(token); return { token, state: await st(u.id) }; });
  R('POST', '/api/auth/recover', { authLimit: 1 }, async (c) => { const r = await game.recover(c.body.username, c.body.code, c.body.password); const token = game.newSession(r.user.id, c.ua); c.addDev(token); return { token, recovery: r.recovery, state: await st(r.user.id) }; });
  R('GET', '/api/invite/:code', {}, async (c) => { const u = await db.get('SELECT * FROM users WHERE code=? AND banned=0', String(c.params.code)); if (!u) throw U.notFound('邀请链接无效'); return game.publicUser(u); });
  R('POST', '/api/telemetry', { optAuth: 1, noTx: 1 }, async (c) => { const ms = Math.round(Number(c.body.loadMs)); if (ms > 0 && ms < 60000) { mbump('load_n'); mbump('load_ms', ms); } return {}; });
  // 后台任务触发：无服务器部署时由在线玩家的页面每分钟调用一次（有租约，重复调用会直接跳过）
  let cronAt = 0;
  R('POST', '/api/cron', { noTx: 1, cron: 1 }, async () => { if (Date.now() - cronAt < 20000) return { skipped: true }; cronAt = Date.now(); const [npc, maint] = await all([runNpc(opts.cronBudgetMs || 20000), runMaint()]); flushMetrics(true); return { npc, maint }; });

  // 账号
  R('POST', '/api/auth/logout', { auth: 1, allowBanned: 1 }, async (c) => { db.w('DELETE FROM sessions WHERE token_hash=?', c.tokenHash); c.dropDev(c.token); return {}; });
  // 本机账号：HttpOnly Cookie 长期保存本机登录过的账号，苹果设备清理网页存储后也能一键进入
  const devList = async c => { const us = await all(c.devTokens.map(t => game.peek(t))); return c.devTokens.map((t, i) => ({ t, u: us[i] })).filter(x => { if (!x.u || x.u.banned) { c.dropDev(x.t); return false; } return true; }); };
  R('GET', '/api/accounts', {}, async (c) => { const l = await devList(c); c.touchDev(); return { list: l.map(x => Object.assign(game.publicUser(x.u), { guest: !x.u.username, last: x.u.last_active })) }; });
  R('POST', '/api/accounts/use', { authLimit: 1 }, async (c) => { const x = (await devList(c)).find(x => x.u.id === Number(c.body.id)); if (!x) throw U.notFound('这台设备上没有保存这个账号，请重新登录'); c.touchDev(); return { token: x.t, state: await st(x.u.id) }; });
  R('POST', '/api/accounts/remember', { auth: 1 }, async (c) => { c.addDev(c.token); return {}; });
  R('POST', '/api/accounts/forget', {}, async (c) => { const x = (await devList(c)).find(x => x.u.id === Number(c.body.id)); if (x) { db.w('DELETE FROM sessions WHERE token_hash=?', U.sha256(x.t)); c.dropDev(x.t); } return {}; });
  R('POST', '/api/auth/bind', { auth: 1, authLimit: 1 }, (c) => { U.checkPw2(c.body.password, c.body.password2); return game.bind(c.uid, c.body.username, c.body.password); });
  R('POST', '/api/auth/password', { auth: 1, authLimit: 1 }, async (c) => { U.checkPw2(c.body.password, c.body.password2); await game.changePassword(c.uid, c.body.old, c.body.password); return { token: game.newSession(c.uid, c.ua) }; });
  R('GET', '/api/state', { auth: 1 }, (c) => st(c.uid));
  R('POST', '/api/me/profile', { auth: 1 }, async (c) => { await game.updateProfile(c.uid, c.body); return own(c.uid); });
  R('POST', '/api/me/migrate', { auth: 1 }, async (c) => own(c.uid, await game.migrate(c.uid, c.body)));
  R('GET', '/api/me/export', { auth: 1, allowBanned: 1 }, (c) => game.exportData(c.uid));
  R('POST', '/api/me/delete', { auth: 1, authLimit: 1, allowBanned: 1 }, async (c) => { await game.deleteAccount(c.uid, c.body.password, c.body.confirm); c.dropDev(c.token); return {}; });

  // 自己的农场
  R('POST', '/api/farm/plant', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.plant(c.uid, idx(c.body), U.int(c.body.crop, '种子', 0, CFG.CROPS.length - 1), o), o); });
  R('POST', '/api/farm/harvest', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.harvest(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/care', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.care(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/shovel', { auth: 1 }, async (c) => own(c.uid, await game.shovel(c.uid, idx(c.body))));
  R('POST', '/api/farm/fert', { auth: 1 }, async (c) => own(c.uid, await game.fert(c.uid, idx(c.body))));
  R('POST', '/api/farm/field', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.buyField(c.uid, o), o); });
  R('POST', '/api/farm/expand', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.expand(c.uid, c.body.idx === undefined || c.body.idx === null ? -1 : idx(c.body), o), o); });
  R('POST', '/api/farm/red', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.red(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/harvest-all', { auth: 1 }, async (c) => { const l = (await game.plots(c.uid)).filter(P => P.u && P.c >= 0 && P.p >= 1).map(P => P.idx); if (!l.length) throw U.conflict('还没有成熟的作物', 'none'); const b = await game.batch(c.uid, (i, o) => game.harvest(c.uid, i, o), l); return own(c.uid, b.res, b.out); });
  R('POST', '/api/farm/fert-all', { auth: 1 }, async (c) => own(c.uid, await game.fertAll(c.uid)));
  R('POST', '/api/farm/care-all', { auth: 1 }, async (c) => { const l = [].concat(...(await game.plots(c.uid)).map(sick)); if (!l.length) throw U.conflict('农田都很健康', 'none'); const b = await game.batch(c.uid, (i, o) => game.care(c.uid, i, o), l); return own(c.uid, b.res, b.out); });
  R('POST', '/api/farm/plant-all', { auth: 1 }, async (c) => { const crop = U.int(c.body.crop, '种子', 0, CFG.CROPS.length - 1); const l = (await game.plots(c.uid)).filter(P => P.u && P.c < 0).map(P => P.idx); if (!l.length) throw U.conflict('没有空地了', 'none'); const b = await game.batch(c.uid, (i, o) => game.plant(c.uid, i, crop, o), l); if (!b.res.some(r => !r.err)) throw U.conflict(b.res[0].err, b.res[0].code); return own(c.uid, b.res, b.out); });
  R('POST', '/api/shop/buy', { auth: 1 }, async (c) => own(c.uid, await game.buy(c.uid, String(c.body.item), c.body.n)));
  R('POST', '/api/shop/dog', { auth: 1 }, async (c) => own(c.uid, await game.buyDog(c.uid, c.body.kind ? String(c.body.kind) : 'fuwang')));
  R('POST', '/api/ranch/fish/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyFish(c.uid, U.int(c.body.type, '鱼苗', 0, 99), c.body.n)));
  R('POST', '/api/ranch/fish/collect', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.collectFish(c.uid, o), o); });
  R('POST', '/api/ranch/sheep/buy', { auth: 1 }, async (c) => own(c.uid, await game.buySheep(c.uid, U.int(c.body.type, '羊', 0, 99), c.body.n)));
  R('POST', '/api/ranch/upgrade', { auth: 1 }, async (c) => own(c.uid, await game.ranchUpgrade(c.uid, String(c.body.kind || ''))));
  R('POST', '/api/ranch/tree/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyTree(c.uid, U.int(c.body.type, '树苗', 0, 99), c.body.n)));
  R('POST', '/api/ranch/fruit', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.pickFruit(c.uid, o), o); });
  R('POST', '/api/dog/train', { auth: 1 }, async (c) => own(c.uid, await game.trainDog(c.uid, c.body.kind ? String(c.body.kind) : 'fuwang')));
  R('POST', '/api/ranch/shear', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.shear(c.uid, o), o); });
  R('POST', '/api/ranch/herd', { auth: 1 }, async (c) => own(c.uid, await game.herd(c.uid, c.body.kind ? String(c.body.kind) : '')));
  R('POST', '/api/dog/feed', { auth: 1 }, async (c) => own(c.uid, await game.feedDog(c.uid, c.body.kind ? String(c.body.kind) : 'fuwang')));
  R('POST', '/api/wh/sell', { auth: 1 }, async (c) => own(c.uid, await game.sell(c.uid, String(c.body.item), c.body.n)));
  R('POST', '/api/wh/sell-all', { auth: 1 }, async (c) => own(c.uid, await game.sellAll(c.uid)));
  R('POST', '/api/checkin', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.checkin(c.uid, o), o); });
  R('GET', '/api/tasks', { auth: 1 }, (c) => game.tasks(c.uid));
  R('POST', '/api/tasks/claim', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.claimTask(c.uid, String(c.body.kind), String(c.body.id), o), o); });
  R('GET', '/api/achievements', { auth: 1 }, (c) => game.achievements(c.uid));
  R('POST', '/api/achievements/claim', { auth: 1 }, async (c) => own(c.uid, await game.claimAch(c.uid, String(c.body.id))));
  R('GET', '/api/orders', { auth: 1 }, (c) => game.orders(c.uid));
  R('POST', '/api/orders/deliver', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.deliver(c.uid, U.int(c.body.slot, '订单', 0, CFG.RULES.orderSlotsMax - 1), o), o); });
  R('POST', '/api/orders/refresh', { auth: 1 }, async (c) => own(c.uid, await game.refreshOrder(c.uid, U.int(c.body.slot, '订单', 0, CFG.RULES.orderSlotsMax - 1))));
  R('GET', '/api/codex', { auth: 1 }, (c) => game.codexList(c.uid));
  R('GET', '/api/cosmetics', { auth: 1 }, (c) => game.cosmetics(c.uid));
  R('POST', '/api/cosmetics/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyCosmetic(c.uid, String(c.body.kind), String(c.body.id))));

  // 社交
  // 合并轮询：一次请求拿到 状态 +（可选）好友/附近 +（可选）正在逛的农场，减少云函数调用次数
  R('GET', '/api/poll', { auth: 1 }, async (c) => {
    const q = c.query, out = {};
    const jobs = [st(c.uid).then(v => out.state = v)];
    if (q.side) jobs.push(game.friends(c.uid).then(v => out.friends = v), game.neighbors(c.uid).then(v => out.neighbors = v));
    if (q.visit) { const o = id(q.visit); jobs.push(game.peekFarm(c.uid, o).then(v => out.farm = v, e => { if (!e.status) throw e; out.farmErr = { status: e.status, error: e.message }; })); }
    await all(jobs); out.now = game.now(); return out;
  });
  R('GET', '/api/friends', { auth: 1 }, (c) => game.friends(c.uid));
  R('GET', '/api/friends/search', { auth: 1, searchLimit: 1 }, (c) => game.search(c.uid, c.query.q));
  R('POST', '/api/friends/request', { auth: 1 }, (c) => game.requestFriend(c.uid, id(c.body.id)));
  R('POST', '/api/friends/add', { auth: 1 }, (c) => game.addFriend(c.uid, id(c.body.id)));
  R('GET', '/api/neighbors', { auth: 1 }, (c) => game.neighbors(c.uid));
  R('POST', '/api/friends/respond', { auth: 1 }, (c) => game.respondRequest(c.uid, id(c.body.id), !!c.body.accept));
  R('POST', '/api/friends/remove', { auth: 1 }, (c) => game.removeFriend(c.uid, id(c.body.id)));
  R('POST', '/api/friends/block', { auth: 1 }, (c) => game.block(c.uid, id(c.body.id), !!c.body.on));
  R('POST', '/api/invite/accept', { auth: 1 }, (c) => game.acceptInvite(c.uid, c.body.code));
  R('GET', '/api/farm/:id', { auth: 1 }, async (c) => { const o = id(c.params.id); return { farm: await game.visit(c.uid, o), now: game.now() }; });
  R('POST', '/api/farm/:id/steal', { auth: 1 }, async (c) => { const o = id(c.params.id), out = {}; return fv(c.uid, o, await game.steal(c.uid, o, idx(c.body), out), out); });
  R('POST', '/api/farm/:id/help', { auth: 1 }, async (c) => { const o = id(c.params.id), out = {}; return fv(c.uid, o, await game.help(c.uid, o, idx(c.body), out), out); });
  R('POST', '/api/farm/:id/steal-all', { auth: 1 }, async (c) => { const o = id(c.params.id); const l = (await game.farmView(c.uid, o)).plots.filter(p => p.canSteal).map(p => p.idx); if (!l.length) throw U.conflict('没有可以摘的果实了', 'none'); const b = await game.batch(c.uid, (i, out) => game.steal(c.uid, o, i, out), l); return fv(c.uid, o, b.res, b.out); });
  R('POST', '/api/farm/:id/help-all', { auth: 1 }, async (c) => { const o = id(c.params.id); const l = [].concat(...(await game.plots(o)).map(sick)); if (!l.length) throw U.conflict('这里不需要帮忙', 'none'); const b = await game.batch(c.uid, (i, out) => game.help(c.uid, o, i, out), l); return fv(c.uid, o, b.res, b.out); });
  R('GET', '/api/guestbook/:id', { auth: 1 }, (c) => game.guestbook(c.uid, id(c.params.id)));
  R('POST', '/api/guestbook/hide', { auth: 1 }, (c) => game.hideGuestbook(c.uid, id(c.body.id)));
  R('POST', '/api/guestbook/:id', { auth: 1 }, (c) => game.postGuestbook(c.uid, id(c.params.id), c.body.phrase));
  R('GET', '/api/messages', { auth: 1 }, (c) => game.messages(c.uid));
  R('POST', '/api/messages/read', { auth: 1 }, (c) => game.readMessages(c.uid));

  // 集市 / 排行 / 赛季
  R('GET', '/api/market', { auth: 1 }, (c) => game.market(c.uid, c.query.item || ''));
  R('POST', '/api/market/list', { auth: 1 }, async (c) => own(c.uid, await game.listItem(c.uid, String(c.body.item), c.body.qty, c.body.price)));
  R('POST', '/api/market/cancel', { auth: 1 }, async (c) => own(c.uid, await game.cancelListing(c.uid, id(c.body.id))));
  R('POST', '/api/market/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyListing(c.uid, id(c.body.id))));
  R('GET', '/api/rank', { auth: 1 }, (c) => game.leaderboard(c.uid, String(c.query.dim || 'lv'), c.query.scope === 'global' ? 'global' : 'friends'));
  R('GET', '/api/season', { auth: 1 }, (c) => game.season(c.uid));
  R('POST', '/api/season/claim', { auth: 1 }, async (c) => own(c.uid, await game.claimSeason(c.uid)));

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
  if (opts.testClock) { R('POST', '/api/test/clock', { noTx: 1 }, async (c) => { game.clockOffset += Number(c.body.ms) || 0; return { now: game.now() }; }); R('POST', '/api/test/npc-tick', { noTx: 1 }, async () => { await vill.tick(opts.npcTickSec); return {}; }); }

  // ---- 请求处理 ----
  const json = (status, obj, headers) => ({ status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers || {}), body: JSON.stringify(obj) });
  async function handle(req) {
    const t0 = Date.now(), url = new URL(req.url, 'http://x'), p = url.pathname, H = req.headers || {};
    const origin = H.origin, cors = origin && opts.cors.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Max-Age': '600' } : {};
    if (req.method === 'OPTIONS') return { status: 204, headers: cors, body: '' };
    const ip = req.ip || '?';
    let route, m; for (const r of routes) { if (r.method === req.method && (m = r.re.exec(p))) { route = r; break; } }
    let status = 200, reqCtx = null;
    try {
      if (!route) throw U.notFound('接口不存在');
      if (!route.flags.cron && !lim.take('ip:' + ip, 40, 120)) throw new U.ApiError(429, 'rate', '操作太频繁了，请稍后再试');
      if (route.flags.authLimit && !lim.take('auth:' + ip, 0.3, 12)) throw new U.ApiError(429, 'rate', '尝试次数太多，请稍后再试');
      if (route.flags.guestLimit && !lim.take('guest:' + ip, 20 / 3600, 20)) throw new U.ApiError(429, 'rate', '注册太频繁了，请稍后再试');
      const c = { params: {}, query: Object.fromEntries(url.searchParams), ip, ua: H['user-agent'] || '' };
      const cookies = U.parseCookies(H.cookie); c.devTokens = String(cookies.hf_dev || '').split('.').filter(t => /^[A-Za-z0-9_-]{20,64}$/.test(t)).slice(0, 10); c.devDirty = false;
      c.addDev = t => { c.devTokens = [t].concat(c.devTokens.filter(x => x !== t)).slice(0, 8); c.devDirty = true; };
      c.dropDev = t => { const n = c.devTokens.length; c.devTokens = c.devTokens.filter(x => x !== t); if (n !== c.devTokens.length) c.devDirty = true; };
      c.touchDev = () => { if (c.devTokens.length) c.devDirty = true; };
      c.devFor = async uid => { const us = await all(c.devTokens.map(t => game.peek(t))); const i = us.findIndex(u => u && u.id === uid); return i >= 0 ? c.devTokens[i] : ''; };
      reqCtx = c;
      route.keys.forEach((k, i) => c.params[k] = decodeURIComponent(m[i + 1]));
      if (req.method === 'POST') { const raw = String(req.body || ''); if (raw.length > 64 * 1024) throw U.bad('请求太大'); if (raw) { try { const v = JSON.parse(raw); c.body = v && typeof v === 'object' ? v : {}; } catch (e) { throw U.bad('请求格式不对'); } } else c.body = {}; } else c.body = {};
      const tok = String(H.authorization || '').replace(/^Bearer\s+/i, '');
      await game.refreshConfig();
      let touch = null;
      const body = async () => {
        const ik = req.method === 'POST' && tok ? String(H['idempotency-key'] || '').slice(0, 80) : '';
        let prevP = null;
        // 幂等记录与登录校验同时查（省一次往返）
        if (ik && (route.flags.auth || route.flags.admin || route.flags.optAuth)) { prevP = db.get('SELECT i.resp FROM idem i JOIN sessions s ON s.user_id=i.user_id WHERE s.token_hash=? AND i.key=?', U.sha256(tok), ik); prevP.catch(() => { }); }
        const authed = route.flags.auth || route.flags.admin || route.flags.optAuth;
        // 预读：登录校验的同时把这个玩家的土地、库存、计数器一起读回来（同一次往返）
        let pre = null;
        if (authed && tok) {
          const th = U.sha256(tok), sub = '(SELECT user_id FROM sessions WHERE token_hash=?)';
          pre = all([db.all(`SELECT * FROM plots WHERE user_id=${sub} ORDER BY idx`, th), db.all(`SELECT item,qty FROM inventory WHERE user_id=${sub}`, th), db.all(`SELECT period,key,val FROM counters WHERE user_id=${sub} AND period IN (?,?,'all')`, th, game.period('day'), game.period('week'))]);
          pre.catch(() => { });
        }
        if (authed) {
          const a = await game.auth(tok);
          if (!a && !route.flags.optAuth) throw new U.ApiError(401, 'auth', '请先登录');
          if (a) {
            if (a.user.banned && !route.flags.allowBanned) throw new U.ApiError(403, 'banned', '账号已被封禁：' + (a.user.ban_reason || '违反规则'));
            if (route.flags.admin && a.user.role !== 'admin') throw U.forbid('需要管理员权限');
            c.uid = a.user.id; c.tokenHash = a.tokenHash; c.token = tok; touch = a.touch;
            if (pre) { const [pl, iv, cn] = await pre; game.seed(c.uid, a.user, pl, iv, cn); }
            if (!lim.take('u:' + c.uid, 15, 45)) throw new U.ApiError(429, 'rate', '操作太频繁了，请稍后再试');
            if (route.flags.searchLimit && !lim.take('s:' + c.uid, 0.5, 10)) throw new U.ApiError(429, 'rate', '搜索太频繁了');
          }
        }
        if (prevP) { const prev = await prevP; if (prev && c.uid) { const p0 = JSON.parse(prev.resp); const r = p0.__view ? await view(p0) : p0; r.replayed = true; return r; } }
        const r = await route.fn(c);
        // 幂等记录与业务写入在同一个事务里：网络重试不会重复结算
        if (ik && c.uid) db.wx(U.conflict('操作已经处理过了', 'duplicate'), 'INSERT INTO idem (user_id,key,resp,at) VALUES (?,?,?,?)', c.uid, ik, JSON.stringify(Array.isArray(r) ? { list: r } : r), game.now());
        if (r && r.__view) return db.final(() => view(r));
        return r;
      };
      // 写操作（POST）直接排队 + 排他锁执行（SQLite 同一时间只有一个写入者，先排队比冲突后重来更快）；查询（GET）不加锁并发执行
      const result = route.flags.noTx ? await body() : await db.tx(body, { write: req.method === 'POST' });
      // 在线时间等“顺手写”放到事务提交之后，不参与冲突
      if (touch) touch.forEach(([sql, ...a]) => db.bg(sql, ...a));
      const extra = reqCtx && reqCtx.devDirty ? { 'Set-Cookie': `hf_dev=${reqCtx.devTokens.join('.')}; Path=/api; Max-Age=${reqCtx.devTokens.length ? 400 * 86400 : 0}; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}` } : null;
      return json(200, Object.assign({ ok: true }, Array.isArray(result) ? { list: result } : result), Object.assign({}, cors, extra || {}));
    } catch (e) {
      if (e instanceof U.ApiError) { status = e.status; return json(e.status, { ok: false, code: e.code, error: e.message }, cors); }
      if (e && /CHECK constraint failed/.test(e.message)) { status = 409; return json(409, { ok: false, code: 'constraint', error: '数量不足或数据冲突，请刷新后重试' }, cors); }
      if (e && /UNIQUE constraint failed/.test(e.message)) { status = 409; return json(409, { ok: false, code: 'duplicate', error: '操作已经处理过了' }, cors); }
      if (e && /SQLITE_BUSY|database is locked/i.test(e.message)) { status = 503; return json(503, { ok: false, code: 'busy', error: '服务器有点忙，请稍后重试' }, cors); }
      status = 500; if (!opts.quiet) console.error('[error]', req.method, p, e && e.stack || e);
      db.bg('INSERT INTO errors (at,route,msg) VALUES (?,?,?)', game.now(), req.method + ' ' + (route ? route.re.source : p), String(e && e.message || e).slice(0, 500));
      // detail：错误原因的第一行（测试阶段用于定位问题，不含堆栈）
      return json(500, { ok: false, code: 'server', error: '服务器开小差了，请稍后再试', detail: String(e && e.message || e).split('\n')[0].slice(0, 120) }, cors);
    } finally {
      mbump('api_calls'); if (status >= 500) mbump('api_errors'); mbump('api_ms', Date.now() - t0); flushMetrics();
    }
  }

  return { handle, db, game, admin, vill, opts, runNpc, runMaint, flushMetrics, VERSION };
}

module.exports = { createCore, envOpts, VERSION };
