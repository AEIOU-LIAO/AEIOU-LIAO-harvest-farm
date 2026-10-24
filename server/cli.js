#!/usr/bin/env node
'use strict';
/* 运维命令：node server/cli.js <命令>
   backup                       立即备份数据库到 BACKUP_DIR
   restore <备份文件>            用备份覆盖当前数据库（需先停止服务）
   make-admin <账号>             把已绑定账号的玩家设为管理员（设置 TURSO_DATABASE_URL 后对 Turso 生效）
   reset-password <账号> <新密码> 重置玩家密码（会注销其所有登录）
   info                          显示数据库概况
   dump <文件.json>               把整个数据库导出成 JSON（本地 SQLite 和 Turso 都可以）
   load <文件.json> --yes         用导出文件覆盖当前数据库（会清空现有数据） */
const fs = require('fs'), path = require('path');
process.env.BACKUP_HOURS = '0'; process.env.QUIET = '1';
const { createApp } = require('./index');
const U = require('./util');
const [cmd, a1, a2] = process.argv.slice(2);

if (cmd === 'restore') {
  const ROOT = path.resolve(__dirname, '..'); const dbPath = path.resolve(ROOT, process.env.DB_PATH || 'data/farm.db');
  if (!a1 || !fs.existsSync(a1)) { console.error('请指定存在的备份文件'); process.exit(1); }
  if (fs.existsSync(dbPath)) { const keep = dbPath + '.before-restore-' + Date.now(); fs.copyFileSync(dbPath, keep); console.log('已把当前数据库另存为', keep); }
  ['', '-wal', '-shm'].forEach(s => { try { fs.unlinkSync(dbPath + s); } catch (e) { } });
  fs.copyFileSync(a1, dbPath); console.log('已恢复：', a1, '→', dbPath); process.exit(0);
}
(async () => {
  const app = await createApp({ noTimers: true, npcCount: 0 }); const db = app.db;
  try {
    if (cmd === 'backup') console.log(db.kind === 'turso' ? 'Turso 数据库由 Turso 云端自动备份，可在 Turso 控制台恢复' : '备份完成：' + await app.backup());
    else if (cmd === 'make-admin') { const r = await db.run("UPDATE users SET role='admin' WHERE username=?", a1 || ''); console.log(r.changes ? `已将 ${a1} 设为管理员` : '没有找到该账号（需要先在游戏里绑定账号）'); }
    else if (cmd === 'reset-password') { U.checkPw(a2); const u = await db.get('SELECT id FROM users WHERE username=?', a1 || ''); if (!u) throw new Error('没有找到该账号'); await db.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(a2), u.id); await db.run('DELETE FROM sessions WHERE user_id=?', u.id); console.log('密码已重置'); }
    else if (cmd === 'dump') {
      if (!a1) throw new Error('请指定导出文件，例如 backup.json');
      const tables = (await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map(r => r.name);
      const out = { app: 'harvest-farm', at: new Date().toISOString(), tables: {} }; let n = 0;
      for (const t of tables) { out.tables[t] = await db.all(`SELECT * FROM "${t}"`); n += out.tables[t].length; }
      fs.writeFileSync(a1, JSON.stringify(out)); console.log(`已导出 ${tables.length} 张表、${n} 行 → ${a1}`);
    }
    else if (cmd === 'load') {
      if (!a1 || !fs.existsSync(a1)) throw new Error('请指定存在的导出文件'); if (a2 !== '--yes') throw new Error('会清空当前数据库，确认请在最后加 --yes');
      const data = JSON.parse(fs.readFileSync(a1, 'utf8')); if (data.app !== 'harvest-farm') throw new Error('不是本游戏的导出文件');
      let n = 0;
      // 先删子表、后删玩家表；先插玩家表、后插子表；外键检查推迟到提交时
      const names = Object.keys(data.tables).filter(t => t !== 'schema_version').sort((x, y) => (x === 'users' ? -1 : y === 'users' ? 1 : x.localeCompare(y)));
      await db.tx(async () => {
        await db.run('PRAGMA defer_foreign_keys = ON');
        for (const t of names.slice().reverse()) await db.run(`DELETE FROM "${t}"`);
        for (const t of names) {
          const rows = data.tables[t];
          for (let i = 0; i < rows.length; i += 200) { const part = rows.slice(i, i + 200); if (!part.length) continue; const cols = Object.keys(part[0]); await db.run(`INSERT INTO "${t}" (${cols.map(c => '"' + c + '"').join(',')}) VALUES ${part.map(() => '(' + cols.map(() => '?').join(',') + ')').join(',')}`, ...[].concat(...part.map(r => cols.map(c => r[c])))); n += part.length; }
        }
      }, { write: true });
      console.log(`已恢复 ${n} 行（来自 ${data.at}）`);
    }
    else if (cmd === 'info') { const n = async s => (await db.get(s)).n; console.log({ db: db.kind, users: await n("SELECT COUNT(*) n FROM users WHERE role<>'npc'"), npcs: await n("SELECT COUNT(*) n FROM users WHERE role='npc'"), bound: await n('SELECT COUNT(*) n FROM users WHERE username IS NOT NULL'), admins: await n("SELECT COUNT(*) n FROM users WHERE role='admin'"), friends: await n('SELECT COUNT(*) n FROM friends') / 2, steals: await n('SELECT COUNT(*) n FROM steals') }); }
    else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 9).join('\n')); }
  } catch (e) { console.error('失败：', e.message); process.exitCode = 1; }
  await app.close();
})();
