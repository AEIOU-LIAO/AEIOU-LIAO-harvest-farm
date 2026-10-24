'use strict';
/* 关键接口自动化测试：node --test test/
   每个用例启动独立的内存数据库服务，并用测试时钟快进时间。 */
process.env.QUIET = '1';
const test = require('node:test'), assert = require('node:assert/strict');
const { createApp } = require('../server/index');
const CFG = require('../shared/config');

async function start(o) {
  const app = createApp(Object.assign({ db: ':memory:', testClock: true, backupHours: 0, admins: [], quiet: true, noRateLimit: true, npcCount: 0 }, o));
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const call = async (method, path, body, token, ik) => {
    const r = await fetch(base + path, { method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}, ik ? { 'idempotency-key': ik } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json(); j.status = r.status; return j;
  };
  const guest = async name => { const r = await call('POST', '/api/auth/guest', { name }); assert.ok(r.ok, r.error); return { token: r.token, id: r.state.me.id, code: r.state.me.code, state: r.state }; };
  const clock = ms => call('POST', '/api/test/clock', { ms });
  const plantAll = async (u, crop) => { const r = await call('POST', '/api/farm/plant-all', { crop: crop || 0 }, u.token); assert.ok(r.ok, r.error); return r; };
  const friends = async (a, b) => { const r = await call('POST', '/api/invite/accept', { code: a.code }, b.token); assert.ok(r.ok, r.error); };
  return { app, call, guest, clock, plantAll, friends, close: () => app.close() };
}
const inv = async (t, u) => (await t.call('GET', '/api/state', null, u.token)).inv;

test('账号：游客、绑定、跨设备登录、存档保留', async () => {
  const t = await start();
  try {
    const a = await t.guest('阿花'); await t.plantAll(a);
    const b = await t.call('POST', '/api/auth/bind', { username: 'ahua_01', password: 'secret123' }, a.token); assert.ok(b.ok); assert.equal(b.recovery.length, 12);
    const l = await t.call('POST', '/api/auth/login', { username: 'ahua_01', password: 'secret123' }); assert.ok(l.ok);
    assert.equal(l.state.me.id, a.id); assert.equal(l.state.plots.filter(p => p.c === 0).length, 6, '另一台设备登录后看到同样的作物');
    assert.equal((await t.call('POST', '/api/auth/login', { username: 'ahua_01', password: 'wrong' })).status, 401);
    const rc = await t.call('POST', '/api/auth/recover', { username: 'ahua_01', code: b.recovery, password: 'newpass1' }); assert.ok(rc.ok);
    assert.equal((await t.call('GET', '/api/state', null, a.token)).status, 401, '重设密码后旧会话失效');
    assert.ok((await t.call('POST', '/api/auth/login', { username: 'ahua_01', password: 'newpass1' })).ok);
    assert.equal((await t.call('POST', '/api/auth/guest', { name: '<script>' })).state.me.name, 'script', '昵称会过滤危险字符');
  } finally { await t.close(); }
});

test('本机多账号：Cookie 保存多个账号、点选进入、移除、退出', async () => {
  const t = await start();
  try {
    const base = 'http://127.0.0.1:' + t.app.server.address().port; let jar = '';
    const req = async (method, path, body, token) => { const r = await fetch(base + path, { method, headers: Object.assign({ 'content-type': 'application/json' }, jar ? { cookie: jar } : {}, token ? { authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) { const m = /hf_dev=([^;]*)/.exec(sc); jar = m && m[1] ? 'hf_dev=' + m[1] : ''; assert.ok(/HttpOnly/.test(sc) && /Max-Age=\d+/.test(sc)); } const j = await r.json(); j.status = r.status; return j; };
    const a = await req('POST', '/api/auth/guest', { name: '大号' }), b = await req('POST', '/api/auth/guest', { name: '小号' });
    assert.ok(jar.includes(a.token) && jar.includes(b.token), 'Cookie 里保存了两个账号');
    // 模拟苹果设备清掉了网页存储：只靠 Cookie 也能列出并进入
    const l = await req('GET', '/api/accounts'); assert.deepEqual(l.list.map(u => u.name), ['小号', '大号']); assert.equal(l.list[0].token, undefined, '列表不返回令牌');
    const u = await req('POST', '/api/accounts/use', { id: a.state.me.id }); assert.ok(u.ok); assert.equal(u.state.me.name, '大号');
    assert.equal((await req('POST', '/api/accounts/use', { id: 999999 })).status, 404);
    // 没有 Cookie 的设备不能借用别人的账号
    const saved = jar; jar = ''; assert.equal((await req('POST', '/api/accounts/use', { id: a.state.me.id })).status, 404); jar = saved;
    // 移除一个、退出另一个
    await req('POST', '/api/accounts/forget', { id: b.state.me.id }); assert.deepEqual((await req('GET', '/api/accounts')).list.map(x => x.name), ['大号']);
    assert.equal((await t.call('GET', '/api/state', null, b.token)).status, 401, '移除后该登录失效');
    await req('POST', '/api/auth/logout', null, u.token); assert.equal((await req('GET', '/api/accounts')).list.length, 0);
  } finally { await t.close(); }
});

test('好友与开放互访：邀请链接、一键加好友、不加好友也能串门偷菜、拉黑后不可访问', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'), c = await t.guest('C');
    await t.friends(a, b);
    const fa = await t.call('GET', '/api/friends', null, a.token); assert.equal(fa.list.length, 1); assert.equal(fa.list[0].id, b.id);
    // C 不是好友，也能在“附近的人”里看到 A，并直接串门、偷菜
    const nb = await t.call('GET', '/api/neighbors?tab=nearby', null, c.token); assert.ok(nb.list.some(u => u.id === a.id));
    assert.ok((await t.call('GET', '/api/farm/' + a.id, null, c.token)).ok, '非好友可以串门');
    await t.plantAll(a, 0); await t.clock(200000);
    const st = await t.call('POST', `/api/farm/${a.id}/steal-all`, null, c.token); assert.ok(st.ok, st.error); assert.ok(st.result.some(x => x.qty > 0), '非好友可以偷菜');
    // 一键加好友，不需要对方审批
    const ad = await t.call('POST', '/api/friends/add', { id: a.id }, c.token); assert.ok(ad.ok, ad.error);
    assert.ok((await t.call('GET', '/api/friends', null, a.token)).list.some(u => u.id === c.id));
    assert.equal((await t.call('POST', '/api/friends/add', { id: a.id }, c.token)).status, 409, '不能重复添加');
    // 拉黑后双方都不能互访
    assert.ok((await t.call('POST', '/api/friends/block', { id: c.id, on: true }, a.token)).ok);
    assert.equal((await t.call('GET', '/api/farm/' + a.id, null, c.token)).status, 403);
    assert.ok(!(await t.call('GET', '/api/neighbors?tab=nearby', null, c.token)).list.some(u => u.id === a.id), '拉黑后不出现在附近列表');
    assert.equal((await t.call('GET', '/api/farm/' + a.id, null, a.token)).status, 400, '不能访问自己');
    const s2 = await t.call('GET', '/api/friends/search?q=' + b.code, null, c.token); assert.equal(s2.list[0].id, b.id);
  } finally { await t.close(); }
});

test('拟真 NPC：看起来和真人一样、按作息上线经营、会偷菜帮忙买货、不抢真人赛季奖励', async () => {
  const t = await start({ npcCount: 10 });
  try {
    const v = await t.call('POST', '/api/auth/guest', { name: '玩家' }); const me = { token: v.token, id: v.state.me.id };
    const db = t.app.db, game = t.app.game;
    // 对外接口里不能区分 NPC
    const nb = await t.call('GET', '/api/neighbors', null, me.token); assert.equal(nb.list.length, 10);
    nb.list.forEach(u => { assert.equal(u.npc, undefined); assert.notEqual(u.title, '村民'); assert.ok(/^\d{7}$/.test(u.code)); });
    assert.equal(new Set(nb.list.map(u => u.name)).size, 10, '名字不重复');
    const farm = await t.call('GET', '/api/farm/' + nb.list[0].id, null, me.token); assert.equal(farm.farm.owner.npc, undefined);
    // 开局就有成熟的菜可以摘
    const ripe = nb.list.find(u => u.steal > 0); assert.ok(ripe, '有 NPC 的菜成熟了');
    const s = await t.call('POST', `/api/farm/${ripe.id}/steal-all`, null, me.token); assert.ok(s.ok, s.error);
    // 让所有 NPC 上线：会收菜、补种、更新在线状态
    const online = phase => db.all("SELECT id, settings FROM users WHERE role='npc'").forEach(r => { const o = JSON.parse(r.settings); o.npc.until = game.now() + 600000; o.npc.phase = phase; db.run('UPDATE users SET settings=? WHERE id=?', JSON.stringify(o), r.id); });
    const ripeCnt = () => db.get("SELECT COUNT(*) n FROM plots p JOIN users u ON u.id=p.user_id WHERE u.role='npc' AND p.c>=0 AND p.p>=1").n;
    const before = ripeCnt(); online('farm'); db.tx(() => t.app.vill.tick(30));
    assert.ok(ripeCnt() < before, `NPC 上线后收了菜（成熟 ${before} → ${ripeCnt()}）`);
    assert.ok(db.get("SELECT COUNT(*) n FROM plots p JOIN users u ON u.id=p.user_id WHERE u.role='npc' AND p.u=1 AND p.c<0").n <= 2, 'NPC 补种了空地');
    assert.ok((await t.call('GET', '/api/neighbors', null, me.token)).list.every(u => u.online), '在线状态显示为在线');
    // NPC 会来摘玩家的菜（每人每天最多 4 次）、也会来帮忙
    await t.plantAll(me, 0); await t.clock(20 * 60000);
    for (let i = 0; i < 80; i++) { online('social'); db.tx(() => t.app.vill.tick(30)); }
    const stolen = db.get("SELECT COUNT(*) n FROM steals s JOIN users u ON u.id=s.thief WHERE s.owner=? AND u.role='npc'", me.id).n;
    assert.ok(stolen >= 1 && stolen <= 4, `NPC 摘菜 ${stolen} 次（上限 4）`);
    const msgs = (await t.call('GET', '/api/messages', null, me.token)).list; assert.ok(msgs.some(m => m.kind === 'visit' || m.kind === 'stolen'));
    msgs.forEach(m => assert.equal(m.npc, undefined));
    // NPC 会买走价格公道的挂单
    await t.call('POST', '/api/farm/harvest-all', null, me.token);
    const L = await t.call('POST', '/api/market/list', { item: 'c0', qty: 5, price: 3 }, me.token); assert.ok(L.ok, L.error);
    await t.clock(4 * 60000); for (let i = 0; i < 150 && db.get('SELECT status FROM market WHERE id=?', L.result.id).status === 'open'; i++) { online('social'); db.tx(() => t.app.vill.tick(30)); }
    assert.equal(db.get('SELECT status FROM market WHERE id=?', L.result.id).status, 'sold', 'NPC 买走了挂单');
    // 金币按真实规则流动：NPC 金币有限且不会为负
    db.all("SELECT gold FROM users WHERE role='npc'").forEach(r => assert.ok(r.gold >= 0 && r.gold < 1e6));
    // 排行榜包含 NPC；但赛季奖励只在真人之间排名
    const rk = await t.call('GET', '/api/rank?dim=lv&scope=global', null, me.token); assert.ok(rk.list.length > 1);
    const last = GAMECFG_week(game.now() - 7 * 86400000); const npc1 = nb.list[0].id;
    db.run('INSERT OR REPLACE INTO counters (user_id,period,key,val) VALUES (?,?,?,?)', npc1, last, 'sp', 99999);
    db.run('INSERT OR REPLACE INTO counters (user_id,period,key,val) VALUES (?,?,?,?)', me.id, last, 'sp', 5000);
    const se = await t.call('GET', '/api/season', null, me.token); assert.ok(se.last.rank >= 2); assert.equal(se.last.reward, 5000, '真人中排第一，拿第一名奖励');
    // 运营后台能区分 NPC，指标不被注水
    const adm = t.app.admin.stats(); assert.equal(adm.totals.users, 1); assert.equal(adm.totals.npcs, 10);
    assert.ok(t.app.admin.players('').some(u => u.npc));
  } finally { await t.close(); }
});
const GAMECFG_week = ms => CFG.weekKey(ms);

test('偷菜：B 偷走的数量 = A 少收的数量，双方记录一致', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'); await t.friends(a, b); await t.plantAll(a, 0);
    await t.clock(200000); // 萝卜 40 秒成熟，最多受病虫害影响约 105 秒
    const r = await t.call('POST', `/api/farm/${a.id}/steal-all`, null, b.token); assert.ok(r.ok, r.error);
    const stolen = r.result.filter(x => !x.err && !x.blocked).reduce((s, x) => s + x.qty, 0); assert.ok(stolen > 0);
    assert.equal((await inv(t, b)).c0, stolen, 'B 库存增加');
    const h = await t.call('POST', '/api/farm/harvest-all', null, a.token); assert.ok(h.ok);
    const got = h.result.reduce((s, x) => s + x.n, 0); assert.equal(got, 6 * CFG.CROPS[0].yield - stolen, 'A 收成相应减少');
    assert.equal(h.result.reduce((s, x) => s + x.stolen, 0), stolen);
    const m = await t.call('GET', '/api/messages', null, a.token); const msg = m.list.find(x => x.kind === 'stolen'); assert.ok(msg); assert.equal(msg.data.qty, stolen, '被偷通知数量一致'); assert.equal(msg.actor, b.id);
    // 再偷同一季：不允许
    assert.equal((await t.call('POST', `/api/farm/${a.id}/steal`, { idx: r.result[0].idx }, b.token)).status, 409);
  } finally { await t.close(); }
});

test('并发：多人同时偷同一块地、重复提交，不会超额、不会负数、不会重复结算', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'); await t.plantAll(a, 0);
    const thieves = []; for (let i = 0; i < 8; i++) { const x = await t.guest('T' + i); await t.friends(a, x); thieves.push(x); }
    await t.clock(200000);
    const idx = CFG.UNLOCK_ORDER[0];
    // 每个小偷对同一块地并发发 5 次（不同幂等键），共 40 个请求
    const reqs = []; thieves.forEach(x => { for (let k = 0; k < 5; k++) reqs.push(t.call('POST', `/api/farm/${a.id}/steal`, { idx }, x.token)); });
    const res = await Promise.all(reqs);
    const ok = res.filter(r => r.ok && !r.result.blocked); const total = ok.reduce((s, r) => s + r.result.qty, 0);
    const perThief = {}; ok.forEach(r => perThief[r.result.idx] = 1);
    const cap = Math.floor(CFG.CROPS[0].yield * CFG.stealCapPct(1));
    assert.ok(total <= cap, `总偷取 ${total} 不超过上限 ${cap}`);
    let sumInv = 0; for (const x of thieves) { const v = (await inv(t, x)).c0 || 0; assert.ok(v >= 0); sumInv += v; }
    assert.equal(sumInv, total, '小偷库存之和 = 成功偷取总量');
    const farm = (await t.call('GET', '/api/state', null, a.token)).plots.find(p => p.idx === idx);
    assert.equal(farm.stolen, total); assert.equal(farm.y, CFG.CROPS[0].yield - total); assert.ok(farm.y >= 1);
    // 同一幂等键重复提交：只结算一次
    const a2 = await t.guest('A2'), th = await t.guest('TH'); await t.friends(a2, th); await t.plantAll(a2, 0); await t.clock(200000);
    const key = 'same-key-1'; const i2 = CFG.UNLOCK_ORDER[1];
    const rr = await Promise.all([1, 2, 3, 4, 5].map(() => t.call('POST', `/api/farm/${a2.id}/steal`, { idx: i2 }, th.token, key)));
    const first = rr.find(r => r.ok && !r.replayed) || rr.find(r => r.ok);
    assert.ok(rr.every(r => r.ok), '重复请求都返回同一个成功结果');
    assert.equal((await inv(t, th)).c0 || 0, first.result.blocked ? 0 : first.result.qty);
  } finally { await t.close(); }
});

test('经济：卖出、购买、扩地；重试不重复扣款；金币不足拒绝', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'); const g0 = a.state.me.gold;
    const b1 = await t.call('POST', '/api/shop/buy', { item: 'fert', n: 2 }, a.token, 'buy-1');
    const b2 = await t.call('POST', '/api/shop/buy', { item: 'fert', n: 2 }, a.token, 'buy-1');
    assert.ok(b2.replayed); assert.equal((await t.call('GET', '/api/state', null, a.token)).me.gold, g0 - 2 * CFG.RULES.fertPrice, '同一幂等键只扣一次');
    assert.equal((await t.call('POST', '/api/shop/buy', { item: 'fert', n: 99 }, a.token)).status, 409, '金币不足');
    assert.equal((await t.call('POST', '/api/wh/sell', { item: 'c0', n: 5 }, a.token)).status, 409, '没有作物不能卖');
    assert.equal((await t.call('POST', '/api/wh/sell', { item: 'c0', n: -5 }, a.token)).status, 400, '负数被拒绝');
    await t.plantAll(a, 0); await t.clock(200000); await t.call('POST', '/api/farm/harvest-all', null, a.token);
    const st = await t.call('GET', '/api/state', null, a.token); const n = st.inv.c0;
    const s = await t.call('POST', '/api/wh/sell-all', null, a.token); assert.ok(s.ok); assert.equal(s.state.inv.c0 || 0, 0); assert.equal(s.state.me.gold, st.me.gold + s.result.gold); assert.ok(n > 0);
    assert.equal((await t.call('POST', '/api/farm/expand', {}, a.token)).status, 400, '等级不够不能扩地');
  } finally { await t.close(); }
});

test('规则：保护期、狗狗防护、每日上限、新手保底', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'); await t.friends(a, b);
    const idx = CFG.UNLOCK_ORDER[0];
    await t.call('POST', '/api/farm/plant', { idx, crop: 0 }, a.token);
    // 用化肥直接催熟到成熟 → 刚成熟处于保护期
    for (let i = 0; i < 3; i++) await t.call('POST', '/api/farm/fert', { idx }, a.token);
    t.app.db.run(`UPDATE plots SET pr='{"d":0,"w":0,"b":0}', ev='[]' WHERE user_id=? AND idx=?`, a.id, idx); await t.clock(5000);
    const p = await t.call('POST', `/api/farm/${a.id}/steal`, { idx }, b.token); assert.equal(p.code, 'protected');
    await t.clock(CFG.RULES.stealDelaySec * 1000 + 1000);
    const ok = await t.call('POST', `/api/farm/${a.id}/steal`, { idx }, b.token); assert.ok(ok.ok, ok.error);
    // 狗狗：给 A 一只满级吃饱的狗，拦截率 70%
    t.app.db.run('UPDATE users SET dog_own=1, dog_lv=10, dog_until=? WHERE id=?', t.app.game.now() + 3600000, a.id);
    let blocked = 0; const thieves = []; for (let i = 0; i < 20; i++) { const x = await t.guest('T' + i); await t.friends(a, x); thieves.push(x); }
    await t.call('POST', '/api/farm/harvest', { idx }, a.token); await t.plantAll(a, 0); await t.clock(200000);
    t.app.db.run('UPDATE plots SET y=100000, y0=100000 WHERE user_id=? AND c=0', a.id); t.app.db.run('UPDATE users SET lv=10 WHERE id=?', a.id); // 加大产量，避免先触发保底上限
    const keep = [CFG.RULES.stealPctMin, CFG.RULES.stealPctMax]; CFG.RULES.stealPctMin = 0.001; CFG.RULES.stealPctMax = 0.002; // 每次只摘很少，保证 20 次都能走到狗狗判定
    const codes = []; for (const x of thieves) { const r = await t.call('POST', `/api/farm/${a.id}/steal`, { idx: CFG.UNLOCK_ORDER[1] }, x.token); codes.push(r.ok ? (r.result.blocked ? 'B' : 'S') : r.code); if (r.ok && r.result.blocked) blocked++; }
    [CFG.RULES.stealPctMin, CFG.RULES.stealPctMax] = keep;
    assert.ok(blocked >= 6, `狗狗拦截了 ${blocked}/20 次：${codes.join(',')}`); assert.ok(!codes.includes('empty'));
    // 新手保底：主人 Lv<5 时最多被偷 20%
    assert.ok(blocked <= 19, '狗狗不是 100% 拦截');
    const c2 = await t.guest('C2'), t2 = await t.guest('T2'); await t.friends(c2, t2); await t.plantAll(c2, 0); await t.clock(200000);
    const thieves2 = [t2]; for (let i = 0; i < 6; i++) { const x = await t.guest('U' + i); await t.friends(c2, x); thieves2.push(x); }
    for (const x of thieves2) await t.call('POST', `/api/farm/${c2.id}/steal`, { idx: CFG.UNLOCK_ORDER[3] }, x.token);
    const pl = (await t.call('GET', '/api/state', null, c2.token)).plots.find(q => q.idx === CFG.UNLOCK_ORDER[3]);
    assert.ok(pl.stolen > 0 && pl.stolen <= Math.floor(pl.y0 * CFG.RULES.newbieMaxPct), `新手最多被偷 20%（${pl.stolen}/${pl.y0}）`);
    // 每日上限
    t.app.db.run("INSERT OR REPLACE INTO counters (user_id,period,key,val) VALUES (?,?,?,?)", b.id, 'd' + CFG.dayKey(t.app.game.now()), 'steal_n', CFG.RULES.stealDailyLimit);
    assert.equal((await t.call('POST', `/api/farm/${a.id}/steal`, { idx: CFG.UNLOCK_ORDER[2] }, b.token)).code, 'limit');
  } finally { await t.close(); }
});

test('互助：真实修改好友农田并给奖励', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'); await t.friends(a, b);
    const idx = CFG.UNLOCK_ORDER[0]; await t.call('POST', '/api/farm/plant', { idx, crop: 0 }, a.token);
    t.app.db.run(`UPDATE plots SET pr='{"d":1,"w":0,"b":1}' WHERE user_id=? AND idx=?`, a.id, idx);
    const g = (await t.call('GET', '/api/state', null, b.token)).me.gold;
    const r = await t.call('POST', `/api/farm/${a.id}/help-all`, null, b.token); assert.ok(r.ok); assert.equal(r.result.length, 2);
    const pl = (await t.call('GET', '/api/state', null, a.token)).plots.find(p => p.idx === idx); assert.deepEqual([pl.pr.d, pl.pr.b], [0, 0]);
    assert.equal(r.me.gold, g + 2 * CFG.RULES.helpGold);
  } finally { await t.close(); }
});

test('集市：上架托管、购买守恒、并发购买只成交一次、取消退回、价格限制', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'), c = await t.guest('C');
    await t.plantAll(a, 0); await t.clock(200000); await t.call('POST', '/api/farm/harvest-all', null, a.token);
    const have = (await inv(t, a)).c0;
    assert.equal((await t.call('POST', '/api/market/list', { item: 'c0', qty: 10, price: 100 }, a.token)).status, 400, '价格超出范围');
    const L = await t.call('POST', '/api/market/list', { item: 'c0', qty: 10, price: 5 }, a.token); assert.ok(L.ok, L.error);
    assert.equal((await inv(t, a)).c0, have - 10, '上架后物品被托管');
    const gA = (await t.call('GET', '/api/state', null, a.token)).me.gold, gB = (await t.call('GET', '/api/state', null, b.token)).me.gold, gC = (await t.call('GET', '/api/state', null, c.token)).me.gold;
    const rs = await Promise.all([t.call('POST', '/api/market/buy', { id: L.result.id }, b.token), t.call('POST', '/api/market/buy', { id: L.result.id }, c.token)]);
    assert.equal(rs.filter(r => r.ok).length, 1, '只有一人买到');
    const winner = rs[0].ok ? b : c, total = 50, fee = Math.ceil(total * CFG.RULES.marketFee);
    assert.equal((await inv(t, winner)).c0, 10);
    const after = { a: (await t.call('GET', '/api/state', null, a.token)).me.gold, b: (await t.call('GET', '/api/state', null, b.token)).me.gold, c: (await t.call('GET', '/api/state', null, c.token)).me.gold };
    assert.equal(after.a, gA + total - fee); assert.equal(after.a + after.b + after.c, gA + gB + gC - fee, '金币守恒（只扣手续费）');
    const L2 = await t.call('POST', '/api/market/list', { item: 'c0', qty: 3, price: 4 }, a.token); const before = (await inv(t, a)).c0;
    assert.ok((await t.call('POST', '/api/market/cancel', { id: L2.result.id }, a.token)).ok); assert.equal((await inv(t, a)).c0, before + 3);
    assert.equal((await t.call('POST', '/api/market/cancel', { id: L2.result.id }, a.token)).status, 404, '不能重复取消');
    // 过期自动退回
    const L3 = await t.call('POST', '/api/market/list', { item: 'c0', qty: 2, price: 4 }, a.token); const b3 = (await inv(t, a)).c0;
    await t.clock(CFG.RULES.marketTtlHours * 3600000 + 1000); await t.call('GET', '/api/market', null, b.token);
    assert.equal((await inv(t, a)).c0, b3 + 2); assert.equal((await t.call('POST', '/api/market/buy', { id: L3.result.id }, b.token)).status, 409);
  } finally { await t.close(); }
});

test('奖励不可重复领取：签到、任务、成就、订单、迁移', async () => {
  const t = await start();
  try {
    const a = await t.guest('A');
    assert.ok((await t.call('POST', '/api/checkin', null, a.token)).ok);
    assert.equal((await t.call('POST', '/api/checkin', null, a.token)).status, 409);
    await t.plantAll(a, 0);
    const c1 = await t.call('POST', '/api/tasks/claim', { kind: 'newbie', id: 'n_plant' }, a.token); assert.ok(c1.ok, c1.error);
    const rs = await Promise.all([1, 2, 3].map(() => t.call('POST', '/api/tasks/claim', { kind: 'newbie', id: 'n_plant' }, a.token)));
    assert.ok(rs.every(r => r.status === 409));
    assert.equal((await t.call('POST', '/api/tasks/claim', { kind: 'daily', id: 'harvest' }, a.token)).status, 409, '未完成不能领');
    assert.equal((await t.call('POST', '/api/achievements/claim', { id: 'a_h1' }, a.token)).status, 409);
    const m = await t.call('POST', '/api/me/migrate', { lv: 25, gold: 999999 }, a.token); assert.ok(m.ok); assert.equal(m.result.lv, 8); assert.equal(m.result.gold, 3200, '旧存档按上限折算');
    assert.equal((await t.call('POST', '/api/me/migrate', { lv: 25, gold: 999999 }, a.token)).status, 409, '只能迁移一次');
    const o = await t.call('GET', '/api/orders', null, a.token); assert.equal(o.list.length, 3);
    assert.equal((await t.call('POST', '/api/orders/deliver', { slot: 0 }, a.token)).status, 409, '作物不够不能交货');
    // 第二天可以再签到
    await t.clock(86400000); assert.ok((await t.call('POST', '/api/checkin', null, a.token)).ok);
  } finally { await t.close(); }
});

test('排行榜反映服务器数据；客户端无法篡改', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'); await t.friends(a, b);
    t.app.db.run('UPDATE users SET gold=99999 WHERE id=?', b.id);
    const r = await t.call('GET', '/api/rank?dim=gold&scope=friends', null, a.token); assert.equal(r.list[0].id, b.id); assert.equal(r.list[0].score, 99999);
    const p = await t.call('POST', '/api/me/profile', { gold: 1e9, lv: 30, exp: 1e9 }, a.token); assert.ok(p.ok);
    const s = await t.call('GET', '/api/state', null, a.token); assert.equal(s.me.gold, CFG.RULES.startGold); assert.equal(s.me.lv, 1, '资料接口忽略金币/等级等字段');
    await t.plantAll(a, 0); await t.clock(200000); await t.call('POST', '/api/farm/harvest-all', null, a.token);
    const h = await t.call('GET', '/api/rank?dim=harvest&scope=global', null, b.token); assert.equal(h.list[0].id, a.id); assert.equal(h.list[0].score, 6);
  } finally { await t.close(); }
});

test('运营后台：非管理员不可访问；活动与数值配置实时生效；封禁', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), adm = await t.guest('运营');
    assert.equal((await t.call('GET', '/api/admin/stats', null, a.token)).status, 403);
    assert.equal((await t.call('GET', '/api/admin/stats')).status, 401);
    t.app.db.run("UPDATE users SET role='admin' WHERE id=?", adm.id);
    const s = await t.call('GET', '/api/admin/stats', null, adm.token); assert.ok(s.ok); assert.equal(s.totals.users, 2);
    const now = t.app.game.now();
    assert.ok((await t.call('POST', '/api/admin/events', { name: '经验翻倍', kind: 'exp_mult', mult: 2, start_at: now - 1000, end_at: now + 86400000, enabled: true }, adm.token)).ok);
    const p = await t.call('POST', '/api/farm/plant', { idx: CFG.UNLOCK_ORDER[0], crop: 0 }, a.token); assert.equal(p.state.me.exp, 4, '活动让种植经验 2→4');
    assert.ok((await t.call('POST', '/api/admin/config', { key: 'crops', value: { 0: { seed: 25 } } }, adm.token)).ok);
    assert.equal((await t.call('GET', '/api/config')).CROPS[0].seed, 25);
    const g = (await t.call('GET', '/api/state', null, a.token)).me.gold; await t.call('POST', '/api/farm/plant', { idx: CFG.UNLOCK_ORDER[1], crop: 0 }, a.token);
    assert.equal((await t.call('GET', '/api/state', null, a.token)).me.gold, g - 25);
    assert.ok((await t.call('POST', '/api/admin/ban', { id: a.id, on: true, reason: '测试' }, adm.token)).ok);
    assert.equal((await t.call('GET', '/api/state', null, a.token)).status, 401, '封禁后会话被清除');
    const au = await t.call('GET', '/api/admin/audit', null, adm.token); assert.ok(au.list.length >= 3, '管理操作都有审计记录');
  } finally { await t.close(); }
});

test('数据导出与注销', async () => {
  const t = await start();
  try {
    const a = await t.guest('A'), b = await t.guest('B'); await t.friends(a, b);
    const e = await t.call('GET', '/api/me/export', null, a.token); assert.ok(e.ok); assert.equal(e.user.id, a.id); assert.equal(e.user.pass_hash, undefined); assert.equal(e.friends.length, 1);
    assert.equal((await t.call('POST', '/api/me/delete', { confirm: '不对' }, a.token)).status, 400);
    assert.ok((await t.call('POST', '/api/me/delete', { confirm: '确认注销' }, a.token)).ok);
    assert.equal((await t.call('GET', '/api/state', null, a.token)).status, 401);
    assert.equal((await t.call('GET', '/api/friends', null, b.token)).list.length, 0, '好友关系一并删除');
  } finally { await t.close(); }
});

test('生长由服务器时间决定：离线也会成熟；时区按 UTC+8 计算日期', () => {
  const P = { u: 1, c: 0, p: 0, t: 1000, sea: 0, soil: 0, pr: { d: 0, w: 0, b: 0 }, ev: [] };
  CFG.advancePlot(P, 1000 + 40000); assert.equal(P.p, 1); assert.equal(P.ra, 41000);
  const Q = { u: 1, c: 0, p: 0, t: 0, sea: 0, soil: 0, pr: { d: 1, w: 1, b: 0 }, ev: [] };
  CFG.advancePlot(Q, 40000); assert.ok(Q.p < 0.4, '两种问题让生长变慢');
  CFG.setTz(480);
  assert.equal(CFG.dayKey(Date.UTC(2026, 9, 24, 15, 59)), '2026-10-24'); assert.equal(CFG.dayKey(Date.UTC(2026, 9, 24, 16, 1)), '2026-10-25');
  assert.equal(CFG.weekKey(Date.UTC(2026, 9, 25, 15, 0)), CFG.weekKey(Date.UTC(2026, 9, 19, 0, 0))); // 周日晚 = 本周
});

test('限流：短时间大量注册/登录会被拒绝', async () => {
  const t = await start({ noRateLimit: false });
  try {
    const rs = []; for (let i = 0; i < 25; i++) rs.push(await t.call('POST', '/api/auth/login', { username: 'nobody', password: 'xxxxxx' }));
    assert.ok(rs.some(r => r.status === 429), '出现 429');
  } finally { await t.close(); }
});
