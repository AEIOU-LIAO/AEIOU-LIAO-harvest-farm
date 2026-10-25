/* =====================================================
   区域系统（V0.3）
   - 世界由多个区域组成（content/zones.jsonc）：家园 + 规划中的名山猎场、河谷、大漠、雪岭、龙脊山脉…
   - 一个区域一个场景：进入时生成 / 加载，离开时释放全部几何体和贴图；家园在后台暂停
   - 进入 / 离开有过场（淡入淡出）；每个区域有性能预算（同屏三角面、绘制次数），开发模式下实时显示
   - 「试炼野外」（只在网址带 ?dev=1 时出现）：用「种子 + 生物群系」（content/biomes.jsonc）程序生成野外地形，
     验证以后名山猎场等野外区域的生成方式
   ===================================================== */
const Zones = (() => {
  const T = THREE, ZCFG = GAMECFG;
  const DEV = /[?&]dev=1\b/.test(location.search);
  let cur = 'home', active = null, busy = false; const listeners = [];
  const list = () => ZCFG.ZONES.filter(z => z.status !== 'dev' || DEV);
  const byId = id => ZCFG.ZONES.find(z => z.id === id);

  function fade(on) { return new Promise(res => { let el = document.getElementById('zonefade'); if (!el) { el = document.createElement('div'); el.id = 'zonefade'; document.body.appendChild(el); } requestAnimationFrame(() => el.classList.toggle('on', on)); setTimeout(res, 420); }); }
  /* 释放一棵场景树里所有的几何体、材质、贴图（同一个对象只释放一次） */
  function disposeTree(root) {
    const seen = new Set();
    root.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      [].concat(o.material || []).forEach(m => { if (seen.has(m)) return; seen.add(m); for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } } m.dispose(); });
    });
  }
  async function enter(id, params) {
    if (busy || id === cur) return false; const z = byId(id); if (!z) return false;
    if (z.status === 'planned') return false; if (z.status === 'dev' && !DEV) return false;
    busy = true;
    try {
      await needScripts(byId(id).assets && byId(id).assets.length ? LAZY_CHAR : LAZY_3D); await fade(true);
      if (active) { W3.useZone(null); active.dispose(); active = null; }
      if (id !== 'home') { const B = BUILDERS[id]; if (!B) throw new Error('区域 ' + id + ' 还没有实现'); active = B(z, params); W3.useZone(active); }
      cur = id; document.body.classList.toggle('inzone', id !== 'home'); listeners.forEach(f => { try { f(id); } catch (e) { } });
    } finally { await fade(false); busy = false; }
    return true;
  }
  function stats() { const i = W3.renderer.info; return { tris: i.render.triangles, calls: i.render.calls, geos: i.memory.geometries, tex: i.memory.textures }; }

  /* ---------- 共用的区域镜头：拖动旋转、双指 / 滚轮缩放，镜头不会钻到地面下 ---------- */
  function orbitCam(canvas, groundAt, o) {
    const cam = new T.PerspectiveCamera(o.fov || 50, 1, 0.5, o.far || 600), st = { yaw: o.yaw || 0.6, pitch: o.pitch || 0.62, dist: o.dist || 90, target: new T.Vector3(0, 0, 0) };
    const pts = new Map(); let pinch = 0;
    const down = e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    const move = e => { const p = pts.get(e.pointerId); if (!p) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) st.dist = Math.max(o.minDist || 12, Math.min(o.maxDist || 220, st.dist * pinch / d)); pinch = d; return; } st.yaw -= (e.clientX - p[0]) * 0.006; st.pitch = Math.max(0.12, Math.min(1.35, st.pitch + (e.clientY - p[1]) * 0.004)); };
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    const wheel = e => { st.dist = Math.max(o.minDist || 12, Math.min(o.maxDist || 220, st.dist * (e.deltaY > 0 ? 1.08 : 0.93))); };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: true });
    return {
      cam, st,
      update() { const t = st.target; cam.position.set(t.x + Math.sin(st.yaw) * Math.cos(st.pitch) * st.dist, t.y + Math.sin(st.pitch) * st.dist, t.z + Math.cos(st.yaw) * Math.cos(st.pitch) * st.dist); const gy = groundAt(cam.position.x, cam.position.z) + 3; if (cam.position.y < gy) cam.position.y = gy; cam.lookAt(t); },
      resize(w, h) { cam.aspect = w / h; cam.updateProjectionMatrix(); },
      dispose() { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel); },
    };
  }

  /* ---------- 区域顶部信息条：名字、种子、预算，返回家园 ---------- */
  function zoneBar(z, extra) {
    const el = document.createElement('div'); el.id = 'zonebar';
    el.innerHTML = `<b>${z.name}</b><span class="zb-info"></span>${extra || ''}<button class="btn sm primary" data-zhome>${ICON('home')} 回家园</button>`;
    document.body.appendChild(el); el.querySelector('[data-zhome]').onclick = () => enter('home'); return el;
  }

  /* ---------- 野外地形：种子 + 生物群系（生成算法在 shared/config.js 的 genWorld，服务器也用它算野兽位置）---------- */
  const generate = ZCFG.genWorld, biomeAt = ZCFG.biomeAt;
  const C = h => new T.Color(h).convertSRGBToLinear();
  function geoWithColor(g, col) { g = g.index ? g.toNonIndexed() : g; const c = C(col), a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
  /* 一片野外的地形、水面、树、石头。返回 { group, groundAt, lakeY, walkable, water, dispose } */
  function makeTerrain(scene, gen, world) {
    const MERGE = T.BufferGeometryUtils.mergeBufferGeometries;
    const groundAt = (x, zz) => { const { size, seg, n, H } = world, u = Math.max(0, Math.min(seg - 1e-6, (x / size + 0.5) * seg)), w = Math.max(0, Math.min(seg - 1e-6, (zz / size + 0.5) * seg)), i = Math.floor(u), j = Math.floor(w), fu = u - i, fw = w - j, h = (a, b) => H[b * n + a]; return (h(i, j) * (1 - fu) * (1 - fw) + h(i + 1, j) * fu * (1 - fw) + h(i, j + 1) * (1 - fu) * fw + h(i + 1, j + 1) * fu * fw) * gen.height; };
    const lakeY = (ZCFG.BIOMES.find(b => b.id === 'lake') || { maxH: 0.3 }).maxH * gen.height + 0.15;
    const walkable = (x, zz) => { const lim = world.size / 2 - 5; if (Math.abs(x) > lim || Math.abs(zz) > lim) return false; return groundAt(x, zz) > lakeY - 0.05 && ZCFG.worldBiome(world, x, zz).walk !== false; };
    const TREE_G = {
      pine: () => { const t = geoWithColor(new T.CylinderGeometry(0.18, 0.25, 1.4, 6).translate(0, 0.7, 0), '#6a4a2a'), a = geoWithColor(new T.ConeGeometry(1.3, 2.4, 7).translate(0, 2.3, 0), '#2f6a32'), b = geoWithColor(new T.ConeGeometry(0.95, 1.9, 7).translate(0, 3.4, 0), '#3a7a3a'); return MERGE([t, a, b]); },
      broadleaf: () => { const t = geoWithColor(new T.CylinderGeometry(0.2, 0.28, 1.6, 6).translate(0, 0.8, 0), '#7a5230'), a = geoWithColor(new T.IcosahedronGeometry(1.5, 0).translate(0, 2.6, 0), '#5a9a3a'); return MERGE([t, a]); },
      bush: () => geoWithColor(new T.IcosahedronGeometry(0.8, 0).translate(0, 0.5, 0), '#6a8a32'),
    };
    const treeMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), rockMat = new T.MeshStandardMaterial({ color: C('#8a867c'), roughness: 1, flatShading: true });
    const rockGeo = new T.DodecahedronGeometry(1, 0), water = new T.Mesh(new T.PlaneGeometry(gen.size * 1.2, gen.size * 1.2), new T.MeshStandardMaterial({ color: C('#3a7ab8'), roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2; water.position.y = lakeY; scene.add(water);
    const group = new T.Group();
    const g = new T.PlaneGeometry(gen.size, gen.size, gen.seg, gen.seg); g.rotateX(-Math.PI / 2); const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color(), r = ZCFG.rng(world.seed + 3);
    for (let k = 0; k < P.count; k++) { P.setY(k, world.H[k] * gen.height); c.copy(C(world.BI[k].col)).multiplyScalar(0.92 + r() * 0.16); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    const ground = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); ground.receiveShadow = true; group.add(ground);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    Object.keys(TREE_G).forEach(kind => { const list = world.trees.filter(t => t.kind === kind); if (!list.length) return; TREE_G[kind] = TREE_G[kind](); const im = new T.InstancedMesh(TREE_G[kind], treeMat, list.length); list.forEach((t, k) => { ps.set(t.x, groundAt(t.x, t.z) - 0.1, t.z); q.setFromAxisAngle(up, t.ry); sc.setScalar(t.s); m4.compose(ps, q, sc); im.setMatrixAt(k, m4); }); group.add(im); });
    if (world.rocks.length) { const im = new T.InstancedMesh(rockGeo, rockMat, world.rocks.length); world.rocks.forEach((t, k) => { ps.set(t.x, groundAt(t.x, t.z), t.z); q.setFromAxisAngle(up, t.ry); sc.set(t.s, t.s * 0.7, t.s); m4.compose(ps, q, sc); im.setMatrixAt(k, m4); }); group.add(im); }
    scene.add(group);
    return { group, groundAt, lakeY, walkable, water, ground, dispose() { scene.remove(group); disposeTree(group); } };
  }
  function buildTrial(z) {
    const gen = z.gen, canvas = document.getElementById('cv'), scene = new T.Scene(), sky = new T.Color('#bcdcf4');
    scene.background = sky; scene.fog = new T.Fog(sky, gen.size * 0.55, gen.size * 1.5);
    scene.add(new T.HemisphereLight(0xfff4e0, 0x4a6a3a, 0.9)); const sun = new T.DirectionalLight(0xfff0d8, 2.1); sun.position.set(60, 90, 40); scene.add(sun);
    let seed = gen.seed, world = null, TR = null;
    const groundAt = (x, zz) => TR ? TR.groundAt(x, zz) : 0;
    function rebuild() { if (TR) { TR.dispose(); scene.remove(TR.water); TR.water.geometry.dispose(); TR.water.material.dispose(); } world = generate(gen, seed); TR = makeTerrain(scene, gen, world); info(); }
    const orbit = orbitCam(canvas, groundAt, { dist: gen.size * 0.75, pitch: 0.7, maxDist: gen.size * 1.4 });
    const bar = zoneBar(z, DEV ? '<button class="btn sm" data-zseed>换个种子</button>' : '');
    const seedBtn = bar.querySelector('[data-zseed]'); if (seedBtn) seedBtn.onclick = () => { seed = (seed * 1103515245 + 12345) >>> 0; rebuild(); };
    function info() { const top = Object.entries(world.count).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => `${(ZCFG.BIOMES.find(b => b.id === id) || {}).name}${Math.round(v / world.H.length * 100)}%`).join(' · '); bar.querySelector('.zb-info').textContent = `种子 ${seed} · ${top} · 树 ${world.trees.length} · 石头 ${world.rocks.length}`; }
    rebuild();
    let tAcc = 0;
    return {
      scene, get camera() { return orbit.cam; }, world: () => world, groundAt,
      update(dt) { orbit.update(); tAcc += dt; TR.water.position.y = TR.lakeY + Math.sin(tAcc * 0.8) * 0.05;
        if (DEV && (tAcc % 0.5) < dt) { const s = stats(), b = z.budget || {}; const el = bar.querySelector('.zb-budget') || bar.appendChild(Object.assign(document.createElement('span'), { className: 'zb-budget' })); el.textContent = `三角面 ${(s.tris / 1000).toFixed(0)}k/${(b.tris / 1000) | 0}k · 绘制 ${s.calls}/${b.calls}`; el.classList.toggle('over', s.tris > b.tris || s.calls > b.calls); } },
      resize(w, h) { orbit.resize(w, h); },
      dispose() { orbit.dispose(); bar.remove(); disposeTree(scene); },
    };
  }
  const BUILDERS = { trial: buildTrial }; /* 其他区域（名山猎场 src/hunt.js）往这里注册 */
  return { list, enter, byId, get current() { return cur; }, get busy() { return busy; }, onChange: f => listeners.push(f), stats, DEV, BUILDERS, generate, biomeAt, disposeTree, makeTerrain, geoWithColor, zoneBar, fade };
})();
