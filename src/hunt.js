/* =====================================================
   第 2 期 · 名山猎场（温和狩猎）
   - 进山前：世界地图「名山猎场」→ 猎场面板（今天还能进几次山、武器、山里有什么野兽）→ 进山（服务器给种子）
   - 山里：程序生成的大山（种子 + 生物群系，和服务器算的一样）；主人是美术 V3 男主角（加载失败时用简单模型）
     左下摇杆 / WASD 走，Shift 或推满摇杆跑；右下「发射」自动瞄准射程内最近的野兽；把野兽打晕后走到旁边自动捕获
     梅花鹿见人就跑；野猪被打中会冲过来；灰狼、黑熊看见人会扑过来，被撞到掉体力；体力掉光被猎户送回家，收获减半
     带着吃饱的福旺进山：福旺会闻出最近的野兽在哪个方向，下山时金币多 20%
   - 下山（时间到 / 点「下山」/ 体力耗尽）：把捕获的野兽序号交给服务器结算
   ===================================================== */
const Hunt = (() => {
  const T = THREE, H = CFG.HUNT, CR = {}; H.creatures.forEach(c => { CR[c.id] = c; });
  const WP = {}; H.weapons.forEach(w => { WP[w.id] = w; });
  const CREATURE_COL = { deer: '#b5733a', boar: '#5a4636', wolf: '#8c8e96', bear: '#2e2824' };

  /* ---------- 猎场面板 ---------- */
  async function open() {
    const info = await NET.get('/api/hunt').catch(e => { toast(e.message || '连接失败', 'warn'); return null; }); if (!info) return;
    const lv = S.me.lv, owned = new Set(info.weapons);
    const beasts = H.creatures.map(c => `<div class="row-item${lv < c.lv ? ' dim' : ''}"><div class="ri-ic"><span class="ii emo" style="background:${CREATURE_COL[c.id]}">${ICON('paw')}</span></div><div class="ri-main"><b>${esc(c.name)}${lv < c.lv ? ` <em class="lk">Lv.${c.lv} 后出现</em>` : ''}</b><small>${esc(c.desc)} · 要打中 ${c.hp} 下 · 赏金 ${fmt(c.reward.gold)}、${Object.entries(c.reward.items).map(([k, n]) => itemName(k) + '×' + n).join('、')}</small></div><div class="ri-num">${(info.total[c.id] || 0) ? '已捕获 ' + info.total[c.id] : ''}</div></div>`).join('');
    const guns = H.weapons.map(w => { const have = owned.has(w.id), lock = lv < w.lv; return `<div class="row-item"><div class="ri-ic"><span class="ii emo gold">${ICON('target')}</span></div><div class="ri-main"><b>${esc(w.name)}</b><small>${esc(w.desc)} · 射程 ${w.range} 米 · 每发 ${w.dmg} 下</small></div>${have ? '<span class="ok">已拥有</span>' : `<button class="btn sm${lock ? '' : ' primary'}" data-buyw="${w.id}"${lock ? ' disabled' : ''}>${lock ? `Lv.${w.lv}` : G(w.price)}</button>`}</div>`; }).join('');
    openModal(`${H2('paw', '名山猎场', `今天还能进山 ${info.tripsLeft} / ${info.trips} 次 · 每次 ${Math.round(H.tripSec / 60)} 分钟`)}
      <p class="fine">用弹弓、猎弓、麻醉枪把野兽打晕，走到旁边就能捕获，送去山里的保护站换赏金和材料（材料在仓库里可以出售）。${info.dog ? '福旺吃饱了，会跟你进山帮忙追踪，金币 +' + Math.round(H.dogGoldBonus * 100) + '%。' : '喂饱福旺再进山，它会帮你追踪野兽，金币 +' + Math.round(H.dogGoldBonus * 100) + '%。'}</p>
      <div class="row"><button class="btn primary" id="hgo"${!info.unlocked || !info.tripsLeft ? ' disabled' : ''}>${ICON('compass')}${!info.unlocked ? `Lv.${info.unlockLv} 解锁` : info.tripsLeft ? '进山' : '今天的次数用完了'}</button></div>
      <h4 class="sub">山里的野兽</h4><div class="list">${beasts}</div><h4 class="sub">武器</h4><div class="list">${guns}</div>`, {
      mount: () => {
        qsa('[data-buyw]').forEach(b => b.onclick = async () => { const r = await api('/api/hunt/buy', { weapon: b.dataset.buyw }); if (r) { sfx('coin'); toast('买到了' + r.result.name); closeModal(true); open(); } });
        const go = $('hgo'); if (go) go.onclick = async () => { const r = await api('/api/hunt/start', {}); if (!r) return; closeModal(true); sfx('open'); await Zones.enter('mountain', r.result); };
      }
    });
  }

  /* ---------- 野兽模型（顶点色、低多边形；身体一个网格 + 四条腿） ---------- */
  const GEO = {};
  function part(g, col, x, y, z, sx, sy, sz, rx, rz) { const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, 0, rz || 0)), new T.Vector3(sx, sy, sz)); return Zones.geoWithColor(g.clone().applyMatrix4(m), col); }
  function creatureGeo(id) {
    if (GEO[id]) return GEO[id]; const S = new T.IcosahedronGeometry(1, 1), Cy = new T.CylinderGeometry(1, 1, 1, 6), Co = new T.ConeGeometry(1, 1, 6), M = T.BufferGeometryUtils.mergeBufferGeometries, p = [];
    let leg = { len: 0.6, r: 0.05, col: '#7a4a24', x: 0.32, z: 0.13, y: 0.6 };
    if (id === 'deer') { const b = '#b5733a', w = '#f2e6d0', a = '#d8c8a0';
      p.push(part(S, b, 0, 0.9, 0, 0.5, 0.25, 0.22), part(S, w, -0.46, 1.0, 0, 0.06, 0.07, 0.06), part(Cy, b, 0.38, 1.15, 0, 0.09, 0.45, 0.09, 0, -0.6), part(S, b, 0.6, 1.38, 0, 0.17, 0.1, 0.09), part(S, '#2a1a10', 0.76, 1.36, 0, 0.03, 0.03, 0.03));
      [-1, 1].forEach(s => { p.push(part(S, b, 0.52, 1.5, s * 0.09, 0.05, 0.03, 0.08, s * 0.5), part(Cy, a, 0.55, 1.68, s * 0.08, 0.018, 0.34, 0.018, s * 0.35, 0.2), part(Cy, a, 0.5, 1.78, s * 0.16, 0.014, 0.18, 0.014, s * 1.0, 0.4), part(Cy, a, 0.62, 1.8, s * 0.12, 0.014, 0.16, 0.014, s * 0.6, -0.5)); });
      for (let i = 0; i < 9; i++) p.push(part(S, w, -0.3 + (i % 3) * 0.22, 1.08 + ((i * 7) % 3) * 0.02, (i % 2 ? 1 : -1) * (0.13 + (i % 3) * 0.02), 0.03, 0.03, 0.02));
      leg = { len: 0.68, r: 0.04, col: '#9a5e2e', x: 0.32, z: 0.12, y: 0.72 }; }
    else if (id === 'boar') { const b = '#5a4636';
      p.push(part(S, b, 0, 0.55, 0, 0.55, 0.32, 0.28), part(S, '#4a382a', -0.05, 0.86, 0, 0.42, 0.08, 0.08), part(S, b, 0.5, 0.55, 0, 0.24, 0.2, 0.18), part(Cy, '#7a5a48', 0.75, 0.5, 0, 0.09, 0.12, 0.09, 0, Math.PI / 2), part(S, '#c89a8a', 0.81, 0.5, 0, 0.02, 0.06, 0.06));
      [-1, 1].forEach(s => { p.push(part(Co, '#f4ecd8', 0.68, 0.55, s * 0.1, 0.025, 0.14, 0.025, s * 0.3, -0.6), part(Co, b, 0.48, 0.76, s * 0.1, 0.05, 0.12, 0.03, s * 0.3), part(S, '#1a1008', 0.62, 0.62, s * 0.11, 0.02, 0.02, 0.02)); });
      leg = { len: 0.36, r: 0.06, col: '#3e3024', x: 0.3, z: 0.16, y: 0.38 }; }
    else if (id === 'wolf') { const b = '#8c8e96', w = '#d8d8dc';
      p.push(part(S, b, 0, 0.72, 0, 0.5, 0.22, 0.2), part(S, w, 0.12, 0.62, 0, 0.3, 0.14, 0.16), part(S, b, 0.5, 0.86, 0, 0.18, 0.15, 0.14), part(Co, b, 0.72, 0.82, 0, 0.07, 0.22, 0.07, 0, -Math.PI / 2), part(S, '#1a1a1a', 0.83, 0.82, 0, 0.025, 0.025, 0.025), part(Co, b, -0.62, 0.72, 0, 0.09, 0.5, 0.09, 0, Math.PI / 2 + 0.5));
      [-1, 1].forEach(s => p.push(part(Co, b, 0.48, 1.04, s * 0.08, 0.04, 0.14, 0.03), part(S, '#e8c040', 0.64, 0.9, s * 0.07, 0.02, 0.02, 0.02)));
      leg = { len: 0.5, r: 0.045, col: '#7a7c84', x: 0.3, z: 0.12, y: 0.52 }; }
    else { const b = '#2e2824';
      p.push(part(S, b, 0, 0.95, 0, 0.75, 0.5, 0.46), part(S, b, -0.1, 1.25, 0, 0.5, 0.3, 0.35), part(S, b, 0.72, 1.12, 0, 0.3, 0.28, 0.28), part(S, '#b8946a', 0.98, 1.05, 0, 0.12, 0.1, 0.12), part(S, '#1a1008', 1.08, 1.08, 0, 0.04, 0.035, 0.04), part(S, '#e8dcc8', 0.42, 1.0, 0, 0.06, 0.18, 0.3));
      [-1, 1].forEach(s => p.push(part(S, b, 0.7, 1.42, s * 0.18, 0.08, 0.08, 0.05), part(S, '#100c08', 0.88, 1.2, s * 0.1, 0.025, 0.025, 0.025)));
      leg = { len: 0.55, r: 0.13, col: '#262019', x: 0.45, z: 0.26, y: 0.58 }; }
    const lg = Zones.geoWithColor(new T.CylinderGeometry(leg.r, leg.r * 0.8, leg.len, 6).translate(0, -leg.len / 2, 0), leg.col);
    S.dispose(); Cy.dispose(); Co.dispose();
    return (GEO[id] = { body: M(p), leg: lg, L: leg });
  }
  const CMAT = () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  function makeCreature(s, mat) {
    const c = CR[s.id], G0 = creatureGeo(s.id), g = new T.Group(), body = new T.Mesh(G0.body, mat); body.castShadow = true; g.add(body); const legs = [];
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([fx, sz]) => { const l = new T.Mesh(G0.leg, mat); l.position.set(fx * G0.L.x, G0.L.y, sz * G0.L.z); l.castShadow = true; g.add(l); legs.push(l); });
    g.scale.setScalar(c.size); g.rotation.order = 'YXZ'; return { s, c, g, body, legs, hp: c.hp, state: 'wander', tgt: null, t: 0, ph: Math.random() * 6, cool: 0, sleepT: 0, hit: 0, home: [s.x, s.z], v: 0 };
  }

  /* ---------- 进山 ---------- */
  function build(z, S0) {
    if (!S0 || !S0.sid) throw new Error('没有进山记录');
    const gen = H.gen, canvas = document.getElementById('cv'), scene = new T.Scene(), sky = new T.Color('#bcdcf4');
    scene.background = sky; scene.fog = new T.Fog(sky, 60, 170);
    scene.add(new T.HemisphereLight(0xfff4e0, 0x4a6a3a, 0.95)); const sun = new T.DirectionalLight(0xfff0d8, 2.0); sun.position.set(40, 80, 30); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); scene.add(sun, sun.target);
    const world = CFG.genWorld(gen, S0.seed), TR = Zones.makeTerrain(scene, gen, world), groundAt = TR.groundAt;
    const cam = new T.PerspectiveCamera(55, 1, 0.1, 400);
    /* 主人 */
    const hero = { pos: new T.Vector3(S0.start[0], 0, S0.start[1]), face: Math.PI, spd: 0, ph: 0, hp: S0.heroHp || H.heroHp, inv: 0, g: new T.Group(), rig: null, kb: new T.Vector3() };
    { const cap = new T.Mesh(new T.CapsuleGeometry(0.3, 0.8, 4, 10), new T.MeshStandardMaterial({ color: new T.Color('#4a8fd8').convertSRGBToLinear(), roughness: 0.7 })); cap.position.y = 0.7; cap.castShadow = true; cap.visible = false; /* 2026-10-26：不显示占位的胶囊，角色模型加载好再出现（加载失败才显示） */ hero.g.add(cap); hero.cap = cap; }
    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.52, 28), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; hero.g.add(ring); scene.add(hero.g);
    let lib = null, dead = false;
    (async () => { try { lib = new Assets3({ manifest: GAMECFG.ASSETS }); const rig = await Entity3.spawn(lib, PREF.v3hero || HERO_DEFAULT, 'hero', { tier: '1k' }); if (dead) { Entity3.release(lib, rig, true); return; } rig.object.scale.setScalar(0.8); rig.play('idle', 0); hero.g.add(rig.object); hero.rig = rig; hero.g.remove(hero.cap); } catch (e) { console.warn('猎场主人模型加载失败，用简单模型', e); hero.cap.visible = true; } })();
    /* 野兽 */
    const cmat = CMAT(), beasts = S0.list.map(s => { const b = makeCreature(s, cmat); b.g.position.set(s.x, groundAt(s.x, s.z), s.z); b.g.rotation.y = Math.random() * 6.28; scene.add(b.g); return b; });
    /* 2026-10-26 美术 v4_wildlife 第一批：鹿、野猪、狼、熊的骨骼模型（idle / walk / run）。占位模型先顶着，加载好就换掉；
       模型头朝 +Z，这里的野兽朝 +X，所以外面套一层转 90°；尺寸按美术的真实肩高 × 1.2（镜头里看得清），不再跟占位模型的 size 走 */
    const BEAST_K = 1.2, beastLib = { lib: null };
    (async () => { try { beastLib.lib = beastLib.lib || new Assets3({ manifest: GAMECFG.ASSETS });
        for (const b of beasts) { if (dead) return; const aid = 'v4w_' + b.c.id; if (!GAMECFG.ASSETS.some(a => a.id === aid)) continue;
          const rig = await Entity3.spawn(beastLib.lib, aid, 'beast', { tier: '1k' }); if (dead || b.gone) { Entity3.release(beastLib.lib, rig, true); continue; }
          const w = new T.Group(); w.rotation.y = Math.PI / 2; w.scale.setScalar(BEAST_K / b.c.size); w.add(rig.object); rig.play('idle', 0); if (rig.inst.mixer) rig.inst.mixer.setTime(Math.random() * 2);
          b.g.add(w); b.rig = rig; b.rw = w; b.body.visible = false; b.legs.forEach(l => { l.visible = false; }); } }
      catch (e) { console.warn('野兽模型加载失败，继续用简单模型', e); } })();
    const zzzTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = 'bold 40px sans-serif'; x.fillStyle = '#fff'; x.strokeStyle = '#3a5a9a'; x.lineWidth = 5; x.strokeText('Zz', 6, 46); x.fillText('Zz', 6, 46); const t = new T.CanvasTexture(c); return t; })();
    const zzzMat = new T.SpriteMaterial({ map: zzzTex, transparent: true, depthWrite: false });
    /* 子弹 */
    const shots = [], shotGeo = { slingshot: new T.SphereGeometry(0.08, 6, 4), bow: new T.CylinderGeometry(0.02, 0.02, 0.8, 4).rotateZ(Math.PI / 2), tranq: new T.CylinderGeometry(0.03, 0.03, 0.3, 5).rotateZ(Math.PI / 2) }, shotMat = new T.MeshStandardMaterial({ color: new T.Color('#d8d0c0').convertSRGBToLinear(), roughness: 0.5 });
    const caught = [], weapons = (S0.weapons || ['slingshot']).filter(id => WP[id]); let weapon = weapons.slice().sort((a, b) => WP[b].dmg - WP[a].dmg)[0] || 'slingshot', cool = 0;
    const t0 = performance.now(), tripMs = (S0.tripSec || H.tripSec) * 1000; let ended = false, faint = false, tAcc = 0, camYaw = 0, camPitch = 0.38, camDist = 7.5;
    const input = { x: 0, z: 0, run: false }, keys = new Set();
    /* ---------- 界面 ---------- */
    const ui = document.createElement('div'); ui.id = 'huntui'; ui.innerHTML = `
      <div class="hu-top"><b>${esc(z.name)}</b><span class="hu-time"></span><span class="hu-hp"></span><span class="hu-bag"></span><button class="btn sm primary" data-hend>${ICON('home')}下山</button></div>
      <div class="hu-dog"></div><div class="hu-msg"></div>
      <div class="hu-joy"><i></i></div>
      <div class="hu-right"><div class="hu-weap">${weapons.map(id => `<button class="btn sm" data-w="${id}">${WP[id].name}</button>`).join('')}</div><button class="hu-fire" data-fire>${ICON('target')}<span>发射</span></button></div>`;
    document.body.appendChild(ui); document.body.classList.add('hunting');
    const $u = s => ui.querySelector(s), joy = $u('.hu-joy'), knob = joy.querySelector('i');
    let msgT = 0; const say = (t, ms) => { const m = $u('.hu-msg'); m.textContent = t; m.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('on'), ms || 1800); };
    const renderWeap = () => ui.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('primary', b.dataset.w === weapon));
    renderWeap(); ui.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { weapon = b.dataset.w; renderWeap(); sfx('click'); say(`换成${WP[weapon].name}：射程 ${WP[weapon].range} 米`); });
    let endArm = 0; $u('[data-hend]').onclick = () => { if (caught.length || performance.now() - endArm < 3000) return finish(); endArm = performance.now(); say('还没有捕获野兽，再点一次「下山」确认', 3000); };
    const fireBtn = $u('[data-fire]'); fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); fire(); });
    /* 摇杆 */
    let jid = -1, jc = [0, 0]; const JR = 46;
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; joy.setPointerCapture(e.pointerId); jmove(e); });
    const jmove = e => { if (e.pointerId !== jid) return; let dx = e.clientX - jc[0], dy = e.clientY - jc[1]; const d = Math.hypot(dx, dy); if (d > JR) { dx *= JR / d; dy *= JR / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.x = dx / JR; input.z = dy / JR; input.run = d > JR * 0.95; };
    const jend = e => { if (e.pointerId !== jid) return; jid = -1; knob.style.transform = ''; input.x = input.z = 0; input.run = false; };
    joy.addEventListener('pointermove', jmove); joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    /* 拖动画面转镜头 */
    const drag = { id: -1, x: 0, y: 0 };
    const cvDown = e => { if (drag.id !== -1) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; }, cvMove = e => { if (e.pointerId !== drag.id) return; camYaw -= (e.clientX - drag.x) * 0.007; camPitch = Math.max(0.12, Math.min(1.1, camPitch + (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; }, cvUp = e => { if (e.pointerId === drag.id) drag.id = -1; };
    const wheel = e => { camDist = Math.max(4, Math.min(16, camDist * (e.deltaY > 0 ? 1.08 : 0.93))); };
    canvas.addEventListener('pointerdown', cvDown); canvas.addEventListener('pointermove', cvMove); canvas.addEventListener('pointerup', cvUp); canvas.addEventListener('pointercancel', cvUp); canvas.addEventListener('wheel', wheel, { passive: true });
    const KM = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    const keyIn = () => { if (jid !== -1) return; let x = 0, z2 = 0; keys.forEach(k => { const v = KM[k]; if (v) { x += v[0]; z2 += v[1]; } }); const l = Math.hypot(x, z2) || 1; input.x = x / l; input.z = z2 / l; input.run = keys.has('shift'); };
    const kd = e => { if (e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase(); if (k === ' ' || k === 'f' || k === 'enter') { e.preventDefault(); if (!e.repeat) fire(); return; } if (KM[k] || k === 'shift') { e.preventDefault(); keys.add(k); keyIn(); } if (k >= '1' && k <= '3' && weapons[+k - 1]) { weapon = weapons[+k - 1]; renderWeap(); } };
    const ku = e => { const k = e.key.toLowerCase(); if (keys.delete(k)) keyIn(); };
    document.addEventListener('keydown', kd, true); document.addEventListener('keyup', ku, true);
    say((S0.dog ? '福旺跟着你进山了，它会帮你闻出野兽在哪里。' : '') + '慢慢走近不容易惊动梅花鹿，右下「发射」自动瞄准最近的野兽', 3600);

    /* ---------- 规则 ---------- */
    function fire() {
      if (ended) return; const w = WP[weapon]; if (cool > 0) return;
      const fx = Math.sin(hero.face), fz = Math.cos(hero.face); let best = null, bs = 1e9;
      beasts.forEach(b => { if (b.state === 'sleep' || b.gone) return; const p = b.g.position, dx = p.x - hero.pos.x, dz = p.z - hero.pos.z, d = Math.hypot(dx, dz); if (d > w.range) return; const front = (dx * fx + dz * fz) / (d || 1), sc = d - front * 6; if (sc < bs) { bs = sc; best = b; } });
      if (!best) { say(`射程（${w.range} 米）内没有醒着的野兽`); sfx('err'); cool = 0.3; return; }
      cool = w.cd; const p = best.g.position; hero.face = Math.atan2(p.x - hero.pos.x, p.z - hero.pos.z);
      const m = new T.Mesh(shotGeo[weapon] || shotGeo.slingshot, shotMat), from = hero.pos.clone(); from.y = groundAt(from.x, from.z) + 1.1; m.position.copy(from); scene.add(m); shots.push({ m, b: best, w }); sfx('click');
      if (hero.rig) hero.shootT = 0.25;
    }
    function hitBeast(b, w) {
      if (b.gone || b.state === 'sleep') return; b.hp -= w.dmg; b.hit = 0.25;
      if (b.hp <= 0) { b.state = 'sleep'; b.sleepT = 40; b.v = 0; b.zzz = new T.Sprite(zzzMat); b.zzz.scale.setScalar(0.8); b.g.add(b.zzz); b.zzz.position.set(0, 1.6, 0); say(`${b.c.name}睡着了，快走过去捕获！`); sfx('golden'); return; }
      if (b.c.flee) { b.state = 'flee'; b.t = 3.5; } else { b.state = 'chase'; b.t = 8; }
      say(`打中了${b.c.name}（还要 ${Math.ceil(b.hp / w.dmg)} 下）`, 1200);
    }
    function hurtHero(b) { if (hero.inv > 0 || ended) return; if (hero.rig) hero.rig.face('face_frown'); hero.hp -= b.c.dmg; hero.inv = 1.4; const d = hero.pos.clone().sub(b.g.position).setY(0).normalize(); hero.kb.copy(d).multiplyScalar(7); sfx('err'); flash();
      say(`被${b.c.name}撞到了！体力 -${b.c.dmg}`); try { navigator.vibrate && navigator.vibrate(60); } catch (e) { } if (hero.hp <= 0) { faint = true; say('体力不支……猎户把你送下了山', 3000); setTimeout(finish, 1200); } }
    function flash() { const f = document.createElement('div'); f.className = 'hu-flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 450); }
    function capture(b) { if (hero.rig) hero.rig.face('face_smile'); b.gone = true; caught.push(b.s.i); scene.remove(b.g); sfx('harvest'); say(`捕获了${b.c.name}！`, 1600); }
    async function finish() {
      if (ended) return; ended = true; input.x = input.z = 0;
      const r = await api('/api/hunt/end', { sid: S0.sid, caught, faint }, { free: true }).catch(() => null);
      const res = r && r.result, cnt = {}; caught.forEach(i => { const id = S0.list[i].id; cnt[id] = (cnt[id] || 0) + 1; });
      const rows = Object.entries(cnt).map(([id, n]) => `<span class="chip"><i class="hu-dot" style="background:${CREATURE_COL[id]}"></i>${esc(CR[id].name)} ×${n}</span>`).join('') || '<div class="empty">这次没有捕获到野兽</div>';
      const items = res ? Object.entries(res.items).map(([k, n]) => `<span class="chip">${esc(itemName(k))} ×${n}</span>`).join('') : '';
      openModal(`${H2('paw', faint ? '被猎户送回了家' : '满载而归', res ? `用时 ${Math.floor(res.seconds / 60)} 分 ${res.seconds % 60} 秒` : '')}<div class="chips">${rows}</div>
        ${res ? `<p class="fine">保护站给你：${G(res.gold)} 金币、${res.exp} 经验${items ? '，还有：' : ''}</p><div class="chips">${items}</div>${res.dog ? `<p class="fine">福旺帮了大忙：金币 +${Math.round(H.dogGoldBonus * 100)}%</p>` : ''}${res.faint ? '<p class="fine">体力耗尽，收获减半。下次留意灰狼和黑熊。</p>' : ''}` : '<p class="fine">结算失败，请检查网络后在猎场面板重新进山。</p>'}
        <div class="row"><button class="btn primary" id="hhome">${ICON('home')}回家园</button></div>`, { small: true, noclose: true, mount: () => { $('hhome').onclick = async () => { closeModal(true); await Zones.enter('home'); }; } });
      if (res && res.n) sfx('level');
    }

    /* ---------- 每帧 ---------- */
    const tmp = new T.Vector3();
    function nearestAwake() { let best = null, bd = 1e9; beasts.forEach(b => { if (b.gone || b.state === 'sleep') return; const d = b.g.position.distanceTo(hero.pos); if (d < bd) { bd = d; best = b; } }); return best ? { b: best, d: bd } : null; }
    function moveTo(b, tx, tz, v, dt) { const p = b.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < 0.2) { b.v = 0; return d; } const st = Math.min(d, v * dt), nx = p.x + dx / d * st, nz = p.z + dz / d * st; if (!TR.walkable(nx, nz)) { b.tgt = null; b.v = 0; return 0; } p.x = nx; p.z = nz; b.v = v; const want = Math.atan2(-dz, dx); let da = want - b.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); b.g.rotation.y += da * Math.min(1, dt * 8); return d; }
    /* 专属单次动作（美术 v4_wildlife_v2）：有这个动作才播，返回是否播了 */
    function special(b, name, dur) { if (!name || !b.rig || !b.rig.inst.has(name)) return false; b.rig.state = null; b.rig.play(name, 0.15); const a = b.rig.inst.actions[name]; if (a) a.timeScale = 1; b.spT = dur; return true; }
    function updateBeast(b, dt, t) {
      const p = b.g.position, c = b.c, dh = Math.hypot(hero.pos.x - p.x, hero.pos.z - p.z);
      if (dh > 90 && b.state !== 'chase') { b.g.visible = false; return; } b.g.visible = true;
      if (b.state === 'sleep') { b.sleepT -= dt; b.legs.forEach(l => { l.rotation.z = 0; }); if (b.zzz) b.zzz.position.y = 1.5 + Math.sin(t * 2) * 0.12;
        /* 2026-10-27 美术 v4_wildlife_v2 交了侧躺呼吸的 sleep（自带侧躺、收腿、闭眼）：直接播，不再整只侧翻；没有骨骼模型（加载失败的占位）才用旧的整体侧翻 */
        if (b.rig && b.rig.inst.has('sleep')) { b.spT = 0; b.rig.play('sleep', 0.3); b.rig.pace(0, 1); b.rig.update(dt); } else { b.g.rotation.x = Math.min(1.45, b.g.rotation.x + dt * 4); if (b.rig) { b.rig.play('sleep'); b.rig.update(dt * 0.4); } }
        if (dh < H.captureDist) capture(b); else if (b.sleepT <= 0) { b.state = 'flee'; b.t = 4; b.hp = Math.ceil(c.hp / 2); b.g.rotation.x = 0; b.g.remove(b.zzz); b.zzz = null; say(`${c.name}醒了，跑掉了！`); } p.y = groundAt(p.x, p.z); return; }
      b.cool = Math.max(0, b.cool - dt); b.t -= dt;
      if (c.aggro && dh < c.aggro && b.state !== 'flee') { b.state = 'chase'; b.t = Math.max(b.t, 2); }
      if (c.flee && dh < c.flee * (hero.spd > 3.5 ? 1 : 0.55) && b.state !== 'flee') { b.state = 'flee'; b.t = 3 + Math.random() * 2; b.spT = 0; } /* 慢慢走过去（不跑）不容易惊动 */
      /* 鹿：主人慢慢靠近到警觉范围，先停下来抬头张望（alert，2.4 秒），这时候再靠近就跑；离开了就接着吃草 */
      b.alertCD = Math.max(0, (b.alertCD || 0) - dt);
      if (c.flee && b.state === 'wander' && dh < c.flee * 1.5 && !b.alertCD && special(b, 'alert', 2.4)) { if (hero.rig) hero.rig.face('face_brow_raise'); b.state = 'alert'; b.t = 2.4; b.alertCD = 9; b.tgt = null; }
      if (b.state === 'alert') { b.v = 0; const want = Math.atan2(-(hero.pos.z - p.z), hero.pos.x - p.x); let da = want - b.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); b.g.rotation.y += da * Math.min(1, dt * 3); if (b.t <= 0) b.state = 'wander'; }
      /* 狼扑、熊拍：快撞到主人之前先起动作（单次 1.2 秒），撞到的时候正好扑 / 拍下来 */
      if (b.state === 'chase' && b.cool <= 0 && !(b.spT > 0) && dh < 1.4 * c.size + 2.2) special(b, c.id === 'wolf' ? 'pounce' : c.id === 'bear' ? 'swipe' : '', 1.2);
      if (b.state === 'chase') { if (dh > 32 || b.t <= 0) { b.state = 'wander'; b.tgt = null; } else { moveTo(b, hero.pos.x, hero.pos.z, c.speed, dt); if (dh < 1.4 * c.size + 0.4 && b.cool <= 0) { hurtHero(b); b.cool = 1.6; b.state = 'back'; b.t = 1.2; } } }
      else if (b.state === 'back') { const a = Math.atan2(p.z - hero.pos.z, p.x - hero.pos.x); moveTo(b, p.x + Math.cos(a) * 3, p.z + Math.sin(a) * 3, c.speed * 0.6, dt); if (b.t <= 0) b.state = c.aggro || c.charge ? 'chase' : 'wander'; }
      else if (b.state === 'flee') { const a = Math.atan2(p.z - hero.pos.z, p.x - hero.pos.x) + Math.sin(t + b.ph) * 0.4; if (!moveTo(b, p.x + Math.cos(a) * 5, p.z + Math.sin(a) * 5, c.speed, dt)) b.g.rotation.y += dt * 3; if (b.t <= 0) { b.state = 'wander'; b.tgt = null; } }
      else if (b.state === 'alert') { }
      else { if (!b.tgt) { b.t = Math.min(b.t, 0); if (b.t <= 0) { const a = Math.random() * 6.28, r = 3 + Math.random() * 10, tx = b.home[0] + Math.cos(a) * r, tz = b.home[1] + Math.sin(a) * r; if (TR.walkable(tx, tz)) b.tgt = [tx, tz]; b.t = 2 + Math.random() * 4; } b.v = 0; } else if (moveTo(b, b.tgt[0], b.tgt[1], c.speed * 0.3, dt) < 0.3) { b.tgt = null; b.t = 1.5 + Math.random() * 3; } }
      p.y = groundAt(p.x, p.z); b.ph += dt * b.v * 2.6; const sw = Math.min(0.7, b.v * 0.12);
      b.legs.forEach((l, k) => { l.rotation.z = Math.sin(b.ph + (k === 0 || k === 3 ? 0 : Math.PI)) * sw; }); b.body.position.y = Math.abs(Math.sin(b.ph)) * sw * 0.08;
      if (b.hit > 0) { b.hit -= dt; b.body.position.y += 0.08; }
      if (b.rig) { const r = b.rig, v = b.v || 0; if (b.spT > 0) { b.spT -= dt; r.update(dt); } else { r.play(v > c.speed * 0.55 ? 'run' : v > 0.15 ? 'walk' : 'idle'); r.pace(v, BEAST_K); r.update(dt); } b.rw.position.y = b.hit > 0 ? 0.08 / c.size : 0; }
    }
    function updateHero(dt) {
      const mag = Math.min(1, Math.hypot(input.x, input.z)), sy = Math.sin(camYaw), cy = Math.cos(camYaw), mx = input.x * cy + input.z * sy, mz = -input.x * sy + input.z * cy;
      const want = ended ? 0 : mag > 0.05 ? (input.run ? 4.6 : 3.0) * Math.max(0.35, mag) : 0; hero.spd += (want - hero.spd) * Math.min(1, dt * 10);
      if (mag > 0.05 && !ended) { const f = Math.atan2(mx, mz); let d = f - hero.face; d = Math.atan2(Math.sin(d), Math.cos(d)); hero.face += Math.max(-dt * 12, Math.min(dt * 12, d)); }
      const fx = Math.sin(hero.face), fz = Math.cos(hero.face), st = hero.spd * dt; let nx = hero.pos.x + fx * st + hero.kb.x * dt, nz = hero.pos.z + fz * st + hero.kb.z * dt; hero.kb.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (TR.walkable(nx, nz)) { hero.pos.x = nx; hero.pos.z = nz; } else if (TR.walkable(nx, hero.pos.z)) hero.pos.x = nx; else if (TR.walkable(hero.pos.x, nz)) hero.pos.z = nz;
      hero.pos.y = groundAt(hero.pos.x, hero.pos.z); hero.g.position.copy(hero.pos); hero.g.rotation.y = hero.face; hero.inv = Math.max(0, hero.inv - dt); hero.g.visible = hero.inv <= 0 || Math.floor(hero.inv * 10) % 2 === 0;
      const moving = hero.spd > 0.3; hero.ph += dt * (hero.spd > 4.6 ? 11 : 7.5) * (moving ? 1 : 0);
      if (hero.rig) { const r = hero.rig; r.play(hero.spd > 2.2 ? 'run' : moving ? 'walk' : 'idle'); r.pace(hero.spd, 0.8); r.update(dt); if (r.faked) r.heroGait({ phase: hero.ph, amp: moving ? (hero.spd > 4.6 ? 0.85 : 0.55) * Math.min(1, hero.spd / 3) : 0, lean: hero.spd > 4.6 ? 0.12 : moving ? 0.05 : 0 }); else if (hero.shootT <= 0) r.liven(); if (hero.shootT > 0) { hero.shootT -= dt; r.rot('RightArm', 'x', -1.4); } }
      else if (hero.cap) hero.cap.position.y = 0.7 + Math.abs(Math.sin(hero.ph)) * 0.08;
      /* 镜头：慢慢转到人物身后 */
      if (moving && drag.id === -1) { let d = hero.face + Math.PI - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.6) camYaw += d * Math.min(1, dt * 1.2); }
      const cp = Math.cos(camPitch); tmp.set(hero.pos.x, hero.pos.y + 1.2, hero.pos.z); cam.position.set(tmp.x + Math.sin(camYaw) * cp * camDist, tmp.y + Math.sin(camPitch) * camDist, tmp.z + Math.cos(camYaw) * cp * camDist);
      const gy = groundAt(cam.position.x, cam.position.z) + 0.8; if (cam.position.y < gy) cam.position.y = gy; cam.lookAt(tmp); sun.position.set(hero.pos.x + 40, hero.pos.y + 80, hero.pos.z + 30); sun.target.position.copy(hero.pos);
    }
    let hudT = 0;
    function hud() {
      const left = Math.max(0, tripMs - (performance.now() - t0)) / 1000, m = Math.floor(left / 60), s = Math.floor(left % 60);
      const tm = $u('.hu-time'); tm.textContent = `${m}:${String(s).padStart(2, '0')}`; tm.classList.toggle('low', left < 30);
      $u('.hu-hp').innerHTML = Array.from({ length: S0.heroHp || H.heroHp }, (_, i) => `<i class="${i < hero.hp ? 'on' : ''}"></i>`).join('');
      $u('.hu-bag').textContent = `已捕获 ${caught.length}`;
      const n = nearestAwake(), dog = $u('.hu-dog');
      if (S0.dog && n) { const p = n.b.g.position, a = Math.atan2(p.x - hero.pos.x, p.z - hero.pos.z), rel = a - (camYaw + Math.PI); dog.innerHTML = `<span class="hu-arrow" style="transform:rotate(${(-rel * 180 / Math.PI).toFixed(0)}deg)">↑</span>福旺：${Math.round(n.d)} 米外有${n.b.c.name}`; dog.style.display = ''; }
      else dog.style.display = S0.dog ? '' : 'none';
      if (S0.dog && !n) dog.textContent = '福旺：附近没有醒着的野兽了';
      fireBtn.classList.toggle('cool', cool > 0); if (left <= 0 && !ended) { say('天快黑了，下山吧', 2500); finish(); }
    }
    return {
      scene, get camera() { return cam; },
      update(dt) { tAcc += dt; dt = Math.min(dt, 0.05); cool = Math.max(0, cool - dt); updateHero(dt); beasts.forEach(b => { if (!b.gone) updateBeast(b, dt, tAcc); });
        for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i], tp = s.b.g.position.clone(); tp.y += 0.8 * s.b.c.size; const d = tp.distanceTo(s.m.position), st = 45 * dt; if (d <= st || s.b.gone) { scene.remove(s.m); shots.splice(i, 1); if (!s.b.gone) hitBeast(s.b, s.w); } else { s.m.position.addScaledVector(tp.sub(s.m.position).normalize(), st); s.m.lookAt(s.b.g.position); s.m.rotateY(Math.PI / 2); } }
        TR.water.position.y = TR.lakeY + Math.sin(tAcc * 0.8) * 0.05; hudT -= dt; if (hudT <= 0) { hudT = 0.2; hud(); } },
      resize(w, h) { cam.aspect = w / h; cam.updateProjectionMatrix(); },
      dispose() { dead = true; ended = true; document.removeEventListener('keydown', kd, true); document.removeEventListener('keyup', ku, true); canvas.removeEventListener('pointerdown', cvDown); canvas.removeEventListener('pointermove', cvMove); canvas.removeEventListener('pointerup', cvUp); canvas.removeEventListener('pointercancel', cvUp); canvas.removeEventListener('wheel', wheel);
        ui.remove(); document.body.classList.remove('hunting'); if (hero.rig && lib) Entity3.release(lib, hero.rig, true); beasts.forEach(b => { if (b.rig && beastLib.lib) Entity3.release(beastLib.lib, b.rig, true); b.rig = null; }); Zones.disposeTree(scene); Object.values(shotGeo).forEach(g => g.dispose()); zzzTex.dispose(); Object.keys(GEO).forEach(k => { GEO[k].body.dispose(); GEO[k].leg.dispose(); delete GEO[k]; }); },
      debug: () => ({ hero: [hero.pos.x, hero.pos.z, hero.hp], caught: caught.slice(), beasts: beasts.map(b => [b.c.id, +b.g.position.x.toFixed(1), +b.g.position.z.toFixed(1), b.state, b.hp, !!b.gone, b.rig ? b.rig.real : null, +b.g.position.y.toFixed(2)]), weapon }),
      /* 只在 ?dev=1 时可用：让最近的一只野兽直接睡着（测试 sleep 动作用） */
      dbgSleep: () => { if (!Zones.DEV) return false; const n = nearestAwake(); if (!n) return false; const b = n.b; b.hp = 1; hitBeast(b, { dmg: 9 }); return b.c.id; },
      fire, finish, tp(x, z2) { hero.pos.set(x, 0, z2); }, face(a) { hero.face = a; camYaw = a + Math.PI; },
    };
  }
  Zones.BUILDERS.mountain = build;
  return { open, CREATURE_COL };
})();
