#!/usr/bin/env node
'use strict';
/* 运维命令：node server/cli.js <命令>
   backup                       立即备份数据库到 BACKUP_DIR
   restore <备份文件>            用备份覆盖当前数据库（需先停止服务）
   make-admin <账号>             把已绑定账号的玩家设为管理员
   reset-password <账号> <新密码> 重置玩家密码（会注销其所有登录）
   info                          显示数据库概况 */
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
const app = createApp(); const db = app.db;
try {
  if (cmd === 'backup') console.log('备份完成：', app.backup());
  else if (cmd === 'make-admin') { const r = db.run("UPDATE users SET role='admin' WHERE username=?", a1 || ''); console.log(r.changes ? `已将 ${a1} 设为管理员` : '没有找到该账号（需要先在游戏里绑定账号）'); }
  else if (cmd === 'reset-password') { U.checkPw(a2); const u = db.get('SELECT id FROM users WHERE username=?', a1 || ''); if (!u) throw new Error('没有找到该账号'); db.run('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(a2), u.id); db.run('DELETE FROM sessions WHERE user_id=?', u.id); console.log('密码已重置'); }
  else if (cmd === 'info') { const n = s => db.get(s).n; console.log({ users: n('SELECT COUNT(*) n FROM users'), bound: n('SELECT COUNT(*) n FROM users WHERE username IS NOT NULL'), admins: n("SELECT COUNT(*) n FROM users WHERE role='admin'"), friends: n('SELECT COUNT(*) n FROM friends') / 2, steals: n('SELECT COUNT(*) n FROM steals') }); }
  else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 9).join('\n')); }
} catch (e) { console.error('失败：', e.message); process.exitCode = 1; }
app.close();
