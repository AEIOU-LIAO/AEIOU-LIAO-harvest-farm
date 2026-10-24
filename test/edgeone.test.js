'use strict';
/* EdgeOne 云函数入口测试：按 EdgeOne 的方式调用 onRequest(context)，数据库用本地模拟的 Turso。
   覆盖：缺少配置时的提示、注册登录与 Cookie、一键操作、多实例共用数据库、定时任务（NPC）去重。 */
process.env.QUIET = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { startMock } = require('./turso-mock');
const { createCore } = require('../server/app');

// 把入口文件单独复制到一个空目录再加载：确认它不依赖仓库里的任何其他文件（EdgeOne 只打包 cloud-functions 目录）
const fs = require('fs'), os = require('os');
const ENTRY = (() => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'eo-fn-')); const f = path.join(d, 'entry.mjs'); fs.copyFileSync(path.join(__dirname, '..', 'cloud-functions', 'api', '[[default]].js'), f); return f; })();
const req = (fn, env) => async (method, p, body, token, cookie) => {
  const headers = { 'content-type': 'application/json', 'user-agent': 'test' }; if (token) headers.authorization = 'Bearer ' + token; if (cookie) headers.cookie = cookie;
  const r = await fn({ request: new Request('https://farm.example.com' + p, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, clientIp: '1.2.3.4' });
  const j = await r.json(); j.status = r.status; j.setCookie = r.headers.get('set-cookie'); return j;
};

test('EdgeOne 入口：初始化、登录 Cookie、游戏操作、定时任务', async () => {
  const mock = await startMock({ latencyMs: 20 });
  try {
    const { onRequest } = await import(ENTRY);
    // 1. 没配数据库：给出明确提示，不崩溃
    const bad = await req(onRequest, {})('GET', '/api/health');
    assert.equal(bad.status, 500); assert.match(bad.error, /TURSO_DATABASE_URL/);
    // 2. 配好之后正常工作
    const env = { TURSO_DATABASE_URL: mock.url, TURSO_AUTH_TOKEN: mock.token, NPC_COUNT: '6' };
    const call = req(onRequest, env);
    const h = await call('GET', '/api/health'); assert.ok(h.ok, h.error); assert.equal(h.db, 'turso');
    const g = await call('POST', '/api/auth/guest', { name: '云端玩家' }); assert.ok(g.ok, g.error);
    assert.match(g.setCookie, /HttpOnly/); assert.match(g.setCookie, /Secure/, 'HTTPS 下 Cookie 带 Secure'); assert.match(g.setCookie, /Path=\/api/);
    const cookie = /hf_dev=[^;]*/.exec(g.setCookie)[0];
    const pa = await call('POST', '/api/farm/plant-all', { crop: 0 }, g.token); assert.ok(pa.ok, pa.error); assert.equal(pa.state.plots.filter(p => p.c === 0).length, 6);
    // 3. 换一台设备（只有 Cookie）：能列出并进入这个账号
    const acc = await call('GET', '/api/accounts', null, null, cookie); assert.deepEqual(acc.list.map(a => a.name), ['云端玩家']);
    const use = await call('POST', '/api/accounts/use', { id: g.state.me.id }, null, cookie); assert.ok(use.ok); assert.equal(use.state.plots.filter(p => p.c === 0).length, 6, '存档在云端，换设备看到同样的作物');
    // 4. 另一个“云函数实例”（新的进程内状态）连同一个数据库：数据一致
    const core2 = await createCore({ tursoUrl: mock.url, tursoToken: mock.token, quiet: true, npcCount: 0 });
    const s2 = await core2.handle({ method: 'GET', url: '/api/state', headers: { authorization: 'Bearer ' + g.token }, body: '', ip: '5.6.7.8', secure: true });
    assert.equal(JSON.parse(s2.body).me.gold, pa.state.me.gold, '两个实例看到同样的金币');
    // 5. 定时任务：生成 NPC 并运行；重复触发会被租约跳过
    const c1 = await call('POST', '/api/cron', {}); assert.ok(c1.ok, c1.error); assert.ok(c1.npc.ran, JSON.stringify(c1));
    const c2 = await core2.handle({ method: 'POST', url: '/api/cron', headers: {}, body: '{}', ip: 'cron', secure: true });
    assert.ok(JSON.parse(c2.body).npc.skipped, '另一个实例同时触发会跳过');
    const nb = await call('GET', '/api/neighbors', null, g.token); assert.equal(nb.list.length, 6, '虚拟玩家已入住');
  } finally { await mock.close(); }
});
