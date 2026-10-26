/* =====================================================
   丰收农场 · 通用 3D 资源模块（V0.1）
   - 按 content/assets.jsonc 的清单加载美术资源（GLB）
   - 优先下载 gzip 版（.glb.gz），用浏览器自带 DecompressionStream 解压；不支持时回退未压缩版
   - 贴图不用 GLB 内嵌图片（手机微信解码会失败），按材质 extras 里的名字加载单独的 jpg，分档：1k（手机）/ 2k（高清）
   - 缓存 + 引用计数：同一个资源只下载一次；没人用了可以释放显存
   - 实例：SkeletonUtils.clone（共享几何和贴图，骨骼独立）；配件显示 / 隐藏；动作播放带缺省回退
   依赖：THREE（r149）、THREE.GLTFLoader、THREE.SkeletonUtils（vendor/three-addons.js）
   用法：
     const lib = new Assets3({ manifest: GAMECFG.ASSETS, onProgress: (id, k, bytes) => … });
     const inst = await lib.spawn('v2_dog_fuwang', { tier: '1k' });   // inst.object 加进场景
     inst.play('walk');                       // 没有 walk 就按回退表找 idle
     inst.setAccessories({ harness: true });  inst.update(dt);
     lib.release(inst);                       // 场景里移除后调用
   ===================================================== */
(function (root) {
  'use strict';
  const T = root.THREE;
  /* 动作回退：美术分批交动作时，缺的动作先用相近的顶上 */
  const FALLBACK = { gallop: ['trot', 'run', 'walk'], trot: ['walk'], run: ['walk'], walk: ['idle'], stalk: ['walk'], sit_idle: ['sit', 'idle'], lie_idle: ['lie', 'sleep', 'idle'], sleep: ['lie_idle', 'idle'], happy: ['idle'], bark: ['idle'], drink: ['idle'], sniff: ['walk', 'idle'], jump_air: ['idle'], plant: ['harvest', 'idle'], harvest: ['plant', 'idle'], water: ['plant', 'idle'], wave: ['idle'], cheer: ['wave', 'idle'] };

  async function fetchBytes(url, onBytes) {
    const r = await fetch(url); if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    if (!r.body || !r.body.getReader) return new Uint8Array(await r.arrayBuffer());
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (onBytes) onBytes(total ? got / total : 0, got); }
    const out = new Uint8Array(got); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
  }
  async function gunzip(u8) { if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8; /* CDN 已经自动解压过 */ const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }

  class Assets3 {
    constructor(opts) {
      opts = opts || {};
      this.manifest = {}; (opts.manifest || []).forEach(a => { this.manifest[a.id] = a; });
      this.onProgress = opts.onProgress || null;
      this.gl = new T.GLTFLoader(); this.tl = new T.TextureLoader();
      this.glb = {};   // id → Promise<{ gltf, tier, refs }>
      this.tex = {};   // url → Promise<Texture|null>
      this.anisotropy = opts.anisotropy || 4;
    }
    info(id) { const a = this.manifest[id]; if (!a) throw new Error('资源清单里没有 ' + id); return a; }
    texture(url, srgb) {
      return this.tex[url] || (this.tex[url] = new Promise(ok => this.tl.load(url, t => { t.flipY = false; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = this.anisotropy; ok(t); }, undefined, () => ok(null))));
    }
    async fetchGLB(a) {
      const on = this.onProgress ? (k, b) => this.onProgress(a.id, k, b) : null; let u8 = null; const tm = (this.tm = this.tm || {})[a.id] = { t0: performance.now() };
      if (typeof DecompressionStream !== 'undefined') { try { u8 = await gunzip(await fetchBytes(a.base + a.file + '.glb.gz', on)); } catch (e) { u8 = null; } }
      if (!u8) u8 = await fetchBytes(a.base + a.file + '.glb', on); tm.fetched = performance.now();
      return new Promise((ok, no) => this.gl.parse(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), a.base, g => { tm.parsed = performance.now(); ok(g); }, no));
    }
    /* 按档位给材质装贴图；换档时释放另一档，省显存 */
    async applyTier(entry, a, tier) {
      const g = entry.gltf, J = g.parser.json, folder = tier === '2k' && (a.tiers || []).includes('2k') ? 'tex2k/' : 'tex/', mats = new Set();
      g.scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => mats.add(m)); });
      await Promise.all([...mats].map(async m => {
        const d = (J.materials || []).find(x => x.name === m.name); if (!d) return; const ex = d.extras || {}, old = [m.map, m.normalMap, m.roughnessMap];
        /* 三张贴图同时下载（以前一张接一张） */
        const [tc, tn, tr] = await Promise.all([ex.baseColorTexture ? this.texture(a.base + folder + ex.baseColorTexture + '.' + (ex.baseColorTextureExt || 'jpg'), true) : null, ex.normalTexture ? this.texture(a.base + folder + ex.normalTexture + '.jpg', false) : null, ex.metallicRoughnessTexture ? this.texture(a.base + folder + ex.metallicRoughnessTexture + '.jpg', false) : null]);
        if (tc) m.map = tc; if (tn) m.normalMap = tn; if (ex.metallicRoughnessTexture) { if (tr) m.roughnessMap = m.metalnessMap = tr; else { m.metalness = 0; m.roughness = 0.8; } }
        /* 2026-10-26 建筑：美术烘焙的环境光遮蔽（glTF occlusionTexture，强度按 GLB 里写的）。r149 的 aoMap 用第二套 UV，这里直接复用第一套 */
        if (ex.occlusionTexture) { const ta = await this.texture(a.base + folder + ex.occlusionTexture + '.jpg', false); if (ta) { m.aoMap = ta; m.aoMapIntensity = (d.occlusionTexture && d.occlusionTexture.strength) || ex.aoStrength || 1; g.scene.traverse(o => { if (o.isMesh && [].concat(o.material).includes(m)) { const ge = o.geometry; if (!ge.attributes.uv2 && ge.attributes.uv) ge.setAttribute('uv2', ge.attributes.uv); } }); } }
        if (ex.emissiveTexture) { const te = await this.texture(a.base + folder + ex.emissiveTexture + '.' + (ex.emissiveTextureExt || 'jpg'), true); if (te) m.emissiveMap = te; }
        m.needsUpdate = true;
        old.forEach(t => { if (t && t !== m.map && t !== m.normalMap && t !== m.roughnessMap) this.dropTexture(t); });
      }));
      entry.tier = tier; if (this.tm && this.tm[a.id]) this.tm[a.id].tex = performance.now();
    }
    dropTexture(t) { t.dispose(); for (const k of Object.keys(this.tex)) this.tex[k].then(x => { if (x === t) delete this.tex[k]; }); }
    /* 下载并准备好一个资源（不放进场景）。同一个 id 只下载一次 */
    load(id, tier) {
      const a = this.info(id); tier = tier || '1k';
      if (!this.glb[id]) this.glb[id] = this.fetchGLB(a).then(async gltf => { const e = { gltf, tier: null, refs: 0 }; await this.applyTier(e, a, tier); return e; }).catch(err => { delete this.glb[id]; throw err; });
      return this.glb[id].then(async e => { if (e.tier !== tier && (a.tiers || []).includes(tier)) await this.applyTier(e, a, tier); return e; });
    }
    /* 生成一个可以放进场景的实例 */
    async spawn(id, opts) {
      opts = opts || {}; const a = this.info(id), e = await this.load(id, opts.tier); e.refs++;
      const obj = T.SkeletonUtils.clone(e.gltf.scene); obj.traverse(o => { if (o.isMesh) { o.castShadow = opts.castShadow !== false; o.frustumCulled = !!opts.frustumCulled; } });
      return new Instance(this, a, e, obj);
    }
    /* 场景里移除实例后调用；refs 归零且 purge 为 true 时释放这个资源的几何和贴图 */
    release(inst, purge) {
      const e = inst.entry; e.refs = Math.max(0, e.refs - 1); if (inst.mixer) inst.mixer.stopAllAction();
      if (purge && e.refs === 0) { e.gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { ['map', 'normalMap', 'roughnessMap'].forEach(k => m[k] && this.dropTexture(m[k])); m.dispose(); }); } }); delete this.glb[inst.asset.id]; }
    }
    /* 已加载资源的显存粗估（MB），用于区域预算检查 */
    texMB() { let n = 0; const seen = new Set(); return Promise.all(Object.values(this.tex)).then(ts => { ts.forEach(t => { if (t && t.image && !seen.has(t)) { seen.add(t); n += t.image.width * t.image.height * 4 * 1.33; } }); return +(n / 1048576).toFixed(1); }); }
  }

  class Instance {
    constructor(lib, asset, entry, object) {
      this.lib = lib; this.asset = asset; this.entry = entry; this.object = object;
      this.clips = entry.gltf.animations || []; this.mixer = this.clips.length ? new T.AnimationMixer(object) : null; this.actions = {}; this.current = null;
    }
    get animated() { return !!this.mixer; }
    /* 播放动作：没有这个动作就按 FALLBACK 找替代；全都没有（静态模型）就什么也不做。返回实际播放的动作名 */
    play(name, fade) {
      if (!this.mixer) return null;
      const tried = [name].concat(FALLBACK[name] || [], ['idle']); let clip = null, real = null;
      for (const n of tried) { clip = T.AnimationClip.findByName(this.clips, n); if (clip) { real = n; break; } }
      if (!clip) return null; if (this.current === real) return real;
      const a = this.actions[real] || (this.actions[real] = this.mixer.clipAction(clip));
      Object.values(this.actions).forEach(x => { if (x !== a) x.fadeOut(fade === undefined ? 0.25 : fade); });
      a.reset().fadeIn(fade === undefined ? 0.25 : fade).play(); this.current = real; return real;
    }
    has(name) { return !!T.AnimationClip.findByName(this.clips, name); }
    setAccessories(map) { this.object.traverse(o => { if (o.name in map) o.visible = !!map[o.name]; }); }
    update(dt) { if (this.mixer) this.mixer.update(dt); }
  }

  Assets3.FALLBACK = FALLBACK;
  root.Assets3 = Assets3;
})(typeof window !== 'undefined' ? window : globalThis);
