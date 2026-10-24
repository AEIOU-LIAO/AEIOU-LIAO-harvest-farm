// 生成 EdgeOne 云函数入口：把 server/ 和 shared/config.js 打包成一个自包含的 ESM 文件
//   cloud-functions/api/[[default]].js（自动生成，不要手改；改服务端代码后运行 npm run build）
// 原因：EdgeOne 打包云函数时只处理 cloud-functions 目录，引用目录外的文件不可靠；
//       打包后的文件只依赖 Node 内置模块，平台打包或不打包都能直接运行。
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const MODS = ['shared/config.js', 'server/util.js', 'server/db.js', 'server/game.js', 'server/admin.js', 'server/npc.js', 'server/app.js'];
const BUILTIN = { crypto: '__crypto', async_hooks: '__async_hooks', fs: '__fs', path: '__path' };

function resolve(from, spec) {
  if (spec in BUILTIN) return spec;
  if (spec === 'node:sqlite') return spec;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.js$/, '') + '.js';
  if (!MODS.includes(p)) throw new Error(`${from} 引用了没打包的模块 ${spec}`);
  return p;
}

let body = '';
for (const m of MODS) {
  let src = fs.readFileSync(path.join(root, m), 'utf8');
  // 只允许字面量 require，便于静态分析
  src = src.replace(/require\((['"])([^'"]+)\1\)/g, (_, q, spec) => `__req(${JSON.stringify(resolve(m, spec))})`);
  if (/\brequire\s*\(/.test(src.replace(/\/\/.*$/gm, ''))) throw new Error(m + ' 里有非字面量的 require');
  body += `\n__def(${JSON.stringify(m)}, function (module, exports, __req) {\n${src}\n});\n`;
}

const out = `/* =====================================================
   EdgeOne Pages 云函数入口：处理所有 /api/* 请求
   ⚠ 自动生成的文件，不要手改。源码在 server/ 和 shared/，改完运行 npm run build
   - 自包含：只依赖 Node 内置模块（Node 18+），不需要 npm 依赖
   - 数据库：Turso（环境变量 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）
   ===================================================== */
import * as __crypto from 'node:crypto';
import * as __async_hooks from 'node:async_hooks';
import * as __fs from 'node:fs';
import * as __path from 'node:path';

const __mods = {}, __cache = {};
const __builtins = { crypto: __crypto, async_hooks: __async_hooks, fs: __fs, path: __path };
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (id in __builtins) return __builtins[id];
  if (id === 'node:sqlite') throw new Error('EdgeOne 上不使用本地 SQLite，请配置 TURSO_DATABASE_URL');
  if (__cache[id]) return __cache[id].exports;
  const module = { exports: {} }; __cache[id] = module; __mods[id](module, module.exports, __req); return module.exports;
}
${body}
const { createCore } = __req('server/app.js');

let coreP = null;
function getCore(env) {
  if (!coreP) {
    // EdgeOne 的环境变量在 context.env 里：同步到 process.env，服务端代码统一从这里读取
    for (const [k, v] of Object.entries(env || {})) if (typeof v === 'string' && !(k in process.env)) process.env[k] = v;
    if (!process.env.TURSO_DATABASE_URL) return Promise.reject(new Error('没有配置 TURSO_DATABASE_URL：请在 EdgeOne 项目的环境变量里填写 Turso 数据库地址和令牌，然后重新部署'));
    coreP = createCore({ tursoUrl: process.env.TURSO_DATABASE_URL, tursoToken: process.env.TURSO_AUTH_TOKEN || '', cronBudgetMs: 40000 }).catch(e => { coreP = null; throw e; });
  }
  return coreP;
}
const jsonErr = (status, code, error) => new Response(JSON.stringify({ ok: false, code, error }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequest(context) {
  const request = context.request;
  let core;
  try { core = await getCore(context.env); }
  catch (e) { console.error('[init]', e && e.stack || e); return jsonErr(500, 'init', '服务器初始化失败：' + (e && e.message || e)); }
  try {
    const headers = {}; request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.text() : '';
    const r = await core.handle({
      method: request.method, url: url.pathname + url.search, headers, body,
      ip: context.clientIp || headers['eo-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim() || '?',
      secure: url.protocol === 'https:' || headers['x-forwarded-proto'] === 'https',
    });
    return new Response(request.method === 'HEAD' || r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
  } catch (e) { console.error('[request]', e && e.stack || e); return jsonErr(500, 'server', '服务器开小差了，请稍后再试'); }
}
`;
const dst = path.join(root, 'cloud-functions', 'api', '[[default]].js');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, out);
console.log('built', path.relative(root, dst), out.length, 'bytes');
