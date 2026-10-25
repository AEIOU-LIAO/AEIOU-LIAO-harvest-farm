'use strict';
/* 丰收农场 · 服务端玩法模块：农田：种植、收获、照料、化肥、扩建、土地升级、批量、出售与购买
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  scheduleEv(P, start) { const dur = CFG.plotDur(P), rem = 1 - P.p, cr = CROPS[P.c]; const n = (U.rand() < (cr.time < 60 ? 0.35 : 0.6) ? 1 : 0) + (U.rand() < 0.3 ? 1 : 0) + (cr.time >= 1800 && U.rand() < 0.4 ? 1 : 0); const ev = []; for (let i = 0; i < n; i++) ev.push([Math.round(start + dur * rem * (0.1 + U.rand() * 0.75)), pick(['d', 'w', 'b'])]); ev.sort((a, b) => a[0] - b[0]); return ev; },
  async startCycle(P, now, uid) { const cr = CROPS[P.c], wb = uid ? CFG.wonderBonus(this.layoutOf(await this.user(uid)).items) : 0; P.y0 = Math.max(1, Math.round(cr.yield * CFG.soilOf(P).yield * await this.evMult('yield_mult', P.c) * (CFG.inSeason(P.c, now) ? 1 + CFG.seasonOf(now).bonus : 1) * (1 + wb))); /* 第 1 期：当季作物增产、奇观永久增产 */ P.y = P.y0; P.stolen = 0; P.pr = { d: 0, w: 0, b: 0 }; P.t = now; P.ra = 0; P.cycle++; P.ev = this.scheduleEv(P, now); },
  async plant(uid, idx, cropId, out) {
    const cr = CROPS[cropId]; if (!cr) throw bad('没有这种种子');
    const [u, P] = await all([this.user(uid), this.plot(uid, idx)]);
    if (!P.u) throw bad('这块地还没开垦'); if (P.c >= 0) throw conflict('这块地已经种了东西', 'occupied');
    if (u.lv < cr.lv) throw bad(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'locked');
    this.addGold(uid, -cr.seed, 'seed');
    const now = this.now(); P.c = cropId; P.p = 0; P.sea = 0; await this.startCycle(P, now, uid); this.savePlot(uid, P);
    this.db.w('UPDATE users SET plant_total=plant_total+1, seed=? WHERE id=?', cropId, uid); this.pu(uid, x => { x.plant_total++; x.seed = cropId; }); this.bump(uid, 'plant'); await this.addExp(uid, 2, out, u);
    return { idx, crop: cropId, cost: cr.seed };
  },
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
    if (cr.seasons > 1 && P.sea < cr.seasons - 1) { P.sea++; P.p = RULES.season2Start; await this.startCycle(P, now, uid); res.season2 = true; }
    else { P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; }
    this.savePlot(uid, P); return res;
  },
  codex(uid, item, n) { this.db.w('INSERT INTO codex (user_id,item,first_at,n) VALUES (?,?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET n=n+excluded.n', uid, item, this.now(), n || 1); },
  async care(uid, idx, out) {
    const P = await this.plot(uid, idx); const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地很健康', 'healthy');
    P.pr[k] = 0; this.savePlot(uid, P); this.bump(uid, 'care'); await this.addExp(uid, 2, out); return { idx, kind: k };
  },
  async shovel(uid, idx) {
    const P = await this.plot(uid, idx); if (P.c < 0) throw bad('这里没有作物'); if (P.p >= 1) throw conflict('作物已成熟，先收获吧', 'ripe');
    P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; this.savePlot(uid, P); return { idx };
  },
  // 一键催熟：按“离成熟最近”排序，逐块用化肥直到成熟，化肥用完为止
  async fertAll(uid) {
    let have = await this.invQty(uid, 'fert'); if (have <= 0) throw conflict('没有化肥了，去商店买一些吧', 'not_enough');
    const now = this.now(), list = (await this.plots(uid)).filter(P => P.u && P.c >= 0 && P.p < 1).sort((a, b) => CFG.remainSec(a) - CFG.remainSec(b));
    if (!list.length) throw conflict('没有正在生长的作物', 'none');
    const res = []; let used = 0;
    for (const P0 of list) { if (have <= 0) break; let n = 0, P = P0; while (have > 0 && P.p < 1) { await this.fert(uid, P.idx); have--; used++; n++; P = await this.plot(uid, P.idx); } res.push({ idx: P.idx, n, ripe: P.p >= 1 }); }
    void now; return { res, used, ripe: res.filter(x => x.ripe).length, left: have };
  },
  async fert(uid, idx) {
    const P = await this.plot(uid, idx); if (P.c < 0 || P.p >= 1) throw bad('只能给生长中的作物施肥');
    this.addInv(uid, 'fert', -1); P.p = Math.min(1, P.p + RULES.fertBoost); if (P.p >= 1) { P.ra = this.now(); P.ev = []; } this.savePlot(uid, P); return { idx };
  },
  async expand(uid, idx, out) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]); const owned = plots.filter(p => p.u && p.idx < NPLOTS).length;
    if (idx === undefined || idx === null || idx < 0) idx = UNLOCK_ORDER.find(i => !plots[i].u);
    if (idx === undefined) throw bad('土地已经全部开垦');
    const P = plots.find(p => p.idx === idx); if (!P) throw bad('土地不存在'); if (P.u) throw conflict('这块地已经开垦了', 'done');
    const need = CFG.plotNeedLv(owned), cost = CFG.plotCost(owned); if (u.lv < need) throw bad(`扩建需要 Lv.${need}`, 'locked');
    this.addGold(uid, -cost, 'expand'); P.u = 1; P.t = this.now(); this.savePlot(uid, P); await this.addExp(uid, 10, out); return { idx, cost };
  },
  // 开辟新的一片农田：24 块地一次全部开好
  async buyField(uid, out) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]); const f = Math.ceil(plots.length / NPLOTS);
    if (f >= CFG.FIELDS_MAX) throw conflict(`最多 ${CFG.FIELDS_MAX} 片农田，已经全部开辟了`, 'max');
    if (plots.filter(p => p.idx < NPLOTS && p.u).length < NPLOTS) throw conflict('先把农场中间这片 24 块地全部开垦完', 'first');
    const need = CFG.fieldNeedLv(f), cost = CFG.fieldCost(f); if (u.lv < need) throw bad(`开辟第 ${f + 1} 片农田需要 Lv.${need}`, 'locked');
    this.addGold(uid, -cost, 'field'); const now = this.now(), vals = [], args = [], fresh = [];
    for (let j = 0; j < NPLOTS; j++) { const i = f * NPLOTS + j; vals.push('(?,?,?,?)'); args.push(uid, i, 1, now); fresh.push({ idx: i, u: 1, soil: 0, c: -1, p: 0, t: now, sea: 0, y: 0, y0: 0, stolen: 0, pr: { d: 0, w: 0, b: 0 }, ev: [], ra: 0, cycle: 0 }); }
    this.db.w('INSERT INTO plots (user_id,idx,u,t) VALUES ' + vals.join(','), ...args);
    const C = this.C(); if (C && C.plots[uid]) fresh.forEach(P => C.plots[uid].push(structuredClone(P)));
    await this.addExp(uid, 200 * f, out); const evicted = await this.homeEvict(uid); return { field: f, cost, plots: NPLOTS, evicted };
  },
  // 土地升级：普通 → 红土地 → 黑土地 → 金土地（接口名沿用 red）
  // 土地升级：to = 目标等级（不传就升一级）。从当前等级一级一级升到目标，每一级的费用、等级要求和原来一样
  async red(uid, idx, out, to) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]);
    const P = plots.find(p => p.idx === idx); if (!P) throw bad('土地不存在'); if (!P.u) throw bad('先开垦这块地');
    const cur = P.soil | 0, target = to === undefined || to === null ? cur + 1 : to; const TS = CFG.SOILS[target];
    if (!TS || target <= 0) { if (!CFG.SOILS[cur + 1]) throw conflict('这块已经是最高级的金土地了', 'done'); throw bad('没有这种土地'); }
    if (cur >= target) throw conflict(`这块已经是${CFG.SOILS[cur].name}了`, 'done');
    if (u.lv < TS.lv) throw bad(`升级${TS.name}需要 Lv.${TS.lv}`, 'locked');
    let cost = 0; for (let k = cur + 1; k <= target; k++) cost += CFG.soilCost(k, plots.filter(p => (p.soil | 0) >= k).length);
    this.addGold(uid, -cost, 'soil' + target); P.soil = target; this.savePlot(uid, P); let e = 0; for (let k = cur + 1; k <= target; k++) e += 15 * k; await this.addExp(uid, e, out);
    return { idx, cost, soil: target, from: cur, name: TS.name };
  },
  // 批量操作：每一项一个保存点，单项失败只回滚该项
  async batch(uid, fn, list) {
    const res = [], out = {};
    for (const i of list) { try { res.push(await this.db.sp(() => fn(i, out))); } catch (e) { if (!(e instanceof U.ApiError)) throw e; res.push({ idx: i, err: e.message, code: e.code }); } }
    return { res, out };
  },
  async sell(uid, item, n, have) {
    const c = cropOfItem(item) || CFG.ranchItem(item); if (!c) throw bad('只能出售作物、鱼和羊毛'); if (have === undefined) have = await this.invQty(uid, item);
    n = Math.min(U.int(n, '数量', 1, 1e9), have); if (n <= 0) throw conflict('没有可以卖的', 'not_enough');
    const g = n * await this.unitPrice(item); this.addInv(uid, item, -n); this.addGold(uid, g, 'sell'); this.bump(uid, 'sell', g, 'day'); this.bump(uid, 'sell', 1, 'all'); return { item, n, gold: g };
  },
  async sellAll(uid) { let total = 0; const items = []; for (const [item, q] of Object.entries(await this.inv(uid))) { if ((cropOfItem(item) || CFG.ranchItem(item)) && q > 0) { total += (await this.sell(uid, item, q, q)).gold; items.push(item); } } if (!total) throw conflict('仓库里没有作物', 'empty'); return { gold: total, items }; },
  async buy(uid, item, n) {
    const it = CFG.SHOP_ITEMS.find(x => x.id === item); if (!it) throw bad('商店没有这个商品'); n = U.int(n, '数量', 1, 100000);
    this.addGold(uid, -it.price * n, 'shop:' + item); this.addInv(uid, item, n); return { item, n };
  },
  /* ---------- 鱼塘、牧场、果园（v3：按批次 / 按群存储，支持成百上千） ---------- */
};
