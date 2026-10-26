/* =====================================================
   v9 建筑套件拼装器（共享，清河镇和编辑器用；2026-10-26）
   - 美术交一个 kit.glb：每个顶层节点是一个零件，全部共用 kit_main / kit_glow（/ kit_leaf）材质和一张图集，AO 在顶点色
   - 场景布局是一串条目：{ a: 组合名 } 或 { p: 零件名 }，加上 x / y / z（米）、r（绕 Y 轴的角度）、tint（wall / roof / cloth）
     组合（assemblies/*.json，比如一栋房子）在运行时展开成零件
   - 同一种零件不管用多少次只画一次（InstancedMesh）；染色只乘图集里的染色区（白灰墙、瓦、布），木头石头保持本色
   - 每个实例记得自己来自布局里的第几条，编辑器点选时用
   ===================================================== */
const Kit3 = (() => {
  const T = THREE, ASM = {}, Y = new T.Vector3(0, 1, 0);
  const asm = name => ASM[name] || (ASM[name] = fetch('art/v9_kit/assemblies/' + name + '.json').then(r => { if (!r.ok) throw new Error('找不到组合 ' + name); return r.json(); }).catch(e => { delete ASM[name]; throw e; }));
  const mat4 = (x, y, z, rDeg) => new T.Matrix4().compose(new T.Vector3(x, y || 0, z), new T.Quaternion().setFromAxisAngle(Y, (rDeg || 0) * Math.PI / 180), new T.Vector3(1, 1, 1));
  /* 布局条目 → 零件实例列表 [{ p, m, tint, id }]（id = 布局里的序号） */
  async function expand(items) {
    const names = [...new Set(items.filter(it => it.a).map(it => it.a))], got = {};
    await Promise.all(names.map(async n => { try { got[n] = await asm(n); } catch (e) { console.warn(e.message); } }));
    const out = [];
    items.forEach((it, id) => { const base = mat4(it.x, it.y, it.z, it.r);
      if (it.p) { out.push({ p: it.p, m: base, tint: it.tint || null, id }); return; }
      const A = got[it.a]; if (!A) return;
      A.parts.forEach(q => out.push({ p: q.p, m: base.clone().multiply(mat4(q.x, q.y, q.z, q.r)), tint: q.tint || null, id })); });
    return out;
  }
  class Kit {
    /* o.onMat(m)：每个新材质建好后调用（比如加积雪）；o.tint：{ wall, roof, cloth } 颜色 */
    constructor(lib, o) { this.lib = lib; this.o = o || {}; this.parts = null; this.mats = {}; this.glow = []; this.tint = { wall: new T.Color('#f2e6cc'), roof: new T.Color('#2f8a86'), cloth: new T.Color('#e8e4da') }; if (this.o.tint) this.setTint(this.o.tint); }
    setTint(t) { Object.keys(t || {}).forEach(k => { if (this.tint[k]) this.tint[k].set(t[k]); }); }
    mat(src) {
      if (this.mats[src.uuid]) return this.mats[src.uuid];
      const m = src.clone(); m.vertexColors = true;
      if (src.name === 'kit_glow') { m.emissive = new T.Color('#ffb860'); m.emissiveIntensity = 0; this.glow.push(m); }
      else if (src.name === 'kit_leaf') { m.alphaTest = 0.5; m.side = T.DoubleSide; }
      else {
        m.onBeforeCompile = sh => {
          sh.vertexShader = 'attribute vec3 kitTint;\nvarying vec3 vKitTint;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKitTint = kitTint;');
          sh.fragmentShader = 'varying vec3 vKitTint;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n{ vec2 pu = vUv * 2048.0; float tr = (pu.x < 1024.0 && (pu.y < 320.0 || (pu.y >= 1024.0 && pu.y < 1184.0) || (pu.y >= 1856.0 && pu.y < 1952.0))) ? 1.0 : 0.0; diffuseColor.rgb *= mix(vec3(1.0), vKitTint, tr); }'); };
        m.customProgramCacheKey = () => 'kit-tint';
      }
      if (this.o.onMat) this.o.onMat(m); this.mats[src.uuid] = m; return m;
    }
    async load(tier) {
      if (this.parts) return this.parts;
      const e = await this.lib.load('v9_kit', tier || '1k'), root = e.gltf.scene; root.updateMatrixWorld(true); const parts = {};
      root.children.forEach(top => { const inv = new T.Matrix4().copy(top.matrixWorld).invert(), pieces = [], box = new T.Box3();
        top.traverse(o => { if (!o.isMesh) return; const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(m)); pieces.push({ geo: o.geometry, mat: this.mat(o.material), m }); });
        parts[top.name] = { pieces, box }; });
      return this.parts = parts;
    }
    names() { return this.parts ? Object.keys(this.parts) : []; }
    /* 零件实例 → 一组 InstancedMesh。返回 { group, pick(hit) → 布局序号, boxes: [{ id, box(世界坐标) }], tris, dispose() } */
    build(list, o) {
      o = o || {}; const group = new T.Group(), by = {}, W = new T.Color(1, 1, 1), boxes = [], miss = new Set(); let tris = 0;
      list.forEach(it => { const P = this.parts[it.p]; if (!P) { miss.add(it.p); return; } (by[it.p] = by[it.p] || []).push(it); if (o.boxes !== false) boxes.push({ id: it.id, p: it.p, box: P.box.clone().applyMatrix4(it.m) }); });
      const ims = [];
      Object.entries(by).forEach(([name, arr]) => this.parts[name].pieces.forEach(pc => {
        /* 同一个零件网格被多个场景用时（编辑器的预览、正式场景）各自复制一份几何体的属性引用，避免实例属性互相覆盖 */
        const geo = new T.BufferGeometry(); Object.entries(pc.geo.attributes).forEach(([k, v]) => geo.setAttribute(k, v)); geo.setIndex(pc.geo.index); geo.boundingBox = pc.geo.boundingBox; geo.boundingSphere = pc.geo.boundingSphere;
        const im = new T.InstancedMesh(geo, o.material || pc.mat, arr.length), tint = new Float32Array(arr.length * 3), c = new T.Matrix4(), ids = [];
        arr.forEach((it, i) => { c.multiplyMatrices(it.m, pc.m); im.setMatrixAt(i, c); (it.tint ? this.tint[it.tint] || this.tint.wall : W).toArray(tint, i * 3); ids.push(it.id); });
        geo.setAttribute('kitTint', new T.InstancedBufferAttribute(tint, 3));
        im.frustumCulled = false; im.castShadow = o.shadow !== false; im.receiveShadow = true; im.userData.kitIds = ids; group.add(im); ims.push(im);
        tris += arr.length * (geo.index ? geo.index.count : geo.attributes.position.count) / 3; }));
      return { group, ims, boxes, tris: Math.round(tris), miss: [...miss],
        pick: hit => hit && hit.object && hit.object.userData.kitIds && hit.instanceId !== undefined ? hit.object.userData.kitIds[hit.instanceId] : -1,
        dispose: () => { ims.forEach(im => { const g = im.geometry; /* 只释放自己的实例属性：零件网格的顶点 / 索引是共用的，释放了会让别的场景（正式布局、编辑器预览）画不出来 */ Object.keys(g.attributes).forEach(k => { if (k !== 'kitTint') g.deleteAttribute(k); }); g.setIndex(null); g.dispose(); im.dispose(); }); group.removeFromParent(); } };
    }
  }
  return { Kit, asm, expand, mat4 };
})();
