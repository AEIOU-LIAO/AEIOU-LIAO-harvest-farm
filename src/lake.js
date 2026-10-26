/* =====================================================
   方案 C · 镜湖钓场（第一个新场景，见 docs/SCENES.md）
   - 进场前：世界地图「镜湖钓场」→ 钓场面板（今天还能来几次、鱼竿、湖里有什么鱼、每种鱼的最长纪录）→ 出发（服务器给种子和咬钩序列）
   - 湖边：一面大湖，木栈道、湖心亭、拱桥、小船、芦苇、荷叶，四周远山。主人站在栈道尽头
   - 一次钓鱼：① 按住「抛竿」蓄力、松手抛出 ② 浮漂落水后等鱼咬钩，浮漂往下一沉，赶紧点「提竿」 ③ 收线：按住收线（拉力上升）、
     松开放线（拉力下降），拉力保持在绿区直到收满；拉力太大会断线，太松鱼会脱钩。没钓上也算用掉一次咬钩
   - 收竿回家（时间到 / 点「收竿」）：把用掉了几次、钓上了哪几次交给服务器结算；鱼进仓库（就是鱼塘的鱼，可以出售）
   - 美术交了正式模型以后替换这里程序拼的东西（栈道、亭子、船），玩法不变
   ===================================================== */
const Lake = (() => {
  const T = THREE, L = CFG.LAKE, RODS = {}; L.rods.forEach(r => { RODS[r.id] = r; });
  const FISHN = id => (CFG.FISH.find(f => f.id === id) || { name: '鱼' }).name;
  const FISHC = id => (CFG.FISH.find(f => f.id === id) || { col: '#9ab' }).col;

  /* ---------- 钓场面板 ---------- */
  async function open() {
    const info = await NET.get('/api/lake').catch(e => { toast(e.message || '连接失败', 'warn'); return null; }); if (!info) return;
    const lv = S.me.lv, owned = new Set(info.rods);
    const fish = L.fish.map(f => { const lock = lv < f.lv, best = info.best[f.fish]; return `<div class="row-item${lock ? ' dim' : ''}"><div class="ri-ic"><span class="ii emo" style="background:${FISHC(f.fish)}">${ICON('fish')}</span></div><div class="ri-main"><b>${esc(FISHN(f.fish))}${lock ? ` <em class="lk">Lv.${f.lv} 后出现</em>` : ''}</b><small>${f.cm[0]}~${f.cm[1]} 厘米 · ${f.diff < 0.3 ? '好钓' : f.diff < 0.6 ? '有点难' : '很难钓'}${best ? ` · 你的纪录 ${best} 厘米` : ''}${info.total[f.fish] ? ` · 钓到过 ${info.total[f.fish]} 条` : ''}</small></div></div>`; }).join('');
    const rods = L.rods.map(r => { const have = owned.has(r.id), lock = lv < r.lv; return `<div class="row-item"><div class="ri-ic"><span class="ii emo gold">${ICON('wand')}</span></div><div class="ri-main"><b>${esc(r.name)}${info.rod === r.id ? ' <em class="lk">正在用</em>' : ''}</b><small>${esc(r.desc)} · 收线 ×${r.power}${r.luck ? ` · 稀有鱼 +${Math.round(r.luck * 100)}%` : ''}</small></div>${have ? '<span class="ok">已拥有</span>' : `<button class="btn sm" data-buyr="${r.id}" ${lock ? 'disabled' : ''}>${lock ? `Lv.${r.lv}` : G(r.price)}</button>`}</div>`; }).join('');
    openModal(`${H2('fish', '镜湖钓场', `今天还能来 ${info.tripsLeft} / ${info.trips} 次 · 每次 ${Math.round(L.tripSec / 60)} 分钟`)}
      <p class="fine">站在栈道尽头钓鱼：按住「抛竿」蓄力、松手抛出；浮漂一沉马上「提竿」；收线时按住拉、松开放，拉力别出绿区。钓上来的鱼进仓库，可以出售。</p>
      <div class="row"><button class="btn primary" id="lgo"${!info.unlocked || !info.tripsLeft ? ' disabled' : ''}>${ICON('compass')}${!info.unlocked ? `Lv.${info.unlockLv} 解锁` : info.tripsLeft ? '去钓鱼' : '今天的次数用完了'}</button></div>
      <h4 class="sub">湖里的鱼</h4><div class="list">${fish}</div><h4 class="sub">鱼竿</h4><div class="list">${rods}</div>`, {
      mount: () => {
        qsa('[data-buyr]').forEach(b => b.onclick = async () => { const r = await api('/api/lake/buy', { rod: b.dataset.buyr }); if (r) { sfx('coin'); toast('买到了' + r.result.name); closeModal(true); open(); } });
        const go = $('lgo'); if (go) go.onclick = async () => { const r = await api('/api/lake/start', {}); if (!r) return; closeModal(true); sfx('open'); await Zones.enter('lake', r.result); };
      }
    });
  }

  /* ---------- 小工具 ---------- */
  const rng = s => { let x = s >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
  function canvasTex(w, h, draw, srgb) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (srgb !== false) t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; }
  /* 水面法线：几组正弦波叠加画进一张图，运行时让两层贴图朝不同方向慢慢移动 */
  function waterNormal() { const W = [], r = rng(97); for (let k = 0; k < 14; k++) { const ang = r() * Math.PI * 2, f = 1 + Math.floor(r() * 9); W.push([Math.round(Math.cos(ang) * f), Math.round(Math.sin(ang) * f), r() * 6.28, 0.6 / Math.sqrt(f)]); }   /* 十几组随机方向的波（整数波数，贴图首尾能接上），不会有一条条的纹 */
    return canvasTex(256, 256, (x, w, h) => { const d = x.createImageData(w, h), a = d.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w * Math.PI * 2, v = j / h * Math.PI * 2; let dx = 0, dy = 0; for (const [kx, ky, ph, am] of W) { const c = Math.cos(kx * u + ky * v + ph) * am; dx += c * kx * 0.12; dy += c * ky * 0.12; } const o = (j * w + i) * 4; a[o] = 128 + Math.max(-120, Math.min(120, dx * 60)); a[o + 1] = 128 + Math.max(-120, Math.min(120, dy * 60)); a[o + 2] = 235; a[o + 3] = 255; }
    x.putImageData(d, 0, 0); }, false); }
  const lerp = (a, b, k) => a + (b - a) * k;
  /* 湖岸：半径随角度起伏 */
  const LAKE_R = a => 46 + Math.sin(a * 3 + 0.7) * 5 + Math.sin(a * 5 + 2.1) * 3;

  /* ---------- 进场 ---------- */
  function build(z, S0) {
    if (!S0 || !S0.sid) throw new Error('没有钓鱼记录');
    const canvas = document.getElementById('cv'), scene = new T.Scene(), sky = new T.Color('#cfe6f6'), R0 = rng(S0.seed);
    scene.background = sky; scene.fog = new T.Fog(sky, 90, 360);
    scene.add(new T.HemisphereLight(0xfff6e6, 0x5a7a4a, 0.95));
    const sun = new T.DirectionalLight(0xfff0d8, 2.1); sun.position.set(-40, 70, 30); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 160 }); sun.shadow.bias = -0.0004; sun.target.position.set(0, 0, 34); scene.add(sun, sun.target);
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: new T.Color(c), roughness: 0.85 }, o || {}));
    const add = (geo, m, x, y, z2, cast) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z2); o.castShadow = !!cast; o.receiveShadow = true; scene.add(o); return o; };

    /* 地面：湖底凹下去，岸边慢慢抬高成缓坡，远处是山 */
    const gg = new T.PlaneGeometry(700, 700, 140, 140); gg.rotateX(-Math.PI / 2);
    const hAt = (x, z2) => { const d = Math.hypot(x, z2), a = Math.atan2(z2, x), r = LAKE_R(a); if (d < r) return -2.2 + Math.pow(d / r, 3) * 2.1; const k = (d - r); return Math.min(1, k / 6) * 0.4 + Math.max(0, k - 30) * 0.06 + Math.sin(x * 0.05) * Math.cos(z2 * 0.04) * Math.min(1, k / 40) * 3 + Math.max(0, d - 230) * 0.9; };
    const P = gg.attributes.position, col = new Float32Array(P.count * 3), cG = new T.Color('#7fae55'), cD = new T.Color('#5d8a40'), cS = new T.Color('#d8c48c'), cR = new T.Color('#8f9a8a'), tc = new T.Color();
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z2 = P.getZ(i), y = hAt(x, z2); P.setY(i, y); const d = Math.hypot(x, z2), r = LAKE_R(Math.atan2(z2, x)); tc.copy(cG).lerp(cD, (Math.sin(x * 0.11) * Math.cos(z2 * 0.13) + 1) * 0.3); if (d < r + 3) tc.lerp(cS, Math.min(1, (r + 3 - d) / 4)); if (y > 30) tc.lerp(cR, Math.min(1, (y - 30) / 40)); col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b; }
    gg.setAttribute('color', new T.BufferAttribute(col, 3)); gg.computeVertexNormals();
    const ground = new T.Mesh(gg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); ground.receiveShadow = true; scene.add(ground);
    /* 远山：一圈雾里的剪影 */
    { const m = new T.MeshStandardMaterial({ color: new T.Color('#8ea8b8'), roughness: 1, flatShading: true }); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + R0() * 0.3, d = 300 + R0() * 60, g2 = new T.ConeGeometry(1, 1, 7, 1); const o = new T.Mesh(g2, m); o.position.set(Math.cos(a) * d, -4, Math.sin(a) * d); o.scale.set(70 + R0() * 60, 60 + R0() * 70, 70 + R0() * 60); o.rotation.y = R0() * 6; scene.add(o); } }

    /* 水：两层法线贴图朝不同方向流，阳光下有碎光 */
    const wn = waterNormal(), wn2 = wn.clone(); wn.repeat.set(14, 14); wn2.repeat.set(9, 9); wn2.needsUpdate = true;
    const wm = new T.MeshPhysicalMaterial({ color: new T.Color('#3f86ad'), roughness: 0.08, metalness: 0.1, normalMap: wn, normalScale: new T.Vector2(0.25, 0.25), clearcoat: 1, clearcoatRoughness: 0.15, clearcoatNormalMap: wn2, clearcoatNormalScale: new T.Vector2(0.25, 0.25), transparent: true, opacity: 0.9 });
    const water = new T.Mesh(new T.CircleGeometry(70, 72), wm); water.rotation.x = -Math.PI / 2; water.position.y = -0.25; water.receiveShadow = true; scene.add(water);
    const WY = water.position.y;

    /* 木栈道：从南岸伸进湖里，主人站在尽头 */
    const wood = M('#9a6a3e', { roughness: 0.8 }), wood2 = M('#7a5030', { roughness: 0.85 }), DOCK0 = 50, DOCK1 = 33;
    { const deck = new T.Group(); for (let zz = DOCK1; zz <= DOCK0; zz += 0.55) { const b = new T.Mesh(new T.BoxGeometry(2.6, 0.12, 0.5), (Math.round(zz * 2) % 3) ? wood : wood2); b.position.set((R0() - 0.5) * 0.06, 0.32, zz); b.rotation.y = (R0() - 0.5) * 0.03; b.castShadow = b.receiveShadow = true; deck.add(b); }
      for (let zz = DOCK1 + 0.3; zz <= DOCK0; zz += 2.6) [-1.2, 1.2].forEach(x => { const p = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 2.6, 8), wood2); p.position.set(x, -0.8, zz); p.castShadow = true; deck.add(p); });
      [-1.25, 1.25].forEach(x => { const rl = new T.Mesh(new T.BoxGeometry(0.08, 0.08, DOCK0 - DOCK1 - 3), wood); rl.position.set(x, 0.95, (DOCK0 + DOCK1 + 3) / 2); rl.castShadow = true; deck.add(rl); for (let zz = DOCK1 + 3; zz <= DOCK0; zz += 2.6) { const p = new T.Mesh(new T.BoxGeometry(0.09, 0.65, 0.09), wood); p.position.set(x, 0.65, zz); p.castShadow = true; deck.add(p); } });
      /* 栈道尽头：小凳子、鱼篓、一盏灯笼 */
      const stool = new T.Mesh(new T.CylinderGeometry(0.22, 0.25, 0.42, 10), wood2); stool.position.set(0.85, 0.59, DOCK1 + 0.9); stool.castShadow = true; deck.add(stool);
      const basket = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.36, 12, 1, true), M('#c8a060', { side: T.DoubleSide })); basket.position.set(-0.8, 0.56, DOCK1 + 0.7); basket.castShadow = true; deck.add(basket);
      const post = new T.Mesh(new T.BoxGeometry(0.1, 1.6, 0.1), wood2); post.position.set(-1.25, 1.1, DOCK1 + 0.3); deck.add(post);
      const lan = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), M('#e8503a', { emissive: new T.Color('#ff7040'), emissiveIntensity: 0.5 })); lan.scale.y = 1.25; lan.position.set(-1.25, 1.75, DOCK1 + 0.3); deck.add(lan);
      scene.add(deck); }

    /* 湖心亭 + 拱桥（从西岸过去） */
    { const g = new T.Group(); g.position.set(-17, 0, -10); const stone = M('#b8b2a4', { roughness: 0.9 }), red = M('#b83a2e', { roughness: 0.6 }), roof = M('#3e6e6a', { roughness: 0.7 });
      const isl = new T.Mesh(new T.CylinderGeometry(5.5, 6.8, 2.6, 24), M('#8a9a6a')); isl.position.y = -1.0; isl.receiveShadow = true; g.add(isl);
      const base = new T.Mesh(new T.CylinderGeometry(3.4, 3.6, 0.4, 8), stone); base.position.y = 0.5; base.castShadow = base.receiveShadow = true; g.add(base);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, c = new T.Mesh(new T.CylinderGeometry(0.13, 0.15, 2.6, 8), red); c.position.set(Math.cos(a) * 2.8, 2.0, Math.sin(a) * 2.8); c.castShadow = true; g.add(c); }
      const rf = new T.Mesh(new T.ConeGeometry(4.3, 2.0, 8, 1), roof); rf.position.y = 4.2; rf.castShadow = true; g.add(rf); const rf2 = new T.Mesh(new T.ConeGeometry(2.4, 1.3, 8, 1), roof); rf2.position.y = 5.4; rf2.castShadow = true; g.add(rf2);
      const top = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), M('#e8c060', { metalness: 0.6, roughness: 0.3 })); top.position.y = 6.2; g.add(top);
      scene.add(g);
      /* 拱桥：一串弧形木板 */
      const br = new T.Group(); const x0 = -40, x1 = -22.5, zb = -10; for (let i = 0; i <= 26; i++) { const k = i / 26, x = lerp(x0, x1, k), y = 0.25 + Math.sin(k * Math.PI) * 1.6; const b = new T.Mesh(new T.BoxGeometry(0.7, 0.12, 2.0), wood); b.position.set(x, y, zb); b.rotation.z = Math.cos(k * Math.PI) * 0.33; b.castShadow = true; br.add(b); if (i % 3 === 0) [-1, 1].forEach(s => { const p = new T.Mesh(new T.BoxGeometry(0.08, 0.7, 0.08), red); p.position.set(x, y + 0.4, zb + s * 0.95); br.add(p); }); }
      scene.add(br); }

    /* 小船：漂在湖面上，轻轻晃 */
    const boat = new T.Group(); { const hull = new T.Mesh(new T.CylinderGeometry(0.75, 0.5, 3.4, 12, 1, true, 0, Math.PI), M('#8a5a32', { side: T.DoubleSide })); hull.rotation.set(Math.PI / 2, 0, Math.PI); hull.position.y = 0.15; hull.castShadow = true; boat.add(hull); const seat = new T.Mesh(new T.BoxGeometry(1.3, 0.08, 0.35), wood); seat.position.y = 0.05; boat.add(seat); const oar = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 2.2, 6), wood2); oar.rotation.z = 1.2; oar.position.set(0.7, 0.1, 0.3); boat.add(oar); }
    boat.position.set(14, WY, 6); boat.rotation.y = 0.9; scene.add(boat);

    /* 芦苇（实例化）：沿湖岸一圈，栈道附近留空 */
    { const n = 900, geo = new T.ConeGeometry(0.035, 1.6, 4, 1, true); geo.translate(0, 0.8, 0); const im = new T.InstancedMesh(geo, M('#8aa458', { side: T.DoubleSide }), n), d = new T.Object3D(), c = new T.Color(); let k = 0;
      for (let t = 0; t < n * 4 && k < n; t++) { const a = R0() * Math.PI * 2, r = LAKE_R(a) + (R0() - 0.6) * 4, x = Math.cos(a) * r, z2 = Math.sin(a) * r; if (Math.abs(x) < 3 && z2 > 30) continue; if (Math.hypot(x + 31, z2 + 10) < 4) continue; const cl = Math.sin(a * 19) > -0.2; if (!cl) continue;
        d.position.set(x, hAt(x, z2) - 0.1, z2); d.rotation.set((R0() - 0.5) * 0.3, R0() * 6, (R0() - 0.5) * 0.3); d.scale.set(1, 0.6 + R0() * 0.8, 1); d.updateMatrix(); im.setMatrixAt(k, d.matrix); im.setColorAt(k, c.setHSL(0.2 + R0() * 0.06, 0.45, 0.42 + R0() * 0.15)); k++; }
      im.count = k; scene.add(im); }
    /* 荷叶 + 荷花（实例化） */
    { const n = 160, pad = new T.CircleGeometry(0.55, 14, 0.3, Math.PI * 2 - 0.5); pad.rotateX(-Math.PI / 2); const im = new T.InstancedMesh(pad, M('#4f8a3a', { roughness: 0.6, side: T.DoubleSide }), n), d = new T.Object3D(); let k = 0;
      const fl = new T.ConeGeometry(0.16, 0.22, 6, 1, true); fl.translate(0, 0.11, 0); fl.rotateX(Math.PI); fl.translate(0, 0.22, 0); const fim = new T.InstancedMesh(fl, M('#ff9ac0', { roughness: 0.5, side: T.DoubleSide }), 40); let kf = 0;
      for (let t = 0; t < n * 6 && k < n; t++) { const a = R0() * Math.PI * 2, r = LAKE_R(a) - 3 - R0() * 9, x = Math.cos(a) * r, z2 = Math.sin(a) * r; if (Math.abs(x) < 6 && z2 > 10) continue; if (Math.sin(a * 4 + 1) < 0.2) continue;
        d.position.set(x, WY + 0.02, z2); d.rotation.set(0, R0() * 6, 0); d.scale.setScalar(0.7 + R0() * 0.8); d.updateMatrix(); im.setMatrixAt(k++, d.matrix); if (kf < 40 && R0() < 0.25) { d.position.y += 0.02; d.updateMatrix(); fim.setMatrixAt(kf++, d.matrix); } }
      im.count = k; fim.count = kf; scene.add(im, fim); }
    /* 岸边的柳树、石头 */
    { const trunk = M('#6a4a2e'), leaf = M('#6aa84a', { roughness: 0.8, flatShading: true }), stone = M('#9a968c', { roughness: 0.95, flatShading: true });
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + R0() * 0.2, r = LAKE_R(a) + 7 + R0() * 14, x = Math.cos(a) * r, z2 = Math.sin(a) * r; if (Math.abs(x) < 5 && z2 > 38) continue; const y = hAt(x, z2), s = 0.9 + R0() * 0.6, g = new T.Group(); g.position.set(x, y, z2); g.scale.setScalar(s);
        const tr = new T.Mesh(new T.CylinderGeometry(0.22, 0.32, 3.2, 7), trunk); tr.position.y = 1.6; tr.castShadow = true; g.add(tr);
        for (let j = 0; j < 4; j++) { const c = new T.Mesh(new T.IcosahedronGeometry(1.5 + R0() * 0.6, 1), leaf); c.position.set((R0() - 0.5) * 2, 3.6 + R0() * 1.2, (R0() - 0.5) * 2); c.scale.y = 0.8; c.castShadow = true; g.add(c); }
        scene.add(g); }
      for (let i = 0; i < 30; i++) { const a = R0() * Math.PI * 2, r = LAKE_R(a) + 0.5 + R0() * 3, x = Math.cos(a) * r, z2 = Math.sin(a) * r; if (Math.abs(x) < 3 && z2 > 30) continue; const s = 0.3 + R0() * 0.9; const o = add(new T.DodecahedronGeometry(s, 0), stone, x, hAt(x, z2) + s * 0.2, z2, s > 0.6); o.scale.y = 0.6; o.rotation.set(R0(), R0() * 6, R0()); } }

    /* ---------- 主人 + 鱼竿 + 鱼线 + 浮漂 ---------- */
    const HERO_P = new T.Vector3(0, 0.38, DOCK1 + 1.6), hero = new T.Group(); hero.position.copy(HERO_P); hero.rotation.y = Math.PI; scene.add(hero);
    const rod = new T.Group(); rod.position.set(-0.28, 1.05, 0.18); hero.add(rod); /* 鱼竿握在右手（人物朝 -z，右手在 -x 一侧） */
    const rodLen = 3.2, rodM = new T.Mesh(new T.CylinderGeometry(0.012, 0.03, rodLen, 6), M('#5a3a1e', { roughness: 0.6 })); rodM.position.y = rodLen / 2; rod.add(rodM); const reelM = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.05, 12), M('#c8c0b0', { metalness: 0.5, roughness: 0.4 })); reelM.rotation.z = Math.PI / 2; reelM.position.y = 0.25; rod.add(reelM);
    const tipLocal = new T.Vector3(0, rodLen, 0), tip = new T.Vector3();
    let lib = null, rig = null, dead = false;
    (async () => { try { lib = new Assets3({ manifest: GAMECFG.ASSETS }); const r = await Entity3.spawn(lib, PREF.v3hero || HERO_DEFAULT, 'hero', { tier: '1k' }); if (dead) { Entity3.release(lib, r, true); return; } r.object.scale.setScalar(0.8); r.play('idle', 0); hero.add(r.object); rig = r; } catch (e) { console.warn('钓场主人模型加载失败', e); } })();
    const bob = new T.Group(); { const top = new T.Mesh(new T.SphereGeometry(0.09, 12, 8), M('#ff4a3a', { roughness: 0.4 })); top.position.y = 0.06; const low = new T.Mesh(new T.SphereGeometry(0.08, 12, 8), M('#ffffff', { roughness: 0.4 })); low.position.y = -0.03; const st = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.22, 5), M('#ffcc40')); st.position.y = 0.2; bob.add(top, low, st); } bob.visible = false; scene.add(bob);
    const NL = 24, lineGeo = new T.BufferGeometry(); lineGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(NL * 3), 3)); const line = new T.Line(lineGeo, new T.LineBasicMaterial({ color: 0xf4f0e6, transparent: true, opacity: 0.8 })); line.frustumCulled = false; line.visible = false; scene.add(line);
    /* 水花：一圈扩散的波纹 */
    const ripTex = canvasTex(64, 64, (x) => { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.stroke(); });
    const ripples = []; function ripple(x, z2, big) { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: ripTex, transparent: true, depthWrite: false, opacity: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set(x, WY + 0.03, z2); scene.add(m); ripples.push({ m, t: 0, s: big ? 3.2 : 1.6 }); }
    /* 钓上来的鱼：跃出水面的小鱼（程序拼的，用鱼的颜色） */
    const fishG = new T.Group(); { const body = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), M('#c8a060', { roughness: 0.45, metalness: 0.2 })); body.scale.set(1, 0.45, 0.32); fishG.add(body); const tail = new T.Mesh(new T.ConeGeometry(0.16, 0.26, 4), body.material); tail.rotation.z = Math.PI / 2; tail.position.x = -0.38; fishG.add(tail); fishG.userData.body = body; } fishG.visible = false; scene.add(fishG);

    /* ---------- 镜头：在主人身后、看向湖面；可以左右拖一点 ---------- */
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 900); let camYaw = 0, camGoalYaw = 0; const drag = { id: -1, x: 0 };
    const cvDown = e => { if (e.target !== canvas) return; drag.id = e.pointerId; drag.x = e.clientX; }, cvMove = e => { if (e.pointerId !== drag.id) return; camGoalYaw = Math.max(-0.7, Math.min(0.7, camGoalYaw - (e.clientX - drag.x) * 0.004)); drag.x = e.clientX; }, cvUp = e => { if (e.pointerId === drag.id) drag.id = -1; };
    canvas.addEventListener('pointerdown', cvDown); canvas.addEventListener('pointermove', cvMove); canvas.addEventListener('pointerup', cvUp); canvas.addEventListener('pointercancel', cvUp);

    /* ---------- 界面 ---------- */
    const ui = document.createElement('div'); ui.id = 'lakeui'; ui.innerHTML = `
      <div class="lk-top"><b>镜湖钓场</b><span class="lk-time">5:00</span><span class="lk-bag">鱼篓 0 条</span><button class="btn sm" data-lend>${ICON('home')}收竿</button></div>
      <div class="lk-msg"></div>
      <div class="lk-tension"><i class="lk-safe"></i><i class="lk-cur"></i><span>拉力</span></div>
      <div class="lk-prog"><i></i></div>
      <div class="lk-power"><i></i></div>
      <button class="lk-btn" data-act><span>按住抛竿</span></button>
      <div class="lk-card"></div>`;
    document.body.appendChild(ui); document.body.classList.add('fishing');
    const $u = s => ui.querySelector(s), btn = $u('[data-act]'), msgEl = $u('.lk-msg'), card = $u('.lk-card');
    let msgT = 0; function say(t, ms) { msgEl.textContent = t; msgEl.classList.add('on'); msgT = (ms || 1800) / 1000; }

    /* ---------- 状态机 ---------- */
    const rodDef = RODS[S0.rod] || L.rods[0], bites = S0.bites, caught = [], tripMs = (S0.tripSec || L.tripSec) * 1000, t0 = performance.now();
    let state = 'idle', used = 0, st = 0, power = 0, holding = false, castFrom = new T.Vector3(), castTo = new T.Vector3(), tension = 0.3, prog = 0, slackT = 0, surgeT = 1, ended = false, tAcc = 0, cur = null, rodBend = 0, jump = null;
    const SAFE_LO = 0.12, SAFE_HI = () => 0.82 + (rodDef.slack || 0);
    function setBtn(t, cls) { btn.querySelector('span').textContent = t; btn.className = 'lk-btn' + (cls ? ' ' + cls : ''); }
    function toIdle() { state = 'idle'; bob.visible = false; line.visible = false; setBtn('按住抛竿'); $u('.lk-tension').classList.remove('on'); $u('.lk-prog').classList.remove('on'); }
    function nextBite() { return used < bites.length ? bites[used] : null; }
    function press() {
      if (ended) return; holding = true;
      if (state === 'idle') { if (!nextBite()) { say('今天的鱼都被你钓光啦，收竿回家吧', 2500); return; } state = 'charge'; power = 0; st = 0; $u('.lk-power').classList.add('on'); setBtn('松手抛出'); sfx('click'); }
      else if (state === 'wait') { say('太早了，鱼还没咬钩', 1400); toIdle(); }   /* 太早提竿：这次不算用掉咬钩 */
      else if (state === 'bite') { state = 'reel'; tension = 0.35; prog = 0.08; slackT = 0; surgeT = 0.8; $u('.lk-tension').classList.add('on'); $u('.lk-prog').classList.add('on'); setBtn('按住收线', 'reel'); say(`上钩了！是${FISHN(cur.f)}`, 1500); sfx('golden'); if (navigator.vibrate) navigator.vibrate(60); }
    }
    function release() {
      holding = false; if (ended) return;
      if (state === 'charge') { state = 'cast'; st = 0; $u('.lk-power').classList.remove('on'); hero.updateMatrixWorld(true); rod.localToWorld(tip.copy(tipLocal)); castFrom.copy(tip);
        const d = 7 + power * 17, a = (Math.random() - 0.5) * 0.35 + camYaw * 0.6; castTo.set(HERO_P.x - Math.sin(a) * d, WY, HERO_P.z - Math.cos(a) * d); bob.visible = true; line.visible = true; setBtn('等鱼咬钩…', 'wait'); sfx('open'); }
    }
    btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); press(); }); btn.addEventListener('pointerup', release); btn.addEventListener('pointercancel', release);
    const kd = e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); } }, ku = e => { if (e.code === 'Space') { e.preventDefault(); release(); } };
    document.addEventListener('keydown', kd, true); document.addEventListener('keyup', ku, true);
    $u('[data-lend]').onclick = () => finish();

    function fail(t) { used++; say(t, 1800); sfx('click'); toIdle(); }
    function landFish() {
      caught.push(cur.i); used++; state = 'show'; st = 0; $u('.lk-tension').classList.remove('on'); $u('.lk-prog').classList.remove('on'); setBtn('…', 'wait'); sfx('coin'); if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
      const best = (S0.best || {})[cur.f], rec = !best || cur.cm > best; if (rec) { S0.best = S0.best || {}; S0.best[cur.f] = cur.cm; }
      card.innerHTML = `<i style="background:${FISHC(cur.f)}"></i><b>${esc(FISHN(cur.f))}</b><span>${cur.cm} 厘米${cur.big ? ' · 大鱼！多一条' : ''}</span>${rec ? '<em>新纪录</em>' : ''}`; card.classList.add('on');
      fishG.userData.body.material.color.set(FISHC(cur.f)); fishG.scale.setScalar(0.6 + cur.cm / 70); fishG.visible = true; jump = { t: 0, from: bob.position.clone() };
      $u('.lk-bag').textContent = `鱼篓 ${caught.length} 条`;
    }
    function updateFishing(dt) {
      st += dt;
      if (state === 'charge') { power = (Math.sin(st * 2.6 - Math.PI / 2) + 1) / 2; $u('.lk-power i').style.height = Math.round(power * 100) + '%'; rodBend = -0.5 * power; }
      else if (state === 'cast') { const k = Math.min(1, st / 0.8); bob.position.lerpVectors(castFrom, castTo, k); bob.position.y = lerp(castFrom.y, WY, k) + Math.sin(k * Math.PI) * (2 + power * 3); rodBend = lerp(0.4, 0, k);
        if (k >= 1) { state = 'wait'; st = 0; cur = nextBite(); ripple(bob.position.x, bob.position.z, false); sfx('splash'); cur.waitEff = Math.max(cur.wait, 3.6); } }   /* 抛竿 0.8 秒 + 至少等 3.6 秒：每次咬钩至少隔 4.4 秒，服务器按 minBiteSec × 0.8 = 4 秒校验 */
      else if (state === 'wait') { bob.position.y = WY + Math.sin(tAcc * 2.2) * 0.02; if (Math.random() < dt * 0.5) { bob.position.y -= 0.03; } if (st >= cur.waitEff) { state = 'bite'; st = 0; bob.position.y = WY - 0.12; ripple(bob.position.x, bob.position.z, true); sfx('splash'); setBtn('提竿！', 'hit'); say('浮漂沉下去了！', 900); if (navigator.vibrate) navigator.vibrate(40); } }
      else if (state === 'bite') { bob.position.y = WY - 0.12 + Math.sin(tAcc * 18) * 0.04; if (st > 1.05 - cur.diff * 0.35) fail(`${FISHN(cur.f)}把饵吃了就跑了`); }
      else if (state === 'reel') {
        const diff = cur.diff, hi = SAFE_HI();
        surgeT -= dt; if (surgeT <= 0) { surgeT = 0.5 + Math.random() * (1.4 - diff * 0.6); tension += (0.08 + diff * 0.22) * (holding ? 1 : 0.5); ripple(bob.position.x, bob.position.z, false); }
        if (holding) { tension += (0.32 + diff * 0.42) * dt; prog += 0.2 * rodDef.power * (1 - diff * 0.45) * dt; } else { tension -= 0.62 * dt; prog -= 0.035 * diff * dt; }
        tension = Math.max(0, tension); prog = Math.max(0, Math.min(1, prog));
        if (tension < SAFE_LO) slackT += dt; else slackT = Math.max(0, slackT - dt * 2);
        $u('.lk-cur').style.bottom = Math.min(100, tension / 1.05 * 100) + '%'; $u('.lk-cur').classList.toggle('bad', tension > hi || tension < SAFE_LO); $u('.lk-prog i').style.width = Math.round(prog * 100) + '%';
        /* 浮漂被拉向栈道，鱼左右挣扎 */
        const dock = new T.Vector3(HERO_P.x, WY, HERO_P.z - 1.2); const p = bob.position; p.lerpVectors(castTo, dock, prog * 0.85); p.x += Math.sin(tAcc * (3 + diff * 4)) * (0.4 + diff * 0.8) * (1 - prog); p.y = WY - 0.06;
        rodBend = 0.35 + Math.min(0.6, tension * 0.6);
        if (tension > 1.02) fail('线断了！拉得太猛'); else if (slackT > 1.6) fail(`线太松，${FISHN(cur.f)}脱钩了`); else if (prog >= 1) landFish();
      }
      else if (state === 'show') { if (jump) { const k = Math.min(1, jump.t / 0.9); jump.t += dt; fishG.position.lerpVectors(jump.from, tip, k); fishG.position.y += Math.sin(k * Math.PI) * 1.2; fishG.rotation.z = Math.sin(tAcc * 20) * 0.5; if (k >= 1) { fishG.visible = false; jump = null; } }
        if (st > 2.2) { card.classList.remove('on'); toIdle(); } }
      /* 鱼竿弯曲（整根转一点）+ 鱼线：从竿尖到浮漂，中间垂一点 */
      rod.rotation.x = lerp(rod.rotation.x, 0.75 + rodBend * 0.6, Math.min(1, dt * 8)); rod.rotation.z = -0.12;   /* 正值：竿尖朝湖面（人物朝 -z，在自己坐标里是 +z） */
      hero.updateMatrixWorld(true); rod.localToWorld(tip.copy(tipLocal));
      if (line.visible) { const a = line.geometry.attributes.position.array, sag = state === 'reel' ? 0.05 : state === 'cast' ? 0.2 : 0.6; for (let i = 0; i < NL; i++) { const k = i / (NL - 1); a[i * 3] = lerp(tip.x, bob.position.x, k); a[i * 3 + 1] = lerp(tip.y, bob.position.y + 0.08, k) - Math.sin(k * Math.PI) * sag; a[i * 3 + 2] = lerp(tip.z, bob.position.z, k); } line.geometry.attributes.position.needsUpdate = true; }
    }

    /* ---------- 结算 ---------- */
    async function finish() {
      if (ended) return; ended = true; if (state === 'reel' || state === 'bite') used++;   /* 正在收线时收竿：这次算用掉 */
      const r = await api('/api/lake/end', { sid: S0.sid, caught, used }, { free: true }).catch(() => null), res = r && r.result;
      const cnt = {}; caught.forEach(i => { const f = bites[i].f; cnt[f] = (cnt[f] || 0) + 1; });
      const rows = Object.entries(cnt).map(([f, n]) => `<span class="chip"><i class="hu-dot" style="background:${FISHC(+f)}"></i>${esc(FISHN(+f))} ×${n}</span>`).join('') || '<div class="empty">这次一条也没钓到，下次手快一点</div>';
      const items = res ? Object.entries(res.items).map(([k, n]) => `<span class="chip">${esc(itemName(k))} ×${n}</span>`).join('') : '';
      const recs = res && res.records.length ? `<p class="fine">新纪录：${res.records.map(x => `${esc(FISHN(x.f))} ${x.cm} 厘米`).join('、')}</p>` : '';
      openModal(`${H2('fish', caught.length ? '满载而归' : '空手而归', res ? `用时 ${Math.floor(res.seconds / 60)} 分 ${res.seconds % 60} 秒 · 咬钩 ${res.used} 次` : '')}<div class="chips">${rows}</div>
        ${res ? `<p class="fine">${res.exp} 经验${items ? '，鱼放进了仓库：' : ''}</p><div class="chips">${items}</div>${recs}` : '<p class="fine">结算失败，请检查网络后在钓场面板重新出发。</p>'}
        <div class="row"><button class="btn primary" id="lhome">${ICON('home')}回家园</button></div>`, { small: true, noclose: true, mount: () => { $('lhome').onclick = async () => { closeModal(true); await Zones.enter('home'); }; } });
    }

    let hudT = 0;
    function hud() { const left = Math.max(0, tripMs - (performance.now() - t0)) / 1000, m = Math.floor(left / 60), s = Math.floor(left % 60), tm = $u('.lk-time'); tm.textContent = `${m}:${String(s).padStart(2, '0')}`; tm.classList.toggle('low', left < 30); if (left <= 0 && !ended && state !== 'reel') { say('太阳下山了，收竿回家吧', 2500); finish(); } }
    toIdle(); say('按住下面的按钮蓄力，松手抛竿', 2600);

    return {
      scene, get camera() { return cam; },
      update(dt) { tAcc += dt; dt = Math.min(dt, 0.05);
        if (!ended) updateFishing(dt);
        wn.offset.set(tAcc * 0.012, tAcc * 0.008); wn2.offset.set(-tAcc * 0.01, tAcc * 0.014);
        boat.position.y = WY + Math.sin(tAcc * 1.1) * 0.05; boat.rotation.z = Math.sin(tAcc * 0.9) * 0.04;
        for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; const k = r.t / 1.4; r.m.scale.setScalar(0.3 + k * r.s); r.m.material.opacity = 0.9 * (1 - k); if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); ripples.splice(i, 1); } }
        if (rig) { rig.play('idle'); rig.update(dt); rig.rot('RightArm', 'x', -0.9 - rodBend * 0.5); rig.rot('RightForeArm', 'x', -0.6); if (state === 'reel') rig.rot('LeftArm', 'x', -0.7 + Math.sin(tAcc * 10) * 0.15 * (holding ? 1 : 0)); }
        camYaw += (camGoalYaw - camYaw) * Math.min(1, dt * 3); const cx = HERO_P.x + Math.sin(camYaw) * 7.5, cz = HERO_P.z + Math.cos(camYaw) * 7.5; cam.position.set(cx, 4.2, cz); cam.lookAt(HERO_P.x - Math.sin(camYaw) * 12, 0.2, HERO_P.z - Math.cos(camYaw) * 12);
        if (msgT > 0) { msgT -= dt; if (msgT <= 0) msgEl.classList.remove('on'); }
        hudT -= dt; if (hudT <= 0) { hudT = 0.25; hud(); } },
      resize(w, h) { cam.aspect = w / h; cam.fov = w < h ? 66 : 50; cam.updateProjectionMatrix(); },   /* 竖屏视野放宽，湖心亭、远山看得到 */
      dispose() { dead = true; ended = true; document.removeEventListener('keydown', kd, true); document.removeEventListener('keyup', ku, true); canvas.removeEventListener('pointerdown', cvDown); canvas.removeEventListener('pointermove', cvMove); canvas.removeEventListener('pointerup', cvUp); canvas.removeEventListener('pointercancel', cvUp);
        ui.remove(); document.body.classList.remove('fishing'); if (rig && lib) Entity3.release(lib, rig, true); Zones.disposeTree(scene); wn.dispose(); wn2.dispose(); ripTex.dispose(); },
      debug: () => ({ state, used, caught: caught.slice(), tension: +tension.toFixed(2), prog: +prog.toFixed(2), cur: cur && { f: cur.f, cm: cur.cm, diff: cur.diff }, rig: !!rig }),
      press, release, finish,
    };
  }
  Zones.BUILDERS.lake = build;
  return { open };
})();
