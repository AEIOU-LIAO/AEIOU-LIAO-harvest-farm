'use strict';
/* 丰收农场 · 服务端玩法模块：好友、附近的人、串门、偷菜、帮忙、留言板、消息
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  async findUser(q) { q = String(q || '').trim(); if (!q) throw bad('请输入玩家号或昵称'); if (/^\d{7}$/.test(q)) return this.db.all('SELECT * FROM users WHERE code=? AND banned=0', q); return this.db.all("SELECT * FROM users WHERE name LIKE ? ESCAPE '\\' AND banned=0 ORDER BY last_active DESC LIMIT 20", '%' + q.replace(/[%_\\]/g, '\\$&') + '%'); },
  async search(uid, q) {
    const [rows, fr, pend] = await all([this.findUser(q), this.friendSet(uid), this.db.all('SELECT dst FROM friend_requests WHERE src=?', uid)]); const ps = new Set(pend.map(r => r.dst));
    return rows.filter(u => u.id !== uid).map(u => Object.assign(this.publicUser(u), { friend: fr.has(u.id), pending: ps.has(u.id) }));
  },
  async makeFriends(a, b) {
    if (a === b) throw bad('不能加自己为好友');
    const [isF, na, nb] = await all([this.isFriend(a, b), this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', a), this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', b)]);
    if (isF) return false; if (na.n >= 1000 || nb.n >= 1000) throw conflict('好友数量已达上限 1000', 'limit');
    const now = this.now(); this.db.w('INSERT OR IGNORE INTO friends (a,b,since) VALUES (?,?,?),(?,?,?)', a, b, now, b, a, now);
    this.db.w('DELETE FROM friend_requests WHERE (src=? AND dst=?) OR (src=? AND dst=?)', a, b, b, a);
    this.bump(a, 'friend', 1, 'all'); this.bump(b, 'friend', 1, 'all'); this.metric('friend_adds');
    await all([this.msg(a, 'friend_ok', b, {}), this.msg(b, 'friend_ok', a, {})]); return true;
  },
  async requestFriend(uid, targetId) {
    const t = await this.user(targetId); if (t.id === uid) throw bad('不能加自己为好友');
    const [isF, blk, rev, sent] = await all([this.isFriend(uid, t.id), this.db.get('SELECT 1 FROM blocks WHERE user_id=? AND blocked=?', t.id, uid), this.db.get('SELECT 1 FROM friend_requests WHERE src=? AND dst=?', t.id, uid), this.db.get('SELECT COUNT(*) n FROM friend_requests WHERE src=? AND at>?', uid, this.now() - 86400000)]);
    if (isF) throw conflict('你们已经是好友了', 'done');
    if (blk) throw forbid('对方不接受你的申请');
    if (rev) { await this.makeFriends(uid, t.id); return { friend: true }; }
    if (sent.n >= 30) throw conflict('今天发送的好友申请太多了', 'limit');
    this.db.w('INSERT OR IGNORE INTO friend_requests (src,dst,at) VALUES (?,?,?)', uid, t.id, this.now()); return { friend: false };
  },
  async addFriend(uid, targetId) {
    const [t, blk, isF, today] = await all([this.user(targetId), this.db.get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked=?) OR (user_id=? AND blocked=?)', targetId, uid, uid, targetId), this.isFriend(uid, targetId), this.db.get('SELECT COUNT(*) n FROM friends WHERE a=? AND since>?', uid, this.now() - 86400000)]);
    if (t.id === uid) throw bad('不能加自己为好友'); if (t.banned) throw forbid('该玩家已被封禁');
    if (blk) throw forbid('无法添加这个玩家');
    if (isF) throw conflict('你们已经是好友了', 'done');
    if (today.n >= 50) throw conflict('今天加的好友太多了', 'limit');
    await this.makeFriends(uid, t.id); return { friend: this.publicUser(t) };
  },
  // 附近的人：不需要是好友也能看到并互访
  async neighbors(uid) {
    const now = this.now();
    const [rows, fr] = await all([this.db.all('SELECT * FROM users WHERE banned=0 AND id<>? AND last_active>? AND id NOT IN (SELECT blocked FROM blocks WHERE user_id=?) AND id NOT IN (SELECT user_id FROM blocks WHERE blocked=?) ORDER BY last_active DESC LIMIT 40', uid, now - 7 * 86400000, uid, uid), this.friendSet(uid)]);
    const views = await this.farmViews(uid, rows);
    const list = rows.map((u, i) => { const v = views[i]; return Object.assign(this.publicUser(u), { steal: v.steal, help: v.help, soon: v.soon, online: now - u.last_active < 120000, last: u.last_active, friend: fr.has(u.id) }); });
    list.sort((a, b) => (b.online - a.online) || (b.steal - a.steal) || (b.last - a.last));
    return { list };
  },
  // 邀请链接：链接的主人分享即表示同意，点开的人确认后直接互为好友
  async acceptInvite(uid, code) { const t = await this.db.get('SELECT * FROM users WHERE code=? AND banned=0', String(code || '')); if (!t) throw notFound('邀请链接无效'); if (t.id === uid) return { self: true }; const added = await this.makeFriends(uid, t.id); return { friend: this.publicUser(t), added }; },
  async respondRequest(uid, src, accept) { const r = await this.db.get('SELECT * FROM friend_requests WHERE src=? AND dst=?', src, uid); if (!r) throw notFound('申请不存在或已处理'); if (accept) await this.makeFriends(uid, src); else this.db.w('DELETE FROM friend_requests WHERE src=? AND dst=?', src, uid); return {}; },
  async removeFriend(uid, fid) { this.db.w('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)', uid, fid, fid, uid); return {}; },
  async block(uid, fid, on) { if (on) { await this.removeFriend(uid, fid); this.db.w('INSERT OR IGNORE INTO blocks (user_id,blocked) VALUES (?,?)', uid, fid); this.db.w('DELETE FROM friend_requests WHERE src=? AND dst=?', fid, uid); } else this.db.w('DELETE FROM blocks WHERE user_id=? AND blocked=?', uid, fid); return {}; },
  async myStealsMap(thief, owner) {
    const C = this.C(), mk = 'st|' + thief + '|' + owner; if (C && C.memo[mk]) return Object.assign({}, C.memo[mk]);
    const m = {}; (await this.db.all('SELECT idx,cycle,blocked FROM steals WHERE thief=? AND owner=? AND at>?', thief, owner, this.now() - 7 * 86400000)).forEach(r => m[r.idx + ':' + r.cycle] = r.blocked ? 2 : 1);
    if (C) C.memo[mk] = Object.assign({}, m); return m;
  },
  markSteal(thief, owner, idx, cycle, blocked) { const C = this.C(), mk = 'st|' + thief + '|' + owner; if (C && C.memo[mk]) C.memo[mk][idx + ':' + cycle] = blocked ? 2 : 1; },
  viewOf(o, plots, mine) {
    const now = this.now(), cap = CFG.stealCapPct(o.lv); let steal = 0, help = 0, soon = 0;
    const list = plots.map(P => {
      const v = this.pubPlot(P);
      if (P.u && P.c >= 0) {
        const taken = mine[P.idx + ':' + P.cycle];
        v.mine = taken || 0; v.left = Math.max(0, Math.floor(P.y0 * cap) - P.stolen);
        v.canSteal = P.p >= 1 && !taken && v.left > 0 && now >= P.ra + RULES.stealDelaySec * 1000; v.protectUntil = P.p >= 1 ? P.ra + RULES.stealDelaySec * 1000 : 0;
        if (v.canSteal) steal++; if (P.pr.d || P.pr.w || P.pr.b) help++; if (P.p < 1 && CFG.remainSec(P) < 600) soon++;
      }
      return v;
    });
    const dogs = this.dogsOf(o).filter(d => d.own).map(d => ({ id: d.id, name: d.name, lv: d.lv, fed: d.fed }));
    return { owner: Object.assign(this.publicUser(o), { dog: dogs.some(d => d.fed), dogLv: o.dog_lv, dogs, pets: this.petsOf(o).map(p => ({ id: p.id, name: p.name, coat: p.coat, fed: p.fed })), ranch: this.ranchView(o), layout: this.layoutOf(o).items }), plots: list, steal, help, soon };
  },
  // 定时刷新别人农场用：只读，不记访客、不发消息
  async peekFarm(uid, owner) { const [o, plots, mine] = await all([this.canSee(uid, owner), this.plots(owner), this.myStealsMap(uid, owner)]); return this.viewOf(o, plots, mine); },
  async farmView(uid, owner) { const [o, plots, mine] = await all([this.user(owner), this.plots(owner), this.myStealsMap(uid, owner)]); return this.viewOf(o, plots, mine); },
  // 一次查出很多人的农场概况（附近的人、好友列表）：两条查询代替 2N 条
  async farmViews(uid, users) {
    if (!users.length) return [];
    const ids = users.map(u => u.id), qs = ids.map(() => '?').join(','), now = this.now();
    const [prow, srow] = await all([this.db.all(`SELECT * FROM plots WHERE user_id IN (${qs}) ORDER BY user_id, idx`, ...ids), this.db.all(`SELECT owner,idx,cycle,blocked FROM steals WHERE thief=? AND owner IN (${qs}) AND at>?`, uid, ...ids, now - 7 * 86400000)]);
    const P = {}, S = {}; prow.forEach(r => (P[r.user_id] = P[r.user_id] || []).push(CFG.advancePlot(this.rowToPlot(r), now))); srow.forEach(r => (S[r.owner] = S[r.owner] || {})[r.idx + ':' + r.cycle] = r.blocked ? 2 : 1);
    return users.map(u => this.viewOf(u, P[u.id] || [], S[u.id] || {}));
  },
  async friends(uid) {
    const now = this.now();
    const [rows, requests, sent, visitors] = await all([
      this.db.all('SELECT u.*, f.since AS f_since FROM friends f JOIN users u ON u.id=f.b WHERE f.a=? ORDER BY u.last_active DESC', uid),
      this.db.all('SELECT u.*, r.at AS r_at FROM friend_requests r JOIN users u ON u.id=r.src WHERE r.dst=? ORDER BY r.at DESC', uid),
      this.db.all('SELECT u.*, r.at AS r_at FROM friend_requests r JOIN users u ON u.id=r.dst WHERE r.src=? ORDER BY r.at DESC', uid),
      this.db.all('SELECT u.*, v.at AS v_at FROM visits v JOIN users u ON u.id=v.visitor WHERE v.owner=? ORDER BY v.at DESC LIMIT 10', uid)]);
    const views = await this.farmViews(uid, rows);
    return {
      list: rows.map((u, i) => Object.assign(this.publicUser(u), { steal: views[i].steal, help: views[i].help, soon: views[i].soon, online: now - u.last_active < 120000, last: u.last_active, since: u.f_since })),
      requests: requests.map(u => Object.assign(this.publicUser(u), { at: u.r_at })), sent: sent.map(u => Object.assign(this.publicUser(u), { at: u.r_at })), visitors: visitors.map(u => Object.assign(this.publicUser(u), { at: u.v_at })),
    };
  },
  async visit(uid, owner) {
    const [o, prev, plots, mine] = await all([this.canSee(uid, owner), this.db.get('SELECT at FROM visits WHERE owner=? AND visitor=?', owner, uid), this.plots(owner), this.myStealsMap(uid, owner)]);
    const now = this.now();
    this.db.w('INSERT INTO visits (owner,visitor,at) VALUES (?,?,?) ON CONFLICT(owner,visitor) DO UPDATE SET at=excluded.at', owner, uid, now);
    if (!prev || now - prev.at > 3600000) await this.msg(owner, 'visit', uid, {});
    this.bump(uid, 'visit', 1, 'all');
    return this.viewOf(o, plots, mine);
  },
  async steal(uid, owner, idx, out) {
    const [o, n, P, mine] = await all([this.canSee(uid, owner), this.cnt(uid, 'steal_n', 'day'), this.plot(owner, idx), this.myStealsMap(uid, owner)]);
    const now = this.now();
    if (!P.u || P.c < 0 || P.p < 1) throw conflict('这块地没有成熟的果实', 'not_ripe');
    if (now < P.ra + RULES.stealDelaySec * 1000) throw conflict(`刚成熟，主人保护中，${Math.ceil((P.ra + RULES.stealDelaySec * 1000 - now) / 1000)} 秒后才能摘`, 'protected');
    if (mine[idx + ':' + P.cycle]) throw conflict('这块地你已经摘过了', 'done');
    const cap = Math.floor(P.y0 * CFG.stealCapPct(o.lv)), left = Math.min(cap - P.stolen, P.y - 1);
    if (left <= 0) throw conflict('已经被摘得差不多了，给主人留点吧', 'empty');
    const dupe = conflict('这块地你已经摘过了', 'done');
    // 看家狗：喂饱的每只狗各自判定，抓住的都会咬一口（福旺 5 金币、睿宝 15 金币）
    const caught = this.dogsOf(o).filter(d => d.own && d.fed && U.rand() < d.chance);
    if (caught.length) {
      const me = await this.user(uid), bite = Math.min(me.gold, caught.reduce((a, d) => a + d.bite, 0)), dogs = caught.map(d => d.name);
      if (bite > 0) this.addGold(uid, -bite, 'dog_bite');
      this.db.wx(dupe, 'INSERT INTO steals (owner,thief,idx,cycle,crop,qty,blocked,at) VALUES (?,?,?,?,?,0,1,?)', owner, uid, idx, P.cycle, P.c, now); this.markSteal(uid, owner, idx, P.cycle, true);
      await this.msg(owner, 'dog', uid, { crop: P.c, n: 1, dogs }, true); return { idx, blocked: true, bite, crop: P.c, dogs };
    }
    let qty = Math.round(P.y0 * (RULES.stealPctMin + U.rand() * (RULES.stealPctMax - RULES.stealPctMin)));
    const crit = U.rand() < RULES.stealCritChance; if (crit) qty *= 2; // 手气爆棚：一次摘两份
    qty = clampN(qty, 1, left);
    P.y -= qty; P.stolen += qty; this.savePlot(owner, P); // 并发偷同一块地：数据库的事务隔离会让后提交的一方冲突重试
    this.db.wx(dupe, 'INSERT INTO steals (owner,thief,idx,cycle,crop,qty,blocked,at) VALUES (?,?,?,?,?,?,0,?)', owner, uid, idx, P.cycle, P.c, qty, now); this.markSteal(uid, owner, idx, P.cycle, false);
    this.addInv(uid, 'c' + P.c, qty);
    this.db.w('UPDATE users SET steal_total=steal_total+1 WHERE id=?', uid); this.db.w('UPDATE users SET stolen_from_total=stolen_from_total+? WHERE id=?', qty, owner); this.pu(uid, x => x.steal_total++); this.pu(owner, x => x.stolen_from_total += qty);
    // 软上限：超过后照样能摘、能拿到果实，只是不再加经验
    const tired = false; // 不设每日经验上限
    this.bump(uid, 'steal'); this.bump(uid, 'steal_n', 1, 'day'); this.bump(uid, 'social', 1, 'all'); const exp = tired ? 0 : await this.addExp(uid, RULES.stealExp, out); this.metric('steals');
    await this.msg(owner, 'stolen', uid, { qty, items: { ['c' + P.c]: qty } }, true);
    return { idx, qty, crop: P.c, left: P.y, crit, exp, tired };
  },
  async help(uid, owner, idx, out) {
    const [, n, P] = await all([this.canSee(uid, owner), this.cnt(uid, 'help_n', 'day'), this.plot(owner, idx)]);
    const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地不需要帮忙', 'healthy');
    P.pr[k] = 0; const now = this.now();
    // 邻居帮忙：作物顺带多长一点
    if (P.p < 1 && RULES.helpBoost > 0) { P.p = Math.min(1, P.p + RULES.helpBoost); if (P.p >= 1) { P.ra = now; P.ev = []; } }
    this.savePlot(owner, P);
    this.db.w('INSERT OR IGNORE INTO helps (owner,helper,idx,cycle,kind,at) VALUES (?,?,?,?,?,?)', owner, uid, idx, P.cycle, k, now);
    // 软上限：超过后仍然可以帮忙，只是不再给奖励
    const tired = false; let gold = 0, exp = 0;
    if (!tired) { gold = RULES.helpGold; this.addGold(uid, gold, 'help'); exp = await this.addExp(uid, RULES.helpExp, out); }
    this.db.w('UPDATE users SET help_total=help_total+1 WHERE id=?', uid); this.pu(uid, x => x.help_total++); this.bump(uid, 'help'); this.bump(uid, 'help_n', 1, 'day'); this.bump(uid, 'social', 1, 'all');
    await this.msg(owner, 'helped', uid, { kinds: k }, true); return { idx, kind: k, gold, exp, tired };
  },
  async guestbook(uid, owner) { if (uid !== owner) await this.canSee(uid, owner); return (await this.db.all('SELECT g.id,g.phrase,g.at,g.author,u.name,u.avatar FROM guestbook g LEFT JOIN users u ON u.id=g.author WHERE g.owner=? AND g.hidden=0 ORDER BY g.id DESC LIMIT 30', owner)).map(r => ({ id: r.id, phrase: r.phrase, at: r.at, author: r.author, name: r.name || '已注销玩家', avatar: J(r.avatar) || {} })); },
  async postGuestbook(uid, owner, phrase) {
    phrase = U.int(phrase, '留言', 0, CFG.PHRASES.length - 1);
    const [, n] = await all([this.canSee(uid, owner), this.cnt(uid, 'gb', 'day')]);
    if (n >= RULES.gbDailyLimit) throw conflict('今天留言太多了', 'limit');
    this.db.w('INSERT INTO guestbook (owner,author,phrase,at) VALUES (?,?,?,?)', owner, uid, phrase, this.now()); this.bump(uid, 'gb', 1, 'day'); await this.msg(owner, 'gb', uid, { phrase }); return {};
  },
  async hideGuestbook(uid, id) { const r = await this.db.run('UPDATE guestbook SET hidden=1 WHERE id=? AND owner=?', id, uid); if (!r.changes) throw notFound('留言不存在'); return {}; },
  async messages(uid) {
    const [rows, fr] = await all([this.db.all('SELECT m.*, u.name AS aname, u.avatar AS aav, u.code AS acode, u.role AS arole FROM messages m LEFT JOIN users u ON u.id=m.actor WHERE m.user_id=? ORDER BY m.id DESC LIMIT 100', uid), this.friendSet(uid)]);
    return rows.map(r => ({ id: r.id, kind: r.kind, actor: r.actor, name: r.actor ? (r.aname || '已注销玩家') : (r.kind === 'system' ? '系统' : '已注销玩家'), avatar: J(r.aav) || {}, friend: r.actor ? fr.has(r.actor) : false, canVisit: !!(r.actor && r.aname), data: J(r.data) || {}, at: r.at, read: !!r.read }));
  },
  async readMessages(uid) { this.db.w('UPDATE messages SET read=1 WHERE user_id=? AND read=0', uid); return {}; },

  /* ---------- 集市（玩家交易） ---------- */
};
