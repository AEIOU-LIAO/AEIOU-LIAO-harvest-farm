'use strict';
/* 丰收农场 · 服务端玩法模块：第 2 期 名山猎场（温和狩猎）
   - 进山：每天 HUNT.trips 次；服务器给一个随机种子，前后端用 CFG.huntSpawns(种子, 等级) 算出一样的起点和野兽位置
   - 下山：前端报告捕获了哪几只（序号）。服务器校验：本次进山真有这只、没重复、所用时间够把它们打晕（按拥有的最强武器算最快速度）
   - 奖励：金币、经验、材料（hm + 序号，进仓库，可以出售）；带着吃饱的福旺进山，金币多 20%；体力耗尽被送回家，收获减半
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

const SPAWN_CACHE = new Map(); /* 同一个种子 + 等级只算一次（进山、下山各要用一次） */
function spawnsOf(seed, lv) { const k = seed + ':' + lv; let s = SPAWN_CACHE.get(k); if (!s) { s = CFG.huntSpawns(seed, lv); SPAWN_CACHE.set(k, s); if (SPAWN_CACHE.size > 64) SPAWN_CACHE.delete(SPAWN_CACHE.keys().next().value); } return s; }
const zoneOf = () => CFG.ZONES.find(z => z.id === CFG.HUNT.zone) || { unlockLv: 1 };

module.exports = {
  huntOf(u) { let H = {}; try { H = JSON.parse(u.hunt || '{}') || {}; } catch (e) { H = {}; } if (!Array.isArray(H.weapons)) H.weapons = []; CFG.HUNT.weapons.forEach(w => { if (!w.price && !H.weapons.includes(w.id)) H.weapons.push(w.id); }); H.trips = H.trips | 0; return H; },
  saveHunt(uid, H) { const s = JSON.stringify(H); this.db.w('UPDATE users SET hunt=? WHERE id=?', s, uid); this.pu(uid, x => x.hunt = s); },
  huntDay(H) { const d = CFG.dayKey(this.now()); if (H.day !== d) { H.day = d; H.trips = 0; } return H; },
  huntDog(u) { const d = this.dogsOf(u).find(x => x.id === 'fuwang'); return !!(d && d.own && d.fed); },
  async huntInfo(uid) {
    const u = await this.user(uid), H = this.huntDay(this.huntOf(u)), z = zoneOf();
    return { unlockLv: z.unlockLv, unlocked: u.lv >= z.unlockLv, weapons: H.weapons, tripsLeft: Math.max(0, CFG.HUNT.trips - H.trips), trips: CFG.HUNT.trips, dog: this.huntDog(u), total: H.total || {} };
  },
  async huntStart(uid) {
    const u = await this.user(uid), H = this.huntDay(this.huntOf(u)), z = zoneOf();
    if (u.lv < z.unlockLv) throw conflict(`${z.name}需要 Lv.${z.unlockLv}`, 'locked');
    if (H.trips >= CFG.HUNT.trips) throw conflict(`今天已经进山 ${CFG.HUNT.trips} 次了，明天再来吧`, 'limit');
    const seed = U.randInt(1, 2147483646), sp = spawnsOf(seed, u.lv);
    H.sess = { sid: U.randToken(9), seed, lv: u.lv, at: this.now() }; H.trips++; this.saveHunt(uid, H); this.metric('hunt_trips');
    return { sid: H.sess.sid, seed, lv: u.lv, start: sp.start, list: sp.list, weapons: H.weapons, tripsLeft: CFG.HUNT.trips - H.trips, dog: this.huntDog(u), tripSec: CFG.HUNT.tripSec, heroHp: CFG.HUNT.heroHp };
  },
  async huntEnd(uid, b, out) {
    const u = await this.user(uid), H = this.huntOf(u), S = H.sess; if (!S || S.sid !== String(b.sid || '')) throw conflict('这次进山已经结束了', 'no_session');
    const sp = spawnsOf(S.seed, S.lv), elapsed = (this.now() - S.at) / 1000, ids = [...new Set((Array.isArray(b.caught) ? b.caught : []).map(x => x | 0))];
    const best = CFG.HUNT.weapons.filter(w => H.weapons.includes(w.id)).reduce((a, w) => (w.dmg / w.cd > a.dmg / a.cd ? w : a), { dmg: 1, cd: 1 });
    let need = 0; const got = [];
    for (const i of ids) { const s = sp.list[i]; if (!s) throw bad('没有这只野兽'); const c = CFG.HUNT.creatures.find(x => x.id === s.id); need += Math.ceil(c.hp / best.dmg) * best.cd; got.push(c); }
    if (got.length && elapsed + 3 < need * 0.8) throw bad('捕获得太快了，请重新进山'); /* 防作弊：比最强武器的最快速度还快 */
    const faint = !!b.faint, dog = this.huntDog(u), k = faint ? 0.5 : 1; let gold = 0, exp = 0; const items = {}, by = {};
    got.forEach(c => { gold += c.reward.gold; exp += c.reward.exp; Object.entries(c.reward.items || {}).forEach(([it, n]) => { items[it] = (items[it] || 0) + n; }); by[c.id] = (by[c.id] || 0) + 1; });
    gold = Math.round(gold * k * (dog ? 1 + CFG.HUNT.dogGoldBonus : 1)); exp = Math.round(exp * k); Object.keys(items).forEach(it => { items[it] = Math.max(faint ? 0 : 1, Math.floor(items[it] * k)); if (!items[it]) delete items[it]; });
    if (gold) this.addGold(uid, gold, 'hunt'); Object.entries(items).forEach(([it, n]) => { this.addInv(uid, it, n); this.codex(uid, it, n); });
    if (exp) await this.addExp(uid, exp, out, u);
    H.total = H.total || {}; Object.entries(by).forEach(([id, n]) => { H.total[id] = (H.total[id] || 0) + n; }); H.sess = null; this.saveHunt(uid, H);
    if (got.length) { this.bump(uid, 'hunt', got.length); this.metric('hunt_catch', got.length); }
    return { caught: by, n: got.length, gold, exp, items, faint, dog, seconds: Math.round(elapsed) };
  },
  async huntBuy(uid, id) {
    const u = await this.user(uid), H = this.huntOf(u), w = CFG.HUNT.weapons.find(x => x.id === String(id || '')); if (!w) throw bad('没有这种武器');
    if (H.weapons.includes(w.id)) throw conflict(`已经有${w.name}了`, 'done'); if (u.lv < w.lv) throw conflict(`${w.name}需要 Lv.${w.lv}`, 'locked');
    this.addGold(uid, -w.price, 'weapon:' + w.id); H.weapons.push(w.id); this.saveHunt(uid, H); return { weapon: w.id, name: w.name, cost: w.price };
  },
};
