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
  async function enter(id) {
    if (busy || id === cur) return false; const z = byId(id); if (!z) return false;
    if (z.status === 'planned') return false; if (z.status === 'dev' && !DEV) return false;
    busy = true;
    try {
      await fade(true);
      if (active) { W3.useZone(null); active.dispose(); active = null; }
      if (id !== 'home') { const B = BUILDERS[id]; if (!B) throw new Error('区域 ' + id + ' 还没有实现'); active = B(z); W3.useZone(active); }
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

  /* ---------- 试炼野外：种子 + 生物群系程序生成 ---------- */
  function makeNoise(seed) {
    const r = ZCFG.rng(seed), N = 256, perm = new Uint16Array(N * 2), grad = new Float32Array(N);
    for (let i = 0; i < N; i++) { perm[i] = i; grad[i] = r(); } for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let i = 0; i < N; i++) perm[i + N] = perm[i];
    const sm = t => t * t * (3 - 2 * t), v = (x, y) => grad[perm[(perm[x & 255] + y) & 511] & 255];
    const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1), u = sm(xf), w = sm(yf); return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w; };
    return (x, y, oct) => { let s = 0, amp = 0.5, f = 1, norm = 0; for (let k = 0; k < (oct || 5); k++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; } return s / norm; };
  }
  function biomeAt(h, m) { const B = ZCFG.BIOMES; let b = B.find(x => h < x.maxH) || B[B.length - 1]; if (b.moist !== undefined && m < b.moist && b.dry) b = B.find(x => x.id === b.dry) || b; return b; }
  /* 生成一片野外的数据（不依赖 Three.js，方便以后服务器也能用同一个种子算出刷怪点） */
  function generate(gen, seed) {
    const size = gen.size, seg = gen.seg, n = seg + 1, H = new Float32Array(n * n), M = new Float32Array(n * n), BI = new Array(n * n);
    const hN = makeNoise(seed), mN = makeNoise(seed ^ 0x9e3779b1), BIDX = {}; ZCFG.BIOMES.forEach((b, i) => { BIDX[b.id] = i; });
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / seg, w = j / seg, x = u * 4, y = w * 4, dx = u - 0.5, dz = w - 0.5, edge = Math.min(1, Math.hypot(dx, dz) * 2);
      let h = hN(x, y, 5) * 0.75 + Math.pow(Math.max(0, hN(x * 0.5 + 9, y * 0.5 + 3, 3) - 0.35), 1.4) * 1.1; /* 起伏 + 少数高山 */
      h = h * (1 - Math.pow(edge, 3) * 0.55) + (edge > 0.92 ? (edge - 0.92) * 2 : 0); /* 中间平缓、边缘抬高成山，把区域围起来 */
      H[j * n + i] = Math.max(0, Math.min(1, h)); M[j * n + i] = mN(x * 1.3 + 4, y * 1.3 + 7, 4);
    }
    let lo = 1, hi = 0; for (const h of H) { if (h < lo) lo = h; if (h > hi) hi = h; } for (let k = 0; k < H.length; k++) { H[k] = (H[k] - lo) / (hi - lo || 1); BI[k] = biomeAt(H[k], M[k]); }
    const count = {}; BI.forEach(b => { count[b.id] = (count[b.id] || 0) + 1; });
    /* 树和石头：按群系密度撒点（每 100 平方米 trees / rocks 个） */
    const r = ZCFG.rng(seed + 7), cellA = (size / seg) * (size / seg), trees = [], rocks = [];
    for (let k = 0; k < BI.length; k++) { const b = BI[k], i = k % n, j = (k / n) | 0; if (i === seg || j === seg) continue; const x = (i / seg - 0.5) * size, z = (j / seg - 0.5) * size;
      if (b.trees && r() < b.trees * cellA / 100) trees.push({ x: x + (r() - 0.5) * size / seg, z: z + (r() - 0.5) * size / seg, s: 0.7 + r() * 0.7, kind: b.tree || 'pine', ry: r() * 6.28 });
      if (b.rocks && r() < b.rocks * cellA / 100) rocks.push({ x: x + (r() - 0.5) * size / seg, z: z + (r() - 0.5) * size / seg, s: 0.4 + r() * 1.2, ry: r() * 6.28 }); }
    return { size, seg, n, H, M, BI, count, trees, rocks, seed, BIDX };
  }
  function buildTrial(z) {
    const gen = z.gen, canvas = document.getElementById('cv'), scene = new T.Scene(), sky = new T.Color('#bcdcf4');
    scene.background = sky; scene.fog = new T.Fog(sky, gen.size * 0.55, gen.size * 1.5);
    scene.add(new T.HemisphereLight(0xfff4e0, 0x4a6a3a, 0.9)); const sun = new T.DirectionalLight(0xfff0d8, 2.1); sun.position.set(60, 90, 40); scene.add(sun);
    let seed = gen.seed, world = null, groupT = null;
    const groundAt = (x, zz) => { if (!world) return 0; const { size, seg, n, H } = world, u = Math.max(0, Math.min(seg - 1e-6, (x / size + 0.5) * seg)), w = Math.max(0, Math.min(seg - 1e-6, (zz / size + 0.5) * seg)), i = Math.floor(u), j = Math.floor(w), fu = u - i, fw = w - j, h = (a, b) => H[b * n + a]; return (h(i, j) * (1 - fu) * (1 - fw) + h(i + 1, j) * fu * (1 - fw) + h(i, j + 1) * (1 - fu) * fw + h(i + 1, j + 1) * fu * fw) * gen.height; };
    const lakeY = (ZCFG.BIOMES.find(b => b.id === 'lake') || { maxH: 0.3 }).maxH * gen.height + 0.15;
    const C = h => new T.Color(h).convertSRGBToLinear();
    function geoWithColor(g, col) { g = g.index ? g.toNonIndexed() : g; const c = C(col), a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; }
    const MERGE = T.BufferGeometryUtils.mergeBufferGeometries;
    const TREE_G = {
      pine: () => { const t = geoWithColor(new T.CylinderGeometry(0.18, 0.25, 1.4, 6).translate(0, 0.7, 0), '#6a4a2a'), a = geoWithColor(new T.ConeGeometry(1.3, 2.4, 7).translate(0, 2.3, 0), '#2f6a32'), b = geoWithColor(new T.ConeGeometry(0.95, 1.9, 7).translate(0, 3.4, 0), '#3a7a3a'); return MERGE([t, a, b]); },
      broadleaf: () => { const t = geoWithColor(new T.CylinderGeometry(0.2, 0.28, 1.6, 6).translate(0, 0.8, 0), '#7a5230'), a = geoWithColor(new T.IcosahedronGeometry(1.5, 0).translate(0, 2.6, 0), '#5a9a3a'); return MERGE([t, a]); },
      bush: () => geoWithColor(new T.IcosahedronGeometry(0.8, 0).translate(0, 0.5, 0), '#6a8a32'),
    };
    const treeMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), rockMat = new T.MeshStandardMaterial({ color: C('#8a867c'), roughness: 1, flatShading: true });
    const rockGeo = new T.DodecahedronGeometry(1, 0), water = new T.Mesh(new T.PlaneGeometry(gen.size * 1.2, gen.size * 1.2), new T.MeshStandardMaterial({ color: C('#3a7ab8'), roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2; water.position.y = lakeY; scene.add(water);
    function rebuild() {
      if (groupT) { scene.remove(groupT); groupT.traverse(o => { if (o.geometry && !Object.values(TREE_G).includes(o.geometry) && o.geometry !== rockGeo) o.geometry.dispose(); }); }
      world = generate(gen, seed); groupT = new T.Group();
      const g = new T.PlaneGeometry(gen.size, gen.size, gen.seg, gen.seg); g.rotateX(-Math.PI / 2); const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color(), r = ZCFG.rng(seed + 3);
      for (let k = 0; k < P.count; k++) { P.setY(k, world.H[k] * gen.height); c.copy(C(world.BI[k].col)).multiplyScalar(0.92 + r() * 0.16); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
      g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
      groupT.add(new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), up = new T.Vector3(0, 1, 0);
      Object.keys(TREE_G).forEach(kind => { const list = world.trees.filter(t => t.kind === kind); if (!list.length) return; if (typeof TREE_G[kind] === 'function') TREE_G[kind] = TREE_G[kind](); const im = new T.InstancedMesh(TREE_G[kind], treeMat, list.length); list.forEach((t, k) => { ps.set(t.x, groundAt(t.x, t.z) - 0.1, t.z); q.setFromAxisAngle(up, t.ry); sc.setScalar(t.s); m4.compose(ps, q, sc); im.setMatrixAt(k, m4); }); groupT.add(im); });
      if (world.rocks.length) { const im = new T.InstancedMesh(rockGeo, rockMat, world.rocks.length); world.rocks.forEach((t, k) => { ps.set(t.x, groundAt(t.x, t.z), t.z); q.setFromAxisAngle(up, t.ry); sc.set(t.s, t.s * 0.7, t.s); m4.compose(ps, q, sc); im.setMatrixAt(k, m4); }); groupT.add(im); }
      scene.add(groupT); info();
    }
    const orbit = orbitCam(canvas, groundAt, { dist: gen.size * 0.75, pitch: 0.7, maxDist: gen.size * 1.4 });
    const bar = zoneBar(z, DEV ? '<button class="btn sm" data-zseed>换个种子</button>' : '');
    const seedBtn = bar.querySelector('[data-zseed]'); if (seedBtn) seedBtn.onclick = () => { seed = (seed * 1103515245 + 12345) >>> 0; rebuild(); };
    function info() { const top = Object.entries(world.count).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => `${(ZCFG.BIOMES.find(b => b.id === id) || {}).name}${Math.round(v / world.H.length * 100)}%`).join(' · '); bar.querySelector('.zb-info').textContent = `种子 ${seed} · ${top} · 树 ${world.trees.length} · 石头 ${world.rocks.length}`; }
    rebuild();
    let tAcc = 0;
    return {
      scene, get camera() { return orbit.cam; }, world: () => world, groundAt,
      update(dt) { orbit.update(); tAcc += dt; water.position.y = lakeY + Math.sin(tAcc * 0.8) * 0.05;
        if (DEV && (tAcc % 0.5) < dt) { const s = stats(), b = z.budget || {}; const el = bar.querySelector('.zb-budget') || bar.appendChild(Object.assign(document.createElement('span'), { className: 'zb-budget' })); el.textContent = `三角面 ${(s.tris / 1000).toFixed(0)}k/${(b.tris / 1000) | 0}k · 绘制 ${s.calls}/${b.calls}`; el.classList.toggle('over', s.tris > b.tris || s.calls > b.calls); } },
      resize(w, h) { orbit.resize(w, h); },
      dispose() { orbit.dispose(); bar.remove(); disposeTree(scene); Object.values(TREE_G).forEach(g => g && g.dispose && g.dispose()); rockGeo.dispose(); },
    };
  }
  const BUILDERS = { trial: buildTrial };
  return { list, enter, byId, get current() { return cur; }, get busy() { return busy; }, onChange: f => listeners.push(f), stats, DEV, BUILDERS, generate, biomeAt, disposeTree };
})();
