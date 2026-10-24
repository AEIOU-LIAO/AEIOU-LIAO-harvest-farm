'use strict';
/* SQLite（Node 内置 node:sqlite）+ 版本化迁移 */
const fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');

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
];

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  let v = (db.prepare('SELECT v FROM schema_version').get() || {}).v;
  if (v === undefined) { db.prepare('INSERT INTO schema_version (v) VALUES (0)').run(); v = 0; }
  for (let i = v; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(MIGRATIONS[i]); db.prepare('UPDATE schema_version SET v = ?').run(i + 1); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw new Error('迁移 v' + (i + 1) + ' 失败：' + e.message); }
  }
  // 预编译语句缓存
  const cache = new Map();
  db.q = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  db.get = (sql, ...a) => db.q(sql).get(...a);
  db.all = (sql, ...a) => db.q(sql).all(...a);
  db.run = (sql, ...a) => db.q(sql).run(...a);
  // 事务：同步执行，Node 单线程 + BEGIN IMMEDIATE 保证原子性
  db.tx = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; }
    catch (e) { try { db.exec('ROLLBACK'); } catch (_) { } throw e; }
  };
  return db;
}

module.exports = { open, SCHEMA_VERSION: MIGRATIONS.length };
