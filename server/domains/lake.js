'use strict';
/* 丰收农场 · 服务端玩法模块：镜湖钓场（方案 C 第一个新场景）
   - 进场：每天 LAKE.trips 次；服务器给一个随机种子，前后端用 CFG.lakeBites(种子, 等级, 鱼竿) 算出一样的「咬钩序列」
   - 前端按顺序一次一次地钓：抛竿 → 等咬钩 → 提竿 → 收线；没钓上也算用掉一次咬钩
   - 收竿回家：前端报告用掉了几次咬钩（used）、钓上了哪几次（caught 序号）。服务器校验：序号在用掉的范围里、不重复、
     用掉的次数 × minBiteSec 不超过实际用时（咬钩是一次接一次的，不可能更快）
   - 奖励：鱼进仓库（就是鱼塘的鱼，fs + 序号，可以出售），大鱼多一条；经验；每种鱼的最长纪录
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, bad, conflict } = require('./common');

const BITE_CACHE = new Map();
function bitesOf(seed, lv, rod) { const k = seed + ':' + lv + ':' + rod; let s = BITE_CACHE.get(k); if (!s) { s = CFG.lakeBites(seed, lv, rod); BITE_CACHE.set(k, s); if (BITE_CACHE.size > 64) BITE_CACHE.delete(BITE_CACHE.keys().next().value); } return s; }
const zoneOf = () => CFG.ZONES.find(z => z.id === CFG.LAKE.zone) || { unlockLv: 1, name: '镜湖钓场' };
const FISH = id => CFG.FISH.find(f => f.id === id);

module.exports = {
  lakeOf(u) { let L = {}; try { L = JSON.parse(u.lake || '{}') || {}; } catch (e) { L = {}; } if (!Array.isArray(L.rods)) L.rods = []; CFG.LAKE.rods.forEach(r => { if (!r.price && !L.rods.includes(r.id)) L.rods.push(r.id); }); L.trips = L.trips | 0; L.total = L.total || {}; L.best = L.best || {}; return L; },
  saveLake(uid, L) { const s = JSON.stringify(L); this.db.w('UPDATE users SET lake=? WHERE id=?', s, uid); this.pu(uid, x => x.lake = s); },
  lakeDay(L) { const d = CFG.dayKey(this.now()); if (L.day !== d) { L.day = d; L.trips = 0; } return L; },
  bestRod(L) { return CFG.LAKE.rods.filter(r => L.rods.includes(r.id)).reduce((a, r) => (r.power > a.power ? r : a), CFG.LAKE.rods[0]); },
  async lakeInfo(uid) {
    const u = await this.user(uid), L = this.lakeDay(this.lakeOf(u)), z = zoneOf();
    return { unlockLv: z.unlockLv, unlocked: u.lv >= z.unlockLv, rods: L.rods, rod: this.bestRod(L).id, tripsLeft: Math.max(0, CFG.LAKE.trips - L.trips), trips: CFG.LAKE.trips, total: L.total, best: L.best };
  },
  async lakeStart(uid) {
    const u = await this.user(uid), L = this.lakeDay(this.lakeOf(u)), z = zoneOf();
    if (u.lv < z.unlockLv) throw conflict(`${z.name}需要 Lv.${z.unlockLv}`, 'locked');
    if (L.trips >= CFG.LAKE.trips) throw conflict(`今天已经来钓了 ${CFG.LAKE.trips} 次了，明天再来吧`, 'limit');
    const rod = this.bestRod(L), seed = U.randInt(1, 2147483646);
    L.sess = { sid: U.randToken(9), seed, lv: u.lv, rod: rod.id, at: this.now() }; L.trips++; this.saveLake(uid, L); this.metric('lake_trips');
    return { sid: L.sess.sid, seed, lv: u.lv, rod: rod.id, bites: bitesOf(seed, u.lv, rod.id), tripsLeft: CFG.LAKE.trips - L.trips, tripSec: CFG.LAKE.tripSec, best: L.best };
  },
  async lakeEnd(uid, b, out) {
    const u = await this.user(uid), L = this.lakeOf(u), S = L.sess; if (!S || S.sid !== String(b.sid || '')) throw conflict('这次钓鱼已经结束了', 'no_session');
    const list = bitesOf(S.seed, S.lv, S.rod), elapsed = (this.now() - S.at) / 1000, ids = [...new Set((Array.isArray(b.caught) ? b.caught : []).map(x => x | 0))].sort((a, c) => a - c);
    const used = Math.max(ids.length ? ids[ids.length - 1] + 1 : 0, Math.min(list.length, b.used | 0));
    if (ids.some(i => i < 0 || i >= list.length)) throw bad('没有这次咬钩');
    if (used * CFG.LAKE.minBiteSec * 0.8 > elapsed + 3) throw bad('钓得太快了，请重新来'); /* 防作弊：咬钩是一次接一次的 */
    let exp = 0; const items = {}, by = {}, records = [];
    for (const i of ids) { const x = list[i], f = FISH(x.f), lf = CFG.LAKE.fish.find(y => y.fish === x.f) || {}; const n = x.big ? 2 : 1, it = 'fs' + x.f;
      items[it] = (items[it] || 0) + n; exp += (f ? f.exp : 0) + (lf.exp || 0); by[x.f] = (by[x.f] || 0) + 1;
      if (!L.best[x.f] || x.cm > L.best[x.f]) { L.best[x.f] = x.cm; records.push({ f: x.f, cm: x.cm }); } }
    Object.entries(items).forEach(([it, n]) => { this.addInv(uid, it, n); this.codex(uid, it, n); });
    if (exp) await this.addExp(uid, exp, out, u);
    Object.entries(by).forEach(([f, n]) => { L.total[f] = (L.total[f] || 0) + n; }); L.sess = null; this.saveLake(uid, L);
    if (ids.length) { this.bump(uid, 'lake', ids.length); this.metric('lake_catch', ids.length); }
    return { caught: by, n: ids.length, used, exp, items, records, seconds: Math.round(elapsed) };
  },
  async lakeBuy(uid, id) {
    const u = await this.user(uid), L = this.lakeOf(u), r = CFG.LAKE.rods.find(x => x.id === String(id || '')); if (!r) throw bad('没有这种鱼竿');
    if (L.rods.includes(r.id)) throw conflict(`已经有${r.name}了`, 'done'); if (u.lv < r.lv) throw conflict(`${r.name}需要 Lv.${r.lv}`, 'locked');
    this.addGold(uid, -r.price, 'rod:' + r.id); L.rods.push(r.id); this.saveLake(uid, L); return { rod: r.id, name: r.name, cost: r.price };
  },
};
