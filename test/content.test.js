// 内容数据化（v3.4 / V0.1）回归：content/*.jsonc 生成的配置必须和改造前的 3.3.2 完全一致
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const BC = require('../tools/build-content');
const { snapshot } = require('../tools/snapshot-config');
const root = path.join(__dirname, '..');

test('内容数据化：所有内容表和公式结果与改造前（3.3.2 快照）完全一致', () => {
  delete require.cache[require.resolve('../shared/config')];
  const a = snapshot(require('../shared/config')), b = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/config-snapshot.json'), 'utf8'));
  for (const s of [a, b]) delete s.data.VERSION;
  /* 3.3.2 里已有的表必须一张不少、内容完全一致；之后新增的表（区域、资源、家园布局、建筑…）允许存在 */
  for (const k of Object.keys(b.data)) assert.ok(k in a.data, '少了内容表 ' + k);
  for (const k of Object.keys(b.data)) assert.deepEqual(a.data[k], b.data[k], '内容表 ' + k + ' 变了');
  assert.deepEqual(a.fns, b.fns, '公式结果变了');
});

test('shared/content.js 与 content/ 同步（改了数据文件要重新生成）', () => {
  assert.doesNotThrow(() => BC.build({ check: true }));
});

test('内容校验能拦住常见错误', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'content-'));
  const copy = () => { fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp); for (const f of fs.readdirSync(path.join(root, 'content'))) fs.copyFileSync(path.join(root, 'content', f), path.join(tmp, f)); };
  const edit = (f, fn) => { const p = path.join(tmp, f + '.jsonc'); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
  copy(); assert.doesNotThrow(() => BC.load(tmp));
  copy(); edit('fish', t => t.replace('{"id":1,', '{"id":7,')); assert.throws(() => BC.load(tmp), /id 应该是 1/);
  copy(); edit('shop', t => t.replace('"$rules.fertPrice"', '"$rules.noSuchPrice"')); assert.throws(() => BC.load(tmp), /不存在的规则/);
  copy(); edit('zones', t => t.replace('"assets":[]', '"assets":["no_such_asset"]')); assert.throws(() => BC.load(tmp), /不存在的资源/);
  copy(); edit('dogs', t => t.replace('"id":"ruibao"', '"id":"fuwang"')); assert.throws(() => BC.load(tmp), /重复/);
  copy(); edit('sheep', t => t.replace('"lv":12,', '"lv":1,')); assert.throws(() => BC.load(tmp), /解锁等级比上一项低/);
  copy(); edit('rules', t => t.replace('"startGold": 300,', '"startGold": 300,, ')); assert.throws(() => BC.load(tmp), /格式错误/);
  copy(); edit('biomes', t => t.replace('"dry":"shrub"', '"dry":"no_such_biome"')); assert.throws(() => BC.load(tmp), /不存在的群系/);
  copy(); edit('buildings', t => t.replace('"w":1,"d":1,"price":200', '"w":0,"d":1,"price":200')); assert.throws(() => BC.load(tmp), /占地至少/);
  copy(); edit('zones', t => t.replace('"status":"dev"', '"status":"open"')); assert.throws(() => BC.load(tmp), /状态只能是/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('JSONC：注释里的 // 和字符串里的 // 都处理正确', () => {
  assert.deepEqual(BC.parseJSONC('// 头部注释\n{ "a": "http://x", /* 块注释 */ "b": [1, 2,], // 行尾\n }', 't'), { a: 'http://x', b: [1, 2] });
});

test('V0.3 家园网格：菜地、建筑、池塘、牧场、果园的占用随等级变化', () => {
  delete require.cache[require.resolve('../shared/config')]; const C = require('../shared/config');
  const cnt = o => { const c = {}; for (const v of o.cells) c[v] = (c[v] || 0) + 1; return c; };
  const a = cnt(C.homeOccupancy({ fields: 1, pastLv: 1, pondLv: 1 })), b = cnt(C.homeOccupancy({ fields: 20, pastLv: 100, pondLv: 100 }));
  assert.ok(b[C.OCC.field] > a[C.OCC.field] * 10, '开辟 20 片菜地后占用的格子更多');
  assert.ok(b[C.OCC.pasture] > a[C.OCC.pasture], '牧场扩建后更大'); assert.ok(b[C.OCC.pond] > a[C.OCC.pond], '池塘变多');
  assert.equal(a[C.OCC.structure], b[C.OCC.structure]); assert.ok(b[C.OCC.free] > 2000, '满级后仍有 2000 多格可以自由建造');
  assert.deepEqual(C.fieldCenter(1), [-25.5, -32]); assert.deepEqual(C.pastSize(1), [6.4, 5.2]); assert.deepEqual([1, 5, 6, 26, 100].map(C.pondsOf), [1, 1, 2, 6, 6]);
});
