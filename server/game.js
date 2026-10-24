'use strict';
/* =====================================================
   丰收农场 · 服务端权威游戏逻辑
   所有写操作都在 db.tx() 中同步执行（BEGIN IMMEDIATE），保证原子性。
   ===================================================== */
const CFG = require('../shared/config');
const U = require('./util');
const { CROPS, RULES, NPLOTS, UNLOCK_ORDER } = CFG;
const { bad, forbid, notFound, conflict } = U;

const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[U.randInt(0, a.length - 1)];
const cropOfItem = item => { const m = /^([cg])(\d+)$/.exec(item || ''); if (!m || !CROPS[+m[2]]) return null; return { golden: m[1] === 'g', id: +m[2] }; };
const itemName = item => { if (item === 'fert') return '化肥'; if (item === 'dogfood') return '狗粮'; const c = cropOfItem(item); return c ? (c.golden ? '金色' : '') + CROPS[c.id].name : item; };

class Game {
  constructor(db, opts) {
    this.db = db; this.clockOffset = 0; this.opts = opts || {};
    this.applyConfigOverrides();
  }
  now() { return Date.now() + this.clockOffset; }

  /* ---------- 配置覆盖（运营后台可改作物数值与规则） ---------- */
  applyConfigOverrides() {
    if (!this._base) this._base = { crops: CROPS.map(c => ({ seed: c.seed, time: c.time, yield: c.yield, price: c.price, exp: c.exp, lv: c.lv })), rules: Object.assign({}, RULES) };
    CROPS.forEach((c, i) => Object.assign(c, this._base.crops[i])); Object.assign(RULES, this._base.rules);
    const co = J((this.db.get("SELECT value FROM config WHERE key='crops'") || {}).value) || {};
    Object.keys(co).forEach(id => { const c = CROPS[+id]; if (!c) return; ['seed', 'time', 'yield', 'price', 'exp', 'lv'].forEach(k => { const v = Number(co[id][k]); if (Number.isFinite(v) && v > 0) c[k] = Math.round(v); }); });
    const ro = J((this.db.get("SELECT value FROM config WHERE key='rules'") || {}).value) || {};
    Object.keys(ro).forEach(k => { if (k in RULES && typeof RULES[k] === 'number' && Number.isFinite(Number(ro[k]))) RULES[k] = Number(ro[k]); });
  }
  publicConfig() { return { CROPS, RULES, TZ_MIN: this.opts.tzMin || 480 }; }

  /* ---------- 活动 ---------- */
  activeEvents() { const now = this.now(); return this.db.all('SELECT id,name,kind,params,start_at,end_at,descr FROM events WHERE enabled=1 AND start_at<=? AND end_at>? ORDER BY id', now, now).map(e => Object.assign(e, { params: J(e.params) || {} })); }
  evMult(kind, cropId) { let m = 1; this.activeEvents().forEach(e => { if (e.kind === kind && (e.params.crop === undefined || e.params.crop === null || e.params.crop === '' || +e.params.crop === cropId)) m *= Number(e.params.mult) || 1; }); return m; }
  unitPrice(item) { const c = cropOfItem(item); if (!c) return 0; const b = CFG.dayBonus(this.now())[c.id] || 0; return Math.round(CROPS[c.id].price * (1 + b) * (c.golden ? RULES.goldenPriceMult : 1) * this.evMult('price_mult', c.id)); }

  /* ---------- 基础读写 ---------- */
  user(uid) { const u = this.db.get('SELECT * FROM users WHERE id=?', uid); if (!u) throw notFound('玩家不存在'); return u; }
  publicUser(u) { return { id: u.id, code: u.code, name: u.name, lv: u.lv, avatar: J(u.avatar) || {}, title: u.title, theme: u.theme, frame: u.frame }; }
  me(u) {
    return Object.assign(this.publicUser(u), {
      gold: u.gold, exp: u.exp, expNeed: CFG.expNeed(u.lv), seed: u.seed, username: u.username || '', guest: !u.username, role: u.role, migrated: !!u.migrated,
      dog: { own: !!u.dog_own, lv: u.dog_lv, exp: u.dog_exp, need: CFG.dogExpNeed(u.dog_lv), until: u.dog_until },
      checkin: { last: u.checkin_last, streak: u.checkin_streak }, settings: J(u.settings) || {}, created_at: u.created_at,
      stats: { harvest: u.harvest_total, steal: u.steal_total, help: u.help_total, plant: u.plant_total, earned: u.earned_total, golden: u.golden_total, order: u.order_total, stolenFrom: u.stolen_from_total },
    });
  }
  rowToPlot(r) { return { idx: r.idx, u: r.u, soil: r.soil, c: r.c, p: r.p, t: r.t, sea: r.sea, y: r.y, y0: r.y0, stolen: r.stolen, pr: J(r.pr) || { d: 0, w: 0, b: 0 }, ev: J(r.ev) || [], ra: r.ra, cycle: r.cycle }; }
  plots(uid) { const now = this.now(); return this.db.all('SELECT * FROM plots WHERE user_id=? ORDER BY idx', uid).map(r => CFG.advancePlot(this.rowToPlot(r), now)); }
  plot(uid, idx) { const r = this.db.get('SELECT * FROM plots WHERE user_id=? AND idx=?', uid, idx); if (!r) throw bad('土地不存在'); return CFG.advancePlot(this.rowToPlot(r), this.now()); }
  savePlot(uid, P) {
    this.db.run('UPDATE plots SET u=?,soil=?,c=?,p=?,t=?,sea=?,y=?,y0=?,stolen=?,pr=?,ev=?,ra=?,cycle=? WHERE user_id=? AND idx=?',
      P.u, P.soil, P.c, P.p, P.t, P.sea, P.y, P.y0, P.stolen, JSON.stringify(P.pr), JSON.stringify(P.ev || []), P.ra || 0, P.cycle, uid, P.idx);
  }
  pubPlot(P) { return { idx: P.idx, u: P.u, soil: P.soil, c: P.c, p: P.p, t: P.t, sea: P.sea, y: P.y, y0: P.y0, stolen: P.stolen, pr: P.pr, ra: P.ra || 0 }; }
  inv(uid) { const o = {}; this.db.all('SELECT item,qty FROM inventory WHERE user_id=? AND qty>0', uid).forEach(r => o[r.item] = r.qty); return o; }
  invQty(uid, item) { return (this.db.get('SELECT qty FROM inventory WHERE user_id=? AND item=?', uid, item) || { qty: 0 }).qty; }
  addInv(uid, item, n) {
    if (!n) return;
    if (n < 0) { const r = this.db.run('UPDATE inventory SET qty=qty+? WHERE user_id=? AND item=? AND qty>=?', n, uid, item, -n); if (!r.changes) throw conflict(itemName(item) + '数量不足', 'not_enough'); return; }
    this.db.run('INSERT INTO inventory (user_id,item,qty) VALUES (?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET qty=qty+excluded.qty', uid, item, n);
  }
  addGold(uid, n, reason) {
    n = Math.round(n); if (!n) return;
    const r = this.db.run('UPDATE users SET gold=gold+? WHERE id=? AND gold+?>=0', n, uid, n);
    if (!r.changes) throw conflict('金币不足', 'no_gold');
    if (n > 0) this.db.run('UPDATE users SET earned_total=earned_total+? WHERE id=?', n, uid);
    this.db.run('INSERT INTO ledger (user_id,delta,reason,at) VALUES (?,?,?,?)', uid, n, reason, this.now());
  }
  addExp(uid, n, out) {
    n = Math.round(n * this.evMult('exp_mult')); if (n <= 0) return 0; const u = this.user(uid);
    this.bump(uid, 'sp', n, 'week');
    if (u.lv >= RULES.maxLv) return 0;
    let lv = u.lv, exp = u.exp + n; const ups = [];
    while (lv < RULES.maxLv && exp >= CFG.expNeed(lv)) { exp -= CFG.expNeed(lv); lv++; ups.push(lv); }
    if (lv >= RULES.maxLv) exp = 0;
    this.db.run('UPDATE users SET exp=?, lv=? WHERE id=?', exp, lv, uid);
    ups.forEach(l => { this.addGold(uid, l * 120, 'levelup'); this.addInv(uid, 'fert', 1); });
    if (out && ups.length) out.levelUp = (out.levelUp || []).concat(ups);
    return n;
  }
  // 计数器：day / week / all
  period(kind) { const now = this.now(); return kind === 'day' ? 'd' + CFG.dayKey(now) : kind === 'week' ? CFG.weekKey(now) : 'all'; }
  bump(uid, key, n, only) {
    n = n || 1; const ps = only ? [this.period(only)] : [this.period('day'), this.period('week'), 'all'];
    ps.forEach(p => this.db.run('INSERT INTO counters (user_id,period,key,val) VALUES (?,?,?,?) ON CONFLICT(user_id,period,key) DO UPDATE SET val=val+excluded.val', uid, p, key, n));
  }
  cnt(uid, key, kind) { const p = kind === 'day' || kind === 'week' ? this.period(kind) : kind; return (this.db.get('SELECT val FROM counters WHERE user_id=? AND period=? AND key=?', uid, p, key) || { val: 0 }).val; }
  metric(key, n) { this.db.run('INSERT INTO metrics (day,key,val) VALUES (?,?,?) ON CONFLICT(day,key) DO UPDATE SET val=val+excluded.val', CFG.dayKey(this.now()), key, n || 1); }
  msg(uid, kind, actor, data, aggKey) {
    const now = this.now();
    if (aggKey) { // 合并 10 分钟内同一人的同类消息，避免刷屏
      const last = this.db.get('SELECT id,data FROM messages WHERE user_id=? AND kind=? AND actor IS ? AND at>? AND read=0 ORDER BY id DESC LIMIT 1', uid, kind, actor, now - 600000);
      if (last) { const d = J(last.data) || {}; d.n = (d.n || 1) + 1; if (data.qty) d.qty = (d.qty || 0) + data.qty; d.items = Object.assign(d.items || {}, data.items ? Object.fromEntries(Object.entries(data.items).map(([k, v]) => [k, (d.items && d.items[k] || 0) + v])) : {}); this.db.run('UPDATE messages SET data=?, at=? WHERE id=?', JSON.stringify(d), now, last.id); return; }
    }
    this.db.run('INSERT INTO messages (user_id,kind,actor,data,at) VALUES (?,?,?,?,?)', uid, kind, actor, JSON.stringify(data || {}), now);
    this.db.run('DELETE FROM messages WHERE user_id=? AND id < (SELECT id FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 1 OFFSET 199)', uid, uid);
  }
  isFriend(a, b) { return !!this.db.get('SELECT 1 FROM friends WHERE a=? AND b=?', a, b); }

  /* ---------- 账号 ---------- */
  newCode() { for (let i = 0; i < 50; i++) { const c = String(U.randInt(1000000, 9999999)); if (!this.db.get('SELECT 1 FROM users WHERE code=?', c)) return c; } throw new Error('无法生成玩家号'); }
  createUser(name, username, password) {
    return this.db.tx(() => {
      const now = this.now(); name = U.cleanName(name || '小农夫');
      if (username) { username = U.cleanUsername(username); U.checkPw(password); if (this.db.get('SELECT 1 FROM users WHERE username=?', username)) throw conflict('该账号已被注册', 'taken'); }
      const av = { skin: 0, hair: 0, hat: 1, band: 0, shirt: 0, bg: 0 };
      const r = this.db.run('INSERT INTO users (code,username,pass_hash,name,avatar,gold,created_at,last_active) VALUES (?,?,?,?,?,?,?,?)',
        this.newCode(), username || null, username ? U.hashPassword(password) : null, name, JSON.stringify(av), RULES.startGold, now, now);
      const uid = Number(r.lastInsertRowid);
      for (let i = 0; i < NPLOTS; i++) this.db.run('INSERT INTO plots (user_id,idx,u,t) VALUES (?,?,?,?)', uid, i, UNLOCK_ORDER.indexOf(i) < RULES.startPlots ? 1 : 0, now);
      this.addInv(uid, 'fert', 3);
      this.db.run("INSERT INTO cosmetics (user_id,item,at) VALUES (?, 'theme:classic', ?), (?, 'frame:none', ?)", uid, now, uid, now);
      this.db.run('INSERT INTO ledger (user_id,delta,reason,at) VALUES (?,?,?,?)', uid, RULES.startGold, 'start', now);
      this.metric('registrations');
      return uid;
    });
  }
  newSession(uid, ua) { const tok = U.randToken(32); const now = this.now(); this.db.run('INSERT INTO sessions (token_hash,user_id,created_at,last_seen,ua) VALUES (?,?,?,?,?)', U.sha256(tok), uid, now, now, String(ua || '').slice(0, 120)); return tok; }
  auth(token) {
    if (!token) return null; const s = this.db.get('SELECT * FROM sessions WHERE token_hash=?', U.sha256(token)); if (!s) return null;
    const now = this.now(); if (now - s.last_seen > 90 * 86400000) { this.db.run('DELETE FROM sessions WHERE token_hash=?', s.token_hash); return null; }
    if (now - s.last_seen > 60000) this.db.run('UPDATE sessions SET last_seen=? WHERE token_hash=?', now, s.token_hash);
    const u = this.db.get('SELECT * FROM users WHERE id=?', s.user_id); if (!u) return null;
    if (now - u.last_active > 60000) this.db.run('UPDATE users SET last_active=? WHERE id=?', now, u.id);
    this.db.run('INSERT OR IGNORE INTO logins (user_id,day) VALUES (?,?)', u.id, CFG.dayKey(now));
    return { user: u, tokenHash: s.token_hash };
  }
  login(username, password) {
    const u = this.db.get('SELECT * FROM users WHERE username=?', String(username || '').trim());
    if (!u || !U.checkPassword(password, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '账号或密码错误');
    return u;
  }
  bind(uid, username, password) {
    return this.db.tx(() => {
      const u = this.user(uid); if (u.username) throw bad('已经绑定过账号了'); username = U.cleanUsername(username); U.checkPw(password);
      if (this.db.get('SELECT 1 FROM users WHERE username=?', username)) throw conflict('该账号已被注册', 'taken');
      const rec = U.randToken(9).replace(/[-_]/g, 'x').slice(0, 12).toUpperCase();
      this.db.run('UPDATE users SET username=?, pass_hash=?, recovery_hash=? WHERE id=?', username, U.hashPassword(password), U.sha256(rec), uid);
      return { recovery: rec };
    });
  }
  changePassword(uid, oldPw, newPw) { const u = this.user(uid); if (!U.checkPassword(oldPw, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '原密码错误'); U.checkPw(newPw); this.db.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(newPw), uid); this.db.run('DELETE FROM sessions WHERE user_id=?', uid); }
  recover(username, code, newPw) {
    const u = this.db.get('SELECT * FROM users WHERE username=?', String(username || '').trim());
    if (!u || !u.recovery_hash || U.sha256(String(code || '').trim().toUpperCase()) !== u.recovery_hash) throw new U.ApiError(401, 'bad_login', '账号或恢复码错误');
    U.checkPw(newPw); const rec = U.randToken(9).replace(/[-_]/g, 'x').slice(0, 12).toUpperCase();
    this.db.run('UPDATE users SET pass_hash=?, recovery_hash=? WHERE id=?', U.hashPassword(newPw), U.sha256(rec), u.id); this.db.run('DELETE FROM sessions WHERE user_id=?', u.id);
    return { user: u, recovery: rec };
  }
  exportData(uid) {
    const u = this.user(uid); const d = Object.assign({}, u); delete d.pass_hash; delete d.recovery_hash;
    const T = (sql) => this.db.all(sql, uid);
    return { exportedAt: new Date(this.now()).toISOString(), user: d, plots: this.plots(uid).map(p => this.pubPlot(p)), inventory: this.inv(uid),
      friends: T('SELECT b AS friend, since FROM friends WHERE a=?'), messages: T('SELECT kind,actor,data,at FROM messages WHERE user_id=?'), codex: T('SELECT item,first_at,n FROM codex WHERE user_id=?'),
      cosmetics: T('SELECT item FROM cosmetics WHERE user_id=?'), claims: T('SELECT key,at FROM claims WHERE user_id=?'), market: T('SELECT * FROM market WHERE seller=?'), ledger: T('SELECT delta,reason,at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 2000') };
  }
  deleteAccount(uid, password, confirm) {
    const u = this.user(uid);
    if (u.username) { if (!U.checkPassword(password, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '密码错误'); }
    else if (confirm !== '确认注销') throw bad('请输入“确认注销”');
    this.db.tx(() => {
      this.db.all("SELECT * FROM market WHERE seller=? AND status='open'", uid).forEach(m => this.db.run("UPDATE market SET status='cancelled', done_at=? WHERE id=?", this.now(), m.id));
      ['steals WHERE thief=?', 'steals WHERE owner=?', 'helps WHERE helper=?', 'helps WHERE owner=?', 'guestbook WHERE author=?', 'idem WHERE user_id=?', 'ledger WHERE user_id=?', 'logins WHERE user_id=?'].forEach(t => this.db.run('DELETE FROM ' + t, uid));
      this.db.run('UPDATE messages SET actor=NULL WHERE actor=?', uid);
      this.db.run('DELETE FROM users WHERE id=?', uid);
    });
  }
  // 旧版单机存档迁移：不信任客户端数值，只按上限折算一次“老玩家礼包”
  migrate(uid, old) {
    return this.db.tx(() => {
      const u = this.user(uid); if (u.migrated) throw conflict('已经迁移过旧存档了', 'done');
      const lv = clampN(parseInt(old && old.lv) || 1, 1, 30), gold = clampN(parseInt(old && old.gold) || 0, 0, 1e9);
      const gLv = Math.min(lv, 8), gGold = Math.min(gold, 3000) + 200, gFert = 5;
      if (gLv > u.lv) this.db.run('UPDATE users SET lv=?, exp=0 WHERE id=?', gLv, uid);
      this.addGold(uid, gGold, 'migrate'); this.addInv(uid, 'fert', gFert);
      this.db.run('UPDATE users SET migrated=1 WHERE id=?', uid);
      return { lv: Math.max(gLv, u.lv), gold: gGold, fert: gFert };
    });
  }

  /* ---------- 快照 ---------- */
  badges(uid) {
    const u = this.user(uid), day = this.period('day'), wk = this.period('week'), claimed = new Set(this.db.all('SELECT key FROM claims WHERE user_id=?', uid).map(r => r.key));
    let tasks = 0;
    CFG.TASKS.forEach(t => { if (this.cnt(uid, t.id, day) >= t.need && !claimed.has('task:' + day + ':' + t.id)) tasks++; });
    CFG.WEEKLY.forEach(t => { if (this.cnt(uid, t.stat, wk) >= t.need && !claimed.has('weekly:' + wk + ':' + t.id)) tasks++; });
    if (u.checkin_last !== CFG.dayKey(this.now())) tasks++;
    let newbie = 0; CFG.NEWBIE.forEach(t => { if (this.cnt(uid, t.stat, 'all') >= t.need && !claimed.has('newbie:' + t.id)) newbie++; });
    const stats = this.achStats(u); let ach = 0; CFG.ACHIEVEMENTS.forEach(a => { if (stats[a.stat] >= a.need && !claimed.has('ach:' + a.id)) ach++; });
    return {
      tasks, newbie, newbieLeft: CFG.NEWBIE.filter(t => !claimed.has('newbie:' + t.id)).length, ach,
      unread: this.db.get('SELECT COUNT(*) n FROM messages WHERE user_id=? AND read=0', uid).n,
      requests: this.db.get('SELECT COUNT(*) n FROM friend_requests WHERE dst=?', uid).n,
    };
  }
  snapshot(uid) {
    const u = this.user(uid), now = this.now();
    return { now, me: this.me(u), plots: this.plots(uid).map(p => this.pubPlot(p)), inv: this.inv(uid), badges: this.badges(uid), rain: CFG.rainUntil(now), bonus: CFG.dayBonus(now), events: this.activeEvents(), day: CFG.dayKey(now) };
  }

  /* ---------- 自己农场 ---------- */
  scheduleEv(P, start) { const dur = CFG.plotDur(P), rem = 1 - P.p, cr = CROPS[P.c]; const n = (U.rand() < (cr.time < 60 ? 0.35 : 0.6) ? 1 : 0) + (U.rand() < 0.3 ? 1 : 0) + (cr.time >= 1800 && U.rand() < 0.4 ? 1 : 0); const ev = []; for (let i = 0; i < n; i++) ev.push([Math.round(start + dur * rem * (0.1 + U.rand() * 0.75)), pick(['d', 'w', 'b'])]); ev.sort((a, b) => a[0] - b[0]); return ev; }
  startCycle(P, now) { const cr = CROPS[P.c]; P.y0 = Math.max(1, Math.round(cr.yield * (P.soil ? RULES.soilYield : 1) * this.evMult('yield_mult', P.c))); P.y = P.y0; P.stolen = 0; P.pr = { d: 0, w: 0, b: 0 }; P.t = now; P.ra = 0; P.cycle++; P.ev = this.scheduleEv(P, now); }
  plant(uid, idx, cropId, out) {
    const u = this.user(uid), cr = CROPS[cropId]; if (!cr) throw bad('没有这种种子');
    const P = this.plot(uid, idx); if (!P.u) throw bad('这块地还没开垦'); if (P.c >= 0) throw conflict('这块地已经种了东西', 'occupied');
    if (u.lv < cr.lv) throw bad(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'locked');
    this.addGold(uid, -cr.seed, 'seed');
    const now = this.now(); P.c = cropId; P.p = 0; P.sea = 0; this.startCycle(P, now); this.savePlot(uid, P);
    this.db.run('UPDATE users SET plant_total=plant_total+1, seed=? WHERE id=?', cropId, uid); this.bump(uid, 'plant'); this.addExp(uid, 2, out);
    return { idx, crop: cropId, cost: cr.seed };
  }
  harvest(uid, idx, out) {
    const P = this.plot(uid, idx); if (!P.u || P.c < 0) throw bad('这里没有作物'); if (P.p < 1) throw conflict('作物还没成熟', 'not_ripe');
    const cr = CROPS[P.c], n = P.y, now = this.now(); let golden = 0;
    if (n > 0) this.addInv(uid, 'c' + P.c, n);
    if (U.rand() < RULES.goldenChance * this.evMult('golden_mult', P.c)) { golden = Math.max(1, Math.round(P.y0 * 0.1)); this.addInv(uid, 'g' + P.c, golden); this.codex(uid, 'g' + P.c, golden); this.db.run('UPDATE users SET golden_total=golden_total+1 WHERE id=?', uid); }
    this.codex(uid, 'c' + P.c, n);
    this.db.run('UPDATE users SET harvest_total=harvest_total+1 WHERE id=?', uid); this.bump(uid, 'harvest');
    const exp = this.addExp(uid, cr.exp, out);
    const res = { idx, crop: P.c, n, golden, exp, stolen: P.stolen, season2: false };
    if (cr.seasons > 1 && P.sea < cr.seasons - 1) { P.sea++; P.p = RULES.season2Start; this.startCycle(P, now); res.season2 = true; }
    else { P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; }
    this.savePlot(uid, P); return res;
  }
  codex(uid, item, n) { this.db.run('INSERT INTO codex (user_id,item,first_at,n) VALUES (?,?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET n=n+excluded.n', uid, item, this.now(), n || 1); }
  care(uid, idx, out) {
    const P = this.plot(uid, idx); const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地很健康', 'healthy');
    P.pr[k] = 0; this.savePlot(uid, P); this.bump(uid, 'care'); this.addExp(uid, 2, out); return { idx, kind: k };
  }
  shovel(uid, idx) {
    const P = this.plot(uid, idx); if (P.c < 0) throw bad('这里没有作物'); if (P.p >= 1) throw conflict('作物已成熟，先收获吧', 'ripe');
    P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; this.savePlot(uid, P); return { idx };
  }
  fert(uid, idx) {
    const P = this.plot(uid, idx); if (P.c < 0 || P.p >= 1) throw bad('只能给生长中的作物施肥');
    this.addInv(uid, 'fert', -1); P.p = Math.min(1, P.p + RULES.fertBoost); if (P.p >= 1) { P.ra = this.now(); P.ev = []; } this.savePlot(uid, P); return { idx };
  }
  expand(uid, idx, out) {
    const u = this.user(uid), owned = this.db.get('SELECT COUNT(*) n FROM plots WHERE user_id=? AND u=1', uid).n;
    if (idx === undefined || idx === null || idx < 0) idx = UNLOCK_ORDER.find(i => !this.db.get('SELECT u FROM plots WHERE user_id=? AND idx=?', uid, i).u);
    if (idx === undefined) throw bad('土地已经全部开垦');
    const P = this.plot(uid, idx); if (P.u) throw conflict('这块地已经开垦了', 'done');
    const need = CFG.plotNeedLv(owned), cost = CFG.plotCost(owned); if (u.lv < need) throw bad(`扩建需要 Lv.${need}`, 'locked');
    this.addGold(uid, -cost, 'expand'); P.u = 1; P.t = this.now(); this.savePlot(uid, P); this.addExp(uid, 10, out); return { idx, cost };
  }
  red(uid, idx, out) {
    const u = this.user(uid); if (u.lv < RULES.redNeedLv) throw bad(`红土地需要 Lv.${RULES.redNeedLv}`, 'locked');
    const P = this.plot(uid, idx); if (!P.u) throw bad('先开垦这块地'); if (P.soil) throw conflict('这块已经是红土地了', 'done');
    const cost = CFG.redCost(this.db.get('SELECT COUNT(*) n FROM plots WHERE user_id=? AND soil=1', uid).n);
    this.addGold(uid, -cost, 'red'); P.soil = 1; this.savePlot(uid, P); this.addExp(uid, 15, out); return { idx, cost };
  }
  batch(uid, fn, list) { const res = [], out = {}; list.forEach(i => { try { res.push(this.db.sp(() => fn(i, out))); } catch (e) { if (!(e instanceof U.ApiError)) throw e; res.push({ idx: i, err: e.message, code: e.code }); } }); return { res, out }; }
  sell(uid, item, n) {
    const c = cropOfItem(item); if (!c) throw bad('只能出售作物'); const have = this.invQty(uid, item); n = Math.min(U.int(n, '数量', 1, 1e9), have); if (n <= 0) throw conflict('没有可以卖的', 'not_enough');
    const g = n * this.unitPrice(item); this.addInv(uid, item, -n); this.addGold(uid, g, 'sell'); this.bump(uid, 'sell', g, 'day'); this.bump(uid, 'sell', 1, 'all'); return { item, n, gold: g };
  }
  sellAll(uid) { let total = 0; const items = []; Object.entries(this.inv(uid)).forEach(([item, q]) => { if (cropOfItem(item) && q > 0) { total += this.sell(uid, item, q).gold; items.push(item); } }); if (!total) throw conflict('仓库里没有作物', 'empty'); return { gold: total, items }; }
  buy(uid, item, n) {
    const it = CFG.SHOP_ITEMS.find(x => x.id === item); if (!it) throw bad('商店没有这个商品'); n = U.int(n, '数量', 1, 99);
    this.addGold(uid, -it.price * n, 'shop:' + item); this.addInv(uid, item, n); return { item, n };
  }
  buyDog(uid) { const u = this.user(uid); if (u.dog_own) throw conflict('已经有小狗了', 'done'); if (u.lv < RULES.dogNeedLv) throw bad(`需要 Lv.${RULES.dogNeedLv}`, 'locked'); this.addGold(uid, -RULES.dogPrice, 'dog'); this.db.run('UPDATE users SET dog_own=1 WHERE id=?', uid); this.addInv(uid, 'dogfood', 1); return {}; }
  feedDog(uid) {
    const u = this.user(uid); if (!u.dog_own) throw bad('还没有小狗'); this.addInv(uid, 'dogfood', -1);
    const now = this.now(); let lv = u.dog_lv, exp = u.dog_exp + 1, up = false; if (lv < 10 && exp >= CFG.dogExpNeed(lv)) { exp -= CFG.dogExpNeed(lv); lv++; up = true; }
    this.db.run('UPDATE users SET dog_until=?, dog_lv=?, dog_exp=? WHERE id=?', Math.max(u.dog_until, now) + RULES.dogFeedMin * 60000, lv, exp, uid); return { lvUp: up ? lv : 0 };
  }
  dogChance(u) { return Math.min(RULES.dogBlockMax, RULES.dogBlockBase + RULES.dogBlockPerLv * (u.dog_lv - 1)); }

  /* ---------- 签到 / 任务 / 成就 ---------- */
  claim(uid, key) { const r = this.db.run('INSERT OR IGNORE INTO claims (user_id,key,at) VALUES (?,?,?)', uid, key, this.now()); if (!r.changes) throw conflict('已经领取过了', 'claimed'); }
  checkin(uid, out) {
    const u = this.user(uid), now = this.now(), today = CFG.dayKey(now), yest = CFG.dayKey(CFG.dayStart(now) - 3600000);
    if (u.checkin_last === today) throw conflict('今天已经签到了', 'claimed'); this.claim(uid, 'checkin:' + today);
    const streak = u.checkin_last === yest ? u.checkin_streak + 1 : 1, n = ((streak - 1) % 7) + 1, g = 100 * n;
    this.db.run('UPDATE users SET checkin_last=?, checkin_streak=? WHERE id=?', today, streak, uid); this.addGold(uid, g, 'checkin');
    // 回归奖励：超过 3 天未登录后签到
    let back = 0; if (u.checkin_last && today > u.checkin_last && now - u.last_active > 3 * 86400000) { back = 500; this.addGold(uid, back, 'comeback'); }
    if (n % 3 === 0) this.addInv(uid, 'fert', 2); if (n === 7) this.addInv(uid, 'dogfood', 2);
    return { day: n, gold: g, streak, back };
  }
  tasks(uid) {
    const day = this.period('day'), wk = this.period('week'), claimed = new Set(this.db.all('SELECT key FROM claims WHERE user_id=?', uid).map(r => r.key));
    return {
      day: CFG.dayKey(this.now()), weekEnd: CFG.weekEnd(this.now()),
      daily: CFG.TASKS.map(t => ({ id: t.id, prog: this.cnt(uid, t.id, day), need: t.need, claimed: claimed.has('task:' + day + ':' + t.id) })),
      weekly: CFG.WEEKLY.map(t => ({ id: t.id, prog: this.cnt(uid, t.stat, wk), need: t.need, claimed: claimed.has('weekly:' + wk + ':' + t.id) })),
      newbie: CFG.NEWBIE.map(t => ({ id: t.id, prog: this.cnt(uid, t.stat, 'all'), need: t.need, claimed: claimed.has('newbie:' + t.id) })),
    };
  }
  claimTask(uid, kind, id, out) {
    let t, key, prog;
    if (kind === 'daily') { t = CFG.TASKS.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'task:' + this.period('day') + ':' + id; prog = this.cnt(uid, t.id, 'day'); }
    else if (kind === 'weekly') { t = CFG.WEEKLY.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'weekly:' + this.period('week') + ':' + id; prog = this.cnt(uid, t.stat, 'week'); }
    else if (kind === 'newbie') { t = CFG.NEWBIE.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'newbie:' + id; prog = this.cnt(uid, t.stat, 'all'); }
    else throw bad('任务类型不对');
    if (prog < t.need) throw conflict('任务还没完成', 'not_done'); this.claim(uid, key);
    this.addGold(uid, t.gold, 'task'); if (t.exp) this.addExp(uid, t.exp, out); return { gold: t.gold, exp: t.exp || 0 };
  }
  achStats(u) { return { harvest_total: u.harvest_total, steal_total: u.steal_total, help_total: u.help_total, golden_total: u.golden_total, order_total: u.order_total, lv: u.lv, checkin_streak: u.checkin_streak, friends: this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', u.id).n, codex: this.db.get('SELECT COUNT(*) n FROM codex WHERE user_id=?', u.id).n }; }
  achievements(uid) { const u = this.user(uid), st = this.achStats(u), claimed = new Set(this.db.all("SELECT key FROM claims WHERE user_id=? AND key LIKE 'ach:%'", uid).map(r => r.key)); return CFG.ACHIEVEMENTS.map(a => ({ id: a.id, prog: st[a.stat], need: a.need, claimed: claimed.has('ach:' + a.id) })); }
  claimAch(uid, id) {
    const a = CFG.ACHIEVEMENTS.find(x => x.id === id); if (!a) throw bad('成就不存在'); const st = this.achStats(this.user(uid)); if (st[a.stat] < a.need) throw conflict('成就还没达成', 'not_done');
    this.claim(uid, 'ach:' + id); this.addGold(uid, a.gold, 'ach');
    CFG.FRAMES.filter(f => f.ach === id).forEach(f => this.db.run('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'frame:' + f.id, this.now()));
    return { gold: a.gold, title: a.title || '' };
  }

  /* ---------- 订单（NPC） ---------- */
  orders(uid) {
    const u = this.user(uid), day = CFG.dayKey(this.now());
    let rows = this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day);
    if (!rows.length) { for (let s = 0; s < 3; s++) this.genOrder(uid, u, day, s); rows = this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day); }
    return { day, refreshLeft: Math.max(0, 3 - this.cnt(uid, 'order_refresh', 'day')), list: rows.map(r => ({ slot: r.slot, item: r.item, qty: r.qty, gold: r.gold, exp: r.exp, done: !!r.done, have: this.invQty(uid, r.item) })) };
  }
  genOrder(uid, u, day, slot) {
    const pool = CROPS.filter(c => c.lv <= Math.max(1, u.lv)); const cr = pool[U.randInt(Math.max(0, pool.length - 6), pool.length - 1)];
    const qty = Math.max(5, Math.round(cr.yield * (0.5 + U.rand() * 1.0))), gold = Math.round(qty * cr.price * (1.5 + U.rand() * 0.4)), exp = Math.round(cr.exp * qty / cr.yield * 0.8) + 10;
    this.db.run('INSERT OR REPLACE INTO orders (user_id,day,slot,item,qty,gold,exp,done) VALUES (?,?,?,?,?,?,?,0)', uid, day, slot, 'c' + cr.id, qty, gold, exp);
  }
  deliver(uid, slot, out) {
    const day = CFG.dayKey(this.now()); const o = this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot); if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    this.addInv(uid, o.item, -o.qty); this.db.run('UPDATE orders SET done=1 WHERE user_id=? AND day=? AND slot=?', uid, day, slot);
    this.addGold(uid, o.gold, 'order'); this.addExp(uid, o.exp, out); this.db.run('UPDATE users SET order_total=order_total+1 WHERE id=?', uid); this.bump(uid, 'order'); this.metric('orders_done'); return { gold: o.gold, exp: o.exp };
  }
  refreshOrder(uid, slot) {
    const day = CFG.dayKey(this.now()); const o = this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot); if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    if (this.cnt(uid, 'order_refresh', 'day') >= 3) throw conflict('今天的刷新次数用完了', 'limit'); this.addGold(uid, -50, 'order_refresh'); this.bump(uid, 'order_refresh', 1, 'day'); this.genOrder(uid, this.user(uid), day, slot); return {};
  }

  /* ---------- 好友 ---------- */
  findUser(q) { q = String(q || '').trim(); if (!q) throw bad('请输入玩家号或昵称'); if (/^\d{7}$/.test(q)) return this.db.all('SELECT * FROM users WHERE code=? AND banned=0', q); return this.db.all("SELECT * FROM users WHERE name LIKE ? ESCAPE '\\' AND banned=0 ORDER BY last_active DESC LIMIT 20", '%' + q.replace(/[%_\\]/g, '\\$&') + '%'); }
  search(uid, q) { return this.findUser(q).filter(u => u.id !== uid).map(u => Object.assign(this.publicUser(u), { friend: this.isFriend(uid, u.id), pending: !!this.db.get('SELECT 1 FROM friend_requests WHERE src=? AND dst=?', uid, u.id) })); }
  makeFriends(a, b) {
    if (a === b) throw bad('不能加自己为好友'); if (this.isFriend(a, b)) return false;
    const lim = n => this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', n).n >= 200; if (lim(a) || lim(b)) throw conflict('好友数量已达上限 200', 'limit');
    const now = this.now(); this.db.run('INSERT OR IGNORE INTO friends (a,b,since) VALUES (?,?,?),(?,?,?)', a, b, now, b, a, now);
    this.db.run('DELETE FROM friend_requests WHERE (src=? AND dst=?) OR (src=? AND dst=?)', a, b, b, a);
    this.bump(a, 'friend', 1, 'all'); this.bump(b, 'friend', 1, 'all'); this.metric('friend_adds');
    this.msg(a, 'friend_ok', b, {}); this.msg(b, 'friend_ok', a, {}); return true;
  }
  requestFriend(uid, targetId) {
    const t = this.user(targetId); if (t.id === uid) throw bad('不能加自己为好友'); if (this.isFriend(uid, t.id)) throw conflict('你们已经是好友了', 'done');
    if (this.db.get('SELECT 1 FROM blocks WHERE user_id=? AND blocked=?', t.id, uid)) throw forbid('对方不接受你的申请');
    if (this.db.get('SELECT 1 FROM friend_requests WHERE src=? AND dst=?', t.id, uid)) { this.makeFriends(uid, t.id); return { friend: true }; }
    if (this.db.get('SELECT COUNT(*) n FROM friend_requests WHERE src=? AND at>?', uid, this.now() - 86400000).n >= 30) throw conflict('今天发送的好友申请太多了', 'limit');
    this.db.run('INSERT OR IGNORE INTO friend_requests (src,dst,at) VALUES (?,?,?)', uid, t.id, this.now()); return { friend: false };
  }
  // 邀请链接：链接的主人分享即表示同意，点开的人确认后直接互为好友
  acceptInvite(uid, code) { const t = this.db.get('SELECT * FROM users WHERE code=? AND banned=0', String(code || '')); if (!t) throw notFound('邀请链接无效'); if (t.id === uid) return { self: true }; const added = this.makeFriends(uid, t.id); return { friend: this.publicUser(t), added }; }
  respondRequest(uid, src, accept) { const r = this.db.get('SELECT * FROM friend_requests WHERE src=? AND dst=?', src, uid); if (!r) throw notFound('申请不存在或已处理'); if (accept) this.makeFriends(uid, src); else this.db.run('DELETE FROM friend_requests WHERE src=? AND dst=?', src, uid); return {}; }
  removeFriend(uid, fid) { this.db.run('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)', uid, fid, fid, uid); return {}; }
  block(uid, fid, on) { if (on) { this.removeFriend(uid, fid); this.db.run('INSERT OR IGNORE INTO blocks (user_id,blocked) VALUES (?,?)', uid, fid); this.db.run('DELETE FROM friend_requests WHERE src=? AND dst=?', fid, uid); } else this.db.run('DELETE FROM blocks WHERE user_id=? AND blocked=?', uid, fid); return {}; }
  myStealsMap(thief, owner) { const m = {}; this.db.all('SELECT idx,cycle,blocked FROM steals WHERE thief=? AND owner=? AND at>?', thief, owner, this.now() - 7 * 86400000).forEach(r => m[r.idx + ':' + r.cycle] = r.blocked ? 2 : 1); return m; }
  farmView(uid, owner) {
    const o = this.user(owner), now = this.now(), mine = this.myStealsMap(uid, owner), cap = CFG.stealCapPct(o.lv);
    let steal = 0, help = 0, soon = 0;
    const plots = this.plots(owner).map(P => {
      const v = this.pubPlot(P);
      if (P.u && P.c >= 0) {
        const taken = mine[P.idx + ':' + P.cycle];
        v.mine = taken || 0; v.left = Math.max(0, Math.floor(P.y0 * cap) - P.stolen);
        v.canSteal = P.p >= 1 && !taken && v.left > 0 && now >= P.ra + RULES.stealDelaySec * 1000; v.protectUntil = P.p >= 1 ? P.ra + RULES.stealDelaySec * 1000 : 0;
        if (v.canSteal) steal++; if (P.pr.d || P.pr.w || P.pr.b) help++; if (P.p < 1 && CFG.remainSec(P) < 600) soon++;
      }
      return v;
    });
    return { owner: Object.assign(this.publicUser(o), { dog: !!(o.dog_own && o.dog_until > now), dogLv: o.dog_lv }), plots, steal, help, soon };
  }
  friends(uid) {
    const now = this.now();
    const list = this.db.all('SELECT u.*, f.since FROM friends f JOIN users u ON u.id=f.b WHERE f.a=? ORDER BY u.last_active DESC', uid).map(u => {
      const v = this.farmView(uid, u.id); return Object.assign(this.publicUser(u), { steal: v.steal, help: v.help, soon: v.soon, online: now - u.last_active < 120000, last: u.last_active, since: u.since });
    });
    const requests = this.db.all('SELECT u.*, r.at FROM friend_requests r JOIN users u ON u.id=r.src WHERE r.dst=? ORDER BY r.at DESC', uid).map(u => Object.assign(this.publicUser(u), { at: u.at }));
    const sent = this.db.all('SELECT u.*, r.at FROM friend_requests r JOIN users u ON u.id=r.dst WHERE r.src=? ORDER BY r.at DESC', uid).map(u => Object.assign(this.publicUser(u), { at: u.at }));
    const visitors = this.db.all('SELECT u.*, v.at FROM visits v JOIN users u ON u.id=v.visitor WHERE v.owner=? ORDER BY v.at DESC LIMIT 10', uid).map(u => Object.assign(this.publicUser(u), { at: u.at }));
    return { list, requests, sent, visitors };
  }
  visit(uid, owner) {
    if (!this.isFriend(uid, owner)) throw forbid('只能访问好友的农场');
    const now = this.now(), prev = this.db.get('SELECT at FROM visits WHERE owner=? AND visitor=?', owner, uid);
    this.db.run('INSERT INTO visits (owner,visitor,at) VALUES (?,?,?) ON CONFLICT(owner,visitor) DO UPDATE SET at=excluded.at', owner, uid, now);
    if (!prev || now - prev.at > 3600000) this.msg(owner, 'visit', uid, {});
    this.bump(uid, 'visit', 1, 'all');
    return this.farmView(uid, owner);
  }
  steal(uid, owner, idx, out) {
    if (!this.isFriend(uid, owner)) throw forbid('只能摘好友的果实');
    if (this.cnt(uid, 'steal_n', 'day') >= RULES.stealDailyLimit) throw conflict(`今天已经摘了 ${RULES.stealDailyLimit} 次，明天再来吧`, 'limit');
    const o = this.user(owner), P = this.plot(owner, idx), now = this.now();
    if (!P.u || P.c < 0 || P.p < 1) throw conflict('这块地没有成熟的果实', 'not_ripe');
    if (now < P.ra + RULES.stealDelaySec * 1000) throw conflict(`刚成熟，主人保护中，${Math.ceil((P.ra + RULES.stealDelaySec * 1000 - now) / 1000)} 秒后才能摘`, 'protected');
    if (this.db.get('SELECT 1 FROM steals WHERE owner=? AND idx=? AND cycle=? AND thief=?', owner, idx, P.cycle, uid)) throw conflict('这块地你已经摘过了', 'done');
    const cap = Math.floor(P.y0 * CFG.stealCapPct(o.lv)), left = Math.min(cap - P.stolen, P.y - 1);
    if (left <= 0) throw conflict('已经被摘得差不多了，给主人留点吧', 'empty');
    const cr = CROPS[P.c];
    if (o.dog_own && o.dog_until > now && U.rand() < this.dogChance(o)) {
      const me = this.user(uid), bite = Math.min(me.gold, U.randInt(RULES.dogBiteMin, RULES.dogBiteMax));
      if (bite > 0) this.addGold(uid, -bite, 'dog_bite');
      this.db.run('INSERT INTO steals (owner,thief,idx,cycle,crop,qty,blocked,at) VALUES (?,?,?,?,?,0,1,?)', owner, uid, idx, P.cycle, P.c, now);
      this.msg(owner, 'dog', uid, { crop: P.c, n: 1 }, true); return { idx, blocked: true, bite, crop: P.c };
    }
    const qty = clampN(Math.round(P.y0 * (RULES.stealPctMin + U.rand() * (RULES.stealPctMax - RULES.stealPctMin))), 1, left);
    P.y -= qty; P.stolen += qty; this.savePlot(owner, P);
    this.db.run('INSERT INTO steals (owner,thief,idx,cycle,crop,qty,blocked,at) VALUES (?,?,?,?,?,?,0,?)', owner, uid, idx, P.cycle, P.c, qty, now);
    this.addInv(uid, 'c' + P.c, qty);
    this.db.run('UPDATE users SET steal_total=steal_total+1 WHERE id=?', uid); this.db.run('UPDATE users SET stolen_from_total=stolen_from_total+? WHERE id=?', qty, owner);
    this.bump(uid, 'steal'); this.bump(uid, 'steal_n', 1, 'day'); this.bump(uid, 'social', 1, 'all'); this.addExp(uid, RULES.stealExp, out); this.metric('steals');
    this.msg(owner, 'stolen', uid, { qty, items: { ['c' + P.c]: qty } }, true);
    return { idx, qty, crop: P.c, left: P.y };
  }
  help(uid, owner, idx, out) {
    if (!this.isFriend(uid, owner)) throw forbid('只能帮好友打理');
    if (this.cnt(uid, 'help_n', 'day') >= RULES.helpDailyLimit) throw conflict(`今天已经帮忙 ${RULES.helpDailyLimit} 次了，休息一下吧`, 'limit');
    const P = this.plot(owner, idx); const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地不需要帮忙', 'healthy');
    P.pr[k] = 0; this.savePlot(owner, P); const now = this.now();
    this.db.run('INSERT OR IGNORE INTO helps (owner,helper,idx,cycle,kind,at) VALUES (?,?,?,?,?,?)', owner, uid, idx, P.cycle, k, now);
    this.addGold(uid, RULES.helpGold, 'help'); this.addExp(uid, RULES.helpExp, out);
    this.db.run('UPDATE users SET help_total=help_total+1 WHERE id=?', uid); this.bump(uid, 'help'); this.bump(uid, 'help_n', 1, 'day'); this.bump(uid, 'social', 1, 'all');
    this.msg(owner, 'helped', uid, { kinds: k }, true); return { idx, kind: k };
  }
  guestbook(uid, owner) { if (uid !== owner && !this.isFriend(uid, owner)) throw forbid('只能查看好友的留言板'); return this.db.all('SELECT g.id,g.phrase,g.at,g.author,u.name,u.avatar FROM guestbook g LEFT JOIN users u ON u.id=g.author WHERE g.owner=? AND g.hidden=0 ORDER BY g.id DESC LIMIT 30', owner).map(r => ({ id: r.id, phrase: r.phrase, at: r.at, author: r.author, name: r.name || '已注销玩家', avatar: J(r.avatar) || {} })); }
  postGuestbook(uid, owner, phrase) {
    if (!this.isFriend(uid, owner)) throw forbid('只能给好友留言'); phrase = U.int(phrase, '留言', 0, CFG.PHRASES.length - 1);
    if (this.cnt(uid, 'gb', 'day') >= RULES.gbDailyLimit) throw conflict('今天留言太多了', 'limit');
    this.db.run('INSERT INTO guestbook (owner,author,phrase,at) VALUES (?,?,?,?)', owner, uid, phrase, this.now()); this.bump(uid, 'gb', 1, 'day'); this.msg(owner, 'gb', uid, { phrase }); return {};
  }
  hideGuestbook(uid, id) { const r = this.db.run('UPDATE guestbook SET hidden=1 WHERE id=? AND owner=?', id, uid); if (!r.changes) throw notFound('留言不存在'); return {}; }
  messages(uid) {
    const rows = this.db.all('SELECT m.*, u.name AS aname, u.avatar AS aav, u.code AS acode FROM messages m LEFT JOIN users u ON u.id=m.actor WHERE m.user_id=? ORDER BY m.id DESC LIMIT 100', uid)
      .map(r => ({ id: r.id, kind: r.kind, actor: r.actor, name: r.actor ? (r.aname || '已注销玩家') : (r.kind === 'system' ? '系统' : '已注销玩家'), avatar: J(r.aav) || {}, friend: r.actor ? this.isFriend(uid, r.actor) : false, data: J(r.data) || {}, at: r.at, read: !!r.read }));
    return rows;
  }
  readMessages(uid) { this.db.run('UPDATE messages SET read=1 WHERE user_id=? AND read=0', uid); return {}; }

  /* ---------- 集市（玩家交易） ---------- */
  expireListings() {
    const now = this.now(); this.db.all("SELECT * FROM market WHERE status='open' AND expires_at<=?", now).forEach(m => {
      this.db.run("UPDATE market SET status='expired', done_at=? WHERE id=? AND status='open'", now, m.id); this.addInv(m.seller, m.item, m.qty); this.msg(m.seller, 'market_expired', null, { item: m.item, qty: m.qty });
    });
  }
  priceBand(item) { const c = cropOfItem(item), base = CROPS[c.id].price * (c.golden ? RULES.goldenPriceMult : 1); return { min: Math.max(1, Math.floor(base * RULES.marketMinMult)), max: Math.ceil(base * RULES.marketMaxMult), base }; }
  market(uid, item) {
    this.expireListings();
    const q = item ? this.db.all("SELECT m.*, u.name, u.code FROM market m JOIN users u ON u.id=m.seller WHERE m.status='open' AND m.item=? AND m.seller<>? ORDER BY m.price, m.id LIMIT 60", item, uid)
      : this.db.all("SELECT m.*, u.name, u.code FROM market m JOIN users u ON u.id=m.seller WHERE m.status='open' AND m.seller<>? ORDER BY m.created_at DESC LIMIT 60", uid);
    const mine = this.db.all("SELECT * FROM market WHERE seller=? AND (status='open' OR done_at>?) ORDER BY id DESC LIMIT 30", uid, this.now() - 3 * 86400000);
    const fr = new Set(this.db.all('SELECT b FROM friends WHERE a=?', uid).map(r => r.b));
    return { list: q.map(m => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, seller: { id: m.seller, name: m.name, code: m.code, friend: fr.has(m.seller) }, expires: m.expires_at })), mine: mine.map(m => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, status: m.status, expires: m.expires_at })) };
  }
  listItem(uid, item, qty, price) {
    if (!cropOfItem(item)) throw bad('只能上架作物'); qty = U.int(qty, '数量', 1, 9999); price = U.int(price, '单价', 1, 1e7);
    const b = this.priceBand(item); if (price < b.min || price > b.max) throw bad(`单价需在 ${b.min}–${b.max} 之间`);
    this.expireListings();
    if (this.db.get("SELECT COUNT(*) n FROM market WHERE seller=? AND status='open'", uid).n >= RULES.marketMaxListings) throw conflict(`最多同时上架 ${RULES.marketMaxListings} 件`, 'limit');
    this.addInv(uid, item, -qty); const now = this.now();
    const r = this.db.run('INSERT INTO market (seller,item,qty,price,created_at,expires_at) VALUES (?,?,?,?,?,?)', uid, item, qty, price, now, now + RULES.marketTtlHours * 3600000);
    return { id: Number(r.lastInsertRowid) };
  }
  cancelListing(uid, id) { const m = this.db.get("SELECT * FROM market WHERE id=? AND seller=? AND status='open'", id, uid); if (!m) throw notFound('挂单不存在或已成交'); this.db.run("UPDATE market SET status='cancelled', done_at=? WHERE id=?", this.now(), id); this.addInv(uid, m.item, m.qty); return { item: m.item, qty: m.qty }; }
  buyListing(uid, id, out) {
    this.expireListings();
    const m = this.db.get("SELECT * FROM market WHERE id=? AND status='open'", id); if (!m) throw conflict('这件商品已经被买走或下架了', 'gone'); if (m.seller === uid) throw bad('不能买自己的商品');
    const total = m.qty * m.price, fee = Math.ceil(total * RULES.marketFee);
    this.addGold(uid, -total, 'market_buy'); const r = this.db.run("UPDATE market SET status='sold', buyer=?, done_at=? WHERE id=? AND status='open'", uid, this.now(), id); if (!r.changes) throw conflict('这件商品已经被买走了', 'gone');
    this.addInv(uid, m.item, m.qty); this.addGold(m.seller, total - fee, 'market_sell');
    this.bump(uid, 'trade'); this.bump(m.seller, 'trade'); this.metric('market_sales'); this.metric('market_gold', total);
    this.msg(m.seller, 'market_sold', uid, { item: m.item, qty: m.qty, gold: total - fee });
    return { item: m.item, qty: m.qty, total, fee };
  }

  /* ---------- 排行榜 / 赛季 ---------- */
  leaderboard(uid, dim, scope) {
    const wk = this.period('week'); const dims = { lv: null, gold: null, harvest: 'harvest', steal: 'steal', help: 'help', season: 'sp' };
    if (!(dim in dims)) throw bad('排行榜类型不对');
    const ids = scope === 'friends' ? [uid].concat(this.db.all('SELECT b FROM friends WHERE a=?', uid).map(r => r.b)) : null;
    const filt = ids ? ` AND u.id IN (${ids.map(() => '?').join(',')})` : '';
    let rows;
    if (dim === 'lv') rows = this.db.all(`SELECT u.*, (u.lv*100000000+u.exp) AS score FROM users u WHERE u.banned=0${filt} ORDER BY score DESC LIMIT 50`, ...(ids || []));
    else if (dim === 'gold') rows = this.db.all(`SELECT u.*, u.gold AS score FROM users u WHERE u.banned=0${filt} ORDER BY score DESC LIMIT 50`, ...(ids || []));
    else rows = this.db.all(`SELECT u.*, c.val AS score FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0${filt} ORDER BY score DESC, u.id LIMIT 50`, wk, dims[dim], ...(ids || []));
    const list = rows.map((u, i) => Object.assign(this.publicUser(u), { rank: i + 1, score: dim === 'lv' ? u.lv : u.score }));
    let mine = list.find(r => r.id === uid);
    if (!mine && !ids) {
      const u = this.user(uid); let score, above;
      if (dim === 'lv') { score = u.lv; above = this.db.get('SELECT COUNT(*) n FROM users WHERE banned=0 AND (lv*100000000+exp) > ?', u.lv * 1e8 + u.exp).n; }
      else if (dim === 'gold') { score = u.gold; above = this.db.get('SELECT COUNT(*) n FROM users WHERE banned=0 AND gold > ?', u.gold).n; }
      else { score = this.cnt(uid, dims[dim], wk); above = this.db.get('SELECT COUNT(*) n FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0 AND c.val > ?', wk, dims[dim], score).n; }
      mine = Object.assign(this.publicUser(u), { rank: above + 1, score });
    }
    return { dim, scope, week: wk, weekEnd: CFG.weekEnd(this.now()), list, mine };
  }
  seasonReward(rank, pts) { if (pts < 100) return 0; return rank === 1 ? 5000 : rank <= 3 ? 3000 : rank <= 10 ? 1500 : rank <= 50 ? 800 : 300; }
  season(uid) {
    const now = this.now(), wk = CFG.weekKey(now), last = CFG.weekKey(now - 7 * 86400000);
    const pts = this.cnt(uid, 'sp', wk), lastPts = this.cnt(uid, 'sp', last);
    const lastRank = lastPts ? this.db.get('SELECT COUNT(*) n FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0 AND c.val > ?', last, 'sp', lastPts).n + 1 : 0;
    const claimed = !!this.db.get('SELECT 1 FROM claims WHERE user_id=? AND key=?', uid, 'season:' + last);
    return { week: wk, end: CFG.weekEnd(now), pts, last: { week: last, pts: lastPts, rank: lastRank, reward: this.seasonReward(lastRank, lastPts), claimed }, tiers: [[1, 5000], [3, 3000], [10, 1500], [50, 800], [Infinity, 300]] };
  }
  claimSeason(uid) { const s = this.season(uid); if (!s.last.reward) throw conflict('上赛季积分不足 100，没有奖励', 'not_done'); this.claim(uid, 'season:' + s.last.week); this.addGold(uid, s.last.reward, 'season'); return { gold: s.last.reward, rank: s.last.rank }; }

  /* ---------- 图鉴 / 装扮 / 资料 ---------- */
  codexList(uid) { return this.db.all('SELECT item,first_at,n FROM codex WHERE user_id=?', uid); }
  cosmetics(uid) { return this.db.all('SELECT item FROM cosmetics WHERE user_id=?', uid).map(r => r.item); }
  buyCosmetic(uid, kind, id) {
    const list = kind === 'theme' ? CFG.THEMES : kind === 'frame' ? CFG.FRAMES : null; if (!list) throw bad('类型不对'); const it = list.find(x => x.id === id); if (!it) throw bad('不存在');
    if (this.db.get('SELECT 1 FROM cosmetics WHERE user_id=? AND item=?', uid, kind + ':' + id)) throw conflict('已经拥有了', 'done');
    if (it.ach) throw bad('需要完成成就解锁'); this.addGold(uid, -it.price, 'cosmetic'); this.db.run('INSERT INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, kind + ':' + id, this.now()); return {};
  }
  updateProfile(uid, b) {
    const sets = [], args = [];
    if (b.name !== undefined) { sets.push('name=?'); args.push(U.cleanName(b.name)); }
    if (b.avatar !== undefined) { const A = CFG.AVATAR_OPTS, a = b.avatar || {}; const av = { skin: U.int(a.skin || 0, '肤色', 0, A.skin.length - 1), hair: U.int(a.hair || 0, '发色', 0, A.hair.length - 1), hat: a.hat ? 1 : 0, fringe: a.fringe ? 1 : 0, pig: a.pig ? 1 : 0, band: U.int(a.band || 0, '帽带', 0, A.band.length - 1), shirt: U.int(a.shirt || 0, '衣服', 0, A.shirt.length - 1), bg: U.int(a.bg || 0, '背景', 0, A.bg.length - 1) }; sets.push('avatar=?'); args.push(JSON.stringify(av)); }
    const own = new Set(this.cosmetics(uid));
    if (b.theme !== undefined) { if (!own.has('theme:' + b.theme)) throw bad('还没有这个主题'); sets.push('theme=?'); args.push(b.theme); }
    if (b.frame !== undefined) { if (!own.has('frame:' + b.frame)) throw bad('还没有这个头像框'); sets.push('frame=?'); args.push(b.frame); }
    if (b.title !== undefined) { if (b.title) { const a = CFG.ACHIEVEMENTS.find(x => x.title === b.title); if (!a || !this.db.get('SELECT 1 FROM claims WHERE user_id=? AND key=?', uid, 'ach:' + a.id)) throw bad('还没有获得这个称号'); } sets.push('title=?'); args.push(b.title || ''); }
    if (b.seed !== undefined) { const c = U.int(b.seed, '种子', 0, CROPS.length - 1); sets.push('seed=?'); args.push(c); }
    if (b.settings !== undefined) { const s = b.settings || {}; const clean = { sound: !!s.sound, music: !!s.music, notify: !!s.notify, tod: ['auto', 'day', 'dusk', 'night'].includes(s.tod) ? s.tod : 'auto', tut: U.int(s.tut || 0, '引导', 0, 99) }; sets.push('settings=?'); args.push(JSON.stringify(clean)); }
    if (sets.length) this.db.run(`UPDATE users SET ${sets.join(',')} WHERE id=?`, ...args, uid); return {};
  }
}

module.exports = { Game, cropOfItem, itemName };
