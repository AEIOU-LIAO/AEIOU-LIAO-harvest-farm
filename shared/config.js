/* =====================================================
   丰收农场 · 前后端共用配置与规则
   服务端是权威；客户端只用它来显示与插值。
   ===================================================== */
(function (root) {
  'use strict';
  /* v3.4 内容数据化：作物、生物、商品、任务等内容来自 content/*.jsonc（构建生成 shared/content.js），这里只放规则公式 */
  const CONTENT = typeof module !== 'undefined' && module.exports ? require('./content') : root.GAMECONTENT;
  if (!CONTENT) throw new Error('缺少 shared/content.js（请运行 node tools/build-content.js）');
  const COLS = 6, ROWS = 4, NPLOTS = COLS * ROWS;
  // v3：农田可以一片一片开辟，每片 24 块地，最多 20 片（480 块地）。第 1 片是农场中间这片（一块一块开垦），之后每片买下来 24 块地全部开好
  const FIELDS_MAX = 20, MAX_PLOTS = NPLOTS * FIELDS_MAX;
  const fieldNeedLv = f => 15 + (f - 1) * 25;                 // 开辟第 f 片（f 从 1 开始，0 是自家这片）需要的等级
  const fieldCost = f => Math.round(30000 * Math.pow(f, 1.7));

  // rarity: 1 普通 2 稀有 3 史诗 4 传说
  const CROPS = CONTENT.CROPS_SRC.list.map(c => Object.assign({}, c, { art: Object.assign({}, c.art) }));
  // v3.1 高阶作物：Lv.50 → Lv.3800 共 60 种，按等级几何分布；数值随等级平滑增长。参数在 content/crops.jsonc 的 gen 里
  (() => {
    const G = CONTENT.CROPS_SRC.gen, pre = G.pre, base = G.base, cols = G.cols, N = G.n;
    for (let k = 0; k < N; k++) {
      const lv = Math.round(G.lvMin * Math.pow(G.lvMax / G.lvMin, k / (N - 1))), fe = Math.pow(lv / G.refLv, G.expPow), fm = Math.pow(lv / G.refLv, G.moneyPow), [bn, art0] = base[k % base.length], pc = cols[(k * 7) % cols.length], name = pre[k % pre.length] + bn;
      const art = Object.assign({}, art0); const c = pc === 'rainbow' && art.type !== 'flower' ? '#ff6ad5' : pc;
      if (art.type === 'vine' || art.type === 'bush') art.fruit = c; else if (art.type === 'root') art.root = c; else if (art.type === 'cabbage') art.head = c; else if (art.type === 'flower') art.petal = pc; else if (art.type === 'grain') art.ear = c;
      const time = G.times[k % G.times.length];
      CROPS.push({ id: CROPS.length, name, lv, seed: Math.round(G.seedBase * fm), time, yield: G.yieldBase + Math.round(Math.log2(lv / G.refLv) * G.yieldLog), price: Math.round(G.priceBase * fm), exp: Math.round(G.expBase * fe), seasons: k % G.twoSeasonEvery === 0 ? 2 : 1, rarity: lv >= G.rarityHighLv ? 4 : 3, art });
    }
  })();
  const RARITY = CONTENT.RARITY;

  // 土地等级：普通 → 红土地 → 黑土地 → 金土地（生长速度、产量逐级提高）
  // 升级费用 = base + step × 已经达到该等级的地块数
  const SOILS = CONTENT.SOILS;
  // 看家狗：福旺、睿宝，可以都养；喂饱时各自独立判定能不能抓住来偷菜的人
  const DOGS = CONTENT.DOGS;

  const RULES = CONTENT.RULES;

  const TASKS = CONTENT.TASKS;
  const WEEKLY = CONTENT.WEEKLY;
  const NEWBIE = CONTENT.NEWBIE;
  // 成就：stat 对应 users 表的累计计数
  const ACHIEVEMENTS = CONTENT.ACHIEVEMENTS;

  // 装扮：农场主题（房屋/树木颜色）与头像框
  const THEMES = CONTENT.THEMES;
  const FRAMES = CONTENT.FRAMES;
  const AVATAR_OPTS = CONTENT.AVATAR_OPTS;
  // 留言用预设短语（不开放自由文本，避免垃圾内容）
  const PHRASES = CONTENT.PHRASES;

  const SHOP_ITEMS = CONTENT.SHOP_ITEMS;
  // v3.1 更多颜色的边牧：领养后自己起名字，可以放羊、跟着主人走
  const COLLIES = CONTENT.COLLIES;
  const PETS_MAX = CONTENT.MISC.PETS_MAX;

  // 经验曲线：45 级以前不变；之后按 (lv/45)^1.5 增长，满级 4000 级
  const expNeed = lv => lv <= 45 ? Math.round(50 * lv * (1 + lv * 0.35)) : Math.round(37688 * Math.pow(lv / 45, 1.5));
  const dogExpNeed = lv => lv <= 10 ? 3 + lv * 2 : Math.round(23 + Math.pow(lv - 10, 1.5) * 3);
  const plotCost = unlocked => Math.round(500 * Math.pow(1.28, unlocked - RULES.startPlots));
  const plotNeedLv = unlocked => 2 + Math.floor((unlocked - RULES.startPlots) * 0.8);
  const soilOf = P => SOILS[Math.max(0, Math.min(SOILS.length - 1, (P && P.soil) | 0))];
  const soilCost = (tier, nAtLeast) => { const s = SOILS[tier]; return s ? s.base + s.step * nAtLeast : 0; };
  const redCost = nRed => soilCost(1, nRed);
  const dogChance = (d, lv) => Math.min(d.max, d.base + d.perLv * ((lv || 1) - 1));
  const stageOf = p => p >= 1 ? 4 : p < 0.1 ? 0 : p < 0.35 ? 1 : p < 0.65 ? 2 : 3;
  const STAGE_NAME = CONTENT.MISC.STAGE_NAME;

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
  function plotSpeed(P) { return soilOf(P).speed * Math.pow(RULES.probSlow, probCount(P)); }
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
  const orderSlots = lv => Math.min(RULES.orderSlotsMax, RULES.orderSlots + Math.floor(Math.max(0, lv) / RULES.orderSlotEvery));
  function stealCapPct(ownerLv) { return ownerLv < RULES.newbieLv ? RULES.newbieMaxPct : RULES.stealMaxPct; }

  // ===== v2.8 鱼塘与牧场 =====
  // 鱼：买鱼苗放进池塘，长大后收鱼（每条鱼苗收获 yield 条），可以卖钱
  const FISH = CONTENT.FISH;
  // 羊：买来放进羊圈，隔一段时间长一茬羊毛，剪下来卖钱；羊毛长满 woolMax 茬后不再长，记得来剪
  const SHEEP = CONTENT.SHEEP;
  // 果树：买树苗种进果园，长大（grow 秒）后每 period 秒结一茬果子，最多攒 3 茬
  const TREES = CONTENT.TREES;
  // 鱼塘、牧场、果园都可以一级一级扩建（最多 100 级），扩建要求玩家等级，越往后越贵、容量越大
  const RANCH = CONTENT.RANCH;
  const _q = (l, a, b, c) => Math.round(a + b * (l - 1) + c * (l - 1) * (l - 1));
  const pondCapOf = l => _q(Math.max(1, Math.min(RANCH.maxLv, l || 1)), 20, 15, 0.4);       // 1 级 20 条 → 100 级约 5400 条
  const pastureCapOf = l => _q(Math.max(1, Math.min(RANCH.maxLv, l || 1)), 3, 3, 0.1);      // 1 级 3 只 → 100 级约 1280 只
  const orchardCapOf = l => _q(Math.max(1, Math.min(RANCH.maxLv, l || 1)), 4, 2, 0.05);     // 1 级 4 棵 → 100 级约 690 棵
  const ranchUpCost = (kind, l) => Math.round(({ pond: 300, pasture: 900, orchard: 1200 })[kind] * Math.pow(l, 1.8)); // 从 l 级升到 l+1 级
  const ranchNeedLv = l => (l - 1) * RANCH.needLvPer;                                       // 升到 l 级需要的玩家等级
  // 旧接口（按玩家等级的容量）保留给 1 级时使用
  const pondCap = () => pondCapOf(1), pastureCap = () => pastureCapOf(1);
  // 牧羊犬等级：最多 100 级。等级越高：一次牧羊时间越长、加速越多、一次能赶的羊越多
  const herdOf = lv => ({ min: RANCH.herdMin + (lv - 1) * 2, boost: +(0.3 + 0.007 * lv).toFixed(3), cap: 30 + 12 * (lv - 1) });
  // 一群羊攒了多少茬羊毛（可以是小数）。s = { t, n, last, acc }，herd = { from, until, boost, share }：牧羊期间速度 × (1 + boost × share)
  function sheepCycles(s, now, herd) {
    const def = SHEEP[s.t]; if (!def) return 0; const P = def.period * 1000, a = s.last || now, b = Math.max(a, now);
    let ov = 0; if (herd && herd.until > a) ov = Math.max(0, Math.min(b, herd.until) - Math.max(a, herd.from || 0));
    const k = herd ? (herd.boost !== undefined ? herd.boost : RANCH.herdBoost) * (herd.share !== undefined ? herd.share : 1) : 0;
    return Math.min(RANCH.woolMax, (s.acc || 0) + ((b - a) + ov * k) / P);
  }
  // 一批果树攒了多少茬果子：种下 grow 秒后开始结果
  function treeCycles(r, now) { const d = TREES[r.t]; if (!d) return 0; const start = Math.max(r.last || 0, (r.at || now) + d.grow * 1000); if (now <= start) return Math.min(RANCH.fruitMax, r.acc || 0); return Math.min(RANCH.fruitMax, (r.acc || 0) + (now - start) / (d.period * 1000)); }
  const treeGrowLeft = (r, now) => { const d = TREES[r.t]; return d ? Math.max(0, ((r.at || 0) + d.grow * 1000 - now) / 1000) : 0; };
  const fishLeft = (f, now) => Math.max(0, ((f.at || 0) + (FISH[f.t] ? FISH[f.t].time * 1000 : 0) - now) / 1000);
  // 鱼塘、牧场产出的物品：fs<n> 鱼，wl<n> 羊毛
  function ranchItem(item) { const hm = /^hm(\d+)$/.exec(item || ''); if (hm) { const d = CONTENT.HUNT.materials[+hm[1]]; return d ? { kind: 'hunt', id: d.id, name: d.name, price: d.price } : null; } const m = /^(fs|wl|fr)(\d+)$/.exec(item || ''); if (!m) return null; const d = ({ fs: FISH, wl: SHEEP, fr: TREES })[m[1]][+m[2]]; if (!d) return null; return m[1] === 'fs' ? { kind: 'fish', id: d.id, name: d.name, price: d.sell } : m[1] === 'wl' ? { kind: 'wool', id: d.id, name: d.woolName, price: d.sell } : { kind: 'fruit', id: d.id, name: d.fruit, price: d.sell }; }
  const VERSION = '3.17.1'; // 每次发布改这里；设置页和 /api/health 会显示
  const ZONES = CONTENT.ZONES, ASSETS = CONTENT.ASSETS, HOME = CONTENT.HOME, BUILDINGS = CONTENT.BUILDINGS, BIOMES = CONTENT.BIOMES;

  /* ===== V0.3 家园布局与建造网格（3D 画面和服务器共用 content/home.jsonc） ===== */
  const fieldCenter = f => { const F = HOME.fields; return f === 0 ? [0, 0] : [(((f - 1) % F.cols) - (F.cols - 1) / 2) * F.dx, F.z0 - Math.floor((f - 1) / F.cols) * F.dz]; };
  const pastSize = l => { const P = HOME.pasture, g = Math.pow((Math.min(100, Math.max(1, l)) - 1) / 99, P.pow); return [P.base[0] + P.grow[0] * g, P.base[1] + P.grow[1] * g]; };
  const pondsOf = pondLv => Math.min(HOME.ponds.list.length, 1 + Math.floor(((pondLv || 1) - 1) / HOME.ponds.perLv));
  const OCC = { free: 0, field: 1, structure: 2, pond: 3, pasture: 4, orchard: 5, built: 9 };
  function gridSpec() { const G = HOME.grid; return { cell: G.cell, x0: G.x0, z0: G.z0, W: Math.round((G.x1 - G.x0) / G.cell), H: Math.round((G.z1 - G.z0) / G.cell) }; }
  /* 家园哪些格子已经被占用：s = { fields: 已开辟的菜地片数, pastLv: 牧场等级, pondLv: 鱼塘等级 } */
  function homeOccupancy(s) {
    s = s || {}; const g = gridSpec(), cells = new Uint8Array(g.W * g.H);
    const mark = (x0, z0, x1, z1, code) => { const a = Math.max(0, Math.floor((x0 - g.x0) / g.cell)), b = Math.min(g.W - 1, Math.ceil((x1 - g.x0) / g.cell) - 1), c = Math.max(0, Math.floor((z0 - g.z0) / g.cell)), d = Math.min(g.H - 1, Math.ceil((z1 - g.z0) / g.cell) - 1); for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) if (!cells[j * g.W + i]) cells[j * g.W + i] = code; };
    for (let f = 0; f < Math.max(1, s.fields || 1); f++) { const [x, z] = fieldCenter(f), F = HOME.fields; mark(x - F.w / 2, z - F.d / 2, x + F.w / 2, z + F.d / 2, OCC.field); }
    HOME.structures.forEach(o => mark(o.x - o.w / 2, o.z - o.d / 2, o.x + o.w / 2, o.z + o.d / 2, OCC.structure));
    HOME.ponds.list.slice(0, pondsOf(s.pondLv)).forEach(([x, z]) => mark(x - HOME.ponds.w / 2, z - HOME.ponds.d / 2, x + HOME.ponds.w / 2, z + HOME.ponds.d / 2, OCC.pond));
    { const P = HOME.pasture, [w, d] = pastSize(s.pastLv || 1); mark(P.x0, P.z0, P.x0 + w, P.z0 + d, OCC.pasture); }
    { const O = HOME.orchard, cx = (O.x0 + O.x1) / 2, cz = (O.z0 + O.z1) / 2; for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) { const x = g.x0 + (i + 0.5) * g.cell, z = g.z0 + (j + 0.5) * g.cell; if (Math.hypot(x - cx, z - cz) <= O.r && !cells[j * g.W + i]) cells[j * g.W + i] = OCC.orchard; } }
    return Object.assign(g, { cells });
  }
  /* 一个建筑实例占的格子：it = { type, gx, gz, rot }（rot 0~3，每次转 90°，奇数时宽高互换） */
  function footprint(it) { const b = BUILDINGS.find(x => x.id === it.type); if (!b) return null; const odd = (it.rot | 0) % 2 === 1, w = odd ? b.d : b.w, d = odd ? b.w : b.d, out = []; for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push([it.gx + i, it.gz + j]); return out; }
  /* 能不能摆：返回空字符串表示可以，否则返回原因（中文，直接显示给玩家） */
  function canPlace(occ, items, it, lv, moving) { /* moving：移动已有的建筑，不再检查开放状态、等级和数量 */
    const b = BUILDINGS.find(x => x.id === it.type); if (!b) return '没有这种建筑';
    if (!moving && b.status !== 'live') return b.name + '还没有开放';
    if (!moving && lv !== undefined && lv < b.lv) return `需要 Lv.${b.lv}`;
    if (!moving && b.max && items.filter(x => x.type === it.type).length >= b.max) return `${b.name}最多只能建 ${b.max} 个`;
    const used = new Set(); items.forEach(x => (footprint(x) || []).forEach(([i, j]) => used.add(j * occ.W + i)));
    for (const [i, j] of footprint(it)) { if (i < 0 || j < 0 || i >= occ.W || j >= occ.H) return '超出家园范围'; const k = j * occ.W + i; if (occ.cells[k]) return '这里已经有东西了'; if (used.has(k)) return '和别的建筑重叠了'; }
    return '';
  }
  /* ---------- 第 1 期：四季与节日（content/seasons.jsonc，按北京时间） ---------- */
  const SEASONS = CONTENT.SEASONS;
  function monthOf(ms) { return new Date(ms + TZ_MIN * 60000).getUTCMonth() + 1; }
  function seasonOf(ms) { const m = monthOf(ms); return SEASONS.list.find(s => s.months.includes(m)) || SEASONS.list[0]; }
  /* 作物属于哪一类（季节表里的 crops 用这个）：南瓜 / 瓜按 art.kind，其他按 art.type */
  function cropTag(c) { const a = (c && c.art) || {}; return a.type === 'vine' ? (a.kind === 'pumpkin' ? 'pumpkin' : 'melon') : a.type || ''; }
  function inSeason(cropId, ms) { const c = CROPS[cropId]; return !!c && seasonOf(ms).crops.includes(cropTag(c)); }
  /* 下一个季节从哪天开始（毫秒） */
  function seasonEnd(ms) { const cur = seasonOf(ms); let t = dayStart(ms); for (let i = 0; i < 100; i++) { t += 86400000; if (seasonOf(t) !== cur) return t; } return t; }
  function dayMs(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) - TZ_MIN * 60000; }
  /* 正在进行的节日，换算成和后台活动一样的格式（服务器 activeEvents 会合并进去） */
  function festivalsAt(ms) { return SEASONS.festivals.map(f => ({ id: 'f_' + f.id, name: f.name, kind: f.kind, params: { mult: f.mult }, start_at: dayMs(f.start), end_at: dayMs(f.end) + 86400000, descr: f.descr || '', festival: true })).filter(e => e.start_at <= ms && e.end_at > ms); }
  /* ---------- 第 1 期：世界奇观（content/wonders.jsonc）。阶段存在布局里：{ type: 'greatwall', stage: 已建成的阶段数 } ---------- */
  const WONDERS = CONTENT.WONDERS;
  const wonderDef = id => WONDERS.find(w => w.id === id);
  /* 所有奇观带来的作物增产（累加） */
  function wonderBonus(items) { let b = 0; (items || []).forEach(it => { const w = wonderDef(it.type); if (w) for (let i = 0; i < Math.min(it.stage | 0, w.stages.length); i++) b += w.stages[i].bonus; }); return Math.round(b * 1000) / 1000; }
  /* ---------- 野外地图生成（V0.3 从 src/zones.js 搬到这里，第 2 期起服务器也用同一个种子算野兽位置）：不依赖 Three.js ---------- */
  function makeNoise(seed) {
    const r = rng(seed), N = 256, perm = new Uint16Array(N * 2), grad = new Float32Array(N);
    for (let i = 0; i < N; i++) { perm[i] = i; grad[i] = r(); } for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; } for (let i = 0; i < N; i++) perm[i + N] = perm[i];
    const sm = t => t * t * (3 - 2 * t), v = (x, y) => grad[perm[(perm[x & 255] + y) & 511] & 255];
    const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1), u = sm(xf), w = sm(yf); return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w; };
    return (x, y, oct) => { let s = 0, amp = 0.5, f = 1, norm = 0; for (let k = 0; k < (oct || 5); k++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; } return s / norm; };
  }
  function biomeAt(h, m) { const B = BIOMES; let b = B.find(x => h < x.maxH) || B[B.length - 1]; if (b.moist !== undefined && m < b.moist && b.dry) b = B.find(x => x.id === b.dry) || b; return b; }
  function genWorld(gen, seed) {
    const size = gen.size, seg = gen.seg, n = seg + 1, H = new Float32Array(n * n), M = new Float32Array(n * n), BI = new Array(n * n);
    const hN = makeNoise(seed), mN = makeNoise(seed ^ 0x9e3779b1), BIDX = {}; BIOMES.forEach((b, i) => { BIDX[b.id] = i; });
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / seg, w = j / seg, x = u * 4, y = w * 4, dx = u - 0.5, dz = w - 0.5, edge = Math.min(1, Math.hypot(dx, dz) * 2);
      let h = hN(x, y, 5) * 0.75 + Math.pow(Math.max(0, hN(x * 0.5 + 9, y * 0.5 + 3, 3) - 0.35), 1.4) * 1.1;
      h = h * (1 - Math.pow(edge, 3) * 0.55) + (edge > 0.92 ? (edge - 0.92) * 2 : 0);
      H[j * n + i] = Math.max(0, Math.min(1, h)); M[j * n + i] = mN(x * 1.3 + 4, y * 1.3 + 7, 4);
    }
    let lo = 1, hi = 0; for (let k = 0; k < H.length; k++) { if (H[k] < lo) lo = H[k]; if (H[k] > hi) hi = H[k]; } for (let k = 0; k < H.length; k++) { H[k] = (H[k] - lo) / (hi - lo || 1); BI[k] = biomeAt(H[k], M[k]); }
    const count = {}; BI.forEach(b => { count[b.id] = (count[b.id] || 0) + 1; });
    const r = rng(seed + 7), cellA = (size / seg) * (size / seg), trees = [], rocks = [];
    for (let k = 0; k < BI.length; k++) { const b = BI[k], i = k % n, j = (k / n) | 0; if (i === seg || j === seg) continue; const x = (i / seg - 0.5) * size, z = (j / seg - 0.5) * size;
      if (b.trees && r() < b.trees * cellA / 100) trees.push({ x: x + (r() - 0.5) * size / seg, z: z + (r() - 0.5) * size / seg, s: 0.7 + r() * 0.7, kind: b.tree || 'pine', ry: r() * 6.28 });
      if (b.rocks && r() < b.rocks * cellA / 100) rocks.push({ x: x + (r() - 0.5) * size / seg, z: z + (r() - 0.5) * size / seg, s: 0.4 + r() * 1.2, ry: r() * 6.28 }); }
    return { size, seg, n, H, M, BI, count, trees, rocks, seed, BIDX };
  }
  /* 地图上某点的群系 */
  function worldBiome(W, x, z) { const i = Math.max(0, Math.min(W.seg, Math.round((x / W.size + 0.5) * W.seg))), j = Math.max(0, Math.min(W.seg, Math.round((z / W.size + 0.5) * W.seg))); return W.BI[j * W.n + i]; }
  /* ---------- 第 2 期：名山猎场（content/hunt.jsonc）。同一个种子 + 等级，前后端算出一样的起点和野兽位置 ---------- */
  const HUNT = CONTENT.HUNT;
  function huntSpawns(seed, lv, W) {
    W = W || genWorld(HUNT.gen, seed); const r = rng(seed + 101), S = W.size, cells = [];
    for (let k = 0; k < W.BI.length; k++) { const i = k % W.n, j = (k / W.n) | 0; if (i < 4 || j < 4 || i > W.seg - 4 || j > W.seg - 4) continue; cells.push([k, (i / W.seg - 0.5) * S, (j / W.seg - 0.5) * S]); }
    /* 起点：靠近南边中间、能走的平地 */
    let start = [0, S * 0.3], bd = 1e9; cells.forEach(([k, x, z]) => { const b = W.BI[k]; if (!b.walk || b.id === 'snow' || b.id === 'rock') return; const d = Math.hypot(x, z - S * 0.3); if (d < bd) { bd = d; start = [x, z]; } });
    const list = []; HUNT.creatures.forEach((c, ci) => { if (lv < c.lv) return; const ok = cells.filter(([k, x, z]) => c.biomes.includes(W.BI[k].id) && Math.hypot(x - start[0], z - start[1]) > 28);
      for (let n = 0; n < c.count && ok.length; n++) { const p = ok.splice(Math.floor(r() * ok.length), 1)[0]; list.push({ i: list.length, id: c.id, x: Math.round(p[1] * 10) / 10, z: Math.round(p[2] * 10) / 10 }); } });
    return { start, list };
  }
  const CFG = { HOME, BUILDINGS, BIOMES, OCC, SEASONS, WONDERS, HUNT, makeNoise, biomeAt, genWorld, worldBiome, huntSpawns, wonderDef, wonderBonus, monthOf, seasonOf, cropTag, inSeason, seasonEnd, festivalsAt, fieldCenter, pastSize, pondsOf, gridSpec, homeOccupancy, footprint, canPlace };
  Object.assign(CFG, { ZONES, ASSETS, COLLIES, PETS_MAX, VERSION, COLS, ROWS, NPLOTS, FIELDS_MAX, MAX_PLOTS, fieldNeedLv, fieldCost, CROPS, RARITY, RULES, TASKS, WEEKLY, NEWBIE, ACHIEVEMENTS, THEMES, FRAMES, AVATAR_OPTS, PHRASES, SHOP_ITEMS, UNLOCK_ORDER, STAGE_NAME,
    SOILS, DOGS, soilOf, soilCost, dogChance,
    FISH, SHEEP, TREES, RANCH, pondCap, pastureCap, pondCapOf, pastureCapOf, orchardCapOf, ranchUpCost, ranchNeedLv, herdOf, sheepCycles, treeCycles, treeGrowLeft, fishLeft, ranchItem,
    expNeed, dogExpNeed, plotCost, plotNeedLv, redCost, stageOf, hash32, rng, setTz, dayKey, dayStart, weekKey, weekEnd, rainUntil, dayBonus, plotDur, plotSpeed, probCount, remainSec, advancePlot, stealCapPct, orderSlots });
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.GAMECFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
