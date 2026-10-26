/* =====================================================
   EdgeOne Pages 云函数入口：处理所有 /api/* 请求
   ⚠ 自动生成的文件，不要手改。源码在 server/ 和 shared/，改完运行 npm run build
   - 自包含：只依赖 Node 内置模块（Node 18+），不需要 npm 依赖
   - 数据库：Turso（环境变量 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN）
   ===================================================== */
// 注意：这里故意不写任何 import 声明。EdgeOne 构建时会改写 import 路径，内置模块改为运行时动态加载
const __mods = {}, __cache = {}, __builtins = {};
let __ready = null;
function __loadBuiltins() {
  if (!__ready) __ready = (async () => {
    const g = typeof process !== 'undefined' && process.getBuiltinModule; // Node 20.16+ / 22.3+
    if (g) { for (const n of ['crypto', 'async_hooks', 'fs', 'path']) __builtins[n] = process.getBuiltinModule('node:' + n); return; }
    const [c, a, f, p] = await Promise.all([import('node:crypto'), import('node:async_hooks'), import('node:fs'), import('node:path')]);
    Object.assign(__builtins, { crypto: c, async_hooks: a, fs: f, path: p });
  })();
  return __ready;
}
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (id in __builtins) return __builtins[id];
  if (['crypto', 'async_hooks', 'fs', 'path'].includes(id)) throw new Error('内置模块还没加载：' + id);
  if (id === 'node:sqlite') throw new Error('EdgeOne 上不使用本地 SQLite，请配置 TURSO_DATABASE_URL');
  if (__cache[id]) return __cache[id].exports;
  const module = { exports: {} }; __cache[id] = module; __mods[id](module, module.exports, __req); return module.exports;
}

__def("shared/content.js", function (module, exports, __req) {
/* 自动生成，不要手改：源文件在 content/*.jsonc，运行 node tools/build-content.js 重新生成 */
(function (root) {
  'use strict';
  const CONTENT = {"RULES":{"startGold":300,"startPlots":6,"maxLv":4000,"fertPrice":60,"fertBoost":0.3,"dogfoodPrice":120,"dogPrice":400,"dogNeedLv":3,"dogFeedMin":120,"redNeedLv":5,"stealDelaySec":30,"stealPctMin":0.1,"stealPctMax":0.2,"stealMaxPct":0.5,"newbieLv":5,"newbieMaxPct":0.25,"stealExp":3,"stealCritChance":0.1,"dogBlockBase":0.35,"dogBlockPerLv":0.03,"dogBlockMax":0.7,"dogBiteMin":10,"dogBiteMax":40,"helpExp":4,"helpGold":6,"helpBoost":0.03,"probSlow":0.62,"season2Start":0.45,"goldenChance":0.04,"goldenPriceMult":5,"bumperChance":0.08,"bumperBonus":0.5,"orderSlots":3,"orderSlotEvery":10,"orderSlotsMax":6,"orderRefresh":20,"orderRefreshCost":30,"marketFee":0.05,"marketMinMult":0.5,"marketMaxMult":5,"marketMaxListings":30,"marketTtlHours":168,"gbDailyLimit":500},"CROPS_SRC":{"list":[{"id":0,"name":"萝卜","lv":1,"seed":20,"time":40,"yield":12,"price":3,"exp":8,"seasons":1,"rarity":1,"art":{"type":"root","shape":"radish","leaf":"#5fb83f","root":"#fbf3f4","blush":"#ff8aa5","hh":72,"is":1.15}},{"id":1,"name":"白菜","lv":2,"seed":45,"time":90,"yield":20,"price":4,"exp":16,"seasons":1,"rarity":1,"art":{"type":"cabbage","head":"#b9e56e","hh":70,"is":1.1}},{"id":2,"name":"胡萝卜","lv":3,"seed":80,"time":150,"yield":26,"price":5,"exp":28,"seasons":1,"rarity":1,"art":{"type":"root","shape":"carrot","leaf":"#4fa83a","root":"#ff8c1a","hh":74,"is":1.15}},{"id":3,"name":"番茄","lv":4,"seed":130,"time":240,"yield":30,"price":7,"exp":42,"seasons":2,"rarity":1,"art":{"type":"bush","kind":"tomato","fruit":"#ec3b2e","unripe":"#a8d060","nf":4,"h":58,"hh":80,"is":0.95}},{"id":4,"name":"草莓","lv":5,"seed":200,"time":360,"yield":36,"price":9,"exp":62,"seasons":2,"rarity":1,"art":{"type":"bush","kind":"berry","fruit":"#ff3355","unripe":"#d6e8a8","nf":5,"h":24,"low":true,"hh":54,"is":1.2}},{"id":5,"name":"玉米","lv":6,"seed":300,"time":540,"yield":44,"price":11,"exp":90,"seasons":2,"rarity":1,"art":{"type":"corn","hh":112,"is":0.72}},{"id":6,"name":"辣椒","lv":7,"seed":420,"time":720,"yield":48,"price":13,"exp":125,"seasons":2,"rarity":1,"art":{"type":"bush","kind":"chili","fruit":"#e8281e","unripe":"#6fbf3a","nf":5,"h":54,"hh":78,"is":1}},{"id":7,"name":"茄子","lv":8,"seed":560,"time":900,"yield":54,"price":15,"exp":160,"seasons":2,"rarity":1,"art":{"type":"bush","kind":"egg","fruit":"#7b3fa8","unripe":"#8fae6a","nf":3,"h":56,"hh":80,"is":1}},{"id":8,"name":"南瓜","lv":10,"seed":800,"time":1200,"yield":60,"price":18,"exp":220,"seasons":1,"rarity":2,"art":{"type":"vine","kind":"pumpkin","fruit":"#ff9a1f","hh":64,"is":1.05}},{"id":9,"name":"西瓜","lv":12,"seed":1200,"time":1800,"yield":66,"price":24,"exp":330,"seasons":2,"rarity":2,"art":{"type":"vine","kind":"melon","fruit":"#37993b","hh":62,"is":1}},{"id":10,"name":"向日葵","lv":14,"seed":1800,"time":2400,"yield":72,"price":32,"exp":480,"seasons":1,"rarity":2,"art":{"type":"sunflower","hh":120,"is":0.7}},{"id":11,"name":"菠萝","lv":16,"seed":2800,"time":3600,"yield":80,"price":45,"exp":760,"seasons":1,"rarity":2,"art":{"type":"pine","hh":80,"is":1}},{"id":12,"name":"白萝卜","lv":3,"seed":60,"time":120,"yield":22,"price":4,"exp":22,"seasons":1,"rarity":1,"art":{"type":"root","shape":"radish","leaf":"#6cc04a","root":"#ffffff","blush":"#eef6dc","hh":72,"is":1.15}},{"id":13,"name":"紫甘蓝","lv":5,"seed":180,"time":300,"yield":32,"price":9,"exp":55,"seasons":1,"rarity":1,"art":{"type":"cabbage","head":"#a774d6","hh":70,"is":1.1}},{"id":14,"name":"小黄番茄","lv":7,"seed":380,"time":660,"yield":46,"price":13,"exp":115,"seasons":2,"rarity":2,"art":{"type":"bush","kind":"tomato","fruit":"#ffc21a","unripe":"#b8d870","nf":5,"h":56,"hh":80,"is":0.95}},{"id":15,"name":"蓝莓","lv":9,"seed":700,"time":1080,"yield":58,"price":18,"exp":190,"seasons":2,"rarity":2,"art":{"type":"bush","kind":"berry","fruit":"#4a5ad8","unripe":"#c8d8e8","nf":5,"h":24,"low":true,"hh":54,"is":1.2}},{"id":16,"name":"紫薯","lv":11,"seed":1000,"time":1500,"yield":62,"price":22,"exp":280,"seasons":1,"rarity":2,"art":{"type":"root","shape":"carrot","leaf":"#5aa84a","root":"#8a3aa8","hh":74,"is":1.15}},{"id":17,"name":"黄彩椒","lv":13,"seed":1500,"time":2100,"yield":68,"price":28,"exp":400,"seasons":2,"rarity":2,"art":{"type":"bush","kind":"chili","fruit":"#ffb81a","unripe":"#7fc04a","nf":5,"h":54,"hh":78,"is":1}},{"id":18,"name":"白玉茄","lv":15,"seed":2200,"time":3000,"yield":74,"price":38,"exp":600,"seasons":2,"rarity":3,"art":{"type":"bush","kind":"egg","fruit":"#f4eedf","unripe":"#a8c08a","nf":3,"h":56,"hh":80,"is":1}},{"id":19,"name":"冬瓜","lv":17,"seed":3200,"time":5400,"yield":86,"price":52,"exp":980,"seasons":1,"rarity":3,"art":{"type":"vine","kind":"melon","fruit":"#8ec8a4","hh":62,"is":1}},{"id":20,"name":"金南瓜","lv":19,"seed":4500,"time":7200,"yield":92,"price":68,"exp":1350,"seasons":1,"rarity":3,"art":{"type":"vine","kind":"pumpkin","fruit":"#ffd23a","hh":64,"is":1.05}},{"id":21,"name":"甜菜","lv":21,"seed":6000,"time":10800,"yield":100,"price":88,"exp":1900,"seasons":1,"rarity":3,"art":{"type":"root","shape":"radish","leaf":"#4a9a3a","root":"#b8214a","blush":"#7a1030","hh":72,"is":1.15}},{"id":22,"name":"黑美人西瓜","lv":24,"seed":8500,"time":14400,"yield":108,"price":115,"exp":2700,"seasons":2,"rarity":4,"art":{"type":"vine","kind":"melon","fruit":"#1f5a2a","hh":62,"is":1}},{"id":23,"name":"月光草莓","lv":27,"seed":12000,"time":21600,"yield":120,"price":150,"exp":3800,"seasons":2,"rarity":4,"art":{"type":"bush","kind":"berry","fruit":"#f0e4ff","unripe":"#d8e8c8","nf":5,"h":24,"low":true,"hh":54,"is":1.2}},{"id":24,"name":"火焰辣椒","lv":28,"seed":9000,"time":9000,"yield":104,"price":120,"exp":2600,"seasons":2,"rarity":3,"art":{"type":"bush","kind":"chili","fruit":"#ff4a10","unripe":"#7fc04a","nf":6,"h":54,"hh":78,"is":1}},{"id":25,"name":"翡翠白菜","lv":30,"seed":14000,"time":14400,"yield":112,"price":168,"exp":4300,"seasons":1,"rarity":3,"art":{"type":"cabbage","head":"#3fcf8e","hh":70,"is":1.1}},{"id":26,"name":"胭脂萝卜","lv":32,"seed":16000,"time":12600,"yield":116,"price":185,"exp":4600,"seasons":1,"rarity":3,"art":{"type":"root","shape":"radish","leaf":"#4fb040","root":"#e02a4a","blush":"#ff8aa0","hh":72,"is":1.15}},{"id":27,"name":"星空蓝莓","lv":34,"seed":22000,"time":21600,"yield":124,"price":240,"exp":6200,"seasons":2,"rarity":4,"art":{"type":"bush","kind":"berry","fruit":"#2c2f9a","unripe":"#b8c8e8","nf":6,"h":24,"low":true,"hh":54,"is":1.2}},{"id":28,"name":"金丝胡萝卜","lv":36,"seed":26000,"time":18000,"yield":128,"price":270,"exp":6800,"seasons":1,"rarity":3,"art":{"type":"root","shape":"carrot","leaf":"#5ab84a","root":"#ffc21a","hh":74,"is":1.15}},{"id":29,"name":"琥珀南瓜","lv":38,"seed":34000,"time":28800,"yield":132,"price":340,"exp":8800,"seasons":1,"rarity":4,"art":{"type":"vine","kind":"pumpkin","fruit":"#c8641a","hh":64,"is":1.05}},{"id":30,"name":"紫晶茄子","lv":41,"seed":42000,"time":25200,"yield":136,"price":400,"exp":10500,"seasons":2,"rarity":4,"art":{"type":"bush","kind":"egg","fruit":"#4a1a72","unripe":"#8fae6a","nf":3,"h":56,"hh":80,"is":1}},{"id":31,"name":"黄金西瓜","lv":44,"seed":60000,"time":36000,"yield":140,"price":560,"exp":14000,"seasons":2,"rarity":4,"art":{"type":"vine","kind":"melon","fruit":"#d8a81a","hh":62,"is":1}},{"id":32,"name":"小麦","lv":2,"seed":50,"time":100,"yield":22,"price":4,"exp":17,"seasons":1,"rarity":1,"art":{"type":"grain","kind":"wheat","ear":"#e8c25a","stalk":"#c8b05a","hh":96,"is":0.85}},{"id":33,"name":"生菜","lv":1,"seed":30,"time":60,"yield":14,"price":3,"exp":11,"seasons":1,"rarity":1,"art":{"type":"cabbage","head":"#9ee86a","hh":66,"is":1.15}},{"id":34,"name":"郁金香","lv":4,"seed":150,"time":280,"yield":28,"price":9,"exp":46,"seasons":1,"rarity":1,"art":{"type":"flower","kind":"tulip","petal":"#ff4a5e","hh":84,"is":1}},{"id":35,"name":"水稻","lv":6,"seed":320,"time":560,"yield":44,"price":11,"exp":94,"seasons":1,"rarity":1,"art":{"type":"grain","kind":"rice","ear":"#e6d27a","stalk":"#8fbf4a","hh":90,"is":0.9}},{"id":36,"name":"樱桃萝卜","lv":2,"seed":40,"time":75,"yield":18,"price":4,"exp":14,"seasons":1,"rarity":1,"art":{"type":"root","shape":"radish","leaf":"#62bc44","root":"#ff3a5a","blush":"#ffffff","hh":70,"is":1.15}},{"id":37,"name":"黄瓜","lv":5,"seed":210,"time":380,"yield":36,"price":9,"exp":64,"seasons":2,"rarity":1,"art":{"type":"bush","kind":"chili","fruit":"#3f9a32","unripe":"#9ad070","nf":4,"h":56,"hh":80,"is":1}},{"id":38,"name":"薰衣草","lv":8,"seed":600,"time":960,"yield":52,"price":17,"exp":170,"seasons":1,"rarity":2,"art":{"type":"flower","kind":"lavender","petal":"#9a6ae0","hh":86,"is":1}},{"id":39,"name":"青椒","lv":4,"seed":120,"time":220,"yield":30,"price":7,"exp":40,"seasons":2,"rarity":1,"art":{"type":"bush","kind":"chili","fruit":"#2f9a2a","unripe":"#8fd060","nf":5,"h":54,"hh":78,"is":1}},{"id":40,"name":"玫瑰","lv":12,"seed":1300,"time":1900,"yield":64,"price":26,"exp":350,"seasons":1,"rarity":2,"art":{"type":"flower","kind":"rose","petal":"#e0203a","hh":86,"is":1}},{"id":41,"name":"哈密瓜","lv":14,"seed":1900,"time":2500,"yield":72,"price":33,"exp":500,"seasons":2,"rarity":2,"art":{"type":"vine","kind":"melon","fruit":"#e6d68a","hh":62,"is":1}},{"id":42,"name":"金麦穗","lv":18,"seed":4000,"time":6300,"yield":90,"price":60,"exp":1150,"seasons":1,"rarity":3,"art":{"type":"grain","kind":"wheat","ear":"#ffcc2a","stalk":"#e0b040","hh":96,"is":0.85}},{"id":43,"name":"粉郁金香","lv":20,"seed":5200,"time":9000,"yield":96,"price":78,"exp":1600,"seasons":1,"rarity":3,"art":{"type":"flower","kind":"tulip","petal":"#ff8ac8","hh":84,"is":1}},{"id":44,"name":"红薯","lv":9,"seed":680,"time":1050,"yield":58,"price":17,"exp":185,"seasons":1,"rarity":1,"art":{"type":"root","shape":"carrot","leaf":"#5aa848","root":"#c8503a","hh":74,"is":1.15}},{"id":45,"name":"紫米","lv":23,"seed":7600,"time":12600,"yield":104,"price":104,"exp":2400,"seasons":1,"rarity":3,"art":{"type":"grain","kind":"rice","ear":"#6a2a7a","stalk":"#7aa84a","hh":90,"is":0.9}},{"id":46,"name":"蓝色妖姬","lv":33,"seed":19000,"time":19800,"yield":120,"price":215,"exp":5400,"seasons":1,"rarity":4,"art":{"type":"flower","kind":"rose","petal":"#2a5ae0","hh":86,"is":1}},{"id":47,"name":"彩虹郁金香","lv":40,"seed":38000,"time":27000,"yield":134,"price":370,"exp":9800,"seasons":1,"rarity":4,"art":{"type":"flower","kind":"tulip","petal":"rainbow","hh":84,"is":1}}],"gen":{"n":60,"lvMin":50,"lvMax":3800,"refLv":44,"expPow":1.15,"moneyPow":1.3,"seedBase":60000,"priceBase":560,"expBase":14000,"yieldBase":140,"yieldLog":12,"times":[21600,28800,36000,43200],"twoSeasonEvery":3,"rarityHighLv":200,"pre":["晨露","翡翠","琉璃","赤焰","冰晶","紫霞","星辰","月华","雷鸣","流云","玄金","凤羽","龙鳞","天青","霓虹","极光","琥珀","珊瑚","彩虹","圣光"],"base":[["西瓜",{"type":"vine","kind":"melon","hh":62,"is":1}],["南瓜",{"type":"vine","kind":"pumpkin","hh":64,"is":1.05}],["草莓",{"type":"bush","kind":"berry","unripe":"#d6e8a8","nf":6,"h":24,"low":true,"hh":54,"is":1.2}],["番茄",{"type":"bush","kind":"tomato","unripe":"#a8d060","nf":5,"h":58,"hh":80,"is":0.95}],["辣椒",{"type":"bush","kind":"chili","unripe":"#7fc04a","nf":6,"h":54,"hh":78,"is":1}],["茄子",{"type":"bush","kind":"egg","unripe":"#8fae6a","nf":3,"h":56,"hh":80,"is":1}],["萝卜",{"type":"root","shape":"radish","leaf":"#5fb83f","blush":"#ffffff","hh":72,"is":1.15}],["胡萝卜",{"type":"root","shape":"carrot","leaf":"#4fa83a","hh":74,"is":1.15}],["白菜",{"type":"cabbage","hh":70,"is":1.1}],["郁金香",{"type":"flower","kind":"tulip","hh":84,"is":1}],["玫瑰",{"type":"flower","kind":"rose","hh":86,"is":1}],["麦穗",{"type":"grain","kind":"wheat","stalk":"#e0b040","hh":96,"is":0.85}]],"cols":["#ff4a5e","#3fcf8e","#5ab0ff","#ff8a1a","#a8e8ff","#b06aff","#ffd23a","#f0e4ff","#4a5ad8","#ffffff","#e8b020","#ff6a3a","#2a9a6a","#58c8e8","#ff5ac8","#7affc8","#d89a3a","#ff7a8a","rainbow","#fff4b0"]}},"RARITY":["","普通","稀有","史诗","传说"],"SOILS":[{"id":0,"name":"普通土地","lv":0,"speed":1,"yield":1,"base":0,"step":0},{"id":1,"name":"红土地","lv":5,"speed":1.2,"yield":1.2,"base":1500,"step":600},{"id":2,"name":"黑土地","lv":15,"speed":1.35,"yield":1.4,"base":8000,"step":2000},{"id":3,"name":"金土地","lv":28,"speed":1.5,"yield":1.65,"base":30000,"step":6000}],"DOGS":[{"id":"fuwang","name":"福旺","col":"dog","price":300,"lv":2,"bite":5,"base":0.3,"perLv":0.03,"max":0.6,"desc":"蓝陌边牧，灰白相间带黑斑，机灵亲人，咬一口 5 金币"},{"id":"ruibao","name":"睿宝","col":"dog2","price":3000,"lv":10,"bite":15,"base":0.4,"perLv":0.03,"max":0.7,"desc":"黄白边牧，金棕色被毛配白色毛领，聪明敏捷，咬一口 15 金币"}],"COLLIES":[{"coat":"black","name":"经典黑白边牧","lv":30,"price":50000},{"coat":"red","name":"巧克力红白边牧","lv":80,"price":150000},{"coat":"redmerle","name":"红陨石边牧","lv":150,"price":400000},{"coat":"tri","name":"三色边牧","lv":300,"price":1000000},{"coat":"lilac","name":"丁香紫边牧","lv":600,"price":3000000},{"coat":"slate","name":"石板蓝边牧","lv":1000,"price":8000000},{"coat":"merle","name":"蓝陌边牧","lv":1500,"price":15000000},{"coat":"gold","name":"黄白边牧","lv":2000,"price":25000000}],"TASKS":[{"id":"plant","ic":"🌱","tx":"种植作物","need":12,"gold":150,"exp":30},{"id":"harvest","ic":"🧺","tx":"收获作物","need":15,"gold":250,"exp":50},{"id":"care","ic":"💧","tx":"浇水 / 除草 / 除虫","need":6,"gold":150,"exp":30},{"id":"steal","ic":"🥷","tx":"摘取别人的果实","need":6,"gold":220,"exp":40},{"id":"help","ic":"🤝","tx":"帮别人打理农田","need":4,"gold":180,"exp":35},{"id":"sell","ic":"💰","tx":"卖出作物赚取金币","need":800,"gold":300,"exp":60}],"WEEKLY":[{"id":"w_harvest","stat":"harvest","ic":"🧺","tx":"本周收获作物","need":120,"gold":1500,"exp":300},{"id":"w_steal","stat":"steal","ic":"🥷","tx":"本周摘取别人的果实","need":40,"gold":1200,"exp":240},{"id":"w_help","stat":"help","ic":"🤝","tx":"本周帮别人打理","need":30,"gold":1200,"exp":240},{"id":"w_order","stat":"order","ic":"📦","tx":"本周完成订单","need":10,"gold":2000,"exp":400},{"id":"w_trade","stat":"trade","ic":"🏷️","tx":"本周在集市成交","need":5,"gold":1000,"exp":200}],"NEWBIE":[{"id":"n_plant","stat":"plant","tx":"在空地上种下第一颗种子","need":1,"gold":50},{"id":"n_harvest","stat":"harvest","tx":"收获一次作物","need":1,"gold":80},{"id":"n_sell","stat":"sell","tx":"在仓库卖出作物","need":1,"gold":80},{"id":"n_friend","stat":"friend","tx":"加一位好友（附近的人、村民或邀请朋友都可以）","need":1,"gold":200},{"id":"n_visit","stat":"visit","tx":"去别人的农场串门","need":1,"gold":100},{"id":"n_social","stat":"social","tx":"在别人的农场摘一次果实或帮一次忙","need":1,"gold":200}],"ACHIEVEMENTS":[{"id":"a_h1","stat":"harvest_total","need":50,"tx":"初获丰收","desc":"累计收获 50 次","gold":300,"title":"小农夫"},{"id":"a_h2","stat":"harvest_total","need":500,"tx":"丰收能手","desc":"累计收获 500 次","gold":2000,"title":"丰收能手"},{"id":"a_h3","stat":"harvest_total","need":3000,"tx":"农场大亨","desc":"累计收获 3000 次","gold":10000,"title":"农场大亨"},{"id":"a_s1","stat":"steal_total","need":20,"tx":"妙手空空","desc":"累计摘取好友果实 20 次","gold":300,"title":"妙手空空"},{"id":"a_s2","stat":"steal_total","need":300,"tx":"神偷","desc":"累计摘取 300 次","gold":3000,"title":"月下神偷"},{"id":"a_s3","stat":"steal_total","need":2000,"tx":"江湖传说","desc":"累计摘取 2000 次","gold":12000,"title":"江湖传说"},{"id":"a_p1","stat":"help_total","need":20,"tx":"热心邻居","desc":"累计帮好友 20 次","gold":300,"title":"热心邻居"},{"id":"a_p2","stat":"help_total","need":300,"tx":"劳模","desc":"累计帮好友 300 次","gold":3000,"title":"劳动模范"},{"id":"a_p3","stat":"help_total","need":2000,"tx":"好人缘","desc":"累计帮好友 2000 次","gold":12000,"title":"十里八乡好人缘"},{"id":"a_f1","stat":"friends","need":3,"tx":"呼朋唤友","desc":"拥有 3 位好友","gold":500,"title":"人气农夫"},{"id":"a_f2","stat":"friends","need":10,"tx":"社交达人","desc":"拥有 10 位好友","gold":2000,"title":"社交达人"},{"id":"a_g1","stat":"golden_total","need":1,"tx":"金光闪闪","desc":"收获第一个变异金色作物","gold":500,"title":"幸运儿"},{"id":"a_g2","stat":"golden_total","need":20,"tx":"点石成金","desc":"收获 20 次金色作物","gold":5000,"title":"点石成金"},{"id":"a_c1","stat":"codex","need":10,"tx":"收藏家","desc":"图鉴收集 10 种","gold":1000,"title":"收藏家"},{"id":"a_c2","stat":"codex","need":24,"tx":"博物学家","desc":"图鉴收集 24 种","gold":6000,"title":"博物学家"},{"id":"a_c3","stat":"codex","need":108,"tx":"万物有灵","desc":"图鉴收集全部 108 种普通作物","gold":20000,"title":"万物有灵"},{"id":"a_l1","stat":"lv","need":10,"tx":"小有所成","desc":"达到 Lv.10","gold":1000},{"id":"a_l2","stat":"lv","need":20,"tx":"远近闻名","desc":"达到 Lv.20","gold":5000,"title":"远近闻名"},{"id":"a_l3","stat":"lv","need":30,"tx":"一方乡绅","desc":"达到 Lv.30","gold":15000,"title":"一方乡绅"},{"id":"a_l4","stat":"lv","need":40,"tx":"农业宗师","desc":"达到 Lv.40","gold":40000,"title":"农业宗师"},{"id":"a_l5","stat":"lv","need":100,"tx":"百级农场主","desc":"达到 Lv.100","gold":100000,"title":"百级农场主"},{"id":"a_l6","stat":"lv","need":500,"tx":"田园领主","desc":"达到 Lv.500","gold":600000,"title":"田园领主"},{"id":"a_l7","stat":"lv","need":1000,"tx":"千级传说","desc":"达到 Lv.1000","gold":2000000,"title":"千级传说"},{"id":"a_l8","stat":"lv","need":2000,"tx":"大地之子","desc":"达到 Lv.2000","gold":6000000,"title":"大地之子"},{"id":"a_l9","stat":"lv","need":4000,"tx":"丰收之神","desc":"达到满级 Lv.4000","gold":20000000,"title":"丰收之神"},{"id":"a_o1","stat":"order_total","need":30,"tx":"诚信商户","desc":"完成 30 个订单","gold":2000,"title":"诚信商户"},{"id":"a_k1","stat":"checkin_streak","need":7,"tx":"风雨无阻","desc":"连续签到 7 天","gold":800,"title":"勤劳农夫"}],"THEMES":[{"id":"classic","name":"经典红顶","price":0,"th":{"roof":"#c8483a","wall":"#f6e7c8","tree":"#4aa83a","bush":"#4ea43a"}},{"id":"sakura","name":"樱花小屋","price":3000,"th":{"roof":"#d9658a","wall":"#fff0e0","tree":"#5ab84e","bush":"#52b04a"}},{"id":"ocean","name":"海风蓝顶","price":3000,"th":{"roof":"#3e7ac8","wall":"#f0ead0","tree":"#3f9a3a","bush":"#3f9a3a"}},{"id":"cabin","name":"林间木屋","price":6000,"th":{"roof":"#7a5a3a","wall":"#f2dfc0","tree":"#6aa83a","bush":"#6aa83a"}},{"id":"lavender","name":"薰衣草庄园","price":12000,"th":{"roof":"#9a6ad9","wall":"#fff4f8","tree":"#58b890","bush":"#4aa87a"}},{"id":"autumn","name":"金秋农舍","price":20000,"th":{"roof":"#d9822a","wall":"#fff2d6","tree":"#d9a03a","bush":"#c89a3a"}}],"FRAMES":[{"id":"none","name":"无","price":0,"color":""},{"id":"wood","name":"原木框","price":1000,"color":"#a8743a"},{"id":"leaf","name":"青叶框","price":2500,"color":"#5cb83c"},{"id":"gold","name":"黄金框","price":8000,"color":"#ffc61a"},{"id":"star","name":"星光框","price":0,"color":"#b08aff","ach":"a_c1"},{"id":"thief","name":"神偷框","price":0,"color":"#3a3a5a","ach":"a_s2"}],"AVATAR_OPTS":{"skin":["#ffd9b0","#ffe4cc","#f2c89a","#e8b88a","#c8946a"],"hair":["#2a1a10","#6a3a1a","#e8a0c0","#d9b84a","#4a5ad8"],"shirt":["#4a8fd8","#ff7aa5","#6aa84a","#8a5a3a","#b08aff","#ff9a1f"],"band":["#d9553a","#3a7ad9","#3a9a5a"],"bg":[["#a8e4ff","#d8f5b8"],["#ffd9ec","#fff0e0"],["#c8ecff","#e8f6c8"],["#ffe8b8","#ffd09a"],["#e8d8ff","#ffe0f0"]]},"PHRASES":["来串门啦","菜不错，拿走两个～","帮你浇过水了","虫子已经帮你除掉了","一起加油种田","谢谢你的帮忙","别再偷我的菜了！","小心我家的狗","晚安，明天见","你的农场真漂亮"],"SHOP_ITEMS":[{"id":"fert","name":"化肥","ic":"🧪","price":60,"desc":"让作物成长进度 +30%"},{"id":"dogfood","name":"狗粮","ic":"🍖","price":120,"desc":"小狗吃饱后看家 2 小时，并获得成长经验"},{"id":"ffeed","name":"鱼饲料","ic":"🐟","price":80,"desc":"一份让一条鱼的生长时间缩短 30%，鱼塘里可以一键喂"},{"id":"sfeed","name":"精饲料","ic":"🌾","price":150,"desc":"一份让一只羊的羊毛多长半茬，牧场里可以一键喂"},{"id":"tfert","name":"果树营养液","ic":"💧","price":200,"desc":"一份让一棵果树长大快 30%（已结果的树多结半茬），果园里可以一键施"}],"FISH":[{"id":0,"name":"小鲫鱼","lv":1,"price":20,"time":600,"yield":2,"sell":18,"exp":6,"col":"#b8c0b0","size":0.8},{"id":1,"name":"金鱼","lv":3,"price":60,"time":1800,"yield":2,"sell":52,"exp":14,"col":"#ff8a2a","size":0.75},{"id":2,"name":"草鱼","lv":6,"price":150,"time":3600,"yield":3,"sell":78,"exp":30,"col":"#7a9a6a","size":1.05},{"id":3,"name":"鲤鱼","lv":10,"price":400,"time":7200,"yield":3,"sell":195,"exp":60,"col":"#c8a060","size":1.1},{"id":4,"name":"锦鲤","lv":15,"price":1200,"time":14400,"yield":3,"sell":610,"exp":130,"col":"#ff5a3a","size":1.15,"spots":"#ffffff"},{"id":5,"name":"金龙鱼","lv":22,"price":4000,"time":28800,"yield":3,"sell":1950,"exp":300,"col":"#ffcc2a","size":1.25},{"id":6,"name":"鳜鱼","lv":35,"price":9000,"time":28800,"yield":3,"sell":4200,"exp":520,"col":"#9a8a4a","size":1.2,"spots":"#3a3020"},{"id":7,"name":"石斑鱼","lv":60,"price":22000,"time":36000,"yield":3,"sell":10000,"exp":900,"col":"#b85a3a","size":1.3,"spots":"#f0d0b0"},{"id":8,"name":"金枪鱼","lv":100,"price":60000,"time":36000,"yield":3,"sell":27000,"exp":1600,"col":"#3a5a8a","size":1.45},{"id":9,"name":"蓝鳍金枪","lv":200,"price":160000,"time":43200,"yield":3,"sell":72000,"exp":3000,"col":"#2a4ab8","size":1.55},{"id":10,"name":"紫晶锦鲤","lv":400,"price":450000,"time":43200,"yield":3,"sell":200000,"exp":5600,"col":"#a86aff","size":1.3,"spots":"#ffffff"},{"id":11,"name":"红龙鱼","lv":800,"price":1300000,"time":57600,"yield":3,"sell":580000,"exp":10500,"col":"#e8282a","size":1.6},{"id":12,"name":"鲲","lv":1600,"price":4000000,"time":72000,"yield":3,"sell":1800000,"exp":20000,"col":"#5ab8e8","size":1.8},{"id":13,"name":"金鳞神鲤","lv":3000,"price":12000000,"time":86400,"yield":3,"sell":5500000,"exp":38000,"col":"#ffd23a","size":1.7,"spots":"#fff4b0"}],"SHEEP":[{"id":0,"name":"小绵羊","lv":4,"price":500,"period":7200,"wool":2,"woolName":"白羊毛","sell":48,"exp":20,"body":"#fbf8f0","face":"#3a3230"},{"id":1,"name":"黑面羊","lv":12,"price":2000,"period":10800,"wool":3,"woolName":"黑羊毛","sell":85,"exp":45,"body":"#f2ede2","face":"#151214"},{"id":2,"name":"羊驼","lv":20,"price":6000,"period":14400,"wool":3,"woolName":"羊驼毛","sell":230,"exp":90,"body":"#e8d2a8","face":"#e8d2a8","alpaca":true},{"id":3,"name":"美利奴羊","lv":40,"price":18000,"period":14400,"wool":4,"woolName":"美利奴羊毛","sell":520,"exp":180,"body":"#fffaf0","face":"#f0d8c8"},{"id":4,"name":"白羊驼","lv":70,"price":45000,"period":18000,"wool":4,"woolName":"白羊驼毛","sell":1200,"exp":320,"body":"#fbf8f2","face":"#fbf8f2","alpaca":true},{"id":5,"name":"卷毛羊","lv":120,"price":110000,"period":18000,"wool":4,"woolName":"卷羊毛","sell":2800,"exp":560,"body":"#f4eee0","face":"#2a2224"},{"id":6,"name":"咖啡羊驼","lv":200,"price":280000,"period":21600,"wool":5,"woolName":"咖啡驼毛","sell":5600,"exp":950,"body":"#9a6a42","face":"#7a5032","alpaca":true},{"id":7,"name":"彩虹羊","lv":350,"price":700000,"period":21600,"wool":5,"woolName":"彩虹羊毛","sell":13000,"exp":1600,"body":"#ffd0ec","face":"#3a3230"},{"id":8,"name":"黑羊驼","lv":600,"price":1800000,"period":25200,"wool":5,"woolName":"黑驼毛","sell":30000,"exp":2800,"body":"#3a3236","face":"#2a2226","alpaca":true},{"id":9,"name":"云朵羊","lv":1000,"price":5000000,"period":28800,"wool":6,"woolName":"云朵绒","sell":72000,"exp":5000,"body":"#eaf4ff","face":"#8aa0c8"},{"id":10,"name":"金羊毛羊","lv":1800,"price":14000000,"period":32400,"wool":6,"woolName":"金羊毛","sell":180000,"exp":9000,"body":"#ffd86a","face":"#6a4a1a"},{"id":11,"name":"星光羊驼","lv":3000,"price":40000000,"period":36000,"wool":6,"woolName":"星光驼绒","sell":480000,"exp":16000,"body":"#c8b8ff","face":"#c8b8ff","alpaca":true}],"TREES":[{"id":0,"name":"苹果树","fruit":"苹果","lv":3,"price":800,"grow":3600,"period":5400,"yield":6,"sell":28,"exp":30,"col":"#e8352a"},{"id":1,"name":"桃树","fruit":"水蜜桃","lv":8,"price":2000,"grow":7200,"period":7200,"yield":6,"sell":55,"exp":55,"col":"#ff9aa8","blossom":"#ffc8d8"},{"id":2,"name":"橙子树","fruit":"橙子","lv":15,"price":5000,"grow":10800,"period":9000,"yield":7,"sell":95,"exp":90,"col":"#ff9a1a"},{"id":3,"name":"梨树","fruit":"雪梨","lv":25,"price":12000,"grow":14400,"period":10800,"yield":7,"sell":170,"exp":150,"col":"#d8e070"},{"id":4,"name":"樱桃树","fruit":"樱桃","lv":40,"price":30000,"grow":21600,"period":14400,"yield":8,"sell":330,"exp":260,"col":"#c8102a","blossom":"#ffe0ec"},{"id":5,"name":"柿子树","fruit":"柿子","lv":60,"price":70000,"grow":28800,"period":18000,"yield":8,"sell":640,"exp":420,"col":"#ff7a10"},{"id":6,"name":"荔枝树","fruit":"荔枝","lv":90,"price":160000,"grow":36000,"period":21600,"yield":9,"sell":1250,"exp":700,"col":"#d8303a"},{"id":7,"name":"芒果树","fruit":"芒果","lv":130,"price":380000,"grow":43200,"period":25200,"yield":9,"sell":2600,"exp":1150,"col":"#ffc21a"},{"id":8,"name":"石榴树","fruit":"石榴","lv":200,"price":900000,"grow":57600,"period":28800,"yield":10,"sell":5200,"exp":1900,"col":"#b8102a"},{"id":9,"name":"金苹果树","fruit":"金苹果","lv":400,"price":3000000,"grow":86400,"period":36000,"yield":10,"sell":15000,"exp":4200,"col":"#ffd23a"},{"id":10,"name":"蓝莓树","fruit":"巨型蓝莓","lv":550,"price":5500000,"grow":86400,"period":36000,"yield":12,"sell":22000,"exp":5600,"col":"#4a5ad8"},{"id":11,"name":"榴莲树","fruit":"榴莲","lv":750,"price":10000000,"grow":100800,"period":43200,"yield":10,"sell":48000,"exp":8000,"col":"#c8b84a"},{"id":12,"name":"山竹树","fruit":"山竹","lv":1000,"price":18000000,"grow":108000,"period":43200,"yield":12,"sell":70000,"exp":11000,"col":"#6a1a4a"},{"id":13,"name":"樱花果树","fruit":"樱花果","lv":1400,"price":32000000,"grow":115200,"period":46800,"yield":12,"sell":120000,"exp":15000,"col":"#ff9ac8","blossom":"#ffd8ec"},{"id":14,"name":"星果树","fruit":"星星果","lv":1900,"price":55000000,"grow":122400,"period":50400,"yield":12,"sell":200000,"exp":20000,"col":"#ffe86a"},{"id":15,"name":"月光梨树","fruit":"月光梨","lv":2500,"price":90000000,"grow":129600,"period":54000,"yield":12,"sell":320000,"exp":26000,"col":"#e8f0ff","blossom":"#ffffff"},{"id":16,"name":"仙桃树","fruit":"蟠桃","lv":3200,"price":150000000,"grow":144000,"period":57600,"yield":12,"sell":520000,"exp":34000,"col":"#ff8a9a","blossom":"#ffc8d8"},{"id":17,"name":"世界树","fruit":"生命果","lv":3900,"price":260000000,"grow":172800,"period":64800,"yield":12,"sell":900000,"exp":46000,"col":"#7affc8"}],"RANCH":{"maxLv":100,"needLvPer":10,"woolMax":3,"fruitMax":3,"herdMin":120,"herdBoost":0.5,"dogMaxLv":100},"MISC":{"PETS_MAX":8,"STAGE_NAME":["种子期","发芽期","成长期","即将成熟","已成熟"]},"ZONES":[{"id":"home","name":"家园","status":"live","unlockLv":1,"desc":"你的农场：菜地、牧场、鱼塘、果园。四周的远山和森林只能看；想去别的地方，走到东南边的传送阵","budget":{"tris":300000,"calls":150,"texMB":150},"assets":[]},{"id":"trial","name":"试炼野外","status":"dev","unlockLv":1,"desc":"开发用：验证区域切换和「种子 + 生物群系」程序生成","budget":{"tris":300000,"calls":150,"texMB":150},"assets":[],"gen":{"size":160,"seg":120,"seed":20261025,"height":26}},{"id":"mountain","name":"名山猎场","status":"live","unlockLv":15,"desc":"深山里有梅花鹿、野猪、灰狼和黑熊。用弹弓、猎弓、麻醉枪把它们打晕，送去保护站换赏金和材料","budget":{"tris":300000,"calls":150,"texMB":150},"assets":["v3_hero_boy"]},{"id":"lake","name":"镜湖钓场","status":"live","unlockLv":8,"desc":"山脚下的一面湖：站在栈道上钓鱼，湖心亭、拱桥、小船。钓上来的鱼进仓库","budget":{"tris":300000,"calls":150,"texMB":150},"assets":["h2_heroine_01"]},{"id":"town","name":"清河镇","status":"planned","unlockLv":10,"desc":"热闹的小镇：集市摆摊、商店、好友见面","season":"下一批"},{"id":"river","name":"河谷","status":"planned","unlockLv":150,"desc":"大河两岸，可以钓鱼、行船","season":"之后"},{"id":"desert","name":"大漠","status":"planned","unlockLv":400,"desc":"黄沙里埋着金字塔","season":"之后"},{"id":"snowridge","name":"雪岭","status":"planned","unlockLv":800,"desc":"长城蜿蜒在雪山之上","season":"之后"},{"id":"dragonspine","name":"龙脊山脉","status":"planned","unlockLv":2000,"desc":"传说五爪金龙栖息的地方","season":"之后"}],"HOME":{"grid":{"cell":2,"x0":-70,"x1":60,"z0":-92,"z1":40},"structures":[{"id":"house","name":"房子","x":-13,"z":-2.5,"ry":0.15,"w":7,"d":7,"obstacle":3.3},{"id":"windmill","name":"风车","x":3.5,"z":-15,"ry":-0.2,"w":4,"d":4,"obstacle":1.9},{"id":"doghouse","name":"狗窝","x":11.2,"z":-3.8,"ry":-0.6,"w":2,"d":2,"obstacle":0.9},{"id":"scarecrow","name":"稻草人","x":-10.5,"z":6.5,"ry":0,"w":1,"d":1,"obstacle":0.35},{"id":"yard","name":"院子篱笆","x":0,"z":0,"ry":0,"w":16.8,"d":12.4,"obstacle":0}],"fields":{"cols":4,"dx":17,"z0":-32,"dz":13,"w":15.2,"d":11.2},"ponds":{"list":[[-5.5,13.5],[-12.5,14.6],[-19.5,13.8],[-8.6,19.6],[-15.6,20.6],[-22.4,19.4]],"perLv":5,"w":8.4,"d":6.8},"pasture":{"x0":10.2,"z0":7,"base":[6.4,5.2],"grow":[34,24],"pow":0.6},"orchard":{"x0":-69,"x1":-31,"z0":-21,"z1":17,"r":19}},"BIOMES":[{"id":"lake","name":"湖泊","maxH":0.3,"col":"#4a8ac0","trees":0,"rocks":0,"walk":false},{"id":"shore","name":"湖滩","maxH":0.34,"col":"#d8c890","trees":0,"rocks":0.4,"walk":true},{"id":"meadow","name":"草甸","maxH":0.52,"col":"#7cb850","trees":0.6,"rocks":0.2,"tree":"broadleaf","walk":true,"moist":0.35,"dry":"shrub"},{"id":"shrub","name":"灌木丛","maxH":0.52,"col":"#9aa850","trees":0.3,"rocks":0.6,"tree":"bush","walk":true},{"id":"forest","name":"森林","maxH":0.68,"col":"#4e8a3a","trees":4.5,"rocks":0.3,"tree":"pine","walk":true},{"id":"rock","name":"山岩","maxH":0.84,"col":"#8a8478","trees":0.3,"rocks":2.5,"tree":"pine","walk":true},{"id":"snow","name":"雪顶","maxH":1.01,"col":"#eef2f6","trees":0,"rocks":0.8,"walk":true}],"BUILDINGS":[{"id":"stonepath","name":"石板路","kind":"decor","w":1,"d":1,"price":80,"lv":1,"max":0,"solid":0,"status":"live","desc":"铺一条小路"},{"id":"fence","name":"木栅栏","kind":"decor","w":1,"d":1,"price":200,"lv":1,"max":0,"solid":"seg","status":"live","desc":"2 米一段，可以围出自己的院子"},{"id":"haystack","name":"草垛","kind":"decor","w":1,"d":1,"price":300,"lv":2,"max":0,"solid":0.8,"status":"live","desc":"秋收的味道"},{"id":"flowerbed","name":"花坛","kind":"decor","w":1,"d":1,"price":500,"lv":3,"max":0,"solid":0,"status":"live","desc":"一年四季开花"},{"id":"bench","name":"长椅","kind":"decor","w":1,"d":1,"price":600,"lv":4,"max":0,"solid":0.5,"status":"live","desc":"坐下来歇歇脚"},{"id":"lamp","name":"路灯","kind":"decor","w":1,"d":1,"price":800,"lv":5,"max":0,"solid":0.25,"status":"live","desc":"天黑自动亮"},{"id":"pinetree","name":"小松树","kind":"decor","w":1,"d":1,"price":1000,"lv":6,"max":0,"solid":0.45,"status":"live","desc":"四季常青"},{"id":"well","name":"水井","kind":"decor","w":2,"d":2,"price":3000,"lv":10,"max":4,"solid":1.2,"status":"live","desc":"石砌老井"},{"id":"pavilion","name":"凉亭","kind":"decor","w":3,"d":3,"price":12000,"lv":20,"max":2,"solid":0,"status":"live","desc":"红柱青瓦，可以走进去"},{"id":"watchtower","name":"瞭望塔","kind":"defense","w":2,"d":2,"price":20000,"lv":40,"max":8,"solid":1.2,"status":"planned","desc":"第 3 期兽潮防御时开放"},{"id":"greatwall","name":"长城（世界奇观）","kind":"wonder","w":10,"d":2,"price":0,"lv":20,"max":1,"solid":"wall","status":"live","desc":"选址免费，之后分 5 个阶段建造，全农场作物永久增产"}],"SEASONS":{"list":[{"id":"spring","name":"春","full":"春天","months":[3,4,5],"crops":["root","cabbage","flower"],"bonus":0.1,"look":{"ground":"#b2d878","groundK":0.28,"grass":"#8ccc5a","leaf":"#86cc5e","leaf2":"#f4b4c8","hills":"#79ad54","flowers":true,"fx":"petal"}},{"id":"summer","name":"夏","full":"夏天","months":[6,7,8],"crops":["bush","melon","sunflower","corn"],"bonus":0.1,"look":{"ground":"#9cb46e","groundK":0,"grass":"#7cb84a","leaf":"","leaf2":"","hills":"#6a9a4a","flowers":true,"fx":"firefly"}},{"id":"autumn","name":"秋","full":"秋天","months":[9,10,11],"crops":["pumpkin","grain","corn","pine","flower"],"bonus":0.1,"look":{"ground":"#c8b062","groundK":0.42,"grass":"#a8ad4c","leaf":"#e08a2c","leaf2":"#c8452a","hills":"#a39248","flowers":true,"fx":"leaf"}},{"id":"winter","name":"冬","full":"冬天","months":[12,1,2],"crops":["cabbage","root"],"bonus":0.1,"look":{"ground":"#eef3f6","groundK":0.78,"grass":"#c9d6c4","leaf":"#7d9682","leaf2":"#5c7f62","hills":"#e2eaef","flowers":false,"fx":"snow"}}],"festivals":[{"id":"dongzhi2026","name":"冬至","start":"2026-12-22","end":"2026-12-22","kind":"exp_mult","mult":1.5,"descr":"冬至大如年：全天经验 1.5 倍"},{"id":"yuandan2027","name":"元旦","start":"2027-01-01","end":"2027-01-03","kind":"golden_mult","mult":2,"descr":"新年新气象：变异作物几率翻倍"},{"id":"chunjie2027","name":"春节","start":"2027-02-05","end":"2027-02-12","kind":"yield_mult","mult":1.2,"descr":"过大年：所有作物产量 +20%"},{"id":"yuanxiao2027","name":"元宵节","start":"2027-02-20","end":"2027-02-20","kind":"exp_mult","mult":1.5,"descr":"闹元宵：全天经验 1.5 倍"},{"id":"qingming2027","name":"清明","start":"2027-04-05","end":"2027-04-05","kind":"yield_mult","mult":1.1,"descr":"清明前后，种瓜点豆：产量 +10%"},{"id":"laodong2027","name":"劳动节","start":"2027-05-01","end":"2027-05-05","kind":"exp_mult","mult":1.3,"descr":"劳动最光荣：经验 1.3 倍"},{"id":"duanwu2027","name":"端午节","start":"2027-06-09","end":"2027-06-09","kind":"golden_mult","mult":2,"descr":"端午安康：变异作物几率翻倍"},{"id":"qixi2027","name":"七夕","start":"2027-08-08","end":"2027-08-08","kind":"price_mult","mult":1.2,"descr":"七夕：收购价 +20%"},{"id":"zhongqiu2027","name":"中秋节","start":"2027-09-15","end":"2027-09-15","kind":"yield_mult","mult":1.2,"descr":"花好月圆：产量 +20%"},{"id":"guoqing2027","name":"国庆节","start":"2027-10-01","end":"2027-10-07","kind":"price_mult","mult":1.15,"descr":"国庆长假：收购价 +15%"},{"id":"dongzhi2027","name":"冬至","start":"2027-12-22","end":"2027-12-22","kind":"exp_mult","mult":1.5,"descr":"冬至大如年：全天经验 1.5 倍"},{"id":"yuandan2028","name":"元旦","start":"2028-01-01","end":"2028-01-03","kind":"golden_mult","mult":2,"descr":"新年新气象：变异作物几率翻倍"},{"id":"chunjie2028","name":"春节","start":"2028-01-25","end":"2028-02-01","kind":"yield_mult","mult":1.2,"descr":"过大年：所有作物产量 +20%"},{"id":"yuanxiao2028","name":"元宵节","start":"2028-02-09","end":"2028-02-09","kind":"exp_mult","mult":1.5,"descr":"闹元宵：全天经验 1.5 倍"},{"id":"qingming2028","name":"清明","start":"2028-04-04","end":"2028-04-04","kind":"yield_mult","mult":1.1,"descr":"清明前后，种瓜点豆：产量 +10%"},{"id":"laodong2028","name":"劳动节","start":"2028-05-01","end":"2028-05-05","kind":"exp_mult","mult":1.3,"descr":"劳动最光荣：经验 1.3 倍"},{"id":"duanwu2028","name":"端午节","start":"2028-05-28","end":"2028-05-28","kind":"golden_mult","mult":2,"descr":"端午安康：变异作物几率翻倍"},{"id":"qixi2028","name":"七夕","start":"2028-08-26","end":"2028-08-26","kind":"price_mult","mult":1.2,"descr":"七夕：收购价 +20%"},{"id":"guoqing2028","name":"国庆节","start":"2028-10-01","end":"2028-10-07","kind":"price_mult","mult":1.15,"descr":"国庆长假：收购价 +15%"},{"id":"zhongqiu2028","name":"中秋节","start":"2028-10-03","end":"2028-10-03","kind":"yield_mult","mult":1.2,"descr":"花好月圆：产量 +20%"}]},"WONDERS":[{"id":"greatwall","name":"长城","desc":"万里长城，一砖一瓦都是自家地里种出来的。建成后全农场作物永久增产；第 3 期兽潮来袭时，长城也会参与防御。","stages":[{"name":"夯土地基","lv":20,"gold":50000,"items":{"c0":300,"c1":200},"bonus":0.02},{"name":"第一段城墙","lv":25,"gold":150000,"items":{"c5":300,"c8":150},"bonus":0.02},{"name":"烽火台","lv":30,"gold":400000,"items":{"c9":300,"c10":150},"bonus":0.03},{"name":"第二段城墙与敌楼","lv":40,"gold":1000000,"items":{"c19":200,"c11":300},"bonus":0.03},{"name":"长城竣工","lv":50,"gold":2500000,"items":{"c20":200,"c22":150},"bonus":0.05}]}],"HUNT":{"zone":"mountain","trips":5,"tripSec":300,"heroHp":6,"captureDist":3.2,"dogGoldBonus":0.2,"gen":{"size":200,"seg":120,"height":30},"creatures":[{"id":"deer","name":"梅花鹿","lv":15,"hp":2,"speed":6,"flee":14,"aggro":0,"dmg":0,"biomes":["meadow","shrub","forest"],"count":7,"size":1,"reward":{"gold":300,"exp":60,"items":{"hm0":1}},"desc":"胆子小，一听到动静就跑"},{"id":"boar","name":"野猪","lv":18,"hp":3,"speed":5,"flee":0,"aggro":0,"charge":true,"dmg":1,"biomes":["shrub","forest"],"count":5,"size":0.9,"reward":{"gold":600,"exp":120,"items":{"hm1":1}},"desc":"平时不惹事，打中它会冲过来"},{"id":"wolf","name":"灰狼","lv":24,"hp":4,"speed":6.8,"flee":0,"aggro":12,"dmg":1,"biomes":["forest","rock"],"count":4,"size":0.95,"reward":{"gold":1000,"exp":200,"items":{"hm2":1}},"desc":"看到人会扑过来"},{"id":"bear","name":"黑熊","lv":32,"hp":10,"speed":4.6,"flee":0,"aggro":9,"dmg":2,"biomes":["forest","rock"],"count":1,"size":1.6,"reward":{"gold":3500,"exp":700,"items":{"hm3":2}},"desc":"守着野蜂蜜，力气很大"}],"weapons":[{"id":"slingshot","name":"弹弓","lv":15,"price":0,"dmg":1,"range":14,"cd":0.7,"desc":"猎户送的入门弹弓"},{"id":"bow","name":"猎弓","lv":22,"price":20000,"dmg":2,"range":22,"cd":0.9,"desc":"射得更远，一箭顶两颗石子"},{"id":"tranq","name":"麻醉枪","lv":30,"price":120000,"dmg":4,"range":32,"cd":1.4,"desc":"黑熊也能很快睡着"}],"materials":[{"id":0,"name":"鹿角","price":120,"desc":"梅花鹿每年自然脱落的角"},{"id":1,"name":"野猪鬃","price":240,"desc":"又硬又亮的鬃毛，可以做刷子"},{"id":2,"name":"狼毛","price":400,"desc":"换季时掉下来的狼毛，很暖和"},{"id":3,"name":"野蜂蜜","price":700,"desc":"黑熊守着的蜂蜜"}]},"LAKE":{"zone":"lake","trips":6,"tripSec":300,"minBiteSec":5,"bites":60,"bigBonus":0.85,"fish":[{"fish":0,"w":34,"lv":1,"diff":0.15,"cm":[12,24],"exp":4},{"fish":1,"w":20,"lv":1,"diff":0.2,"cm":[8,18],"exp":8},{"fish":2,"w":18,"lv":6,"diff":0.35,"cm":[35,80],"exp":16},{"fish":3,"w":14,"lv":10,"diff":0.45,"cm":[30,70],"exp":30},{"fish":4,"w":7,"lv":15,"diff":0.55,"cm":[35,75],"exp":60},{"fish":5,"w":3.5,"lv":22,"diff":0.65,"cm":[40,90],"exp":140},{"fish":6,"w":2,"lv":35,"diff":0.72,"cm":[30,60],"exp":240},{"fish":7,"w":1,"lv":60,"diff":0.82,"cm":[50,110],"exp":420},{"fish":10,"w":0.3,"lv":100,"diff":0.9,"cm":[40,80],"exp":1500}],"rods":[{"id":"bamboo","name":"竹竿","lv":1,"price":0,"power":1,"luck":0,"slack":0,"desc":"渔翁送的老竹竿"},{"id":"carbon","name":"碳素竿","lv":15,"price":30000,"power":1.35,"luck":0.25,"slack":0.06,"desc":"又轻又韧，收线快"},{"id":"golden","name":"金丝竿","lv":35,"price":300000,"power":1.7,"luck":0.6,"slack":0.12,"desc":"大鱼也拉得动，稀有鱼更爱咬钩"}]},"ASSETS":[{"id":"v1_hero_boy","kind":"hero","name":"男主角（灰盒）","stage":"test","base":"art/v1_test/hero_boy/","file":"hero_boy","tiers":["1k"],"anims":["idle","walk"],"accessories":["hat","bag","scarf"],"heightM":1.71},{"id":"v1_hero_girl","kind":"hero","name":"女主角（灰盒）","stage":"test","base":"art/v1_test/hero_girl/","file":"hero_girl","tiers":["1k"],"anims":["idle","walk"],"accessories":["hat","bag","scarf"],"heightM":1.71},{"id":"v1_dog_collie","kind":"dog","name":"边牧（灰盒，10 种毛色）","stage":"test","base":"art/v1_test/dog_collie/","file":"dog_collie","tiers":["1k"],"anims":["idle","walk"],"accessories":["harness","collar","bandana","tag"],"heightM":0.85,"coats":"art/v1_test/dog_collie/textures/dog_coat_{coat}_basecolor.jpg"},{"id":"v2_hero_boy","kind":"hero","name":"男主角","stage":"approved","base":"art/v2_static_review/hero_boy/","file":"hero_boy","tiers":["1k","2k"],"anims":[],"accessories":[],"heightM":1.6,"note":"2026-10-25 甲方确认外观；等美术 v3 绑定 + idle"},{"id":"v2_hero_girl","kind":"hero","name":"女主角","stage":"candidate","base":"art/v2_static_review/hero_girl/","file":"hero_girl","tiers":["1k","2k"],"anims":[],"accessories":[],"heightM":1.6},{"id":"v2_dog_fuwang","kind":"dog","name":"福旺","stage":"approved","base":"art/v2_static_review/dog_fuwang/","file":"dog_fuwang","tiers":["1k","2k"],"anims":[],"accessories":[],"heightM":0.8,"note":"2026-10-25 甲方确认外观；v3 要标定肩高 0.5 m、身体摆正、胸背带拆开"},{"id":"v3_hero_boy","kind":"hero","name":"男主角（绑定 + 待机）","stage":"candidate","base":"art/v3_rig_idle/hero_boy/","file":"hero_boy","tiers":["1k","2k"],"anims":["idle"],"accessories":["bag","scarf"],"heightM":1.6,"note":"2026-10-25 美术 v3：40 骨、idle 3 秒；walk 等动作后续交付，程序先用骨骼摆动补走路"},{"id":"v3_dog_fuwang","kind":"dog","name":"福旺（绑定 + 待机）","stage":"candidate","base":"art/v3_rig_idle/dog_fuwang/","file":"dog_fuwang","tiers":["1k","2k"],"anims":["idle"],"accessories":["harness"],"heightM":0.78,"note":"2026-10-25 美术 v3：29 骨、肩高 0.5 m、idle 2 秒；坐 / 趴 / 睡 / 走路后续交付"},{"id":"v2_dog_ruibao","kind":"dog","name":"睿宝","stage":"candidate","base":"art/v2_static_review/dog_ruibao/","file":"dog_ruibao","tiers":["1k","2k"],"anims":[],"accessories":[],"heightM":0.8},{"id":"v4_hero_boy","kind":"hero","name":"男主角","stage":"candidate","base":"art/v6_motion/hero_boy/","file":"hero_boy","tiers":["1k","2k"],"anims":["idle","walk","jump_air","run"],"accessories":["bag","scarf"],"heightM":1.6,"loco":{"walk":{"stride":0.7,"dur":1.1},"run":{"stride":3.535,"dur":0.667}},"thumb":"art/v6_motion/hero_boy/thumb.png","note":"2026-10-26 美术 v6：自然跑步（扭腰、摆臂、腾空），实测步幅","natural":true},{"id":"hero_male_01","kind":"hero","name":"栗发青裤","desc":"栗发青裤·运动农场青年","stage":"candidate","base":"art/v6_motion/hero_male_01/","file":"hero_male_01","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.524,"dur":0.667}},"thumb":"art/v6_motion/hero_male_01/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_02","kind":"hero","name":"黑色寸发","desc":"黑色寸发·海军蓝亨利衫","stage":"candidate","base":"art/v6_motion/hero_male_02/","file":"hero_male_02","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.52,"dur":0.667}},"thumb":"art/v6_motion/hero_male_02/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_03","kind":"hero","name":"金发","desc":"金发·酒红工装背心","stage":"candidate","base":"art/v6_motion/hero_male_03/","file":"hero_male_03","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.516,"dur":0.667}},"thumb":"art/v6_motion/hero_male_03/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_04","kind":"hero","name":"棕色短发","desc":"棕色短发·夏日运动短裤","stage":"candidate","base":"art/v6_motion/hero_male_04/","file":"hero_male_04","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.524,"dur":0.667}},"thumb":"art/v6_motion/hero_male_04/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_05","kind":"hero","name":"铜棕后梳","desc":"铜棕后梳·橄榄绿衬衣","stage":"candidate","base":"art/v6_motion/hero_male_05/","file":"hero_male_05","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.516,"dur":0.667}},"thumb":"art/v6_motion/hero_male_05/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_06","kind":"hero","name":"银灰短发","desc":"银灰短发·青色健身背心","stage":"candidate","base":"art/v6_motion/hero_male_06/","file":"hero_male_06","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.516,"dur":0.667}},"thumb":"art/v6_motion/hero_male_06/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_07","kind":"hero","name":"深棕卷短发","desc":"深棕卷短发·白色V领T恤","stage":"candidate","base":"art/v6_motion/hero_male_07/","file":"hero_male_07","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.521,"dur":0.667}},"thumb":"art/v6_motion/hero_male_07/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_08","kind":"hero","name":"沙金寸头","desc":"沙金寸头·棕色皮质短背心","stage":"candidate","base":"art/v6_motion/hero_male_08/","file":"hero_male_08","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.515,"dur":0.667}},"thumb":"art/v6_motion/hero_male_08/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_09","kind":"hero","name":"黑发侧分","desc":"黑发侧分·奶油衬衫青背心","stage":"candidate","base":"art/v6_motion/hero_male_09/","file":"hero_male_09","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.52,"dur":0.667}},"thumb":"art/v6_motion/hero_male_09/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"hero_male_10","kind":"hero","name":"红棕短发","desc":"红棕短发·黑色无袖上衣","stage":"candidate","base":"art/v6_motion/hero_male_10/","file":"hero_male_10","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":[],"heightM":1.75,"loco":{"walk":{"stride":0.75,"dur":1.1},"run":{"stride":3.522,"dur":0.667}},"thumb":"art/v6_motion/hero_male_10/thumb.png","natural":true,"note":"2026-10-26 美术 hero_male_motion_v1：十位男性，自然跑步"},{"id":"v4_dog_fuwang","kind":"dog","name":"福旺","stage":"candidate","base":"art/v5_motion/dog_fuwang/","file":"dog_fuwang","tiers":["1k","2k"],"anims":["idle","walk","sit_idle","lie_idle","sleep","trot","gallop","sprint"],"accessories":["harness"],"heightM":0.776,"loco":{"walk":{"stride":0.5,"dur":1.2},"trot":{"stride":0.65,"dur":0.8},"gallop":{"stride":1.593,"dur":0.933},"sprint":{"stride":1.781,"dur":0.8}},"note":"2026-10-26 美术 v5：奔跑 / 冲刺，实测步幅"},{"id":"v4_dog_ruibao","kind":"dog","name":"睿宝","stage":"candidate","base":"art/v5_motion/dog_ruibao/","file":"dog_ruibao","tiers":["1k","2k"],"anims":["idle","walk","sit_idle","lie_idle","sleep","trot","gallop","sprint"],"accessories":["collar","tag"],"heightM":0.731,"loco":{"walk":{"stride":0.5,"dur":1.2},"trot":{"stride":0.65,"dur":0.8},"gallop":{"stride":1.593,"dur":0.933},"sprint":{"stride":1.78,"dur":0.8}},"note":"2026-10-26 美术 v5：奔跑 / 冲刺，实测步幅"},{"id":"h2_heroine_01","kind":"hero","name":"女主角 1 号","stage":"candidate","base":"art/v6_motion/heroine_01/","file":"heroine_01","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.525,"dur":0.667}},"thumb":"art/v6_motion/heroine_01/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_02","kind":"hero","name":"女主角 2 号","stage":"candidate","base":"art/v6_motion/heroine_02/","file":"heroine_02","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.522,"dur":0.667}},"thumb":"art/v6_motion/heroine_02/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_03","kind":"hero","name":"女主角 3 号","stage":"candidate","base":"art/v6_motion/heroine_03/","file":"heroine_03","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.515,"dur":0.667}},"thumb":"art/v6_motion/heroine_03/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_04","kind":"hero","name":"女主角 4 号","stage":"candidate","base":"art/v6_motion/heroine_04/","file":"heroine_04","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.512,"dur":0.667}},"thumb":"art/v6_motion/heroine_04/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_05","kind":"hero","name":"女主角 5 号","stage":"candidate","base":"art/v6_motion/heroine_05/","file":"heroine_05","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.525,"dur":0.667}},"thumb":"art/v6_motion/heroine_05/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_06","kind":"hero","name":"女主角 6 号","stage":"candidate","base":"art/v6_motion/heroine_06/","file":"heroine_06","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.528,"dur":0.667}},"thumb":"art/v6_motion/heroine_06/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_07","kind":"hero","name":"女主角 7 号","stage":"candidate","base":"art/v6_motion/heroine_07/","file":"heroine_07","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.511,"dur":0.667}},"thumb":"art/v6_motion/heroine_07/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_08","kind":"hero","name":"女主角 8 号","stage":"candidate","base":"art/v6_motion/heroine_08/","file":"heroine_08","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.532,"dur":0.667}},"thumb":"art/v6_motion/heroine_08/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_09","kind":"hero","name":"女主角 9 号","stage":"candidate","base":"art/v6_motion/heroine_09/","file":"heroine_09","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.533,"dur":0.667}},"thumb":"art/v6_motion/heroine_09/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_10","kind":"hero","name":"女主角 10 号","stage":"candidate","base":"art/v6_motion/heroine_10/","file":"heroine_10","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.531,"dur":0.667}},"thumb":"art/v6_motion/heroine_10/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_11","kind":"hero","name":"女主角 11 号","stage":"candidate","base":"art/v6_motion/heroine_11/","file":"heroine_11","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.527,"dur":0.667}},"thumb":"art/v6_motion/heroine_11/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_12","kind":"hero","name":"女主角 12 号","stage":"candidate","base":"art/v6_motion/heroine_12/","file":"heroine_12","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.527,"dur":0.667}},"thumb":"art/v6_motion/heroine_12/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_13","kind":"hero","name":"女主角 13 号","stage":"candidate","base":"art/v6_motion/heroine_13/","file":"heroine_13","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.525,"dur":0.667}},"thumb":"art/v6_motion/heroine_13/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"h2_heroine_14","kind":"hero","name":"女主角 14 号","stage":"candidate","base":"art/v6_motion/heroine_14/","file":"heroine_14","tiers":["1k"],"anims":["idle","walk","run","jump_air"],"accessories":["bag","hair"],"heightM":1.65,"loco":{"walk":{"stride":0.65,"dur":1.1},"run":{"stride":3.515,"dur":0.667}},"thumb":"art/v6_motion/heroine_14/thumb.png","note":"2026-10-26 美术 v6：自然跑步，实测步幅","natural":true},{"id":"v4w_deer","kind":"beast","name":"梅花鹿","stage":"candidate","base":"art/v4_wildlife/deer/","file":"deer","tiers":["1k"],"anims":["idle","walk","run"],"accessories":[],"heightM":0.9,"loco":{"walk":{"stride":0.85,"dur":1.333},"run":{"stride":1.6,"dur":0.933}},"note":"2026-10-26 美术 v4_wildlife 第一批：idle / walk / run（sleep 等还没交）"},{"id":"v4w_boar","kind":"beast","name":"野猪","stage":"candidate","base":"art/v4_wildlife/boar/","file":"boar","tiers":["1k"],"anims":["idle","walk","run"],"accessories":[],"heightM":0.6,"loco":{"walk":{"stride":0.5,"dur":1.333},"run":{"stride":1.001,"dur":0.933}},"note":"2026-10-26 美术 v4_wildlife 第一批：idle / walk / run（sleep 等还没交）"},{"id":"v4w_wolf","kind":"beast","name":"灰狼","stage":"candidate","base":"art/v4_wildlife/wolf/","file":"wolf","tiers":["1k"],"anims":["idle","walk","run"],"accessories":[],"heightM":0.7,"loco":{"walk":{"stride":0.75,"dur":1.333},"run":{"stride":1.5,"dur":0.933}},"note":"2026-10-26 美术 v4_wildlife 第一批：idle / walk / run（sleep 等还没交）"},{"id":"v4w_bear","kind":"beast","name":"黑熊","stage":"candidate","base":"art/v4_wildlife/bear/","file":"bear","tiers":["1k"],"anims":["idle","walk","run"],"accessories":[],"heightM":1,"loco":{"walk":{"stride":0.9,"dur":1.333},"run":{"stride":1.6,"dur":0.933}},"note":"2026-10-26 美术 v4_wildlife 第一批：idle / walk / run（sleep 等还没交）"},{"id":"v7_house_s2","kind":"building","name":"农舍（二级）","stage":"candidate","base":"art/v7_buildings/house_s2/","file":"house_s2","tiers":["1k"],"anims":[],"accessories":[],"note":"2026-10-26 美术 v7_buildings 样板：roof / wall 染色、window_glow 夜灯、base 本色、烘焙 AO；烟囱口 [1.35, 4.55, -2.03]"},{"id":"v7_windmill","kind":"building","name":"风车","stage":"candidate","base":"art/v7_buildings/windmill/","file":"windmill","tiers":["1k"],"anims":["idle"],"accessories":[],"note":"2026-10-26 美术 v7_buildings 样板：rotor 节点 idle 6 秒一圈，叶片最低离地 2.85 米"},{"id":"v7_doghouse","kind":"building","name":"狗窝","stage":"candidate","base":"art/v7_buildings/doghouse/","file":"doghouse","tiers":["1k"],"anims":[],"accessories":[],"note":"2026-10-26 美术 v7_buildings 样板：门洞 0.55 × 0.6 米，内部留空，碗在侧边"},{"id":"v9_kit","kind":"kit","name":"v9 建筑套件","stage":"candidate","base":"art/v9_kit/kit/","file":"kit","tiers":["1k","2k"],"anims":[],"accessories":[],"note":"2026-10-26 美术 v9_kit 第一阶段 15 种零件样张（共享图集 kit_main / kit_glow，顶点色 AO）；程序按 assemblies/*.json 实例化拼装，?kit=1 打开预览"}]};
  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT; else root.GAMECONTENT = CONTENT;
})(typeof window !== 'undefined' ? window : globalThis);

});

__def("shared/config.js", function (module, exports, __req) {
/* =====================================================
   丰收农场 · 前后端共用配置与规则
   服务端是权威；客户端只用它来显示与插值。
   ===================================================== */
(function (root) {
  'use strict';
  /* v3.4 内容数据化：作物、生物、商品、任务等内容来自 content/*.jsonc（构建生成 shared/content.js），这里只放规则公式 */
  const CONTENT = typeof module !== 'undefined' && module.exports ? __req("shared/content.js") : root.GAMECONTENT;
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
  const VERSION = '3.22.0'; // 每次发布改这里；设置页和 /api/health 会显示
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
  /* ---------- 方案 C · 镜湖钓场（content/lake.jsonc）。同一个种子 + 等级 + 鱼竿，前后端算出一样的「咬钩序列」：第 i 次咬钩是哪条鱼、多长、浮漂落水后等几秒 ---------- */
  const LAKE = CONTENT.LAKE;
  function lakeBites(seed, lv, rodId) {
    const r = rng(seed + 7), rod = LAKE.rods.find(x => x.id === rodId) || LAKE.rods[0], pool = LAKE.fish.filter(f => lv >= f.lv), n = LAKE.fish.length;
    const W = pool.map(f => f.w * (1 + rod.luck * 4 * LAKE.fish.indexOf(f) / Math.max(1, n - 1))), tot = W.reduce((a, b) => a + b, 0), list = [];
    for (let i = 0; i < LAKE.bites; i++) { let x = r() * tot, k = 0; while (k < pool.length - 1 && x > W[k]) { x -= W[k]; k++; } const f = pool[k], cm = Math.round(f.cm[0] + (f.cm[1] - f.cm[0]) * Math.pow(r(), 1.6));
      list.push({ i, f: f.fish, cm, diff: +(f.diff * (0.85 + 0.3 * (cm - f.cm[0]) / Math.max(1, f.cm[1] - f.cm[0]))).toFixed(3), wait: +(2 + r() * 4).toFixed(2), big: cm >= f.cm[0] + (f.cm[1] - f.cm[0]) * LAKE.bigBonus }); }
    return list;
  }
  const CFG = { HOME, BUILDINGS, BIOMES, OCC, SEASONS, WONDERS, HUNT, LAKE, lakeBites, makeNoise, biomeAt, genWorld, worldBiome, huntSpawns, wonderDef, wonderBonus, monthOf, seasonOf, cropTag, inSeason, seasonEnd, festivalsAt, fieldCenter, pastSize, pondsOf, gridSpec, homeOccupancy, footprint, canPlace };
  Object.assign(CFG, { ZONES, ASSETS, COLLIES, PETS_MAX, VERSION, COLS, ROWS, NPLOTS, FIELDS_MAX, MAX_PLOTS, fieldNeedLv, fieldCost, CROPS, RARITY, RULES, TASKS, WEEKLY, NEWBIE, ACHIEVEMENTS, THEMES, FRAMES, AVATAR_OPTS, PHRASES, SHOP_ITEMS, UNLOCK_ORDER, STAGE_NAME,
    SOILS, DOGS, soilOf, soilCost, dogChance,
    FISH, SHEEP, TREES, RANCH, pondCap, pastureCap, pondCapOf, pastureCapOf, orchardCapOf, ranchUpCost, ranchNeedLv, herdOf, sheepCycles, treeCycles, treeGrowLeft, fishLeft, ranchItem,
    expNeed, dogExpNeed, plotCost, plotNeedLv, redCost, stageOf, hash32, rng, setTz, dayKey, dayStart, weekKey, weekEnd, rainUntil, dayBonus, plotDur, plotSpeed, probCount, remainSec, advancePlot, stealCapPct, orderSlots });
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.GAMECFG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);

});

__def("server/util.js", function (module, exports, __req) {
'use strict';
const crypto = __req("crypto");

class ApiError extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }
const bad = (msg, code) => new ApiError(400, code || 'bad_request', msg);
const forbid = (msg) => new ApiError(403, 'forbidden', msg || '没有权限');
const notFound = (msg) => new ApiError(404, 'not_found', msg || '不存在');
const conflict = (msg, code) => new ApiError(409, code || 'conflict', msg);

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function randToken(n) { return crypto.randomBytes(n || 32).toString('base64url'); }
function hashPassword(pw) {
  const salt = crypto.randomBytes(16); const h = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('base64') + '$' + h.toString('base64');
}
function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, s, h] = stored.split('$'); const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}
function randInt(a, b) { return a + crypto.randomInt(b - a + 1); }
function rand() { return crypto.randomInt(1 << 30) / (1 << 30); }

// 令牌桶限流（内存）
class Limiter {
  constructor() { this.m = new Map(); setInterval(() => { const now = Date.now(); for (const [k, v] of this.m) if (now - v.t > 600000) this.m.delete(k); }, 60000).unref(); }
  take(key, rate, burst, cost) {
    const now = Date.now(); let b = this.m.get(key); if (!b) { b = { tok: burst, t: now }; this.m.set(key, b); }
    b.tok = Math.min(burst, b.tok + (now - b.t) / 1000 * rate); b.t = now;
    if (b.tok < (cost || 1)) return false; b.tok -= (cost || 1); return true;
  }
}

// 昵称校验：长度、字符、简单敏感词
const BANNED = ['admin', '管理员', '官方', 'gm', '客服', '傻逼', '操你', '妈的', 'fuck', 'shit', '习近平', '共产党', '法轮'];
function cleanName(s) {
  s = String(s || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) throw bad('名字不能为空'); if ([...s].length > 10) throw bad('名字最多 10 个字');
  const low = s.toLowerCase(); if (BANNED.some(w => low.includes(w))) throw bad('名字包含不允许的词');
  return s;
}
// 账号同时作为游戏昵称：2–10 个字，可以用中文、字母、数字、下划线和中间点，不能有空格
function cleanUsername(s) {
  s = String(s || '').normalize('NFKC').trim();
  if (!s) throw bad('请填写账号');
  if (/\s/.test(s)) throw bad('账号里不能有空格');
  const n = [...s].length; if (n < 2 || n > 10) throw bad('账号需为 2–10 个字');
  if (!/^[\p{L}\p{N}_·\-]+$/u.test(s)) throw bad('账号只能用中文、字母、数字、下划线');
  return cleanName(s);
}
function checkPw2(pw, pw2) { if (pw2 !== undefined && pw2 !== null && String(pw2) !== String(pw)) throw bad('两次输入的密码不一致'); }
function checkPw(pw) { pw = String(pw || ''); if (pw.length < 6 || pw.length > 64) throw bad('密码长度需为 6–64 位'); return pw; }
const int = (v, name, lo, hi) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw bad((name || '参数') + '不合法'); return n; };
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) { let v = p.slice(i + 1).trim(); try { v = decodeURIComponent(v); } catch (e) { } o[p.slice(0, i).trim()] = v; } }); return o; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { ApiError, bad, forbid, notFound, conflict, sha256, randToken, hashPassword, checkPassword, randInt, rand, Limiter, parseCookies, cleanName, cleanUsername, checkPw, checkPw2, int, esc };

});

__def("server/db.js", function (module, exports, __req) {
'use strict';
/* =====================================================
   数据库层：同一套异步接口，两种后端
   - local：Node 内置 node:sqlite（自己的服务器 / 本机）
   - turso：Turso 云数据库，经 HTTP（Hrana v2）访问，用于 EdgeOne 等无服务器平台
   接口（全部异步）：
     get(sql,...a) / all(sql,...a) / run(sql,...a) → {changes,lastInsertRowid}
     w(sql,...a)        事务内的“延迟写”：不等结果，随下一次读取或提交一起发出（省网络往返）
     wx(err,sql,...a)   同上，但该语句失败（约束不满足）时抛出 err
     tx(async fn)       事务；可重入；遇到写冲突自动重试
     sp(async fn)       事务内保存点；fn 抛错只回滚这一段
     exec(多条sql) / close()
   ===================================================== */
const { AsyncLocalStorage } = __req("async_hooks");

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
  // v2 无服务器部署：后台任务（NPC、清理）用的租约表
  `CREATE TABLE IF NOT EXISTS leases (name TEXT PRIMARY KEY, until INTEGER NOT NULL, at INTEGER NOT NULL DEFAULT 0);`,
  // v3 第二只看家狗「睿宝」（第一只「福旺」沿用 dog_* 字段）；土地等级 soil 扩展为 0–3（字段不变）
  `ALTER TABLE users ADD COLUMN dog2_own INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN dog2_lv INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE users ADD COLUMN dog2_exp INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN dog2_until INTEGER NOT NULL DEFAULT 0;`,
  // v4 鱼塘与牧场：鱼、羊、牧羊状态存成一段 JSON（数量少，跟着玩家一起读写）
  `ALTER TABLE users ADD COLUMN ranch TEXT NOT NULL DEFAULT '{}';`,
  // v5 家园自由建造（V0.3）：玩家摆放的建筑布局存成一段 JSON：{ v, seq, items: [{ id, type, gx, gz, rot, at }] }
  `ALTER TABLE users ADD COLUMN layout TEXT NOT NULL DEFAULT '{}';`,
  // v6 名山猎场（第 2 期）：武器、每天进山次数、当前这次进山（种子）、累计捕获，存成一段 JSON
  `ALTER TABLE users ADD COLUMN hunt TEXT NOT NULL DEFAULT '{}';`,
  // v7 镜湖钓场（方案 C）：鱼竿、每天来几次、当前这次（种子）、累计钓到、每种鱼最长纪录，存成一段 JSON
  `ALTER TABLE users ADD COLUMN lake TEXT NOT NULL DEFAULT '{}';`,
];

const BUSY = /SQLITE_BUSY|database is locked|SQLITE_LOCKED|BUSY_SNAPSHOT/i;
// 远端数据库的临时性故障（网络抖动、连接被回收、事务超时等）：整个事务重来一次是安全的（POST 有幂等键兜底）
const TRANSIENT = /无法连接数据库|数据库请求失败（HTTP (5\d\d|400|404|408|429)|stream|baton|timed?[- ]?out|TRANSACTION_TIMEOUT|ECONNRESET|socket hang up|fetch failed|提交失败/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const splitSql = s => s.split(/;\s*(?:\n|$)/).map(x => x.trim()).filter(Boolean);

/* ---------------- 通用外壳：迁移、事务上下文 ---------------- */
function wrap(B) {
  const als = new AsyncLocalStorage();
  const db = { kind: B.kind };
  const cur = () => als.getStore() || null;
  db.inTx = () => !!cur();
  db.get = async (sql, ...a) => (await B.query(cur(), sql, a, 'get'));
  db.all = async (sql, ...a) => (await B.query(cur(), sql, a, 'all'));
  db.run = async (sql, ...a) => (await B.query(cur(), sql, a, 'run'));
  db.exec = async sql => B.exec(cur(), sql);
  db.w = (sql, ...a) => db.wx(null, sql, ...a); // 返回排队中的语句（远端时可在发出前修改参数）；本地返回 null
  db.wx = (err, sql, ...a) => {
    const t = cur();
    if (!t) { const p = B.query(null, sql, a, 'run'); p.catch(e => { if (err && /constraint/i.test(e.message)) return; console.error('[db] 后台写入失败', e.message); }); return; }
    return B.defer(t, sql, a, err);
  };
  // 事务外的“顺手写”（在线时间、统计）：不等结果、不参与当前事务，避免让请求因此冲突重试
  db.bg = (sql, ...a) => { (async () => { for (let i = 0; ; i++) { try { return await B.query(null, sql, a, 'run'); } catch (e) { if (BUSY.test(e.message) && i < 6) { await sleep(30 * (i + 1) + Math.random() * 50); continue; } throw e; } } })().catch(e => console.error('[db] 后台写入失败', e.message)); };
  // 事务内的数据缓存（由游戏逻辑维护：读过的玩家/土地/库存/计数器）；保存点回滚时一起恢复
  db.cache = () => { const t = cur(); if (!t) return null; return t.gc || (t.gc = { u: {}, plots: {}, inv: {}, cnt: {}, memo: {} }); };
  db.aside = () => { const t = cur(); if (!t) return null; return t.aside || (t.aside = {}); }; // 不随保存点回滚的附加状态
  // 最后一次读取与提交合并：fn 里发出的第一批查询会带上 COMMIT（省一次往返）。fn 只能读不能写
  db.final = async fn => { const t = cur(); if (!t || !B.finalize) return fn(); B.finalize(t); return fn(); };
  db.flush = async () => { const t = cur(); if (t) await B.flush(t); };
  db.stats = { tx: 0, retries: 0 };
  // 本实例内的写事务排队（先来先到）：冲突后的重试在这里有序执行，不再互相“抢锁”
  let wchain = Promise.resolve();
  const wlock = () => { let rel; const p = new Promise(r => rel = r); const prev = wchain; wchain = wchain.then(() => p); return prev.then(() => rel); };
  db.tx = async (fn, opts) => {
    if (cur()) return fn();
    opts = opts || {};
    for (let attempt = 0; ; attempt++) {
      // 第一次：乐观执行（不加锁，并发最好）；一旦冲突：排队 + 排他锁执行，保证一定能完成
      const exclusive = !!opts.write || attempt >= 1;
      const unlock = exclusive && B.kind !== 'local' ? await wlock() : null;
      let t = null;
      try {
        t = await B.begin({ write: exclusive }); db.stats.tx++;
        const r = await als.run(t, fn); await B.commit(t); return r;
      } catch (e) {
        if (t) await B.rollback(t).catch(() => { });
        if (BUSY.test(String(e && e.message)) && attempt < 6) { db.stats.retries++; if (!unlock) await sleep(5 + Math.random() * 20); continue; }
        if (TRANSIENT.test(String(e && e.message)) && !BUSY.test(String(e && e.message)) && attempt < 5 && !(t && t.committed)) { db.stats.retries++; db.stats.transient = (db.stats.transient || 0) + 1; console.error('[db] 临时故障，重试', attempt + 1, String(e && e.message).slice(0, 160)); await sleep(100 + Math.random() * 200); continue; }
        throw e;
      } finally { if (t && B.release) B.release(t); if (unlock) unlock(); }
    }
  };
  db.sp = async fn => {
    const t = cur(); if (!t) return db.tx(fn, { write: true });
    const name = 'sp' + (++t.spn); const mark = B.defer(t, 'SAVEPOINT ' + name, [], null);
    const snap = t.gc ? structuredClone(t.gc) : null;
    try { const r = await fn(); B.defer(t, 'RELEASE ' + name, [], null); return r; }
    catch (e) { await B.undo(t, mark, name); t.gc = snap || undefined; throw e; }
  };
  db.close = () => B.close && B.close();
  db.migrate = async () => {
    const retry = async fn => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= 5 || !(TRANSIENT.test(String(e.message)) || BUSY.test(String(e.message)))) throw e; await sleep(200 * (i + 1) + Math.random() * 300); } } };
    await retry(() => B.exec(null, 'CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)'));
    const ver = async () => (await db.get('SELECT v FROM schema_version') || {}).v;
    const v0 = await retry(ver); if (v0 === MIGRATIONS.length) return db; // 已是最新：冷启动不加锁
    if (B.migrateBatch) { // 远端：整套迁移打包成一次请求，在一个事务里执行；失败整体回滚后重试（多个实例同时冷启动也安全）
      for (let i = 0; ; i++) {
        const v = await retry(ver); if (v === MIGRATIONS.length) return db;
        try { await B.migrateBatch(v, MIGRATIONS); }
        catch (e) { if (i >= 5) throw new Error('数据库初始化失败：' + e.message); await sleep(200 * (i + 1) + Math.random() * 300); }
      }
    }
    await db.tx(async () => {
      let v = (await db.get('SELECT v FROM schema_version') || {}).v;
      if (v === undefined) { await db.run('INSERT INTO schema_version (v) VALUES (0)'); v = 0; }
      for (let i = v; i < MIGRATIONS.length; i++) {
        try { await db.exec(MIGRATIONS[i]); } catch (e) { throw new Error('迁移 v' + (i + 1) + ' 失败：' + e.message); }
        await db.run('UPDATE schema_version SET v = ?', i + 1);
      }
    }, { write: true });
    return db;
  };
  return db;
}

/* ---------------- 后端 1：本地 node:sqlite ---------------- */
function localBackend(file) {
  const fs = __req("fs"), path = __req("path");
  const { DatabaseSync } = __req("node:sqlite");
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sq = new DatabaseSync(file);
  sq.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const cache = new Map();
  const st = sql => { let s = cache.get(sql); if (!s) { s = sq.prepare(sql); cache.set(sql, s); } return s; };
  // 单连接：同一时间只允许一个事务（或一条事务外语句）在跑，其他排队
  let chain = Promise.resolve();
  const lock = () => { let rel; const p = new Promise(r => rel = r); const prev = chain; chain = chain.then(() => p); return prev.then(() => rel); };
  const exe = (sql, a, mode) => { const s = st(sql); if (mode === 'get') return s.get(...a); if (mode === 'all') return s.all(...a); const r = s.run(...a); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; };
  return {
    kind: 'local', raw: sq,
    async query(t, sql, a, mode) { if (t) return exe(sql, a, mode); const rel = await lock(); try { return exe(sql, a, mode); } finally { rel(); } },
    async exec(t, sql) { if (t) return sq.exec(sql); const rel = await lock(); try { sq.exec(sql); } finally { rel(); } },
    defer(t, sql, a, err) { // 本地无网络开销：立即执行
      try { exe(sql, a, 'run'); } catch (e) { if (err && /constraint/i.test(e.message)) throw err; throw e; }
      return null;
    },
    async flush() { },
    async undo(t, mark, name) { sq.exec('ROLLBACK TO ' + name); sq.exec('RELEASE ' + name); },
    async begin(o) { const rel = await lock(); try { sq.exec(o.write === false ? 'BEGIN' : 'BEGIN IMMEDIATE'); } catch (e) { rel(); throw e; } return { rel, spn: 0, risky: false }; },
    async commit() { sq.exec('COMMIT'); },
    async rollback() { try { sq.exec('ROLLBACK'); } catch (e) { } },
    release(t) { t.rel(); },
    close() { sq.close(); },
  };
}

/* ---------------- 后端 2：Turso（Hrana v2 over HTTP） ---------------- */
function tursoBackend(url, token, opts) {
  opts = opts || {};
  let base = String(url).trim().replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) base = 'https://' + base;
  const fetchImpl = opts.fetch || fetch;
  const enc = v => {
    if (v === null || v === undefined) return { type: 'null' };
    if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
    if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
    if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
    if (Buffer.isBuffer(v)) return { type: 'blob', base64: v.toString('base64') };
    return { type: 'text', value: String(v) };
  };
  const dec = c => { if (!c || c.type === 'null') return null; if (c.type === 'integer') return Number(c.value); if (c.type === 'float') return Number(c.value); if (c.type === 'blob') return Buffer.from(c.base64, 'base64'); return c.value; };
  const stmt = (sql, a) => ({ sql, args: (a || []).map(enc), want_rows: true });
  const shape = (res, mode) => {
    if (mode === 'run') return { changes: Number(res.affected_row_count || 0), lastInsertRowid: Number(res.last_insert_rowid || 0) };
    const names = res.cols.map(c => c.name); const rows = res.rows.map(r => { const o = {}; r.forEach((c, i) => o[names[i]] = dec(c)); return o; });
    return mode === 'get' ? rows[0] : rows;
  };
  const hErr = e => { const m = (e && (e.message || e.code)) || '数据库错误'; const x = new Error(m); x.code = e && e.code; return x; };
  const stats = { requests: 0 };
  async function pipeline(t, requests) {
    stats.requests++;
    const target = (t && t.base) || base;
    let r, j;
    for (let i = 0; ; i++) {
      try {
        r = await fetchImpl(target + '/v2/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ baton: t ? t.baton : null, requests }) });
        if (r.status >= 500 && i < 2 && !(t && t.baton)) { await sleep(150 * (i + 1)); continue; }
        break;
      } catch (e) { if (i < 2 && !(t && t.baton)) { await sleep(150 * (i + 1)); continue; } throw new Error('无法连接数据库：' + e.message); }
    }
    const text = await r.text(); try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok || !j) throw new Error('数据库请求失败（HTTP ' + r.status + '）：' + String(text).slice(0, 200));
    if (t) { t.baton = j.baton || null; if (j.base_url) t.base = String(j.base_url).replace(/\/+$/, ''); }
    return j.results;
  }
  // 事务外：同一时刻发起的多条查询合并成一次请求
  let pend = null;
  function queueAuto(sql, a, mode) {
    return new Promise((resolve, reject) => {
      if (!pend) { pend = []; queueMicrotask(flushAuto); }
      pend.push({ sql, a, mode, resolve, reject });
    });
  }
  async function flushAuto() {
    const list = pend; pend = null;
    try {
      const res = await pipeline(null, list.map(q => ({ type: 'execute', stmt: stmt(q.sql, q.a) })).concat([{ type: 'close' }]));
      list.forEach((q, i) => { const x = res[i]; if (!x || x.type !== 'ok') q.reject(hErr(x && x.error)); else q.resolve(shape(x.response.result, q.mode)); });
    } catch (e) { list.forEach(q => q.reject(e)); }
  }
  // 事务内：延迟写 + 读取合并，按顺序以一个带条件的 batch 发出（前一步失败，后面全部跳过）
  function send(t, close) {
    if (t.inflight) return t.inflight.then(() => send(t, close));
    const q = t.queue; t.queue = []; if (!q.length) return Promise.resolve();
    const steps = []; if (!t.began) { steps.push({ stmt: stmt('PRAGMA foreign_keys = ON') }); steps.push({ stmt: stmt(t.write ? 'BEGIN IMMEDIATE' : 'BEGIN') }); }
    const off = steps.length; q.forEach(x => steps.push({ stmt: stmt(x.sql, x.a) }));
    const fin = t.closing && !t.committed; if (fin) { steps.push({ stmt: stmt('COMMIT') }); close = true; }
    steps.forEach((s, i) => { if (i > 0) s.condition = { type: 'ok', step: i - 1 }; });
    const wasBegan = t.began; t.began = true; t.sent = q[q.length - 1].seq; t.risky = false; q.forEach(x => x.sent = true);
    const p = (async () => {
      let res;
      try {
        for (let i = 0; ; i++) {
          res = (await pipeline(t, close ? [{ type: 'batch', batch: { steps } }, { type: 'close' }] : [{ type: 'batch', batch: { steps } }]))[0];
          // 排他事务第一次拿写锁失败（别的实例正在写）：后面的步骤都没执行，稍等后原样重发（最多约 10 秒）
          if (!wasBegan && t.write && res && res.type === 'ok') { const be = res.response.result.step_errors[1]; if (be && BUSY.test(be.message || '') && i < 60) { await sleep(Math.min(250, 20 + i * 15) * (0.6 + Math.random() * 0.8)); continue; } }
          break;
        }
      }
      catch (e) { q.forEach(x => x.reject && x.reject(e)); throw e; }
      if (!res || res.type !== 'ok') { const e = hErr(res && res.error); q.forEach(x => x.reject && x.reject(e)); throw e; }
      const R = res.response.result;
      if (!wasBegan) { const e0 = R.step_errors[0] || R.step_errors[1]; if (e0) { t.began = false; const e = hErr(e0); q.forEach(x => x.reject && x.reject(e)); throw e; } }
      let failed = null;
      q.forEach((x, i) => {
        const k = off + i, er = R.step_errors[k], ok = R.step_results[k];
        if (failed) { x.reject && x.reject(failed); return; }
        if (er) { failed = (x.err && /constraint/i.test(er.message || '')) ? x.err : hErr(er); x.reject && x.reject(failed); return; }
        x.resolve && x.resolve(shape(ok, x.mode));
      });
      if (failed) throw failed;
      if (fin) { const ce = R.step_errors[steps.length - 1]; if (ce || !R.step_results[steps.length - 1]) throw hErr(ce || { message: '提交失败' }); t.committed = true; t.baton = null; }
    })();
    t.inflight = p.finally(() => { t.inflight = null; }).catch(() => { });
    return p;
  }
  return {
    kind: 'turso', stats, pipeline,
    query(t, sql, a, mode) {
      if (!t) return queueAuto(sql, a, mode);
      if (mode === 'run') t.wrote = true;
      let pr; const p = new Promise((resolve, reject) => { pr = { resolve, reject }; });
      p.catch(() => { }); // 没人等待的查询失败时不触发 unhandledRejection（等待者仍会收到错误）
      {
        const { resolve, reject } = pr;
        t.queue.push({ seq: ++t.seq, sql, a, mode, resolve, reject });
        if (!t.tick) { t.tick = true; queueMicrotask(() => { t.tick = false; send(t).catch(() => { }); }); }
      }
      return p;
    },
    async exec(t, sql) {
      if (!t) { const res = await pipeline(null, [{ type: 'sequence', sql }, { type: 'close' }]); if (res[0].type !== 'ok') throw hErr(res[0].error); return; }
      for (const s of splitSql(sql)) await this.query(t, s, [], 'run');
    },
    defer(t, sql, a, err) { const e = { seq: ++t.seq, sql, a, mode: 'run', err }; t.queue.push(e); if (err) t.risky = true; if (!/^(SAVEPOINT|RELEASE)/.test(sql)) t.wrote = true; return e; },
    flush(t) { return send(t); },
    async undo(t, mark, name) {
      if (t.inflight) await t.inflight;
      if (mark && mark.seq > t.sent) { t.queue = t.queue.filter(x => x.seq < mark.seq); return; } // 保存点还没发出：直接丢弃这段
      t.queue = []; t.queue.push({ seq: ++t.seq, sql: 'ROLLBACK TO ' + name, a: [] }, { seq: ++t.seq, sql: 'RELEASE ' + name, a: [] });
    },
    // 排他模式：先单独拿到写锁再执行业务（拿不到就短暂等待重试，最多约 10 秒）
    async acquire(t) {
      for (let i = 0; ; i++) {
        const res = (await pipeline(t, [{ type: 'batch', batch: { steps: [{ stmt: stmt('PRAGMA foreign_keys = ON') }, { stmt: stmt('BEGIN IMMEDIATE'), condition: { type: 'ok', step: 0 } }] } }]))[0];
        const er = res && res.type === 'ok' ? (res.response.result.step_errors[0] || res.response.result.step_errors[1]) : (res && res.error);
        if (!er) { t.began = true; return; }
        if (!BUSY.test(er.message || '') || i >= 60) throw hErr(er);
        await sleep(Math.min(250, 20 + i * 15) * (0.6 + Math.random() * 0.8));
      }
    },
    async begin(o) { return { baton: null, base: null, began: false, write: !!o.write, queue: [], seq: 0, sent: 0, spn: 0, risky: false, wrote: false, inflight: null, tick: false }; },
    // 一次请求完成迁移：BEGIN IMMEDIATE → 各版本语句 → 写版本号 → COMMIT；任一步失败则 ROLLBACK
    async migrateBatch(fromV, list) {
      const steps = [{ stmt: stmt('BEGIN IMMEDIATE') }];
      if (fromV === undefined) steps.push({ stmt: stmt('INSERT INTO schema_version (v) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM schema_version)') });
      for (let i = fromV || 0; i < list.length; i++) { splitSql(list[i]).forEach(q => steps.push({ stmt: stmt(q) })); steps.push({ stmt: stmt('UPDATE schema_version SET v = ?', [i + 1]) }); }
      steps.push({ stmt: stmt('COMMIT') });
      steps.forEach((x, i) => { if (i > 0) x.condition = { type: 'ok', step: i - 1 }; });
      const ci = steps.length - 1; steps.push({ stmt: stmt('ROLLBACK'), condition: { type: 'and', conds: [{ type: 'ok', step: 0 }, { type: 'not', cond: { type: 'ok', step: ci } }] } });
      const res = (await pipeline(null, [{ type: 'batch', batch: { steps } }, { type: 'close' }]))[0];
      if (!res || res.type !== 'ok') throw hErr(res && res.error);
      const R = res.response.result; if (!R.step_results[ci]) { const e = R.step_errors.find(Boolean); throw hErr(e || { message: '迁移未完成' }); }
    },
    finalize(t) { t.closing = true; },
    async commit(t) {
      if (t.inflight) await t.inflight;
      if (t.committed) return;
      t.closing = false;
      if (!t.began && !t.queue.length) return;
      if (!t.wrote) { const b = t.baton; t.baton = null; if (b) pipeline({ baton: b, base: t.base }, [{ type: 'execute', stmt: stmt('COMMIT') }, { type: 'close' }]).catch(() => { }); return; } // 只读：不必等
      // 最后一批延迟写 + COMMIT 合并成一次请求
      t.queue.push({ seq: ++t.seq, sql: 'COMMIT', a: [], mode: 'run' });
      await send(t, true); t.baton = null;
    },
    async rollback(t) {
      if (t.inflight) await t.inflight.catch(() => { });
      if (!t.baton || t.committed) return;
      try { await pipeline(t, [{ type: 'execute', stmt: stmt('ROLLBACK') }, { type: 'close' }]); } catch (e) { } t.baton = null;
    },
    close() { },
  };
}

/* 打开数据库：TURSO_DATABASE_URL 存在时用 Turso，否则用本地文件 */
async function open(o) {
  if (typeof o === 'string') o = { file: o };
  const B = o.tursoUrl ? tursoBackend(o.tursoUrl, o.tursoToken || '', o) : localBackend(o.file);
  const db = wrap(B); db.backend = B;
  await db.migrate();
  return db;
}

module.exports = { open, SCHEMA_VERSION: MIGRATIONS.length, MIGRATIONS };

});

__def("server/domains/common.js", function (module, exports, __req) {
'use strict';
/* 各玩法模块共用的工具（V0.4 从 server/game.js 拆出） */
const CFG = __req("shared/config.js");
const U = __req("server/util.js");
const { CROPS, RULES, NPLOTS, UNLOCK_ORDER } = CFG;
const { bad, forbid, notFound, conflict } = U;
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[U.randInt(0, a.length - 1)];
const SHEEP_W = t => (CFG.SHEEP[t] || { wool: 0 }).wool;
const cropOfItem = item => { const m = /^([cg])(\d+)$/.exec(item || ''); if (!m || !CROPS[+m[2]]) return null; return { golden: m[1] === 'g', id: +m[2] }; };
const itemName = item => { const ri = CFG.ranchItem(item); if (ri) return ri.name; const si = CFG.SHOP_ITEMS.find(x => x.id === item); if (si) return si.name; const c = cropOfItem(item); return c ? (c.golden ? '金色' : '') + CROPS[c.id].name : item; };
const all = Promise.all.bind(Promise);
module.exports = { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all };

});

__def("server/domains/account.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：账号：注册、登录、绑定、改密、找回、导出、注销、旧存档迁移、资料、图鉴、装扮
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

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
    if (b.settings !== undefined) { const s = b.settings || {}; const clean = { sound: !!s.sound, music: !!s.music, notify: !!s.notify, tod: ['auto', 'day', 'dusk', 'night'].includes(s.tod) ? s.tod : 'auto', tut: U.int(s.tut || 0, '引导', 0, 99), mvol: U.int(s.mvol === undefined ? 70 : s.mvol, '音乐音量', 0, 100), svol: U.int(s.svol === undefined ? 80 : s.svol, '音效音量', 0, 100), pan: U.int(s.pan || 0, '提示', 0, 9), v3char: !!s.v3char, sea: ['auto', 'spring', 'summer', 'autumn', 'winter'].includes(s.sea) ? s.sea : 'auto', wfx: s.wfx !== false, v3hero: CFG.ASSETS.some(a => a.id === s.v3hero && a.kind === 'hero') ? s.v3hero : '' }; sets.push('settings=?'); args.push(JSON.stringify(clean)); }
    if (sets.length) this.db.w(`UPDATE users SET ${sets.join(',')} WHERE id=?`, ...args, uid); return {};
  },
};

});

__def("server/domains/farm.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：农田：种植、收获、照料、化肥、扩建、土地升级、批量、出售与购买
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

module.exports = {
  scheduleEv(P, start) { const dur = CFG.plotDur(P), rem = 1 - P.p, cr = CROPS[P.c]; const n = (U.rand() < (cr.time < 60 ? 0.35 : 0.6) ? 1 : 0) + (U.rand() < 0.3 ? 1 : 0) + (cr.time >= 1800 && U.rand() < 0.4 ? 1 : 0); const ev = []; for (let i = 0; i < n; i++) ev.push([Math.round(start + dur * rem * (0.1 + U.rand() * 0.75)), pick(['d', 'w', 'b'])]); ev.sort((a, b) => a[0] - b[0]); return ev; },
  async startCycle(P, now, uid) { const cr = CROPS[P.c], wb = uid ? CFG.wonderBonus(this.layoutOf(await this.user(uid)).items) : 0; P.y0 = Math.max(1, Math.round(cr.yield * CFG.soilOf(P).yield * await this.evMult('yield_mult', P.c) * (CFG.inSeason(P.c, now) ? 1 + CFG.seasonOf(now).bonus : 1) * (1 + wb))); /* 第 1 期：当季作物增产、奇观永久增产 */ P.y = P.y0; P.stolen = 0; P.pr = { d: 0, w: 0, b: 0 }; P.t = now; P.ra = 0; P.cycle++; P.ev = this.scheduleEv(P, now); },
  async plant(uid, idx, cropId, out) {
    const cr = CROPS[cropId]; if (!cr) throw bad('没有这种种子');
    const [u, P] = await all([this.user(uid), this.plot(uid, idx)]);
    if (!P.u) throw bad('这块地还没开垦'); if (P.c >= 0) throw conflict('这块地已经种了东西', 'occupied');
    if (u.lv < cr.lv) throw bad(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'locked');
    this.addGold(uid, -cr.seed, 'seed');
    const now = this.now(); P.c = cropId; P.p = 0; P.sea = 0; await this.startCycle(P, now, uid); this.savePlot(uid, P);
    this.db.w('UPDATE users SET plant_total=plant_total+1, seed=? WHERE id=?', cropId, uid); this.pu(uid, x => { x.plant_total++; x.seed = cropId; }); this.bump(uid, 'plant'); await this.addExp(uid, 2, out, u);
    return { idx, crop: cropId, cost: cr.seed };
  },
  async harvest(uid, idx, out) {
    const P = await this.plot(uid, idx); if (!P.u || P.c < 0) throw bad('这里没有作物'); if (P.p < 1) throw conflict('作物还没成熟', 'not_ripe');
    const cr = CROPS[P.c], n = P.y, now = this.now(); let golden = 0;
    if (n > 0) this.addInv(uid, 'c' + P.c, n);
    // 大丰收：额外多收一部分（不影响别人可摘的数量）
    let bonus = 0; if (n > 0 && U.rand() < RULES.bumperChance) { bonus = Math.max(1, Math.round(n * RULES.bumperBonus)); this.addInv(uid, 'c' + P.c, bonus); }
    if (U.rand() < RULES.goldenChance * await this.evMult('golden_mult', P.c)) { golden = Math.max(1, Math.round(P.y0 * 0.1)); this.addInv(uid, 'g' + P.c, golden); this.codex(uid, 'g' + P.c, golden); this.db.w('UPDATE users SET golden_total=golden_total+1 WHERE id=?', uid); this.pu(uid, x => x.golden_total++); }
    this.codex(uid, 'c' + P.c, n + bonus);
    this.db.w('UPDATE users SET harvest_total=harvest_total+1 WHERE id=?', uid); this.pu(uid, x => x.harvest_total++); this.bump(uid, 'harvest');
    const exp = await this.addExp(uid, cr.exp, out);
    const res = { idx, crop: P.c, n, bonus, golden, exp, stolen: P.stolen, season2: false };
    if (cr.seasons > 1 && P.sea < cr.seasons - 1) { P.sea++; P.p = RULES.season2Start; await this.startCycle(P, now, uid); res.season2 = true; }
    else { P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; }
    this.savePlot(uid, P); return res;
  },
  codex(uid, item, n) { this.db.w('INSERT INTO codex (user_id,item,first_at,n) VALUES (?,?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET n=n+excluded.n', uid, item, this.now(), n || 1); },
  async care(uid, idx, out) {
    const P = await this.plot(uid, idx); const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) throw conflict('这块地很健康', 'healthy');
    P.pr[k] = 0; this.savePlot(uid, P); this.bump(uid, 'care'); await this.addExp(uid, 2, out); return { idx, kind: k };
  },
  async shovel(uid, idx) {
    const P = await this.plot(uid, idx); if (P.c < 0) throw bad('这里没有作物'); if (P.p >= 1) throw conflict('作物已成熟，先收获吧', 'ripe');
    P.c = -1; P.p = 0; P.y = 0; P.y0 = 0; P.stolen = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; P.ev = []; P.ra = 0; this.savePlot(uid, P); return { idx };
  },
  // 一键催熟：按“离成熟最近”排序，逐块用化肥直到成熟，化肥用完为止
  async fertAll(uid) {
    let have = await this.invQty(uid, 'fert'); if (have <= 0) throw conflict('没有化肥了，去商店买一些吧', 'not_enough');
    const now = this.now(), list = (await this.plots(uid)).filter(P => P.u && P.c >= 0 && P.p < 1).sort((a, b) => CFG.remainSec(a) - CFG.remainSec(b));
    if (!list.length) throw conflict('没有正在生长的作物', 'none');
    const res = []; let used = 0;
    for (const P0 of list) { if (have <= 0) break; let n = 0, P = P0; while (have > 0 && P.p < 1) { await this.fert(uid, P.idx); have--; used++; n++; P = await this.plot(uid, P.idx); } res.push({ idx: P.idx, n, ripe: P.p >= 1 }); }
    void now; return { res, used, ripe: res.filter(x => x.ripe).length, left: have };
  },
  async fert(uid, idx) {
    const P = await this.plot(uid, idx); if (P.c < 0 || P.p >= 1) throw bad('只能给生长中的作物施肥');
    this.addInv(uid, 'fert', -1); P.p = Math.min(1, P.p + RULES.fertBoost); if (P.p >= 1) { P.ra = this.now(); P.ev = []; } this.savePlot(uid, P); return { idx };
  },
  async expand(uid, idx, out) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]); const owned = plots.filter(p => p.u && p.idx < NPLOTS).length;
    if (idx === undefined || idx === null || idx < 0) idx = UNLOCK_ORDER.find(i => !plots[i].u);
    if (idx === undefined) throw bad('土地已经全部开垦');
    const P = plots.find(p => p.idx === idx); if (!P) throw bad('土地不存在'); if (P.u) throw conflict('这块地已经开垦了', 'done');
    const need = CFG.plotNeedLv(owned), cost = CFG.plotCost(owned); if (u.lv < need) throw bad(`扩建需要 Lv.${need}`, 'locked');
    this.addGold(uid, -cost, 'expand'); P.u = 1; P.t = this.now(); this.savePlot(uid, P); await this.addExp(uid, 10, out); return { idx, cost };
  },
  // 开辟新的一片农田：24 块地一次全部开好
  async buyField(uid, out) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]); const f = Math.ceil(plots.length / NPLOTS);
    if (f >= CFG.FIELDS_MAX) throw conflict(`最多 ${CFG.FIELDS_MAX} 片农田，已经全部开辟了`, 'max');
    if (plots.filter(p => p.idx < NPLOTS && p.u).length < NPLOTS) throw conflict('先把农场中间这片 24 块地全部开垦完', 'first');
    const need = CFG.fieldNeedLv(f), cost = CFG.fieldCost(f); if (u.lv < need) throw bad(`开辟第 ${f + 1} 片农田需要 Lv.${need}`, 'locked');
    this.addGold(uid, -cost, 'field'); const now = this.now(), vals = [], args = [], fresh = [];
    for (let j = 0; j < NPLOTS; j++) { const i = f * NPLOTS + j; vals.push('(?,?,?,?)'); args.push(uid, i, 1, now); fresh.push({ idx: i, u: 1, soil: 0, c: -1, p: 0, t: now, sea: 0, y: 0, y0: 0, stolen: 0, pr: { d: 0, w: 0, b: 0 }, ev: [], ra: 0, cycle: 0 }); }
    this.db.w('INSERT INTO plots (user_id,idx,u,t) VALUES ' + vals.join(','), ...args);
    const C = this.C(); if (C && C.plots[uid]) fresh.forEach(P => C.plots[uid].push(structuredClone(P)));
    await this.addExp(uid, 200 * f, out); const evicted = await this.homeEvict(uid); return { field: f, cost, plots: NPLOTS, evicted };
  },
  // 土地升级：普通 → 红土地 → 黑土地 → 金土地（接口名沿用 red）
  // 土地升级：to = 目标等级（不传就升一级）。从当前等级一级一级升到目标，每一级的费用、等级要求和原来一样
  async red(uid, idx, out, to) {
    const [u, plots] = await all([this.user(uid), this.plots(uid)]);
    const P = plots.find(p => p.idx === idx); if (!P) throw bad('土地不存在'); if (!P.u) throw bad('先开垦这块地');
    const cur = P.soil | 0, target = to === undefined || to === null ? cur + 1 : to; const TS = CFG.SOILS[target];
    if (!TS || target <= 0) { if (!CFG.SOILS[cur + 1]) throw conflict('这块已经是最高级的金土地了', 'done'); throw bad('没有这种土地'); }
    if (cur >= target) throw conflict(`这块已经是${CFG.SOILS[cur].name}了`, 'done');
    if (u.lv < TS.lv) throw bad(`升级${TS.name}需要 Lv.${TS.lv}`, 'locked');
    let cost = 0; for (let k = cur + 1; k <= target; k++) cost += CFG.soilCost(k, plots.filter(p => (p.soil | 0) >= k).length);
    this.addGold(uid, -cost, 'soil' + target); P.soil = target; this.savePlot(uid, P); let e = 0; for (let k = cur + 1; k <= target; k++) e += 15 * k; await this.addExp(uid, e, out);
    return { idx, cost, soil: target, from: cur, name: TS.name };
  },
  // 批量操作：每一项一个保存点，单项失败只回滚该项
  async batch(uid, fn, list) {
    const res = [], out = {};
    for (const i of list) { try { res.push(await this.db.sp(() => fn(i, out))); } catch (e) { if (!(e instanceof U.ApiError)) throw e; res.push({ idx: i, err: e.message, code: e.code }); } }
    return { res, out };
  },
  async sell(uid, item, n, have) {
    const c = cropOfItem(item) || CFG.ranchItem(item); if (!c) throw bad('只能出售作物、鱼和羊毛'); if (have === undefined) have = await this.invQty(uid, item);
    n = Math.min(U.int(n, '数量', 1, 1e9), have); if (n <= 0) throw conflict('没有可以卖的', 'not_enough');
    const g = n * await this.unitPrice(item); this.addInv(uid, item, -n); this.addGold(uid, g, 'sell'); this.bump(uid, 'sell', g, 'day'); this.bump(uid, 'sell', 1, 'all'); return { item, n, gold: g };
  },
  async sellAll(uid) { let total = 0; const items = []; for (const [item, q] of Object.entries(await this.inv(uid))) { if ((cropOfItem(item) || CFG.ranchItem(item)) && q > 0) { total += (await this.sell(uid, item, q, q)).gold; items.push(item); } } if (!total) throw conflict('仓库里没有作物', 'empty'); return { gold: total, items }; },
  async buy(uid, item, n) {
    const it = CFG.SHOP_ITEMS.find(x => x.id === item); if (!it) throw bad('商店没有这个商品'); n = U.int(n, '数量', 1, 100000);
    this.addGold(uid, -it.price * n, 'shop:' + item); this.addInv(uid, item, n); return { item, n };
  },
  /* ---------- 鱼塘、牧场、果园（v3：按批次 / 按群存储，支持成百上千） ---------- */
};

});

__def("server/domains/ranch.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：牧场、鱼塘、果园、牧羊犬、宠物狗
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

module.exports = {
  ranchOf(u) {
    const R = J(u.ranch) || {}, now = this.now(), RC = CFG.RANCH;
    R.fish = (Array.isArray(R.fish) ? R.fish : []).map(f => ({ t: f.t | 0, n: Math.max(1, f.n | 0 || 1), at: f.at || now }));
    R.trees = (Array.isArray(R.trees) ? R.trees : []).map(r => ({ t: r.t | 0, n: Math.max(1, r.n | 0 || 1), at: r.at || now, last: r.last || 0, acc: r.acc || 0 }));
    R.herd = R.herd || { from: 0, until: 0, dog: '' };
    // 旧版一只一只存的羊：合并成按品种的羊群（已经长好的羊毛先存进 pend）
    const old = Array.isArray(R.sheep) ? R.sheep : [], groups = {};
    if (old.every(s => s.n) && new Set(old.map(s => s.t)).size === old.length) { R.sheep = old.map(s => ({ t: s.t | 0, n: s.n | 0, last: s.last || now, acc: s.acc || 0, pend: s.pend || 0 })); }
    else {
    old.forEach(s => { const t = s.t | 0, def = CFG.SHEEP[t]; if (!def) return; const g = groups[t] || (groups[t] = { t, n: 0, last: now, acc: 0, pend: 0, _a: 0 });
      if (s.n) { const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c); g.pend += (s.pend || 0) + k * s.n * def.wool; g._a += (c - k) * s.n; g.n += s.n; }
      else { const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c); g.pend += k * def.wool; g._a += c - k; g.n += 1; } });
    R.sheep = Object.values(groups).map(g => ({ t: g.t, n: g.n, last: now, acc: g.n ? g._a / g.n : 0, pend: g.pend }));
    if (R.herd.until > now) R.herd.from = Math.max(R.herd.from || 0, now); } // 合并后从现在起算（之前的进度已经结算进 acc）
    const need = (capOf, cnt) => { let l = 1; while (l < RC.maxLv && capOf(l) < cnt) l++; return l; };
    R.pondLv = Math.max(R.pondLv || 1, need(CFG.pondCapOf, R.fish.reduce((a, f) => a + f.n, 0)));
    R.pastLv = Math.max(R.pastLv || 1, need(CFG.pastureCapOf, R.sheep.reduce((a, s) => a + s.n, 0)));
    R.orchLv = Math.max(R.orchLv || 1, need(CFG.orchardCapOf, R.trees.reduce((a, r) => a + r.n, 0)));
    return R;
  },
  saveRanch(uid, R) { const s = JSON.stringify(R); this.db.w('UPDATE users SET ranch=? WHERE id=?', s, uid); this.pu(uid, x => x.ranch = s); },
  ranchView(u) {
    const R = this.ranchOf(u), now = this.now(), sum = (l) => l.reduce((a, x) => a + x.n, 0);
    const up = (kind, l) => l >= CFG.RANCH.maxLv ? null : { cost: CFG.ranchUpCost(kind, l), needLv: CFG.ranchNeedLv(l + 1) };
    return { pondLv: R.pondLv, pastLv: R.pastLv, orchLv: R.orchLv, pondCap: CFG.pondCapOf(R.pondLv), pastureCap: CFG.pastureCapOf(R.pastLv), orchardCap: CFG.orchardCapOf(R.orchLv),
      up: { pond: up('pond', R.pondLv), pasture: up('pasture', R.pastLv), orchard: up('orchard', R.orchLv) }, herd: R.herd,
      fish: R.fish.map(f => ({ t: f.t, n: f.n, at: f.at, left: CFG.fishLeft(f, now) })), fishN: sum(R.fish),
      sheep: R.sheep.map(s => { const c = CFG.sheepCycles(s, now, R.herd); return { t: s.t, n: s.n, last: s.last, acc: s.acc, pend: s.pend || 0, cycles: c, wool: Math.floor(c) * s.n * SHEEP_W(s.t) + (s.pend || 0), full: c >= CFG.RANCH.woolMax }; }), sheepN: sum(R.sheep),
      trees: R.trees.map(r => ({ t: r.t, n: r.n, at: r.at, last: r.last, acc: r.acc, cycles: CFG.treeCycles(r, now), grow: CFG.treeGrowLeft(r, now) })), treeN: sum(R.trees) };
  },
  /* ===== V0.3 家园自由建造：布局存档（建筑目录 content/buildings.jsonc，网格 content/home.jsonc） ===== */
  async ranchUpgrade(uid, kind) {
    if (!['pond', 'pasture', 'orchard'].includes(kind)) throw bad('不能扩建这个'); const u = await this.user(uid), R = this.ranchOf(u), key = { pond: 'pondLv', pasture: 'pastLv', orchard: 'orchLv' }[kind], l = R[key];
    const name = { pond: '鱼塘', pasture: '牧场', orchard: '果园' }[kind];
    if (l >= CFG.RANCH.maxLv) throw conflict(`${name}已经是最高级了`, 'max'); const need = CFG.ranchNeedLv(l + 1); if (u.lv < need) throw bad(`${name}扩建到 ${l + 1} 级需要玩家 Lv.${need}`, 'locked');
    this.addGold(uid, -CFG.ranchUpCost(kind, l), 'up:' + kind); R[key] = l + 1; this.saveRanch(uid, R); await this.addExp(uid, 20 + l * 5, {});
    const evicted = kind === 'orchard' ? 0 : await this.homeEvict(uid);
    const cap = { pond: CFG.pondCapOf, pasture: CFG.pastureCapOf, orchard: CFG.orchardCapOf }[kind](l + 1); return { kind, lv: l + 1, cap, name, evicted };
  },
  async buyFish(uid, type, n) {
    const d = CFG.FISH[type]; if (!d) throw bad('没有这种鱼苗'); n = U.int(n || 1, '数量', 1, 5000);
    const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.pondCapOf(R.pondLv), have = R.fish.reduce((a, f) => a + f.n, 0); if (have + n > cap) throw conflict(`鱼塘最多养 ${cap} 条鱼，现在还能放 ${Math.max(0, cap - have)} 条，扩建鱼塘可以养更多`, 'full');
    this.addGold(uid, -d.price * n, 'fish:' + d.id); const now = this.now(); const last = R.fish[R.fish.length - 1];
    if (last && last.t === d.id && now - last.at < 1000) last.n += n; else R.fish.push({ t: d.id, n, at: now });
    this.saveRanch(uid, R); this.bump(uid, 'fish_in', n, 'all'); return { type: d.id, n, name: d.name };
  },
  async collectFish(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.fish = R.fish.filter(f => { const d = CFG.FISH[f.t]; if (!d || CFG.fishLeft(f, now) > 0) return true; got[d.id] = (got[d.id] || 0) + d.yield * f.n; exp += d.exp * f.n; return false; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('还没有长大的鱼', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'fs' + id, got[id]); this.codex(uid, 'fs' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'fish', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  },
  async buySheep(uid, type, n) {
    const d = CFG.SHEEP[type]; if (!d) throw bad('没有这种羊'); n = U.int(n || 1, '数量', 1, 5000); const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.pastureCapOf(R.pastLv), have = R.sheep.reduce((a, s) => a + s.n, 0); if (have + n > cap) throw conflict(`牧场最多养 ${cap} 只，现在还能买 ${Math.max(0, cap - have)} 只，扩建牧场可以养更多`, 'full');
    this.addGold(uid, -d.price * n, 'sheep:' + d.id); const now = this.now(); let g = R.sheep.find(s => s.t === d.id);
    if (g) { const c = CFG.sheepCycles(g, now, R.herd), k = Math.floor(c); g.pend = (g.pend || 0) + k * g.n * d.wool; g.acc = (c - k) * g.n / (g.n + n); g.last = now; g.n += n; }
    else R.sheep.push({ t: d.id, n, last: now, acc: 0, pend: 0 });
    this.saveRanch(uid, R); return { type: d.id, n, name: d.name }; // 不改 herd.from：其他羊群还没结算的牧羊加速要保留（只结算了这一群，它的 last 已更新）
  },
  async shear(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.sheep.forEach(s => { const d = CFG.SHEEP[s.t]; if (!d) return; const c = CFG.sheepCycles(s, now, R.herd), k = Math.floor(c), w = k * s.n * d.wool + (s.pend || 0); if (w <= 0) return;
      got[d.id] = (got[d.id] || 0) + w; exp += Math.round(w / d.wool * d.exp); s.acc = c >= CFG.RANCH.woolMax ? 0 : c - k; s.last = now; s.pend = 0; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('羊毛还没长好', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'wl' + id, got[id]); this.codex(uid, 'wl' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'shear', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  },
  // 牧羊：派一只吃饱的牧羊犬去放羊。狗等级越高：时间越长、加速越多、一次能照看的羊越多（羊比它能照看的多时，加速按比例打折）
  async herd(uid, kind) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), total = R.sheep.reduce((a, s) => a + s.n, 0);
    if (!total) throw conflict('牧场里还没有羊', 'none');
    const dogs = this.allDogs(u), d = (kind ? dogs.find(x => x.id === kind) : dogs.find(x => x.fed)) || dogs[0];
    if (!d) throw conflict('先领养一只牧羊犬吧（商店 → 宠物）', 'no_dog'); if (!d.fed) throw conflict(`${d.name}饿着肚子赶不动羊，先去仓库喂它`, 'hungry');
    if (R.herd.until > now) throw conflict(`${(CFG.DOGS.find(x => x.id === R.herd.dog) || d).name}正在牧羊，还剩 ${Math.ceil((R.herd.until - now) / 60000)} 分钟`, 'busy');
    R.sheep.forEach(s => { s.acc = CFG.sheepCycles(s, now, R.herd); s.last = now; }); // 先结算之前的进度
    const H = CFG.herdOf(d.lv), share = Math.min(1, H.cap / total);
    R.herd = { from: now, until: now + H.min * 60000, dog: d.id, boost: H.boost, share: +share.toFixed(3) }; this.saveRanch(uid, R); this.bump(uid, 'herd', 1, 'all');
    const g = await this.dogExp(uid, d.id, 3);
    return { dog: d.id, name: d.name, until: R.herd.until, boost: H.boost, share, cap: H.cap, lvUp: g.lvUp };
  },
  async buyTree(uid, type, n) {
    const d = CFG.TREES[type]; if (!d) throw bad('没有这种树苗'); n = U.int(n || 1, '数量', 1, 2000); const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked');
    const R = this.ranchOf(u), cap = CFG.orchardCapOf(R.orchLv), have = R.trees.reduce((a, r) => a + r.n, 0); if (have + n > cap) throw conflict(`果园最多种 ${cap} 棵，现在还能种 ${Math.max(0, cap - have)} 棵，扩建果园可以种更多`, 'full');
    this.addGold(uid, -d.price * n, 'tree:' + d.id); R.trees.push({ t: d.id, n, at: this.now(), last: 0, acc: 0 }); this.saveRanch(uid, R); return { type: d.id, n, name: d.name };
  },
  async pickFruit(uid, out) {
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(), got = {}; let exp = 0;
    R.trees.forEach(r => { const d = CFG.TREES[r.t]; if (!d) return; const c = CFG.treeCycles(r, now), k = Math.floor(c); if (k < 1) return; got[d.id] = (got[d.id] || 0) + k * r.n * d.yield; exp += k * r.n * d.exp; r.acc = c >= CFG.RANCH.fruitMax ? 0 : c - k; r.last = now; });
    const ids = Object.keys(got); if (!ids.length) throw conflict('果子还没熟', 'not_ripe');
    ids.forEach(id => { this.addInv(uid, 'fr' + id, got[id]); this.codex(uid, 'fr' + id, got[id]); }); this.saveRanch(uid, R); this.bump(uid, 'fruit', 1, 'all');
    const e = await this.addExp(uid, exp, out); return { got, exp: e };
  },
  // 狗加经验（喂食 +1、牧羊 +3、训练 +5），最高 100 级
  async dogExp(uid, kind, n) {
    if (/^p\d+$/.test(kind || '')) { const u = await this.user(uid), R = this.ranchOf(u), p = (R.pets || []).find(x => x.id === kind); if (!p) throw bad('没有这只狗'); let lv = p.lv || 1, exp = (p.exp || 0) + n, up = 0;
      while (lv < CFG.RANCH.dogMaxLv && exp >= CFG.dogExpNeed(lv)) { exp -= CFG.dogExpNeed(lv); lv++; up = lv; } if (lv >= CFG.RANCH.dogMaxLv) exp = 0; p.lv = lv; p.exp = exp; this.saveRanch(uid, R); return { lv, exp, lvUp: up }; }
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col; let lv = u[c + '_lv'] || 1, exp = (u[c + '_exp'] || 0) + n, up = 0;
    while (lv < CFG.RANCH.dogMaxLv && exp >= CFG.dogExpNeed(lv)) { exp -= CFG.dogExpNeed(lv); lv++; up = lv; } if (lv >= CFG.RANCH.dogMaxLv) exp = 0;
    this.db.w(`UPDATE users SET ${c}_lv=?, ${c}_exp=? WHERE id=?`, lv, exp, uid); this.pu(uid, x => { x[c + '_lv'] = lv; x[c + '_exp'] = exp; }); return { lv, exp, lvUp: up };
  },
  async trainDog(uid, kind, n) {
    n = U.int(n || 1, '次数', 1, 100); const u = await this.user(uid); let name, lv;
    if (/^p\d+$/.test(kind || '')) { const p = (this.ranchOf(u).pets || []).find(x => x.id === kind); if (!p) throw bad('没有这只狗'); name = p.name; lv = p.lv || 1; }
    else { const d = this.dogDef(kind), c = d.col; if (!u[c + '_own']) throw bad(`还没有领养${d.name}`); name = d.name; lv = u[c + '_lv'] || 1; kind = d.id; }
    if (lv >= CFG.RANCH.dogMaxLv) throw conflict(`${name}已经满级了`, 'max'); let cost = 0, up = 0, g = { lv };
    let done = 0; for (let i = 0; i < n && g.lv < CFG.RANCH.dogMaxLv; i++) { const c1 = 150 * g.lv; if ((await this.user(uid)).gold < c1) break; this.addGold(uid, -c1, 'train'); cost += c1; done++; g = await this.dogExp(uid, kind, 5); if (g.lvUp) up = g.lvUp; }
    if (!done) throw conflict(`金币不够，训练一次要 ${150 * lv} 金币`, 'not_enough'); // 训练 ×10：钱不够 10 次就练到钱用完为止
    return { kind, name, lv: g.lv, lvUp: up, cost, n: done };
  },
  // 一键加速：鱼饲料 / 精饲料 / 果树营养液，用在最快能收的那些上，用完为止
  async ranchBoost(uid, kind) {
    const item = { pond: 'ffeed', pasture: 'sfeed', orchard: 'tfert' }[kind]; if (!item) throw bad('不能加速这个');
    let have = await this.invQty(uid, item); const name = itemName(item); if (have <= 0) throw conflict(`没有${name}了，去商店买一些吧`, 'not_enough');
    const u = await this.user(uid), R = this.ranchOf(u), now = this.now(); let used = 0, done = 0;
    if (kind === 'pond') {
      const list = R.fish.filter(f => CFG.fishLeft(f, now) > 0).sort((a, b) => CFG.fishLeft(a, now) - CFG.fishLeft(b, now)); if (!list.length) throw conflict('鱼塘里没有正在长的鱼', 'none');
      for (const f of list) { if (have <= 0) break; const T = CFG.FISH[f.t].time, step = T * 0.3, m = Math.ceil(CFG.fishLeft(f, now) / step);
        if (have >= m * f.n) { f.at -= m * step * 1000; have -= m * f.n; used += m * f.n; done += f.n; continue; }
        const k = Math.floor(have / m); if (k > 0) { R.fish.push({ t: f.t, n: k, at: f.at - m * step * 1000 }); f.n -= k; have -= k * m; used += k * m; done += k; }
        const s = Math.floor(have / f.n); if (s > 0) { f.at -= s * step * 1000; have -= s * f.n; used += s * f.n; } break; }
    } else if (kind === 'pasture') {
      const list = R.sheep.map(s => ({ s, c: CFG.sheepCycles(s, now, R.herd) })).filter(x => x.c < CFG.RANCH.woolMax).sort((a, b) => b.c - a.c); if (!list.length) throw conflict('羊毛都长满了，先去剪羊毛', 'none');
      for (const { s, c } of list) { if (have <= 0) break; const need = Math.ceil((CFG.RANCH.woolMax - c) / 0.5 * s.n), use = Math.min(have, need); s.acc = Math.min(CFG.RANCH.woolMax, c + use * 0.5 / s.n); s.last = now; have -= use; used += use; if (s.acc >= 1) done += s.n; }
    } else {
      const grow = R.trees.filter(r => CFG.treeGrowLeft(r, now) > 0).sort((a, b) => CFG.treeGrowLeft(a, now) - CFG.treeGrowLeft(b, now));
      const ripe = R.trees.filter(r => CFG.treeGrowLeft(r, now) <= 0 && CFG.treeCycles(r, now) < CFG.RANCH.fruitMax).sort((a, b) => CFG.treeCycles(b, now) - CFG.treeCycles(a, now));
      if (!grow.length && !ripe.length) throw conflict('果树都结满了，先去摘果子', 'none');
      for (const r of ripe) { if (have <= 0) break; const c = CFG.treeCycles(r, now), need = Math.ceil((CFG.RANCH.fruitMax - c) / 0.5 * r.n), use = Math.min(have, need); r.acc = Math.min(CFG.RANCH.fruitMax, c + use * 0.5 / r.n); r.last = now; have -= use; used += use; if (r.acc >= 1) done += r.n; }
      for (const r of grow) { if (have <= 0) break; const G0 = CFG.TREES[r.t].grow, step = G0 * 0.3, m = Math.ceil(CFG.treeGrowLeft(r, now) / step), use = Math.min(have, m * r.n), s = Math.floor(use / r.n); if (s <= 0) break; r.at -= s * step * 1000; have -= s * r.n; used += s * r.n; }
    }
    if (!used) throw conflict(`${name}不够用`, 'not_enough');
    this.addInv(uid, item, -used); this.saveRanch(uid, R); return { kind, item, used, done, left: have };
  },
  /* ---------- 更多颜色的边牧（自己起名字） ---------- */
  petsOf(u) { const R = this.ranchOf(u), now = this.now(); return (R.pets || []).map(p => ({ id: p.id, name: p.name, coat: p.coat, own: true, lv: p.lv || 1, exp: p.exp || 0, need: CFG.dogExpNeed(p.lv || 1), until: p.until || 0, fed: (p.until || 0) > now, pet: true })); },
  allDogs(u) { return this.dogsOf(u).filter(d => d.own).concat(this.petsOf(u)); },
  async buyPet(uid, coat, name) {
    const d = CFG.COLLIES.find(x => x.coat === coat); if (!d) throw bad('没有这种边牧'); name = U.cleanName(name || d.name.replace('边牧', '')); if ([...name].length > 8) throw bad('名字最多 8 个字');
    const u = await this.user(uid); if (u.lv < d.lv) throw bad(`${d.name}需要 Lv.${d.lv}`, 'locked'); const R = this.ranchOf(u); R.pets = R.pets || [];
    if (R.pets.length >= CFG.PETS_MAX) throw conflict(`最多再养 ${CFG.PETS_MAX} 只边牧`, 'full');
    this.addGold(uid, -d.price, 'pet:' + coat); const id = 'p' + (Math.max(0, ...R.pets.map(p => +String(p.id).slice(1) || 0)) + 1); R.pets.push({ id, coat, name, lv: 1, exp: 0, until: this.now() + RULES.dogFeedMin * 60000 }); this.saveRanch(uid, R);
    return { id, name, coat };
  },
  async renamePet(uid, id, name) { name = U.cleanName(name); if ([...name].length > 8) throw bad('名字最多 8 个字'); const u = await this.user(uid), R = this.ranchOf(u), p = (R.pets || []).find(x => x.id === id); if (!p) throw bad('没有这只狗'); p.name = name; this.saveRanch(uid, R); return { id, name }; },
  /* ---------- 看家狗：福旺、睿宝 ---------- */
  dogDef(kind) { const d = CFG.DOGS.find(x => x.id === (kind || 'fuwang')); if (!d) throw bad('没有这只狗'); return d; },
  dogsOf(u) { const now = this.now(); return CFG.DOGS.map(d => { const lv = u[d.col + '_lv'] || 1, until = u[d.col + '_until'] || 0; return { id: d.id, name: d.name, own: !!u[d.col + '_own'], lv, exp: u[d.col + '_exp'] || 0, need: CFG.dogExpNeed(lv), until, fed: until > now, bite: d.bite, chance: CFG.dogChance(d, lv) }; }); },
  async buyDog(uid, kind) {
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col;
    if (u[c + '_own']) throw conflict(`已经有${d.name}了`, 'done'); if (u.lv < d.lv) throw bad(`领养${d.name}需要 Lv.${d.lv}`, 'locked');
    this.addGold(uid, -d.price, 'dog:' + d.id); this.db.w(`UPDATE users SET ${c}_own=1 WHERE id=?`, uid); this.pu(uid, x => x[c + '_own'] = 1); this.addInv(uid, 'dogfood', 1); return { kind: d.id, name: d.name };
  },
  async feedDog(uid, kind, n) {
    n = U.int(n || 1, '数量', 1, 100); const now = this.now();
    if (/^p\d+$/.test(kind || '')) { const u = await this.user(uid), R = this.ranchOf(u), p = (R.pets || []).find(x => x.id === kind); if (!p) throw bad('没有这只狗'); this.addInv(uid, 'dogfood', -n);
      p.until = Math.min(now + 7 * 86400000, Math.max(p.until || 0, now) + n * RULES.dogFeedMin * 60000); this.saveRanch(uid, R); const g = await this.dogExp(uid, kind, n); return { kind, name: p.name, lvUp: g.lvUp, until: p.until, n }; }
    const d = this.dogDef(kind), u = await this.user(uid), c = d.col; if (!u[c + '_own']) throw bad(`还没有领养${d.name}`); this.addInv(uid, 'dogfood', -n);
    const until = Math.min(now + 7 * 86400000, Math.max(u[c + '_until'] || 0, now) + n * RULES.dogFeedMin * 60000); this.db.w(`UPDATE users SET ${c}_until=? WHERE id=?`, until, uid); this.pu(uid, x => { x[c + '_until'] = until; });
    const g = await this.dogExp(uid, d.id, n); return { kind: d.id, name: d.name, lvUp: g.lvUp, until, n };
  },

  /* ---------- 签到 / 任务 / 成就 ---------- */
};

});

__def("server/domains/home.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：家园建造网格：布局存档、摆放、拆除、扩建收回
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

module.exports = {
  layoutOf(u) { let L = {}; try { L = JSON.parse(u.layout || '{}') || {}; } catch (e) { L = {}; } if (!Array.isArray(L.items)) L.items = []; L.v = 1; L.seq = L.seq | 0; return L; },
  saveLayout(uid, L) { const s = JSON.stringify(L); this.db.w('UPDATE users SET layout=? WHERE id=?', s, uid); this.pu(uid, x => x.layout = s); },
  async homeState(uid) { const [u, plots] = await all([this.user(uid), this.plots(uid)]), R = this.ranchOf(u); return { u, fields: Math.max(1, Math.ceil(plots.length / NPLOTS)), pastLv: R.pastLv || 1, pondLv: R.pondLv || 1 }; },
  async homeLayout(uid) { const h = await this.homeState(uid), L = this.layoutOf(h.u); return { items: L.items, fields: h.fields, pastLv: h.pastLv, pondLv: h.pondLv, grid: CFG.gridSpec() }; },
  async homePlace(uid, it) {
    it = { type: String(it.type || ''), gx: it.gx | 0, gz: it.gz | 0, rot: ((it.rot | 0) % 4 + 4) % 4 };
    const h = await this.homeState(uid), L = this.layoutOf(h.u), occ = CFG.homeOccupancy(h), why = CFG.canPlace(occ, L.items, it, h.u.lv);
    if (why) throw conflict(why, 'cant_place');
    const b = CFG.BUILDINGS.find(x => x.id === it.type); this.addGold(uid, -b.price, 'build:' + b.id);
    const item = Object.assign({ id: ++L.seq }, it, { at: this.now() }, b.kind === 'wonder' ? { stage: 0 } : {}); L.items.push(item); this.saveLayout(uid, L); return { item, name: b.name, cost: b.price };
  },
  /* 移动 / 旋转已经建好的建筑（免费） */
  async homeMove(uid, id, to) {
    const h = await this.homeState(uid), L = this.layoutOf(h.u), it = L.items.find(x => x.id === (id | 0)); if (!it) throw notFound('没有这个建筑');
    const nx = { type: it.type, gx: to.gx | 0, gz: to.gz | 0, rot: ((to.rot | 0) % 4 + 4) % 4 }, others = L.items.filter(x => x !== it);
    const why = CFG.canPlace(CFG.homeOccupancy(h), others, nx, undefined, true); if (why) throw conflict(why, 'cant_place');
    Object.assign(it, { gx: nx.gx, gz: nx.gz, rot: nx.rot }); this.saveLayout(uid, L); return { item: it };
  },
  /* 第 1 期：奇观建造下一阶段（扣金币 + 仓库里的作物，永久增产） */
  async homeWonder(uid, id) {
    const u = await this.user(uid), L = this.layoutOf(u), it = L.items.find(x => x.id === (id | 0)); if (!it) throw notFound('没有这个建筑');
    const w = CFG.wonderDef(it.type); if (!w) throw bad('这不是奇观'); const k = it.stage | 0, s = w.stages[k]; if (!s) throw conflict(w.name + '已经全部建成', 'done');
    if (u.lv < s.lv) throw conflict(`${s.name}需要 Lv.${s.lv}`, 'locked');
    this.addGold(uid, -s.gold, 'wonder:' + w.id + ':' + (k + 1)); Object.entries(s.items).forEach(([item, n]) => this.addInv(uid, item, -n));
    it.stage = k + 1; this.saveLayout(uid, L); this.metric('wonder_stage');
    return { item: it, stage: it.stage, name: s.name, wonder: w.name, done: it.stage >= w.stages.length, bonus: CFG.wonderBonus(L.items) };
  },
  async homeRemove(uid, id) {
    const u = await this.user(uid), L = this.layoutOf(u), i = L.items.findIndex(x => x.id === (id | 0)); if (i < 0) throw notFound('没有这个建筑');
    if ((L.items[i].stage | 0) > 0) throw conflict('奇观已经开工，不能拆除（可以移动）', 'wonder');
    const it = L.items.splice(i, 1)[0], b = CFG.BUILDINGS.find(x => x.id === it.type), refund = b ? Math.floor(b.price * 0.5) : 0;
    if (refund) this.addGold(uid, refund, 'unbuild:' + it.type); this.saveLayout(uid, L); return { id: it.id, refund, name: b ? b.name : it.type };
  },
  /* 扩建牧场 / 鱼塘、开辟新菜地后，被新占用的格子上的建筑自动收回并全额退款（不会出现建筑和菜地叠在一起） */
  async homeEvict(uid) {
    const h = await this.homeState(uid), L = this.layoutOf(h.u); if (!L.items.length) return 0;
    const occ = CFG.homeOccupancy(h), keep = [], gone = [];
    L.items.forEach(it => { const fp = CFG.footprint(it); (!fp || fp.some(([i, j]) => i < 0 || j < 0 || i >= occ.W || j >= occ.H || occ.cells[j * occ.W + i]) ? gone : keep).push(it); });
    if (!gone.length) return 0;
    gone.forEach(it => { const b = CFG.BUILDINGS.find(x => x.id === it.type); if (b && b.price) this.addGold(uid, b.price, 'evict:' + it.type);
      const w = CFG.wonderDef(it.type); if (w) w.stages.slice(0, it.stage | 0).forEach(s => { this.addGold(uid, s.gold, 'evict:' + it.type); Object.entries(s.items).forEach(([k, n]) => this.addInv(uid, k, n)); }); }); /* 奇观：退回已经投入的全部金币和作物 */
    L.items = keep; this.saveLayout(uid, L); return gone.length;
  },
};

});

__def("server/domains/quest.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：签到、每日 / 每周任务、成就、订单
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

module.exports = {
  claim(uid, key) { this.db.wx(conflict('已经领取过了', 'claimed'), 'INSERT INTO claims (user_id,key,at) VALUES (?,?,?)', uid, key, this.now()); },
  async checkin(uid, out) {
    const u = await this.user(uid), now = this.now(), today = CFG.dayKey(now), yest = CFG.dayKey(CFG.dayStart(now) - 3600000);
    if (u.checkin_last === today) throw conflict('今天已经签到了', 'claimed'); this.claim(uid, 'checkin:' + today);
    const streak = u.checkin_last === yest ? u.checkin_streak + 1 : 1, n = ((streak - 1) % 7) + 1, g = 100 * n;
    this.db.w('UPDATE users SET checkin_last=?, checkin_streak=? WHERE id=?', today, streak, uid); this.pu(uid, x => { x.checkin_last = today; x.checkin_streak = streak; }); this.addGold(uid, g, 'checkin');
    // 回归奖励：超过 3 天未登录后签到
    let back = 0; if (u.checkin_last && today > u.checkin_last && now - u.last_active > 3 * 86400000) { back = 500; this.addGold(uid, back, 'comeback'); }
    if (n % 3 === 0) this.addInv(uid, 'fert', 2); if (n === 7) this.addInv(uid, 'dogfood', 2);
    return { day: n, gold: g, streak, back };
  },
  async tasks(uid) {
    const day = this.period('day'), wk = this.period('week');
    const [rows, C] = await all([this.db.all('SELECT key FROM claims WHERE user_id=?', uid), this.counters(uid)]); const claimed = new Set(rows.map(r => r.key));
    return {
      day: CFG.dayKey(this.now()), weekEnd: CFG.weekEnd(this.now()),
      daily: CFG.TASKS.map(t => ({ id: t.id, prog: C(t.id, day), need: t.need, claimed: claimed.has('task:' + day + ':' + t.id) })),
      weekly: CFG.WEEKLY.map(t => ({ id: t.id, prog: C(t.stat, wk), need: t.need, claimed: claimed.has('weekly:' + wk + ':' + t.id) })),
      newbie: CFG.NEWBIE.map(t => ({ id: t.id, prog: C(t.stat, 'all'), need: t.need, claimed: claimed.has('newbie:' + t.id) })),
    };
  },
  async claimTask(uid, kind, id, out) {
    let t, key, prog;
    if (kind === 'daily') { t = CFG.TASKS.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'task:' + this.period('day') + ':' + id; prog = await this.cnt(uid, t.id, 'day'); }
    else if (kind === 'weekly') { t = CFG.WEEKLY.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'weekly:' + this.period('week') + ':' + id; prog = await this.cnt(uid, t.stat, 'week'); }
    else if (kind === 'newbie') { t = CFG.NEWBIE.find(x => x.id === id); if (!t) throw bad('任务不存在'); key = 'newbie:' + id; prog = await this.cnt(uid, t.stat, 'all'); }
    else throw bad('任务类型不对');
    if (prog < t.need) throw conflict('任务还没完成', 'not_done'); this.claim(uid, key);
    this.addGold(uid, t.gold, 'task'); if (t.exp) await this.addExp(uid, t.exp, out); return { gold: t.gold, exp: t.exp || 0 };
  },
  async achCounts(uid) { const [f, c] = await all([this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', uid), this.db.get('SELECT COUNT(*) n FROM codex WHERE user_id=?', uid)]); return { friends: f.n, codex: c.n }; },
  achStatsOf(u, k) { return { harvest_total: u.harvest_total, steal_total: u.steal_total, help_total: u.help_total, golden_total: u.golden_total, order_total: u.order_total, lv: u.lv, checkin_streak: u.checkin_streak, friends: k.friends, codex: k.codex }; },
  async achStats(u) { return this.achStatsOf(u, await this.achCounts(u.id)); },
  async achievements(uid) { const [u, rows] = await all([this.user(uid), this.db.all("SELECT key FROM claims WHERE user_id=? AND key LIKE 'ach:%'", uid)]); const st = await this.achStats(u), claimed = new Set(rows.map(r => r.key)); return CFG.ACHIEVEMENTS.map(a => ({ id: a.id, prog: st[a.stat], need: a.need, claimed: claimed.has('ach:' + a.id) })); },
  async claimAch(uid, id) {
    const a = CFG.ACHIEVEMENTS.find(x => x.id === id); if (!a) throw bad('成就不存在'); const st = await this.achStats(await this.user(uid)); if (st[a.stat] < a.need) throw conflict('成就还没达成', 'not_done');
    this.claim(uid, 'ach:' + id); this.addGold(uid, a.gold, 'ach');
    CFG.FRAMES.filter(f => f.ach === id).forEach(f => this.db.w('INSERT OR IGNORE INTO cosmetics (user_id,item,at) VALUES (?,?,?)', uid, 'frame:' + f.id, this.now()));
    return { gold: a.gold, title: a.title || '' };
  },

  /* ---------- 订单（NPC） ---------- */
  async orders(uid) {
    const day = CFG.dayKey(this.now());
    let [u, rows, inv, refreshed] = await all([this.user(uid), this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day), this.inv(uid), this.cnt(uid, 'order_refresh', 'day')]);
    // 订单位随等级增加（Lv.10/20/30 各多一个）：缺哪个补哪个，升级当天也能马上拿到新订单
    const slots = CFG.orderSlots(u.lv), have = new Set(rows.map(r => r.slot)); let added = false;
    for (let s = 0; s < slots; s++) if (!have.has(s)) { this.genOrder(uid, u, day, s); added = true; }
    if (added) rows = await this.db.all('SELECT * FROM orders WHERE user_id=? AND day=? ORDER BY slot', uid, day);
    return { day, slots, refreshLeft: Math.max(0, RULES.orderRefresh - refreshed), refreshCost: RULES.orderRefreshCost, list: rows.map(r => ({ slot: r.slot, item: r.item, qty: r.qty, gold: r.gold, exp: r.exp, done: !!r.done, have: inv[r.item] || 0 })) };
  },
  genOrder(uid, u, day, slot) {
    const pool = CROPS.filter(c => c.lv <= Math.max(1, u.lv)); const cr = pool[U.randInt(Math.max(0, pool.length - 6), pool.length - 1)];
    const qty = Math.max(5, Math.round(cr.yield * (0.5 + U.rand() * 1.0))), gold = Math.round(qty * cr.price * (1.5 + U.rand() * 0.4)), exp = Math.round(cr.exp * qty / cr.yield * 0.8) + 10;
    this.db.w('INSERT OR REPLACE INTO orders (user_id,day,slot,item,qty,gold,exp,done) VALUES (?,?,?,?,?,?,?,0)', uid, day, slot, 'c' + cr.id, qty, gold, exp);
  },
  async deliver(uid, slot, out) {
    const day = CFG.dayKey(this.now()); const o = await this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot); if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    this.addInv(uid, o.item, -o.qty); this.db.w('UPDATE orders SET done=1 WHERE user_id=? AND day=? AND slot=?', uid, day, slot);
    this.addGold(uid, o.gold, 'order'); await this.addExp(uid, o.exp, out); this.db.w('UPDATE users SET order_total=order_total+1 WHERE id=?', uid); this.pu(uid, x => x.order_total++); this.bump(uid, 'order'); this.metric('orders_done'); return { gold: o.gold, exp: o.exp };
  },
  async refreshOrder(uid, slot) {
    const day = CFG.dayKey(this.now());
    const [o, n, u] = await all([this.db.get('SELECT * FROM orders WHERE user_id=? AND day=? AND slot=?', uid, day, slot), this.cnt(uid, 'order_refresh', 'day'), this.user(uid)]);
    if (!o) throw notFound('订单不存在'); if (o.done) throw conflict('订单已完成', 'claimed');
    if (n >= RULES.orderRefresh) throw conflict('今天的刷新次数用完了', 'limit'); this.addGold(uid, -RULES.orderRefreshCost, 'order_refresh'); this.bump(uid, 'order_refresh', 1, 'day'); this.genOrder(uid, u, day, slot); return {};
  },

  /* ---------- 好友 ---------- */
};

});

__def("server/domains/social.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：好友、附近的人、串门、偷菜、帮忙、留言板、消息
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

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

});

__def("server/domains/economy.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：集市、排行榜、赛季
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

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

});

__def("server/domains/hunt.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：第 2 期 名山猎场（温和狩猎）
   - 进山：每天 HUNT.trips 次；服务器给一个随机种子，前后端用 CFG.huntSpawns(种子, 等级) 算出一样的起点和野兽位置
   - 下山：前端报告捕获了哪几只（序号）。服务器校验：本次进山真有这只、没重复、所用时间够把它们打晕（按拥有的最强武器算最快速度）
   - 奖励：金币、经验、材料（hm + 序号，进仓库，可以出售）；带着吃饱的福旺进山，金币多 20%；体力耗尽被送回家，收获减半
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

const SPAWN_CACHE = new Map(); /* 同一个种子 + 等级只算一次（进山、下山各要用一次） */
function spawnsOf(seed, lv) { const k = seed + ':' + lv; let s = SPAWN_CACHE.get(k); if (!s) { s = CFG.huntSpawns(seed, lv); SPAWN_CACHE.set(k, s); if (SPAWN_CACHE.size > 64) SPAWN_CACHE.delete(SPAWN_CACHE.keys().next().value); } return s; }
const zoneOf = () => CFG.ZONES.find(z => z.id === CFG.HUNT.zone) || { unlockLv: 1 };

module.exports = {
  huntOf(u) { let H = {}; try { H = JSON.parse(u.hunt || '{}') || {}; } catch (e) { H = {}; } if (!Array.isArray(H.weapons)) H.weapons = []; CFG.HUNT.weapons.forEach(w => { if (!w.price && !H.weapons.includes(w.id)) H.weapons.push(w.id); }); H.trips = H.trips | 0; return H; },
  saveHunt(uid, H) { const s = JSON.stringify(H); this.db.w('UPDATE users SET hunt=? WHERE id=?', s, uid); this.pu(uid, x => x.hunt = s); },
  huntDay(H) { const d = CFG.dayKey(this.now()); if (H.day !== d) { H.day = d; H.trips = 0; } return H; },
  huntDog(u) { const d = this.dogsOf(u).find(x => x.id === 'fuwang'); return !!(d && d.own && d.fed); },
  async huntInfo(uid) {
    const u = await this.user(uid), H = this.huntDay(this.huntOf(u)), z = zoneOf();
    return { unlockLv: z.unlockLv, unlocked: u.lv >= z.unlockLv, weapons: H.weapons, tripsLeft: Math.max(0, CFG.HUNT.trips - H.trips), trips: CFG.HUNT.trips, dog: this.huntDog(u), total: H.total || {} };
  },
  async huntStart(uid) {
    const u = await this.user(uid), H = this.huntDay(this.huntOf(u)), z = zoneOf();
    if (u.lv < z.unlockLv) throw conflict(`${z.name}需要 Lv.${z.unlockLv}`, 'locked');
    if (H.trips >= CFG.HUNT.trips) throw conflict(`今天已经进山 ${CFG.HUNT.trips} 次了，明天再来吧`, 'limit');
    const seed = U.randInt(1, 2147483646), sp = spawnsOf(seed, u.lv);
    H.sess = { sid: U.randToken(9), seed, lv: u.lv, at: this.now() }; H.trips++; this.saveHunt(uid, H); this.metric('hunt_trips');
    return { sid: H.sess.sid, seed, lv: u.lv, start: sp.start, list: sp.list, weapons: H.weapons, tripsLeft: CFG.HUNT.trips - H.trips, dog: this.huntDog(u), tripSec: CFG.HUNT.tripSec, heroHp: CFG.HUNT.heroHp };
  },
  async huntEnd(uid, b, out) {
    const u = await this.user(uid), H = this.huntOf(u), S = H.sess; if (!S || S.sid !== String(b.sid || '')) throw conflict('这次进山已经结束了', 'no_session');
    const sp = spawnsOf(S.seed, S.lv), elapsed = (this.now() - S.at) / 1000, ids = [...new Set((Array.isArray(b.caught) ? b.caught : []).map(x => x | 0))];
    const best = CFG.HUNT.weapons.filter(w => H.weapons.includes(w.id)).reduce((a, w) => (w.dmg / w.cd > a.dmg / a.cd ? w : a), { dmg: 1, cd: 1 });
    let need = 0; const got = [];
    for (const i of ids) { const s = sp.list[i]; if (!s) throw bad('没有这只野兽'); const c = CFG.HUNT.creatures.find(x => x.id === s.id); need += Math.ceil(c.hp / best.dmg) * best.cd; got.push(c); }
    if (got.length && elapsed + 3 < need * 0.8) throw bad('捕获得太快了，请重新进山'); /* 防作弊：比最强武器的最快速度还快 */
    const faint = !!b.faint, dog = this.huntDog(u), k = faint ? 0.5 : 1; let gold = 0, exp = 0; const items = {}, by = {};
    got.forEach(c => { gold += c.reward.gold; exp += c.reward.exp; Object.entries(c.reward.items || {}).forEach(([it, n]) => { items[it] = (items[it] || 0) + n; }); by[c.id] = (by[c.id] || 0) + 1; });
    gold = Math.round(gold * k * (dog ? 1 + CFG.HUNT.dogGoldBonus : 1)); exp = Math.round(exp * k); Object.keys(items).forEach(it => { items[it] = Math.max(faint ? 0 : 1, Math.floor(items[it] * k)); if (!items[it]) delete items[it]; });
    if (gold) this.addGold(uid, gold, 'hunt'); Object.entries(items).forEach(([it, n]) => { this.addInv(uid, it, n); this.codex(uid, it, n); });
    if (exp) await this.addExp(uid, exp, out, u);
    H.total = H.total || {}; Object.entries(by).forEach(([id, n]) => { H.total[id] = (H.total[id] || 0) + n; }); H.sess = null; this.saveHunt(uid, H);
    if (got.length) { this.bump(uid, 'hunt', got.length); this.metric('hunt_catch', got.length); }
    return { caught: by, n: got.length, gold, exp, items, faint, dog, seconds: Math.round(elapsed) };
  },
  async huntBuy(uid, id) {
    const u = await this.user(uid), H = this.huntOf(u), w = CFG.HUNT.weapons.find(x => x.id === String(id || '')); if (!w) throw bad('没有这种武器');
    if (H.weapons.includes(w.id)) throw conflict(`已经有${w.name}了`, 'done'); if (u.lv < w.lv) throw conflict(`${w.name}需要 Lv.${w.lv}`, 'locked');
    this.addGold(uid, -w.price, 'weapon:' + w.id); H.weapons.push(w.id); this.saveHunt(uid, H); return { weapon: w.id, name: w.name, cost: w.price };
  },
};

});

__def("server/domains/lake.js", function (module, exports, __req) {
'use strict';
/* 丰收农场 · 服务端玩法模块：镜湖钓场（方案 C 第一个新场景）
   - 进场：每天 LAKE.trips 次；服务器给一个随机种子，前后端用 CFG.lakeBites(种子, 等级, 鱼竿) 算出一样的「咬钩序列」
   - 前端按顺序一次一次地钓：抛竿 → 等咬钩 → 提竿 → 收线；没钓上也算用掉一次咬钩
   - 收竿回家：前端报告用掉了几次咬钩（used）、钓上了哪几次（caught 序号）。服务器校验：序号在用掉的范围里、不重复、
     用掉的次数 × minBiteSec 不超过实际用时（咬钩是一次接一次的，不可能更快）
   - 奖励：鱼进仓库（就是鱼塘的鱼，fs + 序号，可以出售），大鱼多一条；经验；每种鱼的最长纪录
   方法挂在 Game.prototype 上（见 server/game.js），this 就是 Game 实例 */
const { CFG, U, bad, conflict } = __req("server/domains/common.js");

const BITE_CACHE = new Map();
function bitesOf(seed, lv, rod) { const k = seed + ':' + lv + ':' + rod; let s = BITE_CACHE.get(k); if (!s) { s = CFG.lakeBites(seed, lv, rod); BITE_CACHE.set(k, s); if (BITE_CACHE.size > 64) BITE_CACHE.delete(BITE_CACHE.keys().next().value); } return s; }
const zoneOf = () => CFG.ZONES.find(z => z.id === CFG.LAKE.zone) || { unlockLv: 1, name: '镜湖钓场' };
const FISH = id => CFG.FISH.find(f => f.id === id);

module.exports = {
  lakeOf(u) { let L = {}; try { L = JSON.parse(u.lake || '{}') || {}; } catch (e) { L = {}; } if (!Array.isArray(L.rods)) L.rods = []; CFG.LAKE.rods.forEach(r => { if (!r.price && !L.rods.includes(r.id)) L.rods.push(r.id); }); L.trips = L.trips | 0; L.total = L.total || {}; L.best = L.best || {}; return L; },
  saveLake(uid, L) { const s = JSON.stringify(L); this.db.w('UPDATE users SET lake=? WHERE id=?', s, uid); this.pu(uid, x => x.lake = s); },
  lakeDay(L) { const d = CFG.dayKey(this.now()); if (L.day !== d) { L.day = d; L.trips = 0; } return L; },
  bestRod(L) { return CFG.LAKE.rods.filter(r => L.rods.includes(r.id)).reduce((a, r) => (r.power > a.power ? r : a), CFG.LAKE.rods[0]); },
  async lakeInfo(uid) {
    const u = await this.user(uid), L = this.lakeDay(this.lakeOf(u)), z = zoneOf();
    return { unlockLv: z.unlockLv, unlocked: u.lv >= z.unlockLv, rods: L.rods, rod: this.bestRod(L).id, tripsLeft: Math.max(0, CFG.LAKE.trips - L.trips), trips: CFG.LAKE.trips, total: L.total, best: L.best };
  },
  async lakeStart(uid) {
    const u = await this.user(uid), L = this.lakeDay(this.lakeOf(u)), z = zoneOf();
    if (u.lv < z.unlockLv) throw conflict(`${z.name}需要 Lv.${z.unlockLv}`, 'locked');
    if (L.trips >= CFG.LAKE.trips) throw conflict(`今天已经来钓了 ${CFG.LAKE.trips} 次了，明天再来吧`, 'limit');
    const rod = this.bestRod(L), seed = U.randInt(1, 2147483646);
    L.sess = { sid: U.randToken(9), seed, lv: u.lv, rod: rod.id, at: this.now() }; L.trips++; this.saveLake(uid, L); this.metric('lake_trips');
    return { sid: L.sess.sid, seed, lv: u.lv, rod: rod.id, bites: bitesOf(seed, u.lv, rod.id), tripsLeft: CFG.LAKE.trips - L.trips, tripSec: CFG.LAKE.tripSec, best: L.best };
  },
  async lakeEnd(uid, b, out) {
    const u = await this.user(uid), L = this.lakeOf(u), S = L.sess; if (!S || S.sid !== String(b.sid || '')) throw conflict('这次钓鱼已经结束了', 'no_session');
    const list = bitesOf(S.seed, S.lv, S.rod), elapsed = (this.now() - S.at) / 1000, ids = [...new Set((Array.isArray(b.caught) ? b.caught : []).map(x => x | 0))].sort((a, c) => a - c);
    const used = Math.max(ids.length ? ids[ids.length - 1] + 1 : 0, Math.min(list.length, b.used | 0));
    if (ids.some(i => i < 0 || i >= list.length)) throw bad('没有这次咬钩');
    if (used * CFG.LAKE.minBiteSec * 0.8 > elapsed + 3) throw bad('钓得太快了，请重新来'); /* 防作弊：咬钩是一次接一次的 */
    let exp = 0; const items = {}, by = {}, records = [];
    for (const i of ids) { const x = list[i], f = FISH(x.f), lf = CFG.LAKE.fish.find(y => y.fish === x.f) || {}; const n = x.big ? 2 : 1, it = 'fs' + x.f;
      items[it] = (items[it] || 0) + n; exp += (f ? f.exp : 0) + (lf.exp || 0); by[x.f] = (by[x.f] || 0) + 1;
      if (!L.best[x.f] || x.cm > L.best[x.f]) { L.best[x.f] = x.cm; records.push({ f: x.f, cm: x.cm }); } }
    Object.entries(items).forEach(([it, n]) => { this.addInv(uid, it, n); this.codex(uid, it, n); });
    if (exp) await this.addExp(uid, exp, out, u);
    Object.entries(by).forEach(([f, n]) => { L.total[f] = (L.total[f] || 0) + n; }); L.sess = null; this.saveLake(uid, L);
    if (ids.length) { this.bump(uid, 'lake', ids.length); this.metric('lake_catch', ids.length); }
    return { caught: by, n: ids.length, used, exp, items, records, seconds: Math.round(elapsed) };
  },
  async lakeBuy(uid, id) {
    const u = await this.user(uid), L = this.lakeOf(u), r = CFG.LAKE.rods.find(x => x.id === String(id || '')); if (!r) throw bad('没有这种鱼竿');
    if (L.rods.includes(r.id)) throw conflict(`已经有${r.name}了`, 'done'); if (u.lv < r.lv) throw conflict(`${r.name}需要 Lv.${r.lv}`, 'locked');
    this.addGold(uid, -r.price, 'rod:' + r.id); L.rods.push(r.id); this.saveLake(uid, L); return { rod: r.id, name: r.name, cost: r.price };
  },
};

});

__def("server/game.js", function (module, exports, __req) {
'use strict';
/* =====================================================
   丰收农场 · 服务端权威游戏逻辑（异步）
   - 所有写操作都在 db.tx() 中执行，保证原子性；遇到并发写冲突整体重试
   - 数据库可能在远端（Turso）：互不依赖的读取用 Promise.all 合并成一次请求，
     不需要结果的写入用 db.w() 延迟到下一次读取 / 提交时一起发出
   - 可能失败的写入（扣金币、扣库存、领奖去重）用 db.wx(错误, ...)：约束不满足时抛出对应提示
   - V0.4 起按玩法拆分：这里只留核心（配置覆盖、活动、事务缓存、玩家 / 土地 / 背包 / 金币 / 经验 / 计数器 / 消息 / 可见性、概况）；
     各玩法的方法在 server/domains/*.js，挂到 Game.prototype 上，调用方式不变
   ===================================================== */
const { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all } = __req("server/domains/common.js"); // eslint-disable-line no-unused-vars

class Game {
  constructor(db, opts) {
    this.db = db; this.clockOffset = 0; this.opts = opts || {};
    this._ev = { at: -1e15, list: [] }; this._cfgAt = -1e15;
  }
  now() { return Date.now() + this.clockOffset; }

  /* ---------- 配置覆盖（运营后台可改作物数值与规则）：多实例部署时每分钟重新读取 ---------- */
  async applyConfigOverrides() {
    if (!this._base) this._base = { crops: CROPS.map(c => ({ seed: c.seed, time: c.time, yield: c.yield, price: c.price, exp: c.exp, lv: c.lv })), rules: Object.assign({}, RULES) };
    const [cr, rr] = await all([this.db.get("SELECT value FROM config WHERE key='crops'"), this.db.get("SELECT value FROM config WHERE key='rules'")]);
    CROPS.forEach((c, i) => Object.assign(c, this._base.crops[i])); Object.assign(RULES, this._base.rules);
    const co = J((cr || {}).value) || {};
    Object.keys(co).forEach(id => { const c = CROPS[+id]; if (!c) return; ['seed', 'time', 'yield', 'price', 'exp', 'lv'].forEach(k => { const v = Number(co[id][k]); if (Number.isFinite(v) && v > 0) c[k] = Math.round(v); }); });
    const ro = J((rr || {}).value) || {};
    Object.keys(ro).forEach(k => { if (k in RULES && typeof RULES[k] === 'number' && Number.isFinite(Number(ro[k]))) RULES[k] = Number(ro[k]); });
    this._cfgAt = Date.now();
  }
  async refreshConfig() { if (Date.now() - this._cfgAt > 60000) await this.applyConfigOverrides(); }
  publicConfig() { return { CROPS, RULES, TZ_MIN: this.opts.tzMin || 480 }; }

  /* ---------- 活动（缓存 15 秒） ---------- */
  invalidateEvents() { this._ev.at = -1e15; }
  async activeEvents() {
    const now = this.now();
    if (Date.now() - this._ev.at > 15000) { this._ev = { at: Date.now(), list: (await this.db.all('SELECT id,name,kind,params,start_at,end_at,descr FROM events WHERE enabled=1 ORDER BY id')).map(e => Object.assign(e, { params: J(e.params) || {} })) }; }
    return this._ev.list.filter(e => e.start_at <= now && e.end_at > now).map(e => Object.assign({}, e)).concat(CFG.festivalsAt(now)); /* 第 1 期：节日自动成为限时活动 */
  }
  async evMult(kind, cropId) { let m = 1; (await this.activeEvents()).forEach(e => { if (e.kind === kind && (e.params.crop === undefined || e.params.crop === null || e.params.crop === '' || +e.params.crop === cropId)) m *= Number(e.params.mult) || 1; }); return m; }
  async unitPrice(item) { const ri = CFG.ranchItem(item); if (ri) return ri.price; const c = cropOfItem(item); if (!c) return 0; const b = CFG.dayBonus(this.now())[c.id] || 0; return Math.round(CROPS[c.id].price * (1 + b) * (c.golden ? RULES.goldenPriceMult : 1) * await this.evMult('price_mult', c.id)); }

  /* ---------- 基础读写 ---------- */
  /* 事务内缓存：同一次操作里读过的数据直接复用，写入时同步更新（远端数据库时大幅减少往返） */
  C() { return this.db.cache(); }
  pu(uid, f) { const C = this.C(); if (C && C.u[uid]) f(C.u[uid]); }
  // 登录校验时顺带读回的数据，直接放进本次事务的缓存
  seed(uid, user, plots, inv, cnts) {
    const C = this.C(); if (!C) return;
    if (user && !C.u[uid]) C.u[uid] = Object.assign({}, user);
    if (plots && !C.plots[uid]) C.plots[uid] = plots.map(r => this.rowToPlot(r));
    if (inv && !C.inv[uid]) { const o = {}; inv.forEach(r => o[r.item] = r.qty); C.inv[uid] = o; }
    if (cnts && !C.cnt[uid]) { const m = {}; cnts.forEach(r => m[r.period + '|' + r.key] = r.val); C.cnt[uid] = { ps: [this.period('day'), this.period('week'), 'all'], m }; }
  }
  forget(uid) { const C = this.C(); if (C) { delete C.u[uid]; delete C.plots[uid]; delete C.inv[uid]; } }
  async user(uid) {
    const C = this.C(); if (C && C.u[uid]) return Object.assign({}, C.u[uid]);
    const u = await this.db.get('SELECT * FROM users WHERE id=?', uid); if (!u) throw notFound('玩家不存在');
    if (C) C.u[uid] = Object.assign({}, u); return u;
  }
  publicUser(u) { return { id: u.id, code: u.code, name: u.name, lv: u.lv, avatar: J(u.avatar) || {}, title: u.title, theme: u.theme, frame: u.frame }; }
  me(u) {
    return Object.assign(this.publicUser(u), {
      gold: u.gold, exp: u.exp, expNeed: CFG.expNeed(u.lv), seed: u.seed, username: u.username || '', guest: !u.username, role: u.role, migrated: !!u.migrated,
      dog: { own: !!u.dog_own, lv: u.dog_lv, exp: u.dog_exp, need: CFG.dogExpNeed(u.dog_lv), until: u.dog_until },
      dogs: this.dogsOf(u), pets: this.petsOf(u), ranch: this.ranchView(u), layout: this.layoutOf(u).items,
      checkin: { last: u.checkin_last, streak: u.checkin_streak }, settings: J(u.settings) || {}, created_at: u.created_at,
      stats: { harvest: u.harvest_total, steal: u.steal_total, help: u.help_total, plant: u.plant_total, earned: u.earned_total, golden: u.golden_total, order: u.order_total, stolenFrom: u.stolen_from_total },
    });
  }
  rowToPlot(r) { return { idx: r.idx, u: r.u, soil: r.soil, c: r.c, p: r.p, t: r.t, sea: r.sea, y: r.y, y0: r.y0, stolen: r.stolen, pr: J(r.pr) || { d: 0, w: 0, b: 0 }, ev: J(r.ev) || [], ra: r.ra, cycle: r.cycle }; }
  async plots(uid) {
    const C = this.C(), now = this.now();
    if (C && C.plots[uid]) return C.plots[uid].map(P => CFG.advancePlot(structuredClone(P), now));
    const list = (await this.db.all('SELECT * FROM plots WHERE user_id=? ORDER BY idx', uid)).map(r => this.rowToPlot(r));
    if (C) C.plots[uid] = list.map(P => structuredClone(P));
    return list.map(P => CFG.advancePlot(P, now));
  }
  async plot(uid, idx) { const P = (await this.plots(uid)).find(x => x.idx === idx); if (!P) throw bad('土地不存在'); return P; }
  savePlot(uid, P) {
    const C = this.C(); if (C && C.plots[uid]) { const i = C.plots[uid].findIndex(x => x.idx === P.idx); if (i >= 0) C.plots[uid][i] = structuredClone(P); }
    this.db.w('UPDATE plots SET u=?,soil=?,c=?,p=?,t=?,sea=?,y=?,y0=?,stolen=?,pr=?,ev=?,ra=?,cycle=? WHERE user_id=? AND idx=?',
      P.u, P.soil, P.c, P.p, P.t, P.sea, P.y, P.y0, P.stolen, JSON.stringify(P.pr), JSON.stringify(P.ev || []), P.ra || 0, P.cycle, uid, P.idx);
  }
  pubPlot(P) { return { idx: P.idx, u: P.u, soil: P.soil, c: P.c, p: P.p, t: P.t, sea: P.sea, y: P.y, y0: P.y0, stolen: P.stolen, pr: P.pr, ra: P.ra || 0 }; }
  async inv(uid) {
    const C = this.C(); if (C && C.inv[uid]) { const o = {}; Object.entries(C.inv[uid]).forEach(([k, v]) => { if (v > 0) o[k] = v; }); return o; }
    const o = {}; (await this.db.all('SELECT item,qty FROM inventory WHERE user_id=?', uid)).forEach(r => o[r.item] = r.qty);
    if (C) C.inv[uid] = Object.assign({}, o);
    Object.keys(o).forEach(k => { if (!(o[k] > 0)) delete o[k]; }); return o;
  }
  async invQty(uid, item) { return (await this.inv(uid))[item] || 0; }
  addInv(uid, item, n) {
    if (!n) return;
    const C = this.C(), ci = C && C.inv[uid];
    if (ci) { if ((ci[item] || 0) + n < 0) throw conflict(itemName(item) + '数量不足', 'not_enough'); ci[item] = (ci[item] || 0) + n; }
    if (n < 0) {
      const err = conflict(itemName(item) + '数量不足', 'not_enough');
      // 没有这一行时插入 -1 触发 CHECK；有这一行时减到负数触发 CHECK：两种情况都会抛出 err
      this.db.wx(err, 'INSERT INTO inventory (user_id,item,qty) SELECT ?,?,-1 WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE user_id=? AND item=?)', uid, item, uid, item);
      this.db.wx(err, 'UPDATE inventory SET qty=qty+? WHERE user_id=? AND item=?', n, uid, item);
      return;
    }
    this.db.w('INSERT INTO inventory (user_id,item,qty) VALUES (?,?,?) ON CONFLICT(user_id,item) DO UPDATE SET qty=qty+excluded.qty', uid, item, n);
  }
  addGold(uid, n, reason) {
    n = Math.round(n); if (!n) return;
    const C = this.C(), cu = C && C.u[uid];
    if (cu) { if (cu.gold + n < 0) throw conflict('金币不足', 'no_gold'); cu.gold += n; if (n > 0) cu.earned_total += n; }
    if (n < 0) this.db.wx(conflict('金币不足', 'no_gold'), 'UPDATE users SET gold=gold+? WHERE id=?', n, uid);
    else this.db.w('UPDATE users SET gold=gold+?, earned_total=earned_total+? WHERE id=?', n, n, uid);
    this.db.w('INSERT INTO ledger (user_id,delta,reason,at) VALUES (?,?,?,?)', uid, n, reason, this.now());
  }
  async addExp(uid, n, out, u0) { // u0：本次操作里刚读到、经验和等级还没变过的玩家数据（省一次读取）
    const [m, u] = await all([this.evMult('exp_mult'), u0 || this.user(uid)]);
    n = Math.round(n * m); if (n <= 0) return 0;
    this.bump(uid, 'sp', n, 'week');
    if (u.lv >= RULES.maxLv) return 0;
    let lv = u.lv, exp = u.exp + n; const ups = [];
    while (lv < RULES.maxLv && exp >= CFG.expNeed(lv)) { exp -= CFG.expNeed(lv); lv++; ups.push(lv); }
    if (lv >= RULES.maxLv) exp = 0;
    this.db.w('UPDATE users SET exp=?, lv=? WHERE id=?', exp, lv, uid); this.pu(uid, x => { x.exp = exp; x.lv = lv; });
    ups.forEach(l => { this.addGold(uid, l * 120, 'levelup'); this.addInv(uid, 'fert', 1); });
    if (out && ups.length) out.levelUp = (out.levelUp || []).concat(ups);
    return n;
  }
  // 计数器：day / week / all
  period(kind) { const now = this.now(); return kind === 'day' ? 'd' + CFG.dayKey(now) : kind === 'week' ? CFG.weekKey(now) : 'all'; }
  bump(uid, key, n, only) {
    n = n || 1; const ps = only ? [this.period(only)] : [this.period('day'), this.period('week'), 'all'];
    const C = this.C(), cc = C && C.cnt[uid];
    ps.forEach(p => { this.db.w('INSERT INTO counters (user_id,period,key,val) VALUES (?,?,?,?) ON CONFLICT(user_id,period,key) DO UPDATE SET val=val+excluded.val', uid, p, key, n); if (cc && cc.ps.includes(p)) cc.m[p + '|' + key] = (cc.m[p + '|' + key] || 0) + n; });
  }
  async cnt(uid, key, kind) {
    const p = kind === 'day' || kind === 'week' ? this.period(kind) : kind, C = this.C();
    if (C && (C.cnt[uid] || p === this.period('day') || p === this.period('week') || p === 'all')) { const cc = await this.cntLoad(uid); if (cc.ps.includes(p)) return cc.m[p + '|' + key] || 0; }
    return (await this.db.get('SELECT val FROM counters WHERE user_id=? AND period=? AND key=?', uid, p, key) || { val: 0 }).val;
  }
  async cntLoad(uid) {
    const C = this.C(); if (C && C.cnt[uid]) return C.cnt[uid];
    const d = this.period('day'), w = this.period('week'), m = {};
    (await this.db.all("SELECT period,key,val FROM counters WHERE user_id=? AND period IN (?,?,'all')", uid, d, w)).forEach(r => m[r.period + '|' + r.key] = r.val);
    const cc = { ps: [d, w, 'all'], m }; if (C) C.cnt[uid] = cc; return cc;
  }
  // 一次取出今天 / 本周 / 累计的全部计数器
  async counters(uid) { const cc = await this.cntLoad(uid); const m = Object.assign({}, cc.m); return (key, p) => m[p + '|' + key] || 0; }
  metric(key, n) { this.db.w('INSERT INTO metrics (day,key,val) VALUES (?,?,?) ON CONFLICT(day,key) DO UPDATE SET val=val+excluded.val', CFG.dayKey(this.now()), key, n || 1); }
  async msg(uid, kind, actor, data, aggKey) {
    const now = this.now(), A = this.db.aside(), key = 'msg|' + uid + '|' + kind + '|' + actor;
    const merge = d => { d.n = (d.n || 1) + 1; if (data.qty) d.qty = (d.qty || 0) + data.qty; d.items = Object.assign(d.items || {}, data.items ? Object.fromEntries(Object.entries(data.items).map(([k, v]) => [k, (d.items && d.items[k] || 0) + v])) : {}); return d; };
    if (aggKey) { // 合并 10 分钟内同一人的同类消息，避免刷屏
      const m = A && A[key];
      if (m && m.e && !m.e.sent) { merge(m.d); m.e.a[m.pos] = JSON.stringify(m.d); return; } // 本次操作里刚写过：直接改还没发出的那条语句
      const last = await this.db.get('SELECT id,data FROM messages WHERE user_id=? AND kind=? AND actor IS ? AND at>? AND read=0 ORDER BY id DESC LIMIT 1', uid, kind, actor, now - 600000);
      if (last) { const d = merge(J(last.data) || {}); const e = this.db.w('UPDATE messages SET data=?, at=? WHERE id=?', JSON.stringify(d), now, last.id); if (A) A[key] = { d, e, pos: 0 }; return; }
    }
    const e = this.db.w('INSERT INTO messages (user_id,kind,actor,data,at) VALUES (?,?,?,?,?)', uid, kind, actor, JSON.stringify(data || {}), now);
    if (aggKey && A) A[key] = { d: JSON.parse(JSON.stringify(data || {})), e, pos: 3 };
    this.db.w('DELETE FROM messages WHERE user_id=? AND id < (SELECT id FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 1 OFFSET 199)', uid, uid);
  }
  async isFriend(a, b) { return !!(await this.db.get('SELECT 1 FROM friends WHERE a=? AND b=?', a, b)); }
  async friendSet(uid) { return new Set((await this.db.all('SELECT b FROM friends WHERE a=?', uid)).map(r => r.b)); }
  // 开放世界：任何未封禁、未互相拉黑的玩家都可以互相串门
  async canSee(uid, owner) {
    if (uid === owner) throw bad('这是你自己的农场');
    const C = this.C(), mk = 'blk|' + uid + '|' + owner;
    const [o, blk] = await all([this.user(owner), C && mk in C.memo ? C.memo[mk] : this.db.get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked=?) OR (user_id=? AND blocked=?)', owner, uid, uid, owner)]);
    if (C) C.memo[mk] = blk || null;
    if (o.banned) throw forbid('该玩家已被封禁');
    if (blk) throw forbid('无法访问这个农场');
    return o;
  }

  /* ---------- 账号 ---------- */
  /* ---------- 快照 ---------- */
  async badges(uid, u) {
    const [uu, claimRows, C, unread, requests, stats] = await all([u || this.user(uid), this.db.all('SELECT key FROM claims WHERE user_id=?', uid), this.counters(uid),
      this.db.get('SELECT COUNT(*) n FROM messages WHERE user_id=? AND read=0', uid), this.db.get('SELECT COUNT(*) n FROM friend_requests WHERE dst=?', uid), this.achCounts(uid)]);
    u = uu; const day = this.period('day'), wk = this.period('week'), claimed = new Set(claimRows.map(r => r.key));
    let tasks = 0;
    CFG.TASKS.forEach(t => { if (C(t.id, day) >= t.need && !claimed.has('task:' + day + ':' + t.id)) tasks++; });
    CFG.WEEKLY.forEach(t => { if (C(t.stat, wk) >= t.need && !claimed.has('weekly:' + wk + ':' + t.id)) tasks++; });
    if (u.checkin_last !== CFG.dayKey(this.now())) tasks++;
    let newbie = 0; CFG.NEWBIE.forEach(t => { if (C(t.stat, 'all') >= t.need && !claimed.has('newbie:' + t.id)) newbie++; });
    const st = this.achStatsOf(u, stats); let ach = 0; CFG.ACHIEVEMENTS.forEach(a => { if (st[a.stat] >= a.need && !claimed.has('ach:' + a.id)) ach++; });
    return { tasks, newbie, newbieLeft: CFG.NEWBIE.filter(t => !claimed.has('newbie:' + t.id)).length, ach, unread: unread.n, requests: requests.n };
  }
  async snapshot(uid) {
    const now = this.now();
    // 全部读取同时发出：远端数据库时只算一次网络往返；返回给客户端的数据一律重新读取
    this.forget(uid);
    const [u, plots, inv, events, badges] = await all([this.user(uid), this.plots(uid), this.inv(uid), this.activeEvents(), this.badges(uid)]);
    return { now, me: this.me(u), plots: plots.map(p => this.pubPlot(p)), inv, badges, rain: CFG.rainUntil(now), bonus: CFG.dayBonus(now), events, day: CFG.dayKey(now) };
  }

  /* ---------- 自己农场 ---------- */
}

/* 各玩法模块：account 账号 · farm 农田 · ranch 牧场与狗 · home 家园建造 · quest 任务成就订单 · social 好友串门 · economy 集市排行赛季 · hunt 名山猎场 · lake 镜湖钓场 */
/* 逐个字面量 require：云函数打包脚本（deploy/bundle-functions.js）只认字面量 */
const DOMAINS = { account: __req("server/domains/account.js"), farm: __req("server/domains/farm.js"), ranch: __req("server/domains/ranch.js"), home: __req("server/domains/home.js"), quest: __req("server/domains/quest.js"), social: __req("server/domains/social.js"), economy: __req("server/domains/economy.js"), hunt: __req("server/domains/hunt.js"), lake: __req("server/domains/lake.js") };
for (const [m, mod] of Object.entries(DOMAINS)) {
  for (const k of Object.keys(mod)) { if (k in Game.prototype) throw new Error('玩法模块方法重名：' + m + '.' + k); Object.defineProperty(Game.prototype, k, { value: mod[k], writable: true, configurable: true }); }
}

module.exports = { Game, cropOfItem, itemName };

});

__def("server/admin.js", function (module, exports, __req) {
'use strict';
/* 运营后台：指标、玩家管理、活动与数值配置、审计（异步） */
const CFG = __req("shared/config.js");
const U = __req("server/util.js");
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const all = Promise.all.bind(Promise);

class Admin {
  constructor(game) { this.g = game; this.db = game.db; }
  audit(adminId, action, target, data) { this.db.w('INSERT INTO audit (admin_id,action,target,data,at) VALUES (?,?,?,?,?)', adminId, action, String(target || ''), JSON.stringify(data || {}), this.g.now()); }

  async stats() {
    const db = this.db, now = this.g.now(), days = [];
    for (let i = 13; i >= 0; i--) days.push(CFG.dayKey(now - i * 86400000));
    // 一次取出 14 天的指标与日活
    const [mrows, lrows] = await all([db.all(`SELECT day,key,val FROM metrics WHERE day IN (${days.map(() => '?').join(',')})`, ...days), db.all(`SELECT day, COUNT(*) n FROM logins WHERE day IN (${days.map(() => '?').join(',')}) GROUP BY day`, ...days)]);
    const M = {}; mrows.forEach(r => M[r.day + '|' + r.key] = r.val); const L = {}; lrows.forEach(r => L[r.day] = r.n);
    const m = (d, k) => M[d + '|' + k] || 0;
    const series = days.map(d => ({ day: d, dau: L[d] || 0, reg: m(d, 'registrations'), steals: m(d, 'steals'), orders: m(d, 'orders_done'), sales: m(d, 'market_sales'), calls: m(d, 'api_calls'), errors: m(d, 'api_errors'), ms: m(d, 'api_ms'), loadN: m(d, 'load_n'), loadMs: m(d, 'load_ms'), friendAdds: m(d, 'friend_adds') }));
    // 次留 / 七留：按注册日 cohort
    const ret = async gap => {
      let base = 0, kept = 0;
      const parts = [];
      for (let i = gap + 1; i <= gap + 7; i++) {
        const s0 = CFG.dayStart(now - i * 86400000), d1 = CFG.dayKey(now - (i - gap) * 86400000);
        parts.push(all([db.get("SELECT COUNT(*) n FROM users WHERE role<>'npc' AND created_at>=? AND created_at<?", s0, s0 + 86400000), db.get("SELECT COUNT(*) n FROM users u JOIN logins l ON l.user_id=u.id AND l.day=? WHERE u.role<>'npc' AND u.created_at>=? AND u.created_at<?", d1, s0, s0 + 86400000)]));
      }
      (await all(parts)).forEach(([a, b]) => { base += a.n; kept += b.n; });
      return base ? kept / base : null;
    };
    const n = (sql, ...a) => db.get(sql, ...a).then(r => r.n);
    const [d1, d7, total, withFriend, wau, thieves, ordersGen, ordersDone, npcs, bound, banned, gold, openListings] = await all([ret(1), ret(7),
      n("SELECT COUNT(*) n FROM users WHERE role<>'npc'"), n("SELECT COUNT(DISTINCT f.a) n FROM friends f JOIN users u ON u.id=f.a WHERE u.role<>'npc'"),
      n('SELECT COUNT(DISTINCT user_id) n FROM logins WHERE day>=?', days[7]), n("SELECT COUNT(DISTINCT s.thief) n FROM steals s JOIN users u ON u.id=s.thief WHERE s.at>? AND s.blocked=0 AND u.role<>'npc'", now - 7 * 86400000),
      n('SELECT COUNT(*) n FROM orders WHERE day>=?', days[7]), n('SELECT COUNT(*) n FROM orders WHERE day>=? AND done=1', days[7]),
      n("SELECT COUNT(*) n FROM users WHERE role='npc'"), n('SELECT COUNT(*) n FROM users WHERE username IS NOT NULL'), n('SELECT COUNT(*) n FROM users WHERE banned=1'), n("SELECT COALESCE(SUM(gold),0) n FROM users WHERE role<>'npc'"), n("SELECT COUNT(*) n FROM market WHERE status='open'")]);
    const t = series[series.length - 1];
    return {
      now, totals: { users: total, npcs, bound, banned, gold, openListings },
      today: { dau: t.dau, reg: t.reg, errorRate: t.calls ? t.errors / t.calls : 0, avgMs: t.calls ? t.ms / t.calls : 0, avgLoadMs: t.loadN ? t.loadMs / t.loadN : 0 },
      rates: { d1, d7, friendRate: total ? withFriend / total : 0, stealRate: wau ? thieves / wau : 0, orderRate: ordersGen ? ordersDone / ordersGen : 0 },
      series,
    };
  }
  async players(q) {
    q = String(q || '').trim();
    const rows = q ? await this.db.all("SELECT * FROM users WHERE code=? OR username=? OR name LIKE ? ORDER BY last_active DESC LIMIT 50", q, q, '%' + q + '%') : await this.db.all('SELECT * FROM users ORDER BY last_active DESC LIMIT 50');
    return rows.map(u => ({ id: u.id, code: u.code, name: u.name, username: u.username, lv: u.lv, gold: u.gold, role: u.role, npc: u.role === 'npc', banned: !!u.banned, created_at: u.created_at, last_active: u.last_active }));
  }
  async player(id) {
    const [u, inv, ledger, steals, friends, sessions] = await all([this.g.user(id), this.g.inv(id), this.db.all('SELECT delta,reason,at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 60', id),
      this.db.all('SELECT s.*, o.name AS oname FROM steals s LEFT JOIN users o ON o.id=s.owner WHERE s.thief=? ORDER BY s.id DESC LIMIT 40', id),
      this.db.get('SELECT COUNT(*) n FROM friends WHERE a=?', id), this.db.get('SELECT COUNT(*) n FROM sessions WHERE user_id=?', id)]);
    const d = Object.assign({}, u); delete d.pass_hash; delete d.recovery_hash;
    return { user: d, inv, ledger, steals, friends: friends.n, sessions: sessions.n };
  }
  async ban(adminId, id, on, reason) {
    const u = await this.g.user(id); if (u.role === 'admin') throw U.bad('不能封禁管理员');
    this.db.w('UPDATE users SET banned=?, ban_reason=? WHERE id=?', on ? 1 : 0, on ? String(reason || '').slice(0, 100) : '', id);
    if (on) { this.db.w('DELETE FROM sessions WHERE user_id=?', id); for (const m of await this.db.all("SELECT id FROM market WHERE seller=? AND status='open'", id)) await this.g.cancelListing(id, m.id); }
    this.audit(adminId, on ? 'ban' : 'unban', id, { reason }); return {};
  }
  async adjust(adminId, id, b) {
    const reason = String(b.reason || '').trim(); if (!reason) throw U.bad('请填写调整原因');
    const gold = Math.round(Number(b.gold) || 0); if (Math.abs(gold) > 1e7) throw U.bad('单次调整金额过大');
    await this.g.user(id);
    if (gold) this.g.addGold(id, gold, 'admin:' + reason.slice(0, 40));
    if (b.item) { const q = Math.round(Number(b.qty) || 0); if (q) this.g.addInv(id, String(b.item), q); }
    this.audit(adminId, 'adjust', id, { gold, item: b.item, qty: b.qty, reason }); return {};
  }
  async setRole(adminId, id, role) { if (!['user', 'admin'].includes(role)) throw U.bad('角色不对'); this.db.w('UPDATE users SET role=? WHERE id=?', role, id); this.audit(adminId, 'role', id, { role }); return {}; }
  async events() { return (await this.db.all('SELECT * FROM events ORDER BY id DESC')).map(e => Object.assign(e, { params: J(e.params) || {} })); }
  async saveEvent(adminId, b) {
    const kinds = ['exp_mult', 'price_mult', 'golden_mult', 'yield_mult']; if (!kinds.includes(b.kind)) throw U.bad('活动类型不对');
    const name = String(b.name || '').trim().slice(0, 30); if (!name) throw U.bad('请填写活动名称');
    const mult = Number(b.mult); if (!(mult >= 0.5 && mult <= 5)) throw U.bad('倍率需在 0.5–5 之间');
    const start = Number(b.start_at), end = Number(b.end_at); if (!(start > 0 && end > start)) throw U.bad('时间不对');
    const params = JSON.stringify({ mult, crop: b.crop === '' || b.crop === undefined || b.crop === null ? null : U.int(b.crop, '作物', 0, CFG.CROPS.length - 1) });
    if (b.id) this.db.w('UPDATE events SET name=?,kind=?,params=?,start_at=?,end_at=?,enabled=?,descr=? WHERE id=?', name, b.kind, params, start, end, b.enabled ? 1 : 0, String(b.descr || '').slice(0, 120), b.id);
    else this.db.w('INSERT INTO events (name,kind,params,start_at,end_at,enabled,descr) VALUES (?,?,?,?,?,?,?)', name, b.kind, params, start, end, b.enabled === false ? 0 : 1, String(b.descr || '').slice(0, 120));
    this.g.invalidateEvents(); this.audit(adminId, b.id ? 'event_edit' : 'event_add', b.id || name, b); return {};
  }
  async deleteEvent(adminId, id) { this.db.w('DELETE FROM events WHERE id=?', id); this.g.invalidateEvents(); this.audit(adminId, 'event_del', id, {}); return {}; }
  async getConfig() { const [c, r] = await all([this.db.get("SELECT value FROM config WHERE key='crops'"), this.db.get("SELECT value FROM config WHERE key='rules'")]); return { crops: J((c || {}).value) || {}, rules: J((r || {}).value) || {}, effective: this.g.publicConfig() }; }
  async setConfig(adminId, key, value) {
    if (!['crops', 'rules'].includes(key)) throw U.bad('配置项不对'); if (typeof value !== 'object' || !value) throw U.bad('配置格式不对');
    this.db.w('INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value));
    await this.g.applyConfigOverrides(); this.audit(adminId, 'config', key, value); return this.getConfig();
  }
  auditLog() { return this.db.all('SELECT a.*, u.name FROM audit a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 200'); }
  errors() { return this.db.all('SELECT * FROM errors ORDER BY id DESC LIMIT 100'); }
  async suspects() {
    const now = this.g.now(), d = 'd' + CFG.dayKey(now);
    const [stealers, earners, trades, pairs] = await all([
      this.db.all("SELECT u.id,u.code,u.name,c.val FROM counters c JOIN users u ON u.id=c.user_id WHERE c.period=? AND c.key='steal_n' ORDER BY c.val DESC LIMIT 20", d),
      this.db.all('SELECT u.id,u.code,u.name,SUM(l.delta) AS gold FROM ledger l JOIN users u ON u.id=l.user_id WHERE l.at>? AND l.delta>0 GROUP BY l.user_id ORDER BY gold DESC LIMIT 20', CFG.dayStart(now)),
      this.db.all("SELECT m.*, s.name AS sname, b.name AS bname FROM market m LEFT JOIN users s ON s.id=m.seller LEFT JOIN users b ON b.id=m.buyer WHERE m.status='sold' AND m.done_at>? ORDER BY m.qty*m.price DESC LIMIT 20", now - 7 * 86400000),
      // 同一对玩家之间大量交易（可能是小号转移）
      this.db.all("SELECT seller, buyer, COUNT(*) n, SUM(qty*price) total FROM market WHERE status='sold' AND done_at>? GROUP BY seller,buyer HAVING n>=5 ORDER BY total DESC LIMIT 20", now - 7 * 86400000)]);
    return { stealers, earners, trades, pairs };
  }
}
module.exports = { Admin };

});

__def("server/npc.js", function (module, exports, __req) {
'use strict';
/* =====================================================
   拟真玩家（NPC）
   对其他玩家来说和真人没有区别：真实风格的网名、等级与历史数据、个人作息、
   在线/离线、按规则赚钱花钱、串门偷菜帮忙、留言加好友、被偷了会回访报复。
   只有运营后台能看到它们是 NPC（users.role = 'npc'），统计指标不计入。
   ===================================================== */
const CFG = __req("shared/config.js");
const U = __req("server/util.js");
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
    // 看家狗：Lv.3 起多数养福旺，Lv.10 起一部分还养睿宝；入场时都是喂饱的
    const dog = lv >= 3 && r() < 0.7 ? 1 : 0, dog2 = lv >= 10 && r() < 0.45 ? 1 : 0, persona = pickPersona(r);
    const dogUntil = () => now + Math.floor((1 + r() * 7) * 3600000);
    const yest = CFG.dayKey(now - 86400000);
    const fields = { name, lv, exp: Math.floor(CFG.expNeed(lv) * r() * 0.9), gold, avatar: JSON.stringify(av), dog_own: dog, dog_lv: dog ? 1 + Math.floor(r() * Math.min(9, lv / 3)) : 1,
      harvest_total: harvest, steal_total: steal, help_total: help, plant_total: Math.round(harvest * 1.1), golden_total: Math.round(harvest * 0.03 * r()), order_total: Math.round(lv * 1.5 * r()), earned_total: Math.round(gold * (3 + r() * 4)), stolen_from_total: Math.round(harvest * 2 * r()),
      checkin_last: r() < 0.6 ? yest : CFG.dayKey(now - Math.floor(2 + r() * 5) * 86400000), checkin_streak: Math.floor(r() * Math.min(lv, 9)), created_at: created, last_active: now - Math.floor(r() * 20 * 3600000) };
    this.db.w(`UPDATE users SET role='npc', name=?, lv=?, exp=?, gold=?, title='', theme='classic', frame='none', avatar=?, dog_own=?, dog_lv=?, dog_exp=0, dog_until=?, dog2_own=?, dog2_lv=?, dog2_exp=0, dog2_until=?,
      harvest_total=?, steal_total=?, help_total=?, plant_total=?, golden_total=?, order_total=?, earned_total=?, stolen_from_total=?, checkin_last=?, checkin_streak=?, created_at=?, last_active=?, seed=0 WHERE id=?`,
      fields.name, fields.lv, fields.exp, fields.gold, fields.avatar, fields.dog_own, fields.dog_lv, dog ? dogUntil() : 0, dog2, dog2 ? 1 + Math.floor(r() * Math.min(9, lv / 4)) : 1, dog2 ? dogUntil() : 0, fields.harvest_total, fields.steal_total, fields.help_total, fields.plant_total, fields.golden_total, fields.order_total, fields.earned_total, fields.stolen_from_total, fields.checkin_last, fields.checkin_streak, fields.created_at, fields.last_active, uid);
    // 鱼塘与羊圈：和真人一样养着鱼和羊
    { const fl = CFG.FISH.filter(f => f.lv <= lv), sl = CFG.SHEEP.filter(x => x.lv <= lv), R = { fish: [], sheep: [], herd: { from: 0, until: 0, dog: '' } };
      const nf = Math.floor(r() * (CFG.pondCap(lv) + 1)); for (let k = 0; k < nf && fl.length; k++) { const f = fl[Math.floor(r() * fl.length)]; R.fish.push({ t: f.id, at: now - Math.floor(r() * f.time * 1000) }); }
      const ns = sl.length ? Math.floor(r() * (CFG.pastureCap(lv) + 1)) : 0; for (let k = 0; k < ns; k++) { const x = sl[Math.floor(r() * sl.length)]; R.sheep.push({ t: x.id, last: now, acc: r() * 2 }); }
      this.db.w('UPDATE users SET ranch=? WHERE id=?', JSON.stringify(R), uid); }
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
    const tier = () => lv >= 28 && r() < 0.4 ? 3 : lv >= 15 && r() < 0.5 ? 2 : 1;
    UNLOCK_ORDER.slice(0, owned).forEach((idx, k) => this.db.w('UPDATE plots SET u=1, soil=?, t=? WHERE user_id=? AND idx=?', k < nRed ? tier() : 0, now, uid, idx));
    const pool = CROPS.filter(c => c.lv <= lv).sort((a, b) => b.lv - a.lv), main = pool[Math.floor(r() * Math.min(3, pool.length))], alt = pool[Math.floor(r() * Math.min(6, pool.length))];
    for (const P of await g.plots(uid)) {
      if (!P.u || r() < 0.12) continue;
      const cr = r() < 0.7 ? main : alt; P.c = cr.id; P.p = 0; P.sea = 0; await g.startCycle(P, now);
      const x = r(); P.p = x < 0.35 ? 1 : 0.05 + r() * 0.9; if (P.p >= 1) { P.ra = now - Math.floor((3 + r() * 120) * 60000); P.ev = []; } else P.ev = P.ev.filter(e => e[0] > now);
      if (P.p < 1 && r() < 0.25) P.pr[['d', 'w', 'b'][Math.floor(r() * 3)]] = 1;
      g.savePlot(uid, P);
    }
    this.db.w('DELETE FROM inventory WHERE user_id=?', uid); g.addInv(uid, 'fert', Math.floor(r() * 8)); if (dog || dog2) g.addInv(uid, 'dogfood', 2 + Math.floor(r() * 5));
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
    // 喂狗：快饿了就喂（狗粮不够先买）；有钱了再领养新狗
    for (const d of CFG.DOGS) {
      if (u[d.col + '_own'] && (u[d.col + '_until'] || 0) < g.now() + 30 * 60000) { if (!inv.dogfood && u.gold > 800) { const n = U.randInt(2, 5); if (await this.sp(() => g.buy(id, 'dogfood', n))) inv.dogfood = n; } if (inv.dogfood && await this.sp(() => g.feedDog(id, d.id))) inv.dogfood--; }
      else if (!u[d.col + '_own'] && u.lv >= d.lv && u.gold > d.price * 4 && U.rand() < 0.25) await this.sp(() => g.buyDog(id, d.id));
    }
    let plots; [u, plots] = await Promise.all([g.user(id), g.plots(id)]); const owned = plots.filter(p => p.u).length;
    if (owned < NPLOTS && u.lv >= CFG.plotNeedLv(owned) && u.gold > CFG.plotCost(owned) * 1.4 && U.rand() < 0.5) await this.sp(() => g.expand(id, -1, out));
    [u, plots] = await Promise.all([g.user(id), g.plots(id)]);
    // 升级土地：从等级最低的地开始，一级一级往上升
    { const p = plots.filter(x => x.u).sort((a, b) => (a.soil | 0) - (b.soil | 0))[0], next = p ? (p.soil | 0) + 1 : 0, S = CFG.SOILS[next];
      if (S && u.lv >= S.lv && u.gold > CFG.soilCost(next, plots.filter(x => (x.soil | 0) >= next).length) * 2.5 && U.rand() < 0.15) await this.sp(() => g.red(id, p.idx, out)); }
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

});

__def("server/app.js", function (module, exports, __req) {
'use strict';
/* =====================================================
   丰收农场 · 请求处理核心（与运行平台无关）
   - 本机 / 自己的服务器：server/index.js 用 Node http 包一层
   - EdgeOne Pages 云函数：cloud-functions/api/[[default]].js 包一层
   输入：{ method, url, headers(小写键), body(字符串), ip, secure }
   输出：{ status, headers, body }
   ===================================================== */
const CFG = __req("shared/config.js");
const U = __req("server/util.js");
const { open, SCHEMA_VERSION } = __req("server/db.js");
const { Game } = __req("server/game.js");
const { Admin } = __req("server/admin.js");
const { Villagers } = __req("server/npc.js");

const VERSION = __req("shared/config.js").VERSION;
const all = Promise.all.bind(Promise);

function envOpts(env) {
  env = env || process.env;
  return {
    tzMin: +(env.TZ_OFFSET_MIN || 480), prod: env.NODE_ENV === 'production',
    cors: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY === '1', testClock: env.FARM_TEST_CLOCK === '1' && env.NODE_ENV !== 'production',
    admins: (env.ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean), quiet: env.QUIET === '1',
    npcCount: env.NPC_COUNT === undefined ? 24 : +env.NPC_COUNT, npcTickSec: +(env.NPC_TICK_SEC || 30),
    tursoUrl: env.TURSO_DATABASE_URL || '', tursoToken: env.TURSO_AUTH_TOKEN || '',
  };
}

async function createCore(opts) {
  opts = Object.assign(envOpts(), opts || {});
  CFG.setTz(opts.tzMin);
  const db = await open({ file: opts.db || ':memory:', tursoUrl: opts.tursoUrl, tursoToken: opts.tursoToken, fetch: opts.fetch });
  const game = new Game(db, { tzMin: opts.tzMin }), admin = new Admin(game), vill = new Villagers(game), lim0 = new U.Limiter();
  await game.applyConfigOverrides();
  const lim = { take: (...a) => opts.noRateLimit ? true : lim0.take(...a) };
  if (opts.admins.length) await db.run(`UPDATE users SET role='admin' WHERE username IN (${opts.admins.map(() => '?').join(',')})`, ...opts.admins);

  // ---- 指标：内存累计，每 30 秒随请求顺手落库（不进事务，不会引起冲突） ----
  const mem = {}; let memAt = Date.now(); const mbump = (k, n) => mem[k] = (mem[k] || 0) + (n || 1);
  const flushMetrics = (force) => {
    if (!force && Date.now() - memAt < 30000) return; memAt = Date.now();
    const day = CFG.dayKey(game.now()); Object.keys(mem).forEach(k => { db.bg('INSERT INTO metrics (day,key,val) VALUES (?,?,?) ON CONFLICT(day,key) DO UPDATE SET val=val+excluded.val', day, k, mem[k]); delete mem[k]; });
  };

  /* ---- 后台任务（NPC、清理）：用租约保证多实例下同一时间只有一个在跑 ----
     本机：定时器调用；EdgeOne：前端每分钟顺手调用 /api/cron（无人在线时不需要跑） */
  async function lease(name, holdMs) {
    const now = game.now();
    await db.run('INSERT OR IGNORE INTO leases (name,until,at) VALUES (?,0,0)', name);
    const L = await db.get('SELECT until, at FROM leases WHERE name=?', name);
    if (L.until > now) return null;
    const r = await db.run('UPDATE leases SET until=?, at=? WHERE name=? AND until=?', now + holdMs, now, name, L.until);
    return r.changes ? { prevAt: L.at, now } : null;
  }
  const release = (name, nextMs) => db.run('UPDATE leases SET until=? WHERE name=?', game.now() + nextMs, name);
  let npcBusy = false;
  async function runNpc(budgetMs) {
    if (opts.npcCount <= 0 || npcBusy) return { skipped: true };
    npcBusy = true;
    try {
      const L = await lease('npc', (budgetMs || 20000) + 15000); if (!L) return { skipped: true };
      const t0 = Date.now();
      try {
        await vill.ensure(Math.min(80, opts.npcCount), budgetMs ? budgetMs / 2 : 0);
        const since = L.prevAt ? Math.max(1, Math.min(1800, (L.now - L.prevAt) / 1000)) : opts.npcTickSec;
        await vill.tick(since, budgetMs ? Math.max(1000, budgetMs - (Date.now() - t0)) : 0);
      } finally { await release('npc', Math.max(1000, opts.npcTickSec * 1000 - 2000)).catch(() => { }); }
      return { ran: true, ms: Date.now() - t0 };
    } catch (e) { if (!opts.quiet) console.error('[npc]', e && e.stack || e); return { error: true }; }
    finally { npcBusy = false; }
  }
  async function runMaint() {
    try {
      const L = await lease('maint', 60000); if (!L) return { skipped: true };
      await db.run('DELETE FROM idem WHERE at<?', game.now() - 86400000);
      await db.run('DELETE FROM sessions WHERE last_seen<?', game.now() - 90 * 86400000);
      await db.run('DELETE FROM errors WHERE id < (SELECT id FROM errors ORDER BY id DESC LIMIT 1 OFFSET 999)');
      await release('maint', 3600000);
      return { ran: true };
    } catch (e) { return { error: true }; }
  }

  // ---- 路由 ----
  const routes = [];
  const R = (method, pat, flags, fn) => { const keys = []; const re = new RegExp('^' + pat.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$'); routes.push({ method, re, keys, flags, fn }); };
  const st = uid => game.snapshot(uid);
  // 返回“结果 + 最新状态”的写操作：状态在事务最后一批读取里取（与提交合并）；幂等重放时重新读取最新状态
  const fv = (uid, owner, result, out) => ({ __view: 'fv', uid, owner, result, out });
  const own = (uid, result, out) => ({ __view: 'own', uid, result, out });
  const view = async v => {
    if (v.__view === 'own') return { result: v.result, out: v.out, state: await st(v.uid) };
    game.forget(v.uid); game.forget(v.owner);
    const [u, inv, badges, farm] = await all([game.user(v.uid), game.inv(v.uid), game.badges(v.uid), game.farmView(v.uid, v.owner)]); return { result: v.result, out: v.out, me: game.me(u), inv, badges, farm, now: game.now() };
  };
  const idx = b => U.int(b.idx, '土地', 0, CFG.MAX_PLOTS - 1);
  const id = v => U.int(v, 'ID', 1, Number.MAX_SAFE_INTEGER);
  const sick = P => { const l = []; if (P.u && P.c >= 0) ['d', 'w', 'b'].forEach(k => { if (P.pr[k]) l.push(P.idx); }); return l; };

  // 公共
  R('GET', '/api/health', { noTx: 1 }, async () => ({ ok: true, version: VERSION, schema: SCHEMA_VERSION, db: db.kind, now: game.now() }));
  R('GET', '/api/config', { noTx: 1 }, async () => game.publicConfig());
  R('POST', '/api/auth/guest', { authLimit: 1, guestLimit: 1 }, async (c) => { const uid = await game.createUser(c.body.name); const token = game.newSession(uid, c.ua); c.addDev(token); return { token, state: await st(uid) }; });
  R('POST', '/api/auth/register', { authLimit: 1, guestLimit: 1 }, async (c) => { U.checkPw2(c.body.password, c.body.password2); const uid = await game.createUser(c.body.name, c.body.username, c.body.password); const token = game.newSession(uid, c.ua); c.addDev(token); return { token, state: await st(uid) }; });
  R('POST', '/api/auth/login', { authLimit: 1 }, async (c) => { const u = await game.login(c.body.username, c.body.password); if (u.banned) throw U.forbid('账号已被封禁：' + (u.ban_reason || '违反规则')); const token = (await c.devFor(u.id)) || game.newSession(u.id, c.ua); c.addDev(token); return { token, state: await st(u.id) }; });
  R('POST', '/api/auth/recover', { authLimit: 1 }, async (c) => { const r = await game.recover(c.body.username, c.body.code, c.body.password); const token = game.newSession(r.user.id, c.ua); c.addDev(token); return { token, recovery: r.recovery, state: await st(r.user.id) }; });
  R('GET', '/api/invite/:code', {}, async (c) => { const u = await db.get('SELECT * FROM users WHERE code=? AND banned=0', String(c.params.code)); if (!u) throw U.notFound('邀请链接无效'); return game.publicUser(u); });
  R('POST', '/api/telemetry', { optAuth: 1, noTx: 1 }, async (c) => { const ms = Math.round(Number(c.body.loadMs)); if (ms > 0 && ms < 60000) { mbump('load_n'); mbump('load_ms', ms); const t = c.body.t || {}; for (const k of ['js', 'w3', 'cfg', 'shown']) { const v = Math.round(Number(t[k])); if (v > 0 && v < 60000) mbump('boot_' + k + '_ms', v); } } return {}; });
  // 后台任务触发：无服务器部署时由在线玩家的页面每分钟调用一次（有租约，重复调用会直接跳过）
  let cronAt = 0;
  R('POST', '/api/cron', { noTx: 1, cron: 1 }, async () => { if (Date.now() - cronAt < 20000) return { skipped: true }; cronAt = Date.now(); const [npc, maint] = await all([runNpc(opts.cronBudgetMs || 20000), runMaint()]); flushMetrics(true); return { npc, maint }; });

  // 账号
  R('POST', '/api/auth/logout', { auth: 1, allowBanned: 1 }, async (c) => { db.w('DELETE FROM sessions WHERE token_hash=?', c.tokenHash); c.dropDev(c.token); return {}; });
  // 本机账号：HttpOnly Cookie 长期保存本机登录过的账号，苹果设备清理网页存储后也能一键进入
  const devList = async c => { const us = await all(c.devTokens.map(t => game.peek(t))); return c.devTokens.map((t, i) => ({ t, u: us[i] })).filter(x => { if (!x.u || x.u.banned) { c.dropDev(x.t); return false; } return true; }); };
  R('GET', '/api/accounts', {}, async (c) => { const l = await devList(c); c.touchDev(); return { list: l.map(x => Object.assign(game.publicUser(x.u), { guest: !x.u.username, last: x.u.last_active })) }; });
  R('POST', '/api/accounts/use', { authLimit: 1 }, async (c) => { const x = (await devList(c)).find(x => x.u.id === Number(c.body.id)); if (!x) throw U.notFound('这台设备上没有保存这个账号，请重新登录'); c.touchDev(); return { token: x.t, state: await st(x.u.id) }; });
  R('POST', '/api/accounts/remember', { auth: 1 }, async (c) => { c.addDev(c.token); return {}; });
  R('POST', '/api/accounts/forget', {}, async (c) => { const x = (await devList(c)).find(x => x.u.id === Number(c.body.id)); if (x) { db.w('DELETE FROM sessions WHERE token_hash=?', U.sha256(x.t)); c.dropDev(x.t); } return {}; });
  R('POST', '/api/auth/bind', { auth: 1, authLimit: 1 }, (c) => { U.checkPw2(c.body.password, c.body.password2); return game.bind(c.uid, c.body.username, c.body.password); });
  R('POST', '/api/auth/password', { auth: 1, authLimit: 1 }, async (c) => { U.checkPw2(c.body.password, c.body.password2); await game.changePassword(c.uid, c.body.old, c.body.password); return { token: game.newSession(c.uid, c.ua) }; });
  R('GET', '/api/state', { auth: 1 }, (c) => st(c.uid));
  R('POST', '/api/me/profile', { auth: 1 }, async (c) => { await game.updateProfile(c.uid, c.body); return own(c.uid); });
  R('POST', '/api/me/migrate', { auth: 1 }, async (c) => own(c.uid, await game.migrate(c.uid, c.body)));
  R('GET', '/api/me/export', { auth: 1, allowBanned: 1 }, (c) => game.exportData(c.uid));
  R('POST', '/api/me/delete', { auth: 1, authLimit: 1, allowBanned: 1 }, async (c) => { await game.deleteAccount(c.uid, c.body.password, c.body.confirm); c.dropDev(c.token); return {}; });

  // 自己的农场
  R('POST', '/api/farm/plant', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.plant(c.uid, idx(c.body), U.int(c.body.crop, '种子', 0, CFG.CROPS.length - 1), o), o); });
  R('POST', '/api/farm/harvest', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.harvest(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/care', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.care(c.uid, idx(c.body), o), o); });
  R('POST', '/api/farm/shovel', { auth: 1 }, async (c) => own(c.uid, await game.shovel(c.uid, idx(c.body))));
  R('POST', '/api/farm/fert', { auth: 1 }, async (c) => own(c.uid, await game.fert(c.uid, idx(c.body))));
  R('POST', '/api/farm/field', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.buyField(c.uid, o), o); });
  R('POST', '/api/farm/expand', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.expand(c.uid, c.body.idx === undefined || c.body.idx === null ? -1 : idx(c.body), o), o); });
  R('POST', '/api/farm/red', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.red(c.uid, idx(c.body), o, c.body.to === undefined || c.body.to === null ? undefined : U.int(c.body.to, '土地等级', 1, 3)), o); });
  R('POST', '/api/farm/harvest-all', { auth: 1 }, async (c) => { const l = (await game.plots(c.uid)).filter(P => P.u && P.c >= 0 && P.p >= 1).map(P => P.idx); if (!l.length) throw U.conflict('还没有成熟的作物', 'none'); const b = await game.batch(c.uid, (i, o) => game.harvest(c.uid, i, o), l); return own(c.uid, b.res, b.out); });
  R('POST', '/api/farm/fert-all', { auth: 1 }, async (c) => own(c.uid, await game.fertAll(c.uid)));
  R('POST', '/api/farm/care-all', { auth: 1 }, async (c) => { const l = [].concat(...(await game.plots(c.uid)).map(sick)); if (!l.length) throw U.conflict('农田都很健康', 'none'); const b = await game.batch(c.uid, (i, o) => game.care(c.uid, i, o), l); return own(c.uid, b.res, b.out); });
  R('POST', '/api/farm/plant-all', { auth: 1 }, async (c) => { const crop = U.int(c.body.crop, '种子', 0, CFG.CROPS.length - 1); const l = (await game.plots(c.uid)).filter(P => P.u && P.c < 0).map(P => P.idx); if (!l.length) throw U.conflict('没有空地了', 'none'); const b = await game.batch(c.uid, (i, o) => game.plant(c.uid, i, crop, o), l); if (!b.res.some(r => !r.err)) throw U.conflict(b.res[0].err, b.res[0].code); return own(c.uid, b.res, b.out); });
  R('POST', '/api/shop/buy', { auth: 1 }, async (c) => own(c.uid, await game.buy(c.uid, String(c.body.item), c.body.n)));
  R('POST', '/api/shop/dog', { auth: 1 }, async (c) => own(c.uid, await game.buyDog(c.uid, c.body.kind ? String(c.body.kind) : 'fuwang')));
  R('POST', '/api/ranch/fish/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyFish(c.uid, U.int(c.body.type, '鱼苗', 0, 99), c.body.n)));
  R('POST', '/api/ranch/fish/collect', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.collectFish(c.uid, o), o); });
  R('POST', '/api/ranch/sheep/buy', { auth: 1 }, async (c) => own(c.uid, await game.buySheep(c.uid, U.int(c.body.type, '羊', 0, 99), c.body.n)));
  // V0.3 家园自由建造（建筑目录里状态为 live 的才能摆放；目前全部 planned，第 1 期开放）
  R('GET', '/api/home/layout', { auth: 1 }, (c) => game.homeLayout(c.uid));
  R('POST', '/api/home/place', { auth: 1 }, async (c) => own(c.uid, await game.homePlace(c.uid, { type: c.body.type, gx: U.int(c.body.gx, '位置', -1000, 1000), gz: U.int(c.body.gz, '位置', -1000, 1000), rot: U.int(c.body.rot || 0, '朝向', 0, 3) })));
  R('POST', '/api/home/move', { auth: 1 }, async (c) => own(c.uid, await game.homeMove(c.uid, U.int(c.body.id, '建筑', 1, 1e9), { gx: U.int(c.body.gx, '位置', -1000, 1000), gz: U.int(c.body.gz, '位置', -1000, 1000), rot: U.int(c.body.rot || 0, '朝向', 0, 3) })));
  R('GET', '/api/hunt', { auth: 1 }, (c) => game.huntInfo(c.uid));
  R('POST', '/api/hunt/start', { auth: 1 }, async (c) => own(c.uid, await game.huntStart(c.uid)));
  R('POST', '/api/hunt/end', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.huntEnd(c.uid, { sid: c.body.sid, caught: (Array.isArray(c.body.caught) ? c.body.caught : []).slice(0, 60), faint: !!c.body.faint }, o), o); });
  R('POST', '/api/hunt/buy', { auth: 1 }, async (c) => own(c.uid, await game.huntBuy(c.uid, c.body.weapon)));
  R('GET', '/api/lake', { auth: 1 }, (c) => game.lakeInfo(c.uid));
  R('POST', '/api/lake/start', { auth: 1 }, async (c) => own(c.uid, await game.lakeStart(c.uid)));
  R('POST', '/api/lake/end', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.lakeEnd(c.uid, { sid: c.body.sid, caught: (Array.isArray(c.body.caught) ? c.body.caught : []).slice(0, 80), used: c.body.used | 0 }, o), o); });
  R('POST', '/api/lake/buy', { auth: 1 }, async (c) => own(c.uid, await game.lakeBuy(c.uid, c.body.rod)));
  R('POST', '/api/home/wonder', { auth: 1 }, async (c) => own(c.uid, await game.homeWonder(c.uid, U.int(c.body.id, '建筑', 1, 1e9))));
  R('POST', '/api/home/remove', { auth: 1 }, async (c) => own(c.uid, await game.homeRemove(c.uid, U.int(c.body.id, '建筑', 1, 1e9))));
  R('POST', '/api/ranch/upgrade', { auth: 1 }, async (c) => own(c.uid, await game.ranchUpgrade(c.uid, String(c.body.kind || ''))));
  R('POST', '/api/ranch/tree/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyTree(c.uid, U.int(c.body.type, '树苗', 0, 99), c.body.n)));
  R('POST', '/api/ranch/fruit', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.pickFruit(c.uid, o), o); });
  R('POST', '/api/dog/train', { auth: 1 }, async (c) => own(c.uid, await game.trainDog(c.uid, c.body.kind ? String(c.body.kind) : 'fuwang', c.body.n)));
  R('POST', '/api/ranch/boost', { auth: 1 }, async (c) => own(c.uid, await game.ranchBoost(c.uid, String(c.body.kind || ''))));
  R('POST', '/api/pet/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyPet(c.uid, String(c.body.coat || ''), c.body.name)));
  R('POST', '/api/pet/rename', { auth: 1 }, async (c) => own(c.uid, await game.renamePet(c.uid, String(c.body.id || ''), c.body.name)));
  R('POST', '/api/ranch/shear', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.shear(c.uid, o), o); });
  R('POST', '/api/ranch/herd', { auth: 1 }, async (c) => own(c.uid, await game.herd(c.uid, c.body.kind ? String(c.body.kind) : '')));
  R('POST', '/api/dog/feed', { auth: 1 }, async (c) => own(c.uid, await game.feedDog(c.uid, c.body.kind ? String(c.body.kind) : 'fuwang', c.body.n)));
  R('POST', '/api/wh/sell', { auth: 1 }, async (c) => own(c.uid, await game.sell(c.uid, String(c.body.item), c.body.n)));
  R('POST', '/api/wh/sell-all', { auth: 1 }, async (c) => own(c.uid, await game.sellAll(c.uid)));
  R('POST', '/api/checkin', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.checkin(c.uid, o), o); });
  R('GET', '/api/tasks', { auth: 1 }, (c) => game.tasks(c.uid));
  R('POST', '/api/tasks/claim', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.claimTask(c.uid, String(c.body.kind), String(c.body.id), o), o); });
  R('GET', '/api/achievements', { auth: 1 }, (c) => game.achievements(c.uid));
  R('POST', '/api/achievements/claim', { auth: 1 }, async (c) => own(c.uid, await game.claimAch(c.uid, String(c.body.id))));
  R('GET', '/api/orders', { auth: 1 }, (c) => game.orders(c.uid));
  R('POST', '/api/orders/deliver', { auth: 1 }, async (c) => { const o = {}; return own(c.uid, await game.deliver(c.uid, U.int(c.body.slot, '订单', 0, CFG.RULES.orderSlotsMax - 1), o), o); });
  R('POST', '/api/orders/refresh', { auth: 1 }, async (c) => own(c.uid, await game.refreshOrder(c.uid, U.int(c.body.slot, '订单', 0, CFG.RULES.orderSlotsMax - 1))));
  R('GET', '/api/codex', { auth: 1 }, (c) => game.codexList(c.uid));
  R('GET', '/api/cosmetics', { auth: 1 }, (c) => game.cosmetics(c.uid));
  R('POST', '/api/cosmetics/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyCosmetic(c.uid, String(c.body.kind), String(c.body.id))));

  // 社交
  // 合并轮询：一次请求拿到 状态 +（可选）好友/附近 +（可选）正在逛的农场，减少云函数调用次数
  R('GET', '/api/poll', { auth: 1 }, async (c) => {
    const q = c.query, out = {};
    const jobs = [st(c.uid).then(v => out.state = v)];
    if (q.side) jobs.push(game.friends(c.uid).then(v => out.friends = v), game.neighbors(c.uid).then(v => out.neighbors = v));
    if (q.visit) { const o = id(q.visit); jobs.push(game.peekFarm(c.uid, o).then(v => out.farm = v, e => { if (!e.status) throw e; out.farmErr = { status: e.status, error: e.message }; })); }
    await all(jobs); out.now = game.now(); return out;
  });
  R('GET', '/api/friends', { auth: 1 }, (c) => game.friends(c.uid));
  R('GET', '/api/friends/search', { auth: 1, searchLimit: 1 }, (c) => game.search(c.uid, c.query.q));
  R('POST', '/api/friends/request', { auth: 1 }, (c) => game.requestFriend(c.uid, id(c.body.id)));
  R('POST', '/api/friends/add', { auth: 1 }, (c) => game.addFriend(c.uid, id(c.body.id)));
  R('GET', '/api/neighbors', { auth: 1 }, (c) => game.neighbors(c.uid));
  R('POST', '/api/friends/respond', { auth: 1 }, (c) => game.respondRequest(c.uid, id(c.body.id), !!c.body.accept));
  R('POST', '/api/friends/remove', { auth: 1 }, (c) => game.removeFriend(c.uid, id(c.body.id)));
  R('POST', '/api/friends/block', { auth: 1 }, (c) => game.block(c.uid, id(c.body.id), !!c.body.on));
  R('POST', '/api/invite/accept', { auth: 1 }, (c) => game.acceptInvite(c.uid, c.body.code));
  R('GET', '/api/farm/:id', { auth: 1 }, async (c) => { const o = id(c.params.id); return { farm: await game.visit(c.uid, o), now: game.now() }; });
  R('POST', '/api/farm/:id/steal', { auth: 1 }, async (c) => { const o = id(c.params.id), out = {}; return fv(c.uid, o, await game.steal(c.uid, o, idx(c.body), out), out); });
  R('POST', '/api/farm/:id/help', { auth: 1 }, async (c) => { const o = id(c.params.id), out = {}; return fv(c.uid, o, await game.help(c.uid, o, idx(c.body), out), out); });
  R('POST', '/api/farm/:id/steal-all', { auth: 1 }, async (c) => { const o = id(c.params.id); const l = (await game.farmView(c.uid, o)).plots.filter(p => p.canSteal).map(p => p.idx); if (!l.length) throw U.conflict('没有可以摘的果实了', 'none'); const b = await game.batch(c.uid, (i, out) => game.steal(c.uid, o, i, out), l); return fv(c.uid, o, b.res, b.out); });
  R('POST', '/api/farm/:id/help-all', { auth: 1 }, async (c) => { const o = id(c.params.id); const l = [].concat(...(await game.plots(o)).map(sick)); if (!l.length) throw U.conflict('这里不需要帮忙', 'none'); const b = await game.batch(c.uid, (i, out) => game.help(c.uid, o, i, out), l); return fv(c.uid, o, b.res, b.out); });
  R('GET', '/api/guestbook/:id', { auth: 1 }, (c) => game.guestbook(c.uid, id(c.params.id)));
  R('POST', '/api/guestbook/hide', { auth: 1 }, (c) => game.hideGuestbook(c.uid, id(c.body.id)));
  R('POST', '/api/guestbook/:id', { auth: 1 }, (c) => game.postGuestbook(c.uid, id(c.params.id), c.body.phrase));
  R('GET', '/api/messages', { auth: 1 }, (c) => game.messages(c.uid));
  R('POST', '/api/messages/read', { auth: 1 }, (c) => game.readMessages(c.uid));

  // 集市 / 排行 / 赛季
  R('GET', '/api/market', { auth: 1 }, (c) => game.market(c.uid, c.query.item || ''));
  R('POST', '/api/market/list', { auth: 1 }, async (c) => own(c.uid, await game.listItem(c.uid, String(c.body.item), c.body.qty, c.body.price)));
  R('POST', '/api/market/cancel', { auth: 1 }, async (c) => own(c.uid, await game.cancelListing(c.uid, id(c.body.id))));
  R('POST', '/api/market/buy', { auth: 1 }, async (c) => own(c.uid, await game.buyListing(c.uid, id(c.body.id))));
  R('GET', '/api/rank', { auth: 1 }, (c) => game.leaderboard(c.uid, String(c.query.dim || 'lv'), c.query.scope === 'global' ? 'global' : 'friends'));
  R('GET', '/api/season', { auth: 1 }, (c) => game.season(c.uid));
  R('POST', '/api/season/claim', { auth: 1 }, async (c) => own(c.uid, await game.claimSeason(c.uid)));

  // 运营后台
  R('GET', '/api/admin/stats', { admin: 1 }, () => admin.stats());
  R('GET', '/api/admin/players', { admin: 1 }, (c) => admin.players(c.query.q));
  R('GET', '/api/admin/player/:id', { admin: 1 }, (c) => admin.player(id(c.params.id)));
  R('POST', '/api/admin/ban', { admin: 1 }, (c) => admin.ban(c.uid, id(c.body.id), !!c.body.on, c.body.reason));
  R('POST', '/api/admin/adjust', { admin: 1 }, (c) => admin.adjust(c.uid, id(c.body.id), c.body));
  R('POST', '/api/admin/role', { admin: 1 }, (c) => admin.setRole(c.uid, id(c.body.id), String(c.body.role)));
  R('GET', '/api/admin/events', { admin: 1 }, () => admin.events());
  R('POST', '/api/admin/events', { admin: 1 }, (c) => admin.saveEvent(c.uid, c.body));
  R('POST', '/api/admin/events/delete', { admin: 1 }, (c) => admin.deleteEvent(c.uid, id(c.body.id)));
  R('GET', '/api/admin/config', { admin: 1 }, () => admin.getConfig());
  R('POST', '/api/admin/config', { admin: 1 }, (c) => admin.setConfig(c.uid, String(c.body.key), c.body.value));
  R('GET', '/api/admin/audit', { admin: 1 }, () => admin.auditLog());
  R('GET', '/api/admin/errors', { admin: 1 }, () => admin.errors());
  R('GET', '/api/admin/suspects', { admin: 1 }, () => admin.suspects());

  // 测试专用：拨动服务器时钟（生产环境不可用）
  if (opts.testClock) { R('POST', '/api/test/clock', { noTx: 1 }, async (c) => { game.clockOffset += Number(c.body.ms) || 0; return { now: game.now() }; }); R('POST', '/api/test/npc-tick', { noTx: 1 }, async () => { await vill.tick(opts.npcTickSec); return {}; }); }

  // ---- 请求处理 ----
  const json = (status, obj, headers) => ({ status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers || {}), body: JSON.stringify(obj) });
  async function handle(req) {
    const t0 = Date.now(), url = new URL(req.url, 'http://x'), p = url.pathname, H = req.headers || {};
    const origin = H.origin, cors = origin && opts.cors.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Max-Age': '600' } : {};
    if (req.method === 'OPTIONS') return { status: 204, headers: cors, body: '' };
    const ip = req.ip || '?';
    let route, m; for (const r of routes) { if (r.method === req.method && (m = r.re.exec(p))) { route = r; break; } }
    let status = 200, reqCtx = null;
    try {
      if (!route) throw U.notFound('接口不存在');
      if (!route.flags.cron && !lim.take('ip:' + ip, 40, 120)) throw new U.ApiError(429, 'rate', '操作太频繁了，请稍后再试');
      if (route.flags.authLimit && !lim.take('auth:' + ip, 0.3, 12)) throw new U.ApiError(429, 'rate', '尝试次数太多，请稍后再试');
      if (route.flags.guestLimit && !lim.take('guest:' + ip, 20 / 3600, 20)) throw new U.ApiError(429, 'rate', '注册太频繁了，请稍后再试');
      const c = { params: {}, query: Object.fromEntries(url.searchParams), ip, ua: H['user-agent'] || '' };
      const cookies = U.parseCookies(H.cookie); c.devTokens = String(cookies.hf_dev || '').split('.').filter(t => /^[A-Za-z0-9_-]{20,64}$/.test(t)).slice(0, 10); c.devDirty = false;
      c.addDev = t => { c.devTokens = [t].concat(c.devTokens.filter(x => x !== t)).slice(0, 8); c.devDirty = true; };
      c.dropDev = t => { const n = c.devTokens.length; c.devTokens = c.devTokens.filter(x => x !== t); if (n !== c.devTokens.length) c.devDirty = true; };
      c.touchDev = () => { if (c.devTokens.length) c.devDirty = true; };
      c.devFor = async uid => { const us = await all(c.devTokens.map(t => game.peek(t))); const i = us.findIndex(u => u && u.id === uid); return i >= 0 ? c.devTokens[i] : ''; };
      reqCtx = c;
      route.keys.forEach((k, i) => c.params[k] = decodeURIComponent(m[i + 1]));
      if (req.method === 'POST') { const raw = String(req.body || ''); if (raw.length > 64 * 1024) throw U.bad('请求太大'); if (raw) { try { const v = JSON.parse(raw); c.body = v && typeof v === 'object' ? v : {}; } catch (e) { throw U.bad('请求格式不对'); } } else c.body = {}; } else c.body = {};
      const tok = String(H.authorization || '').replace(/^Bearer\s+/i, '');
      await game.refreshConfig();
      let touch = null;
      const body = async () => {
        const ik = req.method === 'POST' && tok ? String(H['idempotency-key'] || '').slice(0, 80) : '';
        let prevP = null;
        // 幂等记录与登录校验同时查（省一次往返）
        if (ik && (route.flags.auth || route.flags.admin || route.flags.optAuth)) { prevP = db.get('SELECT i.resp FROM idem i JOIN sessions s ON s.user_id=i.user_id WHERE s.token_hash=? AND i.key=?', U.sha256(tok), ik); prevP.catch(() => { }); }
        const authed = route.flags.auth || route.flags.admin || route.flags.optAuth;
        // 预读：登录校验的同时把这个玩家的土地、库存、计数器一起读回来（同一次往返）
        let pre = null;
        if (authed && tok) {
          const th = U.sha256(tok), sub = '(SELECT user_id FROM sessions WHERE token_hash=?)';
          pre = all([db.all(`SELECT * FROM plots WHERE user_id=${sub} ORDER BY idx`, th), db.all(`SELECT item,qty FROM inventory WHERE user_id=${sub}`, th), db.all(`SELECT period,key,val FROM counters WHERE user_id=${sub} AND period IN (?,?,'all')`, th, game.period('day'), game.period('week'))]);
          pre.catch(() => { });
        }
        if (authed) {
          const a = await game.auth(tok);
          if (!a && !route.flags.optAuth) throw new U.ApiError(401, 'auth', '请先登录');
          if (a) {
            if (a.user.banned && !route.flags.allowBanned) throw new U.ApiError(403, 'banned', '账号已被封禁：' + (a.user.ban_reason || '违反规则'));
            if (route.flags.admin && a.user.role !== 'admin') throw U.forbid('需要管理员权限');
            c.uid = a.user.id; c.tokenHash = a.tokenHash; c.token = tok; touch = a.touch;
            if (pre) { const [pl, iv, cn] = await pre; game.seed(c.uid, a.user, pl, iv, cn); }
            if (!lim.take('u:' + c.uid, 15, 45)) throw new U.ApiError(429, 'rate', '操作太频繁了，请稍后再试');
            if (route.flags.searchLimit && !lim.take('s:' + c.uid, 0.5, 10)) throw new U.ApiError(429, 'rate', '搜索太频繁了');
          }
        }
        if (prevP) { const prev = await prevP; if (prev && c.uid) { const p0 = JSON.parse(prev.resp); const r = p0.__view ? await view(p0) : p0; r.replayed = true; return r; } }
        const r = await route.fn(c);
        // 幂等记录与业务写入在同一个事务里：网络重试不会重复结算
        if (ik && c.uid) db.wx(U.conflict('操作已经处理过了', 'duplicate'), 'INSERT INTO idem (user_id,key,resp,at) VALUES (?,?,?,?)', c.uid, ik, JSON.stringify(Array.isArray(r) ? { list: r } : r), game.now());
        if (r && r.__view) return db.final(() => view(r));
        return r;
      };
      // 写操作（POST）直接排队 + 排他锁执行（SQLite 同一时间只有一个写入者，先排队比冲突后重来更快）；查询（GET）不加锁并发执行
      const result = route.flags.noTx ? await body() : await db.tx(body, { write: req.method === 'POST' });
      // 在线时间等“顺手写”放到事务提交之后，不参与冲突
      if (touch) touch.forEach(([sql, ...a]) => db.bg(sql, ...a));
      const extra = reqCtx && reqCtx.devDirty ? { 'Set-Cookie': `hf_dev=${reqCtx.devTokens.join('.')}; Path=/api; Max-Age=${reqCtx.devTokens.length ? 400 * 86400 : 0}; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}` } : null;
      return json(200, Object.assign({ ok: true }, Array.isArray(result) ? { list: result } : result), Object.assign({}, cors, extra || {}));
    } catch (e) {
      if (e instanceof U.ApiError) { status = e.status; return json(e.status, { ok: false, code: e.code, error: e.message }, cors); }
      if (e && /CHECK constraint failed/.test(e.message)) { status = 409; return json(409, { ok: false, code: 'constraint', error: '数量不足或数据冲突，请刷新后重试' }, cors); }
      if (e && /UNIQUE constraint failed/.test(e.message)) { status = 409; return json(409, { ok: false, code: 'duplicate', error: '操作已经处理过了' }, cors); }
      if (e && /SQLITE_BUSY|database is locked/i.test(e.message)) { status = 503; return json(503, { ok: false, code: 'busy', error: '服务器有点忙，请稍后重试' }, cors); }
      status = 500; if (!opts.quiet) console.error('[error]', req.method, p, e && e.stack || e);
      db.bg('INSERT INTO errors (at,route,msg) VALUES (?,?,?)', game.now(), req.method + ' ' + (route ? route.re.source : p), String(e && e.message || e).slice(0, 500));
      // detail：错误原因的第一行（测试阶段用于定位问题，不含堆栈）
      return json(500, { ok: false, code: 'server', error: '服务器开小差了，请稍后再试', detail: String(e && e.message || e).split('\n')[0].slice(0, 120) }, cors);
    } finally {
      mbump('api_calls'); if (status >= 500) mbump('api_errors'); mbump('api_ms', Date.now() - t0); flushMetrics();
    }
  }

  return { handle, db, game, admin, vill, opts, runNpc, runMaint, flushMetrics, VERSION };
}

module.exports = { createCore, envOpts, VERSION };

});

let coreP = null;
function getCore(env) {
  if (!coreP) {
    const start = async () => { await __loadBuiltins(); const { createCore } = __req('server/app.js'); return createCore({ tursoUrl: process.env.TURSO_DATABASE_URL, tursoToken: process.env.TURSO_AUTH_TOKEN || '', cronBudgetMs: 25000 }); };
    // EdgeOne 的环境变量在 context.env 里：同步到 process.env，服务端代码统一从这里读取
    for (const [k, v] of Object.entries(env || {})) if (typeof v === 'string' && !(k in process.env)) process.env[k] = v;
    if (!process.env.TURSO_DATABASE_URL) return Promise.reject(new Error('没有配置 TURSO_DATABASE_URL：请在 EdgeOne 项目的环境变量里填写 Turso 数据库地址和令牌，然后重新部署'));
    coreP = start().catch(e => { coreP = null; throw e; });
  }
  return coreP;
}
const jsonErr = (status, code, error) => new Response(JSON.stringify({ ok: false, code, error }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequest(context) {
  const request = context.request;
  let core;
  try { core = await getCore(context.env); }
  catch (e) { console.error('[init]', e && e.stack || e); return jsonErr(500, 'init', '服务器初始化失败：' + (e && e.message || e)); }
  try {
    const headers = {}; request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.text() : '';
    const r = await core.handle({
      method: request.method, url: url.pathname + url.search, headers, body,
      ip: context.clientIp || headers['eo-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim() || '?',
      secure: url.protocol === 'https:' || headers['x-forwarded-proto'] === 'https',
    });
    return new Response(request.method === 'HEAD' || r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
  } catch (e) { console.error('[request]', e && e.stack || e); return jsonErr(500, 'server', '服务器开小差了，请稍后再试'); }
}
