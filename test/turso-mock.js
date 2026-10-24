'use strict';
/* =====================================================
   本地模拟 Turso（Hrana v2 over HTTP）——只用于测试
   - 每个 baton（事务流）一条独立的 SQLite 连接，同一个 WAL 文件：
     并发写冲突（SQLITE_BUSY / BUSY_SNAPSHOT）和真实 Turso 一样会发生
   - latencyMs：每个请求人为增加的网络往返延迟
   ===================================================== */
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function startMock(o) {
  o = o || {};
  const file = o.file || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'turso-mock-')), 'db.sqlite');
  const token = o.token || 'test-token', latency = o.latencyMs || 0;
  const init = new DatabaseSync(file); init.exec('PRAGMA journal_mode=WAL'); init.close();
  const streams = new Map(); const stats = { requests: 0, statements: 0, busy: 0 };
  const conn = () => { const d = new DatabaseSync(file); d.exec('PRAGMA busy_timeout = 0'); return d; };
  const val = v => v === null || v === undefined ? { type: 'null' } : typeof v === 'bigint' ? { type: 'integer', value: v.toString() } : typeof v === 'number' ? (Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v }) : Buffer.isBuffer(v) || v instanceof Uint8Array ? { type: 'blob', base64: Buffer.from(v).toString('base64') } : { type: 'text', value: String(v) };
  // 和真实 Turso 一样严格：参数类型不对直接报错（例如 NaN 序列化后变成 null 的 float）
  const arg = a => { if (a.type === 'float' && typeof a.value !== 'number') throw new Error('Invalid float value: ' + JSON.stringify(a.value)); if (a.type === 'integer' && !/^-?\d+$/.test(String(a.value))) throw new Error('Invalid integer value: ' + JSON.stringify(a.value)); return arg0(a); };
  const arg0 = a => a.type === 'null' ? null : a.type === 'integer' ? (Number.isSafeInteger(Number(a.value)) ? Number(a.value) : BigInt(a.value)) : a.type === 'float' ? Number(a.value) : a.type === 'blob' ? Buffer.from(a.base64, 'base64') : a.value;
  function exec(db, s) {
    stats.statements++;
    const st = db.prepare(s.sql); const args = (s.args || []).map(arg);
    let rows = [], cols = [];
    if (st.columns().length) { const out = st.all(...args); cols = st.columns().map(c => ({ name: c.name, decltype: c.type || null })); rows = out.map(r => cols.map(c => val(r[c.name]))); return { cols, rows, affected_row_count: 0, last_insert_rowid: null }; }
    const r = st.run(...args); return { cols: [], rows: [], affected_row_count: Number(r.changes), last_insert_rowid: String(r.lastInsertRowid) };
  }
  const herr = e => { const m = String(e && e.message || e); if (/locked|busy/i.test(m)) stats.busy++; return { message: (/locked|busy/i.test(m) ? 'SQLITE_BUSY: ' : /constraint/i.test(m) ? 'SQLITE_CONSTRAINT: ' : '') + m, code: /locked|busy/i.test(m) ? 'SQLITE_BUSY' : /constraint/i.test(m) ? 'SQLITE_CONSTRAINT' : 'SQLITE_ERROR' }; };
  function cond(c, ok, err) {
    if (!c) return true;
    if (c.type === 'ok') return ok[c.step] !== undefined && ok[c.step] !== null;
    if (c.type === 'error') return err[c.step] !== undefined && err[c.step] !== null;
    if (c.type === 'not') return !cond(c.cond, ok, err);
    if (c.type === 'and') return c.conds.every(x => cond(x, ok, err));
    if (c.type === 'or') return c.conds.some(x => cond(x, ok, err));
    return true;
  }
  function handle(body) {
    stats.requests++;
    let baton = body.baton, s;
    if (baton) { s = streams.get(baton); if (!s) return { status: 400, json: { message: 'stream expired' } }; streams.delete(baton); }
    else s = { db: conn() };
    const results = []; let closed = false;
    for (const rq of body.requests || []) {
      try {
        if (rq.type === 'execute') results.push({ type: 'ok', response: { type: 'execute', result: exec(s.db, rq.stmt) } });
        else if (rq.type === 'batch') {
          const ok = [], err = [];
          rq.batch.steps.forEach((st, i) => { if (!cond(st.condition, ok, err)) { ok[i] = null; err[i] = null; return; } try { ok[i] = exec(s.db, st.stmt); err[i] = null; } catch (e) { ok[i] = null; err[i] = herr(e); } });
          results.push({ type: 'ok', response: { type: 'batch', result: { step_results: ok, step_errors: err } } });
        } else if (rq.type === 'sequence') { s.db.exec(rq.sql); results.push({ type: 'ok', response: { type: 'sequence' } }); }
        else if (rq.type === 'close') { closed = true; results.push({ type: 'ok', response: { type: 'close' } }); }
        else results.push({ type: 'error', error: { message: 'unsupported ' + rq.type } });
      } catch (e) { results.push({ type: 'error', error: herr(e) }); }
    }
    let nb = null;
    if (closed) { try { if (s.db.isTransaction) s.db.exec('ROLLBACK'); } catch (e) { } s.db.close(); }
    else { nb = crypto.randomBytes(12).toString('hex'); s.at = Date.now(); streams.set(nb, s); }
    return { status: 200, json: { baton: nb, base_url: null, results } };
  }
  // 超时未用的流：自动回滚关闭（真实 Turso 也会这样）
  const gc = setInterval(() => { const now = Date.now(); for (const [b, s] of streams) if (now - s.at > 10000) { try { if (s.db.isTransaction) s.db.exec('ROLLBACK'); s.db.close(); } catch (e) { } streams.delete(b); } }, 2000); gc.unref();
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', d => raw += d); req.on('end', () => {
      setTimeout(() => {
        if (req.headers.authorization !== 'Bearer ' + token) { res.writeHead(401); return res.end('{"message":"unauthorized"}'); }
        if (req.url !== '/v2/pipeline') { res.writeHead(404); return res.end('{}'); }
        let r; try { r = handle(JSON.parse(raw)); } catch (e) { r = { status: 500, json: { message: String(e.message) } }; }
        setTimeout(() => { res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r.json)); }, latency / 2);
      }, latency / 2);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    url: 'http://127.0.0.1:' + server.address().port, token, stats, file,
    close: () => new Promise(r => { clearInterval(gc); for (const s of streams.values()) { try { s.db.close(); } catch (e) { } } streams.clear(); server.close(() => r()); server.closeAllConnections && server.closeAllConnections(); }),
  })));
}
module.exports = { startMock };
