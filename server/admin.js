'use strict';
/* 运营后台：指标、玩家管理、活动与数值配置、审计 */
const CFG = require('../shared/config');
const U = require('./util');
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };

class Admin {
  constructor(game) { this.g = game; this.db = game.db; }
  audit(adminId, action, target, data) { this.db.run('INSERT INTO audit (admin_id,action,target,data,at) VALUES (?,?,?,?,?)', adminId, action, String(target || ''), JSON.stringify(data || {}), this.g.now()); }

  stats() {
    const db = this.db, now = this.g.now(), days = [];
    for (let i = 13; i >= 0; i--) days.push(CFG.dayKey(now - i * 86400000));
    const m = (d, k) => (db.get('SELECT val FROM metrics WHERE day=? AND key=?', d, k) || { val: 0 }).val;
    const series = days.map(d => ({ day: d, dau: db.get('SELECT COUNT(*) n FROM logins WHERE day=?', d).n, reg: m(d, 'registrations'), steals: m(d, 'steals'), orders: m(d, 'orders_done'), sales: m(d, 'market_sales'), calls: m(d, 'api_calls'), errors: m(d, 'api_errors'), ms: m(d, 'api_ms'), loadN: m(d, 'load_n'), loadMs: m(d, 'load_ms'), friendAdds: m(d, 'friend_adds') }));
    // 次留 / 七留：按注册日 cohort
    const ret = (gap) => { let base = 0, kept = 0; for (let i = gap + 1; i <= gap + 7; i++) { const d0 = CFG.dayKey(now - i * 86400000), d1 = CFG.dayKey(now - (i - gap) * 86400000); const ids = db.all("SELECT id FROM users WHERE role<>'npc' AND created_at>=? AND created_at<?", CFG.dayStart(now - i * 86400000), CFG.dayStart(now - i * 86400000) + 86400000); base += ids.length; ids.forEach(r => { if (db.get('SELECT 1 FROM logins WHERE user_id=? AND day=?', r.id, d1)) kept++; }); void d0; } return base ? kept / base : null; };
    const total = db.get("SELECT COUNT(*) n FROM users WHERE role<>'npc'").n, withFriend = db.get("SELECT COUNT(DISTINCT f.a) n FROM friends f JOIN users u ON u.id=f.a WHERE u.role<>'npc'").n;
    const wau = db.get('SELECT COUNT(DISTINCT user_id) n FROM logins WHERE day>=?', days[7]).n, thieves = db.get("SELECT COUNT(DISTINCT s.thief) n FROM steals s JOIN users u ON u.id=s.thief WHERE s.at>? AND s.blocked=0 AND u.role<>'npc'", now - 7 * 86400000).n;
    const ordersGen = db.get('SELECT COUNT(*) n FROM orders WHERE day>=?', days[7]).n, ordersDone = db.get('SELECT COUNT(*) n FROM orders WHERE day>=? AND done=1', days[7]).n;
    const t = series[series.length - 1];
    return {
      now, totals: { users: total, npcs: db.get("SELECT COUNT(*) n FROM users WHERE role='npc'").n, bound: db.get('SELECT COUNT(*) n FROM users WHERE username IS NOT NULL').n, banned: db.get('SELECT COUNT(*) n FROM users WHERE banned=1').n, gold: db.get("SELECT COALESCE(SUM(gold),0) n FROM users WHERE role<>'npc'").n, openListings: db.get("SELECT COUNT(*) n FROM market WHERE status='open'").n },
      today: { dau: t.dau, reg: t.reg, errorRate: t.calls ? t.errors / t.calls : 0, avgMs: t.calls ? t.ms / t.calls : 0, avgLoadMs: t.loadN ? t.loadMs / t.loadN : 0 },
      rates: { d1: ret(1), d7: ret(7), friendRate: total ? withFriend / total : 0, stealRate: wau ? thieves / wau : 0, orderRate: ordersGen ? ordersDone / ordersGen : 0 },
      series,
    };
  }
  players(q) {
    q = String(q || '').trim();
    const rows = q ? this.db.all("SELECT * FROM users WHERE code=? OR username=? OR name LIKE ? ORDER BY last_active DESC LIMIT 50", q, q, '%' + q + '%') : this.db.all('SELECT * FROM users ORDER BY last_active DESC LIMIT 50');
    return rows.map(u => ({ id: u.id, code: u.code, name: u.name, username: u.username, lv: u.lv, gold: u.gold, role: u.role, npc: u.role === 'npc', banned: !!u.banned, created_at: u.created_at, last_active: u.last_active }));
  }
  player(id) {
    const u = this.g.user(id), d = Object.assign({}, u); delete d.pass_hash; delete d.recovery_hash;
    return { user: d, inv: this.g.inv(id), ledger: this.db.all('SELECT delta,reason,at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 60', id),
      steals: this.db.all('SELECT s.*, o.name AS oname FROM steals s LEFT JOIN users o ON o.id=s.owner WHERE s.thief=? ORDER BY s.id DESC LIMIT 40', id),
      friends: this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', id).n, sessions: this.db.get('SELECT COUNT(*) n FROM sessions WHERE user_id=?', id).n };
  }
  ban(adminId, id, on, reason) {
    const u = this.g.user(id); if (u.role === 'admin') throw U.bad('不能封禁管理员');
    this.db.run('UPDATE users SET banned=?, ban_reason=? WHERE id=?', on ? 1 : 0, on ? String(reason || '').slice(0, 100) : '', id);
    if (on) { this.db.run('DELETE FROM sessions WHERE user_id=?', id); this.db.all("SELECT id FROM market WHERE seller=? AND status='open'", id).forEach(m => this.g.cancelListing(id, m.id)); }
    this.audit(adminId, on ? 'ban' : 'unban', id, { reason }); return {};
  }
  adjust(adminId, id, b) {
    const reason = String(b.reason || '').trim(); if (!reason) throw U.bad('请填写调整原因');
    const gold = Math.round(Number(b.gold) || 0); if (Math.abs(gold) > 1e7) throw U.bad('单次调整金额过大');
    if (gold) this.g.addGold(id, gold, 'admin:' + reason.slice(0, 40));
    if (b.item) { const q = Math.round(Number(b.qty) || 0); if (q) this.g.addInv(id, String(b.item), q); }
    this.audit(adminId, 'adjust', id, { gold, item: b.item, qty: b.qty, reason }); return {};
  }
  setRole(adminId, id, role) { if (!['user', 'admin'].includes(role)) throw U.bad('角色不对'); this.db.run('UPDATE users SET role=? WHERE id=?', role, id); this.audit(adminId, 'role', id, { role }); return {}; }
  events() { return this.db.all('SELECT * FROM events ORDER BY id DESC').map(e => Object.assign(e, { params: J(e.params) || {} })); }
  saveEvent(adminId, b) {
    const kinds = ['exp_mult', 'price_mult', 'golden_mult', 'yield_mult']; if (!kinds.includes(b.kind)) throw U.bad('活动类型不对');
    const name = String(b.name || '').trim().slice(0, 30); if (!name) throw U.bad('请填写活动名称');
    const mult = Number(b.mult); if (!(mult >= 0.5 && mult <= 5)) throw U.bad('倍率需在 0.5–5 之间');
    const start = Number(b.start_at), end = Number(b.end_at); if (!(start > 0 && end > start)) throw U.bad('时间不对');
    const params = JSON.stringify({ mult, crop: b.crop === '' || b.crop === undefined || b.crop === null ? null : U.int(b.crop, '作物', 0, CFG.CROPS.length - 1) });
    if (b.id) this.db.run('UPDATE events SET name=?,kind=?,params=?,start_at=?,end_at=?,enabled=?,descr=? WHERE id=?', name, b.kind, params, start, end, b.enabled ? 1 : 0, String(b.descr || '').slice(0, 120), b.id);
    else this.db.run('INSERT INTO events (name,kind,params,start_at,end_at,enabled,descr) VALUES (?,?,?,?,?,?,?)', name, b.kind, params, start, end, b.enabled === false ? 0 : 1, String(b.descr || '').slice(0, 120));
    this.audit(adminId, b.id ? 'event_edit' : 'event_add', b.id || name, b); return {};
  }
  deleteEvent(adminId, id) { this.db.run('DELETE FROM events WHERE id=?', id); this.audit(adminId, 'event_del', id, {}); return {}; }
  getConfig() { const g = k => J((this.db.get('SELECT value FROM config WHERE key=?', k) || {}).value) || {}; return { crops: g('crops'), rules: g('rules'), effective: this.g.publicConfig() }; }
  setConfig(adminId, key, value) {
    if (!['crops', 'rules'].includes(key)) throw U.bad('配置项不对'); if (typeof value !== 'object' || !value) throw U.bad('配置格式不对');
    this.db.run('INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value));
    this.g.applyConfigOverrides(); this.audit(adminId, 'config', key, value); return this.getConfig();
  }
  auditLog() { return this.db.all('SELECT a.*, u.name FROM audit a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 200'); }
  errors() { return this.db.all('SELECT * FROM errors ORDER BY id DESC LIMIT 100'); }
  suspects() {
    const now = this.g.now(), d = 'd' + CFG.dayKey(now);
    return {
      stealers: this.db.all("SELECT u.id,u.code,u.name,c.val FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key='steal_n' ORDER BY c.val DESC LIMIT 20", d),
      earners: this.db.all('SELECT u.id,u.code,u.name,SUM(l.delta) AS gold FROM ledger l JOIN users u ON u.id=l.user_id WHERE l.at>? AND l.delta>0 GROUP BY l.user_id ORDER BY gold DESC LIMIT 20', CFG.dayStart(now)),
      trades: this.db.all("SELECT m.*, s.name AS sname, b.name AS bname FROM market m LEFT JOIN users s ON s.id=m.seller LEFT JOIN users b ON b.id=m.buyer WHERE m.status='sold' AND m.done_at>? ORDER BY m.qty*m.price DESC LIMIT 20", now - 7 * 86400000),
      // 同一对玩家之间大量交易（可能是小号转移）
      pairs: this.db.all("SELECT seller, buyer, COUNT(*) n, SUM(qty*price) total FROM market WHERE status='sold' AND done_at>? GROUP BY seller,buyer HAVING n>=5 ORDER BY total DESC LIMIT 20", now - 7 * 86400000),
    };
  }
}
module.exports = { Admin };
