/* =====================================================
   方案 C · 清河镇（2026-10-26 起，第一版：能逛的小镇 + 场景编辑器）
   - 全部建筑用 v9 套件零件拼（src/kit3.js），布局在 art/town/qinghe.json（编辑器导出的就是这个格式）
   - 主人在镇上走：摇杆 / WASD，拖动画面转镜头；房子、墙、柱子挡路
   - 场景编辑器（网址带 ?edit=1 时顶部出现「编辑」）：从左边选组合（整栋房子）或零件，点地面摆放；点已有的东西选中，
     R 转 90°、方向键挪 0.5 米（Shift 2 米）、Delete 删除、Ctrl+Z 撤销、C 复制一份；「导出」复制 JSON 并下载，换掉 art/town/qinghe.json 就是新布局
   - 以后：集市摆摊、商店、好友见面（玩法在后面的版本）
   ===================================================== */
const Town = (() => {
  const T = THREE, EDIT = /[?&]edit=1\b/.test(location.search), DRAFT = 'hf_town_draft', LAYOUT_URL = 'art/town/qinghe.json';
  const rng = s => { let x = s >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
  const snap = (v, s) => Math.round(v / s) * s;
  const ASM_NAMES = { sample_house_4x4: '瓦房', farmhouse_s1_thatch: '茅草屋', farmhouse_s3_porch: '门廊瓦房', market_stall: '集市摊位（两个）', square_pavilion_with_red_rail: '红栏杆方亭', fence_gate: '栅栏门', dock_and_arch_bridge: '码头与拱桥' };
  let PNAMES = {}; const pname = n => PNAMES[n] || n.replace(/^kit_/, ''), aname = n => ASM_NAMES[n] || n;
  const PART_GROUPS = [['地基地面', /^kit_(found|floor|step|path)/], ['墙', /^kit_wall/], ['柱梁', /^kit_(column|beam|bracket)/], ['屋顶', /^kit_roof/], ['门窗', /^kit_(door|window|shutter)/], ['门廊', /^kit_porch/], ['道具', /^kit_prop/], ['植物', /^kit_plant/], ['其他', /./]];

  function build(z, S0) {
    const canvas = document.getElementById('cv'), scene = new T.Scene(), sky = new T.Color('#bfe1f5');
    scene.background = sky; scene.fog = new T.Fog(sky, 70, 260);
    const hemi = new T.HemisphereLight(0xfff6e8, 0x6a8a60, 0.95); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff0d6, 2.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 220 }); sun.shadow.bias = -0.0004; scene.add(sun, sun.target);
    const groundAt = () => 0, LIM = 66;
    /* 地面：草地，镇中心偏暖的泥土色 */
    { const gg = new T.PlaneGeometry(260, 260, 64, 64); gg.rotateX(-Math.PI / 2); const P = gg.attributes.position, col = new Float32Array(P.count * 3), a = new T.Color('#86b95a'), b = new T.Color('#6fa24a'), d = new T.Color('#c9b27f'), c = new T.Color();
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), z2 = P.getZ(i), n = (Math.sin(x * 0.13) * Math.cos(z2 * 0.11) + Math.sin(x * 0.05 + z2 * 0.07)) * 0.25 + 0.5; c.copy(a).lerp(b, n); const r = Math.hypot(x / 40, z2 / 16); if (r < 1) c.lerp(d, (1 - r) * 0.35); c.toArray(col, i * 3); }
      gg.setAttribute('color', new T.BufferAttribute(col, 3)); const gm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }); W3.snowify(gm, 1, 1); const g = new T.Mesh(gg, gm); g.receiveShadow = true; g.userData.ground = 1; scene.add(g); var ground = g; }
    /* 远山一圈（只看） */
    { const r = rng(311), geo = new T.ConeGeometry(1, 1, 6, 1), m = new T.MeshStandardMaterial({ color: new T.Color('#7fa8a0'), roughness: 1, flatShading: true }), n = 46, im = new T.InstancedMesh(geo, m, n), o = new T.Object3D();
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * 0.1, d = 150 + r() * 40, h = 25 + r() * 45; o.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d); o.scale.set(20 + r() * 25, h, 20 + r() * 25); o.rotation.y = r() * 6; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
      im.frustumCulled = false; scene.add(im); }
    /* 树：程序拼的圆冠树（套件植物第三批到了以后换掉） */
    const trees = { im: null };
    function plantTrees(list) {
      if (trees.im) { trees.im.forEach(x => { scene.remove(x); x.geometry.dispose(); }); }
      const r = rng(77), crown = new T.IcosahedronGeometry(1, 1), trunk = new T.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0), cm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), tm = new T.MeshStandardMaterial({ color: new T.Color('#7a5236'), roughness: 0.9 });
      W3.snowify(cm); const n = list.length, ci = new T.InstancedMesh(crown, cm, n * 2), ti = new T.InstancedMesh(trunk, tm, n), o = new T.Object3D(), pal = ['#5fae4a', '#4f9a44', '#7cc05a', '#e8a6b8', '#f2c45a'].map(c => new T.Color(c));
      list.forEach(([x, z2, s], i) => { s = s || 1; o.position.set(x, 0, z2); o.scale.set(s, 2.2 * s, s); o.rotation.set(0, 0, 0); o.updateMatrix(); ti.setMatrixAt(i, o.matrix); const c = pal[r() < 0.12 ? 3 + (r() < 0.5 ? 1 : 0) : Math.floor(r() * 3)];
        for (let k = 0; k < 2; k++) { o.position.set(x + (k ? 0.5 : -0.3) * s, (2.6 + k * 0.9) * s, z2 + (k ? -0.3 : 0.3) * s); o.scale.setScalar((1.5 - k * 0.35) * s); o.rotation.set(r(), r() * 6, 0); o.updateMatrix(); ci.setMatrixAt(i * 2 + k, o.matrix); ci.setColorAt(i * 2 + k, c); } });
      [ci, ti].forEach(m => { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }); trees.im = [ci, ti]; trees.list = list;
    }
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 600);
    /* ---------- 套件 ---------- */
    let lib = null, kit = null, built = null, dead = false, layout = null, items = [], boxes = [];
    const ready = (async () => {
      lib = new Assets3({ manifest: GAMECFG.ASSETS }); kit = new Kit3.Kit(lib, { tint: (S0 && S0.tint) || null, onMat: m => W3.snowify(m) });   /* 冬天和家园一样积雪（共用家园的积雪着色器和季节） */
      const [, L] = await Promise.all([kit.load('1k'), fetch(LAYOUT_URL).then(r => r.json()), EDIT ? fetch('art/v9_kit/names.json').then(r => r.json()).then(j => { PNAMES = j; }).catch(() => { }) : null]);
      if (dead) return; layout = L; items = (EDIT && loadDraft()) || L.items; plantTrees(L.trees || []); await rebuild();
      if (L.spawn && !EDIT) { hero.pos.set(L.spawn[0], 0, L.spawn[1]); hero.face = L.spawn[2] || 0; camYaw = hero.face + Math.PI; }
    })().catch(e => { console.warn('清河镇加载失败', e); say('小镇加载失败：' + e.message, 4000); });
    let rebuilding = null;
    async function rebuild() {
      const mine = rebuilding = {}; const list = await Kit3.expand(items); if (dead || mine !== rebuilding) return;
      if (built) built.dispose(); built = kit.build(list); scene.add(built.group);
      /* 挡路的盒子：去掉地面、台阶这种扁的，和头顶上的屋顶 */
      boxes = built.boxes.filter(b => b.box.max.y - b.box.min.y > 0.5 && b.box.min.y < 1.6).map(b => [b.box.min.x - 0.25, b.box.min.z - 0.25, b.box.max.x + 0.25, b.box.max.z + 0.25]);
      if (ed) ed.refresh();
    }
    const blocked = (x, z2) => { if (Math.abs(x) > LIM || Math.abs(z2) > LIM) return true; for (const b of boxes) if (x > b[0] && x < b[2] && z2 > b[1] && z2 < b[3]) return true; return false; };

    /* ---------- 主人 ---------- */
    const hero = { pos: new T.Vector3(-34, 0, 0), face: Math.PI / 2, spd: 0, ph: 0, g: new T.Group(), rig: null };
    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.52, 28), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; hero.g.add(ring); scene.add(hero.g);
    let heroLib = null;
    (async () => { try { await ready; heroLib = lib; const rig = await Entity3.spawn(lib, PREF.v3hero || HERO_DEFAULT, 'hero', { tier: '1k' }); if (dead) { Entity3.release(lib, rig, true); return; } rig.object.scale.setScalar(0.8); rig.play('idle', 0); hero.g.add(rig.object); hero.rig = rig; } catch (e) { console.warn('镇上主人模型加载失败', e); } })();
    let camYaw = -Math.PI / 2, camPitch = 0.42, camDist = 9;
    const input = { x: 0, z: 0, run: false }, keys = new Set(), tmp = new T.Vector3();

    /* ---------- 界面 ---------- */
    const ui = document.createElement('div'); ui.id = 'huntui'; ui.className = 'townui'; ui.innerHTML = `
      <div class="hu-top"><b>${esc(z.name)}</b><span class="tw-info"></span>${EDIT ? `<button class="btn sm" data-edit>${ICON('hammer')}编辑</button>` : ''}<button class="btn sm primary" data-home>${ICON('home')}回家</button></div>
      <div class="hu-msg"></div><div class="hu-joy"><i></i></div>`;
    document.body.appendChild(ui); document.body.classList.add('hunting');
    const $u = s => ui.querySelector(s), joy = $u('.hu-joy'), knob = joy.querySelector('i');
    let msgT = 0; const say = (t, ms) => { const m = $u('.hu-msg'); m.textContent = t; m.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('on'), ms || 1800); };
    $u('[data-home]').onclick = () => Zones.enter('home');
    let jid = -1, jc = [0, 0]; const JR = 46;
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; joy.setPointerCapture(e.pointerId); jmove(e); });
    const jmove = e => { if (e.pointerId !== jid) return; let dx = e.clientX - jc[0], dy = e.clientY - jc[1]; const d = Math.hypot(dx, dy); if (d > JR) { dx *= JR / d; dy *= JR / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.x = dx / JR; input.z = dy / JR; input.run = d > JR * 0.95; };
    const jend = e => { if (e.pointerId !== jid) return; jid = -1; knob.style.transform = ''; input.x = input.z = 0; input.run = false; };
    joy.addEventListener('pointermove', jmove); joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    /* 拖动画面：漫游时转镜头，编辑时平移 / 转镜头；没怎么动就算「点了一下」 */
    const drag = { id: -1, x: 0, y: 0, sx: 0, sy: 0, btn: 0 };
    const cvDown = e => { if (drag.id !== -1) return; drag.id = e.pointerId; drag.x = drag.sx = e.clientX; drag.y = drag.sy = e.clientY; drag.btn = e.button; };
    const cvMove = e => { if (ed && ed.on) ed.hover(e); if (e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (ed && ed.on) { if (drag.btn === 2 || e.shiftKey) { ed.cam.yaw -= dx * 0.007; ed.cam.pitch = Math.max(0.35, Math.min(1.45, ed.cam.pitch + dy * 0.004)); } else { const k = ed.cam.dist * 0.0018, s = Math.sin(ed.cam.yaw), c = Math.cos(ed.cam.yaw); ed.cam.tx -= (dx * c + dy * s) * k; ed.cam.tz -= (-dx * s + dy * c) * k; } return; }
      camYaw -= dx * 0.007; camPitch = Math.max(0.12, Math.min(1.1, camPitch + dy * 0.004)); };
    const cvUp = e => { if (e.pointerId !== drag.id) return; drag.id = -1; if (ed && ed.on && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6 && drag.btn === 0) ed.click(e); };
    const wheel = e => { if (ed && ed.on) { ed.cam.dist = Math.max(6, Math.min(140, ed.cam.dist * (e.deltaY > 0 ? 1.1 : 0.91))); return; } camDist = Math.max(4, Math.min(18, camDist * (e.deltaY > 0 ? 1.08 : 0.93))); };
    const ctx = e => { if (ed && ed.on) e.preventDefault(); };
    canvas.addEventListener('pointerdown', cvDown); canvas.addEventListener('pointermove', cvMove); canvas.addEventListener('pointerup', cvUp); canvas.addEventListener('pointercancel', cvUp); canvas.addEventListener('wheel', wheel, { passive: true }); canvas.addEventListener('contextmenu', ctx);
    const KM = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    const keyIn = () => { if (jid !== -1) return; let x = 0, z2 = 0; keys.forEach(k => { const v = KM[k]; if (v) { x += v[0]; z2 += v[1]; } }); const l = Math.hypot(x, z2) || 1; input.x = x / l; input.z = z2 / l; input.run = keys.has('shift'); };
    const kd = e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; const k = e.key.toLowerCase(); if (ed && ed.on) { if (ed.key(e, k)) e.preventDefault(); return; } if (KM[k] || k === 'shift') { e.preventDefault(); keys.add(k); keyIn(); } };
    const ku = e => { const k = e.key.toLowerCase(); if (keys.delete(k)) keyIn(); };
    document.addEventListener('keydown', kd, true); document.addEventListener('keyup', ku, true);
    say('欢迎来到清河镇', 2200);

    /* ---------- 场景编辑器 ---------- */
    const ed = EDIT ? makeEditor() : null;
    function loadDraft() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); return d && Array.isArray(d.items) ? d.items : null; } catch (e) { return null; } }
    function makeEditor() {
      const E = { on: false, sel: -1, brush: null, rot: 0, hist: [], cam: { tx: 0, tz: 0, yaw: 0, pitch: 1.0, dist: 60 }, ghost: null, ghostKey: '', hp: null, selBox: null };
      const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
      const panel = document.createElement('div'); panel.className = 'tw-ed'; panel.style.display = 'none'; ui.appendChild(panel);
      const bar = document.createElement('div'); bar.className = 'tw-edbar'; bar.style.display = 'none'; ui.appendChild(bar);
      bar.innerHTML = `<button class="btn sm" data-er>转 90°</button><button class="btn sm" data-ec>复制</button><button class="btn sm" data-ed>删除</button><button class="btn sm" data-eu>撤销</button><span class="tw-sel"></span>
        <button class="btn sm" data-es>存草稿</button><button class="btn sm" data-el>读正式布局</button><button class="btn sm primary" data-ex>导出 JSON</button>`;
      const selBoxMat = new T.LineBasicMaterial({ color: 0xffd34a });
      const snapOf = b => b && b.a ? 1 : 0.5;
      const push = () => { E.hist.push(JSON.stringify(items)); if (E.hist.length > 80) E.hist.shift(); };
      const change = () => { rebuild(); E.saveLocal(false); };
      E.saveLocal = loud => { try { localStorage.setItem(DRAFT, JSON.stringify({ items, at: Date.now() })); if (loud) say('草稿已存在这台设备上'); } catch (e) { } };
      function renderPanel() {
        const asmNames = (layout && layout.assemblies) || [], names = kit ? kit.names() : [], groups = PART_GROUPS.map(([t, re]) => [t, []]);
        names.forEach(n => { const i = PART_GROUPS.findIndex(([, re]) => re.test(n)); groups[i][1].push(n); });
        const item = (k, v, label) => `<button class="tw-it${E.brush && E.brush[k] === v ? ' on' : ''}" data-${k}="${esc(v)}">${esc(label)}</button>`;
        panel.innerHTML = `<div class="tw-h">组合（整栋）</div>${asmNames.map(n => item('a', n, aname(n))).join('')}` + groups.filter(g => g[1].length).map(([t, l]) => `<div class="tw-h">${t}</div>${l.map(n => item('p', n, pname(n))).join('')}`).join('') + `<div class="tw-h">提示</div><p class="tw-tip">点地面摆放 · 点东西选中 · 拖动平移 · 右键或 Shift 拖动转镜头 · 滚轮缩放<br>R 转向 · 方向键挪动（Shift 2 米）· Delete 删除 · C 复制 · Ctrl+Z 撤销 · Esc 取消</p>`;
        panel.querySelectorAll('[data-a],[data-p]').forEach(b => b.onclick = () => { const k = b.dataset.a ? 'a' : 'p', v = b.dataset[k]; E.brush = E.brush && E.brush[k] === v ? null : { [k]: v }; E.sel = -1; renderPanel(); renderSel(); E.ghostKey = ''; });
      }
      function renderSel() { const it = items[E.sel]; bar.querySelector('.tw-sel').textContent = it ? `选中：${it.a ? aname(it.a) : pname(it.p)}（${it.x}, ${it.z}，${it.r || 0}°）` : E.brush ? `摆放：${E.brush.a ? aname(E.brush.a) : pname(E.brush.p)}（${E.rot}°）` : `共 ${items.length} 件`;
        if (E.selBox) { scene.remove(E.selBox); E.selBox.geometry.dispose(); E.selBox = null; }
        if (it && built) { const bx = new T.Box3(); built.boxes.forEach(b => { if (b.id === E.sel) bx.union(b.box); }); if (!bx.isEmpty()) { E.selBox = new T.Box3Helper(bx, 0xffd34a); E.selBox.material = selBoxMat; scene.add(E.selBox); } } }
      E.refresh = () => { renderSel(); };
      const groundHit = e => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; };
      E.hover = e => { if (!E.brush) return; const p = groundHit(e); if (!p) return; const s = snapOf(E.brush); E.hp = [snap(p.x, s), snap(p.z, s)]; };
      async function updateGhost() {
        const key = E.brush && E.hp ? JSON.stringify([E.brush, E.hp, E.rot]) : ''; if (key === E.ghostKey) return; E.ghostKey = key;
        if (E.ghost) { E.ghost.dispose(); E.ghost = null; } if (!key) return;
        const list = await Kit3.expand([Object.assign({ x: E.hp[0], y: 0, z: E.hp[1], r: E.rot }, E.brush)]); if (key !== E.ghostKey || !kit) return;
        if (E.ghost) E.ghost.dispose(); E.ghost = kit.build(list, { boxes: false, shadow: false, material: E.ghostMat || (E.ghostMat = new T.MeshBasicMaterial({ color: 0x8fe0ff, transparent: true, opacity: 0.45, depthWrite: false })) }); scene.add(E.ghost.group);
      }
      E.click = e => {
        const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
        if (E.brush) { const p = groundHit(e); if (!p) return; const s = snapOf(E.brush); push(); items.push(Object.assign({}, E.brush, { x: snap(p.x, s), y: 0, z: snap(p.z, s), r: E.rot })); change(); sfx('click'); return; }
        const hits = built ? ray.intersectObjects(built.ims, false) : []; E.sel = hits.length ? built.pick(hits[0]) : -1; renderSel();
      };
      const mv = (dx, dz) => { const it = items[E.sel]; if (!it) return; push(); it.x = +(it.x + dx).toFixed(2); it.z = +(it.z + dz).toFixed(2); change(); };
      const rot = () => { if (items[E.sel]) { push(); items[E.sel].r = ((items[E.sel].r || 0) + 90) % 360; change(); } else { E.rot = (E.rot + 90) % 360; E.ghostKey = ''; renderSel(); } };
      const del = () => { if (!items[E.sel]) return; push(); items.splice(E.sel, 1); E.sel = -1; change(); };
      const dup = () => { const it = items[E.sel]; if (!it) return; push(); items.push(Object.assign({}, it, { x: it.x + (it.a ? 6 : 2) })); E.sel = items.length - 1; change(); };
      const undo = () => { const s = E.hist.pop(); if (!s) return say('没有可以撤销的了'); items = JSON.parse(s); E.sel = -1; change(); };
      E.key = (e, k) => {
        const st = e.shiftKey ? 2 : 0.5, s = Math.sin(E.cam.yaw), c = Math.cos(E.cam.yaw), dir = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
        if (dir) { const dx = dir[0] * c + dir[1] * s, dz = -dir[0] * s + dir[1] * c, ax = Math.abs(dx) > Math.abs(dz); mv(ax ? Math.sign(dx) * st : 0, ax ? 0 : Math.sign(dz) * st); return true; }
        if (k === 'r') { rot(); return true; } if (k === 'delete' || k === 'backspace') { del(); return true; } if (k === 'c' && !e.ctrlKey && !e.metaKey) { dup(); return true; }
        if (k === 'z' && (e.ctrlKey || e.metaKey)) { undo(); return true; } if (k === 'escape') { E.brush = null; E.sel = -1; E.ghostKey = ''; renderPanel(); renderSel(); return true; } return false; };
      bar.querySelector('[data-er]').onclick = rot; bar.querySelector('[data-ec]').onclick = dup; bar.querySelector('[data-ed]').onclick = del; bar.querySelector('[data-eu]').onclick = undo;
      bar.querySelector('[data-es]').onclick = () => E.saveLocal(true);
      bar.querySelector('[data-el]').onclick = () => { if (!layout) return; push(); items = JSON.parse(JSON.stringify(layout.items)); E.sel = -1; change(); say('已换回正式布局（可以撤销）'); };
      bar.querySelector('[data-ex]').onclick = () => { const out = Object.assign({}, layout, { items: items.map(it => { const o = {}; ['a', 'p', 'x', 'y', 'z', 'r', 'tint'].forEach(k => { if (it[k] !== undefined && it[k] !== null && !(k === 'y' && !it[k]) && !(k === 'r' && !it[k])) o[k] = it[k]; }); return o; }), exported: new Date().toISOString() });
        const txt = JSON.stringify(out, null, 1); try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) { }
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'qinghe.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); say('已导出 qinghe.json（也复制到了剪贴板）', 3000); };
      E.toggle = on => { E.on = on; panel.style.display = bar.style.display = on ? '' : 'none'; joy.style.display = on ? 'none' : ''; hero.g.visible = !on; ui.classList.toggle('editing', on);
        if (on) { E.cam.tx = hero.pos.x; E.cam.tz = hero.pos.z; E.cam.yaw = camYaw; renderPanel(); renderSel(); } else { E.brush = null; E.sel = -1; E.ghostKey = ''; updateGhost(); renderSel(); } };
      E.update = () => { updateGhost(); const C = E.cam, cp = Math.cos(C.pitch); cam.position.set(C.tx + Math.sin(C.yaw) * cp * C.dist, Math.sin(C.pitch) * C.dist, C.tz + Math.cos(C.yaw) * cp * C.dist); cam.lookAt(C.tx, 0, C.tz); sun.position.set(C.tx + 40, 80, C.tz + 30); sun.target.position.set(C.tx, 0, C.tz); };
      $u('[data-edit]').onclick = () => E.toggle(!E.on);
      return E;
    }

    /* ---------- 每帧 ---------- */
    function updateHero(dt) {
      const mag = Math.min(1, Math.hypot(input.x, input.z)), sy = Math.sin(camYaw), cy = Math.cos(camYaw), mx = input.x * cy + input.z * sy, mz = -input.x * sy + input.z * cy;
      const want = mag > 0.05 ? (input.run ? 4.6 : 3.0) * Math.max(0.35, mag) : 0; hero.spd += (want - hero.spd) * Math.min(1, dt * 10);
      if (mag > 0.05) { const f = Math.atan2(mx, mz); let d = f - hero.face; d = Math.atan2(Math.sin(d), Math.cos(d)); hero.face += Math.max(-dt * 12, Math.min(dt * 12, d)); }
      /* 分小步走，低帧率也不会穿墙 */
      const fx = Math.sin(hero.face), fz = Math.cos(hero.face), steps = Math.max(1, Math.ceil(hero.spd * dt / 0.2)), st = hero.spd * dt / steps;
      for (let i = 0; i < steps; i++) { const nx = hero.pos.x + fx * st, nz = hero.pos.z + fz * st; if (!blocked(nx, nz)) { hero.pos.x = nx; hero.pos.z = nz; } else if (!blocked(nx, hero.pos.z)) hero.pos.x = nx; else if (!blocked(hero.pos.x, nz)) hero.pos.z = nz; }
      hero.g.position.copy(hero.pos); hero.g.rotation.y = hero.face;
      const moving = hero.spd > 0.3; hero.ph += dt * (hero.spd > 4.6 ? 11 : 7.5) * (moving ? 1 : 0);
      if (hero.rig) { const r = hero.rig; r.play(hero.spd > 2.2 ? 'run' : moving ? 'walk' : 'idle'); r.pace(hero.spd, 0.8); r.update(dt); if (r.faked) r.heroGait({ phase: hero.ph, amp: moving ? 0.55 * Math.min(1, hero.spd / 3) : 0, lean: moving ? 0.05 : 0 }); else r.liven(); }
      if (moving && drag.id === -1) { let d = hero.face + Math.PI - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.6) camYaw += d * Math.min(1, dt * 1.2); }
      const cp = Math.cos(camPitch); tmp.set(hero.pos.x, 1.2, hero.pos.z); cam.position.set(tmp.x + Math.sin(camYaw) * cp * camDist, tmp.y + Math.sin(camPitch) * camDist, tmp.z + Math.cos(camYaw) * cp * camDist);
      if (cam.position.y < 0.8) cam.position.y = 0.8; cam.lookAt(tmp); sun.position.set(hero.pos.x + 40, 80, hero.pos.z + 30); sun.target.position.copy(hero.pos);
    }
    /* 昼夜：跟家园一样按「昼夜」设置 / 真实时间；夜里窗纸、灯笼亮 */
    function env() {
      const h = curHour(), night = h < 5 || h > 20 ? 1 : h < 7 ? (7 - h) / 2 : h > 18 ? (h - 18) / 2 : 0, dusk = Math.max(0, 1 - Math.abs(h - 18.5) / 1.5);
      const sn = W3.snow || 0; sky.set('#bfe1f5').lerp(new T.Color('#e2e8ee'), sn * 0.6).lerp(new T.Color('#f0b07a'), dusk * 0.6).lerp(new T.Color('#1c2a48'), night); scene.fog.color.copy(sky);
      hemi.intensity = 0.95 - night * 0.7; hemi.color.set('#fff6e8').lerp(new T.Color('#8fa8e0'), night * 0.6); sun.intensity = 2.0 * (1 - night * 0.85) * (1 - sn * 0.2); sun.color.set('#fff0d6').lerp(new T.Color('#ffb070'), dusk * 0.7);
      if (kit) kit.glow.forEach(m => { m.emissiveIntensity = night * 1.6; });
    }
    let hudT = 0, tAcc = 0;
    return {
      scene, get camera() { return cam; },
      update(dt) { tAcc += dt; dt = Math.min(dt, 0.05); if (ed && ed.on) ed.update(); else updateHero(dt); hudT -= dt; if (hudT <= 0) { hudT = 0.5; env(); const inf = $u('.tw-info'); if (inf && built) inf.textContent = EDIT ? `${items.length} 件 · ${Math.round(built.tris / 1000)}k 面` : ''; } },
      resize(w, h) { cam.aspect = w / h; cam.updateProjectionMatrix(); },
      dispose() { dead = true; document.removeEventListener('keydown', kd, true); document.removeEventListener('keyup', ku, true); canvas.removeEventListener('pointerdown', cvDown); canvas.removeEventListener('pointermove', cvMove); canvas.removeEventListener('pointerup', cvUp); canvas.removeEventListener('pointercancel', cvUp); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', ctx);
        ui.remove(); document.body.classList.remove('hunting'); if (hero.rig && heroLib) Entity3.release(heroLib, hero.rig, true); if (built) built.dispose(); if (ed && ed.ghost) ed.ghost.dispose(); Zones.disposeTree(scene); },
      debug: () => ({ ready: !!built, items: items.length, tris: built ? built.tris : 0, miss: built ? built.miss : [], boxes: boxes.length, hero: [+hero.pos.x.toFixed(2), +hero.pos.z.toFixed(2)], edit: !!(ed && ed.on), sel: ed ? ed.sel : -1, blockedAt: (x, z2) => blocked(x, z2) }),
      tp(x, z2, face) { hero.pos.set(x, 0, z2); if (face !== undefined) { hero.face = face; camYaw = face + Math.PI; } }, setInput(o) { Object.assign(input, o); },
      editor: ed, ready,
    };
  }
  Zones.BUILDERS.town = build;
  return { EDIT };
})();
