'use strict';
/* =====================================================
   丰收农场 · 3D 场景（Three.js r149，本地托管 vendor/three.min.js）
   农田、作物、环境、光照、昼夜、天气、拾取、特效、作物图标
   ===================================================== */
const W3 = (() => {
  const T = THREE, CFG3 = GAMECFG;
  T.ColorManagement.legacyMode = false;
  const PITCH = 2.32, PLOT = 2.02, BED_H = 0.22, COLS3 = 6, ROWS3 = 4;
  const CROP_SC = 3.4; /* 2026-10-26 甲方：作物放大到原来的 2~3 倍（原来 1.42），高秆作物比人还高，可以在下面歇脚 */
  // 农田一片一片地排：第 0 片在农场中间；之后的田在北边，每排 4 片
  const fieldC = GAMECFG.fieldCenter; /* 菜地位置、建筑位置等家园布局来自 content/home.jsonc（服务器的建造网格也读它） */
  const HOMEL = GAMECFG.HOME, ST = Object.fromEntries(HOMEL.structures.map(o => [o.id, o]));
  const plotXZ = i => { const f = Math.floor(i / 24), j = i % 24, [cx, cz] = fieldC(f); return [cx + ((j % COLS3) - 2.5) * PITCH, cz + (Math.floor(j / COLS3) - 1.5) * PITCH]; };
  const fieldAtXZ = (x, z) => { for (let f = 0; f < 20; f++) { const [cx, cz] = fieldC(f); if (Math.abs(x - cx) < 8 && Math.abs(z - cz) < 5.6) return f; } return -1; };
  let DETF = -1; /* 俯视拖到哪片田，哪片田也用精细模型 */
  let ACTF = 0; // 当前关注的那片田：这片和第 0 片用精细模型，其他田用简化模型
  let R, scene, cam, canvasEl, W = 1, H = 1, ready = false, tNow = 0;
  const safe = { l: 80, r: 100, t: 86, b: 120 };
  let zoom = 1;

  /* ---------------- 程序化噪声与贴图 ---------------- */
  function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s, p) { let xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const w = n => p ? ((n % p) + p) % p : n; const a = hash2(w(xi), w(yi), s), b = hash2(w(xi + 1), w(yi), s), c = hash2(w(xi), w(yi + 1), s), d = hash2(w(xi + 1), w(yi + 1), s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, s, oct, p) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < (oct || 4); i++) { t += a * vnoise(x * f, y * f, s + i * 17, p ? p * f : 0); n += a; f *= 2; a *= 0.5; } return t / n; }
  const mkCanvas = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  function pixTex(n, fn) { const c = mkCanvas(n), x = c.getContext('2d'), im = x.createImageData(n, n), d = im.data; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const o = (j * n + i) * 4, r = fn(i / n, j / n, i, j); d[o] = r[0]; d[o + 1] = r[1]; d[o + 2] = r[2]; d[o + 3] = r[3] === undefined ? 255 : r[3]; } x.putImageData(im, 0, 0); return c; }
  function normalTex(n, hf, k) { const h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = hf(i / n, j / n); return pixTex(n, (u, v, i, j) => { const l = h[j * n + ((i - 1 + n) % n)], r = h[j * n + ((i + 1) % n)], t = h[((j - 1 + n) % n) * n + i], b = h[((j + 1) % n) * n + i]; let nx = (l - r) * k, ny = (t - b) * k, nz = 1; const m = Math.hypot(nx, ny, nz); return [(nx / m * 0.5 + 0.5) * 255, (ny / m * 0.5 + 0.5) * 255, (nz / m * 0.5 + 0.5) * 255]; }); }
  function tex(canvas, rep, srgb) { const t = new T.CanvasTexture(canvas); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep, rep); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
  const TX = {};
  function buildTextures() {
    // 草地：多层噪声 + 细碎草叶笔触，可平铺
    const g = pixTex(512, (u, v) => { const n = fbm(u * 8, v * 8, 3, 5, 8), m = fbm(u * 32, v * 32, 9, 3, 32); const r = 70 + n * 40 + m * 20, gg = 118 + n * 50 + m * 18, b = 42 + n * 22; return [r * 0.92, gg, b]; });
    const gx = g.getContext('2d'), rr = CFG3.rng(7);
    for (let i = 0; i < 9000; i++) { const x = rr() * 512, y = rr() * 512, l = 3 + rr() * 6, a = -Math.PI / 2 + (rr() - 0.5) * 0.9, lt = rr(); gx.strokeStyle = lt < 0.5 ? `rgba(${120 + lt * 80},${170 + lt * 60},${70 + lt * 40},.55)` : `rgba(40,${80 + lt * 30},30,.35)`; gx.lineWidth = 1; gx.beginPath(); gx.moveTo(x, y); gx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); gx.stroke(); }
    TX.grass = tex(g, 18);
    // 土壤：颜色贴图（中性，靠材质颜色着色）+ 法线贴图（颗粒与土块）
    TX.soil = tex(pixTex(256, (u, v) => { const n = fbm(u * 6, v * 6, 21, 5, 6), p = vnoise(u * 64, v * 64, 5, 64); const k = 150 + n * 90 + (p > 0.82 ? 40 : 0) - (p < 0.12 ? 35 : 0); return [k, k * 0.86, k * 0.72]; }), 1);
    TX.soilN = tex(normalTex(256, (u, v) => fbm(u * 10, v * 10, 31, 4, 10) + Math.max(0, vnoise(u * 48, v * 48, 8, 48) - 0.7) * 1.5, 3), 1, false);
    // 木纹
    TX.wood = tex(pixTex(256, (u, v) => { const g2 = fbm(u * 2, v * 22, 41, 4, 2) * 0.6 + Math.sin((u * 6 + fbm(u * 3, v * 3, 42, 3, 3) * 2) * Math.PI * 2) * 0.12; const plank = (Math.floor(u * 4) % 2) * 0.06, seam = (u * 4) % 1 < 0.03 ? -0.35 : 0; const k = 0.62 + g2 * 0.5 + plank + seam; return [176 * k, 128 * k, 82 * k]; }), 1);
    // 墙面灰泥
    TX.plaster = tex(pixTex(256, (u, v) => { const n = fbm(u * 8, v * 8, 51, 5, 8); const k = 225 + n * 30 - 15; return [k, k * 0.96, k * 0.9]; }), 1);
    // 屋瓦（灰度，靠颜色着色）
    TX.tiles = tex(pixTex(256, (u, v) => { const row = v * 8, rf = row % 1, off = Math.floor(row) % 2 ? 0.5 : 0, col = (u * 6 + off) % 1; const arc = Math.sqrt(Math.max(0, 1 - Math.pow((col - 0.5) * 2, 2))); const sh = 0.55 + 0.45 * Math.min(1, rf / (0.25 + 0.75 * arc)) - (rf > 0.92 ? 0.25 : 0) + (fbm(u * 20, v * 20, 61, 3, 20) - 0.5) * 0.12; const k = 255 * Math.max(0.3, Math.min(1, sh)); return [k, k, k]; }), 1);
    // 石块
    TX.stone = tex(pixTex(256, (u, v) => { const row = v * 6, off = Math.floor(row) % 2 ? 0.5 : 0, col = (u * 4 + off); const ef = Math.min(row % 1, 1 - row % 1, col % 1, 1 - col % 1); const n = fbm(u * 12, v * 12, 71, 4, 12); const base = 150 + hash2(Math.floor(col), Math.floor(row), 3) * 50; const k = (ef < 0.04 ? 0.55 : 1) * (base + n * 50); return [k, k * 0.97, k * 0.92]; }), 1);
    TX.stoneN = tex(normalTex(256, (u, v) => { const row = v * 6, off = Math.floor(row) % 2 ? 0.5 : 0, col = (u * 4 + off); const ef = Math.min(row % 1, 1 - row % 1, col % 1, 1 - col % 1); return Math.min(1, ef * 8) + fbm(u * 12, v * 12, 72, 3, 12) * 0.3; }, 2.5), 1, false);
    // 水面法线
    TX.waterN = tex(normalTex(256, (u, v) => fbm(u * 6, v * 6, 81, 4, 6) + 0.5 * fbm(u * 14, v * 14, 82, 3, 14), 2.2), 3, false);
    // 小路
    TX.path = tex(pixTex(256, (u, v) => { const n = fbm(u * 8, v * 8, 91, 5, 8), p = vnoise(u * 40, v * 40, 92, 40); const k = 170 + n * 60 + (p > 0.8 ? 25 : 0); return [k, k * 0.88, k * 0.68]; }), 1);
  }
  // 精灵图标（圆形徽章）
  function badgeTex(kind) {
    const c = mkCanvas(128), x = c.getContext('2d'); const col = { d: ['#3ba7e8', '#bfe6ff'], w: ['#5aa33a', '#d9f2c2'], b: ['#d8443a', '#ffd2cc'], s: ['#8a7a62', '#efe6d2'] }[kind];
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 8; x.shadowOffsetY = 3;
    const gr = x.createRadialGradient(56, 48, 8, 64, 64, 56); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, col[1]);
    x.beginPath(); x.arc(64, 60, 46, 0, Math.PI * 2); x.fillStyle = gr; x.fill(); x.shadowColor = 'transparent';
    x.lineWidth = 6; x.strokeStyle = col[0]; x.stroke();
    x.beginPath(); x.moveTo(52, 104); x.lineTo(64, 122); x.lineTo(76, 104); x.closePath(); x.fillStyle = col[0]; x.fill();
    x.save(); x.translate(64, 60); x.fillStyle = col[0]; x.strokeStyle = col[0];
    if (kind === 'd') { x.beginPath(); x.moveTo(0, -26); x.bezierCurveTo(16, -4, 20, 8, 0, 24); x.bezierCurveTo(-20, 8, -16, -4, 0, -26); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-6, 6, 4, 7, 0.4, 0, 7); x.fill(); }
    else if (kind === 'w') { for (let i = -1; i <= 1; i++) { x.save(); x.rotate(i * 0.55); x.beginPath(); x.moveTo(0, 22); x.quadraticCurveTo(12, -2, 0, -26); x.quadraticCurveTo(-12, -2, 0, 22); x.fill(); x.restore(); } }
    else if (kind === 'b') { x.beginPath(); x.arc(0, 4, 18, 0, Math.PI * 2); x.fill(); x.fillStyle = '#2a1a14'; x.beginPath(); x.arc(0, -16, 9, 0, Math.PI * 2); x.fill(); x.fillRect(-1.5, -14, 3, 36); x.fillStyle = '#2a1a14';[[-8, -2], [8, -2], [-9, 12], [9, 12]].forEach(p => { x.beginPath(); x.arc(p[0], p[1], 4, 0, 7); x.fill(); }); }
    else { x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('已摘', 0, 2); }
    x.restore(); return tex(c, 0);
  }
  function glowTex(col, soft) { const c = mkCanvas(64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col); g.addColorStop(soft ? 0.5 : 0.25, col.replace(/[\d.]+\)$/, '0.5)')); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return tex(c, 0); }
  function starTex() { const c = mkCanvas(64), x = c.getContext('2d'); x.translate(32, 32); const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, 'rgba(255,240,170,.8)'); g.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = g; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 30, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); return tex(c, 0); }
  function coinTex() { const c = mkCanvas(64), x = c.getContext('2d'); const g = x.createRadialGradient(24, 22, 2, 32, 32, 28); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#f5c542'); g.addColorStop(1, '#b07a12'); x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fillStyle = g; x.fill(); x.lineWidth = 3; x.strokeStyle = '#8a5a08'; x.stroke(); x.beginPath(); x.arc(32, 32, 17, 0, 7); x.strokeStyle = 'rgba(138,90,8,.6)'; x.stroke(); return tex(c, 0); }
  function leafSpriteTex(col) { const c = mkCanvas(64), x = c.getContext('2d'); x.translate(32, 32); x.rotate(0.6); x.fillStyle = col; x.beginPath(); x.moveTo(0, 26); x.quadraticCurveTo(18, 0, 0, -26); x.quadraticCurveTo(-18, 0, 0, 26); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(0, 24); x.lineTo(0, -22); x.stroke(); return tex(c, 0); }
  function dropTex() { const c = mkCanvas(64), x = c.getContext('2d'); x.translate(32, 32); const g = x.createLinearGradient(-10, -20, 10, 20); g.addColorStop(0, '#d8f2ff'); g.addColorStop(1, '#2f8fd8'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -24); x.bezierCurveTo(14, -4, 16, 8, 0, 22); x.bezierCurveTo(-16, 8, -14, -4, 0, -24); x.fill(); return tex(c, 0); }

  /* ---------------- 材质与几何工具 ---------------- */
  const MC = new Map();
  /* 缓存键：贴图只取 uuid（以前 JSON.stringify 会把整张贴图转成 base64，生成人物要卡十几秒） */
  const keyOf = v => v && typeof v === 'object' ? (v.isTexture ? 'tex:' + v.uuid : v.isColor ? '#' + v.getHexString() : '{' + Object.keys(v).map(k => k + ':' + keyOf(v[k])).join(',') + '}') : String(v); /* toJSON 会在 replacer 之前调用，所以自己拼 */
  function mat(col, o) { o = o || {}; const k = col + keyOf(o); let m = MC.get(k); if (!m) { m = new (o.phys ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)(Object.assign({ color: new T.Color(col), roughness: 0.75, metalness: 0 }, o.p || {})); if (o.vc) m.vertexColors = true; if (o.ds) m.side = T.DoubleSide; snowify(m); MC.set(k, m); } return m; }   /* 创建时就加好积雪着色器，之后不用再重编 */
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  function mesh(geo, m, x, y, z) { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
  function colorize(g, fn) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const r = fn(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = r[0]; c[i * 3 + 1] = r[1]; c[i * 3 + 2] = r[2]; } g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; }
  function displace(g, amt, freq, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = (fbm(x * freq + 10, (y + z) * freq + 20, seed, 3) - 0.5) * 2 * amt, l = Math.hypot(x, y, z) || 1; p.setXYZ(i, x + x / l * n, y + y / l * n, z + z / l * n); } g.computeVertexNormals(); return g; }
  // 合并：同一材质的网格合并成一个，大幅减少绘制调用
  /* v3.2.2：从场景里拿掉的东西，场景里再没人用的几何体统一释放（three.js 里释放后还被用到也只是重新上传，不会坏） */
  function freeTree(...roots) { const used = new Set(); scene.traverse(o => { if (o.geometry) used.add(o.geometry); }); roots.forEach(r => r && r.traverse(o => { if (o.geometry && !used.has(o.geometry)) o.geometry.dispose(); })); }
  function merge(root) {
    root.updateMatrixWorld(true); const inv = new T.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), keep = [];
    root.traverse(o => { if (!o.isMesh || o.userData.keep) { if (o.isMesh || o.isSprite) keep.push(o); return; } const k = o.material.uuid; if (!groups.has(k)) groups.set(k, { m: o.material, list: [], cast: false }); const gg = groups.get(k); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); gg.list.push(g); gg.cast = gg.cast || o.castShadow; });
    const out = new T.Group();
    groups.forEach(({ m, list, cast }) => {
      let n = 0; list.forEach(g => n += g.attributes.position.count);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3); let o = 0;
      list.forEach(g => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3); o += c; g.dispose(); });
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); if (m.vertexColors) geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeBoundingSphere();
      const me = new T.Mesh(geo, m); me.castShadow = cast; me.receiveShadow = true; out.add(me);
    });
    keep.forEach(o => { const w = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld); o.parent.remove(o); w.decompose(o.position, o.quaternion, o.scale); out.add(o); });
    return out;
  }
  // 叶片：沿 +Y 生长，按弧线向 +Z 弯曲，边缘微微上卷；顶点色由深到浅
  const LG = new Map();
  function leafGeo(len, wid, bend, cup, shape) {
    const k = [len, wid, bend, cup, shape].join(); if (LG.has(k)) return LG.get(k);
    const sl = 10, sw = 4, pos = [], col = [], uv = [], idx = []; let y = 0, z = 0;
    for (let i = 0; i <= sl; i++) {
      const t = i / sl, th = bend * t, ds = len / sl; if (i > 0) { y += Math.cos(th) * ds; z += Math.sin(th) * ds; }
      const prof = shape === 'blade' ? (1 - t * 0.85) * Math.min(1, t * 6) : shape === 'heart' ? Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.6) * (1 - 0.2 * t) : shape === 'thin' ? Math.pow(Math.sin(Math.PI * t), 0.9) * 0.6 : Math.pow(Math.sin(Math.PI * t), 0.8) * (1 - 0.25 * t);
      const w = wid * prof, nY = -Math.sin(th), nZ = Math.cos(th);
      for (let j = 0; j <= sw; j++) { const s = j / sw * 2 - 1, lift = cup * Math.abs(s) * w; pos.push(s * w, y + nY * lift, z + nZ * lift); const sh = 0.5 + 0.38 * t - 0.1 * Math.abs(s) + (j === sw / 2 ? 0.08 : 0); col.push(sh, sh, sh); uv.push(j / sw, t); }
    }
    for (let i = 0; i < sl; i++) for (let j = 0; j < sw; j++) { const a = i * (sw + 1) + j, b = a + sw + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); LG.set(k, g); return g;
  }
  const leafMat = (col) => mat(col, { vc: 1, ds: 1, p: { roughness: 0.62 } });
  function addLeaf(grp, geo, m, x, y, z, yaw, tilt, roll, s) { const o = mesh(geo, m, x, y, z); o.rotation.set(tilt, yaw, roll || 0, 'YXZ'); if (s) o.scale.setScalar(s); grp.add(o); return o; }
  function tube(pts, r0, r1, m, seg) { const curve = new T.CatmullRomCurve3(pts); const g = new T.TubeGeometry(curve, seg || 8, r0, 6, false); if (r1 !== undefined) { const p = g.attributes.position; /* 尖端变细 */ for (let i = 0; i < p.count; i++) { const t = Math.floor(i / 7) / (seg || 8); const c = curve.getPoint(Math.min(1, t)); const k = (r0 + (r1 - r0) * t) / r0; p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k); } g.computeVertexNormals(); } return mesh(g, m); }
  const SG = new Map(), SG_SET = new Set(); const sphereG = (w, h) => { const k = w + ':' + h; if (!SG.has(k)) { const g = new T.SphereGeometry(1, w, h); SG.set(k, g); SG_SET.add(g); } return SG.get(k); };
  function blob(m, x, y, z, sx, sy, sz, seg) { const o = mesh(sphereG(seg || 18, Math.round((seg || 18) * 0.7)), m, x, y, z); o.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); return o; }
  function lathe(profile, seg) { return new T.LatheGeometry(profile.map(p => new T.Vector2(p[0], p[1])), seg || 18); }
  function dotsTex(bg, dot, n, sz) { const c = mkCanvas(128), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 128, 128); const r = CFG3.rng(n); x.fillStyle = dot; for (let i = 0; i < n; i++) { x.beginPath(); x.ellipse(r() * 128, r() * 128, sz, sz * 1.5, 0, 0, 7); x.fill(); } return tex(c, 0); }
  function stripeTex(c1, c2, n) { const c = mkCanvas(256), x = c.getContext('2d'); x.fillStyle = c1; x.fillRect(0, 0, 256, 256); x.fillStyle = c2; for (let i = 0; i < n; i++) { x.beginPath(); for (let y = 0; y <= 256; y += 8) { const xx = (i + 0.5) / n * 256 + Math.sin(y * 0.08 + i) * 5; x.lineTo(xx - 7 - Math.sin(y / 256 * Math.PI) * 4, y); } for (let y = 256; y >= 0; y -= 8) { const xx = (i + 0.5) / n * 256 + Math.sin(y * 0.08 + i) * 5; x.lineTo(xx + 7 + Math.sin(y / 256 * Math.PI) * 4, y); } x.fill(); } return tex(c, 0); }

  /* ---------------- 作物模型 ---------------- */
  const CROP_CACHE = new Map();
  const fruitMat = (col, rough) => mat(col, { phys: 1, p: { roughness: rough === undefined ? 0.32 : rough, clearcoat: 0.6, clearcoatRoughness: 0.35 } });
  const STEM = () => mat('#4f8a2c', { p: { roughness: 0.7 } });
  function seedMound(g) { const m = mat('#6b4423', { p: { map: TX.soil, normalMap: TX.soilN, roughness: 0.95 } }); g.add(blob(m, 0, 0, 0, 0.32, 0.1, 0.3)); const sm = mat('#e8d6a2', { p: { roughness: 0.6 } }); [[0.08, 0.06], [-0.1, 0.02], [0.02, -0.1]].forEach(p => g.add(blob(sm, p[0], 0.08, p[1], 0.035, 0.022, 0.025, 8))); }
  function sprout(g, s) { const m = leafMat('#8fd65a'); s = s || 1; g.add(tube([v3(0, 0, 0), v3(0.01, 0.12 * s, 0), v3(0, 0.22 * s, 0.01)], 0.018 * s, 0.014 * s, STEM(), 4)); const lg = leafGeo(0.2 * s, 0.09 * s, 1.1, 0.25); addLeaf(g, lg, m, 0, 0.21 * s, 0, 0, 1.2, 0); addLeaf(g, lg, m, 0, 0.21 * s, 0, Math.PI, 1.2, 0); }
  function rosette(g, n, len, wid, tilt, bend, col, y, shape, cup, jitter) { const m = leafMat(col), r = CFG3.rng(n * 31 + Math.round(len * 100)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * (jitter || 0.4), l = len * (0.8 + r() * 0.35); addLeaf(g, leafGeo(l, wid, bend, cup === undefined ? 0.3 : cup, shape), m, 0, y || 0, 0, a, tilt + (r() - 0.5) * 0.25); } }
  function buildRoot(g, a, k, ripe) {
    const carrot = a.shape === 'carrot';
    if (carrot) { rosette(g, 11, 0.85 * k, 0.07, 0.35, 0.8, a.leaf, 0.05, 'thin', 0.1, 0.6); if (k > 0.75) { const m = mat(a.root, { p: { roughness: 0.55 } }); const o = mesh(lathe([[0, -0.05], [0.1 * k, 0], [0.13 * k, 0.07], [0.09 * k, 0.11], [0, 0.12]]), m); g.add(o); } }
    else { if (k > 0.75) { const m = mat(a.root, { p: { roughness: 0.4 } }), rs = ripe ? 0.26 : 0.17; const o = mesh(lathe([[0, -0.06], [rs * 0.6, -0.02], [rs, rs * 0.7], [rs * 0.85, rs * 1.3], [rs * 0.3, rs * 1.55], [0, rs * 1.6]], 20), m); g.add(o); if (a.blush !== a.root) { const b = mesh(lathe([[rs * 0.86, rs * 1.25], [rs * 0.3, rs * 1.56], [0, rs * 1.62]], 20), mat(a.blush, { p: { roughness: 0.45 } })); b.scale.setScalar(1.02); g.add(b); } }
      const y0 = k > 0.75 ? (ripe ? 0.38 : 0.26) : 0.02; rosette(g, 8, 0.75 * k, 0.17 * k + 0.03, 0.42, 0.9, a.leaf, y0, 'leaf', 0.35); }
  }
  function buildCabbage(g, a, k, ripe) {
    const R = 0.5 * k + 0.08, outer = leafMat('#5d9e3c');
    for (let i = 0; i < 8; i++) addLeaf(g, leafGeo(R * 1.15, R * 0.55, 1.5, 0.5, 'heart'), outer, 0, 0.02, 0, i / 8 * Math.PI * 2 + 0.2, 1.05);
    const hk = ripe ? 1 : 0.6 + k * 0.25, hr = R * 0.62 * hk; const head = new T.SphereGeometry(1, 28, 20);
    colorize(head, (x, y, z) => { const v = 0.75 + 0.35 * (y * 0.5 + 0.5) + 0.12 * Math.sin(Math.atan2(z, x) * 7 + y * 4); return [v, v, v]; });
    const hm = mat(a.head, { vc: 1, p: { roughness: 0.5 } }); const h = mesh(head, hm, 0, hr * 0.95, 0); h.scale.set(hr, hr * 1.05, hr); g.add(h);
    for (let i = 0; i < 5; i++) addLeaf(g, leafGeo(hr * 1.6, hr * 0.9, 2.4, 0.6, 'heart'), leafMat(a.head), 0, 0.03, 0, i / 5 * Math.PI * 2, 0.42);
  }
  function fruit(kind, a, ripe, s) {
    const col = ripe ? a.fruit : a.unripe, gg = new T.Group(); s = s || 1;
    if (kind === 'tomato') { const f = blob(fruitMat(col), 0, 0, 0, 0.1 * s, 0.085 * s, 0.1 * s, 20); gg.add(f); const cm = leafMat('#3f8a2a'); for (let i = 0; i < 5; i++) addLeaf(gg, leafGeo(0.06 * s, 0.025 * s, 1.6, 0.1, 'thin'), cm, 0, 0.075 * s, 0, i / 5 * Math.PI * 2, 1.6); }
    else if (kind === 'chili') { const g2 = lathe([[0, -0.2], [0.02, -0.16], [0.04, -0.06], [0.045, 0.02], [0.035, 0.05], [0, 0.06]], 14); const p = g2.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(Math.max(0, -y), 2) * 1.2); } g2.computeVertexNormals(); const f = mesh(g2, fruitMat(col, 0.25)); f.scale.setScalar(s); gg.add(f); gg.add(blob(mat('#3f8a2a'), 0, 0.06 * s, 0, 0.035 * s, 0.02 * s)); }
    else if (kind === 'egg') { const f = mesh(lathe([[0, -0.2], [0.07, -0.17], [0.085, -0.06], [0.06, 0.04], [0.04, 0.1], [0, 0.11]], 18), fruitMat(col, 0.2)); f.scale.setScalar(s); f.rotation.z = 0.15; gg.add(f); const cm = leafMat('#4a8a32'); for (let i = 0; i < 5; i++) addLeaf(gg, leafGeo(0.07 * s, 0.035 * s, 2.2, 0.1, 'leaf'), cm, 0, 0.1 * s, 0, i / 5 * Math.PI * 2, 2.4); }
    else if (kind === 'berry') { const sm = new T.MeshPhysicalMaterial({ color: new T.Color(col), map: dotsTex('#ffffff', ripe ? '#ffe68a' : '#f4f4dc', 90, 1.6), roughness: 0.35, clearcoat: 0.5 }); const f = mesh(lathe([[0, -0.1], [0.05, -0.07], [0.075, 0], [0.07, 0.04], [0.04, 0.07], [0, 0.072]], 16), sm); f.scale.setScalar(s); gg.add(f); const cm = leafMat('#4aa832'); for (let i = 0; i < 6; i++) addLeaf(gg, leafGeo(0.05 * s, 0.022 * s, 1.5, 0.1, 'thin'), cm, 0, 0.068 * s, 0, i / 6 * Math.PI * 2, 1.7); }
    return gg;
  }
  function buildBush(g, a, k, ripe) {
    if (a.low) { rosette(g, 9, 0.42 * k + 0.08, 0.16 * k + 0.04, 0.95, 0.6, '#58a843', 0.02, 'heart', 0.4); if (k > 0.75) { const pos = [[0.2, 0.06], [-0.18, 0.12], [0.05, -0.22], [-0.12, -0.15], [0.22, -0.12]]; pos.slice(0, a.nf).forEach((p, i) => { const f = fruit('berry', a, ripe, ripe ? 1.25 : 0.8); f.position.set(p[0], 0.1, p[1]); f.rotation.set(0.4, i, 0.3); g.add(f); }); } return; }
    const H = a.h / 58 * 0.95 * k, sm = STEM(), r = CFG3.rng(a.nf * 13 + a.h);
    for (let s = 0; s < 3; s++) {
      const ang = s / 3 * Math.PI * 2 + 0.4, lean = 0.14 * k, top = v3(Math.cos(ang) * lean, H * (0.85 + s * 0.08), Math.sin(ang) * lean);
      g.add(tube([v3(0, 0, 0), v3(top.x * 0.4, top.y * 0.5, top.z * 0.4), top], 0.025, 0.012, sm, 6));
      for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.18, y = top.y * t; addLeaf(g, leafGeo(0.34 * k + 0.08, 0.13 * k + 0.03, 1.2, 0.3, 'leaf'), leafMat(i % 2 ? '#5aa843' : '#4b9a38'), top.x * t, y, top.z * t, ang + (i % 2 ? 1.4 : -1.4) + r() * 0.5, 1.0 + r() * 0.3); }
      addLeaf(g, leafGeo(0.28 * k + 0.06, 0.12 * k + 0.02, 0.6, 0.3), leafMat('#62b04a'), top.x, top.y - 0.02, top.z, ang, 0.3);
    }
    if (k > 0.75) { const n = a.nf + 1; for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2 + r(), rr = 0.17 + r() * 0.1, y = H * (0.3 + r() * 0.45); const f = fruit(a.kind, a, ripe, ripe ? 1 : 0.7); f.position.set(Math.cos(ang) * rr, y, Math.sin(ang) * rr); f.rotation.y = r() * 6; g.add(f); g.add(tube([v3(Math.cos(ang) * rr * 0.4, y + 0.12, Math.sin(ang) * rr * 0.4), f.position.clone().add(v3(0, a.kind === 'tomato' ? 0.08 : 0.06, 0))], 0.008, 0.006, sm, 3)); } }
  }
  function buildCorn(g, a, k, ripe) {
    const sm = mat('#6aa84a', { p: { roughness: 0.6 } }), lm = leafMat('#6cb048'), H = 1.65 * k;
    [[0, 0], [0.22, 0.14], [-0.18, 0.18]].slice(0, k > 0.7 ? 3 : 1).forEach(([x, z], s) => {
      const h = H * (1 - s * 0.08); g.add(tube([v3(x, 0, z), v3(x + 0.02, h * 0.5, z), v3(x, h, z)], 0.04, 0.022, sm, 6));
      for (let i = 0; i < 6; i++) { const y = h * (0.15 + i * 0.13); addLeaf(g, leafGeo(0.75 * k + 0.15, 0.07, 1.6, 0.4, 'blade'), lm, x, y, z, i * 2.3 + s, 0.65 + i * 0.05); }
      // 雄穗
      const tm = mat('#d8c070'); for (let i = 0; i < 5; i++) addLeaf(g, leafGeo(0.18 * k, 0.012, 1.2, 0, 'thin'), mat('#c8b060', { ds: 1 }), x, h, z, i * 1.25, 0.5);
      void tm;
      if (k > 0.75) { const cob = new T.Group(); const cm = mat(ripe ? '#f2c43a' : '#d6e08a', { p: { map: dotsTex(ripe ? '#f6d25a' : '#e0e8a0', ripe ? '#e0a820' : '#c8d880', 260, 3), roughness: 0.45 } }); const c = mesh(new T.CapsuleGeometry(0.06, 0.22, 6, 12), cm); cob.add(c); const hk = leafMat('#9cc860'); for (let i = 0; i < 3; i++) addLeaf(cob, leafGeo(0.3, 0.07, 0.3, 0.4, 'leaf'), hk, 0, -0.16, 0, i * 2.1, 0.25); cob.position.set(x + 0.08, h * 0.48, z + 0.03); cob.rotation.set(0.2, 0, -0.35); g.add(cob); }
    });
  }
  function buildVine(g, a, k, ripe) {
    const lm = leafMat('#4f9a36'), r = CFG3.rng(a.fruit.length * 7);
    for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2 + r(), d = 0.35 * k + 0.1; addLeaf(g, leafGeo(0.4 * k + 0.1, 0.24 * k + 0.05, 0.9, 0.35, 'heart'), lm, Math.cos(ang) * d * 0.3, 0.05, Math.sin(ang) * d * 0.3, ang, 1.25); }
    g.add(tube([v3(-0.6 * k, 0.03, 0.2), v3(-0.2, 0.06, 0.05), v3(0.3, 0.05, -0.1), v3(0.65 * k, 0.03, -0.25)], 0.014, 0.01, STEM(), 10));
    if (k > 0.75) {
      const s = ripe ? 1 : 0.6, col = ripe ? a.fruit : '#8fbf5a';
      if (a.kind === 'pumpkin') { const pg = new T.SphereGeometry(1, 40, 24), p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(z, x), rib = 1 - 0.09 * Math.pow(Math.abs(Math.sin(th * 5)), 0.6); p.setXYZ(i, x * rib, y * 0.72 * (1 - 0.15 * Math.pow(Math.max(0, y), 6)), z * rib); } pg.computeVertexNormals(); const f = mesh(pg, fruitMat(col, 0.42), 0.05, 0.3 * s, 0.05); f.scale.setScalar(0.44 * s); g.add(f); g.add(tube([v3(0.05, 0.6 * s, 0.05), v3(0.07, 0.68 * s, 0.06), v3(0.12, 0.72 * s, 0.04)], 0.035 * s, 0.025 * s, mat('#6a7a2a'), 4)); }
      else { const sm2 = new T.MeshPhysicalMaterial({ color: new T.Color('#ffffff'), map: stripeTex(ripe ? a.fruit : '#a8d080', ripe ? new T.Color(a.fruit).multiplyScalar(0.45).getStyle() : '#6fa850', 9), roughness: 0.3, clearcoat: 0.6 }); const f = mesh(sphereG(32, 22), sm2, 0, 0.32 * s, 0); f.scale.set(0.5 * s, 0.37 * s, 0.4 * s); f.rotation.y = 0.5; g.add(f); }
    }
  }
  // 花卉：郁金香 / 玫瑰 / 薰衣草（一丛几枝，成熟时开花）
  const RAINBOW = ['#ff4a5e', '#ffb21a', '#ffe23a', '#5ad04a', '#3aa8ff', '#a86aff'];
  function buildFlower(g, a, k, ripe) {
    const sm = mat('#4f9a36', { p: { roughness: 0.6 } }), lm = leafMat('#5aac40'), r = CFG3.rng(a.petal.length * 7 + 3);
    const lav = a.kind === 'lavender', n = lav ? 7 : k > 0.7 ? 5 : 3;
    for (let s = 0; s < n; s++) {
      const ang = s / n * Math.PI * 2 + r() * 0.5, rad = s === 0 && !lav ? 0 : 0.12 + r() * 0.14, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const h = (lav ? 0.85 : 0.75) * k * (0.85 + r() * 0.3), lean = lav ? 0.12 : 0.06, top = v3(x * (1 + lean * 4), h, z * (1 + lean * 4));
      g.add(tube([v3(x, 0, z), v3(x * 1.1, h * 0.5, z * 1.1), top], lav ? 0.014 : 0.02, 0.014, sm, 6));
      if (!lav) for (let i = 0; i < 2; i++) addLeaf(g, leafGeo(0.36 * k + 0.08, 0.07, 0.8, 0.5, 'blade'), lm, x, 0.02, z, ang + i * 2.6, 0.45);
      else addLeaf(g, leafGeo(0.3 * k + 0.06, 0.018, 0.6, 0.2, 'thin'), lm, x, 0.02, z, ang, 0.5);
      const col = a.petal === 'rainbow' ? RAINBOW[s % RAINBOW.length] : a.petal;
      if (k < 0.75) { g.add(blob(leafMat('#6cb048'), top.x, top.y, top.z, 0.035, 0.05, 0.035, 10)); continue; }
      const pm = new T.MeshPhysicalMaterial({ color: new T.Color(col).convertSRGBToLinear ? new T.Color(col) : new T.Color(col), roughness: 0.5, sheen: 0.2, sheenColor: new T.Color(col).lerp(new T.Color('#ffffff'), 0.4), side: T.DoubleSide });
      const head = new T.Group(); head.position.copy(top); head.rotation.set(x * 1.5, 0, -z * 1.5); if (!lav) head.scale.setScalar(1.35); g.add(head);
      if (lav) { // 穗状小花
        const L = ripe ? 0.28 : 0.16; for (let i = 0; i < 9; i++) { const y = i / 8 * L, rr = 0.028 * (1 - i / 12); for (let j = 0; j < 3; j++) { const aa = j / 3 * Math.PI * 2 + i; head.add(blob(pm, Math.cos(aa) * rr, y, Math.sin(aa) * rr, 0.022, 0.026, 0.022, 8)); } }
      } else if (a.kind === 'tulip') { // 杯状花苞：几片勺形花瓣
        const S = ripe ? 1 : 0.7, open = ripe ? 0.22 : 0.06;
        for (let i = 0; i < 6; i++) { const pt = mesh(lathe([[0, 0], [0.05, 0.03], [0.065, 0.09], [0.05, 0.15], [0, 0.17]], 10), pm); pt.scale.set(0.75 * S, S, 0.32 * S); const aa = i / 6 * Math.PI * 2 + (i % 2) * 0.3; pt.position.set(Math.cos(aa) * 0.02, 0, Math.sin(aa) * 0.02); pt.rotation.set(0, -aa, 0); const o = new T.Group(); o.add(pt); pt.position.set(0.035 * S, 0, 0); pt.rotation.z = -open - (i % 2) * 0.08; o.rotation.y = -aa; head.add(o); }
        head.add(blob(mat('#ffe68a'), 0, 0.05 * S, 0, 0.02, 0.03, 0.02, 8));
      } else { // 玫瑰：一圈圈包起来的花瓣
        const S = ripe ? 1 : 0.65; head.add(blob(pm, 0, 0.06 * S, 0, 0.04 * S, 0.05 * S, 0.04 * S, 12));
        [[5, 0.045, 0.1], [7, 0.075, 0.3], [9, 0.1, 0.55]].forEach(([m, R, op], ring) => { if (!ripe && ring > 1) return; for (let i = 0; i < m; i++) { const aa = i / m * Math.PI * 2 + ring * 0.6, pt = mesh(sphereG(10, 7), pm); pt.scale.set(0.05 * S, 0.06 * S, 0.012 * S); const o = new T.Group(); pt.position.set(R * S, 0.06 * S, 0); pt.rotation.set(0, Math.PI / 2, op); o.add(pt); o.rotation.y = aa; head.add(o); } });
        const cm = leafMat('#3f8a2a'); for (let i = 0; i < 5; i++) addLeaf(head, leafGeo(0.07, 0.025, 0.5, 0.2, 'leaf'), cm, 0, 0.0, 0, i * 1.256, 2.2);
      }
    }
  }
  // 谷物：小麦 / 水稻（一片细秆，成熟时麦穗金黄下垂）
  function buildGrain(g, a, k, ripe) {
    const r = CFG3.rng(a.ear.length * 13 + (a.kind === 'rice' ? 5 : 1)), rice = a.kind === 'rice';
    const sm = mat(ripe ? a.stalk : '#7cb84a', { p: { roughness: 0.65 } }), em = mat(ripe ? a.ear : '#9cc860', { p: { roughness: 0.5, map: dotsTex(ripe ? a.ear : '#a8d070', '#ffffff', 60, 1.4) } }), lm = leafMat(rice ? '#7cbc4a' : '#86b84a');
    const n = k > 0.7 ? 11 : 7;
    for (let s = 0; s < n; s++) {
      const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 0.34, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, h = 1.05 * k * (0.85 + r() * 0.25);
      const droop = ripe ? (rice ? 0.22 : 0.1) : 0.02, dx = Math.cos(ang + 1) * droop, dz = Math.sin(ang + 1) * droop, top = v3(x + dx, h - droop * 0.6, z + dz);
      g.add(tube([v3(x, 0, z), v3(x, h * 0.6, z), v3(x + dx * 0.4, h * 0.9, z + dz * 0.4), top], 0.012, 0.009, sm, 6));
      addLeaf(g, leafGeo(0.45 * k + 0.1, 0.03, 1.2, 0.3, 'blade'), lm, x, h * 0.2, z, ang + 0.5, 0.55);
      if (k < 0.7) continue;
      if (rice) { for (let i = 0; i < 7; i++) { const t = i / 6; g.add(blob(em, top.x - dx * t * 0.8, top.y + 0.02 - t * 0.12, top.z - dz * t * 0.8 + (i % 2 ? 0.02 : -0.02), 0.018, 0.028, 0.018, 8)); } }
      else { const ear = mesh(new T.CapsuleGeometry(0.03, 0.14, 4, 8), em); ear.position.copy(top).add(v3(0, 0.06, 0)); ear.rotation.set(dz * 3, 0, -dx * 3); g.add(ear); for (let i = 0; i < 4; i++) addLeaf(g, leafGeo(0.1, 0.004, 0.2, 0, 'thin'), mat(ripe ? a.ear : '#a8d070', { ds: 1 }), top.x, top.y + 0.12, top.z, i * 1.6, 0.2); }
    }
  }
  function buildSunflower(g, a, k, ripe) {
    const H = 1.55 * k, sm = mat('#5f9a3a'); const top = v3(0.06, H, 0.06);
    g.add(tube([v3(0, 0, 0), v3(0.02, H * 0.5, 0.01), top], 0.045, 0.03, sm, 8));
    for (let i = 0; i < 4; i++) addLeaf(g, leafGeo(0.42 * k + 0.1, 0.22 * k + 0.05, 1.0, 0.35, 'heart'), leafMat('#55a038'), 0.02, H * (0.22 + i * 0.17), 0.01, i * 2.4, 1.05);
    const head = new T.Group(); head.position.copy(top); head.rotation.set(-0.5, Math.PI / 4, 0, 'YXZ');
    if (ripe || k > 0.75) {
      const R = ripe ? 0.3 : 0.16; const disc = new T.CylinderGeometry(R, R * 0.9, 0.07, 32); const dm = new T.MeshStandardMaterial({ color: new T.Color('#ffffff'), map: (() => { const c = mkCanvas(128), x = c.getContext('2d'); x.fillStyle = '#4a2a12'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 520; i++) { const rr = Math.sqrt(i / 520) * 62, an = i * 2.39996; x.fillStyle = i % 3 ? '#7a4a1e' : '#2e1a0a'; x.beginPath(); x.arc(64 + Math.cos(an) * rr, 64 + Math.sin(an) * rr, 2.1, 0, 7); x.fill(); } return tex(c, 0); })(), roughness: 0.85 });
      const d = mesh(disc, [mat('#3a2410'), dm, mat('#3a5a1a')][1]); d.rotation.x = Math.PI / 2; head.add(d);
      if (ripe) { const pm = leafMat('#ffc21a'); for (let i = 0; i < 22; i++) { const l = addLeaf(head, leafGeo(0.2, 0.07, 0.2, 0.2, 'leaf'), pm, 0, 0, 0, 0, Math.PI / 2, 0); l.rotation.set(0, 0, i / 22 * Math.PI * 2); l.position.set(Math.cos(i / 22 * Math.PI * 2 + Math.PI / 2) * R * 0.92, Math.sin(i / 22 * Math.PI * 2 + Math.PI / 2) * R * 0.92, -0.01); } }
      else { const bm = leafMat('#6cb048'); for (let i = 0; i < 10; i++) { const l = addLeaf(head, leafGeo(0.12, 0.05, 0.5, 0.2), bm, 0, 0, -0.02, 0, 0, 0); l.rotation.set(0, 0, i / 10 * Math.PI * 2); } }
    } else head.add(blob(mat('#6cb048'), 0, 0, 0, 0.08, 0.08, 0.06));
    g.add(head);
  }
  function buildPine(g, a, k, ripe) {
    const lm = leafMat('#4f9a3a');
    for (let i = 0; i < 12; i++) addLeaf(g, leafGeo(0.55 * k + 0.12, 0.06, 0.7, 0.4, 'blade'), lm, 0, 0.02, 0, i / 12 * Math.PI * 2, 0.75 + (i % 2) * 0.25);
    if (k > 0.75) { const s = ripe ? 1 : 0.75, col = ripe ? '#e8a830' : '#9ac45a'; const fm = new T.MeshStandardMaterial({ color: new T.Color(col), roughness: 0.6, map: (() => { const c = mkCanvas(128), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(90,50,10,.55)'; x.lineWidth = 2; for (let i = -8; i < 16; i++) { x.beginPath(); x.moveTo(i * 12, 0); x.lineTo(i * 12 + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i * 12 + 128, 0); x.lineTo(i * 12, 128); x.stroke(); } return tex(c, 0); })() }); fm.map.repeat.set(2, 1);
      const f = blob(fm, 0, 0.3 * s, 0, 0.2 * s, 0.3 * s, 0.2 * s, 20); g.add(f); const cm = leafMat('#3f8a2a'); for (let i = 0; i < 10; i++) addLeaf(g, leafGeo(0.3 * s, 0.05, 0.4, 0.3, 'blade'), cm, 0, 0.56 * s, 0, i / 10 * Math.PI * 2, 0.35 + (i % 2) * 0.2); }
  }
  function cropModel(c, stage) {
    const key = c + ':' + stage; if (CROP_CACHE.has(key)) return CROP_CACHE.get(key);
    const cr = CFG3.CROPS[c], a = cr.art, g = new T.Group();
    if (stage === 0) seedMound(g); else if (stage === 1) sprout(g, 1);
    else { const k = stage === 2 ? 0.55 : stage === 3 ? 0.82 : 1, ripe = stage === 4; ({ root: buildRoot, cabbage: buildCabbage, bush: buildBush, corn: buildCorn, vine: buildVine, sunflower: buildSunflower, pine: buildPine, flower: buildFlower, grain: buildGrain })[a.type](g, a, k, ripe); }
    const m = merge(g); m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const box = new T.Box3().setFromObject(m); m.userData.h = Math.max(0.25, box.max.y);
    CROP_CACHE.set(key, m); return m;
  }

  /* ---------------- 环境 ---------------- */
  const anim = { windmill: null, smoke: [], chickens: [], butterflies: [], clouds: [], dogs: [], water: null, grassU: { value: 0 }, lamps: [], windows: [], fireflies: null, rain: null, house: null };
  function tree(x, z, s, col, apples) {
    const g = new T.Group(), r = CFG3.rng(Math.round(x * 13 + z * 7));
    const trunk = new T.CylinderGeometry(0.16, 0.28, 2.2, 8, 3); displace(trunk, 0.03, 2, 5);
    g.add(mesh(trunk, mat('#6a4a2e', { p: { map: TX.wood, roughness: 0.95 } }), 0, 1.1, 0));
    const fm = mat(col, { vc: 1, p: { roughness: 0.85 } });
    for (let i = 0; i < 5; i++) { const geo = new T.SphereGeometry(1, 26, 18); displace(geo, 0.14, 1.3, 11 + i); displace(geo, 0.05, 4.5, 40 + i); geo.computeVertexNormals(); colorize(geo, (px, py) => { const v = 0.7 + py * 0.26; return [v, v * 1.02, v * 0.96]; }); const o = mesh(geo, fm, (r() - 0.5) * 1.1, 2.5 + r() * 0.9 + (i === 0 ? 0.6 : 0), (r() - 0.5) * 1.1); o.scale.setScalar(0.85 + r() * 0.45); g.add(o); }
    if (apples) { const am = fruitMat('#d8302a', 0.3); for (let i = 0; i < 9; i++) { const a = r() * 6.28, h = 2.3 + r() * 1.4; g.add(blob(am, Math.cos(a) * 1.15, h, Math.sin(a) * 1.15, 0.1, 0.1, 0.1, 10)); } }
    const m = merge(g); m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = r() * 6; return m;
  }
  function bushAt(x, z, s, col) { const g = new T.Group(), fm = mat(col, { vc: 1, p: { roughness: 0.85 } }); for (let i = 0; i < 3; i++) { const geo = new T.SphereGeometry(1, 20, 14); displace(geo, 0.12, 1.5, 30 + i); displace(geo, 0.05, 5, 60 + i); geo.computeVertexNormals(); colorize(geo, (px, py) => { const v = 0.7 + py * 0.25; return [v, v, v]; }); const o = mesh(geo, fm, (i - 1) * 0.45, 0.35, (i % 2) * 0.3); o.scale.set(0.55, 0.45, 0.5); g.add(o); } const m = merge(g); m.position.set(x, 0, z); m.scale.setScalar(s); return m; }
  function rock(x, z, s) { const geo = new T.SphereGeometry(1, 22, 14); displace(geo, 0.2, 1.2, Math.round(x * 3 + z)); geo.computeVertexNormals(); const o = mesh(geo, mat('#aaa498', { p: { roughness: 0.8, map: TX.stone, normalMap: TX.stoneN } }), x, s * 0.35, z); o.scale.set(s, s * 0.6, s * 0.85); o.rotation.y = x; return o; }
  function fencePost(g, x, z, wm) { g.add(mesh(new T.BoxGeometry(0.14, 0.9, 0.14), wm, x, 0.45, z)); const cap = mesh(new T.ConeGeometry(0.11, 0.14, 4), wm, x, 0.97, z); cap.rotation.y = Math.PI / 4; g.add(cap); }
  function fenceLine(g, x0, z0, x1, z1, wm, step) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (step || 1.15))); for (let i = 0; i <= n; i++) fencePost(g, x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, wm); const ang = Math.atan2(z1 - z0, x1 - x0); [0.35, 0.7].forEach(h => { const r = mesh(new T.BoxGeometry(L, 0.07, 0.05), wm, (x0 + x1) / 2, h, (z0 + z1) / 2); r.rotation.y = -ang; g.add(r); }); }
  function buildHouse() {
    const g = new T.Group(), wallM = new T.MeshStandardMaterial({ color: new T.Color('#f3e6cc'), map: TX.plaster, roughness: 0.9 }), wood = mat('#7a5232', { p: { map: TX.wood, roughness: 0.8 } }), dark = mat('#5a3a22', { p: { map: TX.wood } });
    const roofM = new T.MeshStandardMaterial({ color: new T.Color('#b8473a'), map: TX.tiles, roughness: 0.7 }); roofM.map = TX.tiles.clone(); roofM.map.needsUpdate = true; roofM.map.repeat.set(3, 2);
    g.add(mesh(new T.BoxGeometry(5.2, 0.4, 4.2), mat('#8a8478', { p: { map: TX.stone, normalMap: TX.stoneN } }), 0, 0.2, 0));
    g.add(mesh(new T.BoxGeometry(5, 2.8, 4), wallM, 0, 1.8, 0));
    [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]].forEach(([x, z]) => g.add(mesh(new T.BoxGeometry(0.22, 2.9, 0.22), dark, x, 1.85, z)));
    g.add(mesh(new T.BoxGeometry(5.1, 0.2, 4.1), dark, 0, 3.25, 0));
    // 双坡屋顶
    const rl = 2.75, slope = 0.62; [-1, 1].forEach(sd => { const r = mesh(new T.BoxGeometry(5.8, 0.18, rl), roofM, 0, 3.25 + Math.sin(slope) * rl / 2 + 0.05, sd * Math.cos(slope) * rl / 2); r.rotation.x = sd * slope; g.add(r); });
    const gable = new T.Shape(); gable.moveTo(-2, 0); gable.lineTo(2, 0); gable.lineTo(0, 1.55); gable.closePath(); const gg = new T.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false });
    [-2.45, 2.25].forEach(x => { const o = mesh(gg, wallM, x, 3.3, 0); o.rotation.y = Math.PI / 2; g.add(o); });
    g.add(mesh(new T.BoxGeometry(5.9, 0.16, 0.16), dark, 0, 3.3 + Math.sin(slope) * rl + 0.05, 0));
    // 门、窗、烟囱
    g.add(mesh(new T.BoxGeometry(1.1, 1.9, 0.12), wood, 0.6, 1.35, 2.04)); g.add(blob(mat('#d8b040', { p: { metalness: 0.6, roughness: 0.3 } }), 0.95, 1.35, 2.12, 0.05));
    const glass = new T.MeshStandardMaterial({ color: new T.Color('#9ac4d8'), roughness: 0.15, metalness: 0.1, emissive: new T.Color('#ffb85a'), emissiveIntensity: 0 }); glass.userData.win = 1; anim.windows.push(glass);
    [[-1.4, 2.03, 0], [2.53, 0.4, Math.PI / 2], [2.53, -1.2, Math.PI / 2]].forEach(([x, z, ry]) => { const w = new T.Group(); w.add(mesh(new T.BoxGeometry(1.0, 0.9, 0.06), glass)); w.add(mesh(new T.BoxGeometry(1.16, 0.1, 0.12), dark, 0, 0.5, 0)); w.add(mesh(new T.BoxGeometry(1.16, 0.1, 0.12), dark, 0, -0.5, 0)); w.add(mesh(new T.BoxGeometry(0.08, 1.0, 0.1), dark)); w.add(mesh(new T.BoxGeometry(1.0, 0.06, 0.1), dark)); const box = mesh(new T.BoxGeometry(1.1, 0.2, 0.25), wood, 0, -0.62, 0.1); w.add(box); const fc = ['#ff6a8a', '#ffd23a', '#ffffff', '#c86aff']; for (let i = 0; i < 6; i++) w.add(blob(mat(fc[i % 4]), -0.42 + i * 0.17, -0.48, 0.12, 0.07, 0.06, 0.07, 8)); w.position.set(x, 1.95, z); w.rotation.y = ry; g.add(w); });
    g.add(mesh(new T.BoxGeometry(0.6, 1.6, 0.6), mat('#8a8070', { p: { map: TX.stone, normalMap: TX.stoneN } }), -1.5, 4.4, -0.7));
    g.add(mesh(new T.BoxGeometry(1.6, 0.18, 0.9), mat('#8a8478', { p: { map: TX.stone } }), 0.6, 0.09, 2.5));
    const m = merge(g); m.traverse(o => { if (o.isMesh && o.material === roofM) o.userData.roof = 1; if (o.isMesh && o.material === wallM) o.userData.wall = 1; });
    anim.house = { roofM, wallM, smokeAt: v3(-1.5, 5.3, -0.7) }; return m;
  }
  function buildWindmill() {
    const g = new T.Group(), sm = mat('#d8cfbf', { p: { map: TX.stone, normalMap: TX.stoneN, roughness: 0.9 } }), wood = mat('#6a4a2e', { p: { map: TX.wood } });
    g.add(mesh(new T.CylinderGeometry(1.0, 1.55, 6.2, 16), sm, 0, 3.1, 0));
    g.add(mesh(new T.ConeGeometry(1.3, 1.5, 16), mat('#7a3a2a', { p: { map: TX.tiles } }), 0, 6.95, 0));
    g.add(mesh(new T.BoxGeometry(0.8, 1.4, 0.1), wood, 0, 0.8, 1.42)); [2.6, 4.4].forEach(y => g.add(mesh(new T.BoxGeometry(0.45, 0.6, 0.1), mat('#3a5a6a', { p: { roughness: 0.2 } }), 0, y, 1.3 - (y - 2.6) * 0.05)));
    const body = merge(g); const all = new T.Group(); all.add(body);
    const blades = new T.Group(); blades.position.set(0, 5.9, 1.25);
    blades.add(mesh(new T.CylinderGeometry(0.22, 0.22, 0.5, 12), wood).rotateX(Math.PI / 2));
    const sail = mat('#f2ead8', { ds: 1, p: { roughness: 0.9 } });
    for (let i = 0; i < 4; i++) { const b = new T.Group(); b.add(mesh(new T.BoxGeometry(0.12, 3.6, 0.08), wood, 0, 1.9, 0)); b.add(mesh(new T.BoxGeometry(0.75, 2.9, 0.03), sail, 0.42, 2.2, 0.02)); for (let j = 0; j < 6; j++) b.add(mesh(new T.BoxGeometry(0.85, 0.04, 0.05), wood, 0.42, 0.9 + j * 0.5, 0.04)); b.rotation.z = i * Math.PI / 2; blades.add(b); }
    const bm = merge(blades); bm.position.copy(blades.position); all.add(bm); anim.windmill = bm; return all;
  }
  /* 鱼塘（2026-10-26 连成一片）：所有已开挖的池塘画成一整片水面 —— 用一张遮罩图把几个椭圆合起来，水面、塘底、岸边沙地各一层；
     岸边的石头只放在合起来的外边缘（在别的池塘里面的不放） */
  const PRX = 4.0, PRZ = 3.2, pondWob = (a, i) => 1 + Math.sin(a * 3 + i * 1.7) * 0.1 + Math.cos(a * 5 + i) * 0.06;
  function inPond(x, z, i, k) { const [px, pz] = PONDS[i], dx = (x - px) / PRX, dz = (z - pz) / PRZ, a = Math.atan2(dz, dx), w = pondWob(a, i) * (k || 1); return dx * dx + dz * dz < w * w; }
  function buildPonds(n) {
    const g = new T.Group(), act = PONDS.slice(0, n); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; act.forEach(([x, z]) => { x0 = Math.min(x0, x - 6); x1 = Math.max(x1, x + 6); z0 = Math.min(z0, z - 5); z1 = Math.max(z1, z + 5); });
    const W = x1 - x0, D = z1 - z0, PX = 10, mask = k => { const c = document.createElement('canvas'); c.width = Math.ceil(W * PX); c.height = Math.ceil(D * PX); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.filter = 'blur(2px)';
      act.forEach(([px, pz], i) => { x.beginPath(); for (let s2 = 0; s2 <= 48; s2++) { const a = s2 / 48 * Math.PI * 2, w2 = pondWob(a, i) * k, X = (px + Math.cos(a) * PRX * w2 - x0) * PX, Z = (pz + Math.sin(a) * PRZ * w2 - z0) * PX; s2 ? x.lineTo(X, Z) : x.moveTo(X, Z); } x.fill(); }); const t = new T.CanvasTexture(c); t.flipY = false; return t; };
    const plane = (m, y) => { const pg = new T.PlaneGeometry(W, D); pg.rotateX(-Math.PI / 2); /* 让 uv 和遮罩图的方向一致：u 沿 x，v 沿 z */ const uv = pg.attributes.uv, P = pg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) / W + 0.5, P.getZ(i) / D + 0.5); const o = new T.Mesh(pg, m); o.position.set(x0 + W / 2, y, z0 + D / 2); o.receiveShadow = true; o.userData.keep = true; g.add(o); return o; };
    plane(new T.MeshStandardMaterial({ color: new T.Color('#b9aa82'), roughness: 1, alphaMap: mask(1.18), transparent: true, depthWrite: false }), 0.012);
    plane(new T.MeshStandardMaterial({ color: new T.Color('#2e4a40'), roughness: 1, alphaMap: mask(1.0), transparent: true, depthWrite: false }), 0.02);
    const wm = new T.MeshStandardMaterial({ color: new T.Color('#3d8fb0'), roughness: 0.06, metalness: 0.25, normalMap: TX.waterN, transparent: true, opacity: 0.8, alphaMap: mask(0.97), depthWrite: false }); wm.normalScale.set(0.6, 0.6); wm.normalMap.repeat.set(W / 8, D / 8);
    plane(wm, 0.05); anim.water = wm;
    const sm = mat('#b8b2a4', { p: { roughness: 0.75, map: TX.stone, normalMap: TX.stoneN } }), r = CFG3.rng(99 + n), peb = (() => { const g2 = new T.SphereGeometry(1, 14, 10); displace(g2, 0.12, 1.4, 7); g2.computeVertexNormals(); return g2; })();
    act.forEach(([px, pz], i) => { for (let k = 0; k < 46; k++) { const a = k / 46 * Math.PI * 2, w2 = pondWob(a, i) * 1.02, x = px + Math.cos(a) * PRX * w2, z = pz + Math.sin(a) * PRZ * w2; if (act.some((q, j) => j !== i && inPond(x, z, j, 1.0))) continue; const o = mesh(peb, sm, x, 0.08, z); o.scale.set(0.3 + r() * 0.2, 0.18 + r() * 0.1, 0.25 + r() * 0.15); o.rotation.set(r(), r() * 6, r()); g.add(o); } });
    const lm = mat('#3f8a3a', { p: { roughness: 0.6 } }), cat = mat('#6a8a3a'), catTop = mat('#6a4020');
    act.forEach(([px, pz], i) => { for (let k = 0; k < 5; k++) { const x = px + (r() - 0.5) * 4.5, z = pz + (r() - 0.5) * 3.5; const pad = new T.CircleGeometry(0.32, 16, 0.3, Math.PI * 2 - 0.4); const o = mesh(pad, lm, x, 0.07, z); o.rotation.set(-Math.PI / 2, 0, r() * 6); g.add(o); if (k % 2 === 0) g.add(blob(mat('#ffb0d0'), x + 0.1, 0.14, z, 0.09, 0.06, 0.09, 10)); }
      for (let k = 0; k < 5; k++) { const a = r() * 6.28, x = px + Math.cos(a) * PRX * 1.08, z = pz + Math.sin(a) * PRZ * 1.08; if (act.some((q, j) => j !== i && inPond(x, z, j, 1.0))) continue; g.add(mesh(new T.CylinderGeometry(0.02, 0.03, 1.4, 5), cat, x, 0.7, z)); g.add(mesh(new T.CapsuleGeometry(0.05, 0.25, 4, 8), catTop, x, 1.35, z)); } });
    const m = merge(g); m.userData.ponds = n; return m;
  }
  function buildScarecrow() { const g = new T.Group(), w = mat('#7a5232', { p: { map: TX.wood } }); g.add(mesh(new T.CylinderGeometry(0.07, 0.08, 2.4, 6), w, 0, 1.2, 0)); g.add(mesh(new T.CylinderGeometry(0.05, 0.05, 1.8, 6), w, 0, 1.75, 0).rotateZ(Math.PI / 2)); g.add(mesh(new T.BoxGeometry(0.75, 0.8, 0.35), mat('#b8503a', { p: { roughness: 0.9 } }), 0, 1.55, 0)); g.add(mesh(new T.BoxGeometry(1.5, 0.22, 0.3), mat('#b8503a'), 0, 1.78, 0)); g.add(blob(mat('#e0c898', { p: { roughness: 1 } }), 0, 2.25, 0, 0.28)); g.add(mesh(new T.CylinderGeometry(0.5, 0.5, 0.04, 20), mat('#c8a050'), 0, 2.48, 0)); g.add(mesh(new T.ConeGeometry(0.28, 0.35, 16), mat('#c8a050'), 0, 2.66, 0)); const m = merge(g); return m; }
  function buildDoghouse() { const g = new T.Group(), w = mat('#9a6a3a', { p: { map: TX.wood } }); g.add(mesh(new T.BoxGeometry(1.3, 1.0, 1.2), w, 0, 0.5, 0)); [-1, 1].forEach(s => { const r = mesh(new T.BoxGeometry(1.5, 0.08, 0.9), mat('#b8473a', { p: { map: TX.tiles } }), 0, 1.15, s * 0.32); r.rotation.x = s * 0.7; g.add(r); }); g.add(mesh(new T.CircleGeometry(0.3, 16), mat('#1a1008', { ds: 1 }), 0, 0.42, 0.61)); g.add(mesh(new T.BoxGeometry(0.66, 0.42, 0.02), mat('#1a1008', { ds: 1 }), 0, 0.22, 0.61)); return merge(g); }
  // 名字牌：画在画布上的文字精灵
  function nameTag(text, col) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = 'rgba(20,14,8,0.72)'; const r = 30; x.beginPath(); x.moveTo(r, 8); x.arcTo(248, 8, 248, 88, r); x.arcTo(248, 88, 8, 88, r); x.arcTo(8, 88, 8, 8, r); x.arcTo(8, 8, 248, 8, r); x.fill();
    x.strokeStyle = col; x.lineWidth = 4; x.stroke(); x.fillStyle = '#fff4d8'; x.font = 'bold 50px "PingFang SC","Microsoft YaHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 50);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; const sp = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(0.95, 0.36, 1); sp.renderOrder = 10; return sp;
  }
  /* =====================================================
     看家狗：按主人提供的照片建模（两只都是边牧）
     - 形体：用有向距离函数（SDF）描述胸、腰、臀、颈部毛领、头、吻部、耳朵、尾巴，平滑融合后生成曲面
     - 毛色：按部位逐点上色（白胸、白颈圈、白腿、白色鼻梁纹、尾尖白），福旺的蓝陌斑块用 3D 噪声生成
     - 质感：毛领、尾巴、后腿做蓬松毛边；材质带“绒毛光泽”（sheen）
       福旺：蓝陌（灰底黑斑），头偏深色，青绿色胸背带（红边）
       睿宝：黄白（金棕色），完整的白色毛领，青绿色项圈
     ===================================================== */
  const DOG_LOOK = {
    fuwang: { name: '福旺', tag: '#c8d2e0', s: 1.04, coat: 'merle', harness: '#1f9e9a', trim: '#c8442e', ruffRing: false, eye: '#3a2412' },
    ruibao: { name: '睿宝', tag: '#ffcf5a', s: 1.0, coat: 'gold', harness: '#1f9e9a', trim: null, ruffRing: true, eye: '#2a1608' },
    // v3.1 更多颜色（领养的边牧，按毛色区分模型）
    black: { name: '黑白边牧', tag: '#e8e8e8', s: 1.02, coat: 'black', harness: '#d8402a', trim: null, ruffRing: true, eye: '#3a2412' },
    red: { name: '红白边牧', tag: '#e8b090', s: 1.0, coat: 'red', harness: '#2a7ad8', trim: null, ruffRing: true, eye: '#5a3010' },
    redmerle: { name: '红陨石边牧', tag: '#f0c0a8', s: 1.0, coat: 'redmerle', harness: '#3aa860', trim: '#ffd23a', ruffRing: false, eye: '#6a4020' },
    tri: { name: '三色边牧', tag: '#e8c890', s: 1.03, coat: 'tri', harness: '#8a3ad8', trim: null, ruffRing: true, eye: '#3a2412' },
    lilac: { name: '丁香紫边牧', tag: '#d8c8e8', s: 0.98, coat: 'lilac', harness: '#ff8ac8', trim: null, ruffRing: true, eye: '#6a5030' },
    slate: { name: '石板蓝边牧', tag: '#b8c4d8', s: 1.02, coat: 'slate', harness: '#ffb21a', trim: null, ruffRing: true, eye: '#4a3018' },
    merle: { name: '蓝陌边牧', tag: '#c8d2e0', s: 1.0, coat: 'merle', harness: '#d8402a', trim: '#ffffff', ruffRing: false, eye: '#4a6a8a' },
    gold: { name: '黄白边牧', tag: '#ffcf5a', s: 0.98, coat: 'gold', harness: '#8a3ad8', trim: null, ruffRing: true, eye: '#2a1608' },
  };
  const SOLID = { black: ['#16151a', '#2a262c'], red: ['#6e3820', '#9a5a34'], tri: ['#17161a', '#2a262c'], lilac: ['#9a888e', '#b8a8ac'], slate: ['#525a68', '#6e7684'] };
  const n3 = (x, y, z, s) => (vnoise(x, y, s, 0) + vnoise(y + 3.1, z, s + 1, 0) + vnoise(z + 7.7, x, s + 2, 0)) / 3;
  const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  function sEll(px, py, pz, c, r, inv) {
    let x = px - c[0], y = py - c[1], z = pz - c[2];
    if (inv) { const e = inv.elements, X = e[0] * x + e[4] * y + e[8] * z, Y = e[1] * x + e[5] * y + e[9] * z, Z = e[2] * x + e[6] * y + e[10] * z; x = X; y = Y; z = Z; }
    const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]), k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
  }
  function sCap(px, py, pz, a, b, ra, rb) {
    const pax = px - a[0], pay = py - a[1], paz = pz - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
    return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
  }
  const rotInv = (x, y, z) => new T.Matrix4().makeRotationFromEuler(new T.Euler(x, y, z)).invert();
  // 把 SDF 变成平滑网格，并按 colorFn 逐顶点上色
  function sdfMesh(fn, cx, cy, cz, B, res, colorFn) {
    const mc = new MCUBES(res, new T.MeshBasicMaterial(), false, false, 90000), N = mc.size, half = N / 2, K = 80 / (B * 0.05);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wx = cx + (x - half) / half * B, wy = cy + (y - half) / half * B, wz = cz + (z - half) / half * B;
      mc.field[x + y * N + z * N * N] = Math.max(-2000, Math.min(2000, 80 - fn(wx, wy, wz) * K));
    }
    mc.isolation = 80; mc.update();
    const n = mc.count, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), tc = new T.Color();
    for (let i = 0; i < n; i++) {
      const x = mc.positionArray[i * 3] * B + cx, y = mc.positionArray[i * 3 + 1] * B + cy, z = mc.positionArray[i * 3 + 2] * B + cz;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      nor[i * 3] = mc.normalArray[i * 3]; nor[i * 3 + 1] = mc.normalArray[i * 3 + 1]; nor[i * 3 + 2] = mc.normalArray[i * 3 + 2];
      colorFn(x, y, z, tc); col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b;
    }
    mc.geometry.dispose();
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeBoundingSphere(); return g;
  }
  // 毛色
  const C_WHITE = new T.Color('#f4f1ea'), C_MGREY = new T.Color('#7d8590'), C_MLIGHT = new T.Color('#a9b0b8'), C_MBLACK = new T.Color('#1c1c22'), C_GOLD = new T.Color('#c27326'), C_GOLDL = new T.Color('#dca266'), C_GOLDD = new T.Color('#9a5418');
  function coatAt(L, x, y, z, out, darkHead) {
    const fine = n3(x * 40, y * 40, z * 40, 5);
    if (L.coat === 'merle') {
      const big = n3(x * 4.2 + 11, y * 4.2, z * 4.2 + 3, 61), mid = n3(x * 8 + 2, y * 8, z * 8, 77);
      out.copy(C_MGREY).multiplyScalar(0.8 + fine * 0.35);
      if (mid > 0.64) out.copy(C_MLIGHT).multiplyScalar(0.9 + fine * 0.18);              // 浅灰斑
      out.lerp(C_MBLACK, sst(0.53, 0.57, big));                                          // 黑色斑块
      if (darkHead) out.lerp(C_MBLACK, darkHead);
    } else if (L.coat === 'redmerle') {
      const big = n3(x * 4.2 + 5, y * 4.2, z * 4.2 + 9, 63), mid = n3(x * 8 + 7, y * 8, z * 8, 79);
      out.set('#c88a6c').multiplyScalar(0.85 + fine * 0.3); if (mid > 0.64) out.set('#dcaa90');
      out.lerp(new T.Color('#7a3420'), sst(0.53, 0.57, big)); if (darkHead) out.lerp(new T.Color('#7a3420'), darkHead * 0.8);
    } else if (SOLID[L.coat]) {
      const [a, b] = SOLID[L.coat]; out.set(a).multiplyScalar(0.85 + fine * 0.35); out.lerp(new T.Color(b), sst(0.66, 0.78, y) * 0.3);
      if (L.coat === 'tri') out.lerp(new T.Color('#b8722e'), sst(0.56, 0.47, y) * sst(-0.1, 0.2, x) * 0.85 + (y > 0.8 && y < 0.92 && x > 0.5 ? 0.6 : 0)); // 三色：腿上、脸颊的棕色
    } else {
      out.copy(C_GOLD).multiplyScalar(0.84 + fine * 0.3);                                 // 金棕色
      out.lerp(C_GOLDL, sst(0.62, 0.45, y) * 0.4);                                       // 下侧偏浅
      out.lerp(C_GOLDD, sst(0.66, 0.76, y) * sst(-0.2, 0.2, x) * 0.35);                  // 背脊偏深
    }
    return out;
  }
  const DOG_GEO = {}, DOG_BASE_Y = -0.095; // 整体放低（腿短一些，更接近边牧的比例）
  function dogGeometry(kind) {
    if (DOG_GEO[kind]) return DOG_GEO[kind]; const L = DOG_LOOK[kind], merle = L.coat === 'merle' || L.coat === 'redmerle';
    // ---- 身体（含脖子、毛领、后腿上段）----
    const torso = (x, y, z) => {
      let d = sEll(x, y, z, [0.26, 0.6, 0], [0.2, 0.2, 0.165]);
      d = smin(d, sCap(x, y, z, [0.22, 0.6, 0], [-0.27, 0.615, 0], 0.152, 0.148), 0.1);
      d = smin(d, sEll(x, y, z, [-0.3, 0.6, 0], [0.17, 0.165, 0.155]), 0.08);
      d = smin(d, Math.min(sEll(x, y, z, [-0.31, 0.47, 0.085], [0.1, 0.15, 0.072]), sEll(x, y, z, [-0.31, 0.47, -0.085], [0.1, 0.15, 0.072])), 0.06);
      d = smin(d, sCap(x, y, z, [0.3, 0.68, 0], [0.43, 0.85, 0], 0.118, 0.098), 0.08);
      d = smin(d, sEll(x, y, z, [0.37, 0.73, 0], [0.105, 0.12, 0.15]), 0.05);
      d = smax(d, -sEll(x, y, z, [0.0, 0.36, 0], [0.32, 0.09, 0.3]), 0.07);             // 收腰
      const fl = Math.max(sst(0.22, 0.05, Math.hypot(x - 0.37, y - 0.72, z * 0.8)), sst(0.2, 0.02, Math.hypot(x + 0.31, y - 0.46, (Math.abs(z) - 0.08) * 1.4)) * 0.8, sst(0.5, 0.42, y) * sst(0.1, 0.3, x) * 0.6);
      return d - (n3(x * 26, y * 26, z * 26, 9) - 0.5) * 0.045 * fl;                    // 毛领、后腿、前胸下的蓬毛
    };
    const torsoCol = (x, y, z, out) => {
      coatAt(L, x, y, z, out);
      let w = sst(0.24, 0.33, x) * (1 - sst(0.8, 0.88, y));                              // 白胸
      const ring = 1 - sst(0.12, 0.17, Math.hypot(x - 0.36, y - 0.74)); w = Math.max(w, L.ruffRing ? ring : ring * (1 - sst(0.78, 0.84, y)) * sst(0.25, 0.33, x)); // 颈圈
      w = Math.max(w, (1 - sst(0.44, 0.5, y)) * sst(-0.22, -0.1, x));                    // 肚皮
      out.lerp(C_WHITE, w); return out;
    };
    // ---- 头（以颈顶为原点）----
    const eL = rotInv(0.62, 0, -0.2), eR = rotInv(-0.62, 0, -0.2), tL = rotInv(0.62, 0, 1.15), tR = rotInv(-0.62, 0, 1.15);
    const head = (x, y, z) => {
      let d = sEll(x, y, z, [0, 0.02, 0], [0.125, 0.115, 0.115]);
      d = smin(d, Math.min(sEll(x, y, z, [0.05, -0.035, 0.05], [0.085, 0.075, 0.065]), sEll(x, y, z, [0.05, -0.035, -0.05], [0.085, 0.075, 0.065])), 0.05);
      d = smin(d, sCap(x, y, z, [0.07, -0.025, 0], [0.19, -0.045, 0], 0.066, 0.046), 0.05);
      d = smin(d, sEll(x, y, z, [0.11, -0.075, 0], [0.08, 0.034, 0.05]), 0.04);
      const ears = Math.min(sEll(x, y, z, [-0.03, 0.12, 0.085], [0.058, 0.06, 0.021], eL), sEll(x, y, z, [-0.03, 0.12, -0.085], [0.058, 0.06, 0.021], eR));
      const tips = Math.min(sEll(x, y, z, [-0.005, 0.172, 0.112], [0.032, 0.026, 0.013], tL), sEll(x, y, z, [-0.005, 0.172, -0.112], [0.032, 0.026, 0.013], tR));
      d = smin(d, smin(ears, tips, 0.02), 0.03);
      return d - (n3(x * 30, y * 30, z * 30, 4) - 0.5) * 0.012 * sst(0.05, -0.08, x);
    };
    const headCol = (x, y, z, out) => {
      const earZone = sst(0.09, 0.13, y);
      coatAt(L, x + 0.46, y + 0.88, z, out, merle ? 0.55 + earZone * 0.3 : 0);
      if (!merle && earZone > 0 && Math.abs(z) < 0.07 && x > -0.01) out.lerp(new T.Color('#f2d2b0'), earZone * 0.5);       // 耳朵内侧
      const blaze = (1 - sst(0.016 + Math.max(0, x) * 0.16, 0.03 + Math.max(0, x) * 0.2, Math.abs(z))) * sst(-0.07, -0.03, x) * (1 - sst(0.1, 0.13, y));
      const muzzle = sst(0.1, 0.14, x) + (1 - sst(-0.07, -0.05, y)) * sst(0.02, 0.06, x);
      out.lerp(C_WHITE, Math.min(1, Math.max(blaze, muzzle))); return out;
    };
    // ---- 尾巴（以尾根为原点）----
    const TP = [[0, 0, 0], [-0.09, -0.07, 0], [-0.15, -0.18, 0], [-0.17, -0.29, 0], [-0.13, -0.37, 0]], TR = [0.04, 0.055, 0.066, 0.064, 0.045];
    const tail = (x, y, z) => { let d = 1; for (let i = 0; i < 4; i++) d = smin(d, sCap(x, y, z, TP[i], TP[i + 1], TR[i], TR[i + 1]), 0.04); return d - (n3(x * 24, y * 24, z * 24, 8) - 0.5) * 0.035; };
    const tailCol = (x, y, z, out) => { coatAt(L, x - 0.44, y + 0.64, z, out); return out.lerp(C_WHITE, sst(-0.28, -0.33, y)); };
    // ---- 腿：前腿全白；后腿上段毛色、下段白 ----
    const legGeo = front => { const g = new T.LatheGeometry([[0, -0.37], [0.036, -0.36], [0.042, -0.31], [0.04, -0.25], [front ? 0.047 : 0.045, -0.18], [front ? 0.06 : 0.066, -0.08], [front ? 0.068 : 0.078, 0], [0.05, 0.05], [0, 0.07]].map(([r, y]) => new T.Vector2(r, y)), 18); g.computeVertexNormals(); const p = g.attributes.position, c = new Float32Array(p.count * 3), tc = new T.Color(); for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (front) tc.copy(C_WHITE); else { coatAt(L, -0.3, 0.46 + y, 0.1, tc); tc.lerp(C_WHITE, sst(-0.12, -0.2, y)); } c.set([tc.r, tc.g, tc.b], i * 3); } g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; };
    DOG_GEO[kind] = {
      torso: sdfMesh(torso, -0.02, 0.6, 0, 0.6, 54, torsoCol),
      head: sdfMesh(head, 0.06, 0.04, 0, 0.27, 46, headCol),
      tail: sdfMesh(tail, -0.12, -0.18, 0, 0.27, 36, tailCol),
      legF: legGeo(true), legH: legGeo(false),
    };
    return DOG_GEO[kind];
  }
  // 会动的毛：在顶点着色器里让肚子下面、胸前、屁股的长毛随走动向后飘、上下抖；耳朵随步伐一颠一颠；尾巴像鞭子一样一节一节地摆
  function dogFurMat(U, part) {
    const m = furMat();
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
      sh.vertexShader = 'uniform float uT, uMove, uBob, uWagPh, uWagA, uLift;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + ({
        torso: 'float wF = smoothstep(0.55, 0.40, position.y) + smoothstep(0.24, 0.36, position.x) * smoothstep(0.78, 0.6, position.y) * 0.8 + smoothstep(-0.18, -0.34, position.x) * smoothstep(0.66, 0.5, position.y) * 0.7;\n' +
          'wF = clamp(wF, 0.0, 1.0);\ntransformed.x += wF * (-uMove * 0.028 + sin(uT * 9.0 + position.z * 14.0 + position.x * 6.0) * 0.006 * (0.4 + uMove));\n' +
          'transformed.y += wF * sin(uT * 13.0 + position.x * 10.0) * 0.012 * uMove - wF * uBob * 0.012;\ntransformed.z += wF * sin(uT * 7.0 + position.x * 12.0) * 0.006 * (0.3 + uMove);',
        head: 'float wE = smoothstep(0.06, 0.16, position.y) * step(0.035, abs(position.z));\ntransformed.x += wE * (uBob * 0.035 - uMove * 0.012);\ntransformed.z += sign(position.z) * wE * (abs(uBob) * 0.018 + sin(uT * 2.3) * 0.004);\n' +
          'float wC = smoothstep(-0.02, -0.12, position.y) * smoothstep(0.02, -0.06, position.x);\ntransformed.y += wC * sin(uT * 12.0 + position.z * 20.0) * 0.006 * uMove;',
        tail: 'float s = clamp(length(position.xy) / 0.4, 0.0, 1.0);\ntransformed.z += sin(uWagPh - s * 2.4) * uWagA * s * s * 0.22;\ntransformed.x -= abs(sin(uWagPh - s * 2.4)) * uWagA * s * s * 0.05;\n' +
          'transformed.y += uLift * s * s * 0.16; transformed.x -= uLift * s * 0.04;\ntransformed.z += sin(uT * 11.0 + s * 6.0) * 0.008 * s * (0.3 + uMove);',
      })[part]); };
    m.customProgramCacheKey = () => 'dogfur-' + part; return m;
  }
  function furMat() { return new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.86, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new T.Color('#fff4e0') }); }
  function buildDog(kind, nm, did) {
    const L = DOG_LOOK[kind || 'fuwang'], G = dogGeometry(kind || 'fuwang'), U = { uT: { value: 0 }, uMove: { value: 0 }, uBob: { value: 0 }, uWagPh: { value: 0 }, uWagA: { value: 0.3 }, uLift: { value: 0 } }, fur = dogFurMat(U, 'torso');
    const g = new T.Group(), torso = new T.Group(); torso.position.y = DOG_BASE_Y; g.add(torso);
    const body = new T.Mesh(G.torso, fur); body.castShadow = true; torso.add(body);
    // 胸背带 / 项圈
    const harness = mat(L.harness, { p: { roughness: 0.55 } });
    const ring = (x, y, sy, sz, rz, w, m) => { const o = mesh(new T.TorusGeometry(1, w, 8, 40), m, x, y, 0); o.rotation.set(0, Math.PI / 2, rz || 0); o.scale.set(sz, sy, 0.2); torso.add(o); return o; };
    if (L.trim) { const band = new T.Mesh(new T.CylinderGeometry(1, 1, 0.075, 40, 1, true), harness); band.rotation.z = Math.PI / 2; band.position.set(0.14, 0.6, 0); band.scale.set(0.196, 1, 0.168); band.material = band.material.clone(); band.material.side = T.DoubleSide; torso.add(band); ring(0.178, 0.6, 0.198, 0.17, 0, 0.06, mat(L.trim)); }   // 福旺：胸背带（红边）
    ring(0.39, 0.78, 0.112, 0.118, -0.55, 0.14, harness);                                                              // 项圈
    torso.add(mesh(new T.SphereGeometry(0.019, 12, 10), mat('#e8c060', { p: { metalness: 0.85, roughness: 0.28 } }), 0.47, 0.705, 0));  // 小铃铛
    // 头
    const head = new T.Group(); head.position.set(0.47, 0.92, 0); head.scale.setScalar(1.22); torso.add(head); // 头大一点更可爱
    const hm = new T.Mesh(G.head, dogFurMat(U, 'head')); hm.castShadow = true; head.add(hm);
    const eyeM = new T.MeshPhysicalMaterial({ color: new T.Color(L.eye), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
    const glint = new T.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach(sd => { const e = new T.Mesh(new T.SphereGeometry(0.029, 18, 14), eyeM); e.position.set(0.094, 0.036, sd * 0.06); e.scale.set(0.78, 1, 1); head.add(e); const s1 = new T.Mesh(new T.SphereGeometry(0.0095, 10, 8), glint); s1.position.set(0.114, 0.049, sd * 0.067); head.add(s1); const s2 = new T.Mesh(new T.SphereGeometry(0.0048, 8, 6), glint); s2.position.set(0.116, 0.026, sd * 0.056); head.add(s2); (head.userData.eyes = head.userData.eyes || []).push([e, s1, s2]); });
    const nose = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshPhysicalMaterial({ color: new T.Color('#141010'), roughness: 0.25, clearcoat: 0.8 })); nose.position.set(0.198, -0.043, 0); nose.scale.set(0.026, 0.021, 0.031); head.add(nose);
    const tongue = new T.Mesh(new T.SphereGeometry(1, 14, 10), new T.MeshPhysicalMaterial({ color: new T.Color('#e8707c'), roughness: 0.35, clearcoat: 0.6 })); tongue.position.set(0.14, -0.105, 0); tongue.scale.set(0.028, 0.048, 0.023); tongue.rotation.z = 0.35; head.add(tongue);
    // 腿
    const legs = []; const lm = furMat();
    [[0.27, 0.11, 1], [0.27, -0.11, 1], [-0.3, 0.1, 0], [-0.3, -0.1, 0]].forEach(([x, z, front]) => { const lg = new T.Group(); lg.position.set(x, 0.45, z); lg.scale.set(1.3, 0.92, 1.3); const m = new T.Mesh(front ? G.legF : G.legH, lm); m.castShadow = true; lg.add(m); const paw = new T.Mesh(new T.SphereGeometry(1, 12, 8), lm); paw.geometry = new T.SphereGeometry(1, 12, 8); paw.position.set(0.022, -0.355, 0); paw.scale.set(0.06, 0.03, 0.05); paw.material = new T.MeshPhysicalMaterial({ color: C_WHITE, roughness: 0.86, sheen: 0.35, sheenColor: new T.Color('#fff4e0') }); lg.add(paw); torso.add(lg); legs.push(lg); });
    // 尾巴
    const tail = new T.Group(); tail.position.set(-0.44, 0.64, 0); torso.add(tail); const tm = new T.Mesh(G.tail, dogFurMat(U, 'tail')); tm.castShadow = true; tail.add(tm); tail.scale.setScalar(0.88);
    g.scale.setScalar(L.s);
    const tag = nameTag(nm || L.name, L.tag); tag.position.set(0.1, 1.42, 0); g.add(tag);
    const d = { g, torso, head, tail, legs, tongue, tag, kind, did: did || kind, name: nm || L.name, home: null, ang: Math.random() * 6.28, pet: 0, U, wag: 0, mv: 0 }; anim.dogs.push(d);
    if (!buildDog.preview) { const hb = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 0.7), new T.MeshBasicMaterial({ visible: false })); hb.position.set(0, 0.55, 0); hb.userData.idx = -20 - (anim.dogs.length - 1); hb.userData.dog = d; d.hit = hb; g.add(hb); hitBoxes.push(hb); } return g;
  }
  // 调试：大尺寸渲染某个角度的狗（只在测试中用）
  function dogShot(kind, size, yaw, pitch) {
    const c = document.createElement('canvas'); c.width = c.height = size || 512; const r = new T.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true }); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.setClearColor(0x8fb070, 1);
    const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x6a7a4a, 0.9)); const dl = new T.DirectionalLight(0xfff4e0, 2.2); dl.position.set(3, 5, 4); sc.add(dl);
    const n = anim.dogs.length; buildDog.preview = true; const m = buildDog(kind); buildDog.preview = false; anim.dogs.length = n; m.remove(m.children.find(o => o.isSprite)); m.rotation.y = yaw || 0; sc.add(m);
    const box = new T.Box3().setFromObject(m), ctr = box.getCenter(new T.Vector3()), rad = box.getSize(new T.Vector3()).length() * 0.55, cam2 = new T.PerspectiveCamera(30, 1, 0.05, 50);
    cam2.position.set(ctr.x, ctr.y + Math.sin(pitch || 0.25) * rad * 3, ctr.z + Math.cos(pitch || 0.25) * rad * 3); cam2.lookAt(ctr); r.render(sc, cam2); const u = c.toDataURL(); r.dispose(); return u;
  }
  // 调试用：离屏渲染任意模型（人物 / 狗）
  function shotOf(m, size, yaw, pitch, bg) {
    const c = document.createElement('canvas'); c.width = c.height = size || 512; const r = new T.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true }); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.setClearColor(bg || 0x8fb070, 1);
    const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x6a7a4a, 0.9)); const dl = new T.DirectionalLight(0xfff4e0, 2.2); dl.position.set(3, 5, 4); sc.add(dl); m.rotation.y = yaw || 0; sc.add(m);
    const box = new T.Box3().setFromObject(m), ctr = box.getCenter(new T.Vector3()), rad = box.getSize(new T.Vector3()).length() * 0.55, cam2 = new T.PerspectiveCamera(30, 1, 0.05, 50);
    cam2.position.set(ctr.x, ctr.y + Math.sin(pitch || 0.2) * rad * 3, ctr.z + Math.cos(pitch || 0.2) * rad * 3); cam2.lookAt(ctr); r.render(sc, cam2); const u = c.toDataURL(); r.dispose(); return u;
  }
  function heroShot(look, size, yaw, pitch) { const keep = HERO.p, m = buildHero(look); m.remove(m.children.find(o => o.geometry && o.geometry.type === 'RingGeometry')); const u = shotOf(m, size, yaw, pitch); HERO.p = keep; return u; }
  // 狗狗预览图（商店里用）：离屏渲染
  function dogPortrait(kind) {
    const key = 'dog:' + kind; if (ICONS[key]) return ICONS[key];
    try {
      ensureIconRenderer(); const n = anim.dogs.length; buildDog.preview = true; const m = buildDog(kind); buildDog.preview = false; anim.dogs.length = n; m.remove(m.children.find(c => c.isSprite)); m.rotation.y = -0.65;
      IS.add(m); const box = new T.Box3().setFromObject(m), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.6;
      IC.position.set(c.x + r * 1.4, c.y + r * 0.7, c.z + r * 2.5); IC.lookAt(c); IC.updateProjectionMatrix(); IR.render(IS, IC); ICONS[key] = IR.domElement.toDataURL(); IS.remove(m); iconSave();
    } catch (e) { console.error(e); ICONS[key] = ''; }
    return ICONS[key];
  }
  function buildChicken() { const g = new T.Group(); g.add(blob(mat('#fbf6ec', { p: { roughness: 0.9 } }), 0, 0.3, 0, 0.22, 0.2, 0.18)); g.add(blob(mat('#fbf6ec'), -0.2, 0.38, 0, 0.1, 0.14, 0.08)); const h = blob(mat('#fbf6ec'), 0.16, 0.5, 0, 0.12); g.add(h); g.add(blob(mat('#e0302a'), 0.18, 0.62, 0, 0.05, 0.06, 0.03)); const bk = mesh(new T.ConeGeometry(0.035, 0.09, 6), mat('#f0a020'), 0.29, 0.5, 0); bk.rotation.z = -Math.PI / 2; g.add(bk); g.add(blob(mat('#1a1008'), 0.23, 0.53, 0.07, 0.018)); g.add(blob(mat('#1a1008'), 0.23, 0.53, -0.07, 0.018)); [0.06, -0.06].forEach(z => g.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 4), mat('#e0a020'), 0, 0.08, z))); const m = merge(g); m.scale.setScalar(0.9); return m; }
  function buildButterfly(col) { const g = new T.Group(), wm = mat(col, { ds: 1, p: { roughness: 0.6 } }); const wg = new T.CircleGeometry(0.12, 10); const l = mesh(wg, wm, -0.08, 0, 0), r = mesh(wg, wm, 0.08, 0, 0); l.castShadow = r.castShadow = false; const lp = new T.Group(), rp = new T.Group(); lp.add(l); rp.add(r); g.add(lp, rp); g.add(blob(mat('#2a1a10'), 0, 0, 0, 0.015, 0.015, 0.08)); return { g, lp, rp }; }
  function buildCloud() { const g = new T.Group(), m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: new T.Color('#c8d8f0'), emissiveIntensity: 0.25, transparent: true, opacity: 0.95 }); const r = CFG3.rng(Math.round(Math.random() * 1e6)); for (let i = 0; i < 7; i++) { const o = blob(m, (i - 3) * 1.1 + (r() - 0.5), r() * 0.6, (r() - 0.5) * 1.2, 1.1 + r() * 0.8, 0.8 + r() * 0.4, 1 + r() * 0.5, 14); o.castShadow = false; g.add(o); } return g; }
  function grassField(n, avoid, cx, cz, w, h) { cx = cx || 0; cz = cz || 0; w = w || 70; h = h || 60;
    const blade = new T.BufferGeometry(), pos = [0, 0, -0.035, 0, 0, 0.035, 0.01, 0.17, -0.025, 0.01, 0.17, 0.025, 0.03, 0.34, 0], col = [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.1, 1.1, 1.1];
    blade.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); blade.setAttribute('color', new T.Float32BufferAttribute(col, 3)); blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]); blade.computeVertexNormals();
    const m = new T.MeshStandardMaterial({ color: new T.Color('#7cb84a'), vertexColors: true, side: T.DoubleSide, roughness: 0.8 });
    m.userData.snowFlat = 0.75; m.onBeforeCompile = sh => { sh.uniforms.uT = anim.grassU; sh.uniforms.uSnowV = SNOWU; sh.vertexShader = 'uniform float uT;\nuniform float uSnowV;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat ph = instanceMatrix[3].x*0.6 + instanceMatrix[3].z*0.8;\ntransformed.x += sin(uT*1.6+ph)*0.07*position.y*3.0;\ntransformed.z += cos(uT*1.2+ph*1.3)*0.05*position.y*3.0;\ntransformed.y *= 1.0 - uSnowV*0.6;\n#endif'); }; m.customProgramCacheKey = () => 'grass1';
    const im = new T.InstancedMesh(blade, m, n), d = new T.Object3D(), r = CFG3.rng(5), c = new T.Color(); let k = 0;
    let tries = 0; while (k < n && tries++ < n * 40) { const x = cx + (r() - 0.5) * w, z = cz + (r() - 0.5) * h; if (avoid(x, z)) continue; d.position.set(x, 0, z); d.rotation.set(0, r() * 6.28, (r() - 0.5) * 0.4); d.scale.set(0.8 + r() * 0.5, 0.5 + r() * 0.65, 0.8 + r() * 0.5); d.updateMatrix(); im.setMatrixAt(k, d.matrix); c.setHSL(0.23 + r() * 0.06, 0.5 + r() * 0.2, 0.4 + r() * 0.12); im.setColorAt(k, c); k++; }
    im.count = k; im.receiveShadow = false; return im;
  }
  function flowerGeo() { // 五瓣小花：一个 10 个三角面的星形，花心黄、花瓣白（实例颜色染色）。2026-10-26 改轻量（原来约 480 面）
    const P = [], C = [], rim = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = i % 2 ? 0.045 : 0.1; rim.push([Math.cos(a) * rr, i % 2 ? 0.004 : 0.018, Math.sin(a) * rr]); }
    for (let i = 0; i < 10; i++) { const p0 = rim[i], p1 = rim[(i + 1) % 10]; P.push(0, 0.012, 0, ...p1, ...p0); C.push(1, 0.9, 0.55, 1, 1, 1, 1, 1, 1); }
    const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(P, 3)); G.setAttribute('color', new T.Float32BufferAttribute(C, 3)); G.computeVertexNormals(); return G; }
  /* 把几个带 position / normal / color 的几何体拼成一个（不依赖扩展库） */
  function joinGeo(parts) { const gs = parts.map(g => g.index ? g.toNonIndexed() : g); let n = 0; gs.forEach(g => n += g.attributes.position.count); const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    gs.forEach(g => { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if (g.attributes.color) C.set(g.attributes.color.array, o * 3); else C.fill(1, o * 3, (o + g.attributes.position.count) * 3); o += g.attributes.position.count; });
    const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(P, 3)); G.setAttribute('normal', new T.BufferAttribute(N, 3)); G.setAttribute('color', new T.BufferAttribute(C, 3)); return G; }
  function flowers(n, avoid, cx, cz, w, h) { cx = cx || 0; cz = cz || 0; w = w || 60; h = h || 50; const geo = flowerGeo(); const im = new T.InstancedMesh(geo, mat('#ffffff', { vc: 1, p: { roughness: 0.6 } }), n), d = new T.Object3D(), r = CFG3.rng(15), c = new T.Color(), pal = ['#ff7aa0', '#ffd23a', '#ffffff', '#b98aff', '#ff9a4a', '#7ac8ff']; let k = 0; let tries = 0; while (k < n && tries++ < n * 40) { const x = cx + (r() - 0.5) * w, z = cz + (r() - 0.5) * h; if (avoid(x, z)) continue; d.position.set(x, 0.14 + r() * 0.1, z); d.rotation.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5); d.scale.setScalar(0.9 + r() * 0.7); d.updateMatrix(); im.setMatrixAt(k, d.matrix); im.setColorAt(k, c.set(pal[Math.floor(r() * pal.length)])); k++; } im.count = k; im.userData.flowers = 1; return im; }

  /* ---------- 积雪（2026-10-26）----------
     冬天时朝上的面（屋顶、树冠顶、灌木、篱笆、地面）慢慢盖上一层雪：给材质加一段着色器，按「世界坐标里的法线有多朝上」混入雪色。
     所有材质初始化时就加好（uSnow = 0 时没有效果），换季只改一个数，不用重新编译着色器。
     K 积雪强度（菜地泥土 0.55，免得认不出哪里是地）；flat 不朝上的面也至少盖多少（草叶用） */
  const SNOWU = { value: 0 };
  function snowify(m, K, flat) {
    if (!m || m.userData.snowy || !m.isMeshStandardMaterial || (m.transparent && m.opacity < 0.95)) return; m.userData.snowy = 1;
    K = K !== undefined ? K : m.userData.snowK !== undefined ? m.userData.snowK : m.map && TX.soil && m.map.image === TX.soil.image ? 0.5 : 1; flat = flat || m.userData.snowFlat || 0;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey && m.customProgramCacheKey !== T.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey : null;
    m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); sh.uniforms.uSnow = SNOWU;
      sh.vertexShader = 'varying vec3 vSnN;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n{ vec3 sn = objectNormal;\n#ifdef USE_INSTANCING\nsn = mat3(instanceMatrix) * sn;\n#endif\nvSnN = normalize(mat3(modelMatrix) * sn); }');
      sh.fragmentShader = 'uniform float uSnow;\nvarying vec3 vSnN;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n{ float sk = uSnow * ' + K.toFixed(2) + ' * max(smoothstep(0.2, 0.7, vSnN.y), ' + flat.toFixed(2) + '); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.92, 0.97), sk); }'); };
    m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|snow' + K + ',' + flat; };
    m.needsUpdate = true;
  }
  /* 场景里所有物体加积雪；主人、狗、鸡、小动物、羊不加（身上一层白看着怪） */
  function snowifyScene(root) {
    const skip = new Set([HERO.g].concat(anim.dogs.map(d => d.g), anim.chickens.map(c => c.m), (typeof CRIT !== 'undefined' ? CRIT.list : []).map(c => c.g), (RANCH3.sheep || []).map(x => x.g)).filter(Boolean));
    const walk = o => { if (skip.has(o) || o.userData.noSnow || o.isSkinnedMesh) return; if (o.isMesh && o.material) [].concat(o.material).forEach(m => snowify(m)); o.children.forEach(walk); };
    walk(root || scene);
  }

  /* ---------- 花花草草（2026-10-26，参照甲方给的图）----------
     整个农场（半径约 100 米）除了菜地、池塘、牧场、果园、建筑和小路，都长上：茂密的草丛、薰衣草和各色穗状花、开花的灌木（粉 / 白 / 红 / 黄）、白色的芦苇草、成片的小野花。
     房子、风车周围和菜地边上长得更密（像花境）；远处按噪声成片长，有疏有密。
     全部实例化；按 72 米分块，每块单独做包围球，看不到的块不画；草丛和小花离镜头远了也不画。
     玩家在空地上建了东西，压在下面的花草会隐藏（setLayout 里调 floraMask）。 */
  const FLORA = { recs: [], chunks: [], tick: 0 };
  function floraGeos() {
    const r = CFG3.rng(4242), G = {};
    const vcol = (g, fn) => { g = g.index ? g.toNonIndexed() : g; return colorize(g, fn); };
    /* 草丛：5 片弯弯的草叶，每片 3 个三角面，根部暗、叶尖亮 */
    { const parts = []; for (let b = 0; b < 4; b++) { const a = b / 4 * 6.28 + r() * 0.6, h = 0.32 + r() * 0.3, w = 0.035 + r() * 0.02, lean = 0.12 + r() * 0.18, ox = Math.cos(a) * 0.06, oz = Math.sin(a) * 0.06;
        const P = [], C = [], pt = (u, side) => { const t = u, x = ox + Math.cos(a) * lean * t * t * h * 2 + side * w * (1 - t) * Math.cos(a + 1.57), y = h * t, z = oz + Math.sin(a) * lean * t * t * h * 2 + side * w * (1 - t) * Math.sin(a + 1.57); return [x, y, z]; };
        const v = [pt(0, -1), pt(0, 1), pt(0.5, -1), pt(0.5, 1), pt(1, 0)]; [[0, 1, 2], [2, 1, 3], [2, 3, 4]].forEach(tr => tr.forEach(i => { P.push(...v[i]); const l = [0.42, 0.42, 0.75, 0.75, 1.1][i]; C.push(l, l, l); }));
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); parts.push(g); }
      G.tuft = joinGeo(parts); }
    /* 穗状花（薰衣草 / 金鱼草）：4 根花穗（每根 12 个三角面），白色顶点由实例颜色染成紫、粉、橙、白；下半截暗一点，看着像花茎 */
    { const parts = []; for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = r() * 0.2, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.42 + r() * 0.3, tl = (r() - 0.5) * 0.3, tz = (r() - 0.5) * 0.3;
        const head = new T.CylinderGeometry(0.032, 0.05, h, 4, 1, true); head.translate(0, h / 2, 0); const tip = new T.ConeGeometry(0.034, 0.1, 4, 1, true); tip.translate(0, h + 0.05, 0);
        [head, tip].forEach(g => { g.rotateX(tz); g.rotateZ(tl); g.translate(x, 0, z); parts.push(vcol(g, (px, py) => { const t = Math.min(1, py / h), v = t < 0.45 ? 0.25 + t * 0.6 : 0.8 + (t - 0.45) * 0.45; return [v, v, v]; })); }); }
      G.spike = joinGeo(parts); }
    /* 开花灌木：树丛本体（绿色）+ 花朵（白色，实例颜色染色），分成两个网格 */
    { const g = new T.IcosahedronGeometry(0.62, 1); displace(g, 0.12, 2.2, 7); g.scale(1, 0.78, 1); g.translate(0, 0.42, 0); G.bushBody = vcol(g, (px, py) => { const v = 0.55 + Math.max(0, py) * 0.6; return [v * 0.95, v, v * 0.9]; }); }
    { const parts = [], N = 11; for (let i = 0; i < N; i++) { const yy = 1 - (i + 0.5) / N * 1.25, rad = Math.sqrt(Math.max(0, 1 - yy * yy)), th = i * 2.4, nx = Math.cos(th) * rad, nz = Math.sin(th) * rad, ny = Math.max(-0.25, yy);
        const f = new T.ConeGeometry(0.12, 0.06, 5, 1, true); const o = new T.Object3D(); o.position.set(nx * 0.66, 0.44 + ny * 0.52, nz * 0.66); o.lookAt(nx * 2, 0.42 + ny * 2 + 0.5, nz * 2); o.rotateX(Math.PI / 2); o.updateMatrix(); f.applyMatrix4(o.matrix); parts.push(vcol(f, () => [1, 1, 1])); }
      G.bloom = joinGeo(parts); }
    /* 白色芦苇草：5 根细秆 + 羽毛状的穗 */
    { const parts = []; for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = r() * 0.12, h = 0.7 + r() * 0.45, lx = (r() - 0.5) * 0.5, lz = (r() - 0.5) * 0.5;
        const st = new T.CylinderGeometry(0.006, 0.01, h, 3, 1, true); st.translate(0, h / 2, 0); const pl = new T.OctahedronGeometry(1, 0); pl.scale(0.035, 0.16, 0.035); pl.translate(0, h + 0.1, 0);
        [[st, [0.45, 0.62, 0.3]], [pl, [1.0, 0.98, 0.92]]].forEach(([g, c]) => { g.rotateX(lz * 0.6); g.rotateZ(lx * 0.6); g.translate(Math.cos(a) * d, 0, Math.sin(a) * d); parts.push(vcol(g, () => c)); }); }
      G.plume = joinGeo(parts); }
    G.flower = flowerGeo();
    return G;
  }
  function buildFlora() {
    const lowQ = quality <= 1 || window.innerWidth < 820, K = lowQ ? 0.45 : 1;
    const occ = GAMECFG.homeOccupancy({ fields: 20, pastLv: 100, pondLv: 99 }), GW = occ.W, cellOf = (x, z) => { const i = Math.floor((x - occ.x0) / occ.cell), j = Math.floor((z - occ.z0) / occ.cell); return i < 0 || j < 0 || i >= GW || j >= occ.H ? -1 : j * GW + i; };
    const blocked = (x, z, m) => { for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]]) { const c = cellOf(x + dx, z + dz); if (c >= 0 && occ.cells[c]) return true; } return false; };
    const paths = [[-10, -1.2, 5.5, 1.6, 0.35], [-4.5, 7.2, 1.8, 6, -0.25]], onPath = (x, z) => paths.some(([px, pz, l, w, rr]) => { const dx = x - px, dz = z - pz, c = Math.cos(rr), sn = Math.sin(rr), u = dx * c - dz * sn, v = dx * sn + dz * c; return Math.abs(u) < l / 2 + 0.5 && Math.abs(v) < w / 2 + 0.5; });
    const ok = (x, z, m) => { if (Math.hypot(x - FARM_C[0], z - FARM_C[1]) > FARM_R - 3) return false; if (blocked(x, z, m)) return false; if (onPath(x, z)) return false; for (const [ox, oz, rr] of OBST) if (Math.hypot(x - ox, z - oz) < rr + m) return false; return true; };
    /* 离建筑 / 菜地边多远：越近花越密（花境） */
    const S0 = HOMEL.structures.filter(o => o.id === 'house' || o.id === 'windmill'), F = HOMEL.fields;
    const nearEdge = (x, z) => { let d = 99; S0.forEach(o => { d = Math.min(d, Math.max(Math.abs(x - o.x) - o.w / 2, Math.abs(z - o.z) - o.d / 2)); }); for (let f = 0; f < 8; f++) { const [cx, cz] = GAMECFG.fieldCenter(f); d = Math.min(d, Math.max(Math.abs(x - cx) - F.w / 2, Math.abs(z - cz) - F.d / 2) + 0.6); } return d; };
    const r = CFG3.rng(777), recs = { tuft: [], spike: [], bushBody: [], bloom: [], plume: [], flower: [] }, col = new T.Color();
    const put = (kind, x, z, sc, ry, c, tilt) => recs[kind].push({ x, z, sc, ry, c: c ? c.clone() : null, tilt: tilt || 0 });
    const SPIKE = ['#8f6fd6', '#a487e6', '#7a5cc8', '#b79cf0', '#f08cbc', '#f59a7a', '#f4eefc', '#ff6f8f'], BLOOM = ['#ff8fb8', '#ffb3cf', '#ffffff', '#ff6f86', '#ffd86a', '#f7a3e0'], WILD = ['#ff7aa0', '#ffd23a', '#ffffff', '#b98aff', '#ff9a4a', '#7ac8ff', '#ff5a6a'];
    const area = (fn, n) => { let k = 0, tries = 0; while (k < n && tries++ < n * 30) { const a = r() * 6.28, d = Math.sqrt(r()) * (FARM_R - 4), x = FARM_C[0] + Math.cos(a) * d, z = FARM_C[1] + Math.sin(a) * d; if (fn(x, z)) k++; } };
    /* 1. 花境：房子、风车四周，菜地边上 */
    area((x, z) => { const e = nearEdge(x, z); if (e < 0.4 || e > 3.2 || !ok(x, z, 0.5)) return false; const q = r(); col.set(q < 0.55 ? SPIKE[Math.floor(r() * 4)] : SPIKE[4 + Math.floor(r() * 4)]);
      if (q < 0.5) { put('spike', x, z, 0.9 + r() * 0.5, r() * 6.28, col); put('tuft', x + 0.1, z - 0.1, 0.9, r() * 6.28, null); }
      else if (q < 0.68) { const s = 0.7 + r() * 0.6; put('bushBody', x, z, s, r() * 6.28, null); put('bloom', x, z, s, r() * 6.28, col.set(BLOOM[Math.floor(r() * BLOOM.length)])); }
      else { const cc = col.set(WILD[Math.floor(r() * WILD.length)]).clone(); for (let i = 0; i < 7; i++) put('flower', x + (r() - 0.5) * 1.1, z + (r() - 0.5) * 1.1, 1.4 + r() * 0.7, r() * 6.28, cc, 0.4); }
      return true; }, Math.round(760 * K));
    /* 1b. 房子、风车、狗窝门前屋后：再密一圈（甲方参考图里房子四周全是花） */
    const HS = HOMEL.structures.filter(o => o.id === 'house' || o.id === 'windmill' || o.id === 'doghouse');
    for (let n = 0, tries = 0; n < Math.round(420 * K) && tries < 8000; tries++) { const o = HS[Math.floor(r() * HS.length)], a = r() * 6.28, rr = Math.max(o.w, o.d) / 2 + 0.6 + r() * 3.4, x = o.x + Math.cos(a) * rr, z = o.z + Math.sin(a) * rr; if (!ok(x, z, 0.35)) continue; n++; const q = r();
      if (q < 0.4) { col.set(SPIKE[Math.floor(r() * SPIKE.length)]); put('spike', x, z, 0.9 + r() * 0.5, r() * 6.28, col); }
      else if (q < 0.65) { const sc = 0.6 + r() * 0.5; put('bushBody', x, z, sc, r() * 6.28, null); put('bloom', x, z, sc, r() * 6.28, col.set(BLOOM[Math.floor(r() * BLOOM.length)])); }
      else { const cc = col.set(WILD[Math.floor(r() * WILD.length)]).clone(); for (let i = 0; i < 6; i++) put('flower', x + (r() - 0.5) * 0.9, z + (r() - 0.5) * 0.9, 1.4 + r() * 0.7, r() * 6.28, cc, 0.4); } }
    /* 2. 成片的野花丛（同色一片） */
    area((x, z) => { if (fbm(x * 0.05 + 3, z * 0.05 + 9, 55, 3) < (Math.hypot(x, z - 4) < 34 ? 0.34 : 0.5) || !ok(x, z, 0.6)) return false; const cc = col.set(WILD[Math.floor(r() * WILD.length)]).clone(), n = 7 + Math.floor(r() * 8); for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.6; put('flower', x + Math.cos(a) * d, z + Math.sin(a) * d, 1.3 + r() * 0.8, r() * 6.28, cc, 0.4); } return true; }, Math.round(320 * K));
    /* 3. 成片的薰衣草 / 灌木 / 芦苇（噪声决定哪里长哪种） */
    area((x, z) => { const f = fbm(x * 0.03 + 11, z * 0.03 + 4, 66, 3); if (f < 0.47 || !ok(x, z, 0.7)) return false; const kind = fbm(x * 0.02 + 90, z * 0.02 + 30, 67, 2);
      if (kind < 0.42) { col.set(SPIKE[Math.floor(r() * 4)]); for (let i = 0; i < 3; i++) put('spike', x + (r() - 0.5) * 1.6, z + (r() - 0.5) * 1.6, 0.9 + r() * 0.5, r() * 6.28, col); }
      else if (kind < 0.53) { const s = 0.8 + r() * 0.8; put('bushBody', x, z, s, r() * 6.28, null); put('bloom', x, z, s, r() * 6.28, col.set(BLOOM[Math.floor(r() * BLOOM.length)])); }
      else for (let i = 0; i < 3; i++) put('plume', x + (r() - 0.5) * 1.2, z + (r() - 0.5) * 1.2, 0.85 + r() * 0.5, r() * 6.28, col.set('#f6f0e2'));
      return true; }, Math.round(440 * K));
    /* 4. 草丛：到处都有，靠近家更密 */
    area((x, z) => { const near = Math.hypot(x + 2, z + 4) < 45, f = fbm(x * 0.06 + 7, z * 0.06 + 2, 70, 3); if ((near ? f < 0.3 : f < 0.42) || !ok(x, z, 0.25)) return false; col.setHSL(0.24 + r() * 0.06, 0.5 + r() * 0.2, 0.36 + r() * 0.12); put('tuft', x, z, 0.8 + r() * 0.8, r() * 6.28, col); return true; }, Math.round(5200 * K));
    /* 生成：按 72 米分块，每块每种一个实例化网格 */
    const fm = (c, rough, ds) => new T.MeshStandardMaterial({ color: new T.Color(c), vertexColors: true, roughness: rough, side: ds ? T.DoubleSide : T.FrontSide });   /* 不用 mat() 的缓存：下面要改着色器，不能影响别的物体 */
    const G = floraGeos(), CH = 72, mats = { tuft: fm('#7cb84a', 0.85, 1), spike: fm('#ffffff', 0.7), bushBody: fm('#4f9a3a', 0.85), bloom: fm('#ffffff', 0.6, 1), plume: fm('#fffaf0', 0.9), flower: fm('#ffffff', 0.6, 1) };
    /* 风吹：和草地同一个时间；冬天草丛被雪压矮 */
    const windy = (m, amt, squash) => { m.userData.snowFlat = squash ? 0.75 : 0; m.onBeforeCompile = sh => { sh.uniforms.uT = anim.grassU; sh.uniforms.uSnowV = SNOWU; sh.vertexShader = 'uniform float uT;\nuniform float uSnowV;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat ph = instanceMatrix[3].x*0.6 + instanceMatrix[3].z*0.8;\ntransformed.x += sin(uT*1.6+ph)*' + amt + '*position.y;\ntransformed.z += cos(uT*1.2+ph*1.3)*' + (amt * 0.7).toFixed(3) + '*position.y;\n' + (squash ? 'transformed.y *= 1.0 - uSnowV*0.6;\n' : '') + '#endif'); }; m.customProgramCacheKey = () => 'flora' + amt + squash; };
    windy(mats.tuft, 0.22, true); windy(mats.spike, 0.16, false); windy(mats.plume, 0.2, false);
    const d = new T.Object3D(), FL = { spike: 1, bloom: 1, flower: 1 }, SMALL = { tuft: 1, flower: 1 };
    Object.keys(recs).forEach(kind => { const by = new Map(); recs[kind].forEach(o => { const key = Math.floor(o.x / CH) + ',' + Math.floor(o.z / CH); (by.get(key) || by.set(key, []).get(key)).push(o); });
      by.forEach(list => { const geo = G[kind].clone(), im = new T.InstancedMesh(geo, mats[kind], list.length); let sx = 0, sz = 0; list.forEach(o => { sx += o.x; sz += o.z; }); const cx = sx / list.length, cz = sz / list.length; let rad = 0;
        list.forEach((o, i) => { d.position.set(o.x, 0, o.z); d.rotation.set(o.tilt ? (r() - 0.5) * o.tilt : 0, o.ry, o.tilt ? (r() - 0.5) * o.tilt : 0); d.scale.setScalar(o.sc); if (kind === 'flower') d.position.y = 0.06 + r() * 0.12; d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (o.c) im.setColorAt(i, o.c); else if (im.instanceColor || kind === 'tuft') im.setColorAt(i, col.setHSL(0.26, 0.45, 0.42));
          o.mi = i; o.im = im; o.m = d.matrix.clone(); o.cell = cellOf(o.x, o.z); rad = Math.max(rad, Math.hypot(o.x - cx, o.z - cz)); FLORA.recs.push(o); });
        /* 包围球用整块的范围（实例位置是世界坐标，网格本身在原点） */
        geo.boundingSphere = new T.Sphere(new T.Vector3(cx, 0.5, cz), rad + 1.5); im.frustumCulled = true; im.castShadow = false; im.receiveShadow = false;   /* 花草不投影：阴影要把投影的东西再画一遍，花草数量多，划不来 */
        if (FL[kind]) im.userData.flowers = 1; if (kind === 'bushBody') im.userData.noFlowerHide = 1; scene.add(im); FLORA.chunks.push({ im, cx, cz, rad, small: !!SMALL[kind] }); }); });
  }
  /* 玩家在空地上建了东西：压在下面的花草隐藏 */
  const ZERO_M = new T.Matrix4().makeScale(0, 0, 0);
  function floraMask(used) { const dirty = new Set(); FLORA.recs.forEach(o => { const hide = o.cell >= 0 && used.has(o.cell), cur = !!o.hidden; if (hide === cur) return; o.hidden = hide; o.im.setMatrixAt(o.mi, hide ? ZERO_M : o.m); dirty.add(o.im); }); dirty.forEach(im => { im.instanceMatrix.needsUpdate = true; }); }
  /* 漫游时远处的草丛和小花不画（看不清，还占三角面） */
  function floraCull() { if (++FLORA.tick % 15) return; const c = cam.position, far = viewMode === 'walk' ? 70 : 150; FLORA.chunks.forEach(ch => { const dd = Math.hypot(ch.cx - c.x, ch.cz - c.z) - ch.rad; ch.im.visible = !ch.im.userData.seasonHide && dd < (ch.small ? far : 230); }); }
  /* ---------- 2026-10-26 开放世界：家园往外扩大到约 1.6 公里见方 ----------
     农场（以 (-9, -24) 为中心、半径约 108 米，菜地 / 牧场 / 鱼塘 / 果园都在里面）保持平地；外面是起伏的丘陵、几片湖、成片的森林和草甸，最外面一圈高山。
     地形高度 terrainH 是一个确定的函数：地面网格、树的位置、人物走路都用它，前后一致 */
  const WORLD_R = 800, FARM_R = 108, FARM_C = [-9, -24], LAKES = [[230, -160, 46], [-260, 190, 60], [120, 330, 38], [-380, -260, 70], [420, 120, 52]];
  function terrainH(x, z) {
    const d = Math.hypot(x - FARM_C[0], z - FARM_C[1]); if (d < FARM_R) return 0;
    const k = Math.min(1, (d - FARM_R) / 140), k2 = k * k * (3 - 2 * k);
    let h = (fbm(x * 0.0055 + 3, z * 0.0055 + 7, 21, 4) - 0.42) * 46 * k2 + (fbm(x * 0.02 + 9, z * 0.02 + 1, 23, 3) - 0.5) * 5 * k2;
    h += Math.max(0, d - WORLD_R + 120) * 0.35; /* 边缘抬高 */
    for (const [lx, lz, lr] of LAKES) { const q = Math.hypot(x - lx, z - lz) / lr; if (q < 1.7) { const t = Math.max(0, Math.min(1, (q - 0.85) / 0.85)), s = t * t * (3 - 2 * t); h = h * s + (-2.2 + q * 1.2) * (1 - s); } }
    return Math.max(-2.2, h);
  }
  const WILD = { hash: new Map(), chunks: [], cullT: 0 };
  function wildCull() { if (++WILD.cullT % 10) return; const c = cam.position, far = viewMode === 'walk' ? 330 : 260; WILD.chunks.forEach(ch => { ch.im.visible = Math.hypot(ch.cx - c.x, ch.cz - c.z) < far + 141; }); }
  function buildWild() {
    const S = WORLD_R * 2 + 400, seg = 200, gg = new T.PlaneGeometry(S, S, seg, seg); gg.rotateX(-Math.PI / 2);
    const P = gg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), d = Math.hypot(x - FARM_C[0], z - FARM_C[1]); P.setY(i, d < FARM_R + 4 ? -0.06 : terrainH(x, z) - 0.03); } gg.computeVertexNormals();
    const cA = new T.Color('#9cb46e'), cB = new T.Color('#7e9e56'), cC = new T.Color('#b4b878'), cR = new T.Color('#9a9484'), cS = new T.Color('#d8c890'), tc = new T.Color();
    colorize(gg, (x, y, z) => { const n = fbm(x * 0.02 + 50, z * 0.02 + 50, 7, 4), m2 = fbm(x * 0.008, z * 0.008, 9, 3); tc.copy(cB).lerp(cA, Math.min(1, n * 1.4)).lerp(cC, Math.max(0, m2 - 0.55) * 1.6); if (y > 26) tc.lerp(cR, Math.min(1, (y - 26) / 14)); if (y < -0.6) tc.lerp(cS, Math.min(1, (-0.6 - y) * 0.8)); return [tc.r, tc.g, tc.b]; });
    const gmap = TX.grass.clone(); gmap.needsUpdate = true; gmap.repeat.set(S / 6.6, S / 6.6); const ground = new T.Mesh(gg, new T.MeshStandardMaterial({ color: new T.Color('#ffffff'), vertexColors: true, map: gmap, roughness: 0.96 })); ground.receiveShadow = true; scene.add(ground); WILD.ground = ground;
    /* 湖 */
    const wm = new T.MeshStandardMaterial({ color: new T.Color('#3d86b0'), roughness: 0.08, metalness: 0.2, normalMap: TX.waterN, transparent: true, opacity: 0.85 });
    LAKES.forEach(([x, z, r]) => { const o = new T.Mesh(new T.CircleGeometry(r * 1.35, 48), wm); o.rotation.x = -Math.PI / 2; o.position.set(x, -0.7, z); scene.add(o); });
    /* 森林：按噪声成片分布（实例化，同种树一次画完），农场附近不种 */
    const tk = { pine: [], broad: [], bush: [] }, r = CFG3.rng(20261026);
    const STEP = quality <= 1 ? 15 : 12; for (let gx = -WORLD_R; gx < WORLD_R; gx += STEP) for (let gz = -WORLD_R; gz < WORLD_R; gz += STEP) {
      const x = gx + (r() - 0.5) * STEP * 0.85, z = gz + (r() - 0.5) * STEP * 0.85, d = Math.hypot(x - FARM_C[0], z - FARM_C[1]); if (d < FARM_R + 18) continue;
      if (LAKES.some(([lx, lz, lr]) => Math.hypot(x - lx, z - lz) < lr * 1.5)) continue;
      const f = fbm(x * 0.008 + 31, z * 0.008 + 17, 41, 3), h = terrainH(x, z), lone = r() < 0.025; if (!(f > 0.56 || lone)) continue; if (r() < 0.35 && !lone) continue;
      const kind = h > 18 || f > 0.66 ? 'pine' : r() < 0.25 ? 'bush' : 'broad', s = 0.8 + r() * 0.9; tk[kind].push([x, h, z, s, r() * 6.28]);
      if (kind !== 'bush') { const key = Math.floor(x / 10) + ',' + Math.floor(z / 10); (WILD.hash.get(key) || WILD.hash.set(key, []).get(key)).push([x, z, 0.45 * s]); }
    }
    const lum = (g, lo, hi) => { const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3); g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y; for (let i = 0; i < p.count; i++) { const v = lo + (hi - lo) * ((p.getY(i) - y0) / (y1 - y0 || 1)) * 0.6 + Math.max(0, n.getY(i)) * (hi - lo) * 0.4; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; } g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; };
    const M = T.BufferGeometryUtils ? null : null; /* 不依赖扩展：手动拼几何体 */
    const join = parts => { const gs = parts.map(g => g.index ? g.toNonIndexed() : g); let n = 0; gs.forEach(g => n += g.attributes.position.count); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0; gs.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }); const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(pos, 3)); G.setAttribute('normal', new T.BufferAttribute(nor, 3)); G.setAttribute('color', new T.BufferAttribute(col, 3)); return G; };
    const trunkG = () => { const g = new T.CylinderGeometry(0.22, 0.34, 2.6, 5); g.translate(0, 1.3, 0); return lum(g, 0.55, 0.6); };
    const GEO = {
      pine: { trunk: trunkG(), crown: (() => { const a = new T.ConeGeometry(2.4, 4.2, 7); a.translate(0, 3.8, 0); displace(a, 0.12, 0.8, 3); const b = new T.ConeGeometry(1.8, 3.4, 7); b.translate(0, 5.6, 0); displace(b, 0.1, 0.9, 4); const c = new T.ConeGeometry(1.1, 2.4, 8); c.translate(0, 7.2, 0); return join([lum(a, 0.6, 1.0), lum(b, 0.65, 1.05), lum(c, 0.7, 1.1)]); })(), col: '#2f6a32', tcol: '#6a4a2e' },
      broad: { trunk: trunkG(), crown: (() => { const ps = []; [[0, 4.2, 0, 2.6], [1.3, 4.8, 0.6, 1.7], [-1.2, 4.6, -0.7, 1.8], [0.3, 5.8, -0.4, 1.6]].forEach(([x, y, z, s], i) => { const g = new T.IcosahedronGeometry(s, 0); displace(g, 0.12, 1.4, 11 + i); g.computeVertexNormals(); g.translate(x, y, z); ps.push(lum(g, 0.62, 1.08)); }); return join(ps); })(), col: '#4f9a3a', tcol: '#6a4a2e' },
      bush: { trunk: null, crown: (() => { const g = new T.IcosahedronGeometry(1.3, 1); displace(g, 0.2, 1.6, 5); g.computeVertexNormals(); g.translate(0, 0.9, 0); g.scale(1, 0.75, 1); return lum(g, 0.65, 1.05); })(), col: '#4a9238', tcol: '' },
    };
    /* 分成 320 米一块：每块单独实例化，镜头看不到 / 离得太远的块不画（手机上同屏三角面控制在几十万以内） */
    const d3 = new T.Object3D(), CH = 200; WILD.chunks = [];
    Object.entries(tk).forEach(([k, list]) => { if (!list.length) return; const G = GEO[k], by = new Map();
      list.forEach(t => { const key = Math.floor(t[0] / CH) + ',' + Math.floor(t[2] / CH); (by.get(key) || by.set(key, []).get(key)).push(t); });
      by.forEach((arr, key) => { const [ci, cj] = key.split(',').map(Number), cx = (ci + 0.5) * CH, cz = (cj + 0.5) * CH;
        const mk = (geo0, col) => { const geo = geo0.clone(); geo.boundingSphere = new T.Sphere(new T.Vector3(cx, 12, cz), 175); /* 2026-10-26 性能：每块森林单独一个包围球，镜头背后的整块森林不画 */ const im = new T.InstancedMesh(geo, mat(col, { vc: 1, p: { roughness: 0.9 } }), arr.length); arr.forEach(([x, y, z, s, ry], i) => { d3.position.set(x, y - 0.1, z); d3.rotation.set(0, ry, 0); d3.scale.setScalar(s); d3.updateMatrix(); im.setMatrixAt(i, d3.matrix); }); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = true; /* r149 的实例化网格默认按单棵树的包围球裁剪会错把整块森林裁掉，所以上面换成整块的包围球；另外还按距离裁剪 */ scene.add(im); WILD.chunks.push({ im, cx, cz }); return im; };
        if (G.trunk) mk(G.trunk, G.tcol); mk(G.crown, G.col); }); });
    /* 草甸上的石头 */
    { const rg = new T.DodecahedronGeometry(1, 1); displace(rg, 0.15, 1.2, 9); rg.computeVertexNormals(); const n = 320, im = new T.InstancedMesh(rg, mat('#a8a294', { p: { roughness: 0.95, map: TX.stone } }), n); for (let i = 0; i < n; i++) { const a = r() * 6.28, dd = FARM_R + 25 + r() * (WORLD_R - FARM_R - 40), x = Math.cos(a) * dd, z = Math.sin(a) * dd, s = 0.4 + r() * 1.8; d3.position.set(x, terrainH(x, z) - 0.2 * s, z); d3.rotation.set(r(), r() * 6, r()); d3.scale.set(s, s * 0.6, s); d3.updateMatrix(); im.setMatrixAt(i, d3.matrix); im.frustumCulled = false; if (s > 1) { const key = Math.floor(x / 10) + ',' + Math.floor(z / 10); (WILD.hash.get(key) || WILD.hash.set(key, []).get(key)).push([x, z, s * 0.8]); } } scene.add(im); }
    WILD.count = tk.pine.length + tk.broad.length + tk.bush.length;
  }
  function hills() { const g = new T.Group(), m = new T.MeshStandardMaterial({ color: new T.Color('#8aa4ae'), roughness: 1, fog: false }), r = CFG3.rng(77); /* 远山：雾里的蓝灰色剪影 */ for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + r() * 0.3, d = WORLD_R + 260 + r() * 160; const geo = new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); displace(geo, 0.08, 1.5, i); const o = mesh(geo, m, Math.cos(a) * d, -2, Math.sin(a) * d); o.scale.set(160 + r() * 140, 60 + r() * 90, 120 + r() * 80); o.castShadow = false; g.add(o); } return merge(g); }
  // 天空
  let sky, skyU;
  function buildSky() {
    skyU = { top: { value: new T.Color('#3b8fe0') }, hor: { value: new T.Color('#cfe8ff') }, sunDir: { value: v3(0, 1, 0) }, sunCol: { value: new T.Color('#fff2d0') }, night: { value: 0 } };
    const m = new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: ['uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vP;', 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}', 'void main(){ float y = max(vP.y,0.0); vec3 c = mix(hor, top, pow(y,0.55)); float s = max(dot(vP, normalize(sunDir)),0.0); c += sunCol*(pow(s,800.0)*2.5 + pow(s,12.0)*0.35);', 'if(night>0.01){ vec2 q = floor(vP.xz/(vP.y+0.3)*180.0); float st = step(0.997, h(q)); c += vec3(st)*night*smoothstep(0.1,0.5,y); }', 'gl_FragColor = vec4(c,1.0);', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'].join('\n') });
    sky = new T.Mesh(new T.SphereGeometry(2600, 32, 16), m); scene.add(sky);
  }
  let hemi, sun, amb, doorLamp;
  const KEY = [ // 小时, 天顶, 地平线, 阳光色, 阳光强度, 半球强度, 曝光, 夜
    [0, '#14245a', '#2e4a86', '#a8bcff', 0.75, 0.62, 1.05, 1], [5, '#23377a', '#8a7aa0', '#ffb07a', 0.7, 0.6, 1.05, 0.7], [6.5, '#5a8ad8', '#ffc89a', '#ffc080', 1.1, 0.7, 1.0, 0.1],
    [9, '#3a8ee0', '#cfe8ff', '#fff0d8', 1.8, 0.95, 1.0, 0], [15, '#3a8ee0', '#d8ecff', '#fff4e0', 1.9, 0.95, 1.0, 0], [17.6, '#5a8ad0', '#ffd0a0', '#ffc070', 1.5, 0.8, 1.0, 0],
    [18.8, '#4a5a9a', '#ff9a6a', '#ff8a4a', 0.9, 0.45, 0.98, 0.25], [20, '#1e2e68', '#4a4a86', '#a8bcff', 0.7, 0.6, 1.02, 0.85], [24, '#14245a', '#2e4a86', '#a8bcff', 0.75, 0.62, 1.05, 1]];
  function envAt(h) { let i = 0; while (i < KEY.length - 2 && KEY[i + 1][0] <= h) i++; const a = KEY[i], b = KEY[i + 1], t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))); const C = (x, y) => new T.Color(x).lerp(new T.Color(y), t); const L = (x, y) => x + (y - x) * t; return { top: C(a[1], b[1]), hor: C(a[2], b[2]), sun: C(a[3], b[3]), si: L(a[4], b[4]), hi: L(a[5], b[5]), ex: L(a[6], b[6]), night: L(a[7], b[7]) }; }

  /* ---------------- 农田 ---------------- */
  const plots = []; let hoverIdx = -1, hoverFrame, BADGE = {}, sparkTex, hitBoxes = [];
  let soilMats;
  function bedGeo() { const s = new T.Shape(), w = PITCH / 2 - 0.035, r = 0.06; /* 2026-10-26：地块之间不留缝，一片田连成一整块 */ s.moveTo(-w + r, -w); s.lineTo(w - r, -w); s.quadraticCurveTo(w, -w, w, -w + r); s.lineTo(w, w - r); s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w); s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r); s.quadraticCurveTo(-w, -w, -w + r, -w); const g = new T.ExtrudeGeometry(s, { depth: BED_H - 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 2 }); g.rotateX(-Math.PI / 2); const p = g.attributes.uv; for (let i = 0; i < p.count; i++) p.setXY(i, p.getX(i) / PLOT + 0.5, p.getY(i) / PLOT + 0.5); return g; }
  let BED_G, RIDGE_G, LOCK_G;
  function soilMat(col) { const m = new T.MeshStandardMaterial({ color: new T.Color(col), map: TX.soil, normalMap: TX.soilN, roughness: 0.96 }); m.userData.snowK = 0.28; snowify(m); return m; }   /* 冬天菜地只盖薄薄一层雪，还认得出是地 */
  function buildPlotsBase() {
    BED_G = bedGeo(); RIDGE_G = new T.CapsuleGeometry(0.075, PITCH - 0.45, 4, 10); RIDGE_G.rotateZ(Math.PI / 2); RIDGE_G.scale(1, 0.55, 1);
    soilMats = { 0: { n: soilMat('#5c4130'), wet: soilMat('#3a281c'), dry: soilMat('#8c7258') }, 1: { n: soilMat('#86402a'), wet: soilMat('#5a2618'), dry: soilMat('#a8644a') },
      2: { n: soilMat('#2e2622'), wet: soilMat('#1c1714'), dry: soilMat('#4e4238') }, 3: { n: soilMat('#b08a3a'), wet: soilMat('#80622a'), dry: soilMat('#ccab62') } };
    [3].forEach(k => Object.values(soilMats[k]).forEach(m => { m.emissive = new T.Color('#5a4010'); m.emissiveIntensity = 0.35; m.metalness = 0.25; }));
    ['d', 'w', 'b', 's'].forEach(k => BADGE[k] = new T.SpriteMaterial({ map: badgeTex(k), depthTest: false, transparent: true }));
    sparkTex = starTex();
    const hb = new T.BoxGeometry(PITCH - 0.05, 1.4, PITCH - 0.05); hb.translate(0, 0.7, 0); const hm = new T.MeshBasicMaterial({ visible: false });
    PLOT_HB = hb; PLOT_HM = hm; ensurePlots(24);
    // 悬停高亮框
    const c = mkCanvas(128), x = c.getContext('2d'); x.strokeStyle = 'rgba(255,236,170,1)'; x.lineWidth = 8; x.shadowColor = 'rgba(255,210,90,1)'; x.shadowBlur = 14; x.beginPath(); x.roundRect ? x.roundRect(12, 12, 104, 104, 18) : x.rect(12, 12, 104, 104); x.stroke();
    hoverFrame = new T.Mesh(new T.PlaneGeometry(PLOT + 0.25, PLOT + 0.25), new T.MeshBasicMaterial({ map: tex(c, 0), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); hoverFrame.rotation.x = -Math.PI / 2; hoverFrame.visible = false; scene.add(hoverFrame);
    LOCK_G = { post: new T.BoxGeometry(0.09, 0.8, 0.09), board: new T.BoxGeometry(0.7, 0.46, 0.05), face: new T.PlaneGeometry(0.66, 0.42) };
  }
  let LOCK_TEX, LOCK_MAT;
  function lockTex() { if (LOCK_TEX) return LOCK_TEX; const c = mkCanvas(128), x = c.getContext('2d'); x.drawImage(TX.wood.image, 0, 0, 128, 128); x.fillStyle = 'rgba(60,36,16,.25)'; x.fillRect(0, 0, 128, 128); x.translate(64, 70); x.strokeStyle = '#3a2410'; x.lineWidth = 9; x.beginPath(); x.arc(0, -14, 16, Math.PI, 0); x.stroke(); x.fillStyle = '#3a2410'; x.fillRect(-24, -14, 48, 36); x.fillStyle = '#d8b050'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); x.fillRect(-2, 0, 4, 12); LOCK_TEX = tex(c, 0); return LOCK_TEX; }
  let PLOT_HB, PLOT_HM, FIELD_SOIL = null; const fieldDeco = [];
  function ensurePlots(n) {
    for (let i = plots.length; i < n; i++) { const [x, z] = plotXZ(i), node = new T.Group(); node.position.set(x, 0, z); scene.add(node); const hit = new T.Mesh(PLOT_HB, PLOT_HM); hit.userData.idx = i; node.add(hit); hitBoxes.push(hit); plots.push({ node, key: '', crop: null, badges: [], sparks: [], bug: null, sway: Math.random() * 6, cropH: 0 });
      if (i % 24 === 0) { // 新的一片田：铺一整块田间土地（和旁边的田连在一起，中间是走得过去的田埂），田名木牌插在角上
        const f = i / 24, [cx, cz] = fieldC(f), F = HOMEL.fields, g = new T.Group();
        const pad = new T.Mesh(new T.PlaneGeometry(F.dx + 0.1, F.dz + 0.1), FIELD_SOIL || (FIELD_SOIL = mat('#7a5a3c', { p: { roughness: 1, map: TX.soil } }))); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.02, cz); pad.receiveShadow = true; g.add(pad);
        woodSign(g, cx - 7.6, cz + 5.3, Math.PI * 0.75, `第${f + 1}片田`); scene.add(g); fieldDeco.push(g); } }
  }
  function rebuildPlot(i, P, o) {
    const pl = plots[i], node = pl.node; node.children.slice().forEach(ch => { if (!ch.userData.idx && ch.userData.idx !== 0) { node.remove(ch); ch.traverse(o => { if (o.userData.own) { if (o.geometry) o.geometry.dispose(); } if (o.isSprite && o.material && o.material.map === sparkTex) o.material.dispose(); }); } }); /* 释放这块地上一次独有的几何体（荒地合并出来的草），来回串门不会越积越多 */ pl.crop = null; pl.badges = []; pl.sparks = []; pl.bug = null; pl.cropH = 0;
    if (!P.u) {
      const g = new T.Group(); const patch = mesh(BED_G, mat('#7fa856', { p: { roughness: 1, map: TX.grass } })); patch.scale.set(1, 0.22, 1); g.add(patch);
      // 只有下一块可以开垦的荒地插木牌，其他荒地就是草地 + 野花，画面更干净
      if (o.next) { const wm = mat('#8a6040', { p: { map: TX.wood } }); g.add(mesh(LOCK_G.post, wm, 0.42, 0.35, 0.42)); const b = mesh(LOCK_G.board, wm, 0.42, 0.78, 0.42); b.rotation.y = Math.PI / 4; g.add(b); const face = mesh(LOCK_G.face, LOCK_MAT || (LOCK_MAT = new T.MeshStandardMaterial({ map: lockTex(), roughness: 0.85 })), 0.42 + 0.024, 0.78, 0.42 + 0.024); face.rotation.y = Math.PI / 4; g.add(face); }
      else { const fr = CFG3.rng(i * 13 + 5), pal = ['#ffffff', '#ffd23a', '#ff8ab0', '#b98aff']; for (let k = 0; k < 4; k++) g.add(blob(mat(pal[Math.floor(fr() * 4)], { p: { roughness: 0.6 } }), (fr() - 0.5) * 1.4, 0.12, (fr() - 0.5) * 1.4, 0.05, 0.03, 0.05, 8)); }
      const tm = mat('#4f8a34', { vc: 1, ds: 1 }), r = CFG3.rng(i * 7); for (let k = 0; k < 7; k++) { const tx = (r() - 0.5) * 1.5, tz = (r() - 0.5) * 1.5; for (let j = 0; j < 3; j++) addLeaf(g, leafGeo(0.22 + r() * 0.12, 0.035, 0.6, 0, 'blade'), tm, tx, 0.04, tz, r() * 6, 0.3 + r() * 0.4); }
      const mg = merge(g); mg.traverse(o => { if (o.isMesh) o.userData.own = 1; }); node.add(mg); return;
    }
    const sm = (soilMats[P.soil | 0] || soilMats[0])[P.pr && P.pr.d ? 'dry' : (P.wet ? 'wet' : 'n')];
    const bed = new T.Mesh(BED_G, sm); bed.receiveShadow = true; node.add(bed);
    if (o.lite) { // 远处的田：只画土和一个简化的作物（颜色 = 作物主色，大小 = 生长阶段）
      if (P.c >= 0 && CFG3.CROPS[P.c]) { const a = CFG3.CROPS[P.c].art || {}, st = CFG3.stageOf(P.p), ripe = st === 4, col = ripe ? (a.fruit || a.head || a.root || (a.petal === 'rainbow' ? '#ff6ad5' : a.petal) || a.ear || '#e8c25a') : '#6cb048', k = [0.25, 0.45, 0.7, 0.85, 1][st] || 0.5;
        const m = blob(mat(col, { p: { roughness: 0.6 } }), 0, BED_H + 0.6 * k, 0, 1.1 * k, 0.76 * k, 1.1 * k, 10); node.add(m); pl.cropH = 1.2 * k;
        if (ripe) { const sp = new T.Sprite(new T.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); sp.userData.ph = i * 0.13; sp.userData.r = 0.4; node.add(sp); pl.sparks.push(sp); } }
      return; }
    [-0.6, -0.2, 0.2, 0.6].forEach(z => { const r = new T.Mesh(RIDGE_G, sm); r.position.set(0, BED_H, z); r.receiveShadow = true; r.castShadow = true; node.add(r); });
    if (P.pr && P.pr.w) { const g = new T.Group(), wm = mat('#6a9a2a', { vc: 1, ds: 1 }), r = CFG3.rng(i * 11 + 3); [[-0.7, -0.65], [0.72, 0.5], [-0.55, 0.72], [0.6, -0.6], [0.05, 0.78]].forEach(([x, z]) => { for (let j = 0; j < 5; j++) addLeaf(g, leafGeo(0.28 + r() * 0.15, 0.05, 0.9, 0.1, 'blade'), wm, x, BED_H, z, r() * 6, 0.4 + r() * 0.5); }); const wg = merge(g); wg.traverse(o => { o.userData.own = 1; }); node.add(wg); }
    if (P.c >= 0 && CFG3.CROPS[P.c]) {
      const st = CFG3.stageOf(P.p), base = cropModel(P.c, st), m = base.clone();
        /* 2026-10-26 甲方：放大后太挤。宽的作物（南瓜、白菜）按实际宽度限制，最宽占一块地的 85%（地块之间留出空隙，不伸到隔壁）；高秆作物本来就窄，照样放大到 CROP_SC，人能在下面歇脚。高度最多是宽度缩放的 1.3 倍，不会被拉得变形 */
        if (base.userData.w0 === undefined) { const bb = new T.Box3().setFromObject(base), sz = bb.getSize(new T.Vector3()); base.userData.w0 = Math.max(0.05, sz.x, sz.z); }
        const sxz = Math.min(CROP_SC, PITCH * 0.85 / base.userData.w0), sy = Math.min(CROP_SC, sxz * 1.3); m.scale.set(sxz, sy, sxz); m.position.y = BED_H + 0.02; node.add(m); pl.crop = m; pl.cropH = (base.userData.h || 0.3) * sy;
      const list = []; if (P.pr) { if (P.pr.d) list.push('d'); if (P.pr.w) list.push('w'); if (P.pr.b) list.push('b'); }
      if (o.mine) list.push('s');
      list.forEach((k, j) => { const s = new T.Sprite(BADGE[k]); s.scale.set(0.62, 0.62, 1); s.renderOrder = 10; s.userData.base = v3((j - (list.length - 1) / 2) * 0.66, BED_H + pl.cropH + 0.55, 0); s.position.copy(s.userData.base); node.add(s); pl.badges.push(s); });
      if (st === 4) for (let j = 0; j < 4; j++) { const s = new T.Sprite(new T.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); s.userData.ph = j / 4 + i * 0.13; s.userData.r = 0.5 + (j % 2) * 0.25; s.scale.setScalar(0.3); node.add(s); pl.sparks.push(s); }
      if (P.pr && P.pr.b && st > 0) { const bug = new T.Group(); bug.add(blob(fruitMat('#d82a20', 0.25), 0, 0.04, 0, 0.07, 0.05, 0.08, 12)); bug.add(blob(mat('#1a1008'), 0, 0.04, 0.07, 0.04, 0.035, 0.035, 8)); [[0.03, -0.02], [-0.03, 0.01], [0.02, 0.03]].forEach(([x, z]) => bug.add(blob(mat('#1a1008'), x, 0.085, z, 0.016, 0.01, 0.016, 6))); node.add(bug); pl.bug = bug; }
    }
  }
  function plotKey(P, o) { return [P.u, P.soil, P.c, P.c >= 0 ? CFG3.stageOf(P.p) : -1, P.pr ? '' + (P.pr.d | 0) + (P.pr.w | 0) + (P.pr.b | 0) : '', P.wet ? 1 : 0, o.mine ? 1 : 0, o.next ? 1 : 0, o.lite ? 1 : 0].join('|'); }

  /* ---------------- 鱼塘、牧场、果园（v3：规模随等级扩大） ---------------- */
  const PONDS = HOMEL.ponds.list, POND = { x: PONDS[0][0], z: PONDS[0][1] };
  const PAST = { x0: HOMEL.pasture.x0, z0: HOMEL.pasture.z0, x1: HOMEL.pasture.x0 + CFG3.pastSize(1)[0], z1: HOMEL.pasture.z0 + CFG3.pastSize(1)[1], lv: 0 }; PAST.cx = (PAST.x0 + PAST.x1) / 2; PAST.cz = (PAST.z0 + PAST.z1) / 2;
  const ORCH = { x0: HOMEL.orchard.x0, x1: HOMEL.orchard.x1, z0: HOMEL.orchard.z0, z1: HOMEL.orchard.z1 }; ORCH.cx = (ORCH.x0 + ORCH.x1) / 2; ORCH.cz = (ORCH.z0 + ORCH.z1) / 2;
  const MEADOW = v3(0, 0, 0), HERD_T = { out: 24, graze: 70, back: 94, loop: 110 };
  const RANCH3 = { fish: [], sheep: [], fkey: '', skey: '', tkey: '', herd: { on: false, dog: '' }, ready: false, ponds: 1, pondObjs: [], pastG: null, inst: {}, trees: null };
  const PFENCE = []; let PASTOBST = [];
  const pastSize = CFG3.pastSize;
  // 小鱼
  const FISH_GEO = {};
  function fishGeo() { if (FISH_GEO.body) return FISH_GEO;
    const b = lathe([[0, -0.16], [0.035, -0.13], [0.055, -0.06], [0.058, 0.0], [0.048, 0.07], [0.028, 0.12], [0, 0.15]], 14); b.rotateZ(-Math.PI / 2); b.scale(1, 0.85, 0.62);
    const tail = new T.ConeGeometry(0.06, 0.1, 3, 1); tail.rotateZ(Math.PI / 2); tail.scale(1, 1, 0.25); tail.translate(0.2, 0, 0);
    const fin = new T.ConeGeometry(0.03, 0.07, 3, 1); fin.scale(1.6, 1, 0.25); fin.translate(0.0, 0.065, 0);
    FISH_GEO.body = b; FISH_GEO.tail = tail; FISH_GEO.fin = fin; return FISH_GEO; }
  function buildFish(t) {
    const d = CFG3.FISH[t] || CFG3.FISH[0], G = fishGeo(), g = new T.Group(), m = new T.MeshPhysicalMaterial({ color: new T.Color(d.col), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, metalness: t === 5 ? 0.45 : 0.05 });
    const body = new T.Mesh(G.body, m); g.add(body); const tail = new T.Mesh(G.tail, m); g.add(tail); g.add(new T.Mesh(G.fin, m));
    if (d.spots) [[-0.04, 0.03, 0.02], [0.05, 0.035, -0.015], [0.0, 0.04, 0.03]].forEach(([x, y, z]) => g.add(blob(mat(d.spots, { p: { roughness: 0.35 } }), x, y, z, 0.035, 0.022, 0.03, 10)));
    [-1, 1].forEach(sd => { g.add(blob(mat('#101010', { p: { roughness: 0.2 } }), -0.12, 0.012, sd * 0.025, 0.011, 0.011, 0.008, 8)); });
    g.scale.setScalar(d.size * 1.3); g.userData.tail = tail; return g;
  }
  // 绵羊 / 羊驼
  const SHEEP_GEO = {};
  function sheepGeo(t) {
    if (SHEEP_GEO[t]) return SHEEP_GEO[t]; const d = CFG3.SHEEP[t], al = !!d.alpaca, cB = new T.Color(d.body), cS = cB.clone().multiplyScalar(0.86);
    const puffs = []; const rr = CFG3.rng(31 + t); for (let i = 0; i < 26; i++) { const u = rr() * Math.PI * 2, v = Math.acos(2 * rr() - 1); puffs.push([Math.cos(u) * Math.sin(v) * 0.36, 0.6 + Math.cos(v) * 0.24, Math.sin(u) * Math.sin(v) * 0.27, 0.1 + rr() * 0.05]); }
    const body = (x, y, z) => { let dd = sEll(x, y, z, [0, 0.6, 0], [0.4, 0.27, 0.29]); for (const [px, py, pz, r] of puffs) dd = smin(dd, Math.hypot(x - px, y - py, z - pz) - r, 0.06); if (al) dd = smin(dd, sCap(x, y, z, [0.28, 0.66, 0], [0.4, 1.12, 0], 0.11, 0.085), 0.08); return dd; };
    const bodyCol = (x, y, z, c) => { c.copy(cB).lerp(cS, sst(0.55, 0.35, y) * 0.8); };
    SHEEP_GEO[t] = { body: sdfMesh(body, 0.04, al ? 0.78 : 0.62, 0, al ? 0.62 : 0.5, al ? 40 : 34, bodyCol), lo: sdfMesh(body, 0.04, al ? 0.78 : 0.62, 0, al ? 0.62 : 0.5, al ? 22 : 18, bodyCol) }; return SHEEP_GEO[t]; // lo：远处成群的羊用的低面数版本
  }
  function buildSheep(t) {
    const d = CFG3.SHEEP[t] || CFG3.SHEEP[0], al = !!d.alpaca, G = sheepGeo(t), g = new T.Group(), body = new T.Group(); g.add(body);
    const fur = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new T.Color('#ffffff') });
    const bm = new T.Mesh(G.body, fur); bm.castShadow = true; body.add(bm);
    const face = mat(d.face, { p: { roughness: 0.7 } }), leg = mat(al ? new T.Color(d.body).multiplyScalar(0.8).getStyle() : '#2a2224', { p: { roughness: 0.7 } });
    const head = new T.Group(); head.position.set(al ? 0.46 : 0.42, al ? 1.18 : 0.7, 0); body.add(head);
    head.add(blob(face, 0.05, -0.02, 0, al ? 0.1 : 0.12, al ? 0.11 : 0.13, al ? 0.09 : 0.105, 18)); head.add(blob(face, 0.13, -0.06, 0, 0.07, 0.065, 0.07, 14));
    head.add(blob(new T.MeshPhysicalMaterial({ color: new T.Color(d.body), roughness: 0.95, sheen: 0.6, sheenColor: new T.Color('#ffffff') }), -0.03, 0.09, 0, 0.1, 0.07, 0.1, 14));
    [-1, 1].forEach(sd => { const e = blob(face, -0.02, al ? 0.12 : 0.03, sd * 0.12, al ? 0.03 : 0.07, al ? 0.07 : 0.03, 0.035, 10); e.rotation.x = sd * (al ? 0.2 : 0.5); head.add(e);
      head.add(blob(mat('#0e0b0a', { p: { roughness: 0.15 } }), 0.1, 0.02, sd * 0.07, 0.022, 0.026, 0.018, 10)); head.add(blob(new T.MeshBasicMaterial({ color: 0xffffff }), 0.118, 0.032, sd * 0.077, 0.007, 0.007, 0.005, 6)); });
    if (!al) head.add(blob(mat('#ff9aa0', { p: { roughness: 0.6 } }), 0.19, -0.07, 0, 0.018, 0.012, 0.025, 8));
    const legs = []; [[0.2, 0.15], [0.2, -0.15], [-0.2, 0.15], [-0.2, -0.15]].forEach(([x, z]) => { const L = new T.Group(); L.position.set(x, 0.4, z); L.add(mesh(new T.CapsuleGeometry(0.045, 0.28, 4, 8), leg, 0, -0.2, 0)); L.add(blob(mat('#1a1414'), 0, -0.37, 0.01, 0.05, 0.03, 0.055, 8)); body.add(L); legs.push(L); });
    const tail = blob(fur, -0.43, 0.65, 0, 0.07, 0.07, 0.06, 10); tail.material = new T.MeshPhysicalMaterial({ color: new T.Color(d.body), roughness: 0.95 }); body.add(tail);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const mark = new T.Sprite(new T.SpriteMaterial({ map: FXT.star, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); mark.scale.setScalar(0.35); mark.position.set(0, al ? 1.6 : 1.15, 0); mark.visible = false; g.add(mark);
    g.scale.setScalar(0.85);
    return { g, body, head, legs, mark };
  }
  const signTex = txt => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#c89a62'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#4a2a12'; x.font = 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 66); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };
  function woodSign(g, x, z, ry, txt) { const wm = mat('#c89a62', { p: { map: TX.wood, roughness: 0.85 } }), sign = new T.Group(); sign.position.set(x, 0, z); sign.rotation.y = ry; g.add(sign); sign.add(mesh(new T.BoxGeometry(0.07, 0.9, 0.07), wm, 0, 0.45, 0)); sign.add(mesh(new T.BoxGeometry(0.05, 0.34, 0.7), wm, 0, 0.85, 0)); const f = mesh(new T.PlaneGeometry(0.66, 0.32), new T.MeshStandardMaterial({ map: signTex(txt), roughness: 0.8 }), -0.03, 0.85, 0); f.rotation.y = -Math.PI / 2; sign.add(f); }
  // 牧场：等级越高草地越大（最大约 40 × 29），南边开门，门外是放牧草地
  function setPastureLv(l) {
    if (PAST.lv === l) return; PAST.lv = l; const [W, H] = pastSize(l); PAST.x1 = PAST.x0 + W; PAST.z1 = PAST.z0 + H; PAST.cx = (PAST.x0 + PAST.x1) / 2; PAST.cz = (PAST.z0 + PAST.z1) / 2; PAST.gw = Math.min(3.5, 0.9 + W * 0.05);
    MEADOW.set(PAST.cx - 0.4, 0, PAST.z1 + 4.2 + Math.min(4, H * 0.1));
    if (RANCH3.pastG) { scene.remove(RANCH3.pastG); const i = hitBoxes.indexOf(RANCH3.pastHit); if (i >= 0) hitBoxes.splice(i, 1); freeTree(RANCH3.pastG); }
    PFENCE.length = 0; PASTOBST.forEach(o => { const i = OBST.indexOf(o); if (i >= 0) OBST.splice(i, 1); }); PASTOBST = [];
    const g = new T.Group(), wm = mat('#c89a62', { p: { map: TX.wood, roughness: 0.85 } }), fg = new T.Group(), { x0, x1, z0, z1 } = PAST, gx = PAST.cx, gw = PAST.gw;
    const meadow = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), mat('#8cc860', { p: { roughness: 1, map: TX.grass } })); meadow.rotation.x = -Math.PI / 2; meadow.position.set(PAST.cx, 0.012, PAST.cz); meadow.receiveShadow = true; g.add(meadow);
    fenceLine(fg, x0, z0, x1, z0, wm, 1.05); fenceLine(fg, x1, z0, x1, z1, wm, 1.05); fenceLine(fg, x0, z0, x0, z1, wm, 1.05); fenceLine(fg, x0, z1, gx - gw, z1, wm, 1.05); fenceLine(fg, gx + gw, z1, x1, z1, wm, 1.05); g.add(merge(fg));
    PFENCE.push([x0, z0, x1, z0], [x1, z0, x1, z1], [x0, z0, x0, z1], [x0, z1, gx - gw, z1], [gx + gw, z1, x1, z1]);
    const nShed = 1 + Math.floor(W / 12); for (let i = 0; i < nShed; i++) { const shed = new T.Group(), sx = x1 - 1.1 - i * 4.2, sz = z0 + 0.95; shed.position.set(sx, 0, sz); g.add(shed);
      const wall = mat('#e8d2a8', { p: { map: TX.wood, roughness: 0.85 } }), roof = mat('#c8503a', { p: { roughness: 0.7 } });
      shed.add(mesh(new T.BoxGeometry(1.5, 0.9, 1.2), wall, 0, 0.45, 0)); const r1 = mesh(new T.BoxGeometry(1.7, 0.08, 0.8), roof, 0, 1.05, 0.33); r1.rotation.x = 0.55; shed.add(r1); const r2 = mesh(new T.BoxGeometry(1.7, 0.08, 0.8), roof, 0, 1.05, -0.33); r2.rotation.x = -0.55; shed.add(r2);
      shed.add(mesh(new T.BoxGeometry(0.5, 0.6, 0.02), mat('#5a3a22'), 0, 0.3, 0.61)); const o = [sx, sz, 0.9]; OBST.push(o); PASTOBST.push(o); }
    const hay = mat('#e8c25a', { p: { roughness: 0.95, map: strawTex() } }), nh = 2 + Math.floor(W / 8); for (let i = 0; i < nh; i++) { const x = x0 + 0.9 + i * 0.75 + Math.floor(i / 2) * 2.5, z = z1 - 0.7 - (i % 2) * 0.2; if (x > gx - gw - 0.6) break; const h = mesh(new T.CylinderGeometry(0.38, 0.38, 0.55, 18), hay, x, 0.28, z); h.rotation.z = Math.PI / 2; h.rotation.y = i * 0.6; g.add(h); const o = [x, z, 0.45]; OBST.push(o); PASTOBST.push(o); }
    const ntr = 1 + Math.floor(H / 9); for (let i = 0; i < ntr; i++) { const tr = new T.Group(), tx = x1 - 0.8, tz = z1 - 1.0 - i * 5; tr.position.set(tx, 0, tz); tr.rotation.y = Math.PI / 2; g.add(tr); tr.add(mesh(new T.BoxGeometry(1.0, 0.3, 0.4), mat('#8a6040', { p: { map: TX.wood } }), 0, 0.2, 0)); const wt = mesh(new T.PlaneGeometry(0.9, 0.3), mat('#5ab0d8', { p: { roughness: 0.1, metalness: 0.2 } }), 0, 0.33, 0); wt.rotation.x = -Math.PI / 2; tr.add(wt); const o = [tx, tz, 0.55]; OBST.push(o); PASTOBST.push(o); }
    woodSign(g, gx - gw - 0.35, z1 + 0.2, -Math.PI / 2, '牧场');
    const hk = new T.Mesh(new T.BoxGeometry(x1 - x0, 1.2, z1 - z0), new T.MeshBasicMaterial({ visible: false })); hk.position.set(PAST.cx, 0.6, PAST.cz); hk.userData.idx = -31; g.add(hk); hitBoxes.push(hk); RANCH3.pastHit = hk;
    scene.add(g); RANCH3.pastG = g; RANCH3.skey = ''; // 牧场变了：羊重新放
  }
  // 鱼塘：每 10 级多挖一个池塘（最多 6 个）
  function setPonds(n) {
    n = Math.max(1, Math.min(PONDS.length, n)); if (RANCH3.pondG && RANCH3.ponds === n) return;
    if (RANCH3.pondG) { scene.remove(RANCH3.pondG); freeTree(RANCH3.pondG); RANCH3.pondG.traverse(o => { if (o.material && o.material.alphaMap) { o.material.alphaMap.dispose(); o.material.dispose(); } }); }
    RANCH3.pondG = buildPonds(n); scene.add(RANCH3.pondG);
    for (let i = Math.max(1, RANCH3.pondHits || 1); i < n; i++) { const [x, z] = PONDS[i]; const hk = new T.Mesh(new T.BoxGeometry(8.4, 0.5, 6.8), new T.MeshBasicMaterial({ visible: false })); hk.position.set(x, 0.1, z); hk.userData.idx = -30; scene.add(hk); hitBoxes.push(hk); }
    RANCH3.pondHits = Math.max(RANCH3.pondHits || 1, n); RANCH3.ponds = n; RANCH3.fkey = '';
  }
  function pondHit() { const hk = new T.Mesh(new T.BoxGeometry(8.4, 0.5, 6.8), new T.MeshBasicMaterial({ visible: false })); hk.position.set(POND.x, 0.1, POND.z); hk.userData.idx = -30; hitBoxes.push(hk); return hk; }
  // 果园：开放式的一大片果林（2026-10-26 去掉篱笆和单独的草皮，和周围草地连在一起），中间有弯弯的小路；果树按“自然撒点”种，不排成方阵
  const ORCH_R = a => HOMEL.orchard.r - 1.6 + Math.sin(a * 3 + 0.7) * 1.3 + Math.cos(a * 5 + 1.9) * 0.8;          // 边界半径随角度起伏（2026-10-26 开放式，不再有篱笆）
  const ORCH_PATH = z => ORCH.cx + 6 + Math.sin((z - ORCH.cz) * 0.22) * 3.2;                      // 小路（从东门弯弯曲曲往里走）
  let ORCH_SPOTS = [];
  // 每种果树的长相：树冠形状、叶子颜色、树干、果子形状与大小
  const TREE_STYLE = [
    { cr: 'round', leaf: '#4f9a3a', leaf2: '#6cb64a', th: 1.0, fr: 'apple', fs: 1.0 },           // 苹果
    { cr: 'spread', leaf: '#6aa84a', leaf2: '#8cc860', th: 0.85, fr: 'peach', fs: 1.0 },          // 桃
    { cr: 'dense', leaf: '#2f7a30', leaf2: '#4a9a3a', th: 0.9, fr: 'orange', fs: 1.05 },          // 橙子
    { cr: 'oval', leaf: '#5a9a3a', leaf2: '#7ab84a', th: 1.2, fr: 'pear', fs: 1.0 },             // 梨
    { cr: 'umbrella', leaf: '#5a9a3a', leaf2: '#7ab84a', th: 1.1, fr: 'cherry', fs: 0.6 },        // 樱桃
    { cr: 'oval', leaf: '#5a8a2a', leaf2: '#d8902a', th: 1.25, fr: 'persimmon', fs: 1.05 },       // 柿子（秋天有黄叶）
    { cr: 'dense', leaf: '#2e6a2a', leaf2: '#3e7e32', th: 0.9, fr: 'lychee', fs: 0.7 },           // 荔枝
    { cr: 'giant', leaf: '#3a7a2a', leaf2: '#5a9a3a', th: 1.3, fr: 'mango', fs: 1.1 },            // 芒果
    { cr: 'bush', leaf: '#5a8a30', leaf2: '#7aa840', th: 0.5, fr: 'pom', fs: 1.0 },               // 石榴
    { cr: 'round', leaf: '#e0b840', leaf2: '#ffd86a', th: 1.0, fr: 'apple', fs: 1.0, metal: 1 },  // 金苹果
    { cr: 'bush', leaf: '#4a7a3a', leaf2: '#6a9a4a', th: 0.35, fr: 'berry', fs: 0.55 },           // 蓝莓
    { cr: 'cone', leaf: '#3a6a28', leaf2: '#558a36', th: 1.4, fr: 'durian', fs: 1.4 },            // 榴莲
    { cr: 'round', leaf: '#2a5a2a', leaf2: '#3e7038', th: 1.0, fr: 'mangosteen', fs: 1.0 },       // 山竹
    { cr: 'umbrella', leaf: '#ffb8d8', leaf2: '#ffd8ec', th: 1.1, fr: 'cherry', fs: 0.6 },        // 樱花果
    { cr: 'oval', leaf: '#5aa84a', leaf2: '#8ad060', th: 1.1, fr: 'star', fs: 1.1 },              // 星果
    { cr: 'weep', leaf: '#b8ccc4', leaf2: '#e0ece8', th: 1.2, fr: 'pear', fs: 0.95, glow: '#cfe8ff' }, // 月光梨
    { cr: 'spread', leaf: '#6aa84a', leaf2: '#ffc8d8', th: 0.9, fr: 'flatpeach', fs: 1.1 },       // 蟠桃
    { cr: 'giant', leaf: '#3aa860', leaf2: '#7affc8', th: 1.8, fr: 'apple', fs: 1.2, glow: '#7affc8' }, // 世界树
  ];
  // 把几块几何体合并成一个（带顶点色），给实例化用
  function mergeGeos(parts) { const ps = parts.map(([g, col]) => { g = g.index ? g.toNonIndexed() : g; const c = new T.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; });
    const n = ps.reduce((s, g) => s + g.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    ps.forEach(g => { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
    const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(P, 3)); G.setAttribute('normal', new T.BufferAttribute(N, 3)); G.setAttribute('color', new T.BufferAttribute(C, 3)); return G; }
  /* 两头粗细不同的弯管（树干、树枝用） */
  function taperTube(pts, r0, r1, seg) { const curve = new T.CatmullRomCurve3(pts), g = new T.TubeGeometry(curve, seg || 8, 1, 7, false), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = Math.floor(i / 8) / (seg || 8), c = curve.getPoint(Math.min(1, t)), k = r0 + (r1 - r0) * t; p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k); } g.computeVertexNormals(); g.deleteAttribute('uv'); return g; }
  const blobG = (x, y, z, sx, sy, sz, seed, seg) => { const g = new T.SphereGeometry(1, seg || 14, Math.round((seg || 14) * 0.7)); displace(g, 0.16, 2.2, seed); displace(g, 0.07, 6.5, seed + 50); g.computeVertexNormals(); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
  // 树冠：几团叶子拼起来，返回几何体和“挂果子的位置”
  const TREE_GEO = {};
  function treeGeo(t) {
    if (TREE_GEO[t]) return TREE_GEO[t]; const S = TREE_STYLE[t] || TREE_STYLE[0], r = CFG3.rng(100 + t), parts = [], spots = [], H = 1.1 * S.th;
    const CL = []; const add = (x, y, z, sx, sy, sz, c) => { CL.push([x, y, z, Math.max(sx, sz)]); parts.push([blobG(x, y, z, sx, sy, sz, t * 7 + parts.length, 16), c]); for (let i = 0; i < 7; i++) { const a = r() * 6.28, b = (r() - 0.3) * 1.2, k = 0.3 + r() * 0.16; parts.push([blobG(x + Math.cos(a) * Math.cos(b) * sx * 0.82, y + Math.sin(b) * sy * 0.8, z + Math.sin(a) * Math.cos(b) * sz * 0.82, sx * k, sy * k, sz * k, t * 13 + parts.length, 9), i % 2 ? c : (c === L1 ? L2 : L1)]); } /* 一簇簇的叶团 */ for (let i = 0; i < 4; i++) { const a = r() * 6.28, b = (r() - 0.35) * 1.4; spots.push([x + Math.cos(a) * Math.cos(b) * sx * 1.16, y + Math.sin(b) * sy * 1.05, z + Math.sin(a) * Math.cos(b) * sz * 1.16]); } };
    const L1 = S.leaf, L2 = S.leaf2;
    if (S.cr === 'round') { add(0, H + 0.7, 0, 0.85, 0.75, 0.85, L1); add(0.35, H + 0.95, 0.2, 0.5, 0.45, 0.5, L2); add(-0.4, H + 0.85, -0.25, 0.5, 0.45, 0.5, L1); }
    else if (S.cr === 'spread') { add(0, H + 0.55, 0, 1.15, 0.5, 1.05, L1); add(0.55, H + 0.75, 0.3, 0.55, 0.38, 0.55, L2); add(-0.6, H + 0.7, -0.2, 0.6, 0.36, 0.55, L2); add(0.1, H + 0.9, -0.5, 0.45, 0.32, 0.45, L1); }
    else if (S.cr === 'dense') { add(0, H + 0.75, 0, 0.95, 0.85, 0.95, L1); add(0, H + 1.25, 0, 0.6, 0.5, 0.6, L2); }
    else if (S.cr === 'oval') { add(0, H + 1.0, 0, 0.7, 1.05, 0.7, L1); add(0.25, H + 1.5, 0.1, 0.42, 0.5, 0.42, L2); add(-0.25, H + 0.6, -0.15, 0.48, 0.45, 0.48, L2); }
    else if (S.cr === 'umbrella') { add(0, H + 0.65, 0, 1.3, 0.42, 1.3, L1); add(0, H + 0.95, 0, 0.8, 0.35, 0.8, L2); }
    else if (S.cr === 'giant') { add(0, H + 1.1, 0, 1.6, 1.0, 1.6, L1); add(0.9, H + 1.5, 0.5, 0.8, 0.6, 0.8, L2); add(-0.9, H + 1.4, -0.4, 0.9, 0.6, 0.9, L1); add(0.1, H + 2.0, -0.6, 0.7, 0.5, 0.7, L2); }
    else if (S.cr === 'bush') { for (let i = 0; i < 4; i++) { const a = i * 1.7; add(Math.cos(a) * 0.4, H + 0.45 + (i % 2) * 0.2, Math.sin(a) * 0.4, 0.55, 0.5, 0.55, i % 2 ? L2 : L1); } }
    else if (S.cr === 'cone') { add(0, H + 0.6, 0, 0.9, 0.55, 0.9, L1); add(0, H + 1.25, 0, 0.7, 0.55, 0.7, L2); add(0, H + 1.85, 0, 0.45, 0.45, 0.45, L1); }
    else if (S.cr === 'weep') { add(0, H + 1.05, 0, 0.9, 0.6, 0.9, L1); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const g = new T.CylinderGeometry(0.18, 0.05, 1.1, 6); g.translate(Math.cos(a) * 0.75, H + 0.45, Math.sin(a) * 0.75); parts.push([g, L2]); } }
    // 树干：主干 + 两根分枝；灌木型是几根细枝
    const trunk = []; const tc = S.metal ? '#a8743a' : t === 15 ? '#c8c0b8' : '#7a5232';
    if (S.cr === 'bush') for (let i = 0; i < 3; i++) { const g = new T.CylinderGeometry(0.035, 0.06, H + 0.4, 6); g.rotateZ((i - 1) * 0.3); g.translate((i - 1) * 0.12, (H + 0.4) / 2, 0); trunk.push([g, tc]); }
    else { /* 2026-10-26 树干更自然：弯一点、下粗上细、根部外扩，再从树干分出几根枝条伸进每一团树冠 */
      const top = v3((r() - 0.5) * 0.25, H + 0.35, (r() - 0.5) * 0.25), mid = v3((r() - 0.5) * 0.18, H * 0.5, (r() - 0.5) * 0.18);
      trunk.push([taperTube([v3(0, 0, 0), mid, top], 0.19 * S.th, 0.08 * S.th, 10), tc]);
      { const fl = new T.ConeGeometry(0.34 * S.th, 0.5, 9, 1, true); fl.translate(0, 0.2, 0); trunk.push([fl, tc]); }
      CL.slice(0, 6).forEach(([x, y, z, s0], k) => { if (Math.hypot(x, z) < 0.15 && k > 0) return; const from = v3(top.x * 0.6, H * (0.62 + 0.08 * (k % 3)), top.z * 0.6), to = v3(x * 0.8, y - s0 * 0.25, z * 0.8), m2 = from.clone().lerp(to, 0.5); m2.y += 0.15;
        trunk.push([taperTube([from, m2, to], 0.075 * S.th, 0.03, 6), tc]); }); }
    const crown = mergeGeos(parts), cn = crown.attributes.normal, cc = crown.attributes.color, cp = crown.attributes.position; for (let i = 0; i < cc.count; i++) { const k = 0.66 + 0.42 * Math.max(0, Math.min(1, cn.getY(i) * 0.5 + 0.5)) + (n3(cp.getX(i) * 6, cp.getY(i) * 6, cp.getZ(i) * 6, t) - 0.5) * 0.18; cc.setXYZ(i, cc.getX(i) * k, cc.getY(i) * k, cc.getZ(i) * k); } // 树冠下面暗、上面亮，再加一点斑驳
    TREE_GEO[t] = { crown, trunk: mergeGeos(trunk), spots }; return TREE_GEO[t];
  }
  // 果子形状
  const FRUIT_GEO = {};
  function fruitGeo(kind, col) {
    const key = kind + col; if (FRUIT_GEO[key]) return FRUIT_GEO[key]; const leaf = '#4a8a2a', stem = '#5a3a1a'; let parts;
    const sph = (sx, sy, sz, y) => { const g = new T.SphereGeometry(1, 12, 9); g.scale(sx, sy, sz); g.translate(0, y || 0, 0); return g; };
    const stemG = (y) => { const g = new T.CylinderGeometry(0.008, 0.01, 0.06, 4); g.translate(0, y, 0); return g; };
    if (kind === 'apple') parts = [[sph(0.1, 0.09, 0.1), col], [stemG(0.1), stem], [(() => { const g = new T.SphereGeometry(1, 6, 4); g.scale(0.04, 0.01, 0.02); g.translate(0.03, 0.11, 0); return g; })(), leaf]];
    else if (kind === 'peach' || kind === 'flatpeach') parts = [[sph(0.1, kind === 'flatpeach' ? 0.065 : 0.1, 0.1), col], [sph(0.05, 0.05, 0.05, 0.03).translate(0.05, 0, 0.03), '#ff6a7a'], [stemG(0.09), stem]];
    else if (kind === 'orange') { const g = sph(0.105, 0.1, 0.105); displace(g, 0.04, 9, 3); g.computeVertexNormals(); parts = [[g, col], [stemG(0.1), leaf]]; }
    else if (kind === 'pear') { const g = new T.LatheGeometry([[0, -0.1], [0.07, -0.08], [0.085, -0.02], [0.055, 0.05], [0.035, 0.1], [0, 0.12]].map(p => new T.Vector2(p[0], p[1])), 12); parts = [[g, col], [stemG(0.14), stem]]; }
    else if (kind === 'cherry') { const a = sph(0.05, 0.05, 0.05); a.translate(-0.035, -0.06, 0); const b = sph(0.05, 0.05, 0.05); b.translate(0.04, -0.07, 0.01); const s1 = new T.CylinderGeometry(0.005, 0.005, 0.12, 4); s1.rotateZ(0.35); s1.translate(-0.015, 0, 0); const s2 = new T.CylinderGeometry(0.005, 0.005, 0.12, 4); s2.rotateZ(-0.35); s2.translate(0.02, 0, 0); parts = [[a, col], [b, col], [s1, '#5a7a2a'], [s2, '#5a7a2a']]; }
    else if (kind === 'persimmon') parts = [[sph(0.11, 0.08, 0.11), col], [(() => { const g = new T.CylinderGeometry(0.06, 0.07, 0.02, 4); g.translate(0, 0.08, 0); return g; })(), '#3a6a1a']];
    else if (kind === 'lychee' || kind === 'berry') { parts = []; for (let i = 0; i < 5; i++) { const g = sph(0.045, 0.05, 0.045); if (kind === 'lychee') { displace(g, 0.18, 22, i); g.computeVertexNormals(); } g.translate(Math.cos(i * 1.3) * 0.05, -i * 0.025, Math.sin(i * 1.3) * 0.05); parts.push([g, col]); } }
    else if (kind === 'mango') { const g = sph(0.08, 0.12, 0.07); g.rotateZ(0.3); parts = [[g, col], [(() => { const s = sph(0.05, 0.06, 0.05); s.translate(0.03, 0.04, 0.03); return s; })(), '#ff7a2a'], [stemG(0.13), stem]]; }
    else if (kind === 'pom') parts = [[sph(0.11, 0.1, 0.11), col], [(() => { const g = new T.CylinderGeometry(0.04, 0.025, 0.05, 6); g.translate(0, 0.11, 0); return g; })(), '#8a1a1a']];
    else if (kind === 'durian') { const g = new T.IcosahedronGeometry(0.13, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(i % 3 === 0 ? 1.25 : 1); p.setXYZ(i, v.x, v.y * 1.15, v.z); } g.computeVertexNormals(); parts = [[g, col], [stemG(0.17), stem]]; }
    else if (kind === 'mangosteen') parts = [[sph(0.1, 0.09, 0.1), col], [(() => { const g = new T.CylinderGeometry(0.055, 0.06, 0.03, 5); g.translate(0, 0.09, 0); return g; })(), '#4a7a2a']];
    else if (kind === 'star') { const sh = new T.Shape(); for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2, rr = i % 2 ? 0.05 : 0.12; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } const g = new T.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); g.translate(0, 0, -0.035); g.rotateX(Math.PI / 2); parts = [[g, col]]; }
    else parts = [[sph(0.1, 0.1, 0.1), col]];
    FRUIT_GEO[key] = mergeGeos(parts); return FRUIT_GEO[key];
  }
  function buildOrchard() {
    const g = new T.Group(), wm = mat('#b88a52', { p: { map: TX.wood, roughness: 0.85 } }), fg = new T.Group(), cx = ORCH.cx, cz = ORCH.cz;
    // 地面：不规则的草地，颜色有深有浅
    const N = 48;
    // 弯弯的小路
    const pm = mat('#c8a46a', { p: { roughness: 1, map: TX.soil } }); for (let z = cz - HOMEL.orchard.r + 2; z < cz + HOMEL.orchard.r - 2; z += 1.2) { const x = ORCH_PATH(z); if (Math.hypot(x - cx, z - cz) > ORCH_R(Math.atan2(z - cz, x - cx)) - 0.5) continue; const st = new T.Mesh(new T.CircleGeometry(0.75 + Math.sin(z) * 0.1, 12), pm); st.rotation.x = -Math.PI / 2; st.position.set(x, 0.02, z); g.add(st); }

    woodSign(g, cx + ORCH_R(0) + 0.6, cz - 1.8, Math.PI, '果园');
    // 小木屋、梯子、果篮、蜂箱、水井
    const hut = new T.Group(); hut.position.set(cx - 7, 0, cz - 7.5); hut.rotation.y = 0.6; g.add(hut); hut.add(mesh(new T.BoxGeometry(2.2, 1.4, 1.8), mat('#c8a070', { p: { map: TX.wood, roughness: 0.85 } }), 0, 0.7, 0)); const rf = mesh(new T.ConeGeometry(1.75, 0.9, 4), mat('#8a4a2a', { p: { roughness: 0.8 } }), 0, 1.85, 0); rf.rotation.y = Math.PI / 4; hut.add(rf); hut.add(mesh(new T.BoxGeometry(0.5, 0.8, 0.02), mat('#5a3a22'), 0, 0.4, 0.91)); OBST.push([cx - 7, cz - 7.5, 1.6]);
    [[cx + 3, cz + 4], [cx - 2, cz - 3], [cx + 5, cz - 6]].forEach(([x, z], i) => { const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = i * 1.3; g.add(b); b.add(mesh(new T.CylinderGeometry(0.28, 0.22, 0.3, 12, 1, true), mat('#b8884a', { p: { roughness: 0.9, map: strawTex(), side: T.DoubleSide } }), 0, 0.15, 0)); for (let k = 0; k < 5; k++) b.add(blob(mat(['#e8352a', '#ff9a1a', '#ff9aa8'][i], { phys: 1, p: { roughness: 0.4 } }), Math.cos(k * 1.3) * 0.12, 0.3, Math.sin(k * 1.3) * 0.12, 0.09, 0.09, 0.09, 10)); });
    { const l = new T.Group(); l.position.set(cx + 1, 0, cz + 7); l.rotation.set(0, 0.4, -0.35); g.add(l); [-0.2, 0.2].forEach(x => l.add(mesh(new T.BoxGeometry(0.05, 2.2, 0.05), wm, x, 1.1, 0))); for (let k = 0; k < 6; k++) l.add(mesh(new T.BoxGeometry(0.42, 0.04, 0.04), wm, 0, 0.3 + k * 0.33, 0)); }
    [[cx - 10, cz + 4], [cx - 10.5, cz + 5.4]].forEach(([x, z]) => { const h = new T.Group(); h.position.set(x, 0, z); g.add(h); h.add(mesh(new T.BoxGeometry(0.6, 0.5, 0.5), mat('#f0e0b0', { p: { map: TX.wood } }), 0, 0.45, 0)); h.add(mesh(new T.BoxGeometry(0.7, 0.06, 0.6), mat('#8a6040'), 0, 0.73, 0)); h.add(mesh(new T.BoxGeometry(0.08, 0.2, 0.08), mat('#8a6040'), 0, 0.1, 0)); });
    { const w = new T.Group(); w.position.set(cx - 3, 0, cz + 9); g.add(w); w.add(mesh(new T.CylinderGeometry(0.6, 0.65, 0.6, 16, 1, true), mat('#9a968c', { p: { map: TX.stone, roughness: 0.9, side: T.DoubleSide } }), 0, 0.3, 0)); const wt = mesh(new T.CircleGeometry(0.55, 16), mat('#3a6a8a', { p: { roughness: 0.1 } }), 0, 0.18, 0); wt.rotation.x = -Math.PI / 2; w.add(wt); [-0.5, 0.5].forEach(x => w.add(mesh(new T.BoxGeometry(0.07, 1.1, 0.07), wm, x, 0.85, 0))); const rf2 = mesh(new T.ConeGeometry(0.85, 0.45, 4), mat('#8a4a2a'), 0, 1.55, 0); rf2.rotation.y = Math.PI / 4; w.add(rf2); OBST.push([cx - 3, cz + 9, 0.8]); }
    const hk = new T.Mesh(new T.CylinderGeometry(HOMEL.orchard.r - 1, HOMEL.orchard.r - 1, 1.6, 24), new T.MeshBasicMaterial({ visible: false })); hk.position.set(cx, 0.8, cz); hk.userData.idx = -32; g.add(hk); hitBoxes.push(hk);
    // 自然撒点：最小间距 2.2，避开小路、小木屋、水井和装饰
    const r = CFG3.rng(424), spots = [], avoid = [[cx - 7, cz - 7.5, 2.4], [cx - 3, cz + 9, 1.6], [cx + 1, cz + 7, 1.2], [cx - 10.2, cz + 4.7, 1.4], [cx + 3, cz + 4, 0.9], [cx - 2, cz - 3, 0.9], [cx + 5, cz - 6, 0.9]];
    for (let it = 0; it < 8000 && spots.length < 220; it++) { const a = r() * 6.28, rr = Math.sqrt(r()) * (ORCH_R(a) - 1.3), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (Math.abs(x - ORCH_PATH(z)) < 1.4) continue; if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue; if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 2.9)) continue; spots.push([x, z, r() * 6.28, 0.88 + r() * 0.24]); }
    // 离大门近的先种
    const ex = cx + ORCH_R(0), ez = cz; spots.sort((p, q) => Math.hypot(p[0] - ex, p[1] - ez) - Math.hypot(q[0] - ex, q[1] - ez)); ORCH_SPOTS = spots;
    RANCH3.trees = { g, inst: {} }; scene.add(g);
  }
  // 每种果树一组实例（树干、树冠、果子），种多少画多少
  function updateTrees(list, t) {
    const TR = RANCH3.trees; if (!TR) return; const byT = {}; list.forEach((r, i) => { if (i < ORCH_SPOTS.length) (byT[r.t] = byT[r.t] || []).push([r, i]); });
    Object.keys(TR.inst).forEach(k => { if (!byT[k]) { const I = TR.inst[k]; I.trunk.count = I.crown.count = I.fruit.count = 0; } });
    const d3 = new T.Object3D(), M = new T.Matrix4(), M2 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
    Object.entries(byT).forEach(([k, arr]) => { const tt = +k, S = TREE_STYLE[tt] || TREE_STYLE[0], def = CFG3.TREES[tt] || CFG3.TREES[0], G = treeGeo(tt); let I = TR.inst[k];
      const need = arr.length; if (!I || I.cap < need) { if (I) [I.trunk, I.crown, I.fruit].forEach(m => TR.g.remove(m)); const cap = Math.max(need, 8);
        const lm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: new T.Color(S.glow || '#000000'), emissiveIntensity: S.glow ? 0.25 : 0 }), fm = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: S.metal ? 0.25 : 0.4, metalness: S.metal ? 0.7 : 0, clearcoat: 0.5, emissive: new T.Color(S.glow || '#000000'), emissiveIntensity: S.glow ? 0.35 : 0 });
        I = { cap, trunk: new T.InstancedMesh(G.trunk, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), cap), crown: new T.InstancedMesh(G.crown, lm, cap), fruit: new T.InstancedMesh(fruitGeo(S.fr, def.col), fm, cap * 8), unripe: null };
        [I.trunk, I.crown, I.fruit].forEach(m => { m.castShadow = true; m.frustumCulled = false; TR.g.add(m); }); TR.inst[k] = I; }
      let nf = 0;
      arr.forEach(([r, i], j) => { const [x, z, rot, vs] = ORCH_SPOTS[i], gk = Math.min(1, r.k), s = (0.3 + 0.7 * gk) * vs * (tt === 17 ? 1.3 : 1) * 1.45, sway = Math.sin(t * 0.8 + i) * 0.025;
        d3.position.set(x, 0, z); d3.rotation.set(sway, rot, sway * 0.7); d3.scale.setScalar(s); d3.updateMatrix(); I.trunk.setMatrixAt(j, d3.matrix); I.crown.setMatrixAt(j, d3.matrix);
        const nfr = gk < 1 ? 0 : r.c >= 1 ? 8 : r.c > 0.5 ? 4 : 0; // 熟了挂满，快熟了挂一半（小一点）
        for (let f = 0; f < nfr && nf < I.cap * 8; f++) { const sp = G.spots[(f * 3 + i) % G.spots.length]; v.set(sp[0], sp[1] - (S.fr === 'mango' || S.fr === 'pear' ? 0.08 : 0), sp[2]).applyMatrix4(d3.matrix); q.setFromEuler(new T.Euler(0, rot + f, 0)); const fsz = s * S.fs * (r.c >= 1 ? 1.15 : 0.75); sc.setScalar(fsz); M.compose(v, q, sc); I.fruit.setMatrixAt(nf++, M); } });
      I.trunk.count = I.crown.count = need; I.fruit.count = nf; [I.trunk, I.crown, I.fruit].forEach(m => { m.instanceMatrix.needsUpdate = true; }); });
  }
  // 由游戏每秒传入：{ lv: { pond, pasture, orchard, ponds }, fish: [{ t, k, ripe }], sheep: [{ t, c }], trees: [{ t, k, c }], herd: { on, dog } }
  const DET = 16; // 前 16 只羊用精细模型，其余用实例化的简化模型
  function setRanch(R) {
    if (!RANCH3.ready || !R) return;
    if (R.lv) { setPastureLv(R.lv.pasture || 1); setPonds(R.lv.ponds || 1); }
    const fk = R.fish.map(f => f.t).join(',') + '|' + RANCH3.ponds, sk = R.sheep.map(s => s.t).join(',') + '|' + PAST.lv;
    if (fk !== RANCH3.fkey) { RANCH3.fkey = fk; RANCH3.fish.forEach(f => scene.remove(f.g)); freeTree(...RANCH3.fish.map(f => f.g)); RANCH3.fish = R.fish.map((f, i) => { const g = buildFish(f.t); scene.add(g); return { g, t: f.t, pond: i % RANCH3.ponds, ph: i * 1.7 + Math.random(), r: 0.45 + ((i * 0.37) % 0.5), sp: 0.25 + Math.random() * 0.2, jump: 2 + Math.random() * 5, jy: -1 }; }); }
    R.fish.forEach((f, i) => { const o = RANCH3.fish[i]; if (o) { o.k = f.k; o.ripe = f.ripe; } });
    if (sk !== RANCH3.skey) { RANCH3.skey = sk; RANCH3.sheep.forEach(s => s.m && scene.remove(s.m.g)); const gone = RANCH3.sheep.filter(s => s.m).map(s => s.m.g); Object.values(RANCH3.inst).forEach(o => { scene.remove(o.body); scene.remove(o.head); if (o.legs) scene.remove(o.legs); gone.push(o.body, o.head, o.legs); }); freeTree(...gone); RANCH3.inst = {};
      const rr = CFG3.rng(sk.length + 7), cnt = {};
      RANCH3.sheep = R.sheep.map((s, i) => { const p = v3(PAST.x0 + 0.8 + rr() * (PAST.x1 - PAST.x0 - 1.6), 0, PAST.z0 + 1.8 + rr() * (PAST.z1 - PAST.z0 - 2.6)); const o = { t: s.t, p, ry: rr() * 6.28, tgt: p.clone(), wait: rr() * 3, graze: 0, ph: rr() * 6, zone: 'in' };
        if (i < DET) { o.m = buildSheep(s.t); o.m.g.position.copy(p); o.m.g.rotation.y = o.ry; scene.add(o.m.g); } else { o.ii = cnt[s.t] = (cnt[s.t] || 0) + 1; o.ii--; } return o; });
      Object.keys(cnt).forEach(t => { const d = CFG3.SHEEP[t], G = sheepGeo(+t); const body = new T.InstancedMesh(G.lo, new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, sheen: 0.5, sheenColor: new T.Color('#ffffff') }), cnt[t]); const head = new T.InstancedMesh(new T.SphereGeometry(0.12, 10, 8), mat(d.face, { p: { roughness: 0.7 } }), cnt[t]);
        const lc = d.alpaca ? new T.Color(d.body).multiplyScalar(0.8).getStyle() : '#2a2224', legG = mergeGeos([[0.2, 0.15], [0.2, -0.15], [-0.2, 0.15], [-0.2, -0.15]].flatMap(([x, z]) => { const c = new T.CapsuleGeometry(0.045, 0.3, 3, 6); c.translate(x, 0.21, z); const h = new T.SphereGeometry(0.05, 6, 4); h.scale(1, 0.6, 1.1); h.translate(x, 0.03, z + 0.01); return [[c, lc], [h, '#1a1414']]; }));
        const legs = new T.InstancedMesh(legG, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), cnt[t]); // 远处成群的羊也要有腿
        [body, head, legs].forEach(m => { m.castShadow = true; m.frustumCulled = false; scene.add(m); }); RANCH3.inst[t] = { body, head, legs }; }); }
    R.sheep.forEach((s, i) => { const o = RANCH3.sheep[i]; if (o) o.c = s.c; });
    const tk = R.trees.map(r => r.t).join(','); if (R.trees.length || RANCH3.tkey) { RANCH3.treeList = R.trees; RANCH3.tkey = tk; }
    RANCH3.herd = R.herd || { on: false };
  }
  function updateRanch(dt, t) {
    // 鱼：分到各个池塘里绕圈游；长大的鱼时不时跳出水面
    RANCH3.fish.forEach((f, i) => { const [px, pz] = PONDS[f.pond] || PONDS[0]; f.ph += dt * f.sp; const a = f.ph, rx = 3.0 * f.r * 1.25, rz = 2.6 * f.r, sg = i % 2 ? 1 : -1, x = px + Math.cos(a) * rx, z = pz + Math.sin(a * sg) * rz;
      const nx = px + Math.cos(a + 0.05) * rx, nz = pz + Math.sin((a + 0.05) * sg) * rz; let y = 0.02 + Math.sin(t * 1.3 + i) * 0.012;
      if (f.ripe) { f.jump -= dt; if (f.jump < 0 && f.jy < 0) { f.jy = 0; f.jump = 4 + Math.random() * 6; spawnSplash(x, z); } if (f.jy >= 0) { f.jy += dt; const k = f.jy / 0.8; y = Math.sin(Math.min(1, k) * Math.PI) * 0.7 - 0.05; if (k >= 1) { f.jy = -1; spawnSplash(x, z); } } }
      f.g.position.set(x, y, z); f.g.rotation.set(0, Math.atan2(-(nz - z), nx - x) + Math.PI, f.jy >= 0 ? Math.cos(f.jy / 0.8 * Math.PI) * 0.8 : 0); f.g.userData.tail.rotation.y = Math.sin(t * 9 + i) * 0.4;
      f.g.scale.setScalar((CFG3.FISH[f.t] || { size: 1 }).size * 2.1 * (0.7 + 0.3 * Math.min(1, f.k || 0))); });
    if (RANCH3.treeList && (RANCH3.tAcc = (RANCH3.tAcc || 0) + dt) > 0.2) { RANCH3.tAcc = 0; updateTrees(RANCH3.treeList, t); }
    // 羊：平时在牧场里吃草溜达。牧羊时：狗把羊群从南门赶出去，沿着路线赶到远处的大草原，换几个地方吃草，再一路赶回来，进圈休息，循环
    const H = RANCH3.herd, SH = RANCH3.sheep, n = SH.length, gw = PAST.gw || 0.9, GI = v3(PAST.cx, 0, PAST.z1 - 1.2), GO = v3(PAST.cx, 0, PAST.z1 + 1.8), FR = 0.55 * Math.sqrt(Math.max(1, n)) + 0.8;
    const clampW = (x, z) => v3(Math.max(-60, Math.min(92, x)), 0, Math.max(-80, Math.min(92, z)));
    const startRoute = () => { const z1 = PAST.z1, cx = PAST.cx, A = v3(0, 0, 0); SH.forEach(s => A.add(s.p)); if (n) A.multiplyScalar(1 / n); else A.copy(GI);
      const S1 = clampW(cx + 2, z1 + 12), S2 = clampW(cx + 22, z1 + 25), S3 = clampW(cx - 6, z1 + 36), S4 = clampW(cx + 10, z1 + 18);
      RANCH3.route = [{ p: GI, narrow: 1 }, { p: GO, narrow: 1 }, { p: S1, g: 35 }, { p: S2, g: 45 }, { p: S3, g: 40 }, { p: S4, g: 0 }, { p: GO.clone().add(v3(0, 0, 3)), g: 0 }, { p: GO, narrow: 1 }, { p: GI, narrow: 1 }, { p: v3(cx, 0, PAST.cz), g: 30, pen: 1 }];
      RANCH3.leg = 0; RANCH3.A = A; RANCH3.wait = 0; RANCH3.D = v3(0, 0, 1); RANCH3.stray = null; RANCH3.strayT = 8; };
    if (H.on && !RANCH3.hOn && n) startRoute(); RANCH3.hOn = H.on;
    if (!H.on && RANCH3.route && RANCH3.leg <= 1) RANCH3.route = null; // 还没出门就结束了
    if (!H.on && RANCH3.route && RANCH3.leg >= 2 && RANCH3.leg <= 5) { RANCH3.leg = 6; RANCH3.wait = 0; } // 牧羊时间到：直接往回赶
    let dogT = null, graze = false, inPen = true; const RT = RANCH3.route;
    if (RT && n) {
      let L = RT[RANCH3.leg]; const A = RANCH3.A, dx = L.p.x - A.x, dz = L.p.z - A.z, d = Math.hypot(dx, dz);
      // 羊群跟不上时锚点放慢
      let lag = 0; SH.forEach(s => { if (s.tgt) lag += Math.hypot(s.p.x - s.tgt.x, s.p.z - s.tgt.z); }); lag /= n;
      if (d > 0.3) { const va = (L.narrow ? 0.8 : 1.25) * (lag > FR * 0.9 ? 0.25 : lag > FR * 0.5 ? 0.6 : 1), st = Math.min(d, dt * va); A.x += dx / d * st; A.z += dz / d * st; RANCH3.D.set(dx / d, 0, dz / d); }
      else if (L.g && (RANCH3.wait += dt) < L.g * (1 + n / 250)) { graze = !L.pen; }
      else { RANCH3.wait = 0; RANCH3.leg++; if (RANCH3.leg >= RT.length) { if (H.on) startRoute(); else RANCH3.route = null; } }
      L = RANCH3.route ? RANCH3.route[RANCH3.leg] : null; inPen = !L || !!L.pen || RANCH3.leg === 0;
      const D = RANCH3.D, P = v3(-D.z, 0, D.x), nearGate = Math.min(A.distanceTo(GI), A.distanceTo(GO)) < 5 || (L && L.narrow), sq = nearGate ? Math.min(1, gw * 0.9 / FR) : 1, stretch = Math.min(6, 1 / sq);
      // 有一只羊跑远了：狗绕到它外侧把它赶回来
      if (graze) { RANCH3.strayT -= dt; if (RANCH3.strayT < 0 && !RANCH3.stray) { RANCH3.strayT = 9 + Math.random() * 8; const s = SH[Math.floor(Math.random() * n)], a = Math.random() * 6.28; s.strayTo = v3(A.x + Math.cos(a) * (FR + 5), 0, A.z + Math.sin(a) * (FR + 5)); RANCH3.stray = s; } } else if (RANCH3.stray) { RANCH3.stray.strayTo = null; RANCH3.stray = null; }
      SH.forEach((s, i) => { const r = Math.sqrt((i + 0.5) / n) * FR, ang = i * 2.39996, u = -Math.abs(Math.cos(ang)) * r * stretch * (nearGate ? 1 : 0.8) + (nearGate ? 0 : Math.cos(ang) * r * 0.3), v = Math.sin(ang) * r * sq;
        if (graze) { if (s.strayTo) { s.tgt.copy(s.strayTo); if (s.p.distanceTo(A) < FR * 0.9 && RANCH3.stray !== s) s.strayTo = null; } else if (!s.gz || s.p.distanceTo(s.tgt) < 0.15 || Math.random() < dt * 0.05) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * FR * 1.3; s.tgt.set(A.x + Math.cos(a) * rr, 0, A.z + Math.sin(a) * rr); s.gz = 1; } }
        else { s.gz = 0; s.tgt.set(A.x + D.x * u + P.x * v, 0, A.z + D.z * u + P.z * v); }
        s.zone = inPen ? 'in' : 'out'; s.path = null; });
      const st = RANCH3.stray;
      if (st && st.strayTo) { const o = v3(st.p.x - A.x, 0, st.p.z - A.z).normalize(); dogT = v3(st.p.x + o.x * 1.6, 0, st.p.z + o.z * 1.6); if (st.p.distanceTo(A) > FR * 1.1 && dogT.distanceTo(herdDogPos() || dogT) < 1.2) { st.strayTo = null; RANCH3.stray = null; } }
      else if (graze) { RANCH3.dang = (RANCH3.dang || 0) + dt * 0.5 / Math.max(1, FR / 3); dogT = v3(A.x + Math.cos(RANCH3.dang) * (FR + 2.4), 0, A.z + Math.sin(RANCH3.dang) * (FR + 2.4)); }
      else if (L && L.pen && d <= 0.3) dogT = v3(GI.x + gw + 0.8, 0, GI.z + 0.4);
      else { const sw = Math.sin(t * 1.3) * FR * 0.9; dogT = v3(A.x - D.x * (FR + 1.8) + P.x * sw, 0, A.z - D.z * (FR + 1.8) + P.z * sw); } // 在羊群后面左右来回压着走
      RANCH3.dogRest = !!(L && L.pen && d <= 0.3);
    } else RANCH3.dogRest = false;
    RANCH3.dogT = dogT; RANCH3.phase = RT ? 'route' : 'idle';
    const dogP = RT ? herdDogPos() : null, routing = !!(RT && n);
    // 分开挤在一起的羊：网格哈希，避免 n² 计算
    const grid = new Map(), cell = p => Math.floor(p.x / 0.6) + ',' + Math.floor(p.z / 0.6); SH.forEach(s => { const k = cell(s.p); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(s); });
    const d3 = new T.Object3D(), used = {};
    SH.forEach((s, i) => { const p = s.p; let spd = 0.4, follow = false;
      if (routing) { const d0 = Math.hypot(p.x - s.tgt.x, p.z - s.tgt.z); if (d0 > (s.gz ? 0.1 : 0.5)) { follow = !s.gz; spd = s.gz ? (s.strayTo ? 1.3 : 0.35) : Math.min(2.4, 0.7 + d0 * 0.6); s.wait = 0; } else { s.wait = s.gz ? 1 + Math.random() * 3 : 0; } if (s.gz && s.wait > 0) s.graze = Math.min(1, s.graze + dt * 2); }
      else if (s.wait > 0) { s.wait -= dt; s.graze = Math.min(1, s.graze + dt * 2); }
      else if (Math.hypot(p.x - s.tgt.x, p.z - s.tgt.z) < 0.08) { s.wait = 2 + Math.random() * 4; s.tgt.set(PAST.x0 + 0.8 + Math.random() * (PAST.x1 - PAST.x0 - 1.6), 0, PAST.z0 + 1.8 + Math.random() * (PAST.z1 - PAST.z0 - 2.8)); }
      let vx = s.tgt.x - p.x, vz = s.tgt.z - p.z; const d = Math.hypot(vx, vz);
      if (dogP) { const ax = p.x - dogP.x, az = p.z - dogP.z, ad = Math.hypot(ax, az); if (ad < 1.8 && ad > 1e-3) { vx += ax / ad * 1.4; vz += az / ad * 1.4; spd = Math.max(spd, 1.4); follow = true; } }
      const vl = Math.hypot(vx, vz); let moving = false;
      if ((s.wait <= 0 || follow) && vl > 0.05 && d > 0.05) { const st = Math.min(d + 0.2, dt * spd); p.x += vx / vl * st; p.z += vz / vl * st; moving = true; s.graze = Math.max(0, s.graze - dt * 3); const da = wrapA0(Math.atan2(-vz, vx) - s.ry); s.ry += da * Math.min(1, dt * 5); }
      const k0 = cell(p).split(','), cx = +k0[0], cz = +k0[1]; for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const a = grid.get((cx + ox) + ',' + (cz + oz)); if (a) for (const o of a) { if (o === s) continue; const dx = p.x - o.p.x, dz = p.z - o.p.z, dd = Math.hypot(dx, dz); if (dd < 0.5 && dd > 1e-3) { p.x += dx / dd * (0.5 - dd) * 0.5; p.z += dz / dd * (0.5 - dd) * 0.5; } } }
      if (!routing || s.zone === 'in' && RANCH3.dogRest) { p.x = Math.max(PAST.x0 + 0.45, Math.min(PAST.x1 - 0.45, p.x)); p.z = Math.max(PAST.z0 + 0.45, Math.min(PAST.z1 - 0.45, p.z)); }
      const fast = follow || spd > 1, bob = moving ? Math.abs(Math.sin(t * (fast ? 14 : 8) + s.ph)) * 0.03 : 0;
      if (s.m) { const g = s.m.g; g.position.copy(p); g.rotation.y = s.ry; const sw = moving ? Math.sin(t * (fast ? 14 : 8) + s.ph) * 0.45 : 0; s.m.legs.forEach((l, j) => l.rotation.z = (j === 0 || j === 3) ? sw : -sw);
        s.m.body.position.y = bob; s.m.head.rotation.z = -s.graze * 0.75; s.m.head.position.y = (CFG3.SHEEP[s.t].alpaca ? 1.18 : 0.7) - s.graze * (CFG3.SHEEP[s.t].alpaca ? 0.15 : 0.12);
        const full = (s.c || 0) >= 1; s.m.mark.visible = full; if (full) s.m.mark.material.opacity = 0.6 + Math.sin(t * 4 + i) * 0.4; s.m.body.children[0].scale.setScalar(0.92 + 0.12 * Math.min(1, (s.c || 0) / CFG3.RANCH.woolMax)); }
      else { const I = RANCH3.inst[s.t]; if (I) { const fl = 0.85 * (0.92 + 0.12 * Math.min(1, (s.c || 0) / CFG3.RANCH.woolMax)), al = CFG3.SHEEP[s.t].alpaca;
        d3.position.set(p.x, 0, p.z); d3.rotation.set(0, s.ry, 0); d3.scale.setScalar(0.85); d3.updateMatrix(); I.legs.setMatrixAt(s.ii, d3.matrix);
        d3.position.set(p.x, bob, p.z); d3.scale.setScalar(fl); d3.updateMatrix(); I.body.setMatrixAt(s.ii, d3.matrix);
        const hx = (al ? 0.46 : 0.45) * 0.85, hy = ((al ? 1.18 : 0.68) - s.graze * 0.25) * 0.85; d3.position.set(p.x + Math.cos(s.ry) * hx, hy + bob, p.z - Math.sin(s.ry) * hx); d3.scale.setScalar(0.85); d3.updateMatrix(); I.head.setMatrixAt(s.ii, d3.matrix); used[s.t] = 1; } }
    });
    Object.values(RANCH3.inst).forEach(I => { I.body.instanceMatrix.needsUpdate = true; I.head.instanceMatrix.needsUpdate = true; if (I.legs) I.legs.instanceMatrix.needsUpdate = true; });
  }
  const wrapA0 = a => Math.atan2(Math.sin(a), Math.cos(a));
  function herdDogPos() { const d = anim.dogs.find(x => x.did === RANCH3.herd.dog && x.g.visible) || anim.dogs.find(x => x.g.visible); return d ? d.g.position : null; }
  function spawnSplash(x, z) { for (let k = 0; k < 6; k++) spawn('drop', v3(x, 0.08, z), v3(rv(-0.8, 0.8), rv(1.2, 2.2), rv(-0.8, 0.8)), 0.6, 0.14, -7); }
  function pondSplash() { const [x, z] = PONDS[Math.floor(Math.random() * RANCH3.ponds)]; spawnSplash(x + rv(-1.5, 1.5), z + rv(-1, 1)); }
  function nearZone() { if (viewMode !== 'walk') return ''; const px = HERO.pos.x, pz = HERO.pos.z;
    for (let i = 0; i < RANCH3.ponds; i++) { const [x, z] = PONDS[i]; if (Math.hypot((px - x) / 1.25, pz - z) < 4.4) return 'pond'; }
    if (px > PAST.x0 - 1.2 && px < PAST.x1 + 0.5 && pz > PAST.z0 - 0.5 && pz < PAST.z1 + 0.5) return 'pasture';
    if (Math.hypot(px - ORCH.cx, pz - ORCH.cz) < ORCH_R(Math.atan2(pz - ORCH.cz, px - ORCH.cx)) + 1.2) return 'orchard'; return ''; }
  /* ---------------- 特效 ---------------- */
  const parts = []; let FXT = {}; const floats = []; let fxLayer;
  function spawn(kind, pos, vel, life, size, grav, spin) { const s = new T.Sprite(new T.SpriteMaterial({ map: FXT[kind], transparent: true, depthWrite: false, blending: kind === 'star' ? T.AdditiveBlending : T.NormalBlending })); s.position.copy(pos); s.scale.setScalar(size); s.renderOrder = 20; scene.add(s); parts.push({ s, v: vel, t: 0, life, g: grav, size, spin: spin || 0 }); }
  const P0 = (i, y) => { const [x, z] = plotXZ(i); return v3(x, (y || 0) + BED_H + (plots[i] ? plots[i].cropH * 0.6 : 0), z); };
  const rv = (a, b) => a + Math.random() * (b - a);
  function heartTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.translate(32, 34); g.fillStyle = '#ff5d7a'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 18); g.bezierCurveTo(-30, -2, -18, -28, 0, -12); g.bezierCurveTo(18, -28, 30, -2, 0, 18); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-9, -9, 5, 3, -0.6, 0, 7); g.fill(); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
  function petDog(k) { const dg = anim.dogs[k]; if (!dg || !dg.g.visible) return false; dg.pet = 2.4; const p = dg.g.position.clone(); p.y += 1.1;
    for (let n = 0; n < 7; n++) setTimeout(() => spawn('heart', p.clone().add(v3(rv(-0.3, 0.3), rv(0, 0.3), rv(-0.3, 0.3))), v3(rv(-0.4, 0.4), rv(1.2, 2), rv(-0.4, 0.4)), 1.4, rv(0.22, 0.34), 0), n * 120); return true; }
  const fx = {
    coins(i, n) { for (let k = 0; k < n; k++) spawn('coin', P0(i, 0.3), v3(rv(-1.8, 1.8), rv(3.5, 5.5), rv(-1.8, 1.8)), rv(0.9, 1.2), 0.34, -11); },
    stars(i, n, col) { for (let k = 0; k < n; k++) spawn('star', P0(i, 0.4), v3(rv(-1.6, 1.6), rv(0.5, 2.5), rv(-1.6, 1.6)), rv(0.6, 1), rv(0.25, 0.45), -1); },
    drops(i) { const [x, z] = plotXZ(i); for (let k = 0; k < 18; k++) spawn('drop', v3(x + rv(-0.8, 0.8), BED_H + rv(1.6, 2.3), z + rv(-0.8, 0.8)), v3(0, -rv(1, 3), 0), rv(0.5, 0.7), 0.18, -9); },
    leaves(i, col) { for (let k = 0; k < 12; k++) spawn(col === 'soil' ? 'soil' : 'leaf', P0(i, 0.1), v3(rv(-2, 2), rv(2, 4), rv(-2, 2)), 0.9, 0.22, -8); },
    puff(i) { for (let k = 0; k < 10; k++) spawn('puff', P0(i, 0), v3(rv(-1.2, 1.2), rv(0.3, 1), rv(-1.2, 1.2)), 0.7, 0.5, 0); },
    text(i, txt, col, size, slot) { const d = document.createElement('div'); d.className = 'ftxt'; d.textContent = txt; d.style.color = col || '#fff'; d.style.fontSize = Math.round((size || 20) * (W < 700 ? 0.8 : 1)) + 'px'; fxLayer.appendChild(d); floats.push({ d, p: P0(i, 0.9 + (slot || 0) * 0.45), t: 0, life: 1.6 }); },
  };
  function updateFx(dt) {
    for (let k = parts.length - 1; k >= 0; k--) { const p = parts[k]; p.t += dt; p.v.y += p.g * dt; p.s.position.addScaledVector(p.v, dt); const a = 1 - p.t / p.life; p.s.material.opacity = Math.min(1, a * 1.8); if (p.s.material.map === FXT.puff) p.s.scale.setScalar(p.size * (1 + p.t * 2)); if (p.t >= p.life) { scene.remove(p.s); p.s.material.dispose(); parts.splice(k, 1); } }
    const v = new T.Vector3();
    for (let k = floats.length - 1; k >= 0; k--) { const f = floats[k]; f.t += dt; const kk = f.t / f.life; v.copy(f.p); v.y += kk * 1.4; v.project(cam); const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H; const sc = kk < 0.12 ? 0.6 + kk / 0.12 * 0.5 : 1.1 - Math.min(0.1, (kk - 0.12) * 0.4); f.d.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${sc})`; f.d.style.opacity = kk < 0.7 ? 1 : 1 - (kk - 0.7) / 0.3; if (f.t >= f.life) { f.d.remove(); floats.splice(k, 1); } }
  }

  /* ---------------- 初始化 ---------------- */
  const CAM_LAND = v3(1, 0.98, 1.05).normalize(), CAM_PORT = v3(1, 1.3, 0.2).normalize(); let CAM_DIR = CAM_LAND.clone(), target = v3(0, 0, 0.4), camDist = 30;
  function fit() {
    const [fx0, fz0] = fieldC(ACTF), pts = []; [-7.6, 7.6].forEach(x => [-5.6, 5.6].forEach(z => [0, 1.4].forEach(y => pts.push(v3(x + fx0, y, z + fz0)))));
    CAM_DIR = (H > W * 1.15 ? CAM_PORT : CAM_LAND).clone(); target.set(fx0, 0, fz0 + (H > W * 1.15 ? 0 : 0.4));
    const sl = safe.l, sr = W - safe.r, st = safe.t, sb = H - safe.b, scx = (sl + sr) / 2, scy = (st + sb) / 2;
    cam.aspect = W / H; cam.clearViewOffset(); cam.setViewOffset(W, H, W / 2 - scx, H / 2 - scy, W, H);
    let lo = 10, hi = 140;
    for (let it = 0; it < 26; it++) { const mid = (lo + hi) / 2; cam.position.copy(target).addScaledVector(CAM_DIR, mid); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); const ok = pts.every(p => { const q = p.clone().project(cam), x = (q.x * 0.5 + 0.5) * W, y = (-q.y * 0.5 + 0.5) * H; return x >= sl && x <= sr && y >= st && y <= sb; }); if (ok) hi = mid; else lo = mid; }
    camDist = hi; applyCam();
  }
  /* v3.3 俯视拖动地图：在当前田的中心上加一个平移量 pan，限制在整个农场（菜地、鱼塘、牧场、果园）范围内 */
  const pan = v3(0, 0, 0), panGoal = { v: null }, eff = v3(0, 0, 0); let PLOTN = 24;
  function worldBox() { const nf = Math.max(1, Math.ceil(PLOTN / CFG3.NPLOTS)); let x0 = Math.min(ORCH.x0, -12), x1 = Math.max(PAST.x1, 12) + 3, z0 = -10, z1 = Math.max(PAST.z1, 20) + 3;
    for (let f = 1; f < nf; f++) { const [x, z] = fieldC(f); x0 = Math.min(x0, x - 9); x1 = Math.max(x1, x + 9); z0 = Math.min(z0, z - 8); }
    for (let i = 0; i < (RANCH3.ponds || 1); i++) { const [x, z] = PONDS[i]; x0 = Math.min(x0, x - 6); z1 = Math.max(z1, z + 6); } return { x0, x1, z0, z1 }; }
  function clampPan() { const b = worldBox(); pan.x = Math.max(b.x0, Math.min(b.x1, target.x + pan.x)) - target.x; pan.z = Math.max(b.z0, Math.min(b.z1, target.z + pan.z)) - target.z; pan.y = 0; }
  function applyCam() { clampPan(); eff.copy(target).add(pan); { const hf = fieldAtXZ(eff.x, eff.z); if (hf >= 0 && hf * 24 < PLOTN) DETF = hf; } cam.position.copy(eff).addScaledVector(CAM_DIR, camDist * zoom); cam.lookAt(eff); cam.updateProjectionMatrix(); if (sun) { sun.target.position.copy(eff); } }
  function panBy(dx, dy) { if (viewMode === 'walk') return; panGoal.v = null; panGoal.s = null; const wpp = 2 * Math.tan(cam.fov * Math.PI / 360) * camDist * zoom / H, rx = CAM_DIR.z, rz = -CAM_DIR.x, rl = Math.hypot(rx, rz) || 1, fl = Math.hypot(CAM_DIR.x, CAM_DIR.z) || 1, el = Math.max(0.35, CAM_DIR.y);
    pan.x -= rx / rl * dx * wpp; pan.z -= rz / rl * dx * wpp; pan.x -= CAM_DIR.x / fl * dy * wpp / el; pan.z -= CAM_DIR.z / fl * dy * wpp / el; applyCam(); }
  function panTo(x, z) { if (viewMode === 'walk') { teleportNear(x, z); return; } panGoal.v = v3(x - target.x, 0, z - target.z); panGoal.s = null; }
  function teleportNear(x, z) { HERO.pos.set(x, 0, z + 4); camFocus.set(x, 1, z + 4); camYaw = 0; }
  function resetView() { panGoal.v = v3(0, 0, 0); panGoal.s = null; zoom = 1; }
  const SPOT = { pond: () => PONDS[0], pasture: () => [PAST.cx, PAST.cz], orchard: () => [ORCH.cx, ORCH.cz], kennel: () => [9.5, 2] };
  // 画质：3 高（默认）2 中 1 低；帧率持续偏低时自动降档
  let quality = /[?&]q=low/.test(location.search) ? 1 : /[?&]q=mid/.test(location.search) ? 2 : 3, grassMesh = null, perf = { t: 0, n: 0, acc: 0 };
  function applyQuality() {
    const mob = W < 820, dpr = window.devicePixelRatio || 1;
    R.setPixelRatio(quality === 3 ? Math.min(dpr, mob ? 1.75 : 2) : quality === 2 ? Math.min(dpr, 1.25) : Math.min(dpr, 0.85));
    R.shadowMap.enabled = quality >= 2; if (sun) { sun.castShadow = quality >= 2; const sz = quality === 3 ? 2048 : 1024; if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }
    if (grassMesh) grassMesh.visible = quality >= 2; if (scene && perf.shadowOn !== R.shadowMap.enabled) { perf.shadowOn = R.shadowMap.enabled; scene.traverse(o => { if (o.isMesh && o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }   /* 只有阴影开关变了才需要重编着色器 */
    R.setSize(W, H, false);
  }
  function resize() {
    if (ZONE && ZONE.resize) ZONE.resize(window.innerWidth, window.innerHeight);
    W = window.innerWidth; H = window.innerHeight; const mob = W < 820;
    const port = H > W * 1.15; Object.assign(safe, port ? { l: 46, r: 58, t: 120, b: 96 } : mob ? { l: 54, r: 64, t: 70, b: 92 } : { l: 84, r: 104, t: 84, b: 112 });
    applyQuality(); if (viewMode === 'walk') { cam.aspect = W / H; cam.updateProjectionMatrix(); } else fit();
  }
  /* 自动画质（2026-10-26 改）：以前 2.5 秒平均超过 45 毫秒就降一级、永不恢复，而且每次降级所有材质重编着色器（本身又是一次大卡顿），容易一路降到最低，画面发糊。
     现在：用真实时间、去掉偶发的长帧（编译、加载、切后台），连续 3 个窗口都慢才降一级；连续 4 个窗口都快就升回去（不超过初始画质）；刚调整过的下一个窗口不算 */
  const QMAX = quality;
  function perfTick() { const now = performance.now(), d = now - (perf.last || now); perf.last = now; if (d <= 0 || d > 250 || document.hidden) return; perf.f = perf.f || []; perf.f.push(d); perf.acc += d;
    if (perf.acc < 2500) return; const f = perf.f.sort((a, b) => a - b), med = f[Math.floor(f.length / 2)]; perf.f = []; perf.acc = 0; if (perf.skip) { perf.skip--; return; }
    if (med > 40) { perf.bad = (perf.bad || 0) + 1; perf.good = 0; } else if (med < 21) { perf.good = (perf.good || 0) + 1; perf.bad = 0; } else { perf.bad = perf.good = 0; }
    if (perf.bad >= 3 && quality > 1) { quality--; perf.bad = 0; perf.skip = 1; applyQuality(); }
    else if (perf.good >= 4 && quality < QMAX) { quality++; perf.good = 0; perf.skip = 1; applyQuality(); } }
  let theme = null;
  function setTheme(th) { if (!anim.house || !th) return; if (theme === th.roof + th.wall) return; theme = th.roof + th.wall; anim.house.roofM.color.set(th.roof); anim.house.wallM.color.set(th.wall).lerp(new T.Color('#ffffff'), 0.25); }
  /* =====================================================
     漫游模式：可操控的 3D 人物（走 / 跑 / 跳），第三人称镜头跟随
     - 移动方向相对于镜头；田埂可以踩上去；房子、风车、树、池塘会挡路；篱笆挡路但能跳过去
     ===================================================== */
  const OBST = []; // 圆形障碍物 [x, z, 半径]
  const FENCE_X = 8.2, FENCE_Z = 6.0, GATE = 1.6;
  const FENCE = []; /* 院子篱笆已去掉（2026-10-26） */
  const HERO = { g: null, p: null, pos: v3(0, 0, 8.6), y: 0, vy: 0, face: Math.PI, phase: 0, spd: 0, ground: true, lookKey: '' };
  let viewMode = 'top', camYaw = 0, camPitch = 0.42, camDistW = 6.4, camDrag = 0, nearIdx = -1, nearDog = -1;
  const camFocus = v3(0, 1, 9.5), input = { x: 0, z: 0, run: false, jump: false };
  // 王者农场风格的 Q 版小农夫：大头、大眼睛、腮红、草帽、背带裤（头和身体用 SDF 生成平滑网格）
  const HERO_GEO = {};
  function strawTex() { const c = mkCanvas(128), x = c.getContext('2d'); x.fillStyle = '#e8c97e'; x.fillRect(0, 0, 128, 128); const r = CFG3.rng(5);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const o = (i + j) % 2; x.fillStyle = o ? 'rgba(160,110,40,0.28)' : 'rgba(255,240,190,0.35)'; x.fillRect(i * 8 + (o ? 0 : 1), j * 8 + 1, 7, 6); }
    for (let k = 0; k < 60; k++) { x.strokeStyle = `rgba(140,90,30,${0.1 + r() * 0.15})`; x.beginPath(); const y = r() * 128; x.moveTo(0, y); x.lineTo(128, y + (r() - 0.5) * 6); x.stroke(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.repeat.set(4, 1); return t; }
  function heroGeo(look) {
    const key = [look.skin, look.hair, look.shirt, look.pants, look.hat].join(); if (HERO_GEO[key]) return HERO_GEO[key];
    const cSkin = new T.Color(look.skin), cHair = new T.Color(look.hair), cHairL = cHair.clone().lerp(new T.Color('#ffffff'), 0.18), cShirt = new T.Color(look.shirt), cPants = new T.Color(look.pants), cPantsD = cPants.clone().multiplyScalar(0.8);
    // 身体（髋部为原点）：圆滚滚的上身 + 背带裤
    const torso = (x, y, z) => { let d = sEll(x, y, z, [0, 0.17, 0], [0.205, 0.21, 0.165]); d = smin(d, sEll(x, y, z, [0, 0.33, 0], [0.175, 0.12, 0.14]), 0.06); d = smin(d, sEll(x, y, z, [0, 0.03, 0], [0.19, 0.1, 0.15]), 0.05); return d; };
    const torsoCol = (x, y, z, c) => { const bib = Math.abs(x) < 0.115 && z > 0.02 && y < 0.31, strap = Math.abs(Math.abs(x) - 0.095) < 0.028 && y >= 0.28, pants = y < 0.16 || bib || strap;
      c.copy(pants ? cPants : cShirt); if (pants && (Math.abs(y - 0.16) < 0.012 && !bib)) c.copy(cPantsD); if (bib && Math.abs(Math.abs(x) - 0.115) < 0.01) c.copy(cPantsD); };
    // 头：大而圆，带一点肉嘟嘟的脸颊
    const head = (x, y, z) => { let d = sEll(x, y, z, [0, 0, 0], [0.3, 0.285, 0.28]); d = smin(d, sEll(x, y, z, [0.13, -0.11, 0.13], [0.11, 0.1, 0.11]), 0.05); d = smin(d, sEll(x, y, z, [-0.13, -0.11, 0.13], [0.11, 0.1, 0.11]), 0.05);
      d = smin(d, sEll(x, y, z, [0.29, -0.02, 0], [0.045, 0.06, 0.035]), 0.02); d = smin(d, sEll(x, y, z, [-0.29, -0.02, 0], [0.045, 0.06, 0.035]), 0.02); return d; };
    const headCol = (x, y, z, c) => { c.copy(cSkin); };
    // 头发：头顶一层壳，前面切出刘海，后面盖到后脑
    const hair = (x, y, z) => { let d = sEll(x, y, z, [0, 0.02, -0.015], [0.33, 0.3, 0.315]); d = smin(d, sEll(x, y, z, [0.24, -0.12, 0.04], [0.07, 0.15, 0.09]), 0.04); d = smin(d, sEll(x, y, z, [-0.24, -0.12, 0.04], [0.07, 0.15, 0.09]), 0.04); // 两侧鬓发
      const face = sEll(x, y, z, [0, -0.13, 0.2], [0.27, 0.22, 0.3]); d = smax(d, -face, 0.03);
      // 刘海的波浪边
      const fr = sEll(x, y, z, [0, 0.2, 0.16], [0.3, 0.1 + 0.025 * Math.cos(x * 34), 0.2]); d = smin(d, smax(fr, sEll(x, y, z, [0, 0.03, -0.015], [0.33, 0.315, 0.315]), 0.01), 0.02);
      d = smax(d, -(y + 0.2), 0.03); // 后面到后颈
      d = smax(d, -sEll(x, y, z, [0, 0, 0], [0.295, 0.28, 0.275]), 0.005);
      if (!look.hat) d = smin(d, sCap(x, y, z, [0, 0.3, 0.02], [0.05, 0.4, 0.1], 0.03, 0.008), 0.03); // 呆毛
      return d; };
    const hairCol = (x, y, z, c) => { c.copy(cHair).lerp(cHairL, sst(0.12, 0.3, y) * 0.6); };
    const G = { torso: sdfMesh(torso, 0, 0.2, 0, 0.3, 40, torsoCol), head: sdfMesh(head, 0, -0.02, 0, 0.36, 46, headCol), hair: sdfMesh(hair, 0, 0.03, 0, 0.38, 46, hairCol) };
    HERO_GEO[key] = G; return G;
  }
  function buildHero(look) {
    look = Object.assign({ skin: '#f2c89a', hair: '#2a1a10', shirt: '#4a8fd8', band: '#d9553a', hat: 1, pants: '#3a6ab0' }, look || {});
    if (look.pants === '#3a4660') look.pants = '#3a6ab0';
    const G = heroGeo(look);
    const g = new T.Group(), cloth = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, sheen: 0.15, sheenRoughness: 0.6, sheenColor: new T.Color('#ffffff') });
    const skin = new T.MeshPhysicalMaterial({ color: new T.Color(look.skin), roughness: 0.6, sheen: 0.3, sheenColor: new T.Color('#ffd8c8') }), skinV = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, sheen: 0.3, sheenColor: new T.Color('#ffd8c8') });
    const hairM = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.5 });
    const pantsM = mat(look.pants, { p: { roughness: 0.85 } }), shirtM = mat(look.shirt, { p: { roughness: 0.85 } }), boot = mat('#7a4a2a', { p: { roughness: 0.6 } }), sole = mat('#3a2416', { p: { roughness: 0.8 } });
    const ink = new T.MeshStandardMaterial({ color: new T.Color('#2a1a14'), roughness: 0.25 }), white = new T.MeshBasicMaterial({ color: 0xffffff }), btn = mat('#ffd24a', { phys: 1, p: { roughness: 0.3, metalness: 0.4 } });
    const root = new T.Group(); root.scale.setScalar(0.92); g.add(root);
    const body = new T.Group(); body.position.y = 0.39; root.add(body);
    const tor = new T.Mesh(G.torso, cloth); tor.castShadow = true; body.add(tor);
    [-0.07, 0.07].forEach(x => { const b = blob(btn, x, 0.29, 0.135, 0.018, 0.018, 0.01, 10); body.add(b); }); // 背带扣
    const collarM = mat('#ffffff', { p: { roughness: 0.8 } }); [-1, 1].forEach(sd => { const c = blob(collarM, sd * 0.06, 0.445, 0.085, 0.07, 0.022, 0.05, 12); c.rotation.set(0.5, sd * 0.4, sd * 0.5); body.add(c); }); // 白色小翻领
    const pocket = mesh(new T.BoxGeometry(0.1, 0.06, 0.01), mat(new T.Color(look.pants).multiplyScalar(0.85).getStyle(), { p: { roughness: 0.9 } }), 0, 0.2, 0.158); body.add(pocket);
    // 腿：短短的，穿小靴子
    const leg = x => { const L = new T.Group(); L.position.set(x, 0.04, 0); const p = mesh(new T.CapsuleGeometry(0.08, 0.09, 4, 12), pantsM, 0, -0.1, 0); L.add(p); L.add(mesh(new T.CylinderGeometry(0.088, 0.088, 0.05, 14), mat(new T.Color(look.pants).lerp(new T.Color('#ffffff'), 0.25).getStyle(), { p: { roughness: 0.85 } }), 0, -0.2, 0)); // 卷起的裤脚
      const b = new T.Group(); b.position.set(0, -0.27, 0.025); b.add(blob(boot, 0, 0.02, 0.012, 0.096, 0.08, 0.13, 16)); b.add(blob(sole, 0, -0.035, 0.014, 0.098, 0.026, 0.132, 14)); b.add(mesh(new T.CylinderGeometry(0.07, 0.078, 0.07, 14), boot, 0, 0.07, -0.01)); L.add(b); body.add(L); return L; };
    const legL = leg(-0.088), legR = leg(0.088);
    // 手臂：短袖 + 圆手
    const arm = sd => { const A = new T.Group(); A.position.set(sd * 0.185, 0.35, 0); A.add(blob(shirtM, sd * 0.012, -0.03, 0, 0.075, 0.08, 0.075, 14)); A.add(mesh(new T.CapsuleGeometry(0.048, 0.1, 4, 10), skin, sd * 0.02, -0.14, 0)); A.add(blob(skin, sd * 0.025, -0.235, 0.005, 0.062, 0.066, 0.058, 14)); A.add(blob(skin, sd * 0.012, -0.215, 0.05, 0.024, 0.03, 0.022, 10)); /* 手和大拇指 */ A.rotation.z = sd * 0.12; body.add(A); return A; };
    const armL = arm(-1), armR = arm(1);
    // 头
    const head = new T.Group(); head.position.set(0, 0.66, 0); body.add(head);
    const hm = new T.Mesh(G.head, skinV); hm.castShadow = true; head.add(hm); const hh = new T.Mesh(G.hair, hairM); hh.castShadow = true; head.add(hh);
    // 大眼睛（深色眼珠 + 两个高光）、眉毛、腮红、小嘴
    const eyes = [];
    [-1, 1].forEach(sd => { const e = new T.Group(); e.position.set(sd * 0.105, -0.035, 0.258); e.rotation.y = sd * 0.38; head.add(e);
      const ball = new T.Mesh(sphereG(20, 14), ink); ball.scale.set(0.052, 0.07, 0.022); e.add(ball);
      const iris = new T.Mesh(sphereG(16, 10), new T.MeshStandardMaterial({ color: new T.Color('#5a3418'), roughness: 0.3 })); iris.scale.set(0.034, 0.042, 0.01); iris.position.set(0, -0.016, 0.016); e.add(iris);
      const g1 = new T.Mesh(sphereG(10, 8), white); g1.scale.set(0.018, 0.022, 0.006); g1.position.set(sd * -0.014, 0.025, 0.021); e.add(g1);
      const g2 = new T.Mesh(sphereG(8, 6), white); g2.scale.setScalar(0.008); g2.position.set(sd * 0.016, -0.03, 0.021); e.add(g2);
      const lash = new T.Mesh(new T.TorusGeometry(0.05, 0.006, 5, 14, Math.PI * 0.8), ink); lash.position.set(0, 0.012, 0.012); lash.rotation.z = Math.PI * 0.1; lash.scale.set(1.05, 1.32, 1); e.add(lash); // 上眼线
      const ls = mesh(new T.CapsuleGeometry(0.004, 0.022, 2, 4), ink, sd * 0.05, 0.065, 0.01); ls.rotation.z = -sd * 0.9; e.add(ls); // 眼角的小睫毛
      eyes.push(e);
      const br = mesh(new T.CapsuleGeometry(0.008, 0.045, 3, 6), mat(new T.Color(look.hair).multiplyScalar(0.8).getStyle()), sd * 0.105, 0.075, 0.262); br.rotation.set(0, sd * 0.38, Math.PI / 2 + sd * 0.12); head.add(br);
      const bl = new T.Mesh(sphereG(14, 10), new T.MeshBasicMaterial({ color: 0xff8a9a, transparent: true, opacity: 0.55, depthWrite: false })); bl.scale.set(0.05, 0.028, 0.01); bl.position.set(sd * 0.175, -0.125, 0.225); bl.rotation.y = sd * 0.62; head.add(bl);
    });
    const mouth = new T.Mesh(new T.TorusGeometry(0.03, 0.007, 6, 14, Math.PI), new T.MeshStandardMaterial({ color: new T.Color('#b0403a'), roughness: 0.5 })); mouth.position.set(0, -0.135, 0.272); mouth.rotation.set(-0.15, 0, Math.PI); head.add(mouth);
    head.add(blob(mat(new T.Color(look.skin).multiplyScalar(0.92).getStyle()), 0, -0.075, 0.287, 0.014, 0.011, 0.01, 8)); // 小鼻子
    // 大草帽：宽帽檐微微下垂 + 帽带 + 小花
    if (look.hat) { const sm = mat('#ffffff', { p: { map: strawTex(), roughness: 0.92, side: T.DoubleSide } });
      const hat = new T.Group(); hat.position.set(0, 0.11, -0.015); hat.rotation.x = -0.16; head.add(hat);
      const crown = mesh(lathe([[0, 0.25], [0.14, 0.245], [0.25, 0.21], [0.3, 0.13], [0.32, 0.04], [0.325, 0]], 32), sm); hat.add(crown);
      const brim = mesh(lathe([[0.31, 0.02], [0.42, 0.0], [0.53, -0.045], [0.59, -0.08], [0.6, -0.095], [0.58, -0.09], [0.52, -0.06], [0.42, -0.02], [0.31, 0.0]], 44), sm); hat.add(brim);
      const band = mesh(new T.CylinderGeometry(0.322, 0.33, 0.07, 32, 1, true), mat(look.band, { p: { roughness: 0.7, side: T.DoubleSide } }), 0, 0.045, 0); hat.add(band);
      const fl = new T.Group(); fl.position.set(0.24, 0.06, 0.2); fl.rotation.set(0, 0.9, 0); hat.add(fl); const pm = mat('#ffffff', { p: { roughness: 0.6 } });
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; fl.add(blob(pm, Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0, 0.024, 0.024, 0.01, 10)); } fl.add(blob(mat('#ffcc2a'), 0, 0, 0.008, 0.016, 0.016, 0.01, 8)); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    // 脚下的光圈：漫游时方便找到自己
    const ring = new T.Mesh(new T.RingGeometry(0.34, 0.42, 32), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    HERO.p = { body, legL, legR, armL, armR, head, ring, eyes, baseY: 0.39, blink: 2 };
    return g;
  }
  function setHero(look) {
    const k = JSON.stringify(look || {}); if (HERO.lookKey === k && HERO.g) return; HERO.lookKey = k;
    const was = HERO.g; HERO.g = buildHero(look); HERO.g.visible = true; if (was) { scene.remove(was); } scene.add(HERO.g); ncAttachHero();
  }
  /* ---------- 新角色：美术骨骼模型（lib/entity3.js）----------
     设置里打开「新角色模型」后，主人（男主角或 14 位女主角之一）、福旺、睿宝换成美术模型；位置、朝向、碰撞、点击仍由原来的逻辑控制，只换外观和动作。
     v4 起美术交了走 / 跑 / 跳和狗的坐 / 趴 / 睡 / 小跑 / 奔跑，按实测步幅调动作快慢；还缺的动作（女主角的跑和跳）按回退表顶上。关掉恢复代码拼的模型。 */
  const NC = { on: false, lib: null, hero: null, heroId: '', dogs: {}, busy: null }, NC_DOGS = { fuwang: 'v4_dog_fuwang', ruibao: 'v4_dog_ruibao' };
  const NC_SCALE = { hero: 0.8, dog: 1.1 }; /* 原模型是 Q 版比例（人 1.25 m、狗 1.1 m）；新模型人 1.6 m、狗 0.78 m。人缩到和原来一样高，狗放大一点，免得在镜头里太小 */
  const NC_HERO_DEFAULT = 'v4_hero_boy', ncHeroOk = id => !!(GAMECFG.ASSETS.find(a => a.id === id && a.kind === 'hero'));
  function ncAttachHero() { if (!HERO.g) return; const r = NC.hero; HERO.g.children.forEach(c => { if (c !== HERO.p.ring && (!r || c !== r.wrap)) c.visible = false; });   /* 2026-10-26 甲方：不要原始小人。美术模型没加载好时只显示脚下的光圈 */ if (r && r.wrap.parent !== HERO.g) HERO.g.add(r.wrap); }
  function ncAttachDog(dg) { const r = NC.dogs[dg.did] || null; dg.torso.visible = !r; dg.rig = r; if (r) { if (r.wrap.parent !== dg.g) dg.g.add(r.wrap); r.wrap.scale.setScalar(NC_SCALE.dog / (dg.g.scale.x || 1)); } dg.tag.position.y = r ? 1.12 : 1.42; }
  function ncDrop(r) { if (!r) return; if (r.wrap.parent) r.wrap.parent.remove(r.wrap); Entity3.release(NC.lib, r.rig, true); }
  async function setNewChar(on, heroId) {
    NC.on = !!on; heroId = ncHeroOk(heroId) ? heroId : NC_HERO_DEFAULT;
    if (!NC.on) { ncDrop(NC.hero); NC.hero = null; NC.heroId = ''; Object.values(NC.dogs).forEach(ncDrop); NC.dogs = {}; ncAttachHero(); anim.dogs.forEach(ncAttachDog); return true; }
    if (NC.hero && NC.heroId === heroId) return true;
    if (NC.busy) await NC.busy.catch(() => { }); if (!NC.on) return false; if (NC.hero && NC.heroId === heroId) return true;
    NC.busy = (async () => {
      await needScripts(LAZY_CHAR); if (!NC.on) return false;
      if (typeof Entity3 === 'undefined' || typeof Assets3 === 'undefined') throw new Error('资源模块没有加载');
      if (!NC.lib) NC.lib = new Assets3({ manifest: GAMECFG.ASSETS });
      const needDogs = !Object.keys(NC.dogs).length;
      const [h, ...ds] = await Promise.all([Entity3.spawn(NC.lib, heroId, 'hero', { tier: '1k' })].concat(needDogs ? Object.values(NC_DOGS).map(id => Entity3.spawn(NC.lib, id, 'dog', { tier: '1k' })) : []));
      if (!NC.on) { Entity3.release(NC.lib, h, true); ds.forEach(d => Entity3.release(NC.lib, d, true)); return false; }
      if (NC.hero) ncDrop(NC.hero);
      const hw = new T.Group(); hw.add(h.object); hw.scale.setScalar(NC_SCALE.hero); h.play('idle', 0); NC.hero = { rig: h, wrap: hw }; NC.heroId = heroId;
      Object.keys(NC_DOGS).forEach((k, i) => { const d = ds[i]; if (!d) return; const dw = new T.Group(); dw.add(d.object); dw.rotation.y = Math.PI / 2; d.play('idle', 0); if (d.inst.mixer) d.inst.mixer.setTime(Math.random() * 2); NC.dogs[k] = { rig: d, wrap: dw }; });
      anim.dogs.forEach(dg => { dg.rig = null; }); ncAttachHero(); anim.dogs.forEach(ncAttachDog); return true;
    })();
    try { return await NC.busy; } finally { NC.busy = null; }
  }
  function resetHero() { HERO.pos.set(0, 0, 8.6); HERO.y = 0; HERO.vy = 0; HERO.face = Math.PI; camYaw = 0; camFocus.set(0, 1, 8.6); }
  function groundAt(x, z) { const f = fieldAtXZ(x, z); if (f < 0 || f * 24 >= plots.length || !plots[f * 24].node.visible) return terrainH(x, z); for (let i = f * 24; i < f * 24 + 24; i++) { const [px, pz] = plotXZ(i); if (Math.abs(x - px) < PLOT / 2 - 0.04 && Math.abs(z - pz) < PLOT / 2 - 0.04) return BED_H; } return 0; }
  function collide(p, y) {
    const R0 = 0.32;
    OBST.concat(BOBST).forEach(([ox, oz, r]) => { const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz), m = r + R0; if (d < m && d > 1e-4) { p.x = ox + dx / d * m; p.z = oz + dz / d * m; } });
    for (let i = 0; i < RANCH3.ponds; i++) { const [ox, oz] = PONDS[i], dx = (p.x - ox) / 1.25, dz = p.z - oz, d = Math.hypot(dx, dz); if (d < 3.3) { const k = 3.3 / Math.max(d, 1e-4); p.x = ox + dx * k * 1.25; p.z = oz + dz * k; } } // 池塘
    if (y < 0.8) FENCE.concat(PFENCE, BSEG).forEach(([x0, z0, x1, z1]) => { const vx = x1 - x0, vz = z1 - z0, L2 = vx * vx + vz * vz, t = Math.max(0, Math.min(1, ((p.x - x0) * vx + (p.z - z0) * vz) / L2)), cx = x0 + vx * t, cz = z0 + vz * t, dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz); if (d < 0.28) { const nx = d > 1e-4 ? dx / d : -vz / Math.sqrt(L2), nz = d > 1e-4 ? dz / d : vx / Math.sqrt(L2); p.x = cx + nx * 0.28; p.z = cz + nz * 0.28; } });
    p.x = Math.max(-WORLD_R, Math.min(WORLD_R, p.x)); p.z = Math.max(-WORLD_R, Math.min(WORLD_R, p.z)); // 世界边界（2026-10-26 扩大 10 倍）
    { const tl = WILD.hash.get(Math.floor(p.x / 10) + ',' + Math.floor(p.z / 10)); if (tl) tl.forEach(([ox, oz, r]) => { const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz), m = r + R0; if (d < m && d > 1e-4) { p.x = ox + dx / d * m; p.z = oz + dz / d * m; } }); } /* 野外的树 */
  }
  function updateHero(dt) {
    if (!HERO.g) return; const P = HERO.p;
    // 输入方向（相对镜头）
    const walkOn = viewMode === 'walk'; let ix = walkOn ? input.x : 0, iz = walkOn ? input.z : 0; if (!walkOn) input.jump = false; const mag = Math.min(1, Math.hypot(ix, iz)); if (mag > 1) { const l0 = Math.hypot(ix, iz); ix /= l0; iz /= l0; }
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    const mx = ix * cy + iz * sy, mz = -ix * sy + iz * cy; // 镜头前方为 -z（屏幕上方）
    const want = mag > 0.05 ? (NC.hero ? (input.run || mag > 0.92 ? 4.4 : 3.0) : (input.run || mag > 0.92 ? 6.2 : 3.4)) * Math.max(0.35, mag) : 0; /* 美术模型按真实步幅，跑得太快脚会打滑，所以稍微慢一点 */
    HERO.spd += (want - HERO.spd) * Math.min(1, dt * 10);
    // 先转身再走：人物总是朝着自己面对的方向前进（不会倒退、不会横着走），转身很快；要掉头时先原地转过来
    let turnK = 1;
    if (mag > 0.05) { const f = Math.atan2(mx, mz); let d = f - HERO.face; d = Math.atan2(Math.sin(d), Math.cos(d)); const mt = dt * 15; HERO.face += Math.max(-mt, Math.min(mt, d * Math.min(1, dt * 14 + 0.25))); const left = Math.abs(Math.atan2(Math.sin(f - HERO.face), Math.cos(f - HERO.face))); turnK = left > 1.4 ? 0.05 : Math.max(0.2, Math.cos(left)); }
    if (mag > 0.05 || HERO.spd > 0.05) { // 分小步移动，低帧率时也不会穿过篱笆
      const fx = Math.sin(HERO.face), fz = Math.cos(HERO.face), dist = HERO.spd * turnK * dt, n = Math.max(1, Math.ceil(dist / 0.12));
      for (let k = 0; k < n; k++) { const ox = HERO.pos.x, oz = HERO.pos.z; HERO.pos.x += fx * dist / n; HERO.pos.z += fz * dist / n; collide(HERO.pos, HERO.y); if (terrainH(HERO.pos.x, HERO.pos.z) < -0.55) { HERO.pos.x = ox; HERO.pos.z = oz; } } /* 湖里不能走 */
    } else collide(HERO.pos, HERO.y);
    // 跳跃与重力
    const gY = groundAt(HERO.pos.x, HERO.pos.z);
    if (input.jump && HERO.ground) { HERO.vy = 7.4; HERO.ground = false; }
    input.jump = false;
    HERO.vy -= 21 * dt; HERO.y += HERO.vy * dt;
    if (HERO.y <= gY) { if (!HERO.ground && HERO.vy < -4) HERO.land = 0.18; HERO.y = gY; HERO.vy = 0; HERO.ground = true; } else if (HERO.y > gY + 0.05) HERO.ground = false;
    HERO.g.position.set(HERO.pos.x, HERO.y, HERO.pos.z);
    { const tr = HERO.trail || (HERO.trail = []), l = tr[tr.length - 1]; if (!l || Math.hypot(l.x - HERO.pos.x, l.z - HERO.pos.z) > 0.35) { tr.push(v3(HERO.pos.x, 0, HERO.pos.z)); if (tr.length > 80) tr.shift(); } } /* 主人走过的路（跟随的狗沿着走，不穿篱笆） */
    HERO.g.rotation.y = HERO.face; // 人物朝向（v3.1 时被上一行的注释吞掉了，导致人物一直朝着一个方向）
    // 动作
    const run = HERO.spd > 4.6, moving = HERO.spd > 0.3;
    HERO.phase += dt * (run ? 11 : 7.5) * (moving ? 1 : 0);
    const amp = moving ? (run ? 0.95 : 0.6) * Math.min(1, HERO.spd / 3) : 0, s = Math.sin(HERO.phase);
    if (!HERO.ground) { P.legL.rotation.x = -0.6; P.legR.rotation.x = 0.35; P.armL.rotation.x = -2.4; P.armR.rotation.x = -2.2; P.armL.rotation.z = -0.35; P.armR.rotation.z = 0.35; P.body.rotation.x = 0.08; }
    else { P.legL.rotation.x = s * amp; P.legR.rotation.x = -s * amp; P.armL.rotation.x = -s * amp * 0.85; P.armR.rotation.x = s * amp * 0.85; P.armL.rotation.z = -0.14; P.armR.rotation.z = 0.14; P.body.rotation.x = run ? 0.18 : moving ? 0.06 : 0; }
    HERO.land = Math.max(0, (HERO.land || 0) - dt);
    P.blink -= dt; const bk = P.blink < 0.12 ? 0.12 : 1; if (P.blink < 0) P.blink = 2 + Math.random() * 3; P.eyes.forEach(e => e.scale.y = bk); // 眨眼
    P.body.position.y = P.baseY + (HERO.ground ? Math.abs(s) * 0.03 * amp - HERO.land * 0.4 : 0) + (!moving && HERO.ground ? Math.sin(tNow * 2) * 0.008 : 0);
    P.head.rotation.y = !moving ? Math.sin(tNow * 0.5) * 0.25 : 0;
    P.ring.material.opacity = 0.35 + Math.sin(tNow * 3) * 0.15; P.ring.position.y = gY - HERO.y + 0.02;
    if (NC.hero) { const r = NC.hero.rig; r.play(!HERO.ground ? 'jump_air' : HERO.spd > 2.2 ? 'run' : moving ? 'walk' : 'idle'); r.pace(HERO.spd, NC_SCALE.hero); r.update(dt); if (r.faked) r.heroGait({ phase: HERO.phase, amp: amp * 0.9, air: !HERO.ground, lean: run ? 0.12 : moving ? 0.05 : 0 }); const lb = r.liven() * NC_SCALE.hero; NC.hero.wrap.position.y = HERO.ground && r.faked ? Math.abs(s) * 0.015 * amp : HERO.ground ? lb : 0; }
    // 附近的地块（优先面前的）
    let best = -1, bd = 1e9; const fx = Math.sin(HERO.face), fz = Math.cos(HERO.face);
    const hf = fieldAtXZ(HERO.pos.x, HERO.pos.z); if (hf >= 0 && hf !== ACTF && hf * 24 < plots.length) ACTF = hf; // 走进哪片田，哪片田就用精细模型
    if (hf >= 0 && hf * 24 < plots.length && plots[hf * 24].node.visible) for (let i = hf * 24; i < hf * 24 + 24; i++) { const [px, pz] = plotXZ(i), dx = px - HERO.pos.x, dz = pz - HERO.pos.z, d = Math.hypot(dx, dz); if (d > 1.9) continue; const sc = d - (d > 0.05 ? (dx * fx + dz * fz) / d * 0.5 : 0.5); if (sc < bd) { bd = sc; best = i; } }
    nearIdx = best;
    let nd = -1, ndd = 1.7; anim.dogs.forEach((dg, k) => { if (!dg.g.visible) return; const d = Math.hypot(dg.g.position.x - HERO.pos.x, dg.g.position.z - HERO.pos.z); if (d < ndd) { ndd = d; nd = k; } }); nearDog = nd;
  }
  function updateWalkCam(dt) {
    const want = v3(HERO.pos.x, HERO.y * 0.6 + 0.95, HERO.pos.z); camFocus.lerp(want, 1 - Math.exp(-dt * 8));
    // 走动时镜头慢慢转到人物身后（往镜头方向走时不转，刚拖过镜头 1.5 秒内也不转）
    camDrag = Math.max(0, camDrag - dt);
    if (HERO.spd > 1 && !camDrag) { let d = HERO.face + Math.PI - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.25) camYaw += d * Math.min(1, dt * 1.5 * Math.min(1, HERO.spd / 3.4) * (1 - Math.abs(d) / 1.6)); } // 走动时镜头慢慢转到身后；正朝镜头走时不转
    const cp = Math.cos(camPitch), off = v3(Math.sin(camYaw) * cp, Math.sin(camPitch), Math.cos(camYaw) * cp).multiplyScalar(camDistW);
    cam.position.copy(camFocus).add(off); if (cam.position.y < 0.6) cam.position.y = 0.6; cam.lookAt(camFocus); target.copy(camFocus); if (sun) sun.target.position.copy(camFocus);
  }
  function setMode(m) {
    viewMode = m === 'walk' ? 'walk' : 'top'; if (HERO.g) HERO.g.visible = true; // 俯视时小农夫也站在农场里
    if (viewMode === 'walk') { cam.fov = 52; cam.clearViewOffset(); cam.near = 0.1; cam.updateProjectionMatrix(); camYaw = 0; updateWalkCam(1); }
    else { cam.fov = 30; cam.near = 1; target.set(0, 0, 0.4); fit(); }
  }
  function orbit(dx, dy) { camDrag = 1.5; camYaw -= dx; camPitch = Math.max(0.08, Math.min(1.25, camPitch + dy)); }
  function setInput(o) { Object.assign(input, o); }
  function init(cv) {
    canvasEl = cv;
    R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 1, 1, 3200);
    scene.fog = new T.Fog(new T.Color('#cfe8ff'), 140, 560); /* 2026-10-26 世界扩大 10 倍，远处的山和森林要看得到 */
    buildTextures();
    FXT = { coin: coinTex(), star: starTex(), drop: dropTex(), leaf: leafSpriteTex('#5cb83c'), soil: leafSpriteTex('#7a5232'), puff: glowTex('rgba(255,255,255,0.85)', 1), heart: heartTex() };
    fxLayer = document.getElementById('fx3d');
    buildSky();
    hemi = new T.HemisphereLight(0xcfe8ff, 0x4a6a2a, 0.7); scene.add(hemi);
    amb = new T.AmbientLight(0xffffff, 0.08); scene.add(amb);
    sun = new T.DirectionalLight(0xfff0d8, 2.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun); scene.add(sun.target);
    doorLamp = new T.PointLight(0xffb060, 0, 14, 2); doorLamp.position.set(-12.2, 2.6, -2.2); scene.add(doorLamp);
    // 地面
    const gg = new T.PlaneGeometry(400, 400, 140, 140); gg.rotateX(-Math.PI / 2);
    const cA = new T.Color('#9cb46e'), cB = new T.Color('#7e9e56'), cC = new T.Color('#b4b878'), tc = new T.Color();
    colorize(gg, (x, y, z) => { const n = fbm(x * 0.035 + 50, z * 0.035 + 50, 7, 4), m2 = fbm(x * 0.012, z * 0.012, 9, 3); tc.copy(cB).lerp(cA, Math.min(1, n * 1.4)).lerp(cC, Math.max(0, m2 - 0.55) * 1.6); return [tc.r, tc.g, tc.b]; });
    const ground = new T.Mesh(gg, new T.MeshStandardMaterial({ color: new T.Color('#ffffff'), vertexColors: true, map: TX.grass, roughness: 0.96 })); ground.material.map.repeat.set(60, 60); ground.receiveShadow = true; scene.add(ground); SEA.ground = ground; ground.visible = false; /* 2026-10-26：地面改成 buildWild 里 1.6 公里的大地形（农场部分是平地） */ buildWild(); SEA.ground = WILD.ground;
    // 农场院子（稍深的草皮）与小路
    const pm = new T.MeshStandardMaterial({ color: new T.Color('#c8a878'), map: TX.path, roughness: 1 }); pm.map.repeat.set(1, 6);
    const pathG = new T.Group(); [[-10, -1.2, 5.5, 1.6, 0.35], [-4.5, 7.2, 1.8, 6, -0.25]].forEach(([x, z, l, w, r]) => { const p = new T.Mesh(new T.PlaneGeometry(l, w), pm); p.rotation.set(-Math.PI / 2, 0, r); p.position.set(x, 0.015, z); p.receiveShadow = true; pathG.add(p); }); scene.add(pathG);
    buildPlotsBase();
    /* 2026-10-26：去掉了菜地外面的院子篱笆，田和外面的草地、旁边的田连成一片 */
    // 建筑与装饰
    OBST.length = 0; ['house', 'windmill', 'doghouse', 'scarecrow'].forEach(k => OBST.push([ST[k].x, ST[k].z, ST[k].obstacle]));
    const house = buildHouse(); house.position.set(ST.house.x, 0, ST.house.z); house.rotation.y = ST.house.ry; scene.add(house); doorLamp.position.set(ST.house.x + 0.6, 2.8, ST.house.z + 2.6);
    const wmill = buildWindmill(); wmill.position.set(ST.windmill.x, 0, ST.windmill.z); wmill.rotation.y = ST.windmill.ry; scene.add(wmill);
    scene.add(pondHit()); RANCH3.ponds = 0; setPonds(1); setPastureLv(1); buildOrchard(); RANCH3.ready = true;
    const scare = buildScarecrow(); scare.position.set(ST.scarecrow.x, 0, ST.scarecrow.z); scare.rotation.y = ST.scarecrow.ry; scene.add(scare);
    const dh = buildDoghouse(); dh.position.set(ST.doghouse.x, 0, ST.doghouse.z); dh.rotation.y = ST.doghouse.ry; scene.add(dh);
    { const hk = new T.Mesh(new T.BoxGeometry(1.8, 1.6, 1.8), new T.MeshBasicMaterial({ visible: false })); hk.position.set(ST.doghouse.x, 0.8, ST.doghouse.z); hk.userData.idx = -10; scene.add(hk); hitBoxes.push(hk); } // 点狗窝：领养 / 喂狗
    // 狗狗模型计算量较大：游戏画面出来以后再生成（afterShown），避免拖慢打开游戏；登录页等情况 8 秒后兜底生成
    setTimeout(buildBaseDogs, 8000);
    [[-17, -10, 1.2, '#4f9a3a', 1], [-20, 2, 1.1, '#5aa840', 0], [-9, -14, 1.0, '#4a9238', 1], [12, -13, 1.25, '#4f9a3a', 0], [17, -6, 1.05, '#5aa840', 1], [24, 4, 1.2, '#4a9238', 0], [30, -12, 1.0, '#5aa840', 1], [-40, 22, 1.15, '#4f9a3a', 0], [9, 22, 0.9, '#5aa840', 0], [-24, -5, 1.3, '#467f36', 0], [24, 0, 1.25, '#467f36', 1], [-2, -20, 1.2, '#4f9a3a', 0], [-44, -24, 1.1, '#4a9238', 0]].forEach(([x, z, s, c, ap]) => { scene.add(tree(x, z, s, c, ap)); OBST.push([x, z, 0.55 * s]); });
    [[-9.6, -6.5, 0.9], [9.4, 7.2, 1], [-15.5, 3.5, 0.8], [14, 3, 0.9], [7, -8, 0.7], [-7, -8.2, 0.8], [3.4, 9.8, 0.6], [15, -10, 1]].forEach(([x, z, s]) => { scene.add(bushAt(x, z, s, '#4f9a3a')); OBST.push([x, z, 0.75 * s]); });
    [[-9.2, 9.8, 0.5], [9.2, 13.2, 0.4], [-2.2, 10.8, 0.3], [14.5, -1, 0.35], [-16, -6, 0.45], [6, 11, 0.3]].forEach(([x, z, s]) => { scene.add(rock(x, z, s)); OBST.push([x, z, 1.1 * s]); });
    const avoid = (x, z) => (Math.abs(x) < 8.6 && Math.abs(z) < 6.4) || (Math.hypot((x + 5.5) / 1.25, z - 13.5) < 3.8) || (Math.abs(x + 13) < 3.2 && Math.abs(z + 2.5) < 2.8) || Math.hypot(x - 3.5, z + 15) < 2 || (x > 9.9 && z > 6.7) || PONDS.some(([px, pz]) => Math.hypot((x - px) / 1.25, z - pz) < 3.8) || z < -25.5;
    grassMesh = grassField(window.innerWidth < 820 ? 5000 : 11000, avoid); scene.add(grassMesh);
    // 东南边的大草原（牧羊的地方）
    { const pa = (x, z) => (x > 9.9 && x < 51 && z > 6.7 && z < 37) || Math.hypot(x, z) < 34; scene.add(grassField(window.innerWidth < 820 ? 3000 : 7000, pa, 50, 62, 96, 66)); scene.add(flowers(260, pa, 50, 62, 96, 66));
      [[64, 58, 1.2, '#4f9a3a', 0], [82, 46, 1.0, '#5aa840', 1], [30, 84, 1.15, '#4a9238', 0], [88, 82, 1.1, '#4f9a3a', 0], [56, 90, 0.95, '#5aa840', 0], [8, 70, 1.05, '#4a9238', 1]].forEach(([x, z, sc, c, ap]) => { scene.add(tree(x, z, sc, c, ap)); OBST.push([x, z, 0.55 * sc]); });
      [[46, 74, 0.9], [72, 70, 1.1], [20, 60, 0.8]].forEach(([x, z, sc]) => { scene.add(rock(x, z, sc)); OBST.push([x, z, 1.1 * sc]); }); } scene.add(flowers(420, avoid)); scene.add(hills()); buildFlora();
    for (let i = 0; i < 4; i++) { const c = buildChicken(); c.position.set([-6, 7, -2, -11][i], 0, [8.2, -8, -9.5, -6.5][i]); scene.add(c); anim.chickens.push({ m: c, tx: c.position.x, tz: c.position.z, pk: 0, home: c.position.clone() }); }
    ['#ff9ac8', '#ffe066', '#9ad8ff', '#ffffff', '#ffb050', '#c8a0ff'].forEach((c, i) => { const b = buildButterfly(c); scene.add(b.g); anim.butterflies.push(Object.assign(b, { ph: i * 2.1 })); });
    for (let i = 0; i < 6; i++) { const c = buildCloud(); c.position.set(-80 + i * 32, 30 + (i % 3) * 6, -60 - (i % 2) * 30); c.scale.setScalar(2 + (i % 3) * 0.6); scene.add(c); anim.clouds.push(c); }
    // 烟、萤火虫、雨
    const smokeM = () => new T.SpriteMaterial({ map: FXT.puff, transparent: true, depthWrite: false, opacity: 0.5 }); for (let i = 0; i < 8; i++) { const s = new T.Sprite(smokeM()); s.userData.ph = i / 8; scene.add(s); anim.smoke.push(s); }
    { const n = 60, g = new T.BufferGeometry(), p = new Float32Array(n * 3), r = CFG3.rng(3); for (let i = 0; i < n; i++) { p[i * 3] = (r() - 0.5) * 34; p[i * 3 + 1] = 0.5 + r() * 2.5; p[i * 3 + 2] = (r() - 0.5) * 28; } g.setAttribute('position', new T.BufferAttribute(p, 3)); anim.fireflies = new T.Points(g, new T.PointsMaterial({ size: 0.35, map: glowTex('rgba(220,255,140,1)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xd8ff8a })); anim.fireflies.visible = false; scene.add(anim.fireflies); }
    { const n = 1600, g = new T.BufferGeometry(), p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 30, z = (Math.random() - 0.5) * 50; p.set([x, y, z, x - 0.05, y - 0.6, z - 0.05], i * 6); } g.setAttribute('position', new T.BufferAttribute(p, 3)); anim.rain = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.45 })); anim.rain.visible = false; scene.add(anim.rain); }
    window.addEventListener('wheel', e => { if (e.target !== canvasEl) return; if (viewMode === 'walk') { camDistW = Math.max(3.5, Math.min(16, camDistW * (e.deltaY > 0 ? 1.08 : 0.93))); return; } zoom = Math.max(0.6, Math.min(2.6, zoom * (e.deltaY > 0 ? 1.06 : 0.94))); applyCam(); }, { passive: true });
    setHero(null); snowifyScene();
    resize(); try { R.compile(scene, cam); } catch (e) { } /* 加载画面还在时先把着色器编译好，进去以后不卡 */ ready = true;
  }

  /* ---------------- 每帧更新 ---------------- */
  let curView = { plots: [], home: true }, envState = { hour: 12, rain: 0 }, dogMode = {};
  function setPlots(list, home) { curView = { plots: list, home }; ensurePlots(list.length); plots.forEach((pl, i) => { pl.node.visible = i < list.length; if (i >= list.length && pl.key) { pl.key = ''; rebuildPlot(i, { u: 1, c: -1, soil: 0, pr: {} }, { lite: true }); } }); /* 用不到的地（别人的农场比自己的小）清空内容，省内存 */ PLOTN = list.length; fieldDeco.forEach((g, k) => { g.visible = (k + 1) * 24 < list.length; }); const nx = home ? CFG3.UNLOCK_ORDER.find(u => list[u] && !list[u].u) : -1; list.forEach((P, i) => { const f = Math.floor(i / 24), o = { mine: !home && P.mine, next: i === nx, lite: f !== 0 && f !== ACTF && f !== DETF }; const k = plotKey(P, o); if (plots[i].key !== k) { plots[i].key = k; rebuildPlot(i, P, o); } }); }
  function setHover(i) { hoverIdx = i; }
  function setDog(mode) { if (Array.isArray(mode)) { const o = {}; CFG3.DOGS.forEach((d, i) => o[d.id] = mode[i] || 'none'); dogMode = o; } else if (typeof mode === 'string') dogMode = { fuwang: mode }; else dogMode = mode || {}; }
  // 领养的边牧：按 id 建 / 删模型，住在狗窝附近
  const PETS3 = {};
  // 移除一只领养的狗：模型、动画列表、点击区域都要清掉，否则会留下看不见的点击热区
  function dropDog(dg) { scene.remove(dg.g); const i = anim.dogs.indexOf(dg); if (i >= 0) anim.dogs.splice(i, 1); if (dg.hit) { const j = hitBoxes.indexOf(dg.hit); if (j >= 0) hitBoxes.splice(j, 1); }
    const keep = new Set(Object.values(DOG_GEO[dg.kind] || {})); dg.g.traverse(o => { if (o.geometry && !keep.has(o.geometry) && !SG_SET.has(o.geometry)) o.geometry.dispose(); if (o.isSprite && o.material.map) { o.material.map.dispose(); o.material.dispose(); } }); } // 释放这只狗独有的几何体和名牌贴图
  let dogsBuilt = 0;
  function buildBaseDogs() { if (dogsBuilt) return; dogsBuilt = 1; const dog = buildDog('fuwang'); dog.position.set(10.4, 0, 1.2); dog.rotation.y = -2.9; dog.visible = false; scene.add(dog);
    setTimeout(() => { const dog2 = buildDog('ruibao'); dog2.position.set(10.6, 0, -1.4); dog2.rotation.y = -2.6; dog2.visible = false; scene.add(dog2); dogsBuilt = 2; }, 60); }
  /* 游戏画面出来以后：先生成狗，再生成作物图标 */
  function afterShown() { setTimeout(buildBaseDogs, 120); setTimeout(releaseIcons, 500); setTimeout(initCritters, 1500); }
  function setPets(list) {
    if (!RANCH3.ready || dogsBuilt < 2) return; /* 宠物狗排在福旺、睿宝后面 */ const want = {}; (list || []).forEach((p, i) => { want[p.id] = p; const k = p.id + '|' + p.coat + '|' + p.name, cur = PETS3[p.id];
      if (cur && cur.key === k) return; if (cur) dropDog(cur.dg);
      const g = buildDog(DOG_LOOK[p.coat] ? p.coat : 'black', p.name, p.id), dg = anim.dogs[anim.dogs.length - 1]; g.position.set(9.6 + (i % 4) * 0.9, 0, 3.2 + Math.floor(i / 4) * 1.0); g.visible = false; scene.add(g); PETS3[p.id] = { key: k, dg }; });
    Object.keys(PETS3).forEach(id => { if (!want[id]) { dropDog(PETS3[id].dg); delete PETS3[id]; } });
  }
  function setEnv(h, rain) { envState.hour = h; envState.rain = rain; }
  /* ---------- 第 1 期：四季画面（content/seasons.jsonc 的 look）----------
     初始化后按原来的颜色找出地面、草、树叶、远山的材质，换季时改颜色；冬天地面换成雪色（去掉草地贴图）、不开花；飘落效果用一组点精灵跟着镜头 */
  const SEA = { id: '', ground: null, gBase: null, mats: null, flowers: [], fx: null, fxKind: '', fxV: null, sk: 0, fxOn: true };
  function seasonCollect() {
    /* 2026-10-26：可以反复调用，只收集新出现的材质（菜地、建筑等是后来才生成的），返回新收集到几个 */
    const first = !SEA.mats; if (first) { SEA.mats = { leaf: [], leaf2: [], hills: [], hillTree: [], grass: [], yard: [] }; SEA.seen = new Set(); SEA.fseen = new Set(); }
    const cls = { '4f9a3a': 'leaf', '4a9238': 'leaf', '5aa840': 'leaf2', '6a9a4a': 'hills', '3f7a3a': 'hillTree', '7cb84a': 'grass', '8aa060': 'yard', '7cb04e': 'yard', '7fa856': 'yard' }, seen = SEA.seen; let added = 0;
    scene.traverse(o => { if (o.userData.flowers && !SEA.fseen.has(o)) { SEA.fseen.add(o); SEA.flowers.push(o); added++; } if (!o.isMesh || !o.material || o.userData.bid) return; [].concat(o.material).forEach(m => { if (seen.has(m) || !m.color) return; seen.add(m); const k = cls[m.color.getHexString()]; if (k) { SEA.mats[k].push({ m, c0: m.color.clone(), map0: m.map }); added++; } }); });
    if (first && SEA.ground) { const c = SEA.ground.geometry.attributes.color; SEA.gBase = c.array.slice(); }
    return first ? 0 : added;
  }
  /* 草地贴图本身是绿色的，换季时换成去色的版本，颜色交给季节色（只生成一次） */
  const GREY = new Map();
  function greyOf(t) { if (!t || !t.image) return t; let g = GREY.get(t); if (g) return g; const im = t.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const l = Math.min(255, (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * 1.45); a[i] = a[i + 1] = a[i + 2] = l; } x.putImageData(d, 0, 0); g = t.clone(); g.image = c; g.needsUpdate = true; GREY.set(t, g); return g; }
  function fxTex(kind) { if (kind === 'snow') { const c = mkCanvas(32), x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(0.78, 'rgba(150,170,205,0.6)'); g.addColorStop(1, 'rgba(150,170,205,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return tex(c, 0); }   /* 雪花带一圈淡蓝灰的边：落在白色雪地前面也看得出来 */ const c = mkCanvas(32), x = c.getContext('2d'); x.translate(16, 16); x.rotate(0.5); x.fillStyle = kind === 'petal' ? '#ffc4d6' : '#e8862a'; x.beginPath(); x.ellipse(0, 0, kind === 'petal' ? 9 : 12, kind === 'petal' ? 6 : 7, 0, 0, 7); x.fill(); if (kind === 'leaf') { x.strokeStyle = 'rgba(120,50,10,.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-11, 0); x.lineTo(11, 0); x.stroke(); } return tex(c, 0); }
  function setSeason(id) {
    if (!ready || id === SEA.id) return; const S0 = GAMECFG.SEASONS.list.find(s => s.id === id); if (!S0) return; SEA.id = id; seasonCollect(); const L = S0.look;
    const paint = (list, hex) => list.forEach(({ m, c0 }) => { if (hex) m.color.set(hex); else m.color.copy(c0); });
    paint(SEA.mats.leaf, L.leaf); paint(SEA.mats.leaf2, L.leaf2 || L.leaf); paint(SEA.mats.hills, L.hills); paint(SEA.mats.grass, L.grass);
    paint(SEA.mats.hillTree, id === 'winter' ? '#a8bcb0' : id === 'autumn' ? '#8a7a3a' : ''); paint(SEA.mats.yard, L.groundK > 0.3 ? L.ground : ''); SEA.mats.yard.forEach(({ m, map0 }) => { const want = !map0 ? null : L.groundK > 0.7 ? null : L.groundK > 0.3 ? greyOf(map0) : map0; if (m.map !== want) { m.map = want; m.needsUpdate = true; } });
    if (SEA.ground && SEA.gBase) { const ca = SEA.ground.geometry.attributes.color, a = ca.array, b = SEA.gBase, tc = new T.Color(L.ground), k = L.groundK || 0;
      for (let i = 0; i < a.length; i += 3) { const lum = (b[i] + b[i + 1] + b[i + 2]) / 3 / 0.55; a[i] = b[i] * (1 - k) + tc.r * lum * k; a[i + 1] = b[i + 1] * (1 - k) + tc.g * lum * k; a[i + 2] = b[i + 2] * (1 - k) + tc.b * lum * k; }
      ca.needsUpdate = true; const gm = SEA.ground.material; SEA.gMap = SEA.gMap || gm.map; const want = k > 0.7 ? null : k > 0.3 ? greyOf(SEA.gMap) : SEA.gMap; if (gm.map !== want) { gm.map = want; gm.needsUpdate = true; } }
    SEA.flowers.forEach(f => { const show = L.flowers !== false; f.visible = show; f.userData.seasonHide = !show; });
    scene.fog.near = id === 'winter' ? 90 : 140; scene.fog.far = id === 'winter' ? 430 : 560;   /* 下雪天远处朦胧一点 */
    /* 飘落效果 */
    const kind = SEA.fxOn === false || L.fx === 'firefly' ? '' : L.fx || '';
    if (kind !== SEA.fxKind) { if (SEA.fx) { scene.remove(SEA.fx); SEA.fx.geometry.dispose(); SEA.fx.material.map.dispose(); SEA.fx.material.dispose(); SEA.fx = null; } SEA.fxKind = kind;
      if (kind) { const N = kind === 'snow' ? (quality <= 1 ? 700 : 1600) : quality <= 1 ? 160 : 260, pos = new Float32Array(N * 3), r = CFG3.rng(99); SEA.fxV = new Float32Array(N * 2); for (let i = 0; i < N; i++) { pos[i * 3] = (r() - 0.5) * 70; pos[i * 3 + 1] = r() * 22; pos[i * 3 + 2] = (r() - 0.5) * 70; SEA.fxV[i * 2] = r() * 6.28; SEA.fxV[i * 2 + 1] = 0.7 + r() * 0.6; }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
        SEA.fx = new T.Points(g, new T.PointsMaterial({ map: fxTex(kind), size: kind === 'snow' ? 0.44 : 0.42, transparent: true, depthWrite: false, opacity: 0.9, sizeAttenuation: true })); SEA.fx.frustumCulled = false; SEA.fx.renderOrder = 15; scene.add(SEA.fx); } }
  }
  function seasonTick(dt, t) {
    const F = SEA.fx; if (!F) return; const p = F.geometry.attributes.position, a = p.array, V = SEA.fxV, fall = SEA.fxKind === 'snow' ? 1.1 : SEA.fxKind === 'leaf' ? 1.1 : 0.7, sway = SEA.fxKind === 'snow' ? 0.6 : 1.1, c = viewMode === 'walk' ? camFocus : eff;
    F.position.set(Math.round(c.x / 70) * 70, 0, Math.round(c.z / 70) * 70);
    for (let i = 0, n = p.count; i < n; i++) { const o = i * 3, ph = V[i * 2], sp = V[i * 2 + 1]; a[o + 1] -= fall * sp * dt; a[o] += Math.sin(t * 0.8 + ph) * sway * dt; a[o + 2] += Math.cos(t * 0.6 + ph * 1.3) * sway * 0.6 * dt;
      if (a[o + 1] < 0) { a[o + 1] += 22; } const lx = a[o] + F.position.x - c.x, lz = a[o + 2] + F.position.z - c.z; if (lx > 35) a[o] -= 70; else if (lx < -35) a[o] += 70; if (lz > 35) a[o + 2] -= 70; else if (lz < -35) a[o + 2] += 70; }
    p.needsUpdate = true;
  }
  /* ---------- 第 1 期：环境小生物 ----------
     兔子：在空草地上一蹦一跳地闲逛，主人走近（4 米内）就跑开；冬天换白毛。松鼠：在树下跑来跑去、坐着摇尾巴，冬天冬眠。
     蝴蝶只在春夏出来，萤火虫只在春夏秋的夜里。目标点只选建造网格里没被占用的空地，不会跑进菜地、池塘、牧场 */
  const CRIT = { list: [], free: null, season: '' };
  function critterFree() { const key = PAST.lv + ':' + RANCH3.ponds + ':' + PLOTN; if (CRIT.free && CRIT.fkey === key) return CRIT.free; CRIT.fkey = key; const occ = GAMECFG.homeOccupancy({ fields: Math.max(1, Math.ceil(PLOTN / CFG3.NPLOTS)), pastLv: PAST.lv || 1, pondLv: ((RANCH3.ponds || 1) - 1) * 5 + 1 }), out = [];
    for (let j = 0; j < occ.H; j++) for (let i = 0; i < occ.W; i++) { if (occ.cells[j * occ.W + i]) continue; const x = occ.x0 + (i + 0.5) * occ.cell, z = occ.z0 + (j + 0.5) * occ.cell; if (Math.hypot(x, z + 6) < 48) out.push([x, z]); } return (CRIT.free = out); }
  function buildRabbit() { const g = new T.Group(), fur = mat('#b08a64', { p: { roughness: 0.95 } }), belly = mat('#efe4d4', { p: { roughness: 0.95 } }), ink = mat('#1a1410');
    const body = new T.Group(); g.add(body); body.add(blob(fur, 0, 0.16, 0, 0.17, 0.14, 0.12, 12)); body.add(blob(belly, 0.05, 0.13, 0, 0.11, 0.09, 0.09, 10)); const head = blob(fur, 0.17, 0.27, 0, 0.09, 0.085, 0.08, 12); body.add(head);
    [-1, 1].forEach(s => { const e = blob(fur, 0.15, 0.42, s * 0.035, 0.025, 0.1, 0.035, 8); e.rotation.x = s * 0.18; body.add(e); body.add(blob(ink, 0.245, 0.29, s * 0.045, 0.014, 0.016, 0.014, 6)); });
    body.add(blob(belly, -0.17, 0.2, 0, 0.05, 0.05, 0.05, 8)); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.userData.fur = fur; g.scale.setScalar(1.3); return { g, body }; }
  function buildSquirrel() { const g = new T.Group(), fur = mat('#b8622a', { p: { roughness: 0.9 } }), belly = mat('#f0d8b0', { p: { roughness: 0.9 } }), ink = mat('#1a1410');
    const body = new T.Group(); g.add(body); body.add(blob(fur, 0, 0.12, 0, 0.11, 0.1, 0.08, 12)); body.add(blob(belly, 0.04, 0.11, 0, 0.07, 0.07, 0.06, 10)); body.add(blob(fur, 0.11, 0.21, 0, 0.065, 0.06, 0.06, 10));
    [-1, 1].forEach(s => { body.add(blob(fur, 0.1, 0.28, s * 0.03, 0.018, 0.03, 0.015, 6)); body.add(blob(ink, 0.165, 0.225, s * 0.032, 0.011, 0.012, 0.011, 6)); });
    const tail = new T.Group(); tail.position.set(-0.1, 0.12, 0); body.add(tail); const tm = mat('#c87038', { p: { roughness: 1 } }); [[-0.05, 0.06, 0.07], [-0.08, 0.16, 0.08], [-0.05, 0.26, 0.075], [0.0, 0.32, 0.06]].forEach(([x, y, r]) => tail.add(blob(tm, x, y, 0, r, r, r * 0.8, 8)));
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(1.3); return { g, body, tail }; }
  function initCritters() {
    if (CRIT.list.length) return; const r = CFG3.rng(41), free = critterFree(); if (!free.length) return;
    for (let i = 0; i < 4; i++) { const b = buildRabbit(), p = free[Math.floor(r() * free.length)]; b.g.position.set(p[0], 0, p[1]); scene.add(b.g); CRIT.list.push(Object.assign(b, { kind: 'rabbit', tgt: null, wait: r() * 3, ph: 0, sp: 0 })); }
    const trees = [[-17, -10], [-20, 2], [-9, -14], [12, -13], [17, -6], [24, 4]];
    for (let i = 0; i < 3; i++) { const b = buildSquirrel(), p = trees[i * 2]; b.g.position.set(p[0] + 1.2, 0, p[1] + 0.8); scene.add(b.g); CRIT.list.push(Object.assign(b, { kind: 'squirrel', trees, tgt: null, wait: r() * 4, ph: 0, sp: 0 })); }
  }
  function updateCritters(dt, t) {
    if (!CRIT.list.length) return;
    const sid = SEA.id || 'summer'; if (sid !== CRIT.season) { CRIT.season = sid; CRIT.list.forEach(c => { if (c.kind === 'rabbit') c.g.userData.fur.color.set(sid === 'winter' ? '#e8e4dc' : '#b08a64'); if (c.kind === 'squirrel') c.g.visible = sid !== 'winter'; }); anim.butterflies.forEach(b => { b.g.visible = sid === 'spring' || sid === 'summer'; }); }
    const free = critterFree(), heroOn = viewMode === 'walk';
    CRIT.list.forEach(c => { if (!c.g.visible) return; const p = c.g.position;
      const dh = Math.hypot(HERO.pos.x - p.x, HERO.pos.z - p.z), scared = heroOn && dh < 4;
      if (scared && (!c.tgt || !c.flee)) { const a = Math.atan2(p.z - HERO.pos.z, p.x - HERO.pos.x) + (Math.random() - 0.5) * 0.8; c.tgt = [p.x + Math.cos(a) * 7, p.z + Math.sin(a) * 7]; c.flee = true; c.wait = 0; }
      if (!c.tgt) { c.wait -= dt; if (c.wait <= 0) { if (c.kind === 'rabbit') { let best = null; for (let k = 0; k < 8 && !best; k++) { const q = free[Math.floor(Math.random() * free.length)]; if (Math.hypot(q[0] - p.x, q[1] - p.z) < 9) best = q; } c.tgt = best || free[Math.floor(Math.random() * free.length)]; } else { const tr = c.trees[Math.floor(Math.random() * c.trees.length)], a = Math.random() * 6.28; c.tgt = [tr[0] + Math.cos(a) * 1.3, tr[1] + Math.sin(a) * 1.3]; } c.flee = false; } }
      let moving = false;
      if (c.tgt) { const dx = c.tgt[0] - p.x, dz = c.tgt[1] - p.z, d = Math.hypot(dx, dz), v = c.flee ? 4.2 : c.kind === 'rabbit' ? 1.4 : 2.6;
        if (d < 0.15) { c.tgt = null; c.flee = false; c.wait = c.kind === 'rabbit' ? 1.5 + Math.random() * 4 : 2 + Math.random() * 5; }
        else { const st = Math.min(d, v * dt); p.x += dx / d * st; p.z += dz / d * st; const want = Math.atan2(-dz, dx); let da = want - c.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); c.g.rotation.y += da * Math.min(1, dt * 10); moving = true; } }
      if (c.kind === 'rabbit') { c.ph = moving ? c.ph + dt * (c.flee ? 11 : 7) : 0; const hop = moving ? Math.abs(Math.sin(c.ph)) : 0; c.body.position.y = hop * (c.flee ? 0.28 : 0.18); c.body.rotation.z = moving ? Math.cos(c.ph) * 0.25 : Math.sin(t * 3 + p.x) * 0.02; c.body.scale.y = 1 - (moving ? (1 - hop) * 0.12 : 0); }
      else { c.ph += dt * (moving ? 18 : 2); c.body.position.y = moving ? Math.abs(Math.sin(c.ph)) * 0.06 : 0; c.tail.rotation.z = moving ? -0.6 : Math.sin(c.ph) * 0.15; c.body.rotation.z = moving ? 0.15 : 0.35; }
    });
  }
  /* ---------- 第 1 期：家园自由建造 ----------
     建筑目录 content/buildings.jsonc，网格 content/home.jsonc（2 米一格）。模型由代码生成，同一种建筑共用一份几何体。
     setLayout(items)：按布局摆放（自己家 / 别人家都用它）；buildMode：网格覆盖层 + 预览（绿色能放、红色不能放）+ 点选格子 / 建筑 */
  const BDEF = {}; GAMECFG.BUILDINGS.forEach(b => { BDEF[b.id] = b; }); const GS = GAMECFG.gridSpec();
  const BMODEL = {}, BUILT = {}, BOBST = [], BSEG = []; let builtKey = '', LAMPM = null, LAMPG = null;
  function bRect(it) { const b = BDEF[it.type], odd = (it.rot | 0) % 2 === 1, w = odd ? b.d : b.w, d = odd ? b.w : b.d; return { cx: GS.x0 + (it.gx + w / 2) * GS.cell, cz: GS.z0 + (it.gz + d / 2) * GS.cell, w: w * GS.cell, d: d * GS.cell }; }
  /* 长城：按已建成的阶段数（0 选址 ~ 5 竣工）生成，长 20 米、宽 4 米，沿 x 方向 */
  function wallModel(g, stage) {
    const earth = mat('#a8875a', { p: { roughness: 1 } }), brick = mat('#d6cab0', { p: { map: TX.stone, normalMap: TX.stoneN, roughness: 0.9 } }), dark = mat('#6a4a2a', { p: { map: TX.wood, roughness: 0.8 } }), red = mat('#b83a2e', { p: { roughness: 0.6 } }), tile = mat('#4a5a5a', { p: { map: TX.tiles, roughness: 0.75 } });
    const box = (m, w, h, d, x, y, z) => { const o = mesh(new T.BoxGeometry(w, h, d), m, x, y, z); g.add(o); return o; };
    if (stage <= 0) { [[-9.8, -1.8], [9.8, -1.8], [-9.8, 1.8], [9.8, 1.8], [0, -1.8], [0, 1.8]].forEach(([x, z]) => box(dark, 0.12, 0.8, 0.12, x, 0.4, z)); const rope = mat('#e8d8a8'); box(rope, 19.6, 0.03, 0.03, 0, 0.62, -1.8); box(rope, 19.6, 0.03, 0.03, 0, 0.62, 1.8); box(rope, 0.03, 0.03, 3.6, -9.8, 0.62, 0); box(rope, 0.03, 0.03, 3.6, 9.8, 0.62, 0); box(dark, 0.1, 1.2, 0.1, -9.2, 0.6, 2.3); box(mat('#d8b878', { p: { map: TX.wood } }), 0.9, 0.5, 0.06, -9.2, 1.15, 2.33); return; }
    box(earth, 20, 0.6, 3.6, 0, 0.3, 0); [0.2, 0.42].forEach(y => box(mat('#96764a', { p: { roughness: 1 } }), 20.02, 0.04, 3.62, 0, y, 0));
    if (stage < 2) return;
    const seg = (x0, x1) => { const L = x1 - x0, cx = (x0 + x1) / 2; box(brick, L, 2.8, 3.0, cx, 2.0, 0); box(mat('#8f8674', { p: { roughness: 1 } }), L, 0.08, 2.4, cx, 3.42, 0);
      for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.9) [-1.35, 1.35].forEach(z => box(brick, 0.5, 0.55, 0.3, x, 3.7, z)); };
    const tower = (x, h, roofed) => { box(brick, 4.2, h, 4.2, x, 0.6 + h / 2, 0); for (let i = 0; i < 4; i++) [-1, 1].forEach(s => { box(brick, 0.6, 0.6, 0.3, x - 1.5 + i, 0.6 + h + 0.3, s * 1.95); box(brick, 0.3, 0.6, 0.6, x + s * 1.95, 0.6 + h + 0.3, -1.5 + i); });
      [-1, 1].forEach(s => box(mat('#2a2018'), 0.7, 1.1, 0.1, x + s * 0.9, 0.6 + h * 0.55, 2.11)); if (roofed) { const r = mesh(new T.ConeGeometry(3.3, 1.6, 4), tile, x, 0.6 + h + 1.4, 0); r.rotation.y = Math.PI / 4; g.add(r); [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([a, b]) => box(red, 0.18, 0.9, 0.18, x + a, 0.6 + h + 0.45, b)); } };
    seg(-10, stage >= 4 ? 10 : 0);
    if (stage >= 3) { tower(-8, 4.6, false); const basin = mesh(new T.CylinderGeometry(0.5, 0.35, 0.4, 10), mat('#3a3430', { p: { metalness: 0.4, roughness: 0.6 } }), -8, 5.65, 0); g.add(basin); const fire = blob(mat('#ff8a2a', { p: { emissive: new T.Color('#ff6010'), emissiveIntensity: 1.2 } }), -8, 6.0, 0, 0.32, 0.5, 0.32, 10); g.add(fire); }
    if (stage >= 4) tower(7.5, 5.2, true);
    if (stage >= 5) { [[-8, 5.8], [7.5, 8.2]].forEach(([x, y]) => { box(dark, 0.08, 2.2, 0.08, x + 1.6, y + 1.1, 1.6); const f = box(red, 1.1, 0.7, 0.03, x + 2.15, y + 1.85, 1.6); f.castShadow = false; });
      box(mat('#e8c060', { p: { metalness: 0.7, roughness: 0.3 } }), 2.4, 0.8, 0.08, 0, 2.2, 1.55); }
  }
  function bModel(type, stage) {
    const key = type + (stage !== undefined ? ':' + stage : ''); if (BMODEL[key]) return BMODEL[key];
    if (type === 'greatwall') { const g = new T.Group(); wallModel(g, stage | 0); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return (BMODEL[key] = merge(g)); }
    if (BMODEL[type]) return BMODEL[type];
    const g = new T.Group(), wood = mat('#a8794a', { p: { map: TX.wood, roughness: 0.85 } }), dark = mat('#6a4a2a', { p: { map: TX.wood, roughness: 0.8 } }), stone = mat('#c2bcae', { p: { map: TX.stone, normalMap: TX.stoneN, roughness: 0.85 } });
    const box = (m, w, h, d, x, y, z) => mesh(new T.BoxGeometry(w, h, d), m, x, y, z);
    if (type === 'stonepath') [[-0.48, -0.42, 0.44], [0.44, -0.5, 0.4], [-0.42, 0.48, 0.42], [0.5, 0.42, 0.46], [0.02, 0.0, 0.32]].forEach(([x, z, r], i) => { const s = mesh(new T.CylinderGeometry(r, r * 1.06, 0.07, 7), stone, x, 0.035, z); s.rotation.y = i * 1.3; g.add(s); });
    else if (type === 'fence') fenceLine(g, -1, 0, 1, 0, wood, 1);
    else if (type === 'haystack') { const hm = mat('#e3c172', { p: { roughness: 1 } }); g.add(mesh(new T.CylinderGeometry(0.72, 0.8, 0.9, 14), hm, 0, 0.45, 0)); const top = mesh(new T.SphereGeometry(0.72, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 0.9, 0); top.scale.y = 0.6; g.add(top); [0.25, 0.62].forEach(y => g.add(mesh(new T.TorusGeometry(0.77, 0.03, 6, 24), mat('#9a7a3a'), 0, y, 0).rotateX(Math.PI / 2))); }
    else if (type === 'flowerbed') { [[0, -0.75, 1.7, 0.2], [0, 0.75, 1.7, 0.2], [-0.75, 0, 0.2, 1.3], [0.75, 0, 0.2, 1.3]].forEach(([x, z, w, d]) => g.add(box(stone, w, 0.28, d, x, 0.14, z))); g.add(box(mat('#5a3a20', { p: { map: TX.soil, roughness: 1 } }), 1.3, 0.22, 1.3, 0, 0.11, 0));
      const pal = ['#ff7aa0', '#ffd23a', '#ffffff', '#b98aff', '#ff9a4a'], r = CFG3.rng(7), stem = mat('#4f9a32'); for (let i = 0; i < 14; i++) { const x = (r() - 0.5) * 1.1, z = (r() - 0.5) * 1.1, h = 0.25 + r() * 0.2; g.add(mesh(new T.CylinderGeometry(0.015, 0.015, h, 4), stem, x, 0.22 + h / 2, z)); g.add(blob(mat(pal[i % pal.length], { p: { roughness: 0.6 } }), x, 0.24 + h, z, 0.09, 0.06, 0.09, 8)); } }
    else if (type === 'bench') { [-0.12, 0.12].forEach(z => g.add(box(wood, 1.6, 0.07, 0.2, 0, 0.48, z))); [0.72, 0.9].forEach(y => g.add(box(wood, 1.6, 0.12, 0.05, 0, y, -0.28))); [-0.7, 0.7].forEach(x => { g.add(box(dark, 0.08, 0.46, 0.5, x, 0.23, 0)); g.add(box(dark, 0.08, 0.6, 0.06, x, 0.75, -0.28)); }); }
    else if (type === 'lamp') { const iron = mat('#2e3238', { p: { roughness: 0.45, metalness: 0.6 } }); g.add(mesh(new T.CylinderGeometry(0.2, 0.26, 0.22, 10), stone, 0, 0.11, 0)); g.add(mesh(new T.CylinderGeometry(0.075, 0.09, 2.4, 8), iron, 0, 1.3, 0)); g.add(box(iron, 0.46, 0.06, 0.46, 0, 2.48, 0)); g.add(mesh(new T.ConeGeometry(0.38, 0.3, 4), iron, 0, 3.05, 0).rotateY(Math.PI / 4));
      LAMPM = LAMPM || mat('#fff4cc', { p: { emissive: new T.Color('#ffc860'), emissiveIntensity: 0, roughness: 0.3 } }); g.add(box(LAMPM, 0.36, 0.42, 0.36, 0, 2.72, 0));
      LAMPG = LAMPG || new T.SpriteMaterial({ map: glowTex('rgba(255,200,110,0.9)', 1), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }); const gl = new T.Sprite(LAMPG); gl.position.set(0, 2.72, 0); gl.scale.setScalar(2.6); g.add(gl); }
    else if (type === 'pinetree') { g.add(mesh(new T.CylinderGeometry(0.1, 0.14, 0.7, 7), dark, 0, 0.35, 0)); const lm = mat('#2f7a3a', { p: { roughness: 0.9 } }); [[0.85, 1.0, 0.6], [0.66, 0.9, 1.25], [0.46, 0.8, 1.85]].forEach(([r, h, y]) => g.add(mesh(new T.ConeGeometry(r, h, 9), lm, 0, y, 0))); }
    else if (type === 'well') { const ring = lathe([[1.0, 0], [1.05, 0.05], [1.05, 0.85], [0.95, 0.9], [0.8, 0.9], [0.8, 0.2]], 18); g.add(mesh(ring, stone)); g.add(mesh(new T.CircleGeometry(0.8, 18).rotateX(-Math.PI / 2), mat('#2a5a7a', { p: { roughness: 0.1, metalness: 0.2 } }), 0, 0.55, 0));
      [-0.95, 0.95].forEach(x => g.add(box(dark, 0.12, 1.9, 0.12, x, 1.0, 0))); g.add(box(dark, 2.1, 0.1, 0.1, 0, 1.75, 0)); const roof = mat('#b8473a', { p: { map: TX.tiles, roughness: 0.8 } }); [-1, 1].forEach(s => { const r = box(roof, 2.4, 0.07, 0.95, 0, 2.15, s * 0.36); r.rotation.x = s * 0.62; g.add(r); });
      g.add(mesh(new T.CylinderGeometry(0.12, 0.1, 0.18, 10), wood, 0.3, 1.35, 0)); }
    else if (type === 'pavilion') { const red = mat('#b83a2e', { p: { roughness: 0.6 } }), roof = mat('#3e6e6a', { p: { map: TX.tiles, roughness: 0.75 } }); g.add(box(stone, 5.4, 0.3, 5.4, 0, 0.15, 0)); [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => g.add(mesh(new T.CylinderGeometry(0.16, 0.18, 2.6, 10), red, x, 1.6, z)));
      [[0, -2.2, 4.6, 0.18], [0, 2.2, 4.6, 0.18], [-2.2, 0, 0.18, 4.6], [2.2, 0, 0.18, 4.6]].forEach(([x, z, w, d]) => g.add(box(red, w, 0.22, d, x, 2.85, z)));
      const rf = mesh(new T.ConeGeometry(4.3, 1.7, 4, 1), roof, 0, 3.8, 0); rf.rotation.y = Math.PI / 4; g.add(rf); g.add(blob(mat('#e8c060', { p: { metalness: 0.7, roughness: 0.3 } }), 0, 4.75, 0, 0.16, 0.24, 0.16, 10)); g.add(mesh(new T.CylinderGeometry(0.7, 0.7, 0.7, 12), stone, 0, 0.65, 0)); }
    else if (type === 'watchtower') { [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([x, z]) => g.add(box(dark, 0.18, 4, 0.18, x, 2, z))); g.add(box(wood, 2.4, 0.15, 2.4, 0, 3.6, 0)); g.add(mesh(new T.ConeGeometry(1.9, 1.2, 4), mat('#8a4a2a'), 0, 4.8, 0).rotateY(Math.PI / 4)); }
    else g.add(box(stone, GS.cell * (BDEF[type] ? BDEF[type].w : 1) * 0.9, 1, GS.cell * (BDEF[type] ? BDEF[type].d : 1) * 0.9, 0, 0.5, 0));
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return (BMODEL[type] = merge(g));
  }
  function rebuildBObst() { BOBST.length = 0; BSEG.length = 0;
    Object.values(BUILT).forEach(({ it }) => { const b = BDEF[it.type], s = b && b.solid; if (!s) return; const R = bRect(it);
      if (s === 'seg') { if ((it.rot | 0) % 2) BSEG.push([R.cx, R.cz - 1, R.cx, R.cz + 1]); else BSEG.push([R.cx - 1, R.cz, R.cx + 1, R.cz]); }
      else if (s === 'wall') { if (b.kind === 'wonder' && !(it.stage > 0)) return; const along = R.w >= R.d, L = Math.max(R.w, R.d), r = Math.min(R.w, R.d) * 0.46; for (let u = -L / 2 + r; u <= L / 2 - r + 0.01; u += r * 0.9) BOBST.push(along ? [R.cx + u, R.cz, r] : [R.cx, R.cz + u, r]); }
      else BOBST.push([R.cx, R.cz, +s]); }); }
  function setLayout(items) {
    items = (items || []).filter(it => BDEF[it.type] && (!BM.on || it.id !== BM.hideId));
    const key = items.map(i => i.id + ':' + i.type + ':' + i.gx + ':' + i.gz + ':' + (i.rot | 0) + ':' + (i.stage | 0)).join('|'); if (key === builtKey) return; builtKey = key; const want = {};
    items.forEach(it => { const k = it.type + ':' + it.gx + ':' + it.gz + ':' + (it.rot | 0) + ':' + (it.stage | 0); want[it.id] = 1; const cur = BUILT[it.id]; if (cur && cur.k === k) { cur.it = it; return; } if (cur) scene.remove(cur.o);
      const o = bModel(it.type, BDEF[it.type].kind === 'wonder' ? it.stage | 0 : undefined).clone(), R = bRect(it); o.position.set(R.cx, 0, R.cz); o.rotation.y = -(it.rot | 0) * Math.PI / 2; o.traverse(c => { c.userData.bid = it.id; }); scene.add(o); BUILT[it.id] = { k, o, it }; });
    Object.keys(BUILT).forEach(id => { if (!want[id]) { scene.remove(BUILT[id].o); delete BUILT[id]; } });
    rebuildBObst(); if (BM.on) drawGrid();
    { const used = new Set(); Object.values(BUILT).forEach(({ it }) => (GAMECFG.footprint(it) || []).forEach(([i, j]) => used.add(j * GS.W + i))); floraMask(used); }
  }
  /* 建造模式 */
  const BM = { on: false, st: null, grid: null, lines: null, ghost: null, gkey: '', foot: null, sel: null, hideId: 0 };
  function drawGrid() {
    if (!BM.st) return; const occ = GAMECFG.homeOccupancy(BM.st), c = document.createElement('canvas'); c.width = GS.W; c.height = GS.H; const x = c.getContext('2d'), im = x.createImageData(GS.W, GS.H), d = im.data;
    const used = new Set(); Object.values(BUILT).forEach(({ it }) => (GAMECFG.footprint(it) || []).forEach(([i, j]) => used.add(j * GS.W + i)));
    for (let k = 0; k < GS.W * GS.H; k++) { const o = k * 4, oc = occ.cells[k]; if (used.has(k)) { d[o] = 250; d[o + 1] = 190; d[o + 2] = 60; d[o + 3] = 110; } else if (oc) { d[o] = 200; d[o + 1] = 70; d[o + 2] = 50; d[o + 3] = 60; } else { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = 40; } }
    x.putImageData(im, 0, 0); const t = new T.CanvasTexture(c); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.encoding = T.sRGBEncoding; t.flipY = true;
    if (!BM.grid) { const pw = GS.W * GS.cell, ph = GS.H * GS.cell, pg = new T.PlaneGeometry(pw, ph); pg.rotateX(-Math.PI / 2);
      BM.grid = new T.Mesh(pg, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, map: t })); BM.grid.position.set(GS.x0 + pw / 2, 0.05, GS.z0 + ph / 2); BM.grid.renderOrder = 5;
      const lc = mkCanvas(32), lx = lc.getContext('2d'); lx.strokeStyle = 'rgba(255,255,255,0.55)'; lx.lineWidth = 2; lx.strokeRect(0, 0, 32, 32); const lt = new T.CanvasTexture(lc); lt.wrapS = lt.wrapT = T.RepeatWrapping; lt.repeat.set(GS.W, GS.H);
      BM.lines = new T.Mesh(pg, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, map: lt, opacity: 0.5 })); BM.lines.position.copy(BM.grid.position); BM.lines.position.y = 0.06; BM.lines.renderOrder = 6; }
    else { BM.grid.material.map.dispose(); BM.grid.material.map = t; BM.grid.material.needsUpdate = true; }
    if (!BM.grid.parent) scene.add(BM.grid, BM.lines);
  }
  function buildMode(on, st) { BM.on = !!on; BM.st = st || BM.st;
    BM.stKey = ''; if (BM.on) { builtKey = ''; drawGrid(); } else { if (BM.grid) scene.remove(BM.grid, BM.lines); setGhost(null); setBuildSel(0); BM.hideId = 0; builtKey = ''; } }
  function setBuildState(st, hideId) { const k = JSON.stringify(st) + '|' + (hideId || 0); if (k === BM.stKey) return; BM.stKey = k; BM.st = st; BM.hideId = hideId || 0; builtKey = ''; }
  /* 预览：g = { type, gx, gz, rot, ok }；null 隐藏 */
  function setGhost(g) {
    const k = g ? [g.type, g.gx, g.gz, g.rot, g.ok, g.stage | 0].join(':') : ''; if (k === BM.gkey) return; BM.gkey = k;
    if (BM.ghost) { scene.remove(BM.ghost); BM.ghost = null; } if (BM.foot) { scene.remove(BM.foot); BM.foot.geometry.dispose(); BM.foot = null; } if (!g || !BDEF[g.type]) return;
    const R = bRect(g); BM.ghost = bModel(g.type, BDEF[g.type].kind === 'wonder' ? g.stage | 0 : undefined).clone(); BM.ghost.position.set(R.cx, 0.02, R.cz); BM.ghost.rotation.y = -(g.rot | 0) * Math.PI / 2; scene.add(BM.ghost);
    const fg = new T.PlaneGeometry(R.w - 0.12, R.d - 0.12); fg.rotateX(-Math.PI / 2); BM.foot = new T.Mesh(fg, new T.MeshBasicMaterial({ color: g.ok ? 0x4ad66a : 0xff4a3a, transparent: true, opacity: 0.5, depthWrite: false })); BM.foot.position.set(R.cx, 0.08, R.cz); BM.foot.renderOrder = 7; scene.add(BM.foot);
  }
  function setBuildSel(id) { BM.sel = id || 0; Object.values(BUILT).forEach(({ o, it }) => o.traverse(c => { if (c.isMesh) { if (it.id === BM.sel) { if (!c.userData.m0) { c.userData.m0 = c.material; c.material = c.material.clone(); c.material.emissive = new T.Color('#ffcc33'); c.material.emissiveIntensity = 0.16; } } else if (c.userData.m0) { c.material.dispose(); c.material = c.userData.m0; delete c.userData.m0; } } })); }
  const gplane = new T.Plane(new T.Vector3(0, 1, 0), 0), gpt = new T.Vector3();
  function rayAt(cx, cy) { const r = canvasEl.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  /* 屏幕坐标 → 格子（建筑的左上角格子按宽高居中） */
  function cellAt(cx, cy, type, rot) { rayAt(cx, cy); if (!ray.ray.intersectPlane(gplane, gpt)) return null; const b = BDEF[type] || { w: 1, d: 1 }, odd = (rot | 0) % 2 === 1, w = odd ? b.d : b.w, d = odd ? b.w : b.d;
    return [Math.round((gpt.x - GS.x0) / GS.cell - w / 2), Math.round((gpt.z - GS.z0) / GS.cell - d / 2)]; }
  function builtAt(cx, cy) { rayAt(cx, cy); const objs = Object.values(BUILT).map(b => b.o), h = ray.intersectObjects(objs, true)[0]; if (h) return h.object.userData.bid || 0;
    if (!ray.ray.intersectPlane(gplane, gpt)) return 0; const gi = Math.floor((gpt.x - GS.x0) / GS.cell), gj = Math.floor((gpt.z - GS.z0) / GS.cell); const f = Object.values(BUILT).find(({ it }) => (GAMECFG.footprint(it) || []).some(([i, j]) => i === gi && j === gj)); return f ? f.it.id : 0; }
  /* 屏幕中心对应的格子（选好建筑时先放在画面中间） */
  function centerCell(type, rot) { const r = canvasEl.getBoundingClientRect(); return cellAt(r.left + r.width / 2, r.top + r.height * 0.45, type, rot); }
  function buildIcon(type) { const key = 'b:' + type; if (ICONS[key] !== undefined) return ICONS[key]; try { ensureIconRenderer(); const m = bModel(type, BDEF[type] && BDEF[type].kind === 'wonder' ? 5 : undefined).clone(); m.rotation.y = -0.6; IS.add(m); const box = new T.Box3().setFromObject(m), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.7;
    IC.position.set(c.x + r * 1.6, c.y + r * 1.3, c.z + r * 2.2); IC.lookAt(c); IC.updateProjectionMatrix(); IR.render(IS, IC); ICONS[key] = IR.domElement.toDataURL(); IS.remove(m); iconSave(); } catch (e) { ICONS[key] = ''; } return ICONS[key]; }
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(cx, cy) { if (!ready || ZONE) return -1; const r = canvasEl.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(hitBoxes, false).filter(x => (!x.object.userData.dog || (x.object.userData.dog.g.visible && anim.dogs.includes(x.object.userData.dog))) && (!x.object.parent || x.object.parent.visible !== false)); return h.length ? (h[0].object.userData.dog ? -20 - anim.dogs.indexOf(h[0].object.userData.dog) : h[0].object.userData.idx) : -1; }
  function nearKennel() { return viewMode === 'walk' && Math.hypot(HERO.pos.x - ST.doghouse.x, HERO.pos.z - ST.doghouse.z) < 2.4; }
  function screenOf(i, y) { const v = P0(i, y || 0.6).project(cam); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H }; }
  let simK = 1; const GAITS_REF = {}; // 调试用：加快动画时间
  /* V0.3 区域系统：不在家园时，渲染器改画当前区域自己的场景和镜头（家园暂停，不响应点击） */
  let ZONE = null;
  function useZone(z) { ZONE = z || null; if (ZONE && ZONE.resize) ZONE.resize(W, H); }
  function render(dt) {
    if (!ready) return; dt *= simK;
    if (ZONE) { ZONE.update(dt); R.render(ZONE.scene, ZONE.camera); return; }
    tNow += dt; const t = tNow; perfTick(dt); seasonTick(dt, t); updateCritters(dt, t); wildCull(); floraCull(); { const tg = SEA.id === 'winter' ? 1 : 0; SNOWU.value += (tg - SNOWU.value) * Math.min(1, dt * 0.8); if (Math.abs(tg - SNOWU.value) < 0.002) SNOWU.value = tg; } { const nw = performance.now(); if (nw - SEA.sk > 3000) { SEA.sk = nw; snowifyScene(); if (SEA.id && seasonCollect()) { const id = SEA.id; SEA.id = ''; setSeason(id); } } }   /* 后生成的菜地、建筑也要换季节颜色、加积雪 */
    updateHero(dt); if (viewMode === 'walk') updateWalkCam(dt); else if (panGoal.v) { if (!panGoal.s) { panGoal.s = pan.clone(); panGoal.t0 = performance.now(); } const k = Math.min(1, (performance.now() - panGoal.t0) / 450), e = 1 - Math.pow(1 - k, 3); pan.copy(panGoal.s).lerp(panGoal.v, e); if (k >= 1) { panGoal.v = null; panGoal.s = null; } applyCam(); } updateRanch(dt, tNow);
    const E = envAt(envState.hour), rk = envState.rain;
    const grey = new T.Color('#8a96a8');
    skyU.top.value.copy(E.top).lerp(grey.clone().multiplyScalar(0.7), rk * 0.7); skyU.hor.value.copy(E.hor).lerp(grey, rk * 0.6); skyU.night.value = E.night * (1 - rk);
    const ang = ((envState.hour - 6) / 12) * Math.PI, sy = Math.sin(ang), day = E.night < 0.5;
    const sd = day ? v3(Math.cos(ang) * -0.9 + 0.3, Math.max(0.25, sy), 0.55).normalize() : v3(-0.4, 0.7, 0.5).normalize();
    skyU.sunDir.value.copy(sd); skyU.sunCol.value.copy(E.sun).multiplyScalar(day ? 1 - rk : 0.15);
    sun.position.copy(target).addScaledVector(sd, 50); sun.color.copy(E.sun); sun.intensity = E.si * (1 - rk * 0.6);
    hemi.color.copy(E.hor).lerp(new T.Color('#ffffff'), 0.3); hemi.groundColor.set('#4a5a2a').lerp(new T.Color('#101828'), E.night); hemi.intensity = E.hi * (1 - rk * 0.2) + rk * 0.15;
    { const w = SNOWU.value; if (w > 0.001) { skyU.hor.value.lerp(new T.Color('#e6ecf2'), 0.5 * w); skyU.top.value.lerp(new T.Color('#a7b6c6'), 0.45 * w); sun.intensity *= 1 - 0.25 * w; } }   /* 冬天：天空灰白，阳光弱一点 */
    R.toneMappingExposure = E.ex; scene.fog.color.copy(skyU.hor.value);
    const nightK = E.night; anim.windows.forEach(m => m.emissiveIntensity = nightK * 1.4); if (LAMPM) LAMPM.emissiveIntensity = nightK * 2.2; if (LAMPG) LAMPG.opacity = Math.max(0, nightK - 0.15) * 0.9; doorLamp.intensity = nightK * 1.6;
    anim.fireflies.visible = nightK > 0.4 && SEA.id !== 'winter'; if (anim.fireflies.visible) { const p = anim.fireflies.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(t * 1.5 + i) * 0.004); p.needsUpdate = true; anim.fireflies.material.opacity = (0.5 + 0.5 * Math.sin(t * 3)) * nightK; }
    anim.rain.visible = rk > 0.02; if (anim.rain.visible) { anim.rain.material.opacity = 0.45 * rk; const p = anim.rain.geometry.attributes.position, a = p.array; for (let i = 0; i < a.length; i += 6) { a[i + 1] -= dt * 22; a[i + 4] -= dt * 22; if (a[i + 4] < 0) { a[i + 1] += 30; a[i + 4] += 30; } } p.needsUpdate = true; anim.rain.position.copy(target); }
    anim.grassU.value = t;
    if (anim.windmill) anim.windmill.rotation.z = -t * (0.5 + rk * 0.8);
    if (anim.water) { anim.water.normalMap.offset.set(t * 0.02, t * 0.013); }
    anim.clouds.forEach((c, i) => { c.position.x += dt * (0.6 + i * 0.1); if (c.position.x > 110) c.position.x = -110; });
    anim.smoke.forEach(s => { const k = (t * 0.25 + s.userData.ph) % 1; s.position.copy(anim.house.smokeAt).applyMatrix4(new T.Matrix4().makeRotationY(ST.house.ry)).add(v3(ST.house.x, 0, ST.house.z)); s.position.y += k * 3; s.position.x += Math.sin(k * 4 + s.userData.ph * 6) * 0.3 + k * 0.6; s.scale.setScalar(0.5 + k * 1.4); s.material.opacity = 0.45 * (1 - k) * (1 - nightK * 0.5); });
    anim.chickens.forEach(c => { c.pk -= dt; const m = c.m; if (c.pk > 0) { m.rotation.z = Math.sin(t * 12) * 0.05; return; } const dx = c.tx - m.position.x, dz = c.tz - m.position.z, d = Math.hypot(dx, dz); if (d < 0.1) { if (Math.random() < 0.5) c.pk = 1 + Math.random() * 2.5; else { c.tx = c.home.x + (Math.random() - 0.5) * 5; c.tz = c.home.z + (Math.random() - 0.5) * 3; } } else { const s = Math.min(d, dt * 0.9); m.position.x += dx / d * s; m.position.z += dz / d * s; m.rotation.y = Math.atan2(-dz, dx); m.position.y = Math.abs(Math.sin(t * 10)) * 0.04; } });
    anim.butterflies.forEach(b => { const p = b.ph; b.g.position.set(Math.sin(t * 0.3 + p) * 9, 1.2 + Math.sin(t * 1.3 + p) * 0.4, Math.cos(t * 0.23 + p * 2) * 6.5); b.g.rotation.y = t * 0.3 + p; const f = Math.sin(t * 18 + p) * 1.1; b.lp.rotation.y = f; b.rp.rotation.y = -f; });
    // ===== 狗狗动画：行为 + 移动控制 + 脚踏实地的步态 =====
    const KEN = { x: ST.doghouse.x, z: ST.doghouse.z };
    const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
    // 朝目标移动：有加速、减速、转向速度限制（不会原地瞬间转身、也不会急停滑行）
    const moveDog = (dg, tx, tz, vmax, stop) => { const p = dg.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      let want = d <= stop ? 0 : Math.min(vmax, Math.sqrt(2 * 4.5 * Math.max(0, d - stop)));
      if (d > 0.05) { const da = wrapA(Math.atan2(-dz, dx) - dg.g.rotation.y), mt = dt * (2.6 + dg.vel * 0.9); if (Math.abs(da) > 1.3) want *= 0.25; const tr = Math.max(-mt, Math.min(mt, da)); dg.g.rotation.y += tr; dg.turn = tr / Math.max(dt, 1e-3); } else dg.turn = 0;
      dg.vel += Math.max(-7 * dt, Math.min(5 * dt, want - dg.vel)); if (dg.vel < 0.01 && want === 0) dg.vel = 0;
      const ry = dg.g.rotation.y; p.x += Math.cos(ry) * dg.vel * dt; p.z -= Math.sin(ry) * dg.vel * dt; return d; };
    const faceTo = (dg, tx, tz, rate) => { const p = dg.g.position; const da = wrapA(Math.atan2(-(tz - p.z), tx - p.x) - dg.g.rotation.y); dg.g.rotation.y += da * Math.min(1, dt * (rate || 4)); dg.turn = 0; };
    // 看家时的随机行为：站着张望 / 闻闻地面 / 小跑溜达 / 坐下 / 趴着 / 撒欢跑一圈
    const pickBeh = (dg, k) => { const r = Math.random(), h = dg.home, spot = (R) => { for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, rr = 0.6 + Math.random() * R, x = h.x + Math.cos(a) * rr, z = h.z + Math.sin(a) * rr; if (x > 9.1 && Math.hypot(x - KEN.x, z - KEN.z) > 1.4 && Math.hypot(x - 14, z - 3) > 1.2) return [x, z]; } return [h.x, h.z]; };
      if (r < 0.22) return { k: 'idle', t: 2 + Math.random() * 3 }; if (r < 0.42) { const [x, z] = spot(2.2); return { k: 'sniff', x, z, t: 9 }; }
      if (r < 0.7) { const [x, z] = spot(2.8); return { k: 'trot', x, z, v: 1.6 + Math.random() * 1.4, t: 8 }; } if (r < 0.82) return { k: 'sit', t: 4 + Math.random() * 5 };
      if (r < 0.88) return { k: 'lie', t: 5 + Math.random() * 6 }; if (r < 0.95) return { k: 'drink', t: 60 }; const [x, z] = spot(3.2); return { k: 'zoom', x, z, v: 5.2, t: 6, back: true }; };
    // 绕开中间农田的篱笆：路线穿过农田时先走到农田外角
    const routeAround = (a, b) => { const crosses = (p0, p1) => { for (let i = 1; i < 20; i++) { const x = p0.x + (p1.x - p0.x) * i / 20, z = p0.z + (p1.z - p0.z) * i / 20; if (Math.abs(x) < 9 && Math.abs(z) < 6.9) return true; } return false; };
      if (!crosses(a, b)) return [b]; let best = null, bl = 1e9; [[9.8, 7.6], [-9.8, 7.6], [9.8, -7.6], [-9.8, -7.6]].forEach(([x, z]) => { const c = v3(x, 0, z), l = a.distanceTo(c) + c.distanceTo(b) + (crosses(a, c) || crosses(c, b) ? 50 : 0); if (l < bl) { bl = l; best = c; } }); return [best, b]; };
    const makeTrip = (dg, backTo) => { const p = dg.g.position; let bp = null, bd = 1e9; for (let i = 0; i < RANCH3.ponds; i++) { const [x, z] = PONDS[i], d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; bp = v3(x, 0, z); } } if (!bp || bd > 40) return null;
      const u = v3(p.x - bp.x, 0, p.z - bp.z).normalize(), e = v3(bp.x + u.x * 4.3, 0, bp.z + u.z * 3.7), pos = p.clone(); return { stage: 'go', pts: routeAround(pos, e), i: 0, v: 3.2, pond: bp, back: backTo ? routeAround(e, backTo.clone()) : [] }; };
    const animDog = (dg, k, m) => { const ph = t + k * 1.7, p = dg.g.position; if (dg.vel === undefined) { dg.vel = 0; dg.turn = 0; } if (!dg.home) dg.home = p.clone();
      dg.pose = 'stand'; dg.look = null; dg.headDown = 0; dg.excite = 0; dg.lap = false; dg.legs.forEach(l => l.visible = true); dg.torso.scale.y = 1; dg.tongue.visible = true; dg.head.position.y = 0.94;
      const heroNear = viewMode === 'walk' && HERO.pos.x > 8.7 && HERO.pos.z < 6.5 && Math.hypot(HERO.pos.x - p.x, HERO.pos.z - p.z) < 3.2; // 主人在狗窝这边时才跑过去（不穿过篱笆）
      if (dg.pet > 0) { dg.pet -= dt; moveDog(dg, p.x, p.z, 0, 1); faceTo(dg, HERO.pos.x, HERO.pos.z, 6); dg.excite = 1; dg.look = HERO.pos; dg.hop = Math.abs(Math.sin(ph * 8)) * 0.06; if (m === 'sleep') dg.pose = 'stand'; return; }
      dg.hop = 0;
      if (m === 'herd') { dg.trip = null; const T0 = RANCH3.dogT || v3(PAST.cx, 0, PAST.z1 + 1.5), d = Math.hypot(T0.x - p.x, T0.z - p.z);
        moveDog(dg, T0.x, T0.z, d > 2.5 ? 6.2 : d > 0.8 ? 3.6 : 1.6, 0.25); dg.herding = true; dg.beh = null;
        if (RANCH3.dogRest && dg.vel < 0.2) { dg.pose = 'lie'; faceTo(dg, PAST.cx, PAST.cz, 2); } else if (dg.vel < 1.8) { dg.pose = 'stalk'; dg.headDown = 0.25; } // 边牧的“盯羊”低姿态
        const sh = RANCH3.sheep[0]; if (sh) dg.look = sh.m.g.position; return; }
      if (dg.herding) { // 牧羊结束：小跑回狗窝
        if (moveDog(dg, dg.home.x, dg.home.z, 3.5, 0.2) < 0.3) dg.herding = false; return; }
      if (m === 'sleep') { dg.trip = null; moveDog(dg, p.x, p.z, 0, 1); dg.vel = 0; dg.pose = 'sleep'; dg.tongue.visible = false; return; }
      if (m === 'bark') { moveDog(dg, p.x, p.z, 0, 1); faceTo(dg, 0, 0, 5); dg.excite = 0.8; dg.hop = Math.abs(Math.sin(ph * 14)) * 0.1; dg.barkT = ph; return; }
      // 去鱼塘喝水（看家的狗时不时去；跟着主人的狗在主人站着不动时也会去）
      if (dg.trip) { const TP = dg.trip, pt = TP.pts[TP.i];
        if (TP.stage !== 'drink') { if (!pt) { if (TP.stage === 'go') { TP.stage = 'drink'; TP.t = 4 + Math.random() * 4; } else dg.trip = null; return; } const d = moveDog(dg, pt.x, pt.z, TP.v, 0.25); if (d < 0.4) TP.i++; dg.look = null; return; }
        moveDog(dg, p.x, p.z, 0, 1); faceTo(dg, TP.pond.x, TP.pond.z, 3); dg.headDown = 1; dg.lap = true; TP.t -= dt; if (TP.t <= 0) { TP.stage = 'back'; TP.pts = TP.back; TP.i = 0; if (!TP.back.length) dg.trip = null; } return; }
      // 跟着主人：沿着主人走过的路走，主人停下就坐在旁边看着，站久了会去喝口水
      if (RANCH3.follow === dg.did) { const tr = HERO.trail || [], dh = Math.hypot(HERO.pos.x - p.x, HERO.pos.z - p.z); dg.beh = null;
        if (dh > 30) { p.set(HERO.pos.x - Math.sin(HERO.face) * 2.2, 0, HERO.pos.z - Math.cos(HERO.face) * 2.2); dg.vel = 0; if (dg.lp) dg.lp.copy(p); }
        let tg = HERO.pos, acc = 0; for (let i = tr.length - 1; i > 0; i--) { acc += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].z - tr[i - 1].z); if (acc >= 1.7) { tg = tr[i - 1]; break; } }
        const idle = HERO.spd < 0.2; dg.idleT = idle ? (dg.idleT || 0) + dt : 0;
        if (!idle || dh > 2.4) moveDog(dg, tg.x, tg.z, dh > 7 ? 6.6 : dh > 3.2 ? 4.4 : 2.6, idle ? 1.3 : 0.4);
        else { moveDog(dg, p.x, p.z, 0, 1); faceTo(dg, HERO.pos.x, HERO.pos.z, 3); if (dg.idleT > 4) dg.pose = dg.idleT > 20 ? 'lie' : 'sit'; }
        dg.look = HERO.pos; dg.excite = idle ? 0.25 : 0.45;
        if (dg.idleT > 10 && Math.random() < dt * 0.06) { const tp = makeTrip(dg, null); if (tp) dg.trip = tp; }
        return; }
      // 主人走过来：跑过去迎接，围着转、看着主人
      if (heroNear) { const hx = HERO.pos.x, hz = HERO.pos.z; const d = moveDog(dg, hx, hz, 3.2, 0.95); if (d < 1.3) faceTo(dg, hx, hz, 5); dg.look = HERO.pos; dg.excite = 0.7; dg.beh = null; return; }
      if (!dg.beh || dg.beh.t <= 0) dg.beh = pickBeh(dg, k); const B = dg.beh; B.t -= dt;
      if (B.k === 'idle') { moveDog(dg, p.x, p.z, 0, 1); if (!B.lk || Math.random() < dt * 0.6) B.lk = v3(p.x + (Math.random() - 0.5) * 8, 0.5, p.z + (Math.random() - 0.5) * 8); dg.look = B.lk; }
      else if (B.k === 'sniff') { const d = moveDog(dg, B.x, B.z, 0.7, 0.15); dg.headDown = 0.6; dg.sniff = true; if (d < 0.2) B.t = Math.min(B.t, 1.2); }
      else if (B.k === 'trot' || B.k === 'zoom') { const d = moveDog(dg, B.x, B.z, B.v, 0.2); if (d < 0.25) { if (B.k === 'zoom' && B.back) { B.back = false; B.x = dg.home.x + (Math.random() - 0.5); B.z = dg.home.z + (Math.random() - 0.5); } else B.t = 0; } if (B.k === 'zoom') dg.excite = 0.9; }
      else if (B.k === 'sit') { moveDog(dg, p.x, p.z, 0, 1); if (dg.vel < 0.05) dg.pose = 'sit'; if (!B.lk || Math.random() < dt * 0.4) B.lk = v3(p.x + (Math.random() - 0.5) * 8, 0.6, p.z + (Math.random() - 0.5) * 8); dg.look = B.lk; }
      else if (B.k === 'lie') { moveDog(dg, p.x, p.z, 0, 1); if (dg.vel < 0.05) dg.pose = 'lie'; }
      else if (B.k === 'drink') { const tp = makeTrip(dg, dg.home); if (tp) dg.trip = tp; B.t = 0; }
    };
    // 步态与姿态：腿的摆动按真实走过的距离推进（脚落地时不打滑），按速度切换 走 / 小跑 / 奔跑
    const GAITS = GAITS_REF.g = { walk: { off: [0.25, 0.75, 0, 0.5], st: 0.64, A: 0.3 }, trot: { off: [0, 0.5, 0.5, 0], st: 0.5, A: 0.42 }, gallop: { off: [0, 0.12, 0.52, 0.64], st: 0.4, A: 0.62 } };
    const smooth = x => x * x * (3 - 2 * x);
    /* 身体在倾斜 a 时、躯干局部坐标里最低点的 y（按顶点算，结果按 狗种类 + 角度 缓存） */
    const LOWC = {}; const bodyLow = (dg, a) => { const key = dg.kind + ':' + a.toFixed(2); if (LOWC[key] !== undefined) return LOWC[key]; const g = DOG_GEO[dg.kind] && DOG_GEO[dg.kind].torso; if (!g) return 0.4; const p = g.attributes.position, c = Math.cos(a), s2 = Math.sin(a); let lo = 9; for (let i = 0; i < p.count; i += 3) { const y = p.getX(i) * s2 + p.getY(i) * c; if (y < lo) lo = y; } return (LOWC[key] = lo); };
    const dogLive = (dg, k, m) => {
      const v = dg.vel || 0, gk = v < 1.5 ? 'walk' : v < 4.2 ? 'trot' : 'gallop', G = GAITS[gk], hip = 0.355 * (dg.g.scale.x || 1);
      if (!dg.off) dg.off = G.off.slice(); dg.off = dg.off.map((o, j) => { let d = G.off[j] - o; d -= Math.round(d); return o + d * Math.min(1, dt * 4); });
      dg.st = dg.st === undefined ? G.st : dg.st + (G.st - dg.st) * Math.min(1, dt * 4); dg.A = dg.A === undefined ? G.A : dg.A + (G.A - dg.A) * Math.min(1, dt * 4);
      const mk = Math.min(1, v / 0.25), cyc = Math.max(0.05, 2 * hip * Math.sin(dg.A * mk) / dg.st); dg.phi = ((dg.phi || 0) + v * dt / cyc) % 1; const phi = dg.phi;
      const pose = dg.force || dg.pose, tor = dg.torso; let bob = 0, pitch = 0, roll = 0; if (dg.force) dg.vel = 0;
      /* v3.3 静态姿势贴地：按身体实际最低点放到地面上（不陷地），每条腿的长度按髋部高度算到脚掌刚好着地（不悬空、不消失） */
      if (pose === 'sleep' || pose === 'lie' || pose === 'sit') {
        const a = pose === 'sit' ? 0.42 : 0, ca = Math.cos(a), sa = Math.sin(a), PR = 0.03;
        tor.rotation.set(0, 0, a); const ty = (pose === 'sit' ? 0.012 : 0.03) - bodyLow(dg, a); tor.position.y = ty + (pose === 'sit' ? 0 : Math.sin(t * 1.8 + k) * 0.004);
        tor.scale.y = pose === 'sit' ? 1 : 1 + Math.sin(t * 1.8 + k) * 0.02;
        dg.legs.forEach((l, j) => { l.visible = true; const hx = l.position.x, hy = l.position.y, side = l.position.z > 0 ? 1 : -1, hipY = hx * sa + hy * ca + ty;
          let rz, rx = 0, len;
          if (pose === 'sit') { rz = j < 2 ? -a - 0.05 : 0.62; rx = j < 2 ? 0 : side * 0.16; }
          else { rz = j < 2 ? 1.32 : 1.56; rx = j < 2 ? side * 0.06 : side * 0.16; }
          const cy = Math.cos(rz) * Math.cos(rx) * ca - Math.sin(rz) * sa; /* 腿方向向下的分量（躯干倾斜 a，腿先绕 z 再绕 x 转） */
          len = cy > 0.18 ? (hipY - PR) / cy : (j < 2 ? 0.3 : 0.31); len = Math.max(0.16, Math.min(0.46, len));
          l.rotation.set(rx, 0, rz); l.scale.y = len / 0.355; });
        if (pose === 'sit') dg.head.rotation.set(0, 0, -0.3);
        else { dg.head.position.y = pose === 'sleep' ? 0.8 : 0.9; dg.head.rotation.set(pose === 'sleep' ? 0.12 : 0, pose === 'sleep' ? 0.25 : Math.sin(t * 0.4 + k) * 0.4, pose === 'sleep' ? -0.42 : -0.05); dg.tongue.visible = pose !== 'sleep'; }
      }
      else {
        dg.legs.forEach((l, j) => { const u = ((phi + dg.off[j]) % 1 + 1) % 1; let a, lift = 0; const sA = Math.sin(dg.A * mk); if (u < dg.st) a = Math.asin(sA - 2 * sA * (u / dg.st)); else { const w = (u - dg.st) / (1 - dg.st); a = Math.asin(-sA + 2 * sA * smooth(w)); lift = Math.sin(Math.PI * w); }
          // 着地时脚在地面上匀速向后（与身体前进速度一致），并补偿腿斜着时的高度，脚掌贴地不滑
          l.rotation.x = 0; l.rotation.z = a; l.scale.y = 0.92 * (u < dg.st ? 1 / Math.cos(a) : 1 - lift * 0.28 * mk); (dg.la || (dg.la = [0, 0, 0, 0]))[j] = a; (dg.ll || (dg.ll = [0, 0, 0, 0]))[j] = lift * mk; });
        if (gk === 'gallop') { bob = Math.sin(phi * Math.PI * 2) * 0.05 * mk + 0.02; pitch = Math.sin(phi * Math.PI * 2 + 1.2) * 0.09 * mk; }
        else { bob = Math.abs(Math.cos(phi * Math.PI * 2)) * (gk === 'trot' ? 0.028 : 0.014) * mk; pitch = -0.03 * mk; roll = Math.sin(phi * Math.PI * 2) * (gk === 'walk' ? 0.035 : 0.02) * mk; }
        if (pose === 'stalk') { bob -= 0.06; pitch -= 0.06; }
        roll += -(dg.turn || 0) * 0.06; tor.rotation.set(Math.max(-0.2, Math.min(0.2, roll)), 0, pitch); tor.position.y = DOG_BASE_Y + bob + (dg.hop || 0);
        // 头：看向目标（转头有限度），身体俯仰时头保持平稳，闻地面时低头一点一点
        let yaw = 0; if (dg.look) { const p = dg.g.position; yaw = wrapA(Math.atan2(-(dg.look.z - p.z), dg.look.x - p.x) - dg.g.rotation.y); yaw = Math.max(-0.9, Math.min(0.9, yaw)); }
        dg.hy = (dg.hy || 0) + (yaw - (dg.hy || 0)) * Math.min(1, dt * 4);
        const nod = dg.sniff ? Math.sin(t * 9) * 0.08 : dg.lap ? Math.sin(t * 11) * 0.09 : 0; dg.head.rotation.set(dg.excite ? Math.sin(t * 5) * 0.12 * dg.excite : 0, dg.hy, -pitch * 0.9 - (dg.headDown || 0) * 0.6 + nod + (m === 'bark' ? Math.sin(t * 20) * 0.15 : 0.04));
        dg.head.position.y = 0.94 - (dg.headDown || 0) * 0.1 - bob * 0.3; }
      dg.sniff = false;
      /* 眼睛：睡觉闭眼，醒着时偶尔眨眼 */
      { const E = dg.head.userData.eyes; if (E) { dg.bk = (dg.bk === undefined ? 1 + Math.random() * 3 : dg.bk) - dt; if (dg.bk < 0) dg.bk = 2.5 + Math.random() * 4; const shut = pose === 'sleep' ? 0.12 : dg.bk < 0.11 ? 0.15 : 1; E.forEach(([e, s1, s2]) => { e.scale.y = shut; s1.visible = s2.visible = shut === 1; }); } }
      dg.tongue.scale.y = 0.048 * (1 + (v > 2 ? 0.35 : 0) + Math.sin(t * (v > 2 ? 12 : 6)) * 0.15);
      // 尾巴：越兴奋摇得越快越开；跑起来抬高；趴着、睡觉时轻摆
      const ex = dg.excite || 0, freq = pose === 'sleep' ? 1.2 : 4.5 + ex * 13 + Math.min(4, v), amp = pose === 'sleep' ? 0.08 : pose === 'stalk' ? 0.12 : 0.3 + ex * 0.7 + Math.min(0.25, v * 0.05) + Math.max(0, Math.sin(t * 0.37 + k)) * 0.15;
      dg.wag = (dg.wag || 0) + dt * freq; dg.tail.rotation.y = Math.sin(dg.wag) * amp * 0.55; dg.tail.rotation.z = pose === 'sleep' || pose === 'lie' ? 0 : pose === 'stalk' ? -0.15 : 0.1 + Math.min(0.3, v * 0.06) + ex * 0.25;
      if (NC.on && NC.dogs[dg.did] && !dg.rig) ncAttachDog(dg);
      if (dg.rig) { const R = dg.rig.rig, still = pose === 'sleep' || pose === 'lie' || pose === 'sit', moving = !still && v > 0.15;
        R.play(pose === 'sleep' ? 'sleep' : pose === 'lie' ? 'lie_idle' : pose === 'sit' ? 'sit_idle' : v > 4.6 ? 'sprint' : v > 2.6 ? 'gallop' : v > 1.0 ? 'trot' : moving ? 'walk' : 'idle'); R.pace(v, NC_SCALE.dog); R.update(dt);
        if (R.faked) R.dogGait({ a: moving ? dg.la : null, lift: dg.ll, yaw: still ? 0 : dg.hy || 0, pitch: still ? 0 : -(dg.headDown || 0) * 0.5 + (dg.sniff || dg.lap ? Math.sin(t * 10) * 0.08 : 0), wag: Math.sin(dg.wag) * amp * 0.5 });
        dg.rig.wrap.position.y = moving ? bob + (dg.hop || 0) : dg.hop || 0; }
      const mv = Math.min(1, v / 4.5), U = dg.U; if (U) { U.uT.value = t + k * 3; U.uMove.value = mv; U.uBob.value = mk * Math.cos(phi * Math.PI * 4) * Math.min(1, v / 2); U.uWagPh.value = dg.wag; U.uWagA.value = amp; U.uLift.value = mv * 0.5 + ex * 0.4; }
    };
    { const fol = viewMode === 'walk' ? anim.dogs.find(d => d.g.visible && (dogMode[d.did] === 'guard' || dogMode[d.did] === 'bark') && !(RANCH3.route && d.did === RANCH3.herd.dog)) : null; RANCH3.follow = fol ? fol.did : ''; }
    anim.dogs.forEach((dg, k) => { const m0 = dogMode[dg.did] || 'none', m = RANCH3.route && dg.did === RANCH3.herd.dog && m0 !== 'none' && m0 !== 'sleep' ? 'herd' : m0; dg.g.visible = m !== 'none'; if (!dg.g.visible) return; animDog(dg, k, m); dogLive(dg, k, m); });
    // 农田动态
    plots.forEach((pl, i) => {
      if (pl.crop) { pl.crop.rotation.z = Math.sin(t * 1.4 + pl.sway) * 0.025; pl.crop.rotation.x = Math.cos(t * 1.1 + pl.sway) * 0.02; }
      pl.badges.forEach((s, j) => { s.position.y = s.userData.base.y + Math.sin(t * 3 + j + i) * 0.08; });
      pl.sparks.forEach(s => { const k = (t * 0.6 + s.userData.ph) % 1, a = s.userData.ph * 6.28 + t * 0.5; s.position.set(Math.cos(a) * s.userData.r, BED_H + 0.2 + k * (pl.cropH + 0.4), Math.sin(a) * s.userData.r); s.material.opacity = Math.sin(k * Math.PI); s.scale.setScalar(0.18 + 0.22 * Math.sin(k * Math.PI)); });
      if (pl.bug) { const a = t * 1.2 + i; pl.bug.position.set(Math.cos(a) * 0.35, BED_H + pl.cropH * 0.45 + Math.sin(t * 2.3) * 0.05, Math.sin(a) * 0.35); pl.bug.rotation.y = -a; }
    });
    const hi = hoverIdx >= 0 ? hoverIdx : viewMode === 'walk' ? nearIdx : -1;
    if (hi >= 0) { const [x, z] = plotXZ(hi); hoverFrame.visible = true; hoverFrame.position.set(x, BED_H + 0.09, z); hoverFrame.material.opacity = 0.65 + Math.sin(t * 6) * 0.3; } else hoverFrame.visible = false;
    updateFx(dt);
    R.render(scene, cam);
  }

  /* ---------------- 作物图标（离屏渲染 3D 模型） ---------------- */
  let IR, IS, IC; const ICONS = {};
  /* 作物图标（V0.4）：生成要单独开一个 3D 画布，比较慢。
     ① 存在本机（按版本号），下次打开直接用；② 游戏画面出来之前先放占位图，画面出来后再一个个生成、替换 */
  const ICON_LS = 'hf_ci_' + GAMECFG.VERSION, ICON_Q = []; let iconHold = true, iconSaveT = 0;
  try { Object.keys(localStorage).forEach(k => { if (k.startsWith('hf_ci_') && k !== ICON_LS) localStorage.removeItem(k); }); Object.assign(ICONS, JSON.parse(localStorage.getItem(ICON_LS) || '{}')); } catch (e) { }
  const iconPh = key => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C!--" + encodeURIComponent(key) + "--%3E%3C/svg%3E";
  function iconSave() { clearTimeout(iconSaveT); iconSaveT = setTimeout(() => { try { const ks = Object.keys(ICONS).filter(k => ICONS[k]).slice(-60), o = {}; ks.forEach(k => o[k] = ICONS[k]); localStorage.setItem(ICON_LS, JSON.stringify(o)); } catch (e) { try { localStorage.removeItem(ICON_LS); } catch (x) { } } }, 1500); }
  function iconPump() { const it = ICON_Q.shift(); if (!it) return; const [id, golden, key] = it; if (ICONS[key] === undefined) { iconHold = false; const u = cropIcon(id, golden), ph = iconPh(key); document.querySelectorAll('img').forEach(im => { if (im.getAttribute('src') === ph) im.src = u; }); } if (ICON_Q.length) setTimeout(iconPump, 30); }
  function releaseIcons() { if (!iconHold) return; iconHold = false; setTimeout(iconPump, 50); }
  function ensureIconRenderer() { if (IR) return; const c = document.createElement('canvas'); c.width = c.height = 160; IR = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); IR.outputEncoding = T.sRGBEncoding; IR.toneMapping = T.ACESFilmicToneMapping; IR.setClearColor(0x000000, 0); IS = new T.Scene(); IS.add(new T.HemisphereLight(0xffffff, 0x6a7a4a, 0.9)); const d = new T.DirectionalLight(0xfff4e0, 2.2); d.position.set(3, 5, 4); IS.add(d); IC = new T.PerspectiveCamera(28, 1, 0.1, 50); if (!TX.soil) buildTextures(); }
  function cropIcon(id, golden) {
    const key = id + (golden ? 'g' : ''); if (ICONS[key] !== undefined) return ICONS[key];
    if (iconHold) { if (!ICON_Q.some(q => q[2] === key)) ICON_Q.push([id, golden, key]); return iconPh(key); }
    try {
      ensureIconRenderer();
      const m = cropModel(id, 4).clone(); if (golden) { const gm = new T.MeshStandardMaterial({ color: new T.Color('#ffcc33'), metalness: 0.85, roughness: 0.28, emissive: new T.Color('#6a4400'), emissiveIntensity: 0.3 }); m.traverse(o => { if (o.isMesh) o.material = gm; }); }
      IS.add(m); const box = new T.Box3().setFromObject(m), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.68;
      IC.position.set(c.x + r * 2.2, c.y + r * 1.4, c.z + r * 2.4); IC.lookAt(c); IC.updateProjectionMatrix(); IR.render(IS, IC); ICONS[key] = IR.domElement.toDataURL(); IS.remove(m); iconSave();
    } catch (e) { ICONS[key] = ''; }
    return ICONS[key];
  }
  function zoomBy(f) { if (viewMode === 'walk') { camDistW = Math.max(3.5, Math.min(16, camDistW * f)); return; } zoom = Math.max(0.6, Math.min(2.6, zoom * f)); applyCam(); }
  return { useZone, get zone() { return ZONE; }, get renderer() { return R; }, get __scene() { return scene; }, zoomBy, info: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, progs: R.info.programs.length, q: quality, hits: hitBoxes.length, dogs: anim.dogs.length, objs: (() => { let n = 0, v = 0; scene.traverse(o => { if (o.isMesh || o.isSprite) { n++; let vis = true, q = o; while (q) { if (!q.visible) { vis = false; break; } q = q.parent; } if (vis) v++; } }); return n + '/' + v; })(), parts: parts.length, fish: RANCH3.fish.length, sheep: RANCH3.sheep.length, fpos: RANCH3.fish[0] ? RANCH3.fish[0].g.position.toArray().map(v => +v.toFixed(2)) : null }), get quality() { return quality; }, init, resize, render, setPlots, setMode, orbit, setInput, setHero, resetHero, get mode() { return viewMode; }, get near() { return viewMode === 'walk' ? nearIdx : -1; }, nearKennel, nearZone, setRanch, setPets, dogInfo: k => { const d = anim.dogs[k]; return d ? { did: d.did, name: d.name, kind: d.kind } : null; }, pondSplash, setField: f => { ACTF = Math.max(0, f | 0); pan.set(0, 0, 0); panGoal.v = null; if (viewMode !== 'walk') fit(); }, panBy, panTo, resetView, lookAt: k => { const p = SPOT[k] && SPOT[k](); if (p) panTo(p[0], p[1]); }, get panned() { return pan.length() > 1 || zoom > 1.35; }, worldBox, get pan() { return pan.toArray().map(v => +v.toFixed(2)); }, get zoom() { return zoom; }, get field() { return ACTF; }, fieldCenter: fieldC, setSimSpeed: k => { simK = k; }, dogFeet: k => { const dg = anim.dogs[k]; if (!dg) return null; dg.g.updateMatrixWorld(true); const G = GAITS_REF.g; return dg.legs.map((l, j) => { const v = new T.Vector3(0.022, -0.385, 0); l.localToWorld(v); const u = (((dg.phi || 0) + (dg.off ? dg.off[j] : 0)) % 1 + 1) % 1; return { x: v.x, y: v.y, z: v.z, st: u < (dg.st || 0.5), vel: dg.vel, pose: dg.pose, bx: dg.g.position.x, bz: dg.g.position.z, turn: dg.turn }; }); }, ranchDbg: () => ({ leg: RANCH3.leg, follow: RANCH3.follow, A: RANCH3.A && RANCH3.A.toArray().map(v => +v.toFixed(1)), phase: RANCH3.phase, hc: +(RANCH3.hc || 0).toFixed(1), zones: RANCH3.sheep.map(x => x.zone).join(''), dog: RANCH3.dogT && RANCH3.dogT.toArray().map(v => +v.toFixed(1)) }), teleport: (x, z, yaw) => { HERO.pos.set(x, 0, z); if (yaw !== undefined) camYaw = yaw; camFocus.set(x, 1, z); }, get nearDog() { return viewMode === 'walk' ? nearDog : -1; }, petDog, dbgDogCam: (k, yaw, pitch, dist) => { const dg = anim.dogs[k]; if (!dg) return null; const c = dg.g.position, cam2 = new T.PerspectiveCamera(32, W / H, 0.05, 80), d = dist || 2.2, a = dg.g.rotation.y + (yaw || 0); cam2.position.set(c.x + Math.cos(a) * d * Math.cos(pitch || 0.2), 0.35 + Math.sin(pitch || 0.2) * d, c.z - Math.sin(a) * d * Math.cos(pitch || 0.2)); cam2.lookAt(c.x, 0.3, c.z); R.render(scene, cam2); return R.domElement.toDataURL('image/png'); }, dbgPose: (k, p) => { const d = anim.dogs[k]; if (d) d.force = p || null; }, dogGround: k => { const dg = anim.dogs[k]; if (!dg) return null; dg.g.updateMatrixWorld(true); const v = new T.Vector3(); let lo = 9; const body = dg.torso.children[0], P = body.geometry.attributes.position; for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(body.matrixWorld); if (v.y < lo) lo = v.y; }
    const feet = dg.legs.map(l => { let m = 9; l.children.forEach(c => { const Q = c.geometry.attributes.position; for (let i = 0; i < Q.count; i++) { v.fromBufferAttribute(Q, i).applyMatrix4(c.matrixWorld); if (v.y < m) m = v.y; } }); return +m.toFixed(3); }); return { body: +lo.toFixed(3), feet, vis: dg.legs.map(l => l.visible), x: dg.g.position.x, z: dg.g.position.z, ry: dg.g.rotation.y }; }, heroModelRot: () => HERO.g ? HERO.g.rotation.y : NaN, heroInfo: () => ({ x: HERO.pos.x, z: HERO.pos.z, y: HERO.y, face: HERO.face, ground: HERO.ground }), setHover, setDog, critInfo: () => CRIT.list.map(c => [c.kind, +c.g.position.x.toFixed(1), +c.g.position.z.toFixed(1), c.g.visible]), setSeason, get season() { return SEA.id; }, setWeatherFx: on => { on = on !== false; if (SEA.fxOn === on) return; SEA.fxOn = on; const id = SEA.id; SEA.id = ''; setSeason(id); }, dbgSnow: () => { try { snowifyScene(); const n = seasonCollect(); return 'ok ' + n + ' sk=' + SEA.sk; } catch (e) { return 'ERR ' + e.message; } }, floraInfo: () => ({ n: FLORA.recs.length, chunks: FLORA.chunks.length, hidden: FLORA.recs.filter(o => o.hidden).length, snow: +SNOWU.value.toFixed(2) }), releaseIcons, afterShown, setLayout, buildMode, setBuildState, setGhost, setBuildSel, cellAt, builtAt, centerCell, buildIcon, get buildOn() { return BM.on; }, setNewChar, get newChar() { return NC.on && !!NC.hero; }, ncBox: () => { const b = o => { const B = new T.Box3().setFromObject(o); return [+(B.max.y - B.min.y).toFixed(3), +B.min.y.toFixed(3)]; }, r = {}; if (HERO.g) { r.heroOld = b(HERO.g.children.find(c => c !== HERO.p.ring && (!NC.hero || c !== NC.hero.wrap))); if (NC.hero) r.heroNew = b(NC.hero.wrap); } const dg = anim.dogs.find(d => d.did === 'fuwang'); if (dg) { r.dogOld = b(dg.torso); if (dg.rig) r.dogNew = b(dg.rig.wrap); } return r; }, ncInfo: () => ({ on: NC.on, hero: !!NC.hero, heroId: NC.heroId, heroReal: NC.hero && NC.hero.rig.real, heroTs: NC.hero && NC.hero.rig.inst.actions[NC.hero.rig.real] ? +NC.hero.rig.inst.actions[NC.hero.rig.real].timeScale.toFixed(2) : null, heroState: NC.hero && NC.hero.rig.real, dogs: anim.dogs.filter(d => d.rig).map(d => ({ did: d.did, state: d.rig.rig.state, real: d.rig.rig.real, vis: d.g.visible })) }), setEnv, setTheme, pick, screenOf, fx, cropIcon, dogPortrait, dogShot, heroShot, get ready() { return ready; } };
})();
