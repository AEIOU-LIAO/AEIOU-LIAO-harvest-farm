/* =====================================================
   丰收农场 · 前后端共用配置与规则
   服务端是权威；客户端只用它来显示与插值。
   ===================================================== */
(function (root) {
  'use strict';
  const COLS = 6, ROWS = 4, NPLOTS = COLS * ROWS;

  // rarity: 1 普通 2 稀有 3 史诗 4 传说
  const CROPS = [
    { id: 0, name: '萝卜', lv: 1, seed: 20, time: 40, yield: 12, price: 3, exp: 8, seasons: 1, rarity: 1, art: { type: 'root', shape: 'radish', leaf: '#5fb83f', root: '#fbf3f4', blush: '#ff8aa5', hh: 72, is: 1.15 } },
    { id: 1, name: '白菜', lv: 2, seed: 45, time: 90, yield: 20, price: 4, exp: 16, seasons: 1, rarity: 1, art: { type: 'cabbage', head: '#b9e56e', hh: 70, is: 1.1 } },
    { id: 2, name: '胡萝卜', lv: 3, seed: 80, time: 150, yield: 26, price: 5, exp: 28, seasons: 1, rarity: 1, art: { type: 'root', shape: 'carrot', leaf: '#4fa83a', root: '#ff8c1a', hh: 74, is: 1.15 } },
    { id: 3, name: '番茄', lv: 4, seed: 130, time: 240, yield: 30, price: 7, exp: 42, seasons: 2, rarity: 1, art: { type: 'bush', kind: 'tomato', fruit: '#ec3b2e', unripe: '#a8d060', nf: 4, h: 58, hh: 80, is: 0.95 } },
    { id: 4, name: '草莓', lv: 5, seed: 200, time: 360, yield: 36, price: 9, exp: 62, seasons: 2, rarity: 1, art: { type: 'bush', kind: 'berry', fruit: '#ff3355', unripe: '#d6e8a8', nf: 5, h: 24, low: true, hh: 54, is: 1.2 } },
    { id: 5, name: '玉米', lv: 6, seed: 300, time: 540, yield: 44, price: 11, exp: 90, seasons: 2, rarity: 1, art: { type: 'corn', hh: 112, is: 0.72 } },
    { id: 6, name: '辣椒', lv: 7, seed: 420, time: 720, yield: 48, price: 13, exp: 125, seasons: 2, rarity: 1, art: { type: 'bush', kind: 'chili', fruit: '#e8281e', unripe: '#6fbf3a', nf: 5, h: 54, hh: 78, is: 1.0 } },
    { id: 7, name: '茄子', lv: 8, seed: 560, time: 900, yield: 54, price: 15, exp: 160, seasons: 2, rarity: 1, art: { type: 'bush', kind: 'egg', fruit: '#7b3fa8', unripe: '#8fae6a', nf: 3, h: 56, hh: 80, is: 1.0 } },
    { id: 8, name: '南瓜', lv: 10, seed: 800, time: 1200, yield: 60, price: 18, exp: 220, seasons: 1, rarity: 2, art: { type: 'vine', kind: 'pumpkin', fruit: '#ff9a1f', hh: 64, is: 1.05 } },
    { id: 9, name: '西瓜', lv: 12, seed: 1200, time: 1800, yield: 66, price: 24, exp: 330, seasons: 2, rarity: 2, art: { type: 'vine', kind: 'melon', fruit: '#37993b', hh: 62, is: 1.0 } },
    { id: 10, name: '向日葵', lv: 14, seed: 1800, time: 2400, yield: 72, price: 32, exp: 480, seasons: 1, rarity: 2, art: { type: 'sunflower', hh: 120, is: 0.7 } },
    { id: 11, name: '菠萝', lv: 16, seed: 2800, time: 3600, yield: 80, price: 45, exp: 760, seasons: 1, rarity: 2, art: { type: 'pine', hh: 80, is: 1.0 } },
    { id: 12, name: '白萝卜', lv: 3, seed: 60, time: 120, yield: 22, price: 4, exp: 22, seasons: 1, rarity: 1, art: { type: 'root', shape: 'radish', leaf: '#6cc04a', root: '#ffffff', blush: '#eef6dc', hh: 72, is: 1.15 } },
    { id: 13, name: '紫甘蓝', lv: 5, seed: 180, time: 300, yield: 32, price: 9, exp: 55, seasons: 1, rarity: 1, art: { type: 'cabbage', head: '#a774d6', hh: 70, is: 1.1 } },
    { id: 14, name: '小黄番茄', lv: 7, seed: 380, time: 660, yield: 46, price: 13, exp: 115, seasons: 2, rarity: 2, art: { type: 'bush', kind: 'tomato', fruit: '#ffc21a', unripe: '#b8d870', nf: 5, h: 56, hh: 80, is: 0.95 } },
    { id: 15, name: '蓝莓', lv: 9, seed: 700, time: 1080, yield: 58, price: 18, exp: 190, seasons: 2, rarity: 2, art: { type: 'bush', kind: 'berry', fruit: '#4a5ad8', unripe: '#c8d8e8', nf: 5, h: 24, low: true, hh: 54, is: 1.2 } },
    { id: 16, name: '紫薯', lv: 11, seed: 1000, time: 1500, yield: 62, price: 22, exp: 280, seasons: 1, rarity: 2, art: { type: 'root', shape: 'carrot', leaf: '#5aa84a', root: '#8a3aa8', hh: 74, is: 1.15 } },
    { id: 17, name: '黄彩椒', lv: 13, seed: 1500, time: 2100, yield: 68, price: 28, exp: 400, seasons: 2, rarity: 2, art: { type: 'bush', kind: 'chili', fruit: '#ffb81a', unripe: '#7fc04a', nf: 5, h: 54, hh: 78, is: 1.0 } },
    { id: 18, name: '白玉茄', lv: 15, seed: 2200, time: 3000, yield: 74, price: 38, exp: 600, seasons: 2, rarity: 3, art: { type: 'bush', kind: 'egg', fruit: '#f4eedf', unripe: '#a8c08a', nf: 3, h: 56, hh: 80, is: 1.0 } },
    { id: 19, name: '冬瓜', lv: 17, seed: 3200, time: 5400, yield: 86, price: 52, exp: 980, seasons: 1, rarity: 3, art: { type: 'vine', kind: 'melon', fruit: '#8ec8a4', hh: 62, is: 1.0 } },
    { id: 20, name: '金南瓜', lv: 19, seed: 4500, time: 7200, yield: 92, price: 68, exp: 1350, seasons: 1, rarity: 3, art: { type: 'vine', kind: 'pumpkin', fruit: '#ffd23a', hh: 64, is: 1.05 } },
    { id: 21, name: '甜菜', lv: 21, seed: 6000, time: 10800, yield: 100, price: 88, exp: 1900, seasons: 1, rarity: 3, art: { type: 'root', shape: 'radish', leaf: '#4a9a3a', root: '#b8214a', blush: '#7a1030', hh: 72, is: 1.15 } },
    { id: 22, name: '黑美人西瓜', lv: 24, seed: 8500, time: 14400, yield: 108, price: 115, exp: 2700, seasons: 2, rarity: 4, art: { type: 'vine', kind: 'melon', fruit: '#1f5a2a', hh: 62, is: 1.0 } },
    { id: 23, name: '月光草莓', lv: 27, seed: 12000, time: 21600, yield: 120, price: 150, exp: 3800, seasons: 2, rarity: 4, art: { type: 'bush', kind: 'berry', fruit: '#f0e4ff', unripe: '#d8e8c8', nf: 5, h: 24, low: true, hh: 54, is: 1.2 } },
  ];
  const RARITY = ['', '普通', '稀有', '史诗', '传说'];

  const RULES = {
    startGold: 300, startPlots: 6, maxLv: 30,
    fertPrice: 60, fertBoost: 0.3, dogfoodPrice: 120, dogPrice: 400, dogNeedLv: 3, dogFeedMin: 60,
    redNeedLv: 5,
    // 偷菜
    stealDelaySec: 30,          // 成熟后的主人保护时间
    stealPctMin: 0.08, stealPctMax: 0.15, // 每次偷取占原始产量比例
    stealMaxPct: 0.4,           // 一块地最多被偷走的比例（主人保底 60%）
    newbieLv: 5, newbieMaxPct: 0.2, // 主人低于此等级时保底更高
    stealDailyLimit: 80,        // 每人每天最多成功偷取次数
    stealExp: 3,
    dogBlockBase: 0.35, dogBlockPerLv: 0.03, dogBlockMax: 0.7, dogBiteMin: 10, dogBiteMax: 40,
    // 互助
    helpDailyLimit: 60, helpExp: 4, helpGold: 6,
    // 生长
    probSlow: 0.62, soilSpeed: 1.2, soilYield: 1.2, season2Start: 0.45,
    goldenChance: 0.04, goldenPriceMult: 5,
    // 市场
    marketFee: 0.05, marketMinMult: 0.8, marketMaxMult: 2.0, marketMaxListings: 6, marketTtlHours: 24,
    // 留言
    gbDailyLimit: 20,
  };

  const TASKS = [
    { id: 'plant', ic: '🌱', tx: '种植作物', need: 12, gold: 150, exp: 30 },
    { id: 'harvest', ic: '🧺', tx: '收获作物', need: 15, gold: 250, exp: 50 },
    { id: 'care', ic: '💧', tx: '浇水 / 除草 / 除虫', need: 6, gold: 150, exp: 30 },
    { id: 'steal', ic: '🥷', tx: '摘取好友的果实', need: 6, gold: 220, exp: 40 },
    { id: 'help', ic: '🤝', tx: '帮好友打理农田', need: 4, gold: 180, exp: 35 },
    { id: 'sell', ic: '💰', tx: '卖出作物赚取金币', need: 800, gold: 300, exp: 60 },
  ];
  const WEEKLY = [
    { id: 'w_harvest', stat: 'harvest', ic: '🧺', tx: '本周收获作物', need: 120, gold: 1500, exp: 300 },
    { id: 'w_steal', stat: 'steal', ic: '🥷', tx: '本周摘取好友果实', need: 40, gold: 1200, exp: 240 },
    { id: 'w_help', stat: 'help', ic: '🤝', tx: '本周帮好友打理', need: 30, gold: 1200, exp: 240 },
    { id: 'w_order', stat: 'order', ic: '📦', tx: '本周完成订单', need: 10, gold: 2000, exp: 400 },
    { id: 'w_trade', stat: 'trade', ic: '🏷️', tx: '本周在集市成交', need: 5, gold: 1000, exp: 200 },
  ];
  const NEWBIE = [
    { id: 'n_plant', stat: 'plant', tx: '在空地上种下第一颗种子', need: 1, gold: 50 },
    { id: 'n_harvest', stat: 'harvest', tx: '收获一次作物', need: 1, gold: 80 },
    { id: 'n_sell', stat: 'sell', tx: '在仓库卖出作物', need: 1, gold: 80 },
    { id: 'n_friend', stat: 'friend', tx: '添加一位真实好友（发送邀请链接）', need: 1, gold: 200 },
    { id: 'n_visit', stat: 'visit', tx: '去好友农场串门', need: 1, gold: 100 },
    { id: 'n_social', stat: 'social', tx: '在好友农场摘一次果实或帮一次忙', need: 1, gold: 200 },
  ];
  // 成就：stat 对应 users 表的累计计数
  const ACHIEVEMENTS = [
    { id: 'a_h1', stat: 'harvest_total', need: 50, tx: '初获丰收', desc: '累计收获 50 次', gold: 300, title: '小农夫' },
    { id: 'a_h2', stat: 'harvest_total', need: 500, tx: '丰收能手', desc: '累计收获 500 次', gold: 2000, title: '丰收能手' },
    { id: 'a_h3', stat: 'harvest_total', need: 3000, tx: '农场大亨', desc: '累计收获 3000 次', gold: 10000, title: '农场大亨' },
    { id: 'a_s1', stat: 'steal_total', need: 20, tx: '妙手空空', desc: '累计摘取好友果实 20 次', gold: 300, title: '妙手空空' },
    { id: 'a_s2', stat: 'steal_total', need: 300, tx: '神偷', desc: '累计摘取 300 次', gold: 3000, title: '月下神偷' },
    { id: 'a_p1', stat: 'help_total', need: 20, tx: '热心邻居', desc: '累计帮好友 20 次', gold: 300, title: '热心邻居' },
    { id: 'a_p2', stat: 'help_total', need: 300, tx: '劳模', desc: '累计帮好友 300 次', gold: 3000, title: '劳动模范' },
    { id: 'a_f1', stat: 'friends', need: 3, tx: '呼朋唤友', desc: '拥有 3 位好友', gold: 500, title: '人气农夫' },
    { id: 'a_f2', stat: 'friends', need: 10, tx: '社交达人', desc: '拥有 10 位好友', gold: 2000, title: '社交达人' },
    { id: 'a_g1', stat: 'golden_total', need: 1, tx: '金光闪闪', desc: '收获第一个变异金色作物', gold: 500, title: '幸运儿' },
    { id: 'a_g2', stat: 'golden_total', need: 20, tx: '点石成金', desc: '收获 20 次金色作物', gold: 5000, title: '点石成金' },
    { id: 'a_c1', stat: 'codex', need: 10, tx: '收藏家', desc: '图鉴收集 10 种', gold: 1000, title: '收藏家' },
    { id: 'a_c2', stat: 'codex', need: 24, tx: '博物学家', desc: '图鉴收集全部普通作物', gold: 6000, title: '博物学家' },
    { id: 'a_l1', stat: 'lv', need: 10, tx: '小有所成', desc: '达到 Lv.10', gold: 1000 },
    { id: 'a_l2', stat: 'lv', need: 20, tx: '远近闻名', desc: '达到 Lv.20', gold: 5000, title: '远近闻名' },
    { id: 'a_o1', stat: 'order_total', need: 30, tx: '诚信商户', desc: '完成 30 个订单', gold: 2000, title: '诚信商户' },
    { id: 'a_k1', stat: 'checkin_streak', need: 7, tx: '风雨无阻', desc: '连续签到 7 天', gold: 800, title: '勤劳农夫' },
  ];

  // 装扮：农场主题（房屋/树木颜色）与头像框
  const THEMES = [
    { id: 'classic', name: '经典红顶', price: 0, th: { roof: '#c8483a', wall: '#f6e7c8', tree: '#4aa83a', bush: '#4ea43a' } },
    { id: 'sakura', name: '樱花小屋', price: 3000, th: { roof: '#d9658a', wall: '#fff0e0', tree: '#5ab84e', bush: '#52b04a' } },
    { id: 'ocean', name: '海风蓝顶', price: 3000, th: { roof: '#3e7ac8', wall: '#f0ead0', tree: '#3f9a3a', bush: '#3f9a3a' } },
    { id: 'cabin', name: '林间木屋', price: 6000, th: { roof: '#7a5a3a', wall: '#f2dfc0', tree: '#6aa83a', bush: '#6aa83a' } },
    { id: 'lavender', name: '薰衣草庄园', price: 12000, th: { roof: '#9a6ad9', wall: '#fff4f8', tree: '#58b890', bush: '#4aa87a' } },
    { id: 'autumn', name: '金秋农舍', price: 20000, th: { roof: '#d9822a', wall: '#fff2d6', tree: '#d9a03a', bush: '#c89a3a' } },
  ];
  const FRAMES = [
    { id: 'none', name: '无', price: 0, color: '' },
    { id: 'wood', name: '原木框', price: 1000, color: '#a8743a' },
    { id: 'leaf', name: '青叶框', price: 2500, color: '#5cb83c' },
    { id: 'gold', name: '黄金框', price: 8000, color: '#ffc61a' },
    { id: 'star', name: '星光框', price: 0, color: '#b08aff', ach: 'a_c1' },
    { id: 'thief', name: '神偷框', price: 0, color: '#3a3a5a', ach: 'a_s2' },
  ];
  const AVATAR_OPTS = {
    skin: ['#ffd9b0', '#ffe4cc', '#f2c89a', '#e8b88a', '#c8946a'],
    hair: ['#2a1a10', '#6a3a1a', '#e8a0c0', '#d9b84a', '#4a5ad8'],
    shirt: ['#4a8fd8', '#ff7aa5', '#6aa84a', '#8a5a3a', '#b08aff', '#ff9a1f'],
    band: ['#d9553a', '#3a7ad9', '#3a9a5a'],
    bg: [['#a8e4ff', '#d8f5b8'], ['#ffd9ec', '#fff0e0'], ['#c8ecff', '#e8f6c8'], ['#ffe8b8', '#ffd09a'], ['#e8d8ff', '#ffe0f0']],
  };
  // 留言用预设短语（不开放自由文本，避免垃圾内容）
  const PHRASES = ['🌻 来串门啦！', '🥷 菜不错，拿走两个～', '💧 帮你浇过水了', '🐛 虫子已经消灭', '😄 一起加油种田！', '🎁 谢谢你的帮忙', '😤 别偷我的菜！', '🐶 小心我家狗狗', '🌙 晚安，明天见', '👍 农场好漂亮'];

  const SHOP_ITEMS = [
    { id: 'fert', name: '化肥', ic: '🧪', price: RULES.fertPrice, desc: '让作物成长进度 +30%' },
    { id: 'dogfood', name: '狗粮', ic: '🍖', price: RULES.dogfoodPrice, desc: '小狗吃饱后看家 60 分钟，并获得成长经验' },
  ];

  const expNeed = lv => Math.round(50 * lv * (1 + lv * 0.35));
  const dogExpNeed = lv => 3 + lv * 2;
  const plotCost = unlocked => Math.round(500 * Math.pow(1.28, unlocked - RULES.startPlots));
  const plotNeedLv = unlocked => 2 + Math.floor((unlocked - RULES.startPlots) * 0.8);
  const redCost = nRed => 1500 + 600 * nRed;
  const stageOf = p => p >= 1 ? 4 : p < 0.1 ? 0 : p < 0.35 ? 1 : p < 0.65 ? 2 : 3;
  const STAGE_NAME = ['种子期', '发芽期', '成长期', '即将成熟', '已成熟'];

  // 土地解锁顺序：从中心向外
  const UNLOCK_ORDER = (() => { const a = []; for (let i = 0; i < NPLOTS; i++) { const c = i % COLS, r = Math.floor(i / COLS); a.push({ i, d: Math.hypot(c - 2.5, (r - 1.5) * 1.15), c }); } a.sort((p, q) => p.d - q.d || p.c - q.c); return a.map(o => o.i); })();

  function hash32(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---- 服务器统一时区（默认 UTC+8，无夏令时）----
  let TZ_MIN = 480;
  function setTz(min) { TZ_MIN = min; }
  function dayKey(ms) { const d = new Date(ms + TZ_MIN * 60000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function dayStart(ms) { const off = TZ_MIN * 60000; return Math.floor((ms + off) / 86400000) * 86400000 - off; }
  function weekKey(ms) { // ISO 周（按服务器时区）
    const d = new Date(dayStart(ms) + TZ_MIN * 60000); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    const y = d.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4)); const w = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return y + '-W' + String(w).padStart(2, '0');
  }
  function weekEnd(ms) { const ds = dayStart(ms), d = new Date(ds + TZ_MIN * 60000), day = (d.getUTCDay() + 6) % 7; return ds + (7 - day) * 86400000; }

  // 天气：全服同一套确定性的雨天时间表（每 12 分钟一段，约 1/5 段下雨 40 秒）
  const RAIN_SLOT = 12 * 60000, RAIN_LEN = 40000;
  function rainUntil(ms) { const s = Math.floor(ms / RAIN_SLOT); if (hash32('rain' + s) % 5 !== 0) return 0; const st = s * RAIN_SLOT + (hash32('rs' + s) % (RAIN_SLOT - RAIN_LEN)); return ms >= st && ms < st + RAIN_LEN ? st + RAIN_LEN : 0; }

  // 每日行情：两种作物涨价
  function dayBonus(ms) {
    const k = dayKey(ms), r = rng(hash32(k)), list = CROPS.filter(c => c.rarity <= 2).map(c => c.id);
    const a = list.splice(Math.floor(r() * list.length), 1)[0], b = list.splice(Math.floor(r() * list.length), 1)[0];
    return { [a]: 0.3 + Math.floor(r() * 3) * 0.1, [b]: 0.2 + Math.floor(r() * 3) * 0.1 };
  }

  // ---- 生长：时间戳懒计算 ----
  function plotDur(P) { return CROPS[P.c].time * 1000 * (P.sea > 0 ? 0.9 : 1); }
  function probCount(P) { return (P.pr.d ? 1 : 0) + (P.pr.w ? 1 : 0) + (P.pr.b ? 1 : 0); }
  function plotSpeed(P) { return (P.soil ? RULES.soilSpeed : 1) * Math.pow(RULES.probSlow, probCount(P)); }
  function remainSec(P) { return (1 - P.p) * plotDur(P) / 1000 / plotSpeed(P); }
  // 将地块推进到 now；ev 为服务端预排的病虫害事件 [[时间,类型],...]
  function advancePlot(P, now) {
    if (!P.u || P.c < 0 || !CROPS[P.c]) { P.t = now; return P; }
    if (!P.t) P.t = now;
    P.ev = P.ev || [];
    while (P.t < now) {
      const nextEv = P.ev.length ? P.ev[0][0] : Infinity, until = Math.min(now, nextEv);
      if (until > P.t && P.p < 1) {
        const dp = (until - P.t) / plotDur(P) * plotSpeed(P);
        if (P.p + dp >= 1) { const need = (1 - P.p) / plotSpeed(P) * plotDur(P); P.ra = Math.round(P.t + need); P.p = 1; }
        else P.p += dp;
      }
      P.t = Math.max(P.t, until);
      if (until === nextEv) {
        const e = P.ev.shift();
        if (P.p > 0.1 && P.p < 0.93 && probCount(P) < 2 && !P.pr[e[1]] && !(e[1] === 'd' && rainUntil(e[0]))) P.pr[e[1]] = 1;
      }
      if (P.p >= 1) { P.ev = []; P.t = now; }
    }
    return P;
  }
  function stealCapPct(ownerLv) { return ownerLv < RULES.newbieLv ? RULES.newbieMaxPct : RULES.stealMaxPct; }

  const CFG = { COLS, ROWS, NPLOTS, CROPS, RARITY, RULES, TASKS, WEEKLY, NEWBIE, ACHIEVEMENTS, THEMES, FRAMES, AVATAR_OPTS, PHRASES, SHOP_ITEMS, UNLOCK_ORDER, STAGE_NAME,
    expNeed, dogExpNeed, plotCost, plotNeedLv, redCost, stageOf, hash32, rng, setTz, dayKey, dayStart, weekKey, weekEnd, rainUntil, dayBonus, plotDur, plotSpeed, probCount, remainSec, advancePlot, stealCapPct };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.GAMECFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
