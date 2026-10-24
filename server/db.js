'use strict';
/* =====================================================
   数据库层：同一套异步接口，两种后端
   - local：Node 内置 node:sqlite（自己的服务器 / 本机）
   - turso：Turso 云数据库，经 HTTP（Hrana v2）访问，用于 EdgeOne 等无服务器平台
   接口（全部异步）：
     get(sql,...a) / all(sql,...a) / run(sql,...a) → {changes,lastInsertRowid}
     w(sql,...a)        事务内的“延迟写”：不等结果，随下一次读取或提交一起发出（省网络往返）
     wx(err,sql,...a)   同上，但该语句失败（约束不满足）时抛出 err
     tx(async fn)       事务；可重入；遇到写冲突自动重试
     sp(async fn)       事务内保存点；fn 抛错只回滚这一段
     exec(多条sql) / close()
   ===================================================== */
const { AsyncLocalStorage } = require('async_hooks');

const MIGRATIONS = [
  // v1 初始结构
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE COLLATE NOCASE,
    pass_hash TEXT,
    recovery_hash TEXT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '{}',
    title TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'classic',
    frame TEXT NOT NULL DEFAULT 'none',
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    exp INTEGER NOT NULL DEFAULT 0 CHECK (exp >= 0),
    lv INTEGER NOT NULL DEFAULT 1,
    seed INTEGER NOT NULL DEFAULT 0,
    dog_own INTEGER NOT NULL DEFAULT 0, dog_lv INTEGER NOT NULL DEFAULT 1, dog_exp INTEGER NOT NULL DEFAULT 0, dog_until INTEGER NOT NULL DEFAULT 0,
    checkin_last TEXT NOT NULL DEFAULT '', checkin_streak INTEGER NOT NULL DEFAULT 0,
    harvest_total INTEGER NOT NULL DEFAULT 0, steal_total INTEGER NOT NULL DEFAULT 0, help_total INTEGER NOT NULL DEFAULT 0,
    plant_total INTEGER NOT NULL DEFAULT 0, earned_total INTEGER NOT NULL DEFAULT 0, golden_total INTEGER NOT NULL DEFAULT 0,
    order_total INTEGER NOT NULL DEFAULT 0, stolen_from_total INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user', banned INTEGER NOT NULL DEFAULT 0, ban_reason TEXT NOT NULL DEFAULT '',
    migrated INTEGER NOT NULL DEFAULT 0, settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL, last_active INTEGER NOT NULL
  );
  CREATE INDEX users_name ON users(name);
  CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, ua TEXT NOT NULL DEFAULT '');
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE plots (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, idx INTEGER NOT NULL,
    u INTEGER NOT NULL DEFAULT 0, soil INTEGER NOT NULL DEFAULT 0, c INTEGER NOT NULL DEFAULT -1,
    p REAL NOT NULL DEFAULT 0, t INTEGER NOT NULL DEFAULT 0, sea INTEGER NOT NULL DEFAULT 0,
    y INTEGER NOT NULL DEFAULT 0 CHECK (y >= 0), y0 INTEGER NOT NULL DEFAULT 0, stolen INTEGER NOT NULL DEFAULT 0 CHECK (stolen >= 0),
    pr TEXT NOT NULL DEFAULT '{"d":0,"w":0,"b":0}', ev TEXT NOT NULL DEFAULT '[]', ra INTEGER NOT NULL DEFAULT 0,
    cycle INTEGER NOT NULL DEFAULT 0, golden INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, idx)
  );
  CREATE TABLE inventory (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item TEXT NOT NULL, qty INTEGER NOT NULL CHECK (qty >= 0), PRIMARY KEY (user_id, item));
  CREATE TABLE steals (id INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER NOT NULL, thief INTEGER NOT NULL, idx INTEGER NOT NULL, cycle INTEGER NOT NULL, crop INTEGER NOT NULL, qty INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL,
    UNIQUE (owner, idx, cycle, thief));
  CREATE INDEX steals_thief ON steals(thief, at);
  CREATE INDEX steals_owner ON steals(owner, at);
  CREATE TABLE helps (owner INTEGER NOT NULL, helper INTEGER NOT NULL, idx INTEGER NOT NULL, cycle INTEGER NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (owner, idx, cycle, kind, at));
  CREATE TABLE friends (a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, since INTEGER NOT NULL, PRIMARY KEY (a, b));
  CREATE TABLE friend_requests (src INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, dst INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, at INTEGER NOT NULL, PRIMARY KEY (src, dst));
  CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, actor INTEGER, data TEXT NOT NULL DEFAULT '{}', at INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX messages_user ON messages(user_id, id);
  CREATE TABLE visits (owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, visitor INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, at INTEGER NOT NULL, PRIMARY KEY (owner, visitor));
  CREATE TABLE counters (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, period TEXT NOT NULL, key TEXT NOT NULL, val INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, period, key));
  CREATE INDEX counters_rank ON counters(period, key, val);
  CREATE TABLE claims (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, key));
  CREATE TABLE codex (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item TEXT NOT NULL, first_at INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, item));
  CREATE TABLE cosmetics (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, item));
  CREATE TABLE market (id INTEGER PRIMARY KEY AUTOINCREMENT, seller INTEGER NOT NULL, item TEXT NOT NULL, qty INTEGER NOT NULL CHECK (qty > 0), price INTEGER NOT NULL CHECK (price > 0),
    status TEXT NOT NULL DEFAULT 'open', buyer INTEGER, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, done_at INTEGER);
  CREATE INDEX market_open ON market(status, item, price);
  CREATE INDEX market_seller ON market(seller, status);
  CREATE TABLE orders (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, slot INTEGER NOT NULL, item TEXT NOT NULL, qty INTEGER NOT NULL, gold INTEGER NOT NULL, exp INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day, slot));
  CREATE TABLE guestbook (id INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, author INTEGER NOT NULL, phrase INTEGER NOT NULL, at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX guestbook_owner ON guestbook(owner, id);
  CREATE TABLE blocks (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked INTEGER NOT NULL, PRIMARY KEY (user_id, blocked));
  CREATE TABLE idem (user_id INTEGER NOT NULL, key TEXT NOT NULL, resp TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, key));
  CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT NOT NULL, params TEXT NOT NULL DEFAULT '{}', start_at INTEGER NOT NULL, end_at INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, descr TEXT NOT NULL DEFAULT '');
  CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE audit (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '{}', at INTEGER NOT NULL);
  CREATE TABLE logins (user_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
  CREATE TABLE metrics (day TEXT NOT NULL, key TEXT NOT NULL, val INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, key));
  CREATE TABLE errors (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, route TEXT NOT NULL, msg TEXT NOT NULL);
  CREATE TABLE ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE INDEX ledger_user ON ledger(user_id, id);
  `,
  // v2 无服务器部署：后台任务（NPC、清理）用的租约表
  `CREATE TABLE IF NOT EXISTS leases (name TEXT PRIMARY KEY, until INTEGER NOT NULL, at INTEGER NOT NULL DEFAULT 0);`,
];

const BUSY = /SQLITE_BUSY|database is locked|SQLITE_LOCKED|BUSY_SNAPSHOT/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const splitSql = s => s.split(/;\s*(?:\n|$)/).map(x => x.trim()).filter(Boolean);

/* ---------------- 通用外壳：迁移、事务上下文 ---------------- */
function wrap(B) {
  const als = new AsyncLocalStorage();
  const db = { kind: B.kind };
  const cur = () => als.getStore() || null;
  db.inTx = () => !!cur();
  db.get = async (sql, ...a) => (await B.query(cur(), sql, a, 'get'));
  db.all = async (sql, ...a) => (await B.query(cur(), sql, a, 'all'));
  db.run = async (sql, ...a) => (await B.query(cur(), sql, a, 'run'));
  db.exec = async sql => B.exec(cur(), sql);
  db.w = (sql, ...a) => db.wx(null, sql, ...a); // 返回排队中的语句（远端时可在发出前修改参数）；本地返回 null
  db.wx = (err, sql, ...a) => {
    const t = cur();
    if (!t) { const p = B.query(null, sql, a, 'run'); p.catch(e => { if (err && /constraint/i.test(e.message)) return; console.error('[db] 后台写入失败', e.message); }); return; }
    return B.defer(t, sql, a, err);
  };
  // 事务外的“顺手写”（在线时间、统计）：不等结果、不参与当前事务，避免让请求因此冲突重试
  db.bg = (sql, ...a) => { (async () => { for (let i = 0; ; i++) { try { return await B.query(null, sql, a, 'run'); } catch (e) { if (BUSY.test(e.message) && i < 6) { await sleep(30 * (i + 1) + Math.random() * 50); continue; } throw e; } } })().catch(e => console.error('[db] 后台写入失败', e.message)); };
  // 事务内的数据缓存（由游戏逻辑维护：读过的玩家/土地/库存/计数器）；保存点回滚时一起恢复
  db.cache = () => { const t = cur(); if (!t) return null; return t.gc || (t.gc = { u: {}, plots: {}, inv: {}, cnt: {}, memo: {} }); };
  db.aside = () => { const t = cur(); if (!t) return null; return t.aside || (t.aside = {}); }; // 不随保存点回滚的附加状态
  // 最后一次读取与提交合并：fn 里发出的第一批查询会带上 COMMIT（省一次往返）。fn 只能读不能写
  db.final = async fn => { const t = cur(); if (!t || !B.finalize) return fn(); B.finalize(t); return fn(); };
  db.flush = async () => { const t = cur(); if (t) await B.flush(t); };
  db.stats = { tx: 0, retries: 0 };
  // 本实例内的写事务排队（先来先到）：冲突后的重试在这里有序执行，不再互相“抢锁”
  let wchain = Promise.resolve();
  const wlock = () => { let rel; const p = new Promise(r => rel = r); const prev = wchain; wchain = wchain.then(() => p); return prev.then(() => rel); };
  db.tx = async (fn, opts) => {
    if (cur()) return fn();
    opts = opts || {};
    for (let attempt = 0; ; attempt++) {
      // 第一次：乐观执行（不加锁，并发最好）；一旦冲突：排队 + 排他锁执行，保证一定能完成
      const exclusive = !!opts.write || attempt >= 1;
      const unlock = exclusive && B.kind !== 'local' ? await wlock() : null;
      let t = null;
      try {
        t = await B.begin({ write: exclusive }); db.stats.tx++;
        const r = await als.run(t, fn); await B.commit(t); return r;
      } catch (e) {
        if (t) await B.rollback(t).catch(() => { });
        if (BUSY.test(String(e && e.message)) && attempt < 6) { db.stats.retries++; if (!unlock) await sleep(5 + Math.random() * 20); continue; }
        throw e;
      } finally { if (t && B.release) B.release(t); if (unlock) unlock(); }
    }
  };
  db.sp = async fn => {
    const t = cur(); if (!t) return db.tx(fn, { write: true });
    const name = 'sp' + (++t.spn); const mark = B.defer(t, 'SAVEPOINT ' + name, [], null);
    const snap = t.gc ? structuredClone(t.gc) : null;
    try { const r = await fn(); B.defer(t, 'RELEASE ' + name, [], null); return r; }
    catch (e) { await B.undo(t, mark, name); t.gc = snap || undefined; throw e; }
  };
  db.close = () => B.close && B.close();
  db.migrate = async () => {
    await B.exec(null, 'CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
    const v0 = (await db.get('SELECT v FROM schema_version') || {}).v; if (v0 === MIGRATIONS.length) return db; // 已是最新：冷启动不加锁
    await db.tx(async () => {
      let v = (await db.get('SELECT v FROM schema_version') || {}).v;
      if (v === undefined) { await db.run('INSERT INTO schema_version (v) VALUES (0)'); v = 0; }
      for (let i = v; i < MIGRATIONS.length; i++) {
        try { await db.exec(MIGRATIONS[i]); } catch (e) { throw new Error('迁移 v' + (i + 1) + ' 失败：' + e.message); }
        await db.run('UPDATE schema_version SET v = ?', i + 1);
      }
    }, { write: true });
    return db;
  };
  return db;
}

/* ---------------- 后端 1：本地 node:sqlite ---------------- */
function localBackend(file) {
  const fs = require('fs'), path = require('path');
  const { DatabaseSync } = require('node:sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sq = new DatabaseSync(file);
  sq.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const cache = new Map();
  const st = sql => { let s = cache.get(sql); if (!s) { s = sq.prepare(sql); cache.set(sql, s); } return s; };
  // 单连接：同一时间只允许一个事务（或一条事务外语句）在跑，其他排队
  let chain = Promise.resolve();
  const lock = () => { let rel; const p = new Promise(r => rel = r); const prev = chain; chain = chain.then(() => p); return prev.then(() => rel); };
  const exe = (sql, a, mode) => { const s = st(sql); if (mode === 'get') return s.get(...a); if (mode === 'all') return s.all(...a); const r = s.run(...a); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; };
  return {
    kind: 'local', raw: sq,
    async query(t, sql, a, mode) { if (t) return exe(sql, a, mode); const rel = await lock(); try { return exe(sql, a, mode); } finally { rel(); } },
    async exec(t, sql) { if (t) return sq.exec(sql); const rel = await lock(); try { sq.exec(sql); } finally { rel(); } },
    defer(t, sql, a, err) { // 本地无网络开销：立即执行
      try { exe(sql, a, 'run'); } catch (e) { if (err && /constraint/i.test(e.message)) throw err; throw e; }
      return null;
    },
    async flush() { },
    async undo(t, mark, name) { sq.exec('ROLLBACK TO ' + name); sq.exec('RELEASE ' + name); },
    async begin(o) { const rel = await lock(); try { sq.exec(o.write === false ? 'BEGIN' : 'BEGIN IMMEDIATE'); } catch (e) { rel(); throw e; } return { rel, spn: 0, risky: false }; },
    async commit() { sq.exec('COMMIT'); },
    async rollback() { try { sq.exec('ROLLBACK'); } catch (e) { } },
    release(t) { t.rel(); },
    close() { sq.close(); },
  };
}

/* ---------------- 后端 2：Turso（Hrana v2 over HTTP） ---------------- */
function tursoBackend(url, token, opts) {
  opts = opts || {};
  let base = String(url).trim().replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) base = 'https://' + base;
  const fetchImpl = opts.fetch || fetch;
  const enc = v => {
    if (v === null || v === undefined) return { type: 'null' };
    if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
    if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
    if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
    if (Buffer.isBuffer(v)) return { type: 'blob', base64: v.toString('base64') };
    return { type: 'text', value: String(v) };
  };
  const dec = c => { if (!c || c.type === 'null') return null; if (c.type === 'integer') return Number(c.value); if (c.type === 'float') return Number(c.value); if (c.type === 'blob') return Buffer.from(c.base64, 'base64'); return c.value; };
  const stmt = (sql, a) => ({ sql, args: (a || []).map(enc), want_rows: true });
  const shape = (res, mode) => {
    if (mode === 'run') return { changes: Number(res.affected_row_count || 0), lastInsertRowid: Number(res.last_insert_rowid || 0) };
    const names = res.cols.map(c => c.name); const rows = res.rows.map(r => { const o = {}; r.forEach((c, i) => o[names[i]] = dec(c)); return o; });
    return mode === 'get' ? rows[0] : rows;
  };
  const hErr = e => { const m = (e && (e.message || e.code)) || '数据库错误'; const x = new Error(m); x.code = e && e.code; return x; };
  const stats = { requests: 0 };
  async function pipeline(t, requests) {
    stats.requests++;
    const target = (t && t.base) || base;
    let r, j;
    for (let i = 0; ; i++) {
      try {
        r = await fetchImpl(target + '/v2/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ baton: t ? t.baton : null, requests }) });
        if (r.status >= 500 && i < 2 && !(t && t.baton)) { await sleep(150 * (i + 1)); continue; }
        break;
      } catch (e) { if (i < 2 && !(t && t.baton)) { await sleep(150 * (i + 1)); continue; } throw new Error('无法连接数据库：' + e.message); }
    }
    const text = await r.text(); try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok || !j) throw new Error('数据库请求失败（HTTP ' + r.status + '）：' + String(text).slice(0, 200));
    if (t) { t.baton = j.baton || null; if (j.base_url) t.base = String(j.base_url).replace(/\/+$/, ''); }
    return j.results;
  }
  // 事务外：同一时刻发起的多条查询合并成一次请求
  let pend = null;
  function queueAuto(sql, a, mode) {
    return new Promise((resolve, reject) => {
      if (!pend) { pend = []; queueMicrotask(flushAuto); }
      pend.push({ sql, a, mode, resolve, reject });
    });
  }
  async function flushAuto() {
    const list = pend; pend = null;
    try {
      const res = await pipeline(null, list.map(q => ({ type: 'execute', stmt: stmt(q.sql, q.a) })).concat([{ type: 'close' }]));
      list.forEach((q, i) => { const x = res[i]; if (!x || x.type !== 'ok') q.reject(hErr(x && x.error)); else q.resolve(shape(x.response.result, q.mode)); });
    } catch (e) { list.forEach(q => q.reject(e)); }
  }
  // 事务内：延迟写 + 读取合并，按顺序以一个带条件的 batch 发出（前一步失败，后面全部跳过）
  function send(t, close) {
    if (t.inflight) return t.inflight.then(() => send(t, close));
    const q = t.queue; t.queue = []; if (!q.length) return Promise.resolve();
    const steps = []; if (!t.began) { steps.push({ stmt: stmt('PRAGMA foreign_keys = ON') }); steps.push({ stmt: stmt(t.write ? 'BEGIN IMMEDIATE' : 'BEGIN') }); }
    const off = steps.length; q.forEach(x => steps.push({ stmt: stmt(x.sql, x.a) }));
    const fin = t.closing && !t.committed; if (fin) { steps.push({ stmt: stmt('COMMIT') }); close = true; }
    steps.forEach((s, i) => { if (i > 0) s.condition = { type: 'ok', step: i - 1 }; });
    const wasBegan = t.began; t.began = true; t.sent = q[q.length - 1].seq; t.risky = false; q.forEach(x => x.sent = true);
    const p = (async () => {
      let res;
      try {
        for (let i = 0; ; i++) {
          res = (await pipeline(t, close ? [{ type: 'batch', batch: { steps } }, { type: 'close' }] : [{ type: 'batch', batch: { steps } }]))[0];
          // 排他事务第一次拿写锁失败（别的实例正在写）：后面的步骤都没执行，稍等后原样重发（最多约 10 秒）
          if (!wasBegan && t.write && res && res.type === 'ok') { const be = res.response.result.step_errors[1]; if (be && BUSY.test(be.message || '') && i < 60) { await sleep(Math.min(250, 20 + i * 15) * (0.6 + Math.random() * 0.8)); continue; } }
          break;
        }
      }
      catch (e) { q.forEach(x => x.reject && x.reject(e)); throw e; }
      if (!res || res.type !== 'ok') { const e = hErr(res && res.error); q.forEach(x => x.reject && x.reject(e)); throw e; }
      const R = res.response.result;
      if (!wasBegan) { const e0 = R.step_errors[0] || R.step_errors[1]; if (e0) { t.began = false; const e = hErr(e0); q.forEach(x => x.reject && x.reject(e)); throw e; } }
      let failed = null;
      q.forEach((x, i) => {
        const k = off + i, er = R.step_errors[k], ok = R.step_results[k];
        if (failed) { x.reject && x.reject(failed); return; }
        if (er) { failed = (x.err && /constraint/i.test(er.message || '')) ? x.err : hErr(er); x.reject && x.reject(failed); return; }
        x.resolve && x.resolve(shape(ok, x.mode));
      });
      if (failed) throw failed;
      if (fin) { const ce = R.step_errors[steps.length - 1]; if (ce || !R.step_results[steps.length - 1]) throw hErr(ce || { message: '提交失败' }); t.committed = true; t.baton = null; }
    })();
    t.inflight = p.finally(() => { t.inflight = null; }).catch(() => { });
    return p;
  }
  return {
    kind: 'turso', stats, pipeline,
    query(t, sql, a, mode) {
      if (!t) return queueAuto(sql, a, mode);
      if (mode === 'run') t.wrote = true;
      let pr; const p = new Promise((resolve, reject) => { pr = { resolve, reject }; });
      p.catch(() => { }); // 没人等待的查询失败时不触发 unhandledRejection（等待者仍会收到错误）
      {
        const { resolve, reject } = pr;
        t.queue.push({ seq: ++t.seq, sql, a, mode, resolve, reject });
        if (!t.tick) { t.tick = true; queueMicrotask(() => { t.tick = false; send(t).catch(() => { }); }); }
      }
      return p;
    },
    async exec(t, sql) {
      if (!t) { const res = await pipeline(null, [{ type: 'sequence', sql }, { type: 'close' }]); if (res[0].type !== 'ok') throw hErr(res[0].error); return; }
      for (const s of splitSql(sql)) await this.query(t, s, [], 'run');
    },
    defer(t, sql, a, err) { const e = { seq: ++t.seq, sql, a, mode: 'run', err }; t.queue.push(e); if (err) t.risky = true; if (!/^(SAVEPOINT|RELEASE)/.test(sql)) t.wrote = true; return e; },
    flush(t) { return send(t); },
    async undo(t, mark, name) {
      if (t.inflight) await t.inflight;
      if (mark && mark.seq > t.sent) { t.queue = t.queue.filter(x => x.seq < mark.seq); return; } // 保存点还没发出：直接丢弃这段
      t.queue = []; t.queue.push({ seq: ++t.seq, sql: 'ROLLBACK TO ' + name, a: [] }, { seq: ++t.seq, sql: 'RELEASE ' + name, a: [] });
    },
    // 排他模式：先单独拿到写锁再执行业务（拿不到就短暂等待重试，最多约 10 秒）
    async acquire(t) {
      for (let i = 0; ; i++) {
        const res = (await pipeline(t, [{ type: 'batch', batch: { steps: [{ stmt: stmt('PRAGMA foreign_keys = ON') }, { stmt: stmt('BEGIN IMMEDIATE'), condition: { type: 'ok', step: 0 } }] } }]))[0];
        const er = res && res.type === 'ok' ? (res.response.result.step_errors[0] || res.response.result.step_errors[1]) : (res && res.error);
        if (!er) { t.began = true; return; }
        if (!BUSY.test(er.message || '') || i >= 60) throw hErr(er);
        await sleep(Math.min(250, 20 + i * 15) * (0.6 + Math.random() * 0.8));
      }
    },
    async begin(o) { return { baton: null, base: null, began: false, write: !!o.write, queue: [], seq: 0, sent: 0, spn: 0, risky: false, wrote: false, inflight: null, tick: false }; },
    finalize(t) { t.closing = true; },
    async commit(t) {
      if (t.inflight) await t.inflight;
      if (t.committed) return;
      t.closing = false;
      if (!t.began && !t.queue.length) return;
      if (!t.wrote) { const b = t.baton; t.baton = null; if (b) pipeline({ baton: b, base: t.base }, [{ type: 'execute', stmt: stmt('COMMIT') }, { type: 'close' }]).catch(() => { }); return; } // 只读：不必等
      // 最后一批延迟写 + COMMIT 合并成一次请求
      t.queue.push({ seq: ++t.seq, sql: 'COMMIT', a: [], mode: 'run' });
      await send(t, true); t.baton = null;
    },
    async rollback(t) {
      if (t.inflight) await t.inflight.catch(() => { });
      if (!t.baton || t.committed) return;
      try { await pipeline(t, [{ type: 'execute', stmt: stmt('ROLLBACK') }, { type: 'close' }]); } catch (e) { } t.baton = null;
    },
    close() { },
  };
}

/* 打开数据库：TURSO_DATABASE_URL 存在时用 Turso，否则用本地文件 */
async function open(o) {
  if (typeof o === 'string') o = { file: o };
  const B = o.tursoUrl ? tursoBackend(o.tursoUrl, o.tursoToken || '', o) : localBackend(o.file);
  const db = wrap(B); db.backend = B;
  await db.migrate();
  return db;
}

module.exports = { open, SCHEMA_VERSION: MIGRATIONS.length, MIGRATIONS };
