'use strict';
/* =====================================================
   丰收农场 · 本机 / 自己服务器上的 HTTP 服务（零依赖）
   - 数据库：默认本地 SQLite 文件（Node 22.13+）；设置 TURSO_DATABASE_URL 后改用 Turso
   - 部署到 EdgeOne Pages 时不经过这个文件，入口是 cloud-functions/api/[[default]].js
   ===================================================== */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');

// ---- 读取 .env（不依赖 dotenv）----
(function loadEnv() { const f = path.join(ROOT, '.env'); if (!fs.existsSync(f)) return; fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); })();

const { createCore, envOpts, VERSION } = require('./app');

const ENV = Object.assign(envOpts(), {
  port: +(process.env.PORT || 3000), host: process.env.HOST || '0.0.0.0', db: path.resolve(ROOT, process.env.DB_PATH || 'data/farm.db'),
  backupDir: path.resolve(ROOT, process.env.BACKUP_DIR || 'data/backups'), backupKeep: +(process.env.BACKUP_KEEP || 7), backupHours: +(process.env.BACKUP_HOURS || 24),
});

async function createApp(opts) {
  opts = Object.assign({}, ENV, opts || {});
  const core = await createCore(opts), db = core.db;

  // ---- 静态页面 ----
  const pages = { '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/admin.html': 'admin.html', '/vendor/three.min.js': 'vendor/three.min.js', '/vendor/three-addons.js': 'vendor/three-addons.js', '/shared/content.js': 'shared/content.js', '/lib/assets3.js': 'lib/assets3.js', '/lib/entity3.js': 'lib/entity3.js', '/art-preview': 'art-preview.html', '/art-preview.html': 'art-preview.html' }; const pcache = {};
  const secHeaders = () => ({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
  function serveStatic(req, res, p) {
    const rel = pages[p] || p.slice(1), f = path.join(ROOT, rel); let st; try { st = fs.statSync(f); } catch (e) { res.writeHead(404); return res.end('Not found'); }
    let c = pcache[f]; if (!c || c.m !== st.mtimeMs) { const raw = fs.readFileSync(f); c = pcache[f] = { m: st.mtimeMs, raw, gz: zlib.gzipSync(raw) }; }
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || ''), js = /\.js$/.test(f), ext = path.extname(f), bin = { '.glb': 'model/gltf-binary', '.gz': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json; charset=utf-8' }[ext];
    res.writeHead(200, Object.assign(secHeaders(), { 'Content-Type': bin || (js ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8'), 'Cache-Control': js || bin ? 'public, max-age=604800' : 'no-cache' }, gz && !bin ? { 'Content-Encoding': 'gzip' } : {}));
    res.end(req.method === 'HEAD' ? undefined : gz && !bin ? c.gz : c.raw);
  }
  function readBody(req) { return new Promise((resolve, reject) => { let n = 0; const chunks = []; req.on('data', d => { n += d.length; if (n > 64 * 1024) { reject(new Error('too big')); req.destroy(); } else chunks.push(d); }); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); }); }

  const server = http.createServer(async (req, res) => {
    try {
      const p = new URL(req.url, 'http://x').pathname;
      if (!p.startsWith('/api/')) { if ((req.method === 'GET' || req.method === 'HEAD') && (pages[p] || /^\/art\/[\w\/.-]+\.(glb|gz|jpg|png|json)$/.test(p) && !p.includes('..'))) return serveStatic(req, res, p); res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      let body = ''; if (req.method === 'POST') { try { body = await readBody(req); } catch (e) { res.writeHead(413, { 'Content-Type': 'application/json' }); return res.end('{"ok":false,"error":"请求太大"}'); } }
      const ip = (opts.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
      const secure = !!req.socket.encrypted || (opts.trustProxy && /https/.test(String(req.headers['x-forwarded-proto'] || '')));
      const r = await core.handle({ method: req.method, url: req.url, headers: req.headers, body, ip, secure });
      res.writeHead(r.status, r.headers); res.end(r.body);
    } catch (e) { try { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"server"}'); } catch (_) { } }
  });
  server.keepAliveTimeout = 30000;

  // ---- 定时任务（只有常驻进程才有；EdgeOne 上由 /api/cron 触发）----
  const timers = [];
  if (opts.npcCount > 0) await core.vill.ensure(Math.min(80, opts.npcCount));
  if (opts.npcCount > 0 && !opts.noTimers) { timers.push(setInterval(() => core.runNpc(Math.max(5000, opts.npcTickSec * 800)), opts.npcTickSec * 1000)); }
  if (!opts.noTimers) timers.push(setInterval(() => core.runMaint(), 600000), setInterval(() => core.flushMetrics(true), 15000));

  // ---- 备份：本地 SQLite 用 VACUUM INTO；Turso 由其云端自动备份 ----
  async function backup() {
    if (db.kind !== 'local' || opts.db === ':memory:') return null; fs.mkdirSync(opts.backupDir, { recursive: true });
    const name = 'farm-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16) + '.db', f = path.join(opts.backupDir, name);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    await db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
    const list = fs.readdirSync(opts.backupDir).filter(n => /^farm-.*\.db$/.test(n)).sort(); list.slice(0, Math.max(0, list.length - opts.backupKeep)).forEach(n => fs.unlinkSync(path.join(opts.backupDir, n)));
    return f;
  }
  if (opts.backupHours > 0 && db.kind === 'local' && opts.db !== ':memory:') timers.push(setInterval(() => { backup().then(f => { if (!opts.quiet) console.log('[backup]', f); }, e => console.error('[backup] 失败', e.message)); }, opts.backupHours * 3600000));
  timers.forEach(t => t.unref());

  const close = () => new Promise(r => { timers.forEach(clearInterval); core.flushMetrics(true); server.close(() => { setTimeout(() => { try { db.close(); } catch (e) { } r(); }, 50); }); server.closeAllConnections && server.closeAllConnections(); });
  return Object.assign({}, core, { server, backup, close, opts });
}

module.exports = { createApp, VERSION };

if (require.main === module) {
  // 兜底：任何遗漏的异步错误只记录，不让服务退出
  process.on('unhandledRejection', e => console.error('[unhandledRejection]', e && e.stack || e));
  createApp().then(app => {
    app.server.listen(ENV.port, ENV.host, () => console.log(`🌾 丰收农场 v${VERSION} 已启动：http://${ENV.host === '0.0.0.0' ? 'localhost' : ENV.host}:${ENV.port}  数据库：${app.db.kind === 'turso' ? 'Turso ' + ENV.tursoUrl : ENV.db}${ENV.testClock ? '  [测试时钟已开启]' : ''}`));
    const stop = () => { console.log('正在关闭…'); app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
  }, e => { console.error('启动失败：', e && e.stack || e); process.exit(1); });
}
