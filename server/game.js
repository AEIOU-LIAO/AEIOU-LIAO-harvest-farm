'use strict';
/* =====================================================
   丰收农场 · 服务端权威游戏逻辑（异步）
   - 所有写操作都在 db.tx() 中执行，保证原子性；遇到并发写冲突整体重试
   - 数据库可能在远端（Turso）：互不依赖的读取用 Promise.all 合并成一次请求，
     不需要结果的写入用 db.w() 延迟到下一次读取 / 提交时一起发出
   - 可能失败的写入（扣金币、扣库存、领奖去重）用 db.wx(错误, ...)：约束不满足时抛出对应提示
   ===================================================== */
const CFG = require('../shared/config');
const U = require('./util');
const { CROPS, RULES, NPLOTS, UNLOCK_ORDER } = CFG;
const { bad, forbid, notFound, conflict } = U;

const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[U.randInt(0, a.length - 1)];
const SHEEP_W = t => (CFG.SHEEP[t] || { wool: 0 }).wool;
const cropOfItem = item => { const m = /^([cg])(\d+)$/.exec(item || ''); if (!m || !CROPS[+m[2]]) return null; return { golden: m[1] === 'g', id: +m[2] }; };
const itemName = item => { const ri = CFG.ranchItem(item); if (ri) return ri.name; if (item === 'fert') return '化肥'; if (item === 'dogfood') return '狗粮'; const c = cropOfItem(item); return c ? (c.golden ? '金色' : '') + CROPS[c.id].name : item; };
const all = Promise.all.bind(Promise);

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
    return this._ev.list.filter(e => e.start_at <= now && e.end_at > now).map(e => Object.assign({}, e));
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
      dogs: this.dogsOf(u), ranch: this.ranchView(u),
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
  async newCode() { for (let i = 0; i < 50; i++) { const c = String(U.randInt(1000000, 9999999)); if (!(await this.db.get('SELECT 1 FROM users WHERE code=?', c))) return c; } throw new Error('无法生成玩家号'); }
  createUser(name, username, password) {
    return this.db.tx(async () => {
      const now = this.now();
      // 注册账号：账号就是昵称
      if (username) { username = U.cleanUsername(username); name = username; } else name = U.cleanName(name || '小农夫');
      if (username) { U.checkPw(password); if (await this.db.get('SELECT 1 FROM users WHERE username=?', username)) throw conflict('该账号已被注册', 'taken'); }
      const av = { skin: 0, hair: 0, hat: 1, band: 0, shirt: 0, bg: 0 };
      const r = await this.db.run('INSERT INTO users (code,username,pass_hash,name,avatar,gold,created_at,last_active) VALUES (?,?,?,?,?,?,?,?)',
        await this.newCode(), username || null, username ? U.hashPassword(password) : null, name, JSON.stringify(av), RULES.startGold, now, now);
      const uid = Number(r.lastInsertRowid);
      const vals = [], args = []; for (let i = 0; i < NPLOTS; i++) { vals.push('(?,?,?,?)'); args.push(uid, i, UNLOCK_ORDER.indexOf(i) < RULES.startPlots ? 1 : 0, now); }
      this.db.w('INSERT INTO plots (user_id,idx,u,t) VALUES ' + vals.join(','), ...args);
      this.addInv(uid, 'fert', 3);
      this.db.w("INSERT INTO cosmetics (user_id,item,at) VALUES (?, 'theme:classic', ?), (?, 'frame:none', ?)", uid, now, uid, now);
      this.db.w('INSERT INTO ledger (user_id,delta,reason,at) VALUES (?,?,?,?)', uid, RULES.startGold, 'start', now);
      this.metric('registrations');
      return uid;
    });
  }
  newSession(uid, ua) { const tok = U.randToken(32); const now = this.now(); this.db.w('INSERT INTO sessions (token_hash,user_id,created_at,last_seen,ua) VALUES (?,?,?,?,?)', U.sha256(tok), uid, now, now, String(ua || '').slice(0, 120)); return tok; }
  async auth(token) {
    if (!token) return null;
    const r = await this.db.get('SELECT u.*, s.token_hash AS s_hash, s.last_seen AS s_seen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?', U.sha256(token)); if (!r) return null;
    const now = this.now(); if (now - r.s_seen > 90 * 86400000) { this.db.w('DELETE FROM sessions WHERE token_hash=?', r.s_hash); return null; }
    const hash = r.s_hash; delete r.s_hash; const seen = r.s_seen; delete r.s_seen;
    // 在线时间：由调用方在事务提交后顺手写入（不参与事务冲突）
    const touch = [];
    if (now - seen > 60000) touch.push(['UPDATE sessions SET last_seen=? WHERE token_hash=?', now, hash]);
    if (now - r.last_active > 60000) { touch.push(['UPDATE users SET last_active=? WHERE id=?', now, r.id]); touch.push(['INSERT OR IGNORE INTO logins (user_id,day) VALUES (?,?)', r.id, CFG.dayKey(now)]); r.last_active = now; }
    return { user: r, tokenHash: hash, touch };
  }
  async peek(token) { if (!token) return null; return (await this.db.get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?', U.sha256(token))) || null; }
  async login(username, password) {
    const u = await this.db.get('SELECT * FROM users WHERE username=?', String(username || '').trim());
    if (!u || !U.checkPassword(password, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '账号或密码错误');
    return u;
  }
  bind(uid, username, password) {
    return this.db.tx(async () => {
      const u = await this.user(uid); if (u.username) throw bad('已经绑定过账号了'); username = U.cleanUsername(username); U.checkPw(password);
      if (await this.db.get('SELECT 1 FROM users WHERE username=?', username)) throw conflict('该账号已被注册', 'taken');
      const rec = U.randToken(9).replace(/[-_]/g, 'x').slice(0, 12).toUpperCase();
      // 绑定后昵称与账号保持一致
      this.db.wx(conflict('该账号已被注册', 'taken'), 'UPDATE users SET username=?, name=?, pass_hash=?, recovery_hash=? WHERE id=?', username, username, U.hashPassword(password), U.sha256(rec), uid);
      return { recovery: rec, name: username };
    });
  }
  async changePassword(uid, oldPw, newPw) { const u = await this.user(uid); if (!U.checkPassword(oldPw, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '原密码错误'); U.checkPw(newPw); this.db.w('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(newPw), uid); this.db.w('DELETE FROM sessions WHERE user_id=?', uid); }
  async recover(username, code, newPw) {
    const u = await this.db.get('SELECT * FROM users WHERE username=?', String(username || '').trim());
    if (!u || !u.recovery_hash || U.sha256(String(code || '').trim().toUpperCase()) !== u.recovery_hash) throw new U.ApiError(401, 'bad_login', '账号或恢复码错误');
    U.checkPw(newPw); const rec = U.randToken(9).replace(/[-_]/g, 'x').slice(0, 12).toUpperCase();
    this.db.w('UPDATE users SET pass_hash=?, recovery_hash=? WHERE id=?', U.hashPassword(newPw), U.sha256(rec), u.id); this.db.w('DELETE FROM sessions WHERE user_id=?', u.id);
    return { user: u, recovery: rec };
  }
  async exportData(uid) {
    const T = sql => this.db.all(sql, uid);
    const [u, plots, inventory, friends, messages, codex, cosmetics, claims, market, ledger] = await all([this.user(uid), this.plots(uid), this.inv(uid), T('SELECT b AS friend, since FROM friends WHERE a=?'), T('SELECT kind,actor,data,at FROM messages WHERE user_id=?'), T('SELECT item,first_at,n FROM codex WHERE user_id=?'),
      T('SELECT item FROM cosmetics WHERE user_id=?'), T('SELECT key,at FROM claims WHERE user_id=?'), T('SELECT * FROM market WHERE seller=?'), T('SELECT delta,reason,at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 2000')]);
    const d = Object.assign({}, u); delete d.pass_hash; delete d.recovery_hash;
    return { exportedAt: new Date(this.now()).toISOString(), user: d, plots: plots.map(p => this.pubPlot(p)), inventory, friends, messages, codex, cosmetics, claims, market, ledger };
  }
  async deleteAccount(uid, password, confirm) {
    const u = await this.user(uid);
    if (u.username) { if (!U.checkPassword(password, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '密码错误'); }
    else if (confirm !== '确认注销') throw bad('请输入“确认注销”');
    await this.db.tx(async () => {
      this.db.w("UPDATE market SET status='cancelled', done_at=? WHERE seller=? AND status='open'", this.now(), uid);
      ['steals WHERE thief=?', 'steals WHERE owner=?', 'helps WHERE helper=?', 'helps WHERE owner=?', 'guestbook WHERE author=?', 'idem WHERE user_id=?', 'ledger WHERE user_id=?', 'logins WHERE user_id=?'].forEach(t => this.db.w('DELETE FROM ' + t, uid));
      this.db.w('UPDATE messages SET actor=NULL WHERE actor=?', uid);
      // 显式删除子表（不依赖每个连接的外键设置）
      ['sessions', 'plots', 'inventory', 'messages', 'counters', 'claims', 'codex', 'cosmetics', 'orders', 'guestbook', 'blocks'].forEach(t => this.db.w(`DELETE FROM ${t} WHERE ${t === 'guestbook' ? 'owner' : 'user_id'}=?`, uid));
      ['friends WHERE a=? OR b=?', 'friend_requests WHERE src=? OR dst=?', 'visits WHERE owner=? OR visitor=?'].forEach(t => this.db.w('DELETE FROM ' + t, uid, uid));
      this.db.w('DELETE FROM users WHERE id=?', uid);
    });
  }
  // 旧版单机存档迁移：不信任客户端数值，只按上限折算一次“老玩家礼包”
  migrate(uid, old) {
    return this.db.tx(async () => {
      const u = await this.user(uid); if (u.migrated) throw conflict('已经迁移过旧存档了', 'done');
      const lv = clampN(parseInt(old && old.lv) || 1, 1, 30), gold = clampN(parseInt(old && old.gold) || 0, 0, 1e9);
      const gLv = Math.min(lv, 8), gGold = Math.min(gold, 3000) + 200, gFert = 5;
      if (gLv > u.lv) this.db.w('UPDATE users SET lv=?, exp=0 WHERE id=?', gLv, uid);
      this.addGold(uid, gGold, 'migrate'); this.addInv(uid, 'fert', gFert);
      this.db.w('UPDATE users SET migrated=1 WHERE id=?', uid);
      return { lv: Math.max(gLv, u.lv), gold: gGold, fert: gFert };
    });
  }

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
  scheduleEv(P, start) { const dur = CFG.plotDur(P), rem = 1 - P.p, cr = CROPS[P.c]; const n = (U.rand() < (cr.time < 60 ? 0.35 : 0.6) ? 1 : 0) + (U.rand() < 0.3 ? 1 : 0) + (cr.time >= 1800 && U.rand() < 0.4 ? 1 : 0); const ev = []; for (let i = 0; i < n; i++) ev.push([Math.round(start + dur * rem * (0.1 + U.rand() * 0.75)), pick(['d', 'w', 'b'])]); ev.sort((a, b) => a[0] - b[0]); return ev; }
  async startCycle(P, now) { const cr = CROPS[P.c]; P.y0 = Math.max(1, Math.round(cr.yield * CFG.soilOf(P).yield * await this.evMult('yield_mult', P.c))); P.y = P.y0; P.stolen = 0; P.pr = { d: 0, w: 0, b: 0 }; P.t = now; P.ra = 0; P.cycle++; P.ev = this.scheduleEv(P, now); }
  async plant(uid, idx, cropId, out) {
    const cr = CROPS[cropId]; if (!cr) throw bad('没有这种种子');
    const [u, P] = await all([this.user(uid), this.plot(uid, idx)]);
    if (!P.u) throw bad('这块地还没开垦'); if (P.c >= 0) throw conflict('这块地已经种了东西', 'occupied');
    if (u.lv < cr.lv) throw bad(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'locked');
    this.addGold(uid, -cr.seed, 'seed');
    const now = this.now(); P.c = cropId; P.p = 0; P.sea = 0; await this.startCycle(P, now); this.savePlot(uid, P);
    this.db.w('UPDATE users SET plant_total=plant_total+1, seed=? WHERE id=?', cropId, uid); this.pu(uid, x => { x.plant_total++; x.seed = cropId; }); this.bump(uid, 'plant'); await this.addExp(uid, 2, out, u);
    return { idx, crop: cropId, cost: cr.seed };
  }
  async harvest(uid, idx, out) {
    const P = await this.plot(uid, idx); if (!P.u || P.c < 0) throw bad('这里没有作物'); if (P.p < 1) throw conflict('作物还没成熟', 'not_ripe');
    const cr = CROPS[P.c], n = P.y, now = this.now(); let golden = 0;
    if (n > 0) this.addInv(uid, 'c' + P.c, n);
    // 大丰收：额外多收一部分（不影响别人可摘的数量）
    let bonus = 0; if (n > 0 && U.rand() < RULES.bumperChance) { bonus = Math.max(1, Math.round(n * RULES.bumperBonus)); this.addInv(uid, 'c' + P.c, bonus); }
    if (U.rand() < RULES.goldenChance * await this.evMult('golden_mult', P.c)) { golden = Math.max(1, Math.round(P.y0 * 0.1)); this.addInv(uid, 'g' + P.c, golden); this.codex(uid, 'g' + P.c, golden); this.db.w('UPDATE users SET golden_total=golden_total+1 WHERE id=?', uid); this.pu(uid, x => x.golden_total++); }
    this.codex(uid, 'c' + P.c, n + bonus);
    this.db.w('UPDATE users SET harvest_total=harvest_total+1 WHERE id=?', uid); this.pu(uid, x => x.harvest_total++); this.bump(uid, 'harvest');
    const exp = await this.addExp(uid, cr.exp, out);
    const res = { idx, crop: P.c, n, bonus, golden, exp, stolen: P.stolen, season2: false };
    if (cr.seasons > 1 && P.sea < cr.seasons - 1) { P.sea++; P.p = RULES.season2Start; await this.startCycle(P, now); res.season2 = true; }
    else { P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; }
    this.savePlot(uid, P); return res;
  }
  codex(uid, item, n) { this.db.w('INSERT INTO codex (user_id,item,first_at,n) VALUES (?,?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET n=n+excluded.n', uid, item, this.now(), n || 1); }
  async care(uid, idx, out) {
    const P = await this.plot(uid, idx); const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地很健康', 'healthy');
    P.pr[k] = 0; this.savePlot(uid, P); this.bump(uid, 'care'); await this.addExp(uid, 2, out); return { idx, kind: k };
  }
  async shovel(uid, idx) {
    const P = await this.plot(uid, idx); if (P.c < 0) throw bad('这里没有作物'); if (P.p >= 1) throw conflict('作物已成熟，先收获吧', 'ripe');
    P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; this.savePlot(uid, P); return { idx };
  }
  async fert(uid, idx) {
    const P = await this.plot(uid, idx); if (P.c < 0 || P.p >= 1) throw bad('只能给生长中的作物施肥');
    this.addInv(uid, 'fert', -1); P.p = Math.min(1, P.p + RULES.fertBoost); if (P.p >= 1) { P.ra = this.now(); P.ev = []; } this.savePlot(uid, P); return { idx };
  }
  async expand(uid, idx, out) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]); const owned = plots.filter(p => p.u).length;
    if (idx === undefined || idx === null || idx < 0) idx = UNLOCK_ORDER.find(i => !plots[i].u);
    if (idx === undefined) throw bad('土地已经全部开垦');
    const P = plots.find(p => p.idx === idx); if (!P) throw bad('土地不存在'); if (P.u) throw conflict('这块地已经开垦了', 'done');
    const need = CFG.plotNeedLv(owned), cost = CFG.plotCost(owned); if (u.lv < need) throw bad(`扩建需要 Lv.${need}`, 'locked');
    this.addGold(uid, -cost, 'expand'); P.u = 1; P.t = this.now(); this.savePlot(uid, P); await this.addExp(uid, 10, out); return { idx, cost };
  }
  // 土地升级：普通 → 红土地 → 黑土地 → 金土地（接口名沿用 red）
  async red(uid, idx, out) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]);
    const P = plots.find(p => p.idx === idx); if (!P) throw bad('土地不存在'); if (!P.u) throw bad('先开垦这块地');
    const next = (P.soil | 0) + 1, S = CFG.SOILS[next]; if (!S) throw conflict('这块已经是最高级的金土地了', 'done');
    if (u.lv < S.lv) throw bad(`升级${S.name}需要 Lv.${S.lv}`, 'locked');
    const cost = CFG.soilCost(next, plots.filter(p => (p.soil | 0) >= next).length);
    this.addGold(uid, -cost, 'soil' + next); P.soil = next; this.savePlot(uid, P); await this.addExp(uid, 15 * next, out); return { idx, cost, soil: next, name: S.name };
  }
  // 批量操作：每一项一个保存点，单项失败只回滚该项
  async batch(uid, fn, list) {
    const res = [], out = {};
    for (const i of list) { try { res.push(await this.db.sp(() => fn(i, out))); } catch (e) { if (!(e instanceof U.ApiError)) throw e; res.push({ idx: i, err: e.message, code: e.code }); } }
    return { res, out };
  }
  async sell(uid, item, n, have) {
    const c = cropOfItem(item) || CFG.ranchItem(item); if (!c) throw bad('只能出售作物、鱼和羊毛'); if (have === undefined) have = await this.invQty(uid, item);
    n = Math.min(U.int(n, '数量', 1, 1e9), have); if (n <= 0) throw conflict('没有可以卖的', 'not_enough');
    const g = n * await this.unitPrice(item); this.addInv(uid, item, -n); this.addGold(uid, g, 'sell'); this.bump(uid, 'sell', g, 'day'); this.bump(uid, 'sell', 1, 'all'); return { item, n, gold: g };
  }
  async sellAll(uid) { let total = 0; const items = []; for (const [item, q] of Object.entries(await this.inv(uid))) { if ((cropOfItem(item) || CFG.ranchItem(item)) && q > 0) { total += (await this.sell(uid, item, q, q)).gold; items.push(item); } } if (!total) throw conflict('仓库里没有作物', 'empty'); return { gold: total, items }; }
  async buy(uid, item, n) {
    const it = CFG.SHOP_ITEMS.find(x => x.id === item); if (!it) throw bad('商店没有这个商品'); n = U.int(n, '数量', 1, 99);
    this.addGold(uid, -it.price * n, 'shop:' + item); this.addInv(uid, item, n); return { item, n };
  }
  /* ---------- 鱼塘与牧场 ---------- */
  ranchOf(u) { const R = J(u.ranch) || {}; R.fish = Array.isArray(R.fish) ? R.fish : []; R.sheep = Array.isArray(R.sheep) ? R.sheep : []; R.herd = R.herd || { from: 0, until: 0, dog: '' }; return R; }
  saveRanch(uid, R) { const s = JSON.stringify(R); this.db.w('UPDATE users SET ranch=? WHERE id=?', s, uid); this.pu(uid, x => x.ranch = s); }
  ranchView(u) {
    const R = this.ranchOf(u), now = this.now();
    return { pondCap: CFG.pondCap(u.lv), pastureCap: CFG.pastureCap(u.lv), herd: R.herd,
      fish: R.fish.map(f => ({ t: f.t, at: f.at, left: CFG.fishLeft(f, now) })),
      sheep: R.sheep.map(s => { const c = CFG.sheepCycles(s, now, R.herd); return { t: s.t, last: s.last, acc: s.acc, cycles: c, wool: Math.floor(c) * SHEEP_W(s.t), full: c >= CFG.RANCH.woolMax }; }) };
  }
  async buyFish(uid, type, n) {
    const d = CFG.FISH[type]; if (!d) throw bad('没有这种鱼苗'); n = U.int(n || 1, '数量', 1, 12);
    const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.pondCap(u.lv); if (R.fish.length + n > cap) throw conflict(`池塘最多养 ${cap} 条鱼，现在还能放 ${Math.max(0, cap - R.fish.length)} 条`, 'full');
    this.addGold(uid, -d.price * n, 'fish:' + d.id); const now = this.now(); for (let i = 0; i < n; i++) R.fish.push({ t: d.id, at: now }); this.saveRanch(uid, R); this.bump(uid, 'fish_in', n, 'all');
    return { type: d.id, n, name: d.name };
  }
  async collectFish(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.fish = R.fish.filter(f => { const d = CFG.FISH[f.t]; if (!d || CFG.fishLeft(f, now) > 0) return true; got[d.id] = (got[d.id] || 0) + d.yield; exp += d.exp; return false; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('还没有长大的鱼', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'fs' + id, got[id]); this.codex(uid, 'fs' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'fish', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  }
  async buySheep(uid, type) {
    const d = CFG.SHEEP[type]; if (!d) throw bad('没有这种羊'); const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.pastureCap(u.lv); if (R.sheep.length >= cap) throw conflict(`羊圈最多养 ${cap} 只，升级后可以多养`, 'full');
    this.addGold(uid, -d.price, 'sheep:' + d.id); R.sheep.push({ t: d.id, last: this.now(), acc: 0 }); this.saveRanch(uid, R); return { type: d.id, name: d.name };
  }
  async shear(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.sheep.forEach(s => { const d = CFG.SHEEP[s.t]; if (!d) return; const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c); if (k < 1) return; got[d.id] = (got[d.id] || 0) + k * d.wool; exp += k * d.exp; s.acc = c - k; s.last = now; if (c >= CFG.RANCH.woolMax) s.acc = 0; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('羊毛还没长好', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'wl' + id, got[id]); this.codex(uid, 'wl' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'shear', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  }
  // 牧羊：派一只吃饱的牧羊犬去赶羊，接下来一段时间羊毛长得更快
  async herd(uid, kind) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now();
    if (!R.sheep.length) throw conflict('羊圈里还没有羊', 'none');
    const dogs = this.dogsOf(u).filter(d => d.own), d = (kind ? dogs.find(x => x.id === kind) : dogs.find(x => x.fed)) || dogs[0];
    if (!d) throw conflict('先领养一只牧羊犬吧（商店 → 宠物）', 'no_dog'); if (!d.fed) throw conflict(`${d.name}饿着肚子赶不动羊，先去仓库喂它`, 'hungry');
    if (R.herd.until > now) throw conflict(`${CFG.DOGS.find(x => x.id === R.herd.dog).name}正在牧羊，还剩 ${Math.ceil((R.herd.until - now) / 60000)} 分钟`, 'busy');
    R.sheep.forEach(s => { s.acc = CFG.sheepCycles(s, now, R.herd); s.last = now; }); // 先结算之前的进度
    R.herd = { from: now, until: now + CFG.RANCH.herdMin * 60000, dog: d.id }; this.saveRanch(uid, R); this.bump(uid, 'herd', 1, 'all');
    return { dog: d.id, name: d.name, until: R.herd.until };
  }
  /* ---------- 看家狗：福旺、睿宝 ---------- */
  dogDef(kind) { const d = CFG.DOGS.find(x => x.id === (kind || 'fuwang')); if (!d) throw bad('没有这只狗'); return d; }
  dogsOf(u) { const now = this.now(); return CFG.DOGS.map(d => { const lv = u[d.col + '_lv'] || 1, until = u[d.col + '_until'] || 0; return { id: d.id, name: d.name, own: !!u[d.col + '_own'], lv, exp: u[d.col + '_exp'] || 0, need: CFG.dogExpNeed(lv), until, fed: until > now, bite: d.bite, chance: CFG.dogChance(d, lv) }; }); }
  async buyDog(uid, kind) {
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col;
    if (u[c + '_own']) throw conflict(`已经有${d.name}了`, 'done'); if (u.lv < d.lv) throw bad(`领养${d.name}需要 Lv.${d.lv}`, 'locked');
    this.addGold(uid, -d.price, 'dog:' + d.id); this.db.w(`UPDATE users SET ${c}_own=1 WHERE id=?`, uid); this.pu(uid, x => x[c + '_own'] = 1); this.addInv(uid, 'dogfood', 1); return { kind: d.id, name: d.name };
  }
  async feedDog(uid, kind) {
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col; if (!u[c + '_own']) throw bad(`还没有领养${d.name}`); this.addInv(uid, 'dogfood', -1);
    const now = this.now(); let lv = u[c + '_lv'] || 1, exp = (u[c + '_exp'] || 0) + 1, up = false; if (lv < 10 && exp >= CFG.dogExpNeed(lv)) { exp -= CFG.dogExpNeed(lv); lv++; up = true; }
    const until = Math.max(u[c + '_until'] || 0, now) + RULES.dogFeedMin * 60000; this.db.w(`UPDATE users SET ${c}_until=?, ${c}_lv=?, ${c}_exp=? WHERE id=?`, until, lv, exp, uid);
    this.pu(uid, x => { x[c + '_until'] = until; x[c + '_lv'] = lv; x[c + '_exp'] = exp; }); return { kind: d.id, name: d.name, lvUp: up ? lv : 0, until };
  }

  /* ---------- 签到 / 任务 / 成就 ---------- */
  claim(uid, key) { this.db.wx(conflict('已经领取过了', 'claimed'), 'INSERT INTO claims (user_id,key,at) VALUES (?,?,?)', uid, key, this.now()); }
  async checkin(uid, out) {
    const u = await this.user(uid), now = this.now(), today = CFG.dayKey(now), yest = CFG.dayKey(CFG.dayStart(now) - 3600000);
    if (u.checkin_last === today) throw conflict('今天已经签到了', 'claimed'); this.claim(uid, 'checkin:' + today);
    const streak = u.checkin_last === yest ? u.checkin_streak + 1 : 1, n = ((streak - 1) % 7) + 1, g = 100 * n;
    this.db.w('UPDATE users SET checkin_last=?, checkin_streak=? WHERE id=?', today, streak, uid); this.pu(uid, x => { x.checkin_last = today; x.checkin_streak = streak; }); this.addGold(uid, g, 'checkin');
    // 回归奖励：超过 3 天未登录后签到
    let back = 0; if (u.checkin_last && today > u.checkin_last && now - u.last_active > 3 * 86400000) { back = 500; this.addGold(uid, back, 'comeback'); }
    if (n % 3 === 0) this.addInv(uid, 'fert', 2); if (n === 7) this.addInv(uid, 'dogfood', 2);
    return { day: n, gold: g, streak, back };
  }
  async tasks(uid) {
    const day = this.period('day'), wk = this.period('week');
    const [rows, C] = await all([this.db.all('SELECT key FROM claims WHERE user_id=?', uid), this.counters(uid)]); const claimed = new Set(rows.map(r => r.key));
    return {
      day: CFG.dayKey(this.now()), weekEnd: CFG.weekEnd(this.now()),
      daily: CFG.TASKS.map(t => ({ id: t.id, prog: C(t.id, day), need: t.need, claimed: claimed.has('task:' + day + ':' + t.id) })),
      weekly: CFG.WEEKLY.map(t => ({ id: t.id, prog: C(t.stat, wk), need: t.need, claimed: claimed.has('weekly:' + wk + ':' + t.id) })),
      newbie: CFG.NEWBIE.map(t => ({ id: t.id, prog: C(t.stat, 'all'), need: t.need, claimed: claimed.has('newbie:' + t.id) })),
    };
  }
  async claimTask(uid, kind, id, out) {
    let t, key, prog;
    if (kind === 'daily') { t = CFG.TASKS.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'task:' + this.period('day') + ':' + id; prog = await this.cnt(uid, t.id, 'day'); }
    else if (kind === 'weekly') { t = CFG.WEEKLY.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'weekly:' + this.period('week') + ':' + id; prog = await this.cnt(uid, t.stat, 'week'); }
    else if (kind === 'newbie') { t = CFG.NEWBIE.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'newbie:' + id; prog = await this.cnt(uid, t.stat, 'all'); }
    else throw bad('任务类型不对');
    if (prog < t.need) throw conflict('任务还没完成', 'not_done'); this.claim(uid, key);
    this.addGold(uid, t.gold, 'task'); if (t.exp) await this.addExp(uid, t.exp, out); return { gold: t.gold, exp: t.exp || 0 };
  }
  async achCounts(uid) { const [f, c] = await all([this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', uid), this.db.get('SELECT COUNT(*) n FROM codex WHERE user_id=?', uid)]); return { friends: f.n, codex: c.n }; }
  achStatsOf(u, k) { return { harvest_total: u.harvest_total, steal_total: u.steal_total, help_total: u.help_total, golden_total: u.golden_total, order_total: u.order_total, lv: u.lv, checkin_streak: u.checkin_streak, friends: k.friends, codex: k.codex }; }
  async achStats(u) { return this.achStatsOf(u, await this.achCounts(u.id)); }
  async achievements(uid) { const [u, rows] = await all([this.user(uid), this.db.all("SELECT key FROM claims WHERE user_id=? AND key LIKE 'ach:%'", uid)]); const st = await this.achStats(u), claimed = new Set(rows.map(r => r.key)); return CFG.ACHIEVEMENTS.map(a => ({ id: a.id, prog: st[a.stat], need: a.need, claimed: claimed.has('ach:' + a.id) })); }
  async claimAch(uid, id) {
    const a = CFG.ACHIEVEMENTS.find(x => x.id === id); if (!a) throw bad('成就不存在'); const st = await this.achStats(await this.user(uid)); if (st[a.stat] < a.need) throw conflict('成就还没达成', 'not_done');
    this.claim(uid, 'ach:' + id); this.addGold(uid, a.gold, 'ach');
    CFG.FRAMES.filter(f => f.ach === id).forEach(f => this.db.w('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'frame:' + f.id, this.now()));
    return { gold: a.gold, title: a.title || '' };
  }

  /* ---------- 订单（NPC） ---------- */
  async orders(uid) {
    const day = CFG.dayKey(this.now());
    let [u, rows, inv, refreshed] = await all([this.user(uid), this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day), this.inv(uid), this.cnt(uid, 'order_refresh', 'day')]);
    // 订单位随等级增加（Lv.10/20/30 各多一个）：缺哪个补哪个，升级当天也能马上拿到新订单
    const slots = CFG.orderSlots(u.lv), have = new Set(rows.map(r => r.slot)); let added = false;
    for (let s = 0; s < slots; s++) if (!have.has(s)) { this.genOrder(uid, u, day, s); added = true; }
    if (added) rows = await this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day);
    return { day, slots, refreshLeft: Math.max(0, RULES.orderRefresh - refreshed), refreshCost: RULES.orderRefreshCost, list: rows.map(r => ({ slot: r.slot, item: r.item, qty: r.qty, gold: r.gold, exp: r.exp, done: !!r.done, have: inv[r.item] || 0 })) };
  }
  genOrder(uid, u, day, slot) {
    const pool = CROPS.filter(c => c.lv <= Math.max(1, u.lv)); const cr = pool[U.randInt(Math.max(0, pool.length - 6), pool.length - 1)];
    const qty = Math.max(5, Math.round(cr.yield * (0.5 + U.rand() * 1.0))), gold = Math.round(qty * cr.price * (1.5 + U.rand() * 0.4)), exp = Math.round(cr.exp * qty / cr.yield * 0.8) + 10;
    this.db.w('INSERT OR REPLACE INTO orders (user_id,day,slot,item,qty,gold,exp,done) VALUES (?,?,?,?,?,?,?,0)', uid, day, slot, 'c' + cr.id, qty, gold, exp);
  }
  async deliver(uid, slot, out) {
    const day = CFG.dayKey(this.now()); const o = await this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot); if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    this.addInv(uid, o.item, -o.qty); this.db.w('UPDATE orders SET done=1 WHERE user_id=? AND day=? AND slot=?', uid, day, slot);
    this.addGold(uid, o.gold, 'order'); await this.addExp(uid, o.exp, out); this.db.w('UPDATE users SET order_total=order_total+1 WHERE id=?', uid); this.pu(uid, x => x.order_total++); this.bump(uid, 'order'); this.metric('orders_done'); return { gold: o.gold, exp: o.exp };
  }
  async refreshOrder(uid, slot) {
    const day = CFG.dayKey(this.now());
    const [o, n, u] = await all([this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot), this.cnt(uid, 'order_refresh', 'day'), this.user(uid)]);
    if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    if (n >= RULES.orderRefresh) throw conflict('今天的刷新次数用完了', 'limit'); this.addGold(uid, -RULES.orderRefreshCost, 'order_refresh'); this.bump(uid, 'order_refresh', 1, 'day'); this.genOrder(uid, u, day, slot); return {};
  }

  /* ---------- 好友 ---------- */
  async findUser(q) { q = String(q || '').trim(); if (!q) throw bad('请输入玩家号或昵称'); if (/^\d{7}$/.test(q)) return this.db.all('SELECT * FROM users WHERE code=? AND banned=0', q); return this.db.all("SELECT * FROM users WHERE name LIKE ? ESCAPE '\\' AND banned=0 ORDER BY last_active DESC LIMIT 20", '%' + q.replace(/[%_\\]/g, '\\$&') + '%'); }
  async search(uid, q) {
    const [rows, fr, pend] = await all([this.findUser(q), this.friendSet(uid), this.db.all('SELECT dst FROM friend_requests WHERE src=?', uid)]); const ps = new Set(pend.map(r => r.dst));
    return rows.filter(u => u.id !== uid).map(u => Object.assign(this.publicUser(u), { friend: fr.has(u.id), pending: ps.has(u.id) }));
  }
  async makeFriends(a, b) {
    if (a === b) throw bad('不能加自己为好友');
    const [isF, na, nb] = await all([this.isFriend(a, b), this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', a), this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', b)]);
    if (isF) return false; if (na.n >= 1000 || nb.n >= 1000) throw conflict('好友数量已达上限 1000', 'limit');
    const now = this.now(); this.db.w('INSERT OR IGNORE INTO friends (a,b,since) VALUES (?,?,?),(?,?,?)', a, b, now, b, a, now);
    this.db.w('DELETE FROM friend_requests WHERE (src=? AND dst=?) OR (src=? AND dst=?)', a, b, b, a);
    this.bump(a, 'friend', 1, 'all'); this.bump(b, 'friend', 1, 'all'); this.metric('friend_adds');
    await all([this.msg(a, 'friend_ok', b, {}), this.msg(b, 'friend_ok', a, {})]); return true;
  }
  async requestFriend(uid, targetId) {
    const t = await this.user(targetId); if (t.id === uid) throw bad('不能加自己为好友');
    const [isF, blk, rev, sent] = await all([this.isFriend(uid, t.id), this.db.get('SELECT 1 FROM blocks WHERE user_id=? AND blocked=?', t.id, uid), this.db.get('SELECT 1 FROM friend_requests WHERE src=? AND dst=?', t.id, uid), this.db.get('SELECT COUNT(*) n FROM friend_requests WHERE src=? AND at>?', uid, this.now() - 86400000)]);
    if (isF) throw conflict('你们已经是好友了', 'done');
    if (blk) throw forbid('对方不接受你的申请');
    if (rev) { await this.makeFriends(uid, t.id); return { friend: true }; }
    if (sent.n >= 30) throw conflict('今天发送的好友申请太多了', 'limit');
    this.db.w('INSERT OR IGNORE INTO friend_requests (src,dst,at) VALUES (?,?,?)', uid, t.id, this.now()); return { friend: false };
  }
  async addFriend(uid, targetId) {
    const [t, blk, isF, today] = await all([this.user(targetId), this.db.get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked=?) OR (user_id=? AND blocked=?)', targetId, uid, uid, targetId), this.isFriend(uid, targetId), this.db.get('SELECT COUNT(*) n FROM friends WHERE a=? AND since>?', uid, this.now() - 86400000)]);
    if (t.id === uid) throw bad('不能加自己为好友'); if (t.banned) throw forbid('该玩家已被封禁');
    if (blk) throw forbid('无法添加这个玩家');
    if (isF) throw conflict('你们已经是好友了', 'done');
    if (today.n >= 50) throw conflict('今天加的好友太多了', 'limit');
    await this.makeFriends(uid, t.id); return { friend: this.publicUser(t) };
  }
  // 附近的人：不需要是好友也能看到并互访
  async neighbors(uid) {
    const now = this.now();
    const [rows, fr] = await all([this.db.all('SELECT * FROM users WHERE banned=0 AND id<>? AND last_active>? AND id NOT IN (SELECT blocked FROM blocks WHERE user_id=?) AND id NOT IN (SELECT user_id FROM blocks WHERE blocked=?) ORDER BY last_active DESC LIMIT 40', uid, now - 7 * 86400000, uid, uid), this.friendSet(uid)]);
    const views = await this.farmViews(uid, rows);
    const list = rows.map((u, i) => { const v = views[i]; return Object.assign(this.publicUser(u), { steal: v.steal, help: v.help, soon: v.soon, online: now - u.last_active < 120000, last: u.last_active, friend: fr.has(u.id) }); });
    list.sort((a, b) => (b.online - a.online) || (b.steal - a.steal) || (b.last - a.last));
    return { list };
  }
  // 邀请链接：链接的主人分享即表示同意，点开的人确认后直接互为好友
  async acceptInvite(uid, code) { const t = await this.db.get('SELECT * FROM users WHERE code=? AND banned=0', String(code || '')); if (!t) throw notFound('邀请链接无效'); if (t.id === uid) return { self: true }; const added = await this.makeFriends(uid, t.id); return { friend: this.publicUser(t), added }; }
  async respondRequest(uid, src, accept) { const r = await this.db.get('SELECT * FROM friend_requests WHERE src=? AND dst=?', src, uid); if (!r) throw notFound('申请不存在或已处理'); if (accept) await this.makeFriends(uid, src); else this.db.w('DELETE FROM friend_requests WHERE src=? AND dst=?', src, uid); return {}; }
  async removeFriend(uid, fid) { this.db.w('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)', uid, fid, fid, uid); return {}; }
  async block(uid, fid, on) { if (on) { await this.removeFriend(uid, fid); this.db.w('INSERT OR IGNORE INTO blocks (user_id,blocked) VALUES (?,?)', uid, fid); this.db.w('DELETE FROM friend_requests WHERE src=? AND dst=?', fid, uid); } else this.db.w('DELETE FROM blocks WHERE user_id=? AND blocked=?', uid, fid); return {}; }
  async myStealsMap(thief, owner) {
    const C = this.C(), mk = 'st|' + thief + '|' + owner; if (C && C.memo[mk]) return Object.assign({}, C.memo[mk]);
    const m = {}; (await this.db.all('SELECT idx,cycle,blocked FROM steals WHERE thief=? AND owner=? AND at>?', thief, owner, this.now() - 7 * 86400000)).forEach(r => m[r.idx + ':' + r.cycle] = r.blocked ? 2 : 1);
    if (C) C.memo[mk] = Object.assign({}, m); return m;
  }
  markSteal(thief, owner, idx, cycle, blocked) { const C = this.C(), mk = 'st|' + thief + '|' + owner; if (C && C.memo[mk]) C.memo[mk][idx + ':' + cycle] = blocked ? 2 : 1; }
  viewOf(o, plots, mine) {
    const now = this.now(), cap = CFG.stealCapPct(o.lv); let steal = 0, help = 0, soon = 0;
    const list = plots.map(P => {
      const v = this.pubPlot(P);
      if (P.u && P.c >= 0) {
        const taken = mine[P.idx + ':' + P.cycle];
        v.mine = taken || 0; v.left = Math.max(0, Math.floor(P.y0 * cap) - P.stolen);
        v.canSteal = P.p >= 1 && !taken && v.left > 0 && now >= P.ra + RULES.stealDelaySec * 1000; v.protectUntil = P.p >= 1 ? P.ra + RULES.stealDelaySec * 1000 : 0;
        if (v.canSteal) steal++; if (P.pr.d || P.pr.w || P.pr.b) help++; if (P.p < 1 && CFG.remainSec(P) < 600) soon++;
      }
      return v;
    });
    const dogs = this.dogsOf(o).filter(d => d.own).map(d => ({ id: d.id, name: d.name, lv: d.lv, fed: d.fed }));
    return { owner: Object.assign(this.publicUser(o), { dog: dogs.some(d => d.fed), dogLv: o.dog_lv, dogs, ranch: this.ranchView(o) }), plots: list, steal, help, soon };
  }
  // 定时刷新别人农场用：只读，不记访客、不发消息
  async peekFarm(uid, owner) { const [o, plots, mine] = await all([this.canSee(uid, owner), this.plots(owner), this.myStealsMap(uid, owner)]); return this.viewOf(o, plots, mine); }
  async farmView(uid, owner) { const [o, plots, mine] = await all([this.user(owner), this.plots(owner), this.myStealsMap(uid, owner)]); return this.viewOf(o, plots, mine); }
  // 一次查出很多人的农场概况（附近的人、好友列表）：两条查询代替 2N 条
  async farmViews(uid, users) {
    if (!users.length) return [];
    const ids = users.map(u => u.id), qs = ids.map(() => '?').join(','), now = this.now();
    const [prow, srow] = await all([this.db.all(`SELECT * FROM plots WHERE user_id IN (${qs}) ORDER BY user_id, idx`, ...ids), this.db.all(`SELECT owner,idx,cycle,blocked FROM steals WHERE thief=? AND owner IN (${qs}) AND at>?`, uid, ...ids, now - 7 * 86400000)]);
    const P = {}, S = {}; prow.forEach(r => (P[r.user_id] = P[r.user_id] || []).push(CFG.advancePlot(this.rowToPlot(r), now))); srow.forEach(r => (S[r.owner] = S[r.owner] || {})[r.idx + ':' + r.cycle] = r.blocked ? 2 : 1);
    return users.map(u => this.viewOf(u, P[u.id] || [], S[u.id] || {}));
  }
  async friends(uid) {
    const now = this.now();
    const [rows, requests, sent, visitors] = await all([
      this.db.all('SELECT u.*, f.since AS f_since FROM friends f JOIN users u ON u.id=f.b WHERE f.a=? ORDER BY u.last_active DESC', uid),
      this.db.all('SELECT u.*, r.at AS r_at FROM friend_requests r JOIN users u ON u.id=r.src WHERE r.dst=? ORDER BY r.at DESC', uid),
      this.db.all('SELECT u.*, r.at AS r_at FROM friend_requests r JOIN users u ON u.id=r.dst WHERE r.src=? ORDER BY r.at DESC', uid),
      this.db.all('SELECT u.*, v.at AS v_at FROM visits v JOIN users u ON u.id=v.visitor WHERE v.owner=? ORDER BY v.at DESC LIMIT 10', uid)]);
    const views = await this.farmViews(uid, rows);
    return {
      list: rows.map((u, i) => Object.assign(this.publicUser(u), { steal: views[i].steal, help: views[i].help, soon: views[i].soon, online: now - u.last_active < 120000, last: u.last_active, since: u.f_since })),
      requests: requests.map(u => Object.assign(this.publicUser(u), { at: u.r_at })), sent: sent.map(u => Object.assign(this.publicUser(u), { at: u.r_at })), visitors: visitors.map(u => Object.assign(this.publicUser(u), { at: u.v_at })),
    };
  }
  async visit(uid, owner) {
    const [o, prev, plots, mine] = await all([this.canSee(uid, owner), this.db.get('SELECT at FROM visits WHERE owner=? AND visitor=?', owner, uid), this.plots(owner), this.myStealsMap(uid, owner)]);
    const now = this.now();
    this.db.w('INSERT INTO visits (owner,visitor,at) VALUES (?,?,?) ON CONFLICT(owner,visitor) DO UPDATE SET at=excluded.at', owner, uid, now);
    if (!prev || now - prev.at > 3600000) await this.msg(owner, 'visit', uid, {});
    this.bump(uid, 'visit', 1, 'all');
    return this.viewOf(o, plots, mine);
  }
  async steal(uid, owner, idx, out) {
    const [o, n, P, mine] = await all([this.canSee(uid, owner), this.cnt(uid, 'steal_n', 'day'), this.plot(owner, idx), this.myStealsMap(uid, owner)]);
    const now = this.now();
    if (!P.u || P.c < 0 || P.p < 1) throw conflict('这块地没有成熟的果实', 'not_ripe');
    if (now < P.ra + RULES.stealDelaySec * 1000) throw conflict(`刚成熟，主人保护中，${Math.ceil((P.ra + RULES.stealDelaySec * 1000 - now) / 1000)} 秒后才能摘`, 'protected');
    if (mine[idx + ':' + P.cycle]) throw conflict('这块地你已经摘过了', 'done');
    const cap = Math.floor(P.y0 * CFG.stealCapPct(o.lv)), left = Math.min(cap - P.stolen, P.y - 1);
    if (left <= 0) throw conflict('已经被摘得差不多了，给主人留点吧', 'empty');
    const dupe = conflict('这块地你已经摘过了', 'done');
    // 看家狗：喂饱的每只狗各自判定，抓住的都会咬一口（福旺 5 金币、睿宝 15 金币）
    const caught = this.dogsOf(o).filter(d => d.own && d.fed && U.rand() < d.chance);
    if (caught.length) {
      const me = await this.user(uid), bite = Math.min(me.gold, caught.reduce((a, d) => a + d.bite, 0)), dogs = caught.map(d => d.name);
      if (bite > 0) this.addGold(uid, -bite, 'dog_bite');
      this.db.wx(dupe, 'INSERT INTO steals (owner,thief,idx,cycle,crop,qty,blocked,at) VALUES (?,?,?,?,?,0,1,?)', owner, uid, idx, P.cycle, P.c, now); this.markSteal(uid, owner, idx, P.cycle, true);
      await this.msg(owner, 'dog', uid, { crop: P.c, n: 1, dogs }, true); return { idx, blocked: true, bite, crop: P.c, dogs };
    }
    let qty = Math.round(P.y0 * (RULES.stealPctMin + U.rand() * (RULES.stealPctMax - RULES.stealPctMin)));
    const crit = U.rand() < RULES.stealCritChance; if (crit) qty *= 2; // 手气爆棚：一次摘两份
    qty = clampN(qty, 1, left);
    P.y -= qty; P.stolen += qty; this.savePlot(owner, P); // 并发偷同一块地：数据库的事务隔离会让后提交的一方冲突重试
    this.db.wx(dupe, 'INSERT INTO steals (owner,thief,idx,cycle,crop,qty,blocked,at) VALUES (?,?,?,?,?,?,0,?)', owner, uid, idx, P.cycle, P.c, qty, now); this.markSteal(uid, owner, idx, P.cycle, false);
    this.addInv(uid, 'c' + P.c, qty);
    this.db.w('UPDATE users SET steal_total=steal_total+1 WHERE id=?', uid); this.db.w('UPDATE users SET stolen_from_total=stolen_from_total+? WHERE id=?', qty, owner); this.pu(uid, x => x.steal_total++); this.pu(owner, x => x.stolen_from_total += qty);
    // 软上限：超过后照样能摘、能拿到果实，只是不再加经验
    const tired = false; // 不设每日经验上限
    this.bump(uid, 'steal'); this.bump(uid, 'steal_n', 1, 'day'); this.bump(uid, 'social', 1, 'all'); const exp = tired ? 0 : await this.addExp(uid, RULES.stealExp, out); this.metric('steals');
    await this.msg(owner, 'stolen', uid, { qty, items: { ['c' + P.c]: qty } }, true);
    return { idx, qty, crop: P.c, left: P.y, crit, exp, tired };
  }
  async help(uid, owner, idx, out) {
    const [, n, P] = await all([this.canSee(uid, owner), this.cnt(uid, 'help_n', 'day'), this.plot(owner, idx)]);
    const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地不需要帮忙', 'healthy');
    P.pr[k] = 0; const now = this.now();
    // 邻居帮忙：作物顺带多长一点
    if (P.p < 1 && RULES.helpBoost > 0) { P.p = Math.min(1, P.p + RULES.helpBoost); if (P.p >= 1) { P.ra = now; P.ev = []; } }
    this.savePlot(owner, P);
    this.db.w('INSERT OR IGNORE INTO helps (owner,helper,idx,cycle,kind,at) VALUES (?,?,?,?,?,?)', owner, uid, idx, P.cycle, k, now);
    // 软上限：超过后仍然可以帮忙，只是不再给奖励
    const tired = false; let gold = 0, exp = 0;
    if (!tired) { gold = RULES.helpGold; this.addGold(uid, gold, 'help'); exp = await this.addExp(uid, RULES.helpExp, out); }
    this.db.w('UPDATE users SET help_total=help_total+1 WHERE id=?', uid); this.pu(uid, x => x.help_total++); this.bump(uid, 'help'); this.bump(uid, 'help_n', 1, 'day'); this.bump(uid, 'social', 1, 'all');
    await this.msg(owner, 'helped', uid, { kinds: k }, true); return { idx, kind: k, gold, exp, tired };
  }
  async guestbook(uid, owner) { if (uid !== owner) await this.canSee(uid, owner); return (await this.db.all('SELECT g.id,g.phrase,g.at,g.author,u.name,u.avatar FROM guestbook g LEFT JOIN users u ON u.id=g.author WHERE g.owner=? AND g.hidden=0 ORDER BY g.id DESC LIMIT 30', owner)).map(r => ({ id: r.id, phrase: r.phrase, at: r.at, author: r.author, name: r.name || '已注销玩家', avatar: J(r.avatar) || {} })); }
  async postGuestbook(uid, owner, phrase) {
    phrase = U.int(phrase, '留言', 0, CFG.PHRASES.length - 1);
    const [, n] = await all([this.canSee(uid, owner), this.cnt(uid, 'gb', 'day')]);
    if (n >= RULES.gbDailyLimit) throw conflict('今天留言太多了', 'limit');
    this.db.w('INSERT INTO guestbook (owner,author,phrase,at) VALUES (?,?,?,?)', owner, uid, phrase, this.now()); this.bump(uid, 'gb', 1, 'day'); await this.msg(owner, 'gb', uid, { phrase }); return {};
  }
  async hideGuestbook(uid, id) { const r = await this.db.run('UPDATE guestbook SET hidden=1 WHERE id=? AND owner=?', id, uid); if (!r.changes) throw notFound('留言不存在'); return {}; }
  async messages(uid) {
    const [rows, fr] = await all([this.db.all('SELECT m.*, u.name AS aname, u.avatar AS aav, u.code AS acode, u.role AS arole FROM messages m LEFT JOIN users u ON u.id=m.actor WHERE m.user_id=? ORDER BY m.id DESC LIMIT 100', uid), this.friendSet(uid)]);
    return rows.map(r => ({ id: r.id, kind: r.kind, actor: r.actor, name: r.actor ? (r.aname || '已注销玩家') : (r.kind === 'system' ? '系统' : '已注销玩家'), avatar: J(r.aav) || {}, friend: r.actor ? fr.has(r.actor) : false, canVisit: !!(r.actor && r.aname), data: J(r.data) || {}, at: r.at, read: !!r.read }));
  }
  async readMessages(uid) { this.db.w('UPDATE messages SET read=1 WHERE user_id=? AND read=0', uid); return {}; }

  /* ---------- 集市（玩家交易） ---------- */
  async expireListings() {
    const now = this.now(); const rows = await this.db.all("SELECT * FROM market WHERE status='open' AND expires_at<=?", now);
    for (const m of rows) {
      const r = await this.db.run("UPDATE market SET status='expired', done_at=? WHERE id=? AND status='open'", now, m.id);
      if (r.changes) { this.addInv(m.seller, m.item, m.qty); await this.msg(m.seller, 'market_expired', null, { item: m.item, qty: m.qty }); }
    }
  }
  priceBand(item) { const c = cropOfItem(item), base = CROPS[c.id].price * (c.golden ? RULES.goldenPriceMult : 1); return { min: Math.max(1, Math.floor(base * RULES.marketMinMult)), max: Math.ceil(base * RULES.marketMaxMult), base }; }
  async market(uid, item) {
    await this.expireListings();
    const [q, mine, fr] = await all([item ? this.db.all("SELECT m.*, u.name, u.code FROM market m JOIN users u ON u.id=m.seller WHERE m.status='open' AND m.item=? AND m.seller<>? ORDER BY m.price, m.id LIMIT 60", item, uid)
      : this.db.all("SELECT m.*, u.name, u.code FROM market m JOIN users u ON u.id=m.seller WHERE m.status='open' AND m.seller<>? ORDER BY m.created_at DESC LIMIT 60", uid),
    this.db.all("SELECT * FROM market WHERE seller=? AND (status='open' OR done_at>?) ORDER BY id DESC LIMIT 30", uid, this.now() - 3 * 86400000), this.friendSet(uid)]);
    return { list: q.map(m => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, seller: { id: m.seller, name: m.name, code: m.code, friend: fr.has(m.seller) }, expires: m.expires_at })), mine: mine.map(m => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, status: m.status, expires: m.expires_at })) };
  }
  async listItem(uid, item, qty, price) {
    if (!cropOfItem(item)) throw bad('只能上架作物'); qty = U.int(qty, '数量', 1, 9999); price = U.int(price, '单价', 1, 1e7);
    const b = this.priceBand(item); if (price < b.min || price > b.max) throw bad(`单价需在 ${b.min}–${b.max} 之间`);
    await this.expireListings();
    if ((await this.db.get("SELECT COUNT(*) n FROM market WHERE seller=? AND status='open'", uid)).n >= RULES.marketMaxListings) throw conflict(`最多同时上架 ${RULES.marketMaxListings} 件`, 'limit');
    this.addInv(uid, item, -qty); const now = this.now();
    const r = await this.db.run('INSERT INTO market (seller,item,qty,price,created_at,expires_at) VALUES (?,?,?,?,?,?)', uid, item, qty, price, now, now + RULES.marketTtlHours * 3600000);
    return { id: Number(r.lastInsertRowid) };
  }
  async cancelListing(uid, id) { const m = await this.db.get("SELECT * FROM market WHERE id=? AND seller=? AND status='open'", id, uid); if (!m) throw notFound('挂单不存在或已成交'); const r = await this.db.run("UPDATE market SET status='cancelled', done_at=? WHERE id=? AND status='open'", this.now(), id); if (!r.changes) throw notFound('挂单不存在或已成交'); this.addInv(uid, m.item, m.qty); return { item: m.item, qty: m.qty }; }
  async buyListing(uid, id, out) {
    await this.expireListings();
    const m = await this.db.get("SELECT * FROM market WHERE id=? AND status='open'", id); if (!m) throw conflict('这件商品已经被买走或下架了', 'gone'); if (m.seller === uid) throw bad('不能买自己的商品');
    const total = m.qty * m.price, fee = Math.ceil(total * RULES.marketFee);
    this.addGold(uid, -total, 'market_buy'); const r = await this.db.run("UPDATE market SET status='sold', buyer=?, done_at=? WHERE id=? AND status='open'", uid, this.now(), id); if (!r.changes) throw conflict('这件商品已经被买走了', 'gone');
    this.addInv(uid, m.item, m.qty); this.addGold(m.seller, total - fee, 'market_sell');
    this.bump(uid, 'trade'); this.bump(m.seller, 'trade'); this.metric('market_sales'); this.metric('market_gold', total);
    await this.msg(m.seller, 'market_sold', uid, { item: m.item, qty: m.qty, gold: total - fee });
    return { item: m.item, qty: m.qty, total, fee };
  }

  /* ---------- 排行榜 / 赛季 ---------- */
  async leaderboard(uid, dim, scope) {
    const wk = this.period('week'); const dims = { lv: null, gold: null, harvest: 'harvest', steal: 'steal', help: 'help', season: 'sp' };
    if (!(dim in dims)) throw bad('排行榜类型不对');
    const ids = scope === 'friends' ? [uid].concat([...(await this.friendSet(uid))]) : null;
    const filt = ids ? ` AND u.id IN (${ids.map(() => '?').join(',')})` : '';
    let rows;
    if (dim === 'lv') rows = await this.db.all(`SELECT u.*, (u.lv*100000000+u.exp) AS score FROM users u WHERE u.banned=0${filt} ORDER BY score DESC LIMIT 50`, ...(ids || []));
    else if (dim === 'gold') rows = await this.db.all(`SELECT u.*, u.gold AS score FROM users u WHERE u.banned=0${filt} ORDER BY score DESC LIMIT 50`, ...(ids || []));
    else rows = await this.db.all(`SELECT u.*, c.val AS score FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0${filt} ORDER BY score DESC, u.id LIMIT 50`, wk, dims[dim], ...(ids || []));
    const list = rows.map((u, i) => Object.assign(this.publicUser(u), { rank: i + 1, score: dim === 'lv' ? u.lv : u.score }));
    let mine = list.find(r => r.id === uid);
    if (!mine && !ids) {
      const u = await this.user(uid); let score, above;
      if (dim === 'lv') { score = u.lv; above = (await this.db.get('SELECT COUNT(*) n FROM users WHERE banned=0 AND (lv*100000000+exp) > ?', u.lv * 1e8 + u.exp)).n; }
      else if (dim === 'gold') { score = u.gold; above = (await this.db.get('SELECT COUNT(*) n FROM users WHERE banned=0 AND gold > ?', u.gold)).n; }
      else { score = await this.cnt(uid, dims[dim], wk); above = (await this.db.get('SELECT COUNT(*) n FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0 AND c.val > ?', wk, dims[dim], score)).n; }
      mine = Object.assign(this.publicUser(u), { rank: above + 1, score });
    }
    return { dim, scope, week: wk, weekEnd: CFG.weekEnd(this.now()), list, mine };
  }
  seasonReward(rank, pts) { if (pts < 100) return 0; return rank === 1 ? 5000 : rank <= 3 ? 3000 : rank <= 10 ? 1500 : rank <= 50 ? 800 : 300; }
  async season(uid) {
    const now = this.now(), wk = CFG.weekKey(now), last = CFG.weekKey(now - 7 * 86400000);
    const [pts, lastPts, claimed] = await all([this.cnt(uid, 'sp', wk), this.cnt(uid, 'sp', last), this.db.get('SELECT 1 FROM claims WHERE user_id=? AND key=?', uid, 'season:' + last)]);
    const above = real => this.db.get(`SELECT COUNT(*) n FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key='sp' AND u.banned=0${real ? " AND u.role<>'npc'" : ''} AND c.val > ?`, last, lastPts);
    let lastRank = 0, rewardRank = 0; if (lastPts) { const [a, b] = await all([above(false), above(true)]); lastRank = a.n + 1; rewardRank = b.n + 1; }
    return { week: wk, end: CFG.weekEnd(now), pts, last: { week: last, pts: lastPts, rank: lastRank, reward: this.seasonReward(rewardRank, lastPts), claimed: !!claimed }, tiers: [[1, 5000], [3, 3000], [10, 1500], [50, 800], [Infinity, 300]] };
  }
  async claimSeason(uid) { const s = await this.season(uid); if (!s.last.reward) throw conflict('上赛季积分不足 100，没有奖励', 'not_done'); this.claim(uid, 'season:' + s.last.week); this.addGold(uid, s.last.reward, 'season'); return { gold: s.last.reward, rank: s.last.rank }; }

  /* ---------- 图鉴 / 装扮 / 资料 ---------- */
  codexList(uid) { return this.db.all('SELECT item,first_at,n FROM codex WHERE user_id=?', uid); }
  async cosmetics(uid) { return (await this.db.all('SELECT item FROM cosmetics WHERE user_id=?', uid)).map(r => r.item); }
  async buyCosmetic(uid, kind, id) {
    const list = kind === 'theme' ? CFG.THEMES : kind === 'frame' ? CFG.FRAMES : null; if (!list) throw bad('类型不对'); const it = list.find(x => x.id === id); if (!it) throw bad('不存在');
    if (await this.db.get('SELECT 1 FROM cosmetics WHERE user_id=? AND item=?', uid, kind + ':' + id)) throw conflict('已经拥有了', 'done');
    if (it.ach) throw bad('需要完成成就解锁'); this.addGold(uid, -it.price, 'cosmetic'); this.db.wx(conflict('已经拥有了', 'done'), 'INSERT INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, kind + ':' + id, this.now()); return {};
  }
  async updateProfile(uid, b) {
    const sets = [], args = [];
    if (b.name !== undefined) { sets.push('name=?'); args.push(U.cleanName(b.name)); }
    if (b.avatar !== undefined) { const A = CFG.AVATAR_OPTS, a = b.avatar || {}; const av = { skin: U.int(a.skin || 0, '肤色', 0, A.skin.length - 1), hair: U.int(a.hair || 0, '发色', 0, A.hair.length - 1), hat: a.hat ? 1 : 0, fringe: a.fringe ? 1 : 0, pig: a.pig ? 1 : 0, band: U.int(a.band || 0, '帽带', 0, A.band.length - 1), shirt: U.int(a.shirt || 0, '衣服', 0, A.shirt.length - 1), bg: U.int(a.bg || 0, '背景', 0, A.bg.length - 1) }; sets.push('avatar=?'); args.push(JSON.stringify(av)); }
    const own = (b.theme !== undefined || b.frame !== undefined) ? new Set(await this.cosmetics(uid)) : new Set();
    if (b.theme !== undefined) { if (!own.has('theme:' + b.theme)) throw bad('还没有这个主题'); sets.push('theme=?'); args.push(b.theme); }
    if (b.frame !== undefined) { if (!own.has('frame:' + b.frame)) throw bad('还没有这个头像框'); sets.push('frame=?'); args.push(b.frame); }
    if (b.title !== undefined) { if (b.title) { const a = CFG.ACHIEVEMENTS.find(x => x.title === b.title); if (!a || !(await this.db.get('SELECT 1 FROM claims WHERE user_id=? AND key=?', uid, 'ach:' + a.id))) throw bad('还没有获得这个称号'); } sets.push('title=?'); args.push(b.title || ''); }
    if (b.seed !== undefined) { const c = U.int(b.seed, '种子', 0, CROPS.length - 1); sets.push('seed=?'); args.push(c); }
    if (b.settings !== undefined) { const s = b.settings || {}; const clean = { sound: !!s.sound, music: !!s.music, notify: !!s.notify, tod: ['auto', 'day', 'dusk', 'night'].includes(s.tod) ? s.tod : 'auto', tut: U.int(s.tut || 0, '引导', 0, 99) }; sets.push('settings=?'); args.push(JSON.stringify(clean)); }
    if (sets.length) this.db.w(`UPDATE users SET ${sets.join(',')} WHERE id=?`, ...args, uid); return {};
  }
}

module.exports = { Game, cropOfItem, itemName };
