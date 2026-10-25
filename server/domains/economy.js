'use strict';
/* 丰收农场 · 服务端玩法模块：集市、排行榜、赛季
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = require('./common'); // eslint-disable-line no-unused-vars

module.exports = {
  async expireListings() {
    const now = this.now(); const rows = await this.db.all("SELECT * FROM market WHERE status='open' AND expires_at<=?", now);
    for (const m of rows) {
      const r = await this.db.run("UPDATE market SET status='expired', done_at=? WHERE id=? AND status='open'", now, m.id);
      if (r.changes) { this.addInv(m.seller, m.item, m.qty); await this.msg(m.seller, 'market_expired', null, { item: m.item, qty: m.qty }); }
    }
  },
  priceBand(item) { const c = cropOfItem(item), base = CROPS[c.id].price * (c.golden ? RULES.goldenPriceMult : 1); return { min: Math.max(1, Math.floor(base * RULES.marketMinMult)), max: Math.ceil(base * RULES.marketMaxMult), base }; },
  async market(uid, item) {
    await this.expireListings();
    const [q, mine, fr] = await all([item ? this.db.all("SELECT m.*, u.name, u.code FROM market m JOIN users u ON u.id=m.seller WHERE m.status='open' AND m.item=? AND m.seller<>? ORDER BY m.price, m.id LIMIT 60", item, uid)
      : this.db.all("SELECT m.*, u.name, u.code FROM market m JOIN users u ON u.id=m.seller WHERE m.status='open' AND m.seller<>? ORDER BY m.created_at DESC LIMIT 60", uid),
    this.db.all("SELECT * FROM market WHERE seller=? AND (status='open' OR done_at>?) ORDER BY id DESC LIMIT 30", uid, this.now() - 3 * 86400000), this.friendSet(uid)]);
    return { list: q.map(m => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, seller: { id: m.seller, name: m.name, code: m.code, friend: fr.has(m.seller) }, expires: m.expires_at })), mine: mine.map(m => ({ id: m.id, item: m.item, qty: m.qty, price: m.price, status: m.status, expires: m.expires_at })) };
  },
  async listItem(uid, item, qty, price) {
    if (!cropOfItem(item)) throw bad('只能上架作物'); qty = U.int(qty, '数量', 1, 9999); price = U.int(price, '单价', 1, 1e7);
    const b = this.priceBand(item); if (price < b.min || price > b.max) throw bad(`单价需在 ${b.min}–${b.max} 之间`);
    await this.expireListings();
    if ((await this.db.get("SELECT COUNT(*) n FROM market WHERE seller=? AND status='open'", uid)).n >= RULES.marketMaxListings) throw conflict(`最多同时上架 ${RULES.marketMaxListings} 件`, 'limit');
    this.addInv(uid, item, -qty); const now = this.now();
    const r = await this.db.run('INSERT INTO market (seller,item,qty,price,created_at,expires_at) VALUES (?,?,?,?,?,?)', uid, item, qty, price, now, now + RULES.marketTtlHours * 3600000);
    return { id: Number(r.lastInsertRowid) };
  },
  async cancelListing(uid, id) { const m = await this.db.get("SELECT * FROM market WHERE id=? AND seller=? AND status='open'", id, uid); if (!m) throw notFound('挂单不存在或已成交'); const r = await this.db.run("UPDATE market SET status='cancelled', done_at=? WHERE id=? AND status='open'", this.now(), id); if (!r.changes) throw notFound('挂单不存在或已成交'); this.addInv(uid, m.item, m.qty); return { item: m.item, qty: m.qty }; },
  async buyListing(uid, id, out) {
    await this.expireListings();
    const m = await this.db.get("SELECT * FROM market WHERE id=? AND status='open'", id); if (!m) throw conflict('这件商品已经被买走或下架了', 'gone'); if (m.seller === uid) throw bad('不能买自己的商品');
    const total = m.qty * m.price, fee = Math.ceil(total * RULES.marketFee);
    this.addGold(uid, -total, 'market_buy'); const r = await this.db.run("UPDATE market SET status='sold', buyer=?, done_at=? WHERE id=? AND status='open'", uid, this.now(), id); if (!r.changes) throw conflict('这件商品已经被买走了', 'gone');
    this.addInv(uid, m.item, m.qty); this.addGold(m.seller, total - fee, 'market_sell');
    this.bump(uid, 'trade'); this.bump(m.seller, 'trade'); this.metric('market_sales'); this.metric('market_gold', total);
    await this.msg(m.seller, 'market_sold', uid, { item: m.item, qty: m.qty, gold: total - fee });
    return { item: m.item, qty: m.qty, total, fee };
  },

  /* ---------- 排行榜 / 赛季 ---------- */
  async leaderboard(uid, dim, scope) {
    const wk = this.period('week'); const dims = { lv: null, gold: null, harvest: 'harvest', steal: 'steal', help: 'help', season: 'sp' };
    if (!(dim in dims)) throw bad('排行榜类型不对');
    const ids = scope === 'friends' ? [uid].concat([...(await this.friendSet(uid))]) : null;
    const filt = ids ? ` AND u.id IN (${ids.map(() => '?').join(',')})` : '';
    let rows;
    if (dim === 'lv') rows = await this.db.all(`SELECT u.*, (u.lv*100000000+u.exp) AS score FROM users u WHERE u.banned=0${filt} ORDER BY score DESC LIMIT 50`, ...(ids || []));
    else if (dim === 'gold') rows = await this.db.all(`SELECT u.*, u.gold AS score FROM users u WHERE u.banned=0${filt} ORDER BY score DESC LIMIT 50`, ...(ids || []));
    else rows = await this.db.all(`SELECT u.*, c.val AS score FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0${filt} ORDER BY score DESC, u.id LIMIT 50`, wk, dims[dim], ...(ids || []));
    const list = rows.map((u, i) => Object.assign(this.publicUser(u), { rank: i + 1, score: dim === 'lv' ? u.lv : u.score }));
    let mine = list.find(r => r.id === uid);
    if (!mine && !ids) {
      const u = await this.user(uid); let score, above;
      if (dim === 'lv') { score = u.lv; above = (await this.db.get('SELECT COUNT(*) n FROM users WHERE banned=0 AND (lv*100000000+exp) > ?', u.lv * 1e8 + u.exp)).n; }
      else if (dim === 'gold') { score = u.gold; above = (await this.db.get('SELECT COUNT(*) n FROM users WHERE banned=0 AND gold > ?', u.gold)).n; }
      else { score = await this.cnt(uid, dims[dim], wk); above = (await this.db.get('SELECT COUNT(*) n FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key=? AND u.banned=0 AND c.val > ?', wk, dims[dim], score)).n; }
      mine = Object.assign(this.publicUser(u), { rank: above + 1, score });
    }
    return { dim, scope, week: wk, weekEnd: CFG.weekEnd(this.now()), list, mine };
  },
  seasonReward(rank, pts) { if (pts < 100) return 0; return rank === 1 ? 5000 : rank <= 3 ? 3000 : rank <= 10 ? 1500 : rank <= 50 ? 800 : 300; },
  async season(uid) {
    const now = this.now(), wk = CFG.weekKey(now), last = CFG.weekKey(now - 7 * 86400000);
    const [pts, lastPts, claimed] = await all([this.cnt(uid, 'sp', wk), this.cnt(uid, 'sp', last), this.db.get('SELECT 1 FROM claims WHERE user_id=? AND key=?', uid, 'season:' + last)]);
    const above = real => this.db.get(`SELECT COUNT(*) n FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key='sp' AND u.banned=0${real ? " AND u.role<>'npc'" : ''} AND c.val > ?`, last, lastPts);
    let lastRank = 0, rewardRank = 0; if (lastPts) { const [a, b] = await all([above(false), above(true)]); lastRank = a.n + 1; rewardRank = b.n + 1; }
    return { week: wk, end: CFG.weekEnd(now), pts, last: { week: last, pts: lastPts, rank: lastRank, reward: this.seasonReward(rewardRank, lastPts), claimed: !!claimed }, tiers: [[1, 5000], [3, 3000], [10, 1500], [50, 800], [Infinity, 300]] };
  },
  async claimSeason(uid) { const s = await this.season(uid); if (!s.last.reward) throw conflict('上赛季积分不足 100，没有奖励', 'not_done'); this.claim(uid, 'season:' + s.last.week); this.addGold(uid, s.last.reward, 'season'); return { gold: s.last.reward, rank: s.last.rank }; },

  /* ---------- 图鉴 / 装扮 / 资料 ---------- */
};
