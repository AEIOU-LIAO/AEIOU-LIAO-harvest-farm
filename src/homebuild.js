'use strict';
/* =====================================================
   第 1 期 · 家园自由建造（界面）
   侧栏「建造」→ 底部建造栏：选一个建筑 → 点地面格子放预览（绿色能放、红色不能放）→ 旋转 →「放在这里」
   不选建筑时点已经建好的建筑：移动 / 旋转 / 拆除（退一半金币）
   摆放规则和服务器是同一套（shared/config.js canPlace），这里只是提前提示，最终以服务器为准
   ===================================================== */
const BUILD = { on: false, type: '', rot: 0, at: null, sel: 0, moving: 0, busy: false, delArm: 0, listH: '' };
const BDEF = {}; CFG.BUILDINGS.forEach(b => { BDEF[b.id] = b; });
function homeBuildSt() { const R = (S && S.me.ranch) || {}; return { fields: Math.max(1, Math.ceil(((S && S.plots) || []).length / CFG.NPLOTS)), pastLv: R.pastLv || 1, pondLv: R.pondLv || 1 }; }
const buildItems = () => (S && S.me.layout) || [];
const buildSelItem = () => buildItems().find(x => x.id === BUILD.sel);
function buildCheck() {
  if (!BUILD.type || !BUILD.at) return '点地面选一个位置';
  const it = { type: BUILD.type, gx: BUILD.at[0], gz: BUILD.at[1], rot: BUILD.rot }, others = buildItems().filter(x => x.id !== BUILD.moving);
  const why = CFG.canPlace(CFG.homeOccupancy(homeBuildSt()), others, it, S.me.lv, !!BUILD.moving); if (why) return why;
  if (!BUILD.moving && S.me.gold < BDEF[BUILD.type].price) return '金币不够';
  return '';
}
function buildSync() {
  if (!BUILD.on) return;
  W3.setBuildState(homeBuildSt(), BUILD.moving);
  const why = BUILD.type && BUILD.at ? buildCheck() : null;
  W3.setGhost(BUILD.type && BUILD.at ? { type: BUILD.type, gx: BUILD.at[0], gz: BUILD.at[1], rot: BUILD.rot, ok: !why } : null);
  W3.setBuildSel(BUILD.sel); renderBuildBar(why);
}
function openBuild() {
  if (!S) return; if (view.key !== 'home') { toast('回到自己的家园才能建造', 'warn'); return; }
  closeModal(true); if (W3.mode === 'walk') setViewMode('top', true);
  Object.assign(BUILD, { on: true, type: '', rot: 0, at: null, sel: 0, moving: 0, delArm: 0, listH: '' });
  document.body.classList.add('building'); W3.buildMode(true, homeBuildSt()); sfx('open'); buildSync();
  if (!buildItems().length) toast('先在下面选一个建筑，再点地面上的格子；白色格子都能建');
}
function closeBuild() {
  if (!BUILD.on) return; Object.assign(BUILD, { on: false, type: '', at: null, sel: 0, moving: 0, delArm: 0 });
  document.body.classList.remove('building'); W3.buildMode(false); const bb = $('buildbar'); if (bb) bb.remove();
}
function buildPick(type) {
  const b = BDEF[type]; if (!b || BUILD.moving) return;
  if (b.status !== 'live') { toast(b.name + '：' + (b.desc || '即将开放'), 'warn'); return; }
  if (S.me.lv < b.lv) { toast(`${b.name}需要 Lv.${b.lv}`, 'warn'); return; }
  BUILD.sel = 0; BUILD.delArm = 0; BUILD.type = BUILD.type === type ? '' : type; BUILD.at = BUILD.type ? W3.centerCell(BUILD.type, BUILD.rot) : null; sfx('click'); buildSync();
}
function buildTap(cx, cy) {
  if (BUILD.busy) return;
  if (BUILD.type) { const c = W3.cellAt(cx, cy, BUILD.type, BUILD.rot); if (c) BUILD.at = c; sfx('click'); buildSync(); return; }
  const id = W3.builtAt(cx, cy); BUILD.sel = id && id !== BUILD.sel ? id : 0; BUILD.delArm = 0; if (id) sfx('click'); buildSync();
}
async function buildDo(path, body) { BUILD.busy = true; try { return await api(path, body); } finally { BUILD.busy = false; } }
async function buildRotate() {
  if (BUILD.type) { BUILD.rot = (BUILD.rot + 1) % 4; sfx('click'); buildSync(); return; }
  const it = buildSelItem(); if (!it) return;
  const r = await buildDo('/api/home/move', { id: it.id, gx: it.gx, gz: it.gz, rot: ((it.rot | 0) + 1) % 4 }); if (r) sfx('click'); buildSync();
}
async function buildConfirm() {
  const why = buildCheck(); if (why) { toast(why, 'warn'); sfx('err'); return; }
  const [gx, gz] = BUILD.at, b = BDEF[BUILD.type];
  if (BUILD.moving) {
    const r = await buildDo('/api/home/move', { id: BUILD.moving, gx, gz, rot: BUILD.rot });
    if (r) { toast('已移动：' + b.name); sfx('plant'); Object.assign(BUILD, { type: '', at: null, sel: r.result.item.id, moving: 0 }); }
  } else {
    const r = await buildDo('/api/home/place', { type: BUILD.type, gx, gz, rot: BUILD.rot });
    if (r) { toast(`建好了：${r.result.name}（-${r.result.cost} 金币）`); sfx('coin');
      const odd = BUILD.rot % 2 === 1; BUILD.at = odd ? [gx, gz + b.w] : [gx + b.w, gz]; } /* 预览挪到旁边，方便接着放（比如一段段围栅栏） */
  }
  buildSync();
}
function buildMove() { const it = buildSelItem(); if (!it) return; Object.assign(BUILD, { moving: it.id, type: it.type, rot: it.rot | 0, at: [it.gx, it.gz], sel: 0, delArm: 0 }); sfx('click'); buildSync(); }
async function buildRemove() {
  const it = buildSelItem(); if (!it) return;
  if (BUILD.delArm !== it.id) { BUILD.delArm = it.id; buildSync(); return; }
  const r = await buildDo('/api/home/remove', { id: it.id }); if (r) { toast(`已拆除${r.result.name}，退回 ${r.result.refund} 金币`); sfx('coin'); }
  Object.assign(BUILD, { sel: 0, delArm: 0 }); buildSync();
}
function buildCancel() { Object.assign(BUILD, { type: '', at: null, sel: 0, moving: 0, delArm: 0 }); sfx('click'); buildSync(); }
function renderBuildBar(why) {
  let bb = $('buildbar');
  if (!bb) { bb = document.createElement('div'); bb.id = 'buildbar'; document.body.appendChild(bb); BUILD.listH = '';
    bb.addEventListener('click', e => { const t = e.target.closest('[data-b],[data-bb]'); if (!t || t.disabled) return; ac(); if (t.dataset.b) return buildPick(t.dataset.b);
      ({ done: closeBuild, rot: buildRotate, ok: buildConfirm, cancel: buildCancel, move: buildMove, del: buildRemove })[t.dataset.bb](); }); }
  const btn = (k, ic, tx, cls, dis) => `<button class="btn sm ${cls || ''}" data-bb="${k}"${dis ? ' disabled' : ''}>${ICON(ic)}${tx}</button>`;
  let msg, act = '';
  if (BUILD.type) { const b = BDEF[BUILD.type];
    msg = `<b>${BUILD.moving ? '移动' : ''}${esc(b.name)}</b>${BUILD.moving ? '' : `<span class="bb-price">${ICON('coin')}${b.price}</span>`}${why ? `<em class="bad">${esc(why)}</em>` : '<em class="ok">可以放在这里</em>'}`;
    act = btn('rot', 'refresh', '旋转') + btn('ok', 'check', '放在这里', 'primary', !!why) + btn('cancel', 'x', '取消'); }
  else if (BUILD.sel && buildSelItem()) { const it = buildSelItem(), b = BDEF[it.type] || { name: it.type, price: 0 };
    msg = `<b>${esc(b.name)}</b><em>点「移动」后再点新位置</em>`;
    act = btn('move', 'target', '移动') + btn('rot', 'refresh', '旋转') + btn('del', 'shovel', BUILD.delArm === it.id ? '确认拆除？' : `拆除（退 ${Math.floor(b.price / 2)}）`, BUILD.delArm === it.id ? 'danger' : '') + btn('cancel', 'x', '取消选择'); }
  else msg = `<b>建造</b><em>选一个建筑放到地上；点已经建好的建筑可以移动、旋转、拆除</em>`;
  const head = `<div class="bb-top"><div class="bb-msg">${msg}</div>${btn('done', 'check', '完成', 'primary')}</div>${act ? `<div class="bb-act">${act}</div>` : ''}`;
  const cnt = {}; buildItems().forEach(x => { cnt[x.type] = (cnt[x.type] || 0) + 1; });
  const list = CFG.BUILDINGS.slice().sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || a.lv - b.lv).map(b => {
    const live = b.status === 'live', lock = live && S.me.lv < b.lv, full = b.max && (cnt[b.id] || 0) >= b.max;
    return `<button class="bcard${BUILD.type === b.id && !BUILD.moving ? ' on' : ''}${!live || lock ? ' lock' : ''}" data-b="${b.id}" title="${esc(b.desc || '')}">${live ? `<img src="${W3.buildIcon(b.id)}" alt="">` : `<i class="bc-soon">${ICON('lock')}</i>`}<b>${esc(b.name.replace(/（.*）/, ''))}</b><small>${!live ? '即将开放' : lock ? `Lv.${b.lv} 解锁` : full ? `已建满 ${b.max}` : `${ICON('coin')}${b.price}`}${b.max && live && !lock ? ` · ${cnt[b.id] || 0}/${b.max}` : ''}</small></button>`;
  }).join('');
  const html = head + '<div class="bb-list">' + list + '</div>';
  if (bb._h !== html) { const sl = bb.querySelector('.bb-list'), x = sl ? sl.scrollLeft : 0; bb.innerHTML = html; bb._h = html; const nl = bb.querySelector('.bb-list'); if (nl) nl.scrollLeft = x; }
}
