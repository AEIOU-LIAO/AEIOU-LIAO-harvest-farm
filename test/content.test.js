// 内容数据化（v3.4 / V0.1）回归：content/*.jsonc 生成的配置必须和改造前的 3.3.2 完全一致
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const BC = require('../tools/build-content');
const { snapshot } = require('../tools/snapshot-config');
const root = path.join(__dirname, '..');

test('内容数据化：所有内容表和公式结果与改造前（3.3.2 快照）完全一致', () => {
  delete require.cache[require.resolve('../shared/config')];
  const a = snapshot(require('../shared/config')), b = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/config-snapshot.json'), 'utf8'));
  for (const s of [a, b]) { delete s.data.VERSION; delete s.data.ZONES; delete s.data.ASSETS; }
  assert.deepEqual(Object.keys(a.data).sort(), Object.keys(b.data).sort());
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
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('JSONC：注释里的 // 和字符串里的 // 都处理正确', () => {
  assert.deepEqual(BC.parseJSONC('// 头部注释\n{ "a": "http://x", /* 块注释 */ "b": [1, 2,], // 行尾\n }', 't'), { a: 'http://x', b: [1, 2] });
});
