'use strict';
/* =====================================================
   丰收农场 · 服务端权威游戏逻辑（异步）
   - 所有写操作都在 db.tx() 中执行，保证原子性；遇到并发写冲突整体重试
   - 数据库可能在远端（Turso）：互不依赖的读取用 Promise.all 合并成一次请求，
     不需要结果的写入用 db.w() 延迟到下一次读取 / 提交时一起发出
   - 可能失败的写入（扣金币、扣库存、领奖去重）用 db.wx(错误, ...)：约束不满足时抛出对应提示
   - V0.4 起按玩法拆分：这里只留核心（配置覆盖、活动、事务缓存、玩家 / 土地 / 背包 / 金币 / 经验 / 计数器 / 消息 / 可见性、概况）；
     各玩法的方法在 server/domains/*.js，挂到 Game.prototype 上，调用方式不变
   ===================================================== */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./domains/common'); // eslint-disable-line no-unused-vars

class Game {
  constructor(db, opts) {
    this.db = db; this.clockOffset = 0; this.opts = opts || {};
    this._ev = { at: -1e15, list: [] }; this._cfgAt = -1e15;
  }
  now() { return Date.now() + this.clockOffset; }

  /* ---------- 配置覆盖（运营后台可改作物数值与规则）：多实例部署时每分钟重新读取 ---------- */
  async applyConfigOverrides() {
    if (!this._base) this._base = { crops: CROPS.map(c => ({ seed: c.seed, time: c.time, yield: c.yield, price: c.price, exp: c.exp, lv: c.lv })), rules: Object.assign({}, RULES) };
    const [cr, rr] = await all([this.db.get("SELECT value FROM config WHERE key='crops'"), this.db.get("SELECT value FROM config WHERE key='rules'")]);
    CROPS.forEach((c, i) => Object.assign(c, this._base.crops[i])); Object.assign(RULES, this._base.rules);
    const co = J((cr || {}).value) || {};
    Object.keys(co).forEach(id => { const c = CROPS[+id]; if (!c) return; ['seed', 'time', 'yield', 'price', 'exp', 'lv'].forEach(k => { const v = Number(co[id][k]); if (Number.isFinite(v) && v > 0) c[k] = Math.round(v); }); });
    const ro = J((rr || {}).value) || {};
    Object.keys(ro).forEach(k => { if (k in RULES && typeof RULES[k] === 'number' && Number.isFinite(Number(ro[k]))) RULES[k] = Number(ro[k]); });
    this._cfgAt = Date.now();
  }
  async refreshConfig() { if (Date.now() - this._cfgAt > 60000) await this.applyConfigOverrides(); }
  publicConfig() { return { CROPS, RULES, TZ_MIN: this.opts.tzMin || 480 }; }

  /* ---------- 活动（缓存 15 秒） ---------- */
  invalidateEvents() { this._ev.at = -1e15; }
  async activeEvents() {
    const now = this.now();
    if (Date.now() - this._ev.at > 15000) { this._ev = { at: Date.now(), list: (await this.db.all('SELECT id,name,kind,params,start_at,end_at,descr FROM events WHERE enabled=1 ORDER BY id')).map(e => Object.assign(e, { params: J(e.params) || {} })) }; }
    return this._ev.list.filter(e => e.start_at <= now && e.end_at > now).map(e => Object.assign({}, e)).concat(CFG.festivalsAt(now)); /* 第 1 期：节日自动成为限时活动 */
  }
  async evMult(kind, cropId) { let m = 1; (await this.activeEvents()).forEach(e => { if (e.kind === kind && (e.params.crop === undefined || e.params.crop === null || e.params.crop === '' || +e.params.crop === cropId)) m *= Number(e.params.mult) || 1; }); return m; }
  async unitPrice(item) { const ri = CFG.ranchItem(item); if (ri) return ri.price; const c = cropOfItem(item); if (!c) return 0; const b = CFG.dayBonus(this.now())[c.id] || 0; return Math.round(CROPS[c.id].price * (1 + b) * (c.golden ? RULES.goldenPriceMult : 1) * await this.evMult('price_mult', c.id)); }

  /* ---------- 基础读写 ---------- */
  /* 事务内缓存：同一次操作里读过的数据直接复用，写入时同步更新（远端数据库时大幅减少往返） */
  C() { return this.db.cache(); }
  pu(uid, f) { const C = this.C(); if (C && C.u[uid]) f(C.u[uid]); }
  // 登录校验时顺带读回的数据，直接放进本次事务的缓存
  seed(uid, user, plots, inv, cnts) {
    const C = this.C(); if (!C) return;
    if (user && !C.u[uid]) C.u[uid] = Object.assign({}, user);
    if (plots && !C.plots[uid]) C.plots[uid] = plots.map(r => this.rowToPlot(r));
    if (inv && !C.inv[uid]) { const o = {}; inv.forEach(r => o[r.item] = r.qty); C.inv[uid] = o; }
    if (cnts && !C.cnt[uid]) { const m = {}; cnts.forEach(r => m[r.period + '|' + r.key] = r.val); C.cnt[uid] = { ps: [this.period('day'), this.period('week'), 'all'], m }; }
  }
  forget(uid) { const C = this.C(); if (C) { delete C.u[uid]; delete C.plots[uid]; delete C.inv[uid]; } }
  async user(uid) {
    const C = this.C(); if (C && C.u[uid]) return Object.assign({}, C.u[uid]);
    const u = await this.db.get('SELECT * FROM users WHERE id=?', uid); if (!u) throw notFound('玩家不存在');
    if (C) C.u[uid] = Object.assign({}, u); return u;
  }
  publicUser(u) { return { id: u.id, code: u.code, name: u.name, lv: u.lv, avatar: J(u.avatar) || {}, title: u.title, theme: u.theme, frame: u.frame }; }
  me(u) {
    return Object.assign(this.publicUser(u), {
      gold: u.gold, exp: u.exp, expNeed: CFG.expNeed(u.lv), seed: u.seed, username: u.username || '', guest: !u.username, role: u.role, migrated: !!u.migrated,
      dog: { own: !!u.dog_own, lv: u.dog_lv, exp: u.dog_exp, need: CFG.dogExpNeed(u.dog_lv), until: u.dog_until },
      dogs: this.dogsOf(u), pets: this.petsOf(u), ranch: this.ranchView(u), layout: this.layoutOf(u).items,
      checkin: { last: u.checkin_last, streak: u.checkin_streak }, settings: J(u.settings) || {}, created_at: u.created_at,
      stats: { harvest: u.harvest_total, steal: u.steal_total, help: u.help_total, plant: u.plant_total, earned: u.earned_total, golden: u.golden_total, order: u.order_total, stolenFrom: u.stolen_from_total },
    });
  }
  rowToPlot(r) { return { idx: r.idx, u: r.u, soil: r.soil, c: r.c, p: r.p, t: r.t, sea: r.sea, y: r.y, y0: r.y0, stolen: r.stolen, pr: J(r.pr) || { d: 0, w: 0, b: 0 }, ev: J(r.ev) || [], ra: r.ra, cycle: r.cycle }; }
  async plots(uid) {
    const C = this.C(), now = this.now();
    if (C && C.plots[uid]) return C.plots[uid].map(P => CFG.advancePlot(structuredClone(P), now));
    const list = (await this.db.all('SELECT * FROM plots WHERE user_id=? ORDER BY idx', uid)).map(r => this.rowToPlot(r));
    if (C) C.plots[uid] = list.map(P => structuredClone(P));
    return list.map(P => CFG.advancePlot(P, now));
  }
  async plot(uid, idx) { const P = (await this.plots(uid)).find(x => x.idx === idx); if (!P) throw bad('土地不存在'); return P; }
  savePlot(uid, P) {
    const C = this.C(); if (C && C.plots[uid]) { const i = C.plots[uid].findIndex(x => x.idx === P.idx); if (i >= 0) C.plots[uid][i] = structuredClone(P); }
    this.db.w('UPDATE plots SET u=?,soil=?,c=?,p=?,t=?,sea=?,y=?,y0=?,stolen=?,pr=?,ev=?,ra=?,cycle=? WHERE user_id=? AND idx=?',
      P.u, P.soil, P.c, P.p, P.t, P.sea, P.y, P.y0, P.stolen, JSON.stringify(P.pr), JSON.stringify(P.ev || []), P.ra || 0, P.cycle, uid, P.idx);
  }
  pubPlot(P) { return { idx: P.idx, u: P.u, soil: P.soil, c: P.c, p: P.p, t: P.t, sea: P.sea, y: P.y, y0: P.y0, stolen: P.stolen, pr: P.pr, ra: P.ra || 0 }; }
  async inv(uid) {
    const C = this.C(); if (C && C.inv[uid]) { const o = {}; Object.entries(C.inv[uid]).forEach(([k, v]) => { if (v > 0) o[k] = v; }); return o; }
    const o = {}; (await this.db.all('SELECT item,qty FROM inventory WHERE user_id=?', uid)).forEach(r => o[r.item] = r.qty);
    if (C) C.inv[uid] = Object.assign({}, o);
    Object.keys(o).forEach(k => { if (!(o[k] > 0)) delete o[k]; }); return o;
  }
  async invQty(uid, item) { return (await this.inv(uid))[item] || 0; }
  addInv(uid, item, n) {
    if (!n) return;
    const C = this.C(), ci = C && C.inv[uid];
    if (ci) { if ((ci[item] || 0) + n < 0) throw conflict(itemName(item) + '数量不足', 'not_enough'); ci[item] = (ci[item] || 0) + n; }
    if (n < 0) {
      const err = conflict(itemName(item) + '数量不足', 'not_enough');
      // 没有这一行时插入 -1 触发 CHECK；有这一行时减到负数触发 CHECK：两种情况都会抛出 err
      this.db.wx(err, 'INSERT INTO inventory (user_id,item,qty) SELECT ?,?,-1 WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE user_id=? AND item=?)', uid, item, uid, item);
      this.db.wx(err, 'UPDATE inventory SET qty=qty+? WHERE user_id=? AND item=?', n, uid, item);
      return;
    }
    this.db.w('INSERT INTO inventory (user_id,item,qty) VALUES (?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET qty=qty+excluded.qty', uid, item, n);
  }
  addGold(uid, n, reason) {
    n = Math.round(n); if (!n) return;
    const C = this.C(), cu = C && C.u[uid];
    if (cu) { if (cu.gold + n < 0) throw conflict('金币不足', 'no_gold'); cu.gold += n; if (n > 0) cu.earned_total += n; }
    if (n < 0) this.db.wx(conflict('金币不足', 'no_gold'), 'UPDATE users SET gold=gold+? WHERE id=?', n, uid);
    else this.db.w('UPDATE users SET gold=gold+?, earned_total=earned_total+? WHERE id=?', n, n, uid);
    this.db.w('INSERT INTO ledger (user_id,delta,reason,at) VALUES (?,?,?,?)', uid, n, reason, this.now());
  }
  async addExp(uid, n, out, u0) { // u0：本次操作里刚读到、经验和等级还没变过的玩家数据（省一次读取）
    const [m, u] = await all([this.evMult('exp_mult'), u0 || this.user(uid)]);
    n = Math.round(n * m); if (n <= 0) return 0;
    this.bump(uid, 'sp', n, 'week');
    if (u.lv >= RULES.maxLv) return 0;
    let lv = u.lv, exp = u.exp + n; const ups = [];
    while (lv < RULES.maxLv && exp >= CFG.expNeed(lv)) { exp -= CFG.expNeed(lv); lv++; ups.push(lv); }
    if (lv >= RULES.maxLv) exp = 0;
    this.db.w('UPDATE users SET exp=?, lv=? WHERE id=?', exp, lv, uid); this.pu(uid, x => { x.exp = exp; x.lv = lv; });
    ups.forEach(l => { this.addGold(uid, l * 120, 'levelup'); this.addInv(uid, 'fert', 1); });
    if (out && ups.length) out.levelUp = (out.levelUp || []).concat(ups);
    return n;
  }
  // 计数器：day / week / all
  period(kind) { const now = this.now(); return kind === 'day' ? 'd' + CFG.dayKey(now) : kind === 'week' ? CFG.weekKey(now) : 'all'; }
  bump(uid, key, n, only) {
    n = n || 1; const ps = only ? [this.period(only)] : [this.period('day'), this.period('week'), 'all'];
    const C = this.C(), cc = C && C.cnt[uid];
    ps.forEach(p => { this.db.w('INSERT INTO counters (user_id,period,key,val) VALUES (?,?,?,?) ON CONFLICT(user_id,period,key) DO UPDATE SET val=val+excluded.val', uid, p, key, n); if (cc && cc.ps.includes(p)) cc.m[p + '|' + key] = (cc.m[p + '|' + key] || 0) + n; });
  }
  async cnt(uid, key, kind) {
    const p = kind === 'day' || kind === 'week' ? this.period(kind) : kind, C = this.C();
    if (C && (C.cnt[uid] || p === this.period('day') || p === this.period('week') || p === 'all')) { const cc = await this.cntLoad(uid); if (cc.ps.includes(p)) return cc.m[p + '|' + key] || 0; }
    return (await this.db.get('SELECT val FROM counters WHERE user_id=? AND period=? AND key=?', uid, p, key) || { val: 0 }).val;
  }
  async cntLoad(uid) {
    const C = this.C(); if (C && C.cnt[uid]) return C.cnt[uid];
    const d = this.period('day'), w = this.period('week'), m = {};
    (await this.db.all("SELECT period,key,val FROM counters WHERE user_id=? AND period IN (?,?,'all')", uid, d, w)).forEach(r => m[r.period + '|' + r.key] = r.val);
    const cc = { ps: [d, w, 'all'], m }; if (C) C.cnt[uid] = cc; return cc;
  }
  // 一次取出今天 / 本周 / 累计的全部计数器
  async counters(uid) { const cc = await this.cntLoad(uid); const m = Object.assign({}, cc.m); return (key, p) => m[p + '|' + key] || 0; }
  metric(key, n) { this.db.w('INSERT INTO metrics (day,key,val) VALUES (?,?,?) ON CONFLICT(day,key) DO UPDATE SET val=val+excluded.val', CFG.dayKey(this.now()), key, n || 1); }
  async msg(uid, kind, actor, data, aggKey) {
    const now = this.now(), A = this.db.aside(), key = 'msg|' + uid + '|' + kind + '|' + actor;
    const merge = d => { d.n = (d.n || 1) + 1; if (data.qty) d.qty = (d.qty || 0) + data.qty; d.items = Object.assign(d.items || {}, data.items ? Object.fromEntries(Object.entries(data.items).map(([k, v]) => [k, (d.items && d.items[k] || 0) + v])) : {}); return d; };
    if (aggKey) { // 合并 10 分钟内同一人的同类消息，避免刷屏
      const m = A && A[key];
      if (m && m.e && !m.e.sent) { merge(m.d); m.e.a[m.pos] = JSON.stringify(m.d); return; } // 本次操作里刚写过：直接改还没发出的那条语句
      const last = await this.db.get('SELECT id,data FROM messages WHERE user_id=? AND kind=? AND actor IS ? AND at>? AND read=0 ORDER BY id DESC LIMIT 1', uid, kind, actor, now - 600000);
      if (last) { const d = merge(J(last.data) || {}); const e = this.db.w('UPDATE messages SET data=?, at=? WHERE id=?', JSON.stringify(d), now, last.id); if (A) A[key] = { d, e, pos: 0 }; return; }
    }
    const e = this.db.w('INSERT INTO messages (user_id,kind,actor,data,at) VALUES (?,?,?,?,?)', uid, kind, actor, JSON.stringify(data || {}), now);
    if (aggKey && A) A[key] = { d: JSON.parse(JSON.stringify(data || {})), e, pos: 3 };
    this.db.w('DELETE FROM messages WHERE user_id=? AND id < (SELECT id FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 1 OFFSET 199)', uid, uid);
  }
  async isFriend(a, b) { return !!(await this.db.get('SELECT 1 FROM friends WHERE a=? AND b=?', a, b)); }
  async friendSet(uid) { return new Set((await this.db.all('SELECT b FROM friends WHERE a=?', uid)).map(r => r.b)); }
  // 开放世界：任何未封禁、未互相拉黑的玩家都可以互相串门
  async canSee(uid, owner) {
    if (uid === owner) throw bad('这是你自己的农场');
    const C = this.C(), mk = 'blk|' + uid + '|' + owner;
    const [o, blk] = await all([this.user(owner), C && mk in C.memo ? C.memo[mk] : this.db.get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked=?) OR (user_id=? AND blocked=?)', owner, uid, uid, owner)]);
    if (C) C.memo[mk] = blk || null;
    if (o.banned) throw forbid('该玩家已被封禁');
    if (blk) throw forbid('无法访问这个农场');
    return o;
  }

  /* ---------- 账号 ---------- */
  /* ---------- 快照 ---------- */
  async badges(uid, u) {
    const [uu, claimRows, C, unread, requests, stats] = await all([u || this.user(uid), this.db.all('SELECT key FROM claims WHERE user_id=?', uid), this.counters(uid),
      this.db.get('SELECT COUNT(*) n FROM messages WHERE user_id=? AND read=0', uid), this.db.get('SELECT COUNT(*) n FROM friend_requests WHERE dst=?', uid), this.achCounts(uid)]);
    u = uu; const day = this.period('day'), wk = this.period('week'), claimed = new Set(claimRows.map(r => r.key));
    let tasks = 0;
    CFG.TASKS.forEach(t => { if (C(t.id, day) >= t.need && !claimed.has('task:' + day + ':' + t.id)) tasks++; });
    CFG.WEEKLY.forEach(t => { if (C(t.stat, wk) >= t.need && !claimed.has('weekly:' + wk + ':' + t.id)) tasks++; });
    if (u.checkin_last !== CFG.dayKey(this.now())) tasks++;
    let newbie = 0; CFG.NEWBIE.forEach(t => { if (C(t.stat, 'all') >= t.need && !claimed.has('newbie:' + t.id)) newbie++; });
    const st = this.achStatsOf(u, stats); let ach = 0; CFG.ACHIEVEMENTS.forEach(a => { if (st[a.stat] >= a.need && !claimed.has('ach:' + a.id)) ach++; });
    return { tasks, newbie, newbieLeft: CFG.NEWBIE.filter(t => !claimed.has('newbie:' + t.id)).length, ach, unread: unread.n, requests: requests.n };
  }
  async snapshot(uid) {
    const now = this.now();
    // 全部读取同时发出：远端数据库时只算一次网络往返；返回给客户端的数据一律重新读取
    this.forget(uid);
    const [u, plots, inv, events, badges] = await all([this.user(uid), this.plots(uid), this.inv(uid), this.activeEvents(), this.badges(uid)]);
    return { now, me: this.me(u), plots: plots.map(p => this.pubPlot(p)), inv, badges, rain: CFG.rainUntil(now), bonus: CFG.dayBonus(now), events, day: CFG.dayKey(now) };
  }

  /* ---------- 自己农场 ---------- */
}

/* 各玩法模块：account 账号 · farm 农田 · ranch 牧场与狗 · home 家园建造 · quest 任务成就订单 · social 好友串门 · economy 集市排行赛季 · hunt 名山猎场 · lake 镜湖钓场 */
/* 逐个字面量 require：云函数打包脚本（deploy/bundle-functions.js）只认字面量 */
const DOMAINS = { account: require('./domains/account'), farm: require('./domains/farm'), ranch: require('./domains/ranch'), home: require('./domains/home'), quest: require('./domains/quest'), social: require('./domains/social'), economy: require('./domains/economy'), hunt: require('./domains/hunt'), lake: require('./domains/lake') };
for (const [m, mod] of Object.entries(DOMAINS)) {
  for (const k of Object.keys(mod)) { if (k in Game.prototype) throw new Error('玩法模块方法重名：' + m + '.' + k); Object.defineProperty(Game.prototype, k, { value: mod[k], writable: true, configurable: true }); }
}

module.exports = { Game, cropOfItem, itemName };
