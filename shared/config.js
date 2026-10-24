/* =====================================================
   丰收农场 · 前后端共用配置与规则
   服务端是权威；客户端只用它来显示与插值。
   ===================================================== */
(function (root) {
  'use strict';
  const COLS = 6, ROWS = 4, NPLOTS = COLS * ROWS;
  // v3：农田可以一片一片开辟，每片 24 块地，最多 20 片（480 块地）。第 1 片是农场中间这片（一块一块开垦），之后每片买下来 24 块地全部开好
  const FIELDS_MAX = 20, MAX_PLOTS = NPLOTS * FIELDS_MAX;
  const fieldNeedLv = f => 15 + (f - 1) * 25;                 // 开辟第 f 片（f 从 1 开始，0 是自家这片）需要的等级
  const fieldCost = f => Math.round(30000 * Math.pow(f, 1.7));

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
    // v2.3 后期作物（Lv.28–44）
    { id: 24, name: '火焰辣椒', lv: 28, seed: 9000, time: 9000, yield: 104, price: 120, exp: 2600, seasons: 2, rarity: 3, art: { type: 'bush', kind: 'chili', fruit: '#ff4a10', unripe: '#7fc04a', nf: 6, h: 54, hh: 78, is: 1.0 } },
    { id: 25, name: '翡翠白菜', lv: 30, seed: 14000, time: 14400, yield: 112, price: 168, exp: 4300, seasons: 1, rarity: 3, art: { type: 'cabbage', head: '#3fcf8e', hh: 70, is: 1.1 } },
    { id: 26, name: '胭脂萝卜', lv: 32, seed: 16000, time: 12600, yield: 116, price: 185, exp: 4600, seasons: 1, rarity: 3, art: { type: 'root', shape: 'radish', leaf: '#4fb040', root: '#e02a4a', blush: '#ff8aa0', hh: 72, is: 1.15 } },
    { id: 27, name: '星空蓝莓', lv: 34, seed: 22000, time: 21600, yield: 124, price: 240, exp: 6200, seasons: 2, rarity: 4, art: { type: 'bush', kind: 'berry', fruit: '#2c2f9a', unripe: '#b8c8e8', nf: 6, h: 24, low: true, hh: 54, is: 1.2 } },
    { id: 28, name: '金丝胡萝卜', lv: 36, seed: 26000, time: 18000, yield: 128, price: 270, exp: 6800, seasons: 1, rarity: 3, art: { type: 'root', shape: 'carrot', leaf: '#5ab84a', root: '#ffc21a', hh: 74, is: 1.15 } },
    { id: 29, name: '琥珀南瓜', lv: 38, seed: 34000, time: 28800, yield: 132, price: 340, exp: 8800, seasons: 1, rarity: 4, art: { type: 'vine', kind: 'pumpkin', fruit: '#c8641a', hh: 64, is: 1.05 } },
    { id: 30, name: '紫晶茄子', lv: 41, seed: 42000, time: 25200, yield: 136, price: 400, exp: 10500, seasons: 2, rarity: 4, art: { type: 'bush', kind: 'egg', fruit: '#4a1a72', unripe: '#8fae6a', nf: 3, h: 56, hh: 80, is: 1.0 } },
    { id: 31, name: '黄金西瓜', lv: 44, seed: 60000, time: 36000, yield: 140, price: 560, exp: 14000, seasons: 2, rarity: 4, art: { type: 'vine', kind: 'melon', fruit: '#d8a81a', hh: 62, is: 1.0 } },
    // v2.5 扩容：花卉、谷物和更多前期作物（Lv.1–40）
    { id: 32, name: '小麦', lv: 2, seed: 50, time: 100, yield: 22, price: 4, exp: 17, seasons: 1, rarity: 1, art: { type: 'grain', kind: 'wheat', ear: '#e8c25a', stalk: '#c8b05a', hh: 96, is: 0.85 } },
    { id: 33, name: '生菜', lv: 1, seed: 30, time: 60, yield: 14, price: 3, exp: 11, seasons: 1, rarity: 1, art: { type: 'cabbage', head: '#9ee86a', hh: 66, is: 1.15 } },
    { id: 34, name: '郁金香', lv: 4, seed: 150, time: 280, yield: 28, price: 9, exp: 46, seasons: 1, rarity: 1, art: { type: 'flower', kind: 'tulip', petal: '#ff4a5e', hh: 84, is: 1.0 } },
    { id: 35, name: '水稻', lv: 6, seed: 320, time: 560, yield: 44, price: 11, exp: 94, seasons: 1, rarity: 1, art: { type: 'grain', kind: 'rice', ear: '#e6d27a', stalk: '#8fbf4a', hh: 90, is: 0.9 } },
    { id: 36, name: '樱桃萝卜', lv: 2, seed: 40, time: 75, yield: 18, price: 4, exp: 14, seasons: 1, rarity: 1, art: { type: 'root', shape: 'radish', leaf: '#62bc44', root: '#ff3a5a', blush: '#ffffff', hh: 70, is: 1.15 } },
    { id: 37, name: '黄瓜', lv: 5, seed: 210, time: 380, yield: 36, price: 9, exp: 64, seasons: 2, rarity: 1, art: { type: 'bush', kind: 'chili', fruit: '#3f9a32', unripe: '#9ad070', nf: 4, h: 56, hh: 80, is: 1.0 } },
    { id: 38, name: '薰衣草', lv: 8, seed: 600, time: 960, yield: 52, price: 17, exp: 170, seasons: 1, rarity: 2, art: { type: 'flower', kind: 'lavender', petal: '#9a6ae0', hh: 86, is: 1.0 } },
    { id: 39, name: '青椒', lv: 4, seed: 120, time: 220, yield: 30, price: 7, exp: 40, seasons: 2, rarity: 1, art: { type: 'bush', kind: 'chili', fruit: '#2f9a2a', unripe: '#8fd060', nf: 5, h: 54, hh: 78, is: 1.0 } },
    { id: 40, name: '玫瑰', lv: 12, seed: 1300, time: 1900, yield: 64, price: 26, exp: 350, seasons: 1, rarity: 2, art: { type: 'flower', kind: 'rose', petal: '#e0203a', hh: 86, is: 1.0 } },
    { id: 41, name: '哈密瓜', lv: 14, seed: 1900, time: 2500, yield: 72, price: 33, exp: 500, seasons: 2, rarity: 2, art: { type: 'vine', kind: 'melon', fruit: '#e6d68a', hh: 62, is: 1.0 } },
    { id: 42, name: '金麦穗', lv: 18, seed: 4000, time: 6300, yield: 90, price: 60, exp: 1150, seasons: 1, rarity: 3, art: { type: 'grain', kind: 'wheat', ear: '#ffcc2a', stalk: '#e0b040', hh: 96, is: 0.85 } },
    { id: 43, name: '粉郁金香', lv: 20, seed: 5200, time: 9000, yield: 96, price: 78, exp: 1600, seasons: 1, rarity: 3, art: { type: 'flower', kind: 'tulip', petal: '#ff8ac8', hh: 84, is: 1.0 } },
    { id: 44, name: '红薯', lv: 9, seed: 680, time: 1050, yield: 58, price: 17, exp: 185, seasons: 1, rarity: 1, art: { type: 'root', shape: 'carrot', leaf: '#5aa848', root: '#c8503a', hh: 74, is: 1.15 } },
    { id: 45, name: '紫米', lv: 23, seed: 7600, time: 12600, yield: 104, price: 104, exp: 2400, seasons: 1, rarity: 3, art: { type: 'grain', kind: 'rice', ear: '#6a2a7a', stalk: '#7aa84a', hh: 90, is: 0.9 } },
    { id: 46, name: '蓝色妖姬', lv: 33, seed: 19000, time: 19800, yield: 120, price: 215, exp: 5400, seasons: 1, rarity: 4, art: { type: 'flower', kind: 'rose', petal: '#2a5ae0', hh: 86, is: 1.0 } },
    { id: 47, name: '彩虹郁金香', lv: 40, seed: 38000, time: 27000, yield: 134, price: 370, exp: 9800, seasons: 1, rarity: 4, art: { type: 'flower', kind: 'tulip', petal: 'rainbow', hh: 84, is: 1.0 } },
  ];
  const RARITY = ['', '普通', '稀有', '史诗', '传说'];

  // 土地等级：普通 → 红土地 → 黑土地 → 金土地（生长速度、产量逐级提高）
  // 升级费用 = base + step × 已经达到该等级的地块数
  const SOILS = [
    { id: 0, name: '普通土地', lv: 0, speed: 1, yield: 1, base: 0, step: 0 },
    { id: 1, name: '红土地', lv: 5, speed: 1.2, yield: 1.2, base: 1500, step: 600 },
    { id: 2, name: '黑土地', lv: 15, speed: 1.35, yield: 1.4, base: 8000, step: 2000 },
    { id: 3, name: '金土地', lv: 28, speed: 1.5, yield: 1.65, base: 30000, step: 6000 },
  ];
  // 看家狗：福旺、睿宝，可以都养；喂饱时各自独立判定能不能抓住来偷菜的人
  const DOGS = [
    { id: 'fuwang', name: '福旺', col: 'dog', price: 300, lv: 2, bite: 5, base: 0.3, perLv: 0.03, max: 0.6, desc: '蓝陌边牧，灰白相间带黑斑，机灵亲人，咬一口 5 金币' },
    { id: 'ruibao', name: '睿宝', col: 'dog2', price: 3000, lv: 10, bite: 15, base: 0.4, perLv: 0.03, max: 0.7, desc: '黄白边牧，金棕色被毛配白色毛领，聪明敏捷，咬一口 15 金币' },
  ];

  const RULES = {
    startGold: 300, startPlots: 6, maxLv: 4000,
    fertPrice: 60, fertBoost: 0.3, dogfoodPrice: 120, dogPrice: 400, dogNeedLv: 3, dogFeedMin: 120, // dogPrice/dogNeedLv 为旧字段，狗的数值见 DOGS
    redNeedLv: 5,
    // 偷菜
    stealDelaySec: 30,          // 成熟后的主人保护时间
    stealPctMin: 0.1, stealPctMax: 0.2, // 每次偷取占原始产量比例
    stealMaxPct: 0.5,           // 一块地最多被偷走的比例（主人保底 50%）
    newbieLv: 5, newbieMaxPct: 0.25, // 主人低于此等级时保底更高
    // v2.7 起偷菜、帮忙都没有每日次数和经验上限（自家私服，玩得开心最重要）
    stealExp: 3,
    stealCritChance: 0.1,       // 手气爆棚：一次摘两份（仍受主人保底限制）
    dogBlockBase: 0.35, dogBlockPerLv: 0.03, dogBlockMax: 0.7, dogBiteMin: 10, dogBiteMax: 40,
    // 互助
    helpExp: 4, helpGold: 6,
    helpBoost: 0.03,            // 每次帮忙让对方作物多长 3%
    // 生长
    probSlow: 0.62, season2Start: 0.45,
    goldenChance: 0.04, goldenPriceMult: 5,
    bumperChance: 0.08, bumperBonus: 0.5, // 大丰收：额外多收 50%
    // 订单：Lv.10 / 20 / 30 各多一个订单位
    orderSlots: 3, orderSlotEvery: 10, orderSlotsMax: 6, orderRefresh: 20, orderRefreshCost: 30,
    // 市场
    marketFee: 0.05, marketMinMult: 0.5, marketMaxMult: 5.0, marketMaxListings: 30, marketTtlHours: 168,
    // 留言
    gbDailyLimit: 500,
  };

  const TASKS = [
    { id: 'plant', ic: '🌱', tx: '种植作物', need: 12, gold: 150, exp: 30 },
    { id: 'harvest', ic: '🧺', tx: '收获作物', need: 15, gold: 250, exp: 50 },
    { id: 'care', ic: '💧', tx: '浇水 / 除草 / 除虫', need: 6, gold: 150, exp: 30 },
    { id: 'steal', ic: '🥷', tx: '摘取别人的果实', need: 6, gold: 220, exp: 40 },
    { id: 'help', ic: '🤝', tx: '帮别人打理农田', need: 4, gold: 180, exp: 35 },
    { id: 'sell', ic: '💰', tx: '卖出作物赚取金币', need: 800, gold: 300, exp: 60 },
  ];
  const WEEKLY = [
    { id: 'w_harvest', stat: 'harvest', ic: '🧺', tx: '本周收获作物', need: 120, gold: 1500, exp: 300 },
    { id: 'w_steal', stat: 'steal', ic: '🥷', tx: '本周摘取别人的果实', need: 40, gold: 1200, exp: 240 },
    { id: 'w_help', stat: 'help', ic: '🤝', tx: '本周帮别人打理', need: 30, gold: 1200, exp: 240 },
    { id: 'w_order', stat: 'order', ic: '📦', tx: '本周完成订单', need: 10, gold: 2000, exp: 400 },
    { id: 'w_trade', stat: 'trade', ic: '🏷️', tx: '本周在集市成交', need: 5, gold: 1000, exp: 200 },
  ];
  const NEWBIE = [
    { id: 'n_plant', stat: 'plant', tx: '在空地上种下第一颗种子', need: 1, gold: 50 },
    { id: 'n_harvest', stat: 'harvest', tx: '收获一次作物', need: 1, gold: 80 },
    { id: 'n_sell', stat: 'sell', tx: '在仓库卖出作物', need: 1, gold: 80 },
    { id: 'n_friend', stat: 'friend', tx: '加一位好友（附近的人、村民或邀请朋友都可以）', need: 1, gold: 200 },
    { id: 'n_visit', stat: 'visit', tx: '去别人的农场串门', need: 1, gold: 100 },
    { id: 'n_social', stat: 'social', tx: '在别人的农场摘一次果实或帮一次忙', need: 1, gold: 200 },
  ];
  // 成就：stat 对应 users 表的累计计数
  const ACHIEVEMENTS = [
    { id: 'a_h1', stat: 'harvest_total', need: 50, tx: '初获丰收', desc: '累计收获 50 次', gold: 300, title: '小农夫' },
    { id: 'a_h2', stat: 'harvest_total', need: 500, tx: '丰收能手', desc: '累计收获 500 次', gold: 2000, title: '丰收能手' },
    { id: 'a_h3', stat: 'harvest_total', need: 3000, tx: '农场大亨', desc: '累计收获 3000 次', gold: 10000, title: '农场大亨' },
    { id: 'a_s1', stat: 'steal_total', need: 20, tx: '妙手空空', desc: '累计摘取好友果实 20 次', gold: 300, title: '妙手空空' },
    { id: 'a_s2', stat: 'steal_total', need: 300, tx: '神偷', desc: '累计摘取 300 次', gold: 3000, title: '月下神偷' },
    { id: 'a_s3', stat: 'steal_total', need: 2000, tx: '江湖传说', desc: '累计摘取 2000 次', gold: 12000, title: '江湖传说' },
    { id: 'a_p1', stat: 'help_total', need: 20, tx: '热心邻居', desc: '累计帮好友 20 次', gold: 300, title: '热心邻居' },
    { id: 'a_p2', stat: 'help_total', need: 300, tx: '劳模', desc: '累计帮好友 300 次', gold: 3000, title: '劳动模范' },
    { id: 'a_p3', stat: 'help_total', need: 2000, tx: '好人缘', desc: '累计帮好友 2000 次', gold: 12000, title: '十里八乡好人缘' },
    { id: 'a_f1', stat: 'friends', need: 3, tx: '呼朋唤友', desc: '拥有 3 位好友', gold: 500, title: '人气农夫' },
    { id: 'a_f2', stat: 'friends', need: 10, tx: '社交达人', desc: '拥有 10 位好友', gold: 2000, title: '社交达人' },
    { id: 'a_g1', stat: 'golden_total', need: 1, tx: '金光闪闪', desc: '收获第一个变异金色作物', gold: 500, title: '幸运儿' },
    { id: 'a_g2', stat: 'golden_total', need: 20, tx: '点石成金', desc: '收获 20 次金色作物', gold: 5000, title: '点石成金' },
    { id: 'a_c1', stat: 'codex', need: 10, tx: '收藏家', desc: '图鉴收集 10 种', gold: 1000, title: '收藏家' },
    { id: 'a_c2', stat: 'codex', need: 24, tx: '博物学家', desc: '图鉴收集 24 种', gold: 6000, title: '博物学家' },
    { id: 'a_c3', stat: 'codex', need: 48, tx: '万物有灵', desc: '图鉴收集全部 48 种普通作物', gold: 20000, title: '万物有灵' },
    { id: 'a_l1', stat: 'lv', need: 10, tx: '小有所成', desc: '达到 Lv.10', gold: 1000 },
    { id: 'a_l2', stat: 'lv', need: 20, tx: '远近闻名', desc: '达到 Lv.20', gold: 5000, title: '远近闻名' },
    { id: 'a_l3', stat: 'lv', need: 30, tx: '一方乡绅', desc: '达到 Lv.30', gold: 15000, title: '一方乡绅' },
    { id: 'a_l4', stat: 'lv', need: 40, tx: '农业宗师', desc: '达到 Lv.40', gold: 40000, title: '农业宗师' },
    { id: 'a_l5', stat: 'lv', need: 100, tx: '百级农场主', desc: '达到 Lv.100', gold: 100000, title: '百级农场主' },
    { id: 'a_l6', stat: 'lv', need: 500, tx: '田园领主', desc: '达到 Lv.500', gold: 600000, title: '田园领主' },
    { id: 'a_l7', stat: 'lv', need: 1000, tx: '千级传说', desc: '达到 Lv.1000', gold: 2000000, title: '千级传说' },
    { id: 'a_l8', stat: 'lv', need: 2000, tx: '大地之子', desc: '达到 Lv.2000', gold: 6000000, title: '大地之子' },
    { id: 'a_l9', stat: 'lv', need: 4000, tx: '丰收之神', desc: '达到满级 Lv.4000', gold: 20000000, title: '丰收之神' },
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
  const PHRASES = ['来串门啦', '菜不错，拿走两个～', '帮你浇过水了', '虫子已经帮你除掉了', '一起加油种田', '谢谢你的帮忙', '别再偷我的菜了！', '小心我家的狗', '晚安，明天见', '你的农场真漂亮'];

  const SHOP_ITEMS = [
    { id: 'fert', name: '化肥', ic: '🧪', price: RULES.fertPrice, desc: '让作物成长进度 +30%' },
    { id: 'dogfood', name: '狗粮', ic: '🍖', price: RULES.dogfoodPrice, desc: '小狗吃饱后看家 60 分钟，并获得成长经验' },
  ];

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
  const FISH = [
    { id: 0, name: '小鲫鱼', lv: 1, price: 20, time: 600, yield: 2, sell: 18, exp: 6, col: '#b8c0b0', size: 0.8 },
    { id: 1, name: '金鱼', lv: 3, price: 60, time: 1800, yield: 2, sell: 52, exp: 14, col: '#ff8a2a', size: 0.75 },
    { id: 2, name: '草鱼', lv: 6, price: 150, time: 3600, yield: 3, sell: 78, exp: 30, col: '#7a9a6a', size: 1.05 },
    { id: 3, name: '鲤鱼', lv: 10, price: 400, time: 7200, yield: 3, sell: 195, exp: 60, col: '#c8a060', size: 1.1 },
    { id: 4, name: '锦鲤', lv: 15, price: 1200, time: 14400, yield: 3, sell: 610, exp: 130, col: '#ff5a3a', size: 1.15, spots: '#ffffff' },
    { id: 5, name: '金龙鱼', lv: 22, price: 4000, time: 28800, yield: 3, sell: 1950, exp: 300, col: '#ffcc2a', size: 1.25 },
  ];
  // 羊：买来放进羊圈，隔一段时间长一茬羊毛，剪下来卖钱；羊毛长满 woolMax 茬后不再长，记得来剪
  const SHEEP = [
    { id: 0, name: '小绵羊', lv: 4, price: 500, period: 7200, wool: 2, woolName: '白羊毛', sell: 48, exp: 20, body: '#fbf8f0', face: '#3a3230' },
    { id: 1, name: '黑面羊', lv: 12, price: 2000, period: 10800, wool: 3, woolName: '黑羊毛', sell: 85, exp: 45, body: '#f2ede2', face: '#151214' },
    { id: 2, name: '羊驼', lv: 20, price: 6000, period: 14400, wool: 3, woolName: '羊驼毛', sell: 230, exp: 90, body: '#e8d2a8', face: '#e8d2a8', alpaca: true },
  ];
  // 果树：买树苗种进果园，长大（grow 秒）后每 period 秒结一茬果子，最多攒 3 茬
  const TREES = [
    { id: 0, name: '苹果树', fruit: '苹果', lv: 3, price: 800, grow: 3600, period: 5400, yield: 6, sell: 28, exp: 30, col: '#e8352a' },
    { id: 1, name: '桃树', fruit: '水蜜桃', lv: 8, price: 2000, grow: 7200, period: 7200, yield: 6, sell: 55, exp: 55, col: '#ff9aa8', blossom: '#ffc8d8' },
    { id: 2, name: '橙子树', fruit: '橙子', lv: 15, price: 5000, grow: 10800, period: 9000, yield: 7, sell: 95, exp: 90, col: '#ff9a1a' },
    { id: 3, name: '梨树', fruit: '雪梨', lv: 25, price: 12000, grow: 14400, period: 10800, yield: 7, sell: 170, exp: 150, col: '#d8e070' },
    { id: 4, name: '樱桃树', fruit: '樱桃', lv: 40, price: 30000, grow: 21600, period: 14400, yield: 8, sell: 330, exp: 260, col: '#c8102a', blossom: '#ffe0ec' },
    { id: 5, name: '柿子树', fruit: '柿子', lv: 60, price: 70000, grow: 28800, period: 18000, yield: 8, sell: 640, exp: 420, col: '#ff7a10' },
    { id: 6, name: '荔枝树', fruit: '荔枝', lv: 90, price: 160000, grow: 36000, period: 21600, yield: 9, sell: 1250, exp: 700, col: '#d8303a' },
    { id: 7, name: '芒果树', fruit: '芒果', lv: 130, price: 380000, grow: 43200, period: 25200, yield: 9, sell: 2600, exp: 1150, col: '#ffc21a' },
    { id: 8, name: '石榴树', fruit: '石榴', lv: 200, price: 900000, grow: 57600, period: 28800, yield: 10, sell: 5200, exp: 1900, col: '#b8102a' },
    { id: 9, name: '金苹果树', fruit: '金苹果', lv: 400, price: 3000000, grow: 86400, period: 36000, yield: 10, sell: 15000, exp: 4200, col: '#ffd23a' },
  ];
  // 鱼塘、牧场、果园都可以一级一级扩建（最多 100 级），扩建要求玩家等级，越往后越贵、容量越大
  const RANCH = {
    maxLv: 100, needLvPer: 35,                  // 扩建到 L 级需要玩家等级 (L-1)×35
    woolMax: 3, fruitMax: 3,                    // 羊毛、果子最多攒 3 茬
    herdMin: 120, herdBoost: 0.5,               // 牧羊基础：2 小时、羊毛快 50%（狗等级越高越久、越快、赶得越多）
    dogMaxLv: 100,
  };
  const _q = (l, a, b, c) => Math.round(a + b * (l - 1) + c * (l - 1) * (l - 1));
  const pondCapOf = l => _q(Math.max(1, Math.min(RANCH.maxLv, l || 1)), 6, 4, 0.12);        // 1 级 6 条 → 100 级约 1580 条
  const pastureCapOf = l => _q(Math.max(1, Math.min(RANCH.maxLv, l || 1)), 3, 3, 0.1);      // 1 级 3 只 → 100 级约 1280 只
  const orchardCapOf = l => _q(Math.max(1, Math.min(RANCH.maxLv, l || 1)), 4, 2, 0.05);     // 1 级 4 棵 → 100 级约 690 棵
  const ranchUpCost = (kind, l) => Math.round(({ pond: 600, pasture: 900, orchard: 1200 })[kind] * Math.pow(l, 1.9)); // 从 l 级升到 l+1 级
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
  function ranchItem(item) { const m = /^(fs|wl|fr)(\d+)$/.exec(item || ''); if (!m) return null; const d = ({ fs: FISH, wl: SHEEP, fr: TREES })[m[1]][+m[2]]; if (!d) return null; return m[1] === 'fs' ? { kind: 'fish', id: d.id, name: d.name, price: d.sell } : m[1] === 'wl' ? { kind: 'wool', id: d.id, name: d.woolName, price: d.sell } : { kind: 'fruit', id: d.id, name: d.fruit, price: d.sell }; }
  const VERSION = '3.0.0'; // 每次发布改这里；设置页和 /api/health 会显示
  const CFG = { VERSION, COLS, ROWS, NPLOTS, FIELDS_MAX, MAX_PLOTS, fieldNeedLv, fieldCost, CROPS, RARITY, RULES, TASKS, WEEKLY, NEWBIE, ACHIEVEMENTS, THEMES, FRAMES, AVATAR_OPTS, PHRASES, SHOP_ITEMS, UNLOCK_ORDER, STAGE_NAME,
    SOILS, DOGS, soilOf, soilCost, dogChance,
    FISH, SHEEP, TREES, RANCH, pondCap, pastureCap, pondCapOf, pastureCapOf, orchardCapOf, ranchUpCost, ranchNeedLv, herdOf, sheepCycles, treeCycles, treeGrowLeft, fishLeft, ranchItem,
    expNeed, dogExpNeed, plotCost, plotNeedLv, redCost, stageOf, hash32, rng, setTz, dayKey, dayStart, weekKey, weekEnd, rainUntil, dayBonus, plotDur, plotSpeed, probCount, remainSec, advancePlot, stealCapPct, orderSlots };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.GAMECFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
