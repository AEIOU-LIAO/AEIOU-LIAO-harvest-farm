/* =====================================================
   EdgeOne Pages 云函数入口：所有 /api/* 请求都由这里处理
   - 数据库：Turso（环境变量 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）
   - 同一个实例处理多个请求时复用连接和缓存；冷启动只做一次初始化
   - 静态页面（index.html 等）由 EdgeOne 直接托管，不经过这里
   ===================================================== */
import appModule from '../../server/app.js';
const { createCore } = appModule;

let coreP = null;
function getCore(env) {
  if (!coreP) {
    // EdgeOne 的环境变量在 context.env 里：同步到 process.env，服务端代码统一从这里读取
    for (const [k, v] of Object.entries(env || {})) if (typeof v === 'string' && !(k in process.env)) process.env[k] = v;
    if (!process.env.TURSO_DATABASE_URL) return Promise.reject(new Error('没有配置 TURSO_DATABASE_URL：请在 EdgeOne 项目的环境变量里填写 Turso 数据库地址和令牌'));
    coreP = createCore({ tursoUrl: process.env.TURSO_DATABASE_URL, tursoToken: process.env.TURSO_AUTH_TOKEN || '', cronBudgetMs: 40000 }).catch(e => { coreP = null; throw e; });
  }
  return coreP;
}

export async function onRequest(context) {
  const { request } = context;
  let core;
  try { core = await getCore(context.env); }
  catch (e) {
    console.error('[init]', e && e.stack || e);
    return new Response(JSON.stringify({ ok: false, code: 'init', error: '服务器初始化失败：' + (e && e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const headers = {}; request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.text() : '';
  const r = await core.handle({
    method: request.method, url: url.pathname + url.search, headers, body,
    ip: context.clientIp || headers['x-forwarded-for'] || headers['eo-connecting-ip'] || '?',
    secure: url.protocol === 'https:' || headers['x-forwarded-proto'] === 'https',
  });
  return new Response(request.method === 'HEAD' || r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
}
