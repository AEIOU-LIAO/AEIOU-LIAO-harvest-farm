'use strict';
/* 丰收农场 · 服务端玩法模块：牧场、鱼塘、果园、牧羊犬、宠物狗
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  ranchOf(u) {
    const R = J(u.ranch) || {}, now = this.now(), RC = CFG.RANCH;
    R.fish = (Array.isArray(R.fish) ? R.fish : []).map(f => ({ t: f.t | 0, n: Math.max(1, f.n | 0 || 1), at: f.at || now }));
    R.trees = (Array.isArray(R.trees) ? R.trees : []).map(r => ({ t: r.t | 0, n: Math.max(1, r.n | 0 || 1), at: r.at || now, last: r.last || 0, acc: r.acc || 0 }));
    R.herd = R.herd || { from: 0, until: 0, dog: '' };
    // 旧版一只一只存的羊：合并成按品种的羊群（已经长好的羊毛先存进 pend）
    const old = Array.isArray(R.sheep) ? R.sheep : [], groups = {};
    if (old.every(s => s.n) && new Set(old.map(s => s.t)).size === old.length) { R.sheep = old.map(s => ({ t: s.t | 0, n: s.n | 0, last: s.last || now, acc: s.acc || 0, pend: s.pend || 0 })); }
    else {
    old.forEach(s => { const t = s.t | 0, def = CFG.SHEEP[t]; if (!def) return; const g = groups[t] || (groups[t] = { t, n: 0, last: now, acc: 0, pend: 0, _a: 0 });
      if (s.n) { const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c); g.pend += (s.pend || 0) + k * s.n * def.wool; g._a += (c - k) * s.n; g.n += s.n; }
      else { const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c); g.pend += k * def.wool; g._a += c - k; g.n += 1; } });
    R.sheep = Object.values(groups).map(g => ({ t: g.t, n: g.n, last: now, acc: g.n ? g._a / g.n : 0, pend: g.pend }));
    if (R.herd.until > now) R.herd.from = Math.max(R.herd.from || 0, now); } // 合并后从现在起算（之前的进度已经结算进 acc）
    const need = (capOf, cnt) => { let l = 1; while (l < RC.maxLv && capOf(l) < cnt) l++; return l; };
    R.pondLv = Math.max(R.pondLv || 1, need(CFG.pondCapOf, R.fish.reduce((a, f) => a + f.n, 0)));
    R.pastLv = Math.max(R.pastLv || 1, need(CFG.pastureCapOf, R.sheep.reduce((a, s) => a + s.n, 0)));
    R.orchLv = Math.max(R.orchLv || 1, need(CFG.orchardCapOf, R.trees.reduce((a, r) => a + r.n, 0)));
    return R;
  },
  saveRanch(uid, R) { const s = JSON.stringify(R); this.db.w('UPDATE users SET ranch=? WHERE id=?', s, uid); this.pu(uid, x => x.ranch = s); },
  ranchView(u) {
    const R = this.ranchOf(u), now = this.now(), sum = (l) => l.reduce((a, x) => a + x.n, 0);
    const up = (kind, l) => l >= CFG.RANCH.maxLv ? null : { cost: CFG.ranchUpCost(kind, l), needLv: CFG.ranchNeedLv(l + 1) };
    return { pondLv: R.pondLv, pastLv: R.pastLv, orchLv: R.orchLv, pondCap: CFG.pondCapOf(R.pondLv), pastureCap: CFG.pastureCapOf(R.pastLv), orchardCap: CFG.orchardCapOf(R.orchLv),
      up: { pond: up('pond', R.pondLv), pasture: up('pasture', R.pastLv), orchard: up('orchard', R.orchLv) }, herd: R.herd,
      fish: R.fish.map(f => ({ t: f.t, n: f.n, at: f.at, left: CFG.fishLeft(f, now) })), fishN: sum(R.fish),
      sheep: R.sheep.map(s => { const c = CFG.sheepCycles(s, now, R.herd); return { t: s.t, n: s.n, last: s.last, acc: s.acc, pend: s.pend || 0, cycles: c, wool: Math.floor(c) * s.n * SHEEP_W(s.t) + (s.pend || 0), full: c >= CFG.RANCH.woolMax }; }), sheepN: sum(R.sheep),
      trees: R.trees.map(r => ({ t: r.t, n: r.n, at: r.at, last: r.last, acc: r.acc, cycles: CFG.treeCycles(r, now), grow: CFG.treeGrowLeft(r, now) })), treeN: sum(R.trees) };
  },
  /* ===== V0.3 家园自由建造：布局存档（建筑目录 content/buildings.jsonc，网格 content/home.jsonc） ===== */
  async ranchUpgrade(uid, kind) {
    if (!['pond', 'pasture', 'orchard'].includes(kind)) throw bad('不能扩建这个'); const u = await this.user(uid), R = this.ranchOf(u), key = { pond: 'pondLv', pasture: 'pastLv', orchard: 'orchLv' }[kind], l = R[key];
    const name = { pond: '鱼塘', pasture: '牧场', orchard: '果园' }[kind];
    if (l >= CFG.RANCH.maxLv) throw conflict(`${name}已经是最高级了`, 'max'); const need = CFG.ranchNeedLv(l + 1); if (u.lv < need) throw bad(`${name}扩建到 ${l + 1} 级需要玩家 Lv.${need}`, 'locked');
    this.addGold(uid, -CFG.ranchUpCost(kind, l), 'up:' + kind); R[key] = l + 1; this.saveRanch(uid, R); await this.addExp(uid, 20 + l * 5, {});
    const evicted = kind === 'orchard' ? 0 : await this.homeEvict(uid);
    const cap = { pond: CFG.pondCapOf, pasture: CFG.pastureCapOf, orchard: CFG.orchardCapOf }[kind](l + 1); return { kind, lv: l + 1, cap, name, evicted };
  },
  async buyFish(uid, type, n) {
    const d = CFG.FISH[type]; if (!d) throw bad('没有这种鱼苗'); n = U.int(n || 1, '数量', 1, 5000);
    const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.pondCapOf(R.pondLv), have = R.fish.reduce((a, f) => a + f.n, 0); if (have + n > cap) throw conflict(`鱼塘最多养 ${cap} 条鱼，现在还能放 ${Math.max(0, cap - have)} 条，扩建鱼塘可以养更多`, 'full');
    this.addGold(uid, -d.price * n, 'fish:' + d.id); const now = this.now(); const last = R.fish[R.fish.length - 1];
    if (last && last.t === d.id && now - last.at < 1000) last.n += n; else R.fish.push({ t: d.id, n, at: now });
    this.saveRanch(uid, R); this.bump(uid, 'fish_in', n, 'all'); return { type: d.id, n, name: d.name };
  },
  async collectFish(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.fish = R.fish.filter(f => { const d = CFG.FISH[f.t]; if (!d || CFG.fishLeft(f, now) > 0) return true; got[d.id] = (got[d.id] || 0) + d.yield * f.n; exp += d.exp * f.n; return false; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('还没有长大的鱼', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'fs' + id, got[id]); this.codex(uid, 'fs' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'fish', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  },
  async buySheep(uid, type, n) {
    const d = CFG.SHEEP[type]; if (!d) throw bad('没有这种羊'); n = U.int(n || 1, '数量', 1, 5000); const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.pastureCapOf(R.pastLv), have = R.sheep.reduce((a, s) => a + s.n, 0); if (have + n > cap) throw conflict(`牧场最多养 ${cap} 只，现在还能买 ${Math.max(0, cap - have)} 只，扩建牧场可以养更多`, 'full');
    this.addGold(uid, -d.price * n, 'sheep:' + d.id); const now = this.now(); let g = R.sheep.find(s => s.t === d.id);
    if (g) { const c = CFG.sheepCycles(g, now, R.herd), k = Math.floor(c); g.pend = (g.pend || 0) + k * g.n * d.wool; g.acc = (c - k) * g.n / (g.n + n); g.last = now; g.n += n; }
    else R.sheep.push({ t: d.id, n, last: now, acc: 0, pend: 0 });
    this.saveRanch(uid, R); return { type: d.id, n, name: d.name }; // 不改 herd.from：其他羊群还没结算的牧羊加速要保留（只结算了这一群，它的 last 已更新）
  },
  async shear(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.sheep.forEach(s => { const d = CFG.SHEEP[s.t]; if (!d) return; const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c), w = k * s.n * d.wool + (s.pend || 0); if (w <= 0) return;
      got[d.id] = (got[d.id] || 0) + w; exp += Math.round(w / d.wool * d.exp); s.acc = c >= CFG.RANCH.woolMax ? 0 : c - k; s.last = now; s.pend = 0; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('羊毛还没长好', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'wl' + id, got[id]); this.codex(uid, 'wl' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'shear', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  },
  // 牧羊：派一只吃饱的牧羊犬去放羊。狗等级越高：时间越长、加速越多、一次能照看的羊越多（羊比它能照看的多时，加速按比例打折）
  async herd(uid, kind) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), total = R.sheep.reduce((a, s) => a + s.n, 0);
    if (!total) throw conflict('牧场里还没有羊', 'none');
    const dogs = this.allDogs(u), d = (kind ? dogs.find(x => x.id === kind) : dogs.find(x => x.fed)) || dogs[0];
    if (!d) throw conflict('先领养一只牧羊犬吧（商店 → 宠物）', 'no_dog'); if (!d.fed) throw conflict(`${d.name}饿着肚子赶不动羊，先去仓库喂它`, 'hungry');
    if (R.herd.until > now) throw conflict(`${(CFG.DOGS.find(x => x.id === R.herd.dog) || d).name}正在牧羊，还剩 ${Math.ceil((R.herd.until - now) / 60000)} 分钟`, 'busy');
    R.sheep.forEach(s => { s.acc = CFG.sheepCycles(s, now, R.herd); s.last = now; }); // 先结算之前的进度
    const H = CFG.herdOf(d.lv), share = Math.min(1, H.cap / total);
    R.herd = { from: now, until: now + H.min * 60000, dog: d.id, boost: H.boost, share: +share.toFixed(3) }; this.saveRanch(uid, R); this.bump(uid, 'herd', 1, 'all');
    const g = await this.dogExp(uid, d.id, 3);
    return { dog: d.id, name: d.name, until: R.herd.until, boost: H.boost, share, cap: H.cap, lvUp: g.lvUp };
  },
  async buyTree(uid, type, n) {
    const d = CFG.TREES[type]; if (!d) throw bad('没有这种树苗'); n = U.int(n || 1, '数量', 1, 2000); const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.orchardCapOf(R.orchLv), have = R.trees.reduce((a, r) => a + r.n, 0); if (have + n > cap) throw conflict(`果园最多种 ${cap} 棵，现在还能种 ${Math.max(0, cap - have)} 棵，扩建果园可以种更多`, 'full');
    this.addGold(uid, -d.price * n, 'tree:' + d.id); R.trees.push({ t: d.id, n, at: this.now(), last: 0, acc: 0 }); this.saveRanch(uid, R); return { type: d.id, n, name: d.name };
  },
  async pickFruit(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.trees.forEach(r => { const d = CFG.TREES[r.t]; if (!d) return; const c = CFG.treeCycles(r, now), k = Math.floor(c); if (k < 1) return; got[d.id] = (got[d.id] || 0) + k * r.n * d.yield; exp += k * r.n * d.exp; r.acc = c >= CFG.RANCH.fruitMax ? 0 : c - k; r.last = now; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('果子还没熟', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'fr' + id, got[id]); this.codex(uid, 'fr' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'fruit', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  },
  // 狗加经验（喂食 +1、牧羊 +3、训练 +5），最高 100 级
  async dogExp(uid, kind, n) {
    if (/^p\d+$/.test(kind || '')) { const u = await this.user(uid), R = this.ranchOf(u), p = (R.pets || []).find(x => x.id === kind); if (!p) throw bad('没有这只狗'); let lv = p.lv || 1, exp = (p.exp || 0) + n, up = 0;
      while (lv < CFG.RANCH.dogMaxLv && exp >= CFG.dogExpNeed(lv)) { exp -= CFG.dogExpNeed(lv); lv++; up = lv; } if (lv >= CFG.RANCH.dogMaxLv) exp = 0; p.lv = lv; p.exp = exp; this.saveRanch(uid, R); return { lv, exp, lvUp: up }; }
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col; let lv = u[c + '_lv'] || 1, exp = (u[c + '_exp'] || 0) + n, up = 0;
    while (lv < CFG.RANCH.dogMaxLv && exp >= CFG.dogExpNeed(lv)) { exp -= CFG.dogExpNeed(lv); lv++; up = lv; } if (lv >= CFG.RANCH.dogMaxLv) exp = 0;
    this.db.w(`UPDATE users SET ${c}_lv=?, ${c}_exp=? WHERE id=?`, lv, exp, uid); this.pu(uid, x => { x[c + '_lv'] = lv; x[c + '_exp'] = exp; }); return { lv, exp, lvUp: up };
  },
  async trainDog(uid, kind, n) {
    n = U.int(n || 1, '次数', 1, 100); const u = await this.user(uid); let name, lv;
    if (/^p\d+$/.test(kind || '')) { const p = (this.ranchOf(u).pets || []).find(x => x.id === kind); if (!p) throw bad('没有这只狗'); name = p.name; lv = p.lv || 1; }
    else { const d = this.dogDef(kind), c = d.col; if (!u[c + '_own']) throw bad(`还没有领养${d.name}`); name = d.name; lv = u[c + '_lv'] || 1; kind = d.id; }
    if (lv >= CFG.RANCH.dogMaxLv) throw conflict(`${name}已经满级了`, 'max'); let cost = 0, up = 0, g = { lv };
    let done = 0; for (let i = 0; i < n && g.lv < CFG.RANCH.dogMaxLv; i++) { const c1 = 150 * g.lv; if ((await this.user(uid)).gold < c1) break; this.addGold(uid, -c1, 'train'); cost += c1; done++; g = await this.dogExp(uid, kind, 5); if (g.lvUp) up = g.lvUp; }
    if (!done) throw conflict(`金币不够，训练一次要 ${150 * lv} 金币`, 'not_enough'); // 训练 ×10：钱不够 10 次就练到钱用完为止
    return { kind, name, lv: g.lv, lvUp: up, cost, n: done };
  },
  // 一键加速：鱼饲料 / 精饲料 / 果树营养液，用在最快能收的那些上，用完为止
  async ranchBoost(uid, kind) {
    const item = { pond: 'ffeed', pasture: 'sfeed', orchard: 'tfert' }[kind]; if (!item) throw bad('不能加速这个');
    let have = await this.invQty(uid, item); const name = itemName(item); if (have <= 0) throw conflict(`没有${name}了，去商店买一些吧`, 'not_enough');
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(); let used = 0, done = 0;
    if (kind === 'pond') {
      const list = R.fish.filter(f => CFG.fishLeft(f, now) > 0).sort((a, b) => CFG.fishLeft(a, now) - CFG.fishLeft(b, now)); if (!list.length) throw conflict('鱼塘里没有正在长的鱼', 'none');
      for (const f of list) { if (have <= 0) break; const T = CFG.FISH[f.t].time, step = T * 0.3, m = Math.ceil(CFG.fishLeft(f, now) / step);
        if (have >= m * f.n) { f.at -= m * step * 1000; have -= m * f.n; used += m * f.n; done += f.n; continue; }
        const k = Math.floor(have / m); if (k > 0) { R.fish.push({ t: f.t, n: k, at: f.at - m * step * 1000 }); f.n -= k; have -= k * m; used += k * m; done += k; }
        const s = Math.floor(have / f.n); if (s > 0) { f.at -= s * step * 1000; have -= s * f.n; used += s * f.n; } break; }
    } else if (kind === 'pasture') {
      const list = R.sheep.map(s => ({ s, c: CFG.sheepCycles(s, now, R.herd) })).filter(x => x.c < CFG.RANCH.woolMax).sort((a, b) => b.c - a.c); if (!list.length) throw conflict('羊毛都长满了，先去剪羊毛', 'none');
      for (const { s, c } of list) { if (have <= 0) break; const need = Math.ceil((CFG.RANCH.woolMax - c) / 0.5 * s.n), use = Math.min(have, need); s.acc = Math.min(CFG.RANCH.woolMax, c + use * 0.5 / s.n); s.last = now; have -= use; used += use; if (s.acc >= 1) done += s.n; }
    } else {
      const grow = R.trees.filter(r => CFG.treeGrowLeft(r, now) > 0).sort((a, b) => CFG.treeGrowLeft(a, now) - CFG.treeGrowLeft(b, now));
      const ripe = R.trees.filter(r => CFG.treeGrowLeft(r, now) <= 0 && CFG.treeCycles(r, now) < CFG.RANCH.fruitMax).sort((a, b) => CFG.treeCycles(b, now) - CFG.treeCycles(a, now));
      if (!grow.length && !ripe.length) throw conflict('果树都结满了，先去摘果子', 'none');
      for (const r of ripe) { if (have <= 0) break; const c = CFG.treeCycles(r, now), need = Math.ceil((CFG.RANCH.fruitMax - c) / 0.5 * r.n), use = Math.min(have, need); r.acc = Math.min(CFG.RANCH.fruitMax, c + use * 0.5 / r.n); r.last = now; have -= use; used += use; if (r.acc >= 1) done += r.n; }
      for (const r of grow) { if (have <= 0) break; const G0 = CFG.TREES[r.t].grow, step = G0 * 0.3, m = Math.ceil(CFG.treeGrowLeft(r, now) / step), use = Math.min(have, m * r.n), s = Math.floor(use / r.n); if (s <= 0) break; r.at -= s * step * 1000; have -= s * r.n; used += s * r.n; }
    }
    if (!used) throw conflict(`${name}不够用`, 'not_enough');
    this.addInv(uid, item, -used); this.saveRanch(uid, R); return { kind, item, used, done, left: have };
  },
  /* ---------- 更多颜色的边牧（自己起名字） ---------- */
  petsOf(u) { const R = this.ranchOf(u), now = this.now(); return (R.pets || []).map(p => ({ id: p.id, name: p.name, coat: p.coat, own: true, lv: p.lv || 1, exp: p.exp || 0, need: CFG.dogExpNeed(p.lv || 1), until: p.until || 0, fed: (p.until || 0) > now, pet: true })); },
  allDogs(u) { return this.dogsOf(u).filter(d => d.own).concat(this.petsOf(u)); },
  async buyPet(uid, coat, name) {
    const d = CFG.COLLIES.find(x => x.coat === coat); if (!d) throw bad('没有这种边牧'); name = U.cleanName(name || d.name.replace('边牧', '')); if ([...name].length > 8) throw bad('名字最多 8 个字');
    const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked'); const R = this.ranchOf(u); R.pets = R.pets || [];
    if (R.pets.length >= CFG.PETS_MAX) throw conflict(`最多再养 ${CFG.PETS_MAX} 只边牧`, 'full');
    this.addGold(uid, -d.price, 'pet:' + coat); const id = 'p' + (Math.max(0, ...R.pets.map(p => +String(p.id).slice(1) || 0)) + 1); R.pets.push({ id, coat, name, lv: 1, exp: 0, until: this.now() + RULES.dogFeedMin * 60000 }); this.saveRanch(uid, R);
    return { id, name, coat };
  },
  async renamePet(uid, id, name) { name = U.cleanName(name); if ([...name].length > 8) throw bad('名字最多 8 个字'); const u = await this.user(uid), R = this.ranchOf(u), p = (R.pets || []).find(x => x.id === id); if (!p) throw bad('没有这只狗'); p.name = name; this.saveRanch(uid, R); return { id, name }; },
  /* ---------- 看家狗：福旺、睿宝 ---------- */
  dogDef(kind) { const d = CFG.DOGS.find(x => x.id === (kind || 'fuwang')); if (!d) throw bad('没有这只狗'); return d; },
  dogsOf(u) { const now = this.now(); return CFG.DOGS.map(d => { const lv = u[d.col + '_lv'] || 1, until = u[d.col + '_until'] || 0; return { id: d.id, name: d.name, own: !!u[d.col + '_own'], lv, exp: u[d.col + '_exp'] || 0, need: CFG.dogExpNeed(lv), until, fed: until > now, bite: d.bite, chance: CFG.dogChance(d, lv) }; }); },
  async buyDog(uid, kind) {
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col;
    if (u[c + '_own']) throw conflict(`已经有${d.name}了`, 'done'); if (u.lv < d.lv) throw bad(`领养${d.name}需要 Lv.${d.lv}`, 'locked');
    this.addGold(uid, -d.price, 'dog:' + d.id); this.db.w(`UPDATE users SET ${c}_own=1 WHERE id=?`, uid); this.pu(uid, x => x[c + '_own'] = 1); this.addInv(uid, 'dogfood', 1); return { kind: d.id, name: d.name };
  },
  async feedDog(uid, kind, n) {
    n = U.int(n || 1, '数量', 1, 100); const now = this.now();
    if (/^p\d+$/.test(kind || '')) { const u = await this.user(uid), R = this.ranchOf(u), p = (R.pets || []).find(x => x.id === kind); if (!p) throw bad('没有这只狗'); this.addInv(uid, 'dogfood', -n);
      p.until = Math.min(now + 7 * 86400000, Math.max(p.until || 0, now) + n * RULES.dogFeedMin * 60000); this.saveRanch(uid, R); const g = await this.dogExp(uid, kind, n); return { kind, name: p.name, lvUp: g.lvUp, until: p.until, n }; }
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col; if (!u[c + '_own']) throw bad(`还没有领养${d.name}`); this.addInv(uid, 'dogfood', -n);
    const until = Math.min(now + 7 * 86400000, Math.max(u[c + '_until'] || 0, now) + n * RULES.dogFeedMin * 60000); this.db.w(`UPDATE users SET ${c}_until=? WHERE id=?`, until, uid); this.pu(uid, x => { x[c + '_until'] = until; });
    const g = await this.dogExp(uid, d.id, n); return { kind: d.id, name: d.name, lvUp: g.lvUp, until, n };
  },

  /* ---------- 签到 / 任务 / 成就 ---------- */
};
