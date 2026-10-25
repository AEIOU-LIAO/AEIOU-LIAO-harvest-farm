'use strict';
/* 丰收农场 · 服务端玩法模块：账号：注册、登录、绑定、改密、找回、导出、注销、旧存档迁移、资料、图鉴、装扮
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  async newCode() { for (let i = 0; i < 50; i++) { const c = String(U.randInt(1000000, 9999999)); if (!(await this.db.get('SELECT 1 FROM users WHERE code=?', c))) return c; } throw new Error('无法生成玩家号'); },
  createUser(name, username, password) {
    return this.db.tx(async () => {
      const now = this.now();
      // 注册账号：账号就是昵称
      if (username) { username = U.cleanUsername(username); name = username; } else name = U.cleanName(name || '小农夫');
      if (username) { U.checkPw(password); if (await this.db.get('SELECT 1 FROM users WHERE username=?', username)) throw conflict('该账号已被注册', 'taken'); }
      const av = { skin: 0, hair: 0, hat: 1, band: 0, shirt: 0, bg: 0 };
      const r = await this.db.run('INSERT INTO users (code,username,pass_hash,name,avatar,gold,created_at,last_active) VALUES (?,?,?,?,?,?,?,?)',
        await this.newCode(), username || null, username ? U.hashPassword(password) : null, name, JSON.stringify(av), RULES.startGold, now, now);
      const uid = Number(r.lastInsertRowid);
      const vals = [], args = []; for (let i = 0; i < NPLOTS; i++) { vals.push('(?,?,?,?)'); args.push(uid, i, UNLOCK_ORDER.indexOf(i) < RULES.startPlots ? 1 : 0, now); }
      this.db.w('INSERT INTO plots (user_id,idx,u,t) VALUES ' + vals.join(','), ...args);
      this.addInv(uid, 'fert', 3);
      this.db.w("INSERT INTO cosmetics (user_id,item,at) VALUES (?, 'theme:classic', ?), (?, 'frame:none', ?)", uid, now, uid, now);
      this.db.w('INSERT INTO ledger (user_id,delta,reason,at) VALUES (?,?,?,?)', uid, RULES.startGold, 'start', now);
      this.metric('registrations');
      return uid;
    });
  },
  newSession(uid, ua) { const tok = U.randToken(32); const now = this.now(); this.db.w('INSERT INTO sessions (token_hash,user_id,created_at,last_seen,ua) VALUES (?,?,?,?,?)', U.sha256(tok), uid, now, now, String(ua || '').slice(0, 120)); return tok; },
  async auth(token) {
    if (!token) return null;
    const r = await this.db.get('SELECT u.*, s.token_hash AS s_hash, s.last_seen AS s_seen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?', U.sha256(token)); if (!r) return null;
    const now = this.now(); if (now - r.s_seen > 90 * 86400000) { this.db.w('DELETE FROM sessions WHERE token_hash=?', r.s_hash); return null; }
    const hash = r.s_hash; delete r.s_hash; const seen = r.s_seen; delete r.s_seen;
    // 在线时间：由调用方在事务提交后顺手写入（不参与事务冲突）
    const touch = [];
    if (now - seen > 60000) touch.push(['UPDATE sessions SET last_seen=? WHERE token_hash=?', now, hash]);
    if (now - r.last_active > 60000) { touch.push(['UPDATE users SET last_active=? WHERE id=?', now, r.id]); touch.push(['INSERT OR IGNORE INTO logins (user_id,day) VALUES (?,?)', r.id, CFG.dayKey(now)]); r.last_active = now; }
    return { user: r, tokenHash: hash, touch };
  },
  async peek(token) { if (!token) return null; return (await this.db.get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?', U.sha256(token))) || null; },
  async login(username, password) {
    const u = await this.db.get('SELECT * FROM users WHERE username=?', String(username || '').trim());
    if (!u || !U.checkPassword(password, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '账号或密码错误');
    return u;
  },
  bind(uid, username, password) {
    return this.db.tx(async () => {
      const u = await this.user(uid); if (u.username) throw bad('已经绑定过账号了'); username = U.cleanUsername(username); U.checkPw(password);
      if (await this.db.get('SELECT 1 FROM users WHERE username=?', username)) throw conflict('该账号已被注册', 'taken');
      const rec = U.randToken(9).replace(/[-_]/g, 'x').slice(0, 12).toUpperCase();
      // 绑定后昵称与账号保持一致
      this.db.wx(conflict('该账号已被注册', 'taken'), 'UPDATE users SET username=?, name=?, pass_hash=?, recovery_hash=? WHERE id=?', username, username, U.hashPassword(password), U.sha256(rec), uid);
      return { recovery: rec, name: username };
    });
  },
  async changePassword(uid, oldPw, newPw) { const u = await this.user(uid); if (!U.checkPassword(oldPw, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '原密码错误'); U.checkPw(newPw); this.db.w('UPDATE users SET pass_hash=? WHERE id=?', U.hashPassword(newPw), uid); this.db.w('DELETE FROM sessions WHERE user_id=?', uid); },
  async recover(username, code, newPw) {
    const u = await this.db.get('SELECT * FROM users WHERE username=?', String(username || '').trim());
    if (!u || !u.recovery_hash || U.sha256(String(code || '').trim().toUpperCase()) !== u.recovery_hash) throw new U.ApiError(401, 'bad_login', '账号或恢复码错误');
    U.checkPw(newPw); const rec = U.randToken(9).replace(/[-_]/g, 'x').slice(0, 12).toUpperCase();
    this.db.w('UPDATE users SET pass_hash=?, recovery_hash=? WHERE id=?', U.hashPassword(newPw), U.sha256(rec), u.id); this.db.w('DELETE FROM sessions WHERE user_id=?', u.id);
    return { user: u, recovery: rec };
  },
  async exportData(uid) {
    const T = sql => this.db.all(sql, uid);
    const [u, plots, inventory, friends, messages, codex, cosmetics, claims, market, ledger] = await all([this.user(uid), this.plots(uid), this.inv(uid), T('SELECT b AS friend, since FROM friends WHERE a=?'), T('SELECT kind,actor,data,at FROM messages WHERE user_id=?'), T('SELECT item,first_at,n FROM codex WHERE user_id=?'),
      T('SELECT item FROM cosmetics WHERE user_id=?'), T('SELECT key,at FROM claims WHERE user_id=?'), T('SELECT * FROM market WHERE seller=?'), T('SELECT delta,reason,at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 2000')]);
    const d = Object.assign({}, u); delete d.pass_hash; delete d.recovery_hash;
    return { exportedAt: new Date(this.now()).toISOString(), user: d, plots: plots.map(p => this.pubPlot(p)), inventory, friends, messages, codex, cosmetics, claims, market, ledger };
  },
  async deleteAccount(uid, password, confirm) {
    const u = await this.user(uid);
    if (u.username) { if (!U.checkPassword(password, u.pass_hash)) throw new U.ApiError(401, 'bad_login', '密码错误'); }
    else if (confirm !== '确认注销') throw bad('请输入“确认注销”');
    await this.db.tx(async () => {
      this.db.w("UPDATE market SET status='cancelled', done_at=? WHERE seller=? AND status='open'", this.now(), uid);
      ['steals WHERE thief=?', 'steals WHERE owner=?', 'helps WHERE helper=?', 'helps WHERE owner=?', 'guestbook WHERE author=?', 'idem WHERE user_id=?', 'ledger WHERE user_id=?', 'logins WHERE user_id=?'].forEach(t => this.db.w('DELETE FROM ' + t, uid));
      this.db.w('UPDATE messages SET actor=NULL WHERE actor=?', uid);
      // 显式删除子表（不依赖每个连接的外键设置）
      ['sessions', 'plots', 'inventory', 'messages', 'counters', 'claims', 'codex', 'cosmetics', 'orders', 'guestbook', 'blocks'].forEach(t => this.db.w(`DELETE FROM ${t} WHERE ${t === 'guestbook' ? 'owner' : 'user_id'}=?`, uid));
      ['friends WHERE a=? OR b=?', 'friend_requests WHERE src=? OR dst=?', 'visits WHERE owner=? OR visitor=?'].forEach(t => this.db.w('DELETE FROM ' + t, uid, uid));
      this.db.w('DELETE FROM users WHERE id=?', uid);
    });
  },
  // 旧版单机存档迁移：不信任客户端数值，只按上限折算一次“老玩家礼包”
  migrate(uid, old) {
    return this.db.tx(async () => {
      const u = await this.user(uid); if (u.migrated) throw conflict('已经迁移过旧存档了', 'done');
      const lv = clampN(parseInt(old && old.lv) || 1, 1, 30), gold = clampN(parseInt(old && old.gold) || 0, 0, 1e9);
      const gLv = Math.min(lv, 8), gGold = Math.min(gold, 3000) + 200, gFert = 5;
      if (gLv > u.lv) this.db.w('UPDATE users SET lv=?, exp=0 WHERE id=?', gLv, uid);
      this.addGold(uid, gGold, 'migrate'); this.addInv(uid, 'fert', gFert);
      this.db.w('UPDATE users SET migrated=1 WHERE id=?', uid);
      return { lv: Math.max(gLv, u.lv), gold: gGold, fert: gFert };
    });
  },

  codexList(uid) { return this.db.all('SELECT item,first_at,n FROM codex WHERE user_id=?', uid); },
  async cosmetics(uid) { return (await this.db.all('SELECT item FROM cosmetics WHERE user_id=?', uid)).map(r => r.item); },
  async buyCosmetic(uid, kind, id) {
    const list = kind === 'theme' ? CFG.THEMES : kind === 'frame' ? CFG.FRAMES : null; if (!list) throw bad('类型不对'); const it = list.find(x => x.id === id); if (!it) throw bad('不存在');
    if (await this.db.get('SELECT 1 FROM cosmetics WHERE user_id=? AND item=?', uid, kind + ':' + id)) throw conflict('已经拥有了', 'done');
    if (it.ach) throw bad('需要完成成就解锁'); this.addGold(uid, -it.price, 'cosmetic'); this.db.wx(conflict('已经拥有了', 'done'), 'INSERT INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, kind + ':' + id, this.now()); return {};
  },
  async updateProfile(uid, b) {
    const sets = [], args = [];
    if (b.name !== undefined) { sets.push('name=?'); args.push(U.cleanName(b.name)); }
    if (b.avatar !== undefined) { const A = CFG.AVATAR_OPTS, a = b.avatar || {}; const av = { skin: U.int(a.skin || 0, '肤色', 0, A.skin.length - 1), hair: U.int(a.hair || 0, '发色', 0, A.hair.length - 1), hat: a.hat ? 1 : 0, fringe: a.fringe ? 1 : 0, pig: a.pig ? 1 : 0, band: U.int(a.band || 0, '帽带', 0, A.band.length - 1), shirt: U.int(a.shirt || 0, '衣服', 0, A.shirt.length - 1), bg: U.int(a.bg || 0, '背景', 0, A.bg.length - 1) }; sets.push('avatar=?'); args.push(JSON.stringify(av)); }
    const own = (b.theme !== undefined || b.frame !== undefined) ? new Set(await this.cosmetics(uid)) : new Set();
    if (b.theme !== undefined) { if (!own.has('theme:' + b.theme)) throw bad('还没有这个主题'); sets.push('theme=?'); args.push(b.theme); }
    if (b.frame !== undefined) { if (!own.has('frame:' + b.frame)) throw bad('还没有这个头像框'); sets.push('frame=?'); args.push(b.frame); }
    if (b.title !== undefined) { if (b.title) { const a = CFG.ACHIEVEMENTS.find(x => x.title === b.title); if (!a || !(await this.db.get('SELECT 1 FROM claims WHERE user_id=? AND key=?', uid, 'ach:' + a.id))) throw bad('还没有获得这个称号'); } sets.push('title=?'); args.push(b.title || ''); }
    if (b.seed !== undefined) { const c = U.int(b.seed, '种子', 0, CROPS.length - 1); sets.push('seed=?'); args.push(c); }
    if (b.settings !== undefined) { const s = b.settings || {}; const clean = { sound: !!s.sound, music: !!s.music, notify: !!s.notify, tod: ['auto', 'day', 'dusk', 'night'].includes(s.tod) ? s.tod : 'auto', tut: U.int(s.tut || 0, '引导', 0, 99), mvol: U.int(s.mvol === undefined ? 70 : s.mvol, '音乐音量', 0, 100), svol: U.int(s.svol === undefined ? 80 : s.svol, '音效音量', 0, 100), pan: U.int(s.pan || 0, '提示', 0, 9), v3char: !!s.v3char, v3hero: CFG.ASSETS.some(a => a.id === s.v3hero && a.kind === 'hero') ? s.v3hero : '' }; sets.push('settings=?'); args.push(JSON.stringify(clean)); }
    if (sets.length) this.db.w(`UPDATE users SET ${sets.join(',')} WHERE id=?`, ...args, uid); return {};
  },
};
