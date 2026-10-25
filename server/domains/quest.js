'use strict';
/* 丰收农场 · 服务端玩法模块：签到、每日 / 每周任务、成就、订单
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  claim(uid, key) { this.db.wx(conflict('已经领取过了', 'claimed'), 'INSERT INTO claims (user_id,key,at) VALUES (?,?,?)', uid, key, this.now()); },
  async checkin(uid, out) {
    const u = await this.user(uid), now = this.now(), today = CFG.dayKey(now), yest = CFG.dayKey(CFG.dayStart(now) - 3600000);
    if (u.checkin_last === today) throw conflict('今天已经签到了', 'claimed'); this.claim(uid, 'checkin:' + today);
    const streak = u.checkin_last === yest ? u.checkin_streak + 1 : 1, n = ((streak - 1) % 7) + 1, g = 100 * n;
    this.db.w('UPDATE users SET checkin_last=?, checkin_streak=? WHERE id=?', today, streak, uid); this.pu(uid, x => { x.checkin_last = today; x.checkin_streak = streak; }); this.addGold(uid, g, 'checkin');
    // 回归奖励：超过 3 天未登录后签到
    let back = 0; if (u.checkin_last && today > u.checkin_last && now - u.last_active > 3 * 86400000) { back = 500; this.addGold(uid, back, 'comeback'); }
    if (n % 3 === 0) this.addInv(uid, 'fert', 2); if (n === 7) this.addInv(uid, 'dogfood', 2);
    return { day: n, gold: g, streak, back };
  },
  async tasks(uid) {
    const day = this.period('day'), wk = this.period('week');
    const [rows, C] = await all([this.db.all('SELECT key FROM claims WHERE user_id=?', uid), this.counters(uid)]); const claimed = new Set(rows.map(r => r.key));
    return {
      day: CFG.dayKey(this.now()), weekEnd: CFG.weekEnd(this.now()),
      daily: CFG.TASKS.map(t => ({ id: t.id, prog: C(t.id, day), need: t.need, claimed: claimed.has('task:' + day + ':' + t.id) })),
      weekly: CFG.WEEKLY.map(t => ({ id: t.id, prog: C(t.stat, wk), need: t.need, claimed: claimed.has('weekly:' + wk + ':' + t.id) })),
      newbie: CFG.NEWBIE.map(t => ({ id: t.id, prog: C(t.stat, 'all'), need: t.need, claimed: claimed.has('newbie:' + t.id) })),
    };
  },
  async claimTask(uid, kind, id, out) {
    let t, key, prog;
    if (kind === 'daily') { t = CFG.TASKS.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'task:' + this.period('day') + ':' + id; prog = await this.cnt(uid, t.id, 'day'); }
    else if (kind === 'weekly') { t = CFG.WEEKLY.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'weekly:' + this.period('week') + ':' + id; prog = await this.cnt(uid, t.stat, 'week'); }
    else if (kind === 'newbie') { t = CFG.NEWBIE.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'newbie:' + id; prog = await this.cnt(uid, t.stat, 'all'); }
    else throw bad('任务类型不对');
    if (prog < t.need) throw conflict('任务还没完成', 'not_done'); this.claim(uid, key);
    this.addGold(uid, t.gold, 'task'); if (t.exp) await this.addExp(uid, t.exp, out); return { gold: t.gold, exp: t.exp || 0 };
  },
  async achCounts(uid) { const [f, c] = await all([this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', uid), this.db.get('SELECT COUNT(*) n FROM codex WHERE user_id=?', uid)]); return { friends: f.n, codex: c.n }; },
  achStatsOf(u, k) { return { harvest_total: u.harvest_total, steal_total: u.steal_total, help_total: u.help_total, golden_total: u.golden_total, order_total: u.order_total, lv: u.lv, checkin_streak: u.checkin_streak, friends: k.friends, codex: k.codex }; },
  async achStats(u) { return this.achStatsOf(u, await this.achCounts(u.id)); },
  async achievements(uid) { const [u, rows] = await all([this.user(uid), this.db.all("SELECT key FROM claims WHERE user_id=? AND key LIKE 'ach:%'", uid)]); const st = await this.achStats(u), claimed = new Set(rows.map(r => r.key)); return CFG.ACHIEVEMENTS.map(a => ({ id: a.id, prog: st[a.stat], need: a.need, claimed: claimed.has('ach:' + a.id) })); },
  async claimAch(uid, id) {
    const a = CFG.ACHIEVEMENTS.find(x => x.id === id); if (!a) throw bad('成就不存在'); const st = await this.achStats(await this.user(uid)); if (st[a.stat] < a.need) throw conflict('成就还没达成', 'not_done');
    this.claim(uid, 'ach:' + id); this.addGold(uid, a.gold, 'ach');
    CFG.FRAMES.filter(f => f.ach === id).forEach(f => this.db.w('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'frame:' + f.id, this.now()));
    return { gold: a.gold, title: a.title || '' };
  },

  /* ---------- 订单（NPC） ---------- */
  async orders(uid) {
    const day = CFG.dayKey(this.now());
    let [u, rows, inv, refreshed] = await all([this.user(uid), this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day), this.inv(uid), this.cnt(uid, 'order_refresh', 'day')]);
    // 订单位随等级增加（Lv.10/20/30 各多一个）：缺哪个补哪个，升级当天也能马上拿到新订单
    const slots = CFG.orderSlots(u.lv), have = new Set(rows.map(r => r.slot)); let added = false;
    for (let s = 0; s < slots; s++) if (!have.has(s)) { this.genOrder(uid, u, day, s); added = true; }
    if (added) rows = await this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day);
    return { day, slots, refreshLeft: Math.max(0, RULES.orderRefresh - refreshed), refreshCost: RULES.orderRefreshCost, list: rows.map(r => ({ slot: r.slot, item: r.item, qty: r.qty, gold: r.gold, exp: r.exp, done: !!r.done, have: inv[r.item] || 0 })) };
  },
  genOrder(uid, u, day, slot) {
    const pool = CROPS.filter(c => c.lv <= Math.max(1, u.lv)); const cr = pool[U.randInt(Math.max(0, pool.length - 6), pool.length - 1)];
    const qty = Math.max(5, Math.round(cr.yield * (0.5 + U.rand() * 1.0))), gold = Math.round(qty * cr.price * (1.5 + U.rand() * 0.4)), exp = Math.round(cr.exp * qty / cr.yield * 0.8) + 10;
    this.db.w('INSERT OR REPLACE INTO orders (user_id,day,slot,item,qty,gold,exp,done) VALUES (?,?,?,?,?,?,?,0)', uid, day, slot, 'c' + cr.id, qty, gold, exp);
  },
  async deliver(uid, slot, out) {
    const day = CFG.dayKey(this.now()); const o = await this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot); if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    this.addInv(uid, o.item, -o.qty); this.db.w('UPDATE orders SET done=1 WHERE user_id=? AND day=? AND slot=?', uid, day, slot);
    this.addGold(uid, o.gold, 'order'); await this.addExp(uid, o.exp, out); this.db.w('UPDATE users SET order_total=order_total+1 WHERE id=?', uid); this.pu(uid, x => x.order_total++); this.bump(uid, 'order'); this.metric('orders_done'); return { gold: o.gold, exp: o.exp };
  },
  async refreshOrder(uid, slot) {
    const day = CFG.dayKey(this.now());
    const [o, n, u] = await all([this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot), this.cnt(uid, 'order_refresh', 'day'), this.user(uid)]);
    if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    if (n >= RULES.orderRefresh) throw conflict('今天的刷新次数用完了', 'limit'); this.addGold(uid, -RULES.orderRefreshCost, 'order_refresh'); this.bump(uid, 'order_refresh', 1, 'day'); this.genOrder(uid, u, day, slot); return {};
  },

  /* ---------- 好友 ---------- */
};
