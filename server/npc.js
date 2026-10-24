'use strict';
/* =====================================================
   拟真玩家（NPC）
   对其他玩家来说和真人没有区别：真实风格的网名、等级与历史数据、个人作息、
   在线/离线、按规则赚钱花钱、串门偷菜帮忙、留言加好友、被偷了会回访报复。
   只有运营后台能看到它们是 NPC（users.role = 'npc'），统计指标不计入。
   ===================================================== */
const CFG = require('../shared/config');
const U = require('./util');
const { CROPS, RULES, UNLOCK_ORDER, NPLOTS } = CFG;

/* ---------- 网名生成 ---------- */
const CURATED = ['晚风与你', '一颗小番茄', '南城旧梦', '星河滚烫', '咸鱼不想翻身', '早睡早起', '种田的猫', '菜园小主', '柠檬不酸', '夏天的风', '小鹿乱撞', '北岛', '清欢', '不吃香菜', '半糖', '喵了个咪', '风吹麦浪', '番茄炒蛋', '奶茶续命', '山海', '一只胖橘', '可乐加冰', '慢慢来', '月亮邮递员', '糖醋排骨', '秋田', '鹿鸣', '林夕', '橘子汽水', '白开水', '薄荷糖', '七月', '十一', '沐沐', '安然', '遇见', '初心', '浅笑', '木木', '夏至', '南风', '青柠', '栗子', '小满', '大白', '土豆', '花卷', '芋圆', '汤圆', '米粒', '麦兜', '皮蛋', '旺仔', '阿狸', '橙子', '桃桃', '云朵', '小太阳', '温柔一刀', '江湖夜雨', '人间值得', '甜甜圈', '芝士奶盖', '小确幸', '风铃', '雨后', '晴天', '路过', '随缘', '知足常乐', '平平淡淡', '向日葵', '蒲公英', '四叶草', '布丁', '果冻', '饭团', '豆浆油条', '桂花糕', '青团'];
const SURN = '王李张刘陈杨黄赵周吴徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾田董潘袁蔡蒋余于杜叶程魏苏吕丁沈任姚卢傅钟姜崔谭陆范汪廖石金韦贾夏方邹熊白孟秦邱侯江尹薛段雷龙黎史陶贺毛郝顾龚邵万武钱戴严莫孔向常汤'.split('');
const GIVEN = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '洋', '艳', '勇', '军', '杰', '娟', '涛', '明', '超', '霞', '平', '刚', '华', '玲', '飞', '鹏', '婷', '宇', '浩', '欣', '悦', '晨', '琳', '颖', '佳', '雪', '慧', '倩', '波', '辉', '斌', '宁', '凯', '帆', '昊', '俊', '睿', '萱', '彤', '妍', '瑶', '航', '建华', '秀英', '志强', '晓燕', '海燕', '国庆', '小红', '春梅', '子涵', '梓萱', '一诺', '浩然', '欣怡', '思远', '雨桐', '俊杰'];
const EN = ['Lucky', 'Kevin', 'sunny', 'momo', 'Lily', 'Coco', 'Tina', 'Eric', 'Jason', 'Amy', 'Leo', 'Mia', 'Ethan', 'Grace', 'xiaoyu', 'tiantian', 'yoyo', 'kiki', 'Bella', 'Ryan', 'Annie', 'Vicky', 'Jack', 'Cindy', 'Sean', 'Nana', 'lulu', 'dudu', 'Alex', 'Ivy', 'Owen', 'Zoe', 'Ruby', 'summer', 'apple', 'candy', 'peach', 'Tony', 'Jerry', 'Linda'];
const FOODS = ['西瓜', '草莓', '番茄', '玉米', '土豆', '南瓜', '萝卜', '白菜', '葡萄', '橘子', '桃子', '芒果', '辣条', '火锅', '雪糕', '荔枝'];
const ANIMALS = ['猫', '兔子', '小熊', '狐狸', '鱼', '熊猫', '柴犬', '仓鼠', '企鹅', '刺猬', '考拉', '小羊'];
const FARMY = ['偷菜小能手', '菜园守护者', '摘菜不留名', '种瓜得瓜', '今天也要偷菜', '佛系种田', '养生菜农', '种田使我快乐', '菜地小霸王', '专业种菜', '收菜达人', '早起收菜', '半夜偷菜', '田园牧歌', '开心农场主', '一亩三分地', '小小菜农', '回家种地', '摘星星的人', '种菜也很忙'];
function genName(r) {
  const p = a => a[Math.floor(r() * a.length)], x = r();
  if (x < 0.3) return p(CURATED);
  if (x < 0.47) return p(SURN) + p(GIVEN) + (r() < 0.12 ? String(1975 + Math.floor(r() * 35)) : '');
  if (x < 0.57) return (r() < 0.5 ? '阿' : r() < 0.6 ? '小' : '老') + (r() < 0.5 ? p(SURN) : p(GIVEN).slice(-1));
  if (x < 0.72) { const e = p(EN); const s = r(); return (s < 0.3 ? e.toLowerCase() : e) + (s < 0.55 ? '' : p(['_88', '666', '520', '0721', '2008', '_', '99', '1314', '_' + Math.floor(r() * 100), String(95 + Math.floor(r() * 10)).slice(-2)])); }
  if (x < 0.84) return (r() < 0.8 ? '爱吃' : '不爱吃') + p(FOODS) + '的' + p(ANIMALS);
  if (x < 0.94) return p(FARMY);
  return p(SURN) + p(['同学', '老师', '师傅', '姐', '哥', '小姐姐']);
}

/* ---------- 作息 ---------- */
// win：[开始小时, 结束小时(可超过24表示跨夜), 活跃强度]
const PERSONAS = {
  office: { w: 30, wd: [[7.3, 8.6, 0.6], [11.8, 13.6, 0.9], [18.8, 23.6, 1.1]], we: [[9, 23.6, 0.8]], len: [4, 18], care: 0.75, social: 0.6 },
  student: { w: 18, wd: [[6.5, 7.4, 0.4], [12, 12.8, 0.6], [16.8, 24, 1.1]], we: [[10, 24.5, 1]], len: [5, 25], care: 0.6, social: 0.8 },
  night: { w: 12, wd: [[12, 14, 0.5], [20.5, 26.5, 1.1]], we: [[13, 27, 1]], len: [6, 30], care: 0.5, social: 0.7 },
  early: { w: 12, wd: [[5.5, 9, 1.1], [13.5, 16, 0.6], [19, 21.5, 0.7]], we: [[5.5, 21.5, 0.8]], len: [3, 12], care: 0.95, social: 0.4 },
  home: { w: 14, wd: [[8.5, 22.5, 0.6]], we: [[8.5, 22.5, 0.6]], len: [3, 14], care: 0.85, social: 0.5 },
  hardcore: { w: 8, wd: [[7.5, 25.5, 1]], we: [[8, 26, 1.1]], len: [8, 35], care: 0.9, social: 0.9 },
  casual: { w: 6, wd: [[12, 13, 0.35], [20, 22, 0.45]], we: [[14, 22, 0.45]], len: [2, 8], care: 0.4, social: 0.3 },
};
const PKEYS = Object.keys(PERSONAS);
function pickPersona(r) { const tot = PKEYS.reduce((s, k) => s + PERSONAS[k].w, 0); let x = r() * tot; for (const k of PKEYS) { x -= PERSONAS[k].w; if (x <= 0) return k; } return 'office'; }
function pickLv(r) { const x = r(); return x < 0.35 ? 2 + Math.floor(r() * 5) : x < 0.65 ? 7 + Math.floor(r() * 6) : x < 0.85 ? 13 + Math.floor(r() * 6) : x < 0.95 ? 19 + Math.floor(r() * 6) : 25 + Math.floor(r() * 12); }

// 每个真人每天最多被 NPC 影响的次数，避免打扰
const CAP = { steal: 4, help: 6, buy: 6, gb: 2, add: 2 };

class Villagers {
  constructor(game) { this.g = game; this.db = game.db; }
  async ids() { return (await this.db.all("SELECT id FROM users WHERE role='npc' AND banned=0")).map(r => r.id); }
  localHour(ms) { return (((ms + (this.g.opts.tzMin || 480) * 60000) / 3600000) % 24 + 24) % 24; }
  weekday(ms) { const d = new Date(ms + (this.g.opts.tzMin || 480) * 60000).getUTCDay(); return d === 0 || d === 6 ? 'we' : 'wd'; }
  st(u) { try { return (JSON.parse(u.settings || '{}').npc) || null; } catch (e) { return null; } }
  saveSt(u, s) { let o = {}; try { o = JSON.parse(u.settings || '{}'); } catch (e) { } o.npc = s; this.db.w('UPDATE users SET settings=? WHERE id=?', JSON.stringify(o), u.id); }
  async uniqueName(r) {
    const cand = []; for (let i = 0; i < 12; i++) { let n = genName(r); try { n = U.cleanName(n); } catch (e) { continue; } cand.push(n); }
    if (cand.length) { const taken = new Set((await this.db.all(`SELECT name FROM users WHERE name IN (${cand.map(() => '?').join(',')})`, ...cand)).map(x => x.name)); const ok = cand.find(n => !taken.has(n)); if (ok) return ok; }
    return U.cleanName(genName(r).slice(0, 7) + Math.floor(r() * 90 + 10));
  }

  /* ---------- 生成：带着合理的历史数据入场（每个 NPC 一个事务） ---------- */
  async ensure(n, budgetMs) {
    const g = this.g, now = g.now(), t0 = Date.now();
    // 旧版本留下的“村民”统一升级
    for (const u of await this.db.all("SELECT * FROM users WHERE role='npc'")) { const s = this.st(u); if (!s || s.v !== 2) await this.db.tx(() => this.dress(u.id, CFG.rng(CFG.hash32('up' + u.id + now)), u.lv)); }
    const have = (await this.db.get("SELECT COUNT(*) n FROM users WHERE role='npc'")).n;
    for (let i = have; i < n; i++) {
      if (budgetMs && Date.now() - t0 > budgetMs) return false;
      const r = CFG.rng(CFG.hash32('npc' + i + ':' + now + ':' + Math.random())), lv = pickLv(r);
      await this.db.tx(async () => { const uid = await g.createUser(await this.uniqueName(r)); this.db.w("UPDATE users SET role='npc' WHERE id=?", uid); await this.dress(uid, r, lv); });
    }
    return true;
  }
  async dress(uid, r, lv) {
    const g = this.g, now = g.now(), A = CFG.AVATAR_OPTS, hat = r() < 0.45 ? 1 : 0;
    const av = { skin: Math.floor(r() * A.skin.length), hair: Math.floor(r() * A.hair.length), hat, fringe: r() < 0.85 ? 1 : 0, pig: !hat && r() < 0.35 ? 1 : 0, band: Math.floor(r() * A.band.length), shirt: Math.floor(r() * A.shirt.length), bg: Math.floor(r() * A.bg.length) };
    const u0 = await g.user(uid); let name = u0.name; if (/^(王大爷|李婶|老张|春妮|阿强|秀兰|铁柱|小芳|刘叔|翠花|大海|桂英|阿福|玉兰|石头|巧云|老陈|杏儿|水生|红梅)$/.test(name)) name = await this.uniqueName(r);
    const days = Math.max(1, Math.round(lv * (0.6 + r() * 0.9) + r() * 4)), created = now - days * 86400000 - Math.floor(r() * 86400000);
    const harvest = Math.round(Math.pow(lv, 1.7) * 7 * (0.7 + r() * 0.6)), steal = Math.round(harvest * (0.15 + r() * 0.35)), help = Math.round(harvest * (0.1 + r() * 0.3));
    const owned = Math.min(NPLOTS, RULES.startPlots + Math.floor(Math.max(0, lv - 2) / 0.8 * (0.5 + r() * 0.45)));
    const gold = Math.round(lv * lv * 35 + lv * 150 + r() * lv * 300 + 200);
    const dog = lv >= 3 && r() < 0.45 ? 1 : 0, persona = pickPersona(r);
    const yest = CFG.dayKey(now - 86400000);
    const fields = { name, lv, exp: Math.floor(CFG.expNeed(lv) * r() * 0.9), gold, avatar: JSON.stringify(av), dog_own: dog, dog_lv: dog ? 1 + Math.floor(r() * Math.min(9, lv / 3)) : 1,
      harvest_total: harvest, steal_total: steal, help_total: help, plant_total: Math.round(harvest * 1.1), golden_total: Math.round(harvest * 0.03 * r()), order_total: Math.round(lv * 1.5 * r()), earned_total: Math.round(gold * (3 + r() * 4)), stolen_from_total: Math.round(harvest * 2 * r()),
      checkin_last: r() < 0.6 ? yest : CFG.dayKey(now - Math.floor(2 + r() * 5) * 86400000), checkin_streak: Math.floor(r() * Math.min(lv, 9)), created_at: created, last_active: now - Math.floor(r() * 20 * 3600000) };
    this.db.w(`UPDATE users SET role='npc', name=?, lv=?, exp=?, gold=?, title='', theme='classic', frame='none', avatar=?, dog_own=?, dog_lv=?, dog_exp=0, dog_until=0,
      harvest_total=?, steal_total=?, help_total=?, plant_total=?, golden_total=?, order_total=?, earned_total=?, stolen_from_total=?, checkin_last=?, checkin_streak=?, created_at=?, last_active=?, seed=0 WHERE id=?`,
      fields.name, fields.lv, fields.exp, fields.gold, fields.avatar, fields.dog_own, fields.dog_lv, fields.harvest_total, fields.steal_total, fields.help_total, fields.plant_total, fields.golden_total, fields.order_total, fields.earned_total, fields.stolen_from_total, fields.checkin_last, fields.checkin_streak, fields.created_at, fields.last_active, uid);
    // 图鉴、成就、称号、装扮
    let codexN = 0;
    CROPS.filter(c => c.lv <= lv).forEach(c => { if (r() < 0.9) { codexN++; this.db.w('INSERT OR IGNORE INTO codex (user_id,item,first_at,n) VALUES (?,?,?,?)', uid, 'c' + c.id, created + Math.floor(r() * (now - created)), 5 + Math.floor(r() * 200)); } if (r() < 0.06) { codexN++; this.db.w('INSERT OR IGNORE INTO codex (user_id,item,first_at,n) VALUES (?,?,?,?)', uid, 'g' + c.id, now - Math.floor(r() * days) * 86400000, 1 + Math.floor(r() * 3)); } });
    const u = Object.assign({}, u0, fields), stats = g.achStatsOf(u, { friends: 0, codex: codexN }); const titles = [];
    CFG.ACHIEVEMENTS.forEach(a => { if (stats[a.stat] >= a.need) { this.db.w('INSERT OR IGNORE INTO claims (user_id,key,at) VALUES (?,?,?)', uid, 'ach:' + a.id, created + Math.floor(r() * (now - created))); if (a.title) titles.push(a.title); CFG.FRAMES.filter(f => f.ach === a.id).forEach(f => this.db.w('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'frame:' + f.id, now)); } });
    if (titles.length && r() < 0.55) this.db.w('UPDATE users SET title=? WHERE id=?', titles[Math.floor(r() * titles.length)], uid);
    if (lv >= 8 && r() < 0.35) { const th = CFG.THEMES.filter(t => t.price && t.price <= lv * 1200); if (th.length) { const t = th[Math.floor(r() * th.length)]; this.db.w('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'theme:' + t.id, now); this.db.w('UPDATE users SET theme=? WHERE id=?', t.id, uid); } }
    if (lv >= 10 && r() < 0.3) { const fr = CFG.FRAMES.filter(f => f.price && f.price <= lv * 600); if (fr.length) { const f = fr[Math.floor(r() * fr.length)]; this.db.w('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'frame:' + f.id, now); this.db.w('UPDATE users SET frame=? WHERE id=?', f.id, uid); } }
    // 土地与作物：大部分地在种，一部分已经成熟（主人还没上线收）
    this.db.w('UPDATE plots SET u=0, soil=0, c=-1, p=0, y=0, y0=0, stolen=0 WHERE user_id=?', uid);
    const nRed = lv >= 6 ? Math.floor(r() * Math.min(owned, (lv - 5) / 2)) : 0;
    UNLOCK_ORDER.slice(0, owned).forEach((idx, k) => this.db.w('UPDATE plots SET u=1, soil=?, t=? WHERE user_id=? AND idx=?', k < nRed ? 1 : 0, now, uid, idx));
    const pool = CROPS.filter(c => c.lv <= lv).sort((a, b) => b.lv - a.lv), main = pool[Math.floor(r() * Math.min(3, pool.length))], alt = pool[Math.floor(r() * Math.min(6, pool.length))];
    for (const P of await g.plots(uid)) {
      if (!P.u || r() < 0.12) continue;
      const cr = r() < 0.7 ? main : alt; P.c = cr.id; P.p = 0; P.sea = 0; await g.startCycle(P, now);
      const x = r(); P.p = x < 0.35 ? 1 : 0.05 + r() * 0.9; if (P.p >= 1) { P.ra = now - Math.floor((3 + r() * 120) * 60000); P.ev = []; } else P.ev = P.ev.filter(e => e[0] > now);
      if (P.p < 1 && r() < 0.25) P.pr[['d', 'w', 'b'][Math.floor(r() * 3)]] = 1;
      g.savePlot(uid, P);
    }
    this.db.w('DELETE FROM inventory WHERE user_id=?', uid); g.addInv(uid, 'fert', Math.floor(r() * 8)); if (dog) g.addInv(uid, 'dogfood', Math.floor(r() * 4));
    pool.slice(0, 3).forEach(c => { if (r() < 0.6) g.addInv(uid, 'c' + c.id, 5 + Math.floor(r() * 40)); });
    this.db.w('UPDATE users SET settings=? WHERE id=?', JSON.stringify({ sound: true, music: true, tut: 1, npc: { v: 2, persona, until: 0, seed: Math.floor(r() * 1e9) } }), uid);
  }

  /* ---------- 定时：决定谁在线、在线的人做什么 ----------
     tickSec：距离上一次运行的秒数（无服务器部署时可能是几分钟，按时长折算上线概率）
     budgetMs：本次最多运行多久（超时就留到下一次） */
  async tick(tickSec, budgetMs) {
    const g = this.g, now = g.now(), h = this.localHour(now), wk = this.weekday(now), day = CFG.dayKey(now), t0 = Date.now();
    const rows = await this.db.all("SELECT id,settings,last_active FROM users WHERE role='npc' AND banned=0");
    for (const u of rows) {
      if (budgetMs && Date.now() - t0 > budgetMs) break;
      const id = u.id; let s = this.st(u); if (!s) continue; const P = PERSONAS[s.persona] || PERSONAS.office;
      if (s.until > now) {
        // 每个动作各自一个小事务（不把整段在线行为锁在一个长事务里，不阻塞真人玩家）
        try { await this.act(id, s, P); } catch (e) { if (!(e instanceof U.ApiError)) throw e; }
        if (s.until <= now + Math.min(tickSec, 300) * 1000) s.phase = 'off';
        const cur = await g.user(id); let o = {}; try { o = JSON.parse(cur.settings || '{}'); } catch (e) { }
        if (o.npc && o.npc.until === s.until) { o.npc = s; await this.db.run('UPDATE users SET settings=?, last_active=? WHERE id=?', JSON.stringify(o), now, id); }
        continue;
      }
      // 是否开始一次上线：按作息时段、当天心情（偶尔一整天不上线）
      const mood = (CFG.hash32('mood' + id + day) % 100) / 100, dayMult = mood < 0.08 ? 0 : 0.5 + mood;
      let inten = 0; (P[wk] || P.wd).forEach(([a, b, k]) => { if ((h >= a && h < b) || (b > 24 && h < b - 24)) inten = Math.max(inten, k); });
      const lam = inten * dayMult * 1.1, p = 1 - Math.exp(-lam * Math.min(tickSec, 3600) / 3600);
      if (U.rand() < p && now - (s.last || 0) > 20 * 60000) {
        s.until = now + U.randInt(P.len[0], P.len[1]) * 60000; s.last = now; s.phase = 'farm';
        let o = {}; try { o = JSON.parse(u.settings || '{}'); } catch (e) { } o.npc = s; await this.db.run('UPDATE users SET settings=?, last_active=? WHERE id=?', JSON.stringify(o), now, id);
      }
    }
  }
  async sp(fn) { try { return await this.db.sp(fn); } catch (e) { if (!(e instanceof U.ApiError)) throw e; return null; } }
  async act(id, s, P) {
    if (s.phase === 'farm') { await this.farmRoutine(id, P); s.phase = 'social'; return; }
    if (s.phase === 'social') { if (U.rand() < 0.55 * P.social + 0.15) await this.social(id, P); if (U.rand() < 0.12) await this.market(id); if (U.rand() < 0.15) await this.tidy(id, P); }
  }
  // 上线第一件事：签到、领奖、收菜、卖菜、交订单、照料、补种、扩建
  async farmRoutine(id, P) {
    const g = this.g; let u = await g.user(id); const out = {};
    if (u.checkin_last !== CFG.dayKey(g.now())) await this.sp(() => g.checkin(id, out));
    const T = await g.tasks(id);
    for (const kind of ['daily', 'weekly', 'newbie']) for (const t of T[kind]) if (!t.claimed && t.prog >= t.need) await this.sp(() => g.claimTask(id, kind, t.id, out));
    for (const a of await g.achievements(id)) if (!a.claimed && a.prog >= a.need) { const r = await this.sp(() => g.claimAch(id, a.id)); if (r && r.title && U.rand() < 0.4) this.db.w('UPDATE users SET title=? WHERE id=?', r.title, id); }
    for (const p of (await g.plots(id)).filter(p => p.u && p.c >= 0 && p.p >= 1)) await this.sp(() => g.harvest(id, p.idx, out));
    const ord = await g.orders(id); let inv = await g.inv(id);
    for (const o of ord.list) if (!o.done && (inv[o.item] || 0) >= o.qty && U.rand() < 0.8) { if (await this.sp(() => g.deliver(id, o.slot, out))) inv[o.item] -= o.qty; }
    for (const [item, q] of Object.entries(inv)) { if (/^[cg]\d+$/.test(item) && q > 0) { const keep = /^g/.test(item) ? 0 : Math.min(q, U.randInt(0, 25)); if (q - keep > 0) await this.sp(() => g.sell(id, item, q - keep, q)); } }
    await this.tidy(id, P, true);
    [u, inv] = await Promise.all([g.user(id), g.inv(id)]);
    if (u.dog_own && u.dog_until < g.now() + 15 * 60000) { if (!inv.dogfood && u.gold > 1500) { const n = U.randInt(1, 3); if (await this.sp(() => g.buy(id, 'dogfood', n))) inv.dogfood = n; } if (inv.dogfood) await this.sp(() => g.feedDog(id)); }
    if (!u.dog_own && u.lv >= RULES.dogNeedLv && u.gold > 1800 && U.rand() < 0.25) await this.sp(() => g.buyDog(id));
    let plots; [u, plots] = await Promise.all([g.user(id), g.plots(id)]); const owned = plots.filter(p => p.u).length;
    if (owned < NPLOTS && u.lv >= CFG.plotNeedLv(owned) && u.gold > CFG.plotCost(owned) * 1.4 && U.rand() < 0.5) await this.sp(() => g.expand(id, -1, out));
    [u, plots] = await Promise.all([g.user(id), g.plots(id)]);
    if (u.lv >= RULES.redNeedLv && u.gold > CFG.redCost(plots.filter(p => p.soil).length) * 2.5 && U.rand() < 0.15) { const p = plots.find(x => x.u && !x.soil); if (p) await this.sp(() => g.red(id, p.idx, out)); }
    if (!inv.fert && u.gold > 3000 && U.rand() < 0.2) await this.sp(() => g.buy(id, 'fert', U.randInt(2, 6)));
    await this.replant(id);
    u = await g.user(id); if (u.lv >= 6 && U.rand() < 0.03) { const own = new Set(await g.cosmetics(id)); const th = CFG.THEMES.filter(t => t.price && !own.has('theme:' + t.id) && t.price * 3 < u.gold); if (th.length) { const t = th[U.randInt(0, th.length - 1)]; if (await this.sp(() => g.buyCosmetic(id, 'theme', t.id))) this.db.w('UPDATE users SET theme=? WHERE id=?', t.id, id); } }
  }
  // 照料自己的地：不同的人勤快程度不同
  async tidy(id, P, full) {
    const g = this.g; const [plots, inv] = await Promise.all([g.plots(id), g.inv(id)]);
    for (const p of plots) { if (p.u && p.c >= 0 && p.p < 1 && (p.pr.d || p.pr.w || p.pr.b) && U.rand() < (full ? P.care : P.care * 0.4)) { for (let k = 0; k < 3; k++) if (!(await this.sp(() => g.care(id, p.idx)))) break; } }
    if (full && U.rand() < 0.3) { const p = plots.find(x => x.u && x.c >= 0 && x.p < 0.8); if (p && inv.fert) await this.sp(() => g.fert(id, p.idx)); }
  }
  // 补种：根据离下次上线的时间挑作物（晚上种长的，白天种短的）
  async replant(id) {
    const g = this.g, [u, plots] = await Promise.all([g.user(id), g.plots(id)]), empty = plots.filter(p => p.u && p.c < 0); if (!empty.length) return;
    const h = this.localHour(g.now()), horizon = (h >= 21 || h < 5) ? 6 + U.rand() * 4 : 0.5 + U.rand() * 3; // 小时
    const cand = CROPS.filter(c => c.lv <= u.lv && c.seed * empty.length <= u.gold * 0.7);
    if (!cand.length) { const cheap = CROPS.filter(c => c.lv <= u.lv).sort((a, b) => a.seed - b.seed)[0]; if (cheap) for (const p of empty) await this.sp(() => g.plant(id, p.idx, cheap.id)); return; }
    const score = c => -Math.abs(Math.log((c.time / 3600 + 0.05) / horizon)) + (c.yield * c.price - c.seed) / Math.max(1, c.time) * 2 + U.rand() * 0.6;
    const best = cand.slice().sort((a, b) => score(b) - score(a)), main = best[0], alt = best[Math.min(1, best.length - 1)];
    for (const p of empty) await this.sp(() => g.plant(id, p.idx, U.rand() < 0.75 ? main.id : alt.id));
  }
  // 串门：优先找偷过自己的人（报复）、好友，再随机找最近活跃的人
  async social(id, P) {
    const g = this.g, now = g.now(), day = 'd' + CFG.dayKey(now);
    const [rv, fr, ac] = await Promise.all([this.db.all('SELECT DISTINCT thief AS id FROM steals WHERE owner=? AND at>? AND blocked=0', id, now - 86400000), this.db.all('SELECT b AS id FROM friends WHERE a=?', id), this.db.all('SELECT id FROM users WHERE banned=0 AND id<>? AND last_active>? ORDER BY RANDOM() LIMIT 12', id, now - 2 * 86400000)]);
    const revenge = rv.map(r => r.id), friends = fr.map(r => r.id), active = ac.map(r => r.id);
    const x = U.rand(), pool = x < 0.35 && revenge.length ? revenge : x < 0.6 && friends.length ? friends : active; if (!pool.length) return;
    const t = pool[U.randInt(0, pool.length - 1)]; if (t === id) return;
    const tu = await this.db.get('SELECT role FROM users WHERE id=?', t); if (!tu) return; const human = tu.role !== 'npc';
    const C = human ? await g.counters(t) : () => 0, used = {};
    const cap = k => human && C('npcx_' + k, day) + (used[k] || 0) >= CAP[k], mark = k => { if (human) { g.bump(t, 'npcx_' + k, 1, 'day'); used[k] = (used[k] || 0) + 1; } };
    const v = await this.sp(() => g.visit(id, t)); if (!v) return;
    let stole = 0, helped = 0;
    for (const p of v.plots) {
      if (p.canSteal && !cap('steal') && U.rand() < (revenge.includes(t) ? 0.9 : 0.65)) { const r = await this.sp(() => g.steal(id, t, p.idx, {})); if (r) { mark('steal'); if (!r.blocked) stole++; } }
      else if ((p.pr.d || p.pr.w || p.pr.b) && p.p < 1 && !cap('help') && U.rand() < (friends.includes(t) ? 0.7 : 0.4)) { if (await this.sp(() => g.help(id, t, p.idx, {}))) { mark('help'); helped++; } }
    }
    if (!cap('gb') && U.rand() < 0.05) { const ph = stole ? (U.rand() < 0.5 ? 1 : 6) : helped ? (U.rand() < 0.5 ? 2 : 3) : [0, 4, 8, 9][U.randInt(0, 3)]; if (await this.sp(() => g.postGuestbook(id, t, ph))) mark('gb'); }
    if (!friends.includes(t) && !cap('add') && U.rand() < (revenge.includes(t) ? 0.12 : 0.05)) { if (await this.sp(() => g.addFriend(id, t))) mark('add'); }
  }
  // 集市：摆摊卖多余的作物，买价格公道的货
  async market(id) {
    const g = this.g, now = g.now(), day = 'd' + CFG.dayKey(now); await g.expireListings(); const u = await g.user(id);
    if (U.rand() < 0.5) {
      if ((await this.db.get("SELECT COUNT(*) n FROM market WHERE seller=? AND status='open'", id)).n < 3) { const items = Object.entries(await g.inv(id)).filter(([k, q]) => /^c\d+$/.test(k) && q >= 12); if (items.length) { const [item, q] = items[U.randInt(0, items.length - 1)], b = g.priceBand(item); const price = Math.max(b.min, Math.min(b.max, Math.round(await g.unitPrice(item) * (0.95 + U.rand() * 0.35)))); await this.sp(() => g.listItem(id, item, Math.min(q, U.randInt(8, 30)), price)); } }
    } else {
      const ls = await this.db.all("SELECT m.*, s.role AS srole FROM market m JOIN users s ON s.id=m.seller WHERE m.status='open' AND m.seller<>? AND m.created_at<? ORDER BY RANDOM() LIMIT 8", id, now - 3 * 60000);
      for (const m of ls) { if (m.price > await g.unitPrice(m.item) * 1.12 || m.qty * m.price > u.gold * 0.3) continue; const human = m.srole !== 'npc'; if (human && await g.cnt(m.seller, 'npcx_buy', day) >= CAP.buy) continue; if (U.rand() < 0.45) { if (await this.sp(() => g.buyListing(id, m.id, {})) && human) g.bump(m.seller, 'npcx_buy', 1, 'day'); break; } }
    }
  }
}
module.exports = { Villagers, genName };
