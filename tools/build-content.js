// 内容构建：读取 content/*.jsonc（带注释的 JSON），校验后生成 shared/content.js（前后端共用）。
// 用法：node tools/build-content.js        （npm run build 会自动先跑这一步）
//       node tools/build-content.js --check （只校验，不写文件；生成结果和仓库里的不一致就报错）
// 规则：内容（作物、生物、商品、任务…）改 content/ 下的文件；公式和结算逻辑改 shared/config.js。
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'content'), out = path.join(root, 'shared', 'content.js');

/* ---------- JSONC：支持 // 和 /* *\/ 注释、末尾逗号 ---------- */
function parseJSONC(text, file) {
  let s = '', i = 0; const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') { let j = i + 1; while (j < n && text[j] !== '"') { if (text[j] === '\\') j++; j++; } s += text.slice(i, j + 1); i = j + 1; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); if (e < 0) throw new Error(file + '：注释没有结束'); i = e + 2; continue; }
    s += c; i++;
  }
  s = s.replace(/,(\s*[}\]])/g, '$1');
  try { return JSON.parse(s); } catch (e) { throw new Error(file + ' 格式错误：' + e.message); }
}

/* ---------- 表定义：文件名 → 导出名、校验规则 ---------- */
// kind: list（数组，每项 id 从 0 连续）/ keyed（数组，每项有唯一字符串 id）/ object / array（普通数组）
const TABLES = [
  { file: 'rules', key: 'RULES', kind: 'object' },
  { file: 'crops', key: 'CROPS_SRC', kind: 'object', check: c => { mustSeq(c.list, 'crops.list'); need(c.list, ['name', 'lv', 'seed', 'time', 'yield', 'price', 'exp', 'seasons', 'rarity', 'art'], 'crops.list'); } },
  { file: 'rarity', key: 'RARITY', kind: 'array' },
  { file: 'soils', key: 'SOILS', kind: 'list', fields: ['name', 'lv', 'speed', 'yield', 'base', 'step'] },
  { file: 'dogs', key: 'DOGS', kind: 'keyed', fields: ['name', 'price', 'lv', 'bite', 'base', 'perLv', 'max', 'desc'] },
  { file: 'collies', key: 'COLLIES', kind: 'array', check: a => { uniq(a.map(x => x.coat), 'collies.coat'); need(a, ['coat', 'name', 'lv', 'price'], 'collies'); } },
  { file: 'tasks', key: 'TASKS', kind: 'keyed', fields: ['tx', 'need'] },
  { file: 'weekly', key: 'WEEKLY', kind: 'keyed', fields: ['tx', 'need'] },
  { file: 'newbie', key: 'NEWBIE', kind: 'keyed' },
  { file: 'achievements', key: 'ACHIEVEMENTS', kind: 'keyed', fields: ['stat', 'need', 'tx'] },
  { file: 'themes', key: 'THEMES', kind: 'keyed', fields: ['name', 'price', 'th'] },
  { file: 'frames', key: 'FRAMES', kind: 'keyed' },
  { file: 'avatar', key: 'AVATAR_OPTS', kind: 'object' },
  { file: 'phrases', key: 'PHRASES', kind: 'array' },
  { file: 'shop', key: 'SHOP_ITEMS', kind: 'keyed', fields: ['name', 'price', 'desc'] },
  { file: 'fish', key: 'FISH', kind: 'list', fields: ['name', 'lv', 'price', 'time', 'yield', 'sell', 'exp'], lvUp: true },
  { file: 'sheep', key: 'SHEEP', kind: 'list', fields: ['name', 'lv', 'price', 'period', 'wool', 'woolName', 'sell', 'exp'], lvUp: true },
  { file: 'trees', key: 'TREES', kind: 'list', fields: ['name', 'fruit', 'lv', 'price', 'grow', 'period', 'yield', 'sell', 'exp'], lvUp: true },
  { file: 'ranch', key: 'RANCH', kind: 'object' },
  { file: 'misc', key: 'MISC', kind: 'object' },
  { file: 'zones', key: 'ZONES', kind: 'keyed', fields: ['name', 'status'] },
  { file: 'home', key: 'HOME', kind: 'object', check: h => { ['grid', 'structures', 'fields', 'ponds', 'pasture', 'orchard'].forEach(k => { if (!h[k]) fail('home 缺少 ' + k); }); uniq(h.structures.map(x => x.id), 'home.structures.id'); if (h.ponds.list.length !== 6) fail('home.ponds.list 应该有 6 个池塘'); } },
  { file: 'biomes', key: 'BIOMES', kind: 'keyed', fields: ['name', 'maxH', 'col', 'trees', 'rocks', 'walk'], check: a => { const ids = new Set(a.map(b => b.id)); a.forEach(b => { if (b.dry && !ids.has(b.dry)) fail(`群系 ${b.id} 的 dry 引用了不存在的群系 ${b.dry}`); }); } },
  { file: 'buildings', key: 'BUILDINGS', kind: 'keyed', fields: ['name', 'kind', 'w', 'd', 'price', 'lv', 'status'], check: a => a.forEach(b => { if (!['live', 'planned'].includes(b.status)) fail(`建筑 ${b.id} 的状态只能是 live / planned`); if (!(b.solid === undefined || b.solid === 0 || b.solid === 'seg' || b.solid > 0)) fail(`建筑 ${b.id} 的 solid 只能是 0、"seg" 或正数`); if (!(b.w >= 1 && b.d >= 1)) fail(`建筑 ${b.id} 的占地至少 1 × 1`); }) },
  { file: 'seasons', key: 'SEASONS', kind: 'object', check: s => { if (!Array.isArray(s.list) || s.list.length !== 4) fail('seasons.list 必须是 4 个季节'); const m = []; s.list.forEach(x => { need([x], ['id', 'name', 'months', 'crops', 'bonus', 'look'], 'seasons.list'); m.push(...x.months); }); if (m.slice().sort((a, b) => a - b).join() !== '1,2,3,4,5,6,7,8,9,10,11,12') fail('四个季节的月份要正好覆盖 1~12 月');
      uniq(s.festivals.map(f => f.id), 'seasons.festivals.id'); s.festivals.forEach(f => { need([f], ['id', 'name', 'start', 'end', 'kind', 'mult'], 'seasons.festivals'); if (!/^\d{4}-\d\d-\d\d$/.test(f.start) || !/^\d{4}-\d\d-\d\d$/.test(f.end) || f.end < f.start) fail(`节日 ${f.id} 的日期格式不对`); if (!['yield_mult', 'exp_mult', 'golden_mult', 'price_mult'].includes(f.kind)) fail(`节日 ${f.id} 的效果 ${f.kind} 不存在`); if (!(f.mult > 1 && f.mult <= 3)) fail(`节日 ${f.id} 的倍率要在 1~3 之间`); }); } },
  { file: 'assets', key: 'ASSETS', kind: 'keyed', fields: ['kind', 'name', 'stage'] },
];

function fail(msg) { throw new Error('内容校验失败：' + msg); }
function need(a, fields, where) { a.forEach((x, i) => fields.forEach(f => { if (x[f] === undefined) fail(`${where}[${i}] 缺少字段 ${f}`); })); }
function uniq(a, where) { const s = new Set(); a.forEach(v => { if (s.has(v)) fail(`${where} 重复：${v}`); s.add(v); }); }
function mustSeq(a, where) { if (!Array.isArray(a)) fail(where + ' 必须是数组'); a.forEach((x, i) => { if (x.id !== i) fail(`${where}[${i}] 的 id 应该是 ${i}，实际是 ${x.id}（id 必须从 0 连续，存档里存的是 id）`); }); }

/* $rules.xxx 引用：内容里可以写 "$rules.fertPrice"，构建时替换成 rules 里的值（避免同一个数写两遍） */
function resolveRefs(v, ctx, where) {
  if (typeof v === 'string' && v.startsWith('$rules.')) { const k = v.slice(7); if (!(k in ctx.RULES)) fail(`${where} 引用了不存在的规则 ${v}`); return ctx.RULES[k]; }
  if (Array.isArray(v)) return v.map((x, i) => resolveRefs(x, ctx, where + '[' + i + ']'));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = resolveRefs(v[k], ctx, where + '.' + k); return o; }
  return v;
}

function load(d) {
  d = d || dir; const C = {};
  for (const t of TABLES) {
    const f = path.join(d, t.file + '.jsonc'); if (!fs.existsSync(f)) fail('缺少文件 content/' + t.file + '.jsonc');
    const v = parseJSONC(fs.readFileSync(f, 'utf8'), 'content/' + t.file + '.jsonc');
    if (t.kind === 'object' && (typeof v !== 'object' || Array.isArray(v))) fail(t.file + ' 应该是对象');
    if (t.kind !== 'object' && !Array.isArray(v)) fail(t.file + ' 应该是数组');
    if (t.kind === 'list') mustSeq(v, t.file);
    if (t.kind === 'keyed') { if (v.some(x => typeof x.id !== 'string')) fail(t.file + ' 每一项都要有字符串 id'); uniq(v.map(x => x.id), t.file + '.id'); }
    if (t.fields) need(v, t.fields, t.file);
    if (t.lvUp) v.forEach((x, i) => { if (i && x.lv < v[i - 1].lv) fail(`${t.file}[${i}] ${x.name} 的解锁等级比上一项低`); });
    if (t.check) t.check(v);
    C[t.key] = v;
  }
  for (const k of Object.keys(C)) if (k !== 'RULES') C[k] = resolveRefs(C[k], C, k);
  // 交叉检查
  const assetIds = new Set(C.ASSETS.map(a => a.id));
  C.ZONES.forEach(z => (z.assets || []).forEach(a => { if (!assetIds.has(a)) fail(`区域 ${z.id} 引用了不存在的资源 ${a}`); }));
  C.ZONES.forEach(z => { if (!['live', 'planned', 'dev'].includes(z.status)) fail(`区域 ${z.id} 的状态只能是 live / planned / dev`); });
  return C;
}

function render(C) {
  const head = '/* 自动生成，不要手改：源文件在 content/*.jsonc，运行 node tools/build-content.js 重新生成 */\n';
  return head + "(function (root) {\n  'use strict';\n  const CONTENT = " + JSON.stringify(C) + ";\n  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT; else root.GAMECONTENT = CONTENT;\n})(typeof window !== 'undefined' ? window : globalThis);\n";
}

function build(opts) {
  const C = load(opts && opts.dir), txt = render(C);
  if (opts && opts.check) { const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''; if (cur !== txt) fail('shared/content.js 和 content/ 不一致，请运行 node tools/build-content.js'); return C; }
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== txt) fs.writeFileSync(out, txt);
  return C;
}
module.exports = { build, load, parseJSONC, TABLES };
if (require.main === module) { const C = build({ check: process.argv.includes('--check') }); console.log('content ok:', TABLES.map(t => t.file + (Array.isArray(C[t.key]) ? '(' + C[t.key].length + ')' : '')).join(' ')); }
