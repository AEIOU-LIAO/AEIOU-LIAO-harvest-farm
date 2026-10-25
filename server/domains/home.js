'use strict';
/* 丰收农场 · 服务端玩法模块：家园建造网格：布局存档、摆放、拆除、扩建收回
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  layoutOf(u) { let L = {}; try { L = JSON.parse(u.layout || '{}') || {}; } catch (e) { L = {}; } if (!Array.isArray(L.items)) L.items = []; L.v = 1; L.seq = L.seq | 0; return L; },
  saveLayout(uid, L) { const s = JSON.stringify(L); this.db.w('UPDATE users SET layout=? WHERE id=?', s, uid); this.pu(uid, x => x.layout = s); },
  async homeState(uid) { const [u, plots] = await all([this.user(uid), this.plots(uid)]), R = this.ranchOf(u); return { u, fields: Math.max(1, Math.ceil(plots.length / NPLOTS)), pastLv: R.pastLv || 1, pondLv: R.pondLv || 1 }; },
  async homeLayout(uid) { const h = await this.homeState(uid), L = this.layoutOf(h.u); return { items: L.items, fields: h.fields, pastLv: h.pastLv, pondLv: h.pondLv, grid: CFG.gridSpec() }; },
  async homePlace(uid, it) {
    it = { type: String(it.type || ''), gx: it.gx | 0, gz: it.gz | 0, rot: ((it.rot | 0) % 4 + 4) % 4 };
    const h = await this.homeState(uid), L = this.layoutOf(h.u), occ = CFG.homeOccupancy(h), why = CFG.canPlace(occ, L.items, it, h.u.lv);
    if (why) throw conflict(why, 'cant_place');
    const b = CFG.BUILDINGS.find(x => x.id === it.type); this.addGold(uid, -b.price, 'build:' + b.id);
    const item = Object.assign({ id: ++L.seq }, it, { at: this.now() }); L.items.push(item); this.saveLayout(uid, L); return { item, name: b.name, cost: b.price };
  },
  async homeRemove(uid, id) {
    const u = await this.user(uid), L = this.layoutOf(u), i = L.items.findIndex(x => x.id === (id | 0)); if (i < 0) throw notFound('没有这个建筑');
    const it = L.items.splice(i, 1)[0], b = CFG.BUILDINGS.find(x => x.id === it.type), refund = b ? Math.floor(b.price * 0.5) : 0;
    if (refund) this.addGold(uid, refund, 'unbuild:' + it.type); this.saveLayout(uid, L); return { id: it.id, refund, name: b ? b.name : it.type };
  },
  /* 扩建牧场 / 鱼塘、开辟新菜地后，被新占用的格子上的建筑自动收回并全额退款（不会出现建筑和菜地叠在一起） */
  async homeEvict(uid) {
    const h = await this.homeState(uid), L = this.layoutOf(h.u); if (!L.items.length) return 0;
    const occ = CFG.homeOccupancy(h), keep = [], gone = [];
    L.items.forEach(it => { const fp = CFG.footprint(it); (!fp || fp.some(([i, j]) => i < 0 || j < 0 || i >= occ.W || j >= occ.H || occ.cells[j * occ.W + i]) ? gone : keep).push(it); });
    if (!gone.length) return 0;
    gone.forEach(it => { const b = CFG.BUILDINGS.find(x => x.id === it.type); if (b && b.price) this.addGold(uid, b.price, 'evict:' + it.type); });
    L.items = keep; this.saveLayout(uid, L); return gone.length;
  },
};
