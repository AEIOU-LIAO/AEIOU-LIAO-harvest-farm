// 给 shared/config.js 拍快照：所有非函数字段 + 关键公式在一组样本上的结果。
// 用法：node tools/snapshot-config.js > test/fixtures/config-snapshot.json
// 内容数据化等重构前后跑一次，比对结果必须完全一致（test/content.test.js 会自动比对）。
const CFG = require('../shared/config');
function snapshot(C) {
  const data = {}, fns = {};
  for (const k of Object.keys(C).sort()) { const v = C[k]; if (typeof v !== 'function') data[k] = v; }
  const lvs = [1, 2, 5, 10, 20, 45, 46, 50, 100, 200, 500, 1000, 2000, 3000, 4000];
  const s = (name, args) => { try { fns[name] = args.map(a => C[name](...[].concat(a))); } catch (e) { fns[name] = 'ERR ' + e.message; } };
  s('expNeed', lvs); s('dogExpNeed', lvs); s('plotCost', [6, 10, 20, 24]); s('plotNeedLv', [6, 10, 20, 24]); s('fieldNeedLv', [1, 2, 10, 19]); s('fieldCost', [1, 2, 10, 19]);
  s('pondCapOf', [1, 5, 50, 100]); s('pastureCapOf', [1, 5, 50, 100]); s('orchardCapOf', [1, 5, 50, 100]); s('ranchNeedLv', [1, 2, 50, 100]);
  s('ranchUpCost', [['pond', 2], ['pasture', 10], ['orchard', 50]]); s('herdOf', [1, 10, 50, 100]); s('orderSlots', lvs); s('stealCapPct', [1, 5, 50]);
  s('soilCost', [[1, 0], [2, 5], [3, 30]]); s('redCost', [0, 10]); s('stageOf', [0, 0.05, 0.2, 0.5, 0.8, 1]);
  s('dogChance', C.DOGS.map(d => [d, 10]));
  return { data, fns };
}
if (require.main === module) process.stdout.write(JSON.stringify(snapshot(CFG), null, 1));
module.exports = { snapshot };
