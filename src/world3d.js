'use strict';
/* =====================================================
   丰收农场 · 3D 场景（Three.js r149，本地托管 vendor/three.min.js）
   农田、作物、环境、光照、昼夜、天气、拾取、特效、作物图标
   ===================================================== */
const W3 = (() => {
  const T = THREE, CFG3 = GAMECFG;
  T.ColorManagement.legacyMode = false;
  const PITCH = 2.32, PLOT = 2.02, BED_H = 0.22, COLS3 = 6, ROWS3 = 4;
  const plotXZ = i => [((i % COLS3) - 2.5) * PITCH, (Math.floor(i / COLS3) - 1.5) * PITCH];
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
  function mat(col, o) { o = o || {}; const k = col + JSON.stringify(o); let m = MC.get(k); if (!m) { m = new (o.phys ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)(Object.assign({ color: new T.Color(col), roughness: 0.75, metalness: 0 }, o.p || {})); if (o.vc) m.vertexColors = true; if (o.ds) m.side = T.DoubleSide; MC.set(k, m); } return m; }
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  function mesh(geo, m, x, y, z) { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }
  function colorize(g, fn) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const r = fn(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = r[0]; c[i * 3 + 1] = r[1]; c[i * 3 + 2] = r[2]; } g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; }
  function displace(g, amt, freq, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = (fbm(x * freq + 10, (y + z) * freq + 20, seed, 3) - 0.5) * 2 * amt, l = Math.hypot(x, y, z) || 1; p.setXYZ(i, x + x / l * n, y + y / l * n, z + z / l * n); } g.computeVertexNormals(); return g; }
  // 合并：同一材质的网格合并成一个，大幅减少绘制调用
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
  const SG = new Map(); const sphereG = (w, h) => { const k = w + ':' + h; if (!SG.has(k)) SG.set(k, new T.SphereGeometry(1, w, h)); return SG.get(k); };
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
    else { const k = stage === 2 ? 0.55 : stage === 3 ? 0.82 : 1, ripe = stage === 4; ({ root: buildRoot, cabbage: buildCabbage, bush: buildBush, corn: buildCorn, vine: buildVine, sunflower: buildSunflower, pine: buildPine })[a.type](g, a, k, ripe); }
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
    for (let i = 0; i < 5; i++) { const geo = new T.IcosahedronGeometry(1, 3); displace(geo, 0.18, 1.3, 11 + i); colorize(geo, (px, py) => { const v = 0.72 + py * 0.22 + (hash2(Math.round(px * 9), Math.round(py * 9), i) - 0.5) * 0.12; return [v, v, v]; }); const o = mesh(geo, fm, (r() - 0.5) * 1.1, 2.5 + r() * 0.9 + (i === 0 ? 0.6 : 0), (r() - 0.5) * 1.1); o.scale.setScalar(0.85 + r() * 0.45); g.add(o); }
    if (apples) { const am = fruitMat('#d8302a', 0.3); for (let i = 0; i < 9; i++) { const a = r() * 6.28, h = 2.3 + r() * 1.4; g.add(blob(am, Math.cos(a) * 1.15, h, Math.sin(a) * 1.15, 0.1, 0.1, 0.1, 10)); } }
    const m = merge(g); m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = r() * 6; return m;
  }
  function bushAt(x, z, s, col) { const g = new T.Group(), fm = mat(col, { vc: 1, p: { roughness: 0.85 } }); for (let i = 0; i < 3; i++) { const geo = new T.IcosahedronGeometry(1, 2); displace(geo, 0.15, 1.5, 30 + i); colorize(geo, (px, py) => { const v = 0.7 + py * 0.25; return [v, v, v]; }); const o = mesh(geo, fm, (i - 1) * 0.45, 0.35, (i % 2) * 0.3); o.scale.set(0.55, 0.45, 0.5); g.add(o); } const m = merge(g); m.position.set(x, 0, z); m.scale.setScalar(s); return m; }
  function rock(x, z, s) { const geo = new T.DodecahedronGeometry(1, 1); displace(geo, 0.2, 1.2, Math.round(x * 3 + z)); const o = mesh(geo, mat('#9a968c', { p: { roughness: 0.9, map: TX.stone, normalMap: TX.stoneN } }), x, s * 0.35, z); o.scale.set(s, s * 0.6, s * 0.85); o.rotation.y = x; return o; }
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
  function buildPond(x, z) {
    const g = new T.Group(), sh = new T.Shape(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 3.2 + Math.sin(a * 3) * 0.35 + Math.cos(a * 5) * 0.2; const px = Math.cos(a) * r * 1.25, pz = Math.sin(a) * r; i ? sh.lineTo(px, pz) : sh.moveTo(px, pz); }
    const bed = mesh(new T.ShapeGeometry(sh, 24), mat('#3a5a48', { p: { roughness: 1 } })); bed.rotation.x = Math.PI / 2; bed.scale.set(1, -1, 1); bed.position.y = -0.18; g.add(bed);
    const wm = new T.MeshStandardMaterial({ color: new T.Color('#3d8fb0'), roughness: 0.06, metalness: 0.25, normalMap: TX.waterN, transparent: true, opacity: 0.86 }); wm.normalScale.set(0.6, 0.6);
    const water = new T.Mesh(new T.ShapeGeometry(sh, 24), wm); water.rotation.x = -Math.PI / 2; water.scale.set(1, -1, 1); water.position.y = 0.05; water.receiveShadow = true; g.add(water); anim.water = wm;
    const sm = mat('#9a968c', { p: { roughness: 0.9, map: TX.stone, normalMap: TX.stoneN } }), r = CFG3.rng(99);
    for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2, rr = 3.25 + Math.sin(a * 3) * 0.35 + Math.cos(a * 5) * 0.2; const geo = new T.DodecahedronGeometry(1, 0); const o = mesh(geo, sm, Math.cos(a) * rr * 1.25, 0.08, Math.sin(a) * rr); o.scale.set(0.3 + r() * 0.2, 0.18 + r() * 0.1, 0.25 + r() * 0.15); o.rotation.set(r(), r() * 6, r()); g.add(o); }
    const lm = mat('#3f8a3a', { p: { roughness: 0.6 } }); for (let i = 0; i < 6; i++) { const pad = new T.CircleGeometry(0.32, 16, 0.3, Math.PI * 2 - 0.4); const o = mesh(pad, lm, (r() - 0.5) * 4.5, 0.07, (r() - 0.5) * 3.5); o.rotation.set(-Math.PI / 2, 0, r() * 6); g.add(o); if (i % 2 === 0) g.add(blob(mat('#ffb0d0'), o.position.x + 0.1, 0.14, o.position.z, 0.09, 0.06, 0.09, 10)); }
    const cat = mat('#6a8a3a'), catTop = mat('#6a4020'); for (let i = 0; i < 7; i++) { const a = -0.6 + i * 0.18, rr = 3.5; const px = Math.cos(a) * rr * 1.25, pz = Math.sin(a) * rr; g.add(mesh(new T.CylinderGeometry(0.02, 0.03, 1.4, 5), cat, px, 0.7, pz)); g.add(mesh(new T.CapsuleGeometry(0.05, 0.25, 4, 8), catTop, px, 1.35, pz)); }
    const keepW = water; keepW.userData.keep = true; const m = merge(g); m.position.set(x, 0, z); return m;
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
  // 两只看家狗：福旺（灰白色）、睿宝（金色边牧，体型稍大）
  const DOG_LOOK = { fuwang: { fur: '#9a9aa2', white: '#f4f3ef', ear: '#6e6e78', s: 1, tag: '#c8d2e0', name: '福旺' }, ruibao: { fur: '#d9a441', white: '#fbf3e2', ear: '#a8742a', s: 1.18, tag: '#ffcf5a', name: '睿宝' } };
  function buildDog(kind) {
    const L = DOG_LOOK[kind || 'fuwang'];
    const g = new T.Group(), fur = mat(L.fur, { p: { roughness: 0.9 } }), white = mat(L.white, { p: { roughness: 0.9 } }), dark = mat('#2a1a10');
    const body = blob(fur, 0, 0.42, 0, 0.42, 0.28, 0.26); g.add(body); g.add(blob(white, 0.18, 0.36, 0, 0.22, 0.2, 0.2));
    const head = new T.Group(); head.position.set(0.45, 0.75, 0); head.add(blob(fur, 0, 0, 0, 0.24)); head.add(blob(white, 0.18, -0.06, 0, 0.13, 0.1, 0.12)); head.add(blob(dark, 0.3, -0.02, 0, 0.04)); [-0.1, 0.1].forEach(z => { head.add(blob(dark, 0.18, 0.06, z, 0.03)); const ear = blob(mat(L.ear), -0.05, 0.12, z * 1.8, 0.07, 0.16, 0.05); ear.rotation.x = z * 3; head.add(ear); }); g.add(head);
    [[0.25, 0.14], [0.25, -0.14], [-0.25, 0.14], [-0.25, -0.14]].forEach(([x, z]) => g.add(mesh(new T.CapsuleGeometry(0.06, 0.25, 4, 8), fur, x, 0.18, z)));
    const tail = mesh(new T.CapsuleGeometry(0.04, 0.3, 4, 8), fur, -0.45, 0.58, 0); tail.rotation.z = 0.9; g.add(tail);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(L.s);
    const tag = nameTag(L.name, L.tag); tag.position.set(0.1, 1.35, 0); g.add(tag);
    const d = { g, head, tail, body, tag, kind }; anim.dogs.push(d); return g;
  }
  function buildChicken() { const g = new T.Group(); g.add(blob(mat('#fbf6ec', { p: { roughness: 0.9 } }), 0, 0.3, 0, 0.22, 0.2, 0.18)); g.add(blob(mat('#fbf6ec'), -0.2, 0.38, 0, 0.1, 0.14, 0.08)); const h = blob(mat('#fbf6ec'), 0.16, 0.5, 0, 0.12); g.add(h); g.add(blob(mat('#e0302a'), 0.18, 0.62, 0, 0.05, 0.06, 0.03)); const bk = mesh(new T.ConeGeometry(0.035, 0.09, 6), mat('#f0a020'), 0.29, 0.5, 0); bk.rotation.z = -Math.PI / 2; g.add(bk); g.add(blob(mat('#1a1008'), 0.23, 0.53, 0.07, 0.018)); g.add(blob(mat('#1a1008'), 0.23, 0.53, -0.07, 0.018)); [0.06, -0.06].forEach(z => g.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 4), mat('#e0a020'), 0, 0.08, z))); const m = merge(g); m.scale.setScalar(0.9); return m; }
  function buildButterfly(col) { const g = new T.Group(), wm = mat(col, { ds: 1, p: { roughness: 0.6 } }); const wg = new T.CircleGeometry(0.12, 10); const l = mesh(wg, wm, -0.08, 0, 0), r = mesh(wg, wm, 0.08, 0, 0); l.castShadow = r.castShadow = false; const lp = new T.Group(), rp = new T.Group(); lp.add(l); rp.add(r); g.add(lp, rp); g.add(blob(mat('#2a1a10'), 0, 0, 0, 0.015, 0.015, 0.08)); return { g, lp, rp }; }
  function buildCloud() { const g = new T.Group(), m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: new T.Color('#c8d8f0'), emissiveIntensity: 0.25, transparent: true, opacity: 0.95 }); const r = CFG3.rng(Math.round(Math.random() * 1e6)); for (let i = 0; i < 7; i++) { const o = blob(m, (i - 3) * 1.1 + (r() - 0.5), r() * 0.6, (r() - 0.5) * 1.2, 1.1 + r() * 0.8, 0.8 + r() * 0.4, 1 + r() * 0.5, 14); o.castShadow = false; g.add(o); } return g; }
  function grassField(n, avoid) {
    const blade = new T.BufferGeometry(), pos = [0, 0, -0.035, 0, 0, 0.035, 0.01, 0.17, -0.025, 0.01, 0.17, 0.025, 0.03, 0.34, 0], col = [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.1, 1.1, 1.1];
    blade.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); blade.setAttribute('color', new T.Float32BufferAttribute(col, 3)); blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]); blade.computeVertexNormals();
    const m = new T.MeshStandardMaterial({ color: new T.Color('#7cb84a'), vertexColors: true, side: T.DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = sh => { sh.uniforms.uT = anim.grassU; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat ph = instanceMatrix[3].x*0.6 + instanceMatrix[3].z*0.8;\ntransformed.x += sin(uT*1.6+ph)*0.07*position.y*3.0;\ntransformed.z += cos(uT*1.2+ph*1.3)*0.05*position.y*3.0;\n#endif'); };
    const im = new T.InstancedMesh(blade, m, n), d = new T.Object3D(), r = CFG3.rng(5), c = new T.Color(); let k = 0;
    while (k < n) { const x = (r() - 0.5) * 70, z = (r() - 0.5) * 60; if (avoid(x, z)) continue; d.position.set(x, 0, z); d.rotation.set(0, r() * 6.28, (r() - 0.5) * 0.4); d.scale.setScalar(0.6 + r() * 0.9); d.updateMatrix(); im.setMatrixAt(k, d.matrix); c.setHSL(0.24 + r() * 0.06, 0.45 + r() * 0.2, 0.32 + r() * 0.12); im.setColorAt(k, c); k++; }
    im.receiveShadow = false; return im;
  }
  function flowers(n, avoid) { const geo = new T.IcosahedronGeometry(0.08, 0); const im = new T.InstancedMesh(geo, mat('#ffffff', { p: { roughness: 0.6 } }), n), d = new T.Object3D(), r = CFG3.rng(15), c = new T.Color(), pal = ['#ff7aa0', '#ffd23a', '#ffffff', '#b98aff', '#ff9a4a', '#7ac8ff']; let k = 0; while (k < n) { const x = (r() - 0.5) * 60, z = (r() - 0.5) * 50; if (avoid(x, z)) continue; d.position.set(x, 0.12 + r() * 0.08, z); d.scale.set(1, 0.6, 1); d.updateMatrix(); im.setMatrixAt(k, d.matrix); im.setColorAt(k, c.set(pal[Math.floor(r() * pal.length)])); k++; } return im; }
  function hills() { const g = new T.Group(), m = mat('#6a9a4a', { p: { roughness: 1 } }), r = CFG3.rng(77); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + r() * 0.3, d = 75 + r() * 30; const geo = new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); displace(geo, 0.08, 1.5, i); const o = mesh(geo, m, Math.cos(a) * d, -2, Math.sin(a) * d); o.scale.set(25 + r() * 20, 8 + r() * 10, 18 + r() * 10); o.castShadow = false; g.add(o); } for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = 50 + r() * 25; const t = blob(mat('#3f7a3a', { p: { roughness: 1 } }), Math.cos(a) * d, 2.5, Math.sin(a) * d, 2 + r() * 1.5, 3 + r() * 2, 2 + r()); t.castShadow = false; g.add(t); } return merge(g); }
  // 天空
  let sky, skyU;
  function buildSky() {
    skyU = { top: { value: new T.Color('#3b8fe0') }, hor: { value: new T.Color('#cfe8ff') }, sunDir: { value: v3(0, 1, 0) }, sunCol: { value: new T.Color('#fff2d0') }, night: { value: 0 } };
    const m = new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: ['uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vP;', 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}', 'void main(){ float y = max(vP.y,0.0); vec3 c = mix(hor, top, pow(y,0.55)); float s = max(dot(vP, normalize(sunDir)),0.0); c += sunCol*(pow(s,800.0)*2.5 + pow(s,12.0)*0.35);', 'if(night>0.01){ vec2 q = floor(vP.xz/(vP.y+0.3)*180.0); float st = step(0.997, h(q)); c += vec3(st)*night*smoothstep(0.1,0.5,y); }', 'gl_FragColor = vec4(c,1.0);', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'].join('\n') });
    sky = new T.Mesh(new T.SphereGeometry(400, 32, 16), m); scene.add(sky);
  }
  let hemi, sun, amb, doorLamp;
  const KEY = [ // 小时, 天顶, 地平线, 阳光色, 阳光强度, 半球强度, 曝光, 夜
    [0, '#0a1430', '#1c2a52', '#8aa0ff', 0.25, 0.25, 0.85, 1], [5, '#1a2a5a', '#7a6a8a', '#ffb07a', 0.3, 0.3, 0.9, 0.7], [6.5, '#5a8ad8', '#ffc89a', '#ffc080', 1.1, 0.7, 1.0, 0.1],
    [9, '#3a8ee0', '#cfe8ff', '#fff0d8', 1.8, 0.95, 1.0, 0], [15, '#3a8ee0', '#d8ecff', '#fff4e0', 1.9, 0.95, 1.0, 0], [17.6, '#5a8ad0', '#ffd0a0', '#ffc070', 1.5, 0.8, 1.0, 0],
    [18.8, '#4a5a9a', '#ff9a6a', '#ff8a4a', 0.9, 0.45, 0.98, 0.25], [20, '#14204a', '#3a3a6a', '#8aa0ff', 0.3, 0.3, 0.88, 0.85], [24, '#0a1430', '#1c2a52', '#8aa0ff', 0.25, 0.25, 0.85, 1]];
  function envAt(h) { let i = 0; while (i < KEY.length - 2 && KEY[i + 1][0] <= h) i++; const a = KEY[i], b = KEY[i + 1], t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))); const C = (x, y) => new T.Color(x).lerp(new T.Color(y), t); const L = (x, y) => x + (y - x) * t; return { top: C(a[1], b[1]), hor: C(a[2], b[2]), sun: C(a[3], b[3]), si: L(a[4], b[4]), hi: L(a[5], b[5]), ex: L(a[6], b[6]), night: L(a[7], b[7]) }; }

  /* ---------------- 农田 ---------------- */
  const plots = []; let hoverIdx = -1, hoverFrame, BADGE = {}, sparkTex, hitBoxes = [];
  let soilMats;
  function bedGeo() { const s = new T.Shape(), w = PLOT / 2 - 0.06, r = 0.2; s.moveTo(-w + r, -w); s.lineTo(w - r, -w); s.quadraticCurveTo(w, -w, w, -w + r); s.lineTo(w, w - r); s.quadraticCurveTo(w, w, w - r, w); s.lineTo(-w + r, w); s.quadraticCurveTo(-w, w, -w, w - r); s.lineTo(-w, -w + r); s.quadraticCurveTo(-w, -w, -w + r, -w); const g = new T.ExtrudeGeometry(s, { depth: BED_H - 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 6 }); g.rotateX(-Math.PI / 2); const p = g.attributes.uv; for (let i = 0; i < p.count; i++) p.setXY(i, p.getX(i) / PLOT + 0.5, p.getY(i) / PLOT + 0.5); return g; }
  let BED_G, RIDGE_G, LOCK_G;
  function soilMat(col) { return new T.MeshStandardMaterial({ color: new T.Color(col), map: TX.soil, normalMap: TX.soilN, roughness: 0.96 }); }
  function buildPlotsBase() {
    BED_G = bedGeo(); RIDGE_G = new T.CapsuleGeometry(0.075, PLOT - 0.55, 4, 10); RIDGE_G.rotateZ(Math.PI / 2); RIDGE_G.scale(1, 0.55, 1);
    soilMats = { 0: { n: soilMat('#5c4130'), wet: soilMat('#3a281c'), dry: soilMat('#8c7258') }, 1: { n: soilMat('#86402a'), wet: soilMat('#5a2618'), dry: soilMat('#a8644a') },
      2: { n: soilMat('#2e2622'), wet: soilMat('#1c1714'), dry: soilMat('#4e4238') }, 3: { n: soilMat('#b08a3a'), wet: soilMat('#80622a'), dry: soilMat('#ccab62') } };
    [3].forEach(k => Object.values(soilMats[k]).forEach(m => { m.emissive = new T.Color('#5a4010'); m.emissiveIntensity = 0.35; m.metalness = 0.25; }));
    ['d', 'w', 'b', 's'].forEach(k => BADGE[k] = new T.SpriteMaterial({ map: badgeTex(k), depthTest: false, transparent: true }));
    sparkTex = starTex();
    const hb = new T.BoxGeometry(PITCH - 0.05, 1.4, PITCH - 0.05); hb.translate(0, 0.7, 0); const hm = new T.MeshBasicMaterial({ visible: false });
    for (let i = 0; i < 24; i++) { const [x, z] = plotXZ(i), node = new T.Group(); node.position.set(x, 0, z); scene.add(node); const hit = new T.Mesh(hb, hm); hit.userData.idx = i; node.add(hit); hitBoxes.push(hit); plots.push({ node, key: '', crop: null, badges: [], sparks: [], bug: null, sway: Math.random() * 6, cropH: 0 }); }
    // 悬停高亮框
    const c = mkCanvas(128), x = c.getContext('2d'); x.strokeStyle = 'rgba(255,236,170,1)'; x.lineWidth = 8; x.shadowColor = 'rgba(255,210,90,1)'; x.shadowBlur = 14; x.beginPath(); x.roundRect ? x.roundRect(12, 12, 104, 104, 18) : x.rect(12, 12, 104, 104); x.stroke();
    hoverFrame = new T.Mesh(new T.PlaneGeometry(PLOT + 0.25, PLOT + 0.25), new T.MeshBasicMaterial({ map: tex(c, 0), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); hoverFrame.rotation.x = -Math.PI / 2; hoverFrame.visible = false; scene.add(hoverFrame);
    LOCK_G = { post: new T.BoxGeometry(0.09, 0.8, 0.09), board: new T.BoxGeometry(0.7, 0.46, 0.05), face: new T.PlaneGeometry(0.66, 0.42) };
  }
  let LOCK_TEX, LOCK_MAT;
  function lockTex() { if (LOCK_TEX) return LOCK_TEX; const c = mkCanvas(128), x = c.getContext('2d'); x.drawImage(TX.wood.image, 0, 0, 128, 128); x.fillStyle = 'rgba(60,36,16,.25)'; x.fillRect(0, 0, 128, 128); x.translate(64, 70); x.strokeStyle = '#3a2410'; x.lineWidth = 9; x.beginPath(); x.arc(0, -14, 16, Math.PI, 0); x.stroke(); x.fillStyle = '#3a2410'; x.fillRect(-24, -14, 48, 36); x.fillStyle = '#d8b050'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); x.fillRect(-2, 0, 4, 12); LOCK_TEX = tex(c, 0); return LOCK_TEX; }
  function rebuildPlot(i, P, o) {
    const pl = plots[i], node = pl.node; node.children.slice().forEach(ch => { if (!ch.userData.idx && ch.userData.idx !== 0) node.remove(ch); }); pl.crop = null; pl.badges = []; pl.sparks = []; pl.bug = null; pl.cropH = 0;
    if (!P.u) {
      const g = new T.Group(); const patch = mesh(BED_G, mat('#7fa856', { p: { roughness: 1, map: TX.grass } })); patch.scale.set(1, 0.22, 1); g.add(patch);
      const wm = mat('#8a6040', { p: { map: TX.wood } }); g.add(mesh(LOCK_G.post, wm, 0.42, 0.35, 0.42)); const b = mesh(LOCK_G.board, wm, 0.42, 0.78, 0.42); b.rotation.y = Math.PI / 4; g.add(b); const face = mesh(LOCK_G.face, LOCK_MAT || (LOCK_MAT = new T.MeshStandardMaterial({ map: lockTex(), roughness: 0.85 })), 0.42 + 0.024, 0.78, 0.42 + 0.024); face.rotation.y = Math.PI / 4; g.add(face);
      const tm = mat('#4f8a34', { vc: 1, ds: 1 }), r = CFG3.rng(i * 7); for (let k = 0; k < 7; k++) { const tx = (r() - 0.5) * 1.5, tz = (r() - 0.5) * 1.5; for (let j = 0; j < 3; j++) addLeaf(g, leafGeo(0.22 + r() * 0.12, 0.035, 0.6, 0, 'blade'), tm, tx, 0.04, tz, r() * 6, 0.3 + r() * 0.4); }
      node.add(merge(g)); return;
    }
    const sm = (soilMats[P.soil | 0] || soilMats[0])[P.pr && P.pr.d ? 'dry' : (P.wet ? 'wet' : 'n')];
    const bed = new T.Mesh(BED_G, sm); bed.receiveShadow = true; node.add(bed);
    [-0.6, -0.2, 0.2, 0.6].forEach(z => { const r = new T.Mesh(RIDGE_G, sm); r.position.set(0, BED_H, z); r.receiveShadow = true; r.castShadow = true; node.add(r); });
    if (P.pr && P.pr.w) { const g = new T.Group(), wm = mat('#6a9a2a', { vc: 1, ds: 1 }), r = CFG3.rng(i * 11 + 3); [[-0.7, -0.65], [0.72, 0.5], [-0.55, 0.72], [0.6, -0.6], [0.05, 0.78]].forEach(([x, z]) => { for (let j = 0; j < 5; j++) addLeaf(g, leafGeo(0.28 + r() * 0.15, 0.05, 0.9, 0.1, 'blade'), wm, x, BED_H, z, r() * 6, 0.4 + r() * 0.5); }); node.add(merge(g)); }
    if (P.c >= 0 && CFG3.CROPS[P.c]) {
      const st = CFG3.stageOf(P.p), base = cropModel(P.c, st), m = base.clone(), SC = 1.42; m.scale.setScalar(SC); m.position.y = BED_H + 0.02; node.add(m); pl.crop = m; pl.cropH = (base.userData.h || 0.3) * SC;
      const list = []; if (P.pr) { if (P.pr.d) list.push('d'); if (P.pr.w) list.push('w'); if (P.pr.b) list.push('b'); }
      if (o.mine) list.push('s');
      list.forEach((k, j) => { const s = new T.Sprite(BADGE[k]); s.scale.set(0.62, 0.62, 1); s.renderOrder = 10; s.userData.base = v3((j - (list.length - 1) / 2) * 0.66, BED_H + pl.cropH + 0.55, 0); s.position.copy(s.userData.base); node.add(s); pl.badges.push(s); });
      if (st === 4) for (let j = 0; j < 4; j++) { const s = new T.Sprite(new T.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); s.userData.ph = j / 4 + i * 0.13; s.userData.r = 0.5 + (j % 2) * 0.25; s.scale.setScalar(0.3); node.add(s); pl.sparks.push(s); }
      if (P.pr && P.pr.b && st > 0) { const bug = new T.Group(); bug.add(blob(fruitMat('#d82a20', 0.25), 0, 0.04, 0, 0.07, 0.05, 0.08, 12)); bug.add(blob(mat('#1a1008'), 0, 0.04, 0.07, 0.04, 0.035, 0.035, 8)); [[0.03, -0.02], [-0.03, 0.01], [0.02, 0.03]].forEach(([x, z]) => bug.add(blob(mat('#1a1008'), x, 0.085, z, 0.016, 0.01, 0.016, 6))); node.add(bug); pl.bug = bug; }
    }
  }
  function plotKey(P, o) { return [P.u, P.soil, P.c, P.c >= 0 ? CFG3.stageOf(P.p) : -1, P.pr ? '' + (P.pr.d | 0) + (P.pr.w | 0) + (P.pr.b | 0) : '', P.wet ? 1 : 0, o.mine ? 1 : 0].join('|'); }

  /* ---------------- 特效 ---------------- */
  const parts = []; let FXT = {}; const floats = []; let fxLayer;
  function spawn(kind, pos, vel, life, size, grav, spin) { const s = new T.Sprite(new T.SpriteMaterial({ map: FXT[kind], transparent: true, depthWrite: false, blending: kind === 'star' ? T.AdditiveBlending : T.NormalBlending })); s.position.copy(pos); s.scale.setScalar(size); s.renderOrder = 20; scene.add(s); parts.push({ s, v: vel, t: 0, life, g: grav, size, spin: spin || 0 }); }
  const P0 = (i, y) => { const [x, z] = plotXZ(i); return v3(x, (y || 0) + BED_H + (plots[i] ? plots[i].cropH * 0.6 : 0), z); };
  const rv = (a, b) => a + Math.random() * (b - a);
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
    const pts = []; [-7.6, 7.6].forEach(x => [-5.6, 5.6].forEach(z => [0, 1.4].forEach(y => pts.push(v3(x, y, z)))));
    CAM_DIR = (H > W * 1.15 ? CAM_PORT : CAM_LAND).clone(); target.set(0, 0, H > W * 1.15 ? 0 : 0.4);
    const sl = safe.l, sr = W - safe.r, st = safe.t, sb = H - safe.b, scx = (sl + sr) / 2, scy = (st + sb) / 2;
    cam.aspect = W / H; cam.clearViewOffset(); cam.setViewOffset(W, H, W / 2 - scx, H / 2 - scy, W, H);
    let lo = 10, hi = 140;
    for (let it = 0; it < 26; it++) { const mid = (lo + hi) / 2; cam.position.copy(target).addScaledVector(CAM_DIR, mid); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); const ok = pts.every(p => { const q = p.clone().project(cam), x = (q.x * 0.5 + 0.5) * W, y = (-q.y * 0.5 + 0.5) * H; return x >= sl && x <= sr && y >= st && y <= sb; }); if (ok) hi = mid; else lo = mid; }
    camDist = hi; applyCam();
  }
  function applyCam() { cam.position.copy(target).addScaledVector(CAM_DIR, camDist * zoom); cam.lookAt(target); cam.updateProjectionMatrix(); if (sun) { sun.target.position.copy(target); } }
  // 画质：3 高（默认）2 中 1 低；帧率持续偏低时自动降档
  let quality = /[?&]q=low/.test(location.search) ? 1 : /[?&]q=mid/.test(location.search) ? 2 : 3, grassMesh = null, perf = { t: 0, n: 0, acc: 0 };
  function applyQuality() {
    const mob = W < 820, dpr = window.devicePixelRatio || 1;
    R.setPixelRatio(quality === 3 ? Math.min(dpr, mob ? 1.75 : 2) : quality === 2 ? Math.min(dpr, 1.25) : Math.min(dpr, 0.85));
    R.shadowMap.enabled = quality >= 2; if (sun) { sun.castShadow = quality >= 2; const sz = quality === 3 ? 2048 : 1024; if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }
    if (grassMesh) grassMesh.visible = quality >= 2; scene && scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined && o.isMesh) o.material.needsUpdate = true; });
    R.setSize(W, H, false);
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight; const mob = W < 820;
    const port = H > W * 1.15; Object.assign(safe, port ? { l: 46, r: 58, t: 120, b: 96 } : mob ? { l: 54, r: 64, t: 70, b: 92 } : { l: 84, r: 104, t: 84, b: 112 });
    applyQuality(); fit();
  }
  function perfTick(dt) { if (quality <= 1) return; perf.acc += dt; perf.n++; if (perf.acc > 2.5) { const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0; if (avg > 0.045) { quality--; applyQuality(); } } }
  let theme = null;
  function setTheme(th) { if (!anim.house || !th) return; if (theme === th.roof + th.wall) return; theme = th.roof + th.wall; anim.house.roofM.color.set(th.roof); anim.house.wallM.color.set(th.wall).lerp(new T.Color('#ffffff'), 0.25); }
  function init(cv) {
    canvasEl = cv;
    R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 1, 1, 900);
    scene.fog = new T.Fog(new T.Color('#cfe8ff'), 70, 230);
    buildTextures();
    FXT = { coin: coinTex(), star: starTex(), drop: dropTex(), leaf: leafSpriteTex('#5cb83c'), soil: leafSpriteTex('#7a5232'), puff: glowTex('rgba(255,255,255,0.85)', 1) };
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
    const ground = new T.Mesh(gg, new T.MeshStandardMaterial({ color: new T.Color('#ffffff'), vertexColors: true, map: TX.grass, roughness: 0.96 })); ground.material.map.repeat.set(60, 60); ground.receiveShadow = true; scene.add(ground);
    // 农场院子（稍深的草皮）与小路
    const yard = new T.Mesh(new T.PlaneGeometry(16.8, 12.4), new T.MeshStandardMaterial({ color: new T.Color('#8aa060'), map: TX.grass.clone(), roughness: 1 })); yard.material.map.needsUpdate = true; yard.material.map.repeat.set(4, 3); yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.01, 0); yard.receiveShadow = true; scene.add(yard);
    const pm = new T.MeshStandardMaterial({ color: new T.Color('#c8a878'), map: TX.path, roughness: 1 }); pm.map.repeat.set(1, 6);
    const pathG = new T.Group(); [[-10, -1.2, 5.5, 1.6, 0.35], [-4.5, 7.2, 1.8, 6, -0.25]].forEach(([x, z, l, w, r]) => { const p = new T.Mesh(new T.PlaneGeometry(l, w), pm); p.rotation.set(-Math.PI / 2, 0, r); p.position.set(x, 0.015, z); p.receiveShadow = true; pathG.add(p); }); scene.add(pathG);
    buildPlotsBase();
    // 篱笆（前方留出入口）
    const wm = mat('#a8794a', { p: { map: TX.wood, roughness: 0.85 } }), fg = new T.Group(), X = 8.2, Z = 6.0;
    fenceLine(fg, -X, -Z, X, -Z, wm); fenceLine(fg, X, -Z, X, Z, wm); fenceLine(fg, -X, -Z, -X, Z, wm); fenceLine(fg, -X, Z, -1.6, Z, wm); fenceLine(fg, 1.6, Z, X, Z, wm);
    scene.add(merge(fg));
    // 建筑与装饰
    const house = buildHouse(); house.position.set(-13, 0, -2.5); house.rotation.y = 0.15; scene.add(house); doorLamp.position.set(-13 + 0.6, 2.8, -2.5 + 2.6);
    const wmill = buildWindmill(); wmill.position.set(3.5, 0, -15); wmill.rotation.y = -0.2; scene.add(wmill);
    scene.add(buildPond(-5.5, 13.5));
    const scare = buildScarecrow(); scare.position.set(-10.5, 0, 6.5); scene.add(scare);
    const dh = buildDoghouse(); dh.position.set(11.2, 0, -3.8); dh.rotation.y = -0.6; scene.add(dh);
    const dog = buildDog('fuwang'); dog.position.set(9.6, 0, 1.0); dog.rotation.y = -2.9; dog.visible = false; scene.add(dog);
    const dog2 = buildDog('ruibao'); dog2.position.set(9.4, 0, -0.6); dog2.rotation.y = -2.6; dog2.visible = false; scene.add(dog2);
    [[-17, -10, 1.2, '#4f9a3a', 1], [-20, 2, 1.1, '#5aa840', 0], [-9, -14, 1.0, '#4a9238', 1], [12, -13, 1.25, '#4f9a3a', 0], [17, -6, 1.05, '#5aa840', 1], [24, 4, 1.2, '#4a9238', 0], [17, 15, 1.0, '#5aa840', 1], [-24, 16, 1.15, '#4f9a3a', 0], [9, 22, 0.9, '#5aa840', 0], [-24, -5, 1.3, '#467f36', 0], [24, 0, 1.25, '#467f36', 1], [-2, -20, 1.2, '#4f9a3a', 0], [26, 18, 1.1, '#4a9238', 0]].forEach(([x, z, s, c, ap]) => scene.add(tree(x, z, s, c, ap)));
    [[-9.6, -6.5, 0.9], [9.4, 7.2, 1], [-15.5, 3.5, 0.8], [14, 3, 0.9], [7, -8, 0.7], [-7, -8.2, 0.8], [0, 9.5, 0.6], [15, -10, 1]].forEach(([x, z, s]) => scene.add(bushAt(x, z, s, '#4f9a3a')));
    [[-9.2, 9.8, 0.5], [10.5, 9.5, 0.4], [-2.2, 10.8, 0.3], [14.5, -1, 0.35], [-16, -6, 0.45], [6, 11, 0.3]].forEach(([x, z, s]) => scene.add(rock(x, z, s)));
    const avoid = (x, z) => (Math.abs(x) < 8.6 && Math.abs(z) < 6.4) || (Math.hypot((x + 5.5) / 1.25, z - 13.5) < 3.8) || (Math.abs(x + 13) < 3.2 && Math.abs(z + 2.5) < 2.8) || Math.hypot(x - 3.5, z + 15) < 2;
    grassMesh = grassField(window.innerWidth < 820 ? 5000 : 11000, avoid); scene.add(grassMesh); scene.add(flowers(420, avoid)); scene.add(hills());
    for (let i = 0; i < 4; i++) { const c = buildChicken(); c.position.set([-6, 7, 12, -11][i], 0, [8.2, -8, 6, -6.5][i]); scene.add(c); anim.chickens.push({ m: c, tx: c.position.x, tz: c.position.z, pk: 0, home: c.position.clone() }); }
    ['#ff9ac8', '#ffe066', '#9ad8ff'].forEach((c, i) => { const b = buildButterfly(c); scene.add(b.g); anim.butterflies.push(Object.assign(b, { ph: i * 2.1 })); });
    for (let i = 0; i < 6; i++) { const c = buildCloud(); c.position.set(-80 + i * 32, 30 + (i % 3) * 6, -60 - (i % 2) * 30); c.scale.setScalar(2 + (i % 3) * 0.6); scene.add(c); anim.clouds.push(c); }
    // 烟、萤火虫、雨
    const smokeM = () => new T.SpriteMaterial({ map: FXT.puff, transparent: true, depthWrite: false, opacity: 0.5 }); for (let i = 0; i < 8; i++) { const s = new T.Sprite(smokeM()); s.userData.ph = i / 8; scene.add(s); anim.smoke.push(s); }
    { const n = 60, g = new T.BufferGeometry(), p = new Float32Array(n * 3), r = CFG3.rng(3); for (let i = 0; i < n; i++) { p[i * 3] = (r() - 0.5) * 34; p[i * 3 + 1] = 0.5 + r() * 2.5; p[i * 3 + 2] = (r() - 0.5) * 28; } g.setAttribute('position', new T.BufferAttribute(p, 3)); anim.fireflies = new T.Points(g, new T.PointsMaterial({ size: 0.35, map: glowTex('rgba(220,255,140,1)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xd8ff8a })); anim.fireflies.visible = false; scene.add(anim.fireflies); }
    { const n = 1600, g = new T.BufferGeometry(), p = new Float32Array(n * 6); for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 30, z = (Math.random() - 0.5) * 50; p.set([x, y, z, x - 0.05, y - 0.6, z - 0.05], i * 6); } g.setAttribute('position', new T.BufferAttribute(p, 3)); anim.rain = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.45 })); anim.rain.visible = false; scene.add(anim.rain); }
    window.addEventListener('wheel', e => { if (e.target !== canvasEl) return; zoom = Math.max(0.7, Math.min(1.25, zoom * (e.deltaY > 0 ? 1.06 : 0.94))); applyCam(); }, { passive: true });
    resize(); ready = true;
  }

  /* ---------------- 每帧更新 ---------------- */
  let curView = { plots: [], home: true }, envState = { hour: 12, rain: 0 }, dogMode = ['none', 'none'];
  function setPlots(list, home) { curView = { plots: list, home }; list.forEach((P, i) => { const o = { mine: !home && P.mine }; const k = plotKey(P, o); if (plots[i].key !== k) { plots[i].key = k; rebuildPlot(i, P, o); } }); }
  function setHover(i) { hoverIdx = i; }
  function setDog(mode) { dogMode = Array.isArray(mode) ? mode : [mode, 'none']; }
  function setEnv(h, rain) { envState.hour = h; envState.rain = rain; }
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(cx, cy) { if (!ready) return -1; const r = canvasEl.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(hitBoxes, false); return h.length ? h[0].object.userData.idx : -1; }
  function screenOf(i, y) { const v = P0(i, y || 0.6).project(cam); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H }; }
  function render(dt) {
    if (!ready) return; tNow += dt; const t = tNow; perfTick(dt);
    const E = envAt(envState.hour), rk = envState.rain;
    const grey = new T.Color('#8a96a8');
    skyU.top.value.copy(E.top).lerp(grey.clone().multiplyScalar(0.7), rk * 0.7); skyU.hor.value.copy(E.hor).lerp(grey, rk * 0.6); skyU.night.value = E.night * (1 - rk);
    const ang = ((envState.hour - 6) / 12) * Math.PI, sy = Math.sin(ang), day = E.night < 0.5;
    const sd = day ? v3(Math.cos(ang) * -0.9 + 0.3, Math.max(0.25, sy), 0.55).normalize() : v3(-0.4, 0.7, 0.5).normalize();
    skyU.sunDir.value.copy(sd); skyU.sunCol.value.copy(E.sun).multiplyScalar(day ? 1 - rk : 0.15);
    sun.position.copy(target).addScaledVector(sd, 50); sun.color.copy(E.sun); sun.intensity = E.si * (1 - rk * 0.6);
    hemi.color.copy(E.hor).lerp(new T.Color('#ffffff'), 0.3); hemi.groundColor.set('#4a5a2a').lerp(new T.Color('#101828'), E.night); hemi.intensity = E.hi * (1 - rk * 0.2) + rk * 0.15;
    R.toneMappingExposure = E.ex; scene.fog.color.copy(skyU.hor.value);
    const nightK = E.night; anim.windows.forEach(m => m.emissiveIntensity = nightK * 1.4); doorLamp.intensity = nightK * 1.6;
    anim.fireflies.visible = nightK > 0.4; if (anim.fireflies.visible) { const p = anim.fireflies.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(t * 1.5 + i) * 0.004); p.needsUpdate = true; anim.fireflies.material.opacity = (0.5 + 0.5 * Math.sin(t * 3)) * nightK; }
    anim.rain.visible = rk > 0.02; if (anim.rain.visible) { anim.rain.material.opacity = 0.45 * rk; const p = anim.rain.geometry.attributes.position, a = p.array; for (let i = 0; i < a.length; i += 6) { a[i + 1] -= dt * 22; a[i + 4] -= dt * 22; if (a[i + 4] < 0) { a[i + 1] += 30; a[i + 4] += 30; } } p.needsUpdate = true; anim.rain.position.copy(target); }
    anim.grassU.value = t;
    if (anim.windmill) anim.windmill.rotation.z = -t * (0.5 + rk * 0.8);
    if (anim.water) { anim.water.normalMap.offset.set(t * 0.02, t * 0.013); }
    anim.clouds.forEach((c, i) => { c.position.x += dt * (0.6 + i * 0.1); if (c.position.x > 110) c.position.x = -110; });
    anim.smoke.forEach(s => { const k = (t * 0.25 + s.userData.ph) % 1; s.position.copy(anim.house.smokeAt).applyMatrix4(new T.Matrix4().makeRotationY(0.15)).add(v3(-13, 0, -2.5)); s.position.y += k * 3; s.position.x += Math.sin(k * 4 + s.userData.ph * 6) * 0.3 + k * 0.6; s.scale.setScalar(0.5 + k * 1.4); s.material.opacity = 0.45 * (1 - k) * (1 - nightK * 0.5); });
    anim.chickens.forEach(c => { c.pk -= dt; const m = c.m; if (c.pk > 0) { m.rotation.z = Math.sin(t * 12) * 0.05; return; } const dx = c.tx - m.position.x, dz = c.tz - m.position.z, d = Math.hypot(dx, dz); if (d < 0.1) { if (Math.random() < 0.5) c.pk = 1 + Math.random() * 2.5; else { c.tx = c.home.x + (Math.random() - 0.5) * 5; c.tz = c.home.z + (Math.random() - 0.5) * 3; } } else { const s = Math.min(d, dt * 0.9); m.position.x += dx / d * s; m.position.z += dz / d * s; m.rotation.y = Math.atan2(-dz, dx); m.position.y = Math.abs(Math.sin(t * 10)) * 0.04; } });
    anim.butterflies.forEach(b => { const p = b.ph; b.g.position.set(Math.sin(t * 0.3 + p) * 9, 1.2 + Math.sin(t * 1.3 + p) * 0.4, Math.cos(t * 0.23 + p * 2) * 6.5); b.g.rotation.y = t * 0.3 + p; const f = Math.sin(t * 18 + p) * 1.1; b.lp.rotation.y = f; b.rp.rotation.y = -f; });
    anim.dogs.forEach((dg, k) => { const m = dogMode[k] || 'none'; dg.g.visible = m !== 'none'; if (!dg.g.visible) return; const ph = t + k * 1.7;
      if (m === 'sleep') { dg.g.rotation.z = 0; dg.g.position.y = 0; dg.body.scale.y = 0.24 + Math.sin(ph * 2) * 0.01; dg.head.position.y = 0.45; dg.head.rotation.z = -0.3; dg.tail.rotation.z = 1.4; }
      else { dg.head.position.y = 0.75; dg.body.scale.y = 0.28; dg.head.rotation.y = Math.sin(ph * 0.8) * 0.5; dg.tail.rotation.z = 0.9 + Math.sin(ph * (m === 'bark' ? 30 : 10)) * 0.35; dg.g.position.y = m === 'bark' ? Math.abs(Math.sin(ph * 14)) * 0.15 : 0; dg.head.rotation.z = m === 'bark' ? Math.sin(ph * 20) * 0.15 : 0; } });
    // 农田动态
    plots.forEach((pl, i) => {
      if (pl.crop) { pl.crop.rotation.z = Math.sin(t * 1.4 + pl.sway) * 0.025; pl.crop.rotation.x = Math.cos(t * 1.1 + pl.sway) * 0.02; }
      pl.badges.forEach((s, j) => { s.position.y = s.userData.base.y + Math.sin(t * 3 + j + i) * 0.08; });
      pl.sparks.forEach(s => { const k = (t * 0.6 + s.userData.ph) % 1, a = s.userData.ph * 6.28 + t * 0.5; s.position.set(Math.cos(a) * s.userData.r, BED_H + 0.2 + k * (pl.cropH + 0.4), Math.sin(a) * s.userData.r); s.material.opacity = Math.sin(k * Math.PI); s.scale.setScalar(0.18 + 0.22 * Math.sin(k * Math.PI)); });
      if (pl.bug) { const a = t * 1.2 + i; pl.bug.position.set(Math.cos(a) * 0.35, BED_H + pl.cropH * 0.45 + Math.sin(t * 2.3) * 0.05, Math.sin(a) * 0.35); pl.bug.rotation.y = -a; }
    });
    if (hoverIdx >= 0) { const [x, z] = plotXZ(hoverIdx); hoverFrame.visible = true; hoverFrame.position.set(x, BED_H + 0.09, z); hoverFrame.material.opacity = 0.65 + Math.sin(t * 6) * 0.3; } else hoverFrame.visible = false;
    updateFx(dt);
    R.render(scene, cam);
  }

  /* ---------------- 作物图标（离屏渲染 3D 模型） ---------------- */
  let IR, IS, IC; const ICONS = {};
  function cropIcon(id, golden) {
    const key = id + (golden ? 'g' : ''); if (ICONS[key]) return ICONS[key];
    try {
      if (!IR) { const c = document.createElement('canvas'); c.width = c.height = 160; IR = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); IR.outputEncoding = T.sRGBEncoding; IR.toneMapping = T.ACESFilmicToneMapping; IR.setClearColor(0x000000, 0); IS = new T.Scene(); IS.add(new T.HemisphereLight(0xffffff, 0x6a7a4a, 0.9)); const d = new T.DirectionalLight(0xfff4e0, 2.2); d.position.set(3, 5, 4); IS.add(d); IC = new T.PerspectiveCamera(28, 1, 0.1, 50); if (!TX.soil) buildTextures(); }
      const m = cropModel(id, 4).clone(); if (golden) { const gm = new T.MeshStandardMaterial({ color: new T.Color('#ffcc33'), metalness: 0.85, roughness: 0.28, emissive: new T.Color('#6a4400'), emissiveIntensity: 0.3 }); m.traverse(o => { if (o.isMesh) o.material = gm; }); }
      IS.add(m); const box = new T.Box3().setFromObject(m), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.68;
      IC.position.set(c.x + r * 2.2, c.y + r * 1.4, c.z + r * 2.4); IC.lookAt(c); IC.updateProjectionMatrix(); IR.render(IS, IC); ICONS[key] = IR.domElement.toDataURL(); IS.remove(m);
    } catch (e) { ICONS[key] = ''; }
    return ICONS[key];
  }
  function zoomBy(f) { zoom = Math.max(0.6, Math.min(1.3, zoom * f)); applyCam(); }
  return { zoomBy, info: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures, progs: R.info.programs.length, q: quality }), get quality() { return quality; }, init, resize, render, setPlots, setHover, setDog, setEnv, setTheme, pick, screenOf, fx, cropIcon, get ready() { return ready; } };
})();
