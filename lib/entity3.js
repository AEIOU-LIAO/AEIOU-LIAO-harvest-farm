/* =====================================================
   丰收农场 · 实体模块（V0.2）
   美术的骨骼模型（lib/assets3.js 加载）+ 动作状态机 + 缺省回退 + 程序补动作。
   - rig.play('walk')：有 walk 就播 walk；没有就按 Assets3.FALLBACK 回退（walk → idle），rig.faked 为 true
   - 回退时由程序在骨骼上叠加摆动（腿、手臂、头、尾巴），美术交了对应动作后自动改用美术的动作
   - 叠加只改骨骼的局部旋转；每帧先恢复，再由动画覆盖，不会越转越歪
   依赖：THREE（r149）、Assets3（lib/assets3.js）
   用法：
     const rig = await Entity3.spawn(lib, 'v3_dog_fuwang', 'dog');  scene.add(rig.object);
     rig.play(moving ? 'walk' : 'idle');  rig.update(dt);
     if (rig.faked) rig.dogGait({ a: [..4], lift: [..4], yaw, pitch, wag });
     Entity3.release(lib, rig);
   ===================================================== */
(function (root) {
  'use strict';
  const T = root.THREE, qa = new T.Quaternion();

  class Rig {
    constructor(inst, kind) {
      this.inst = inst; this.object = inst.object; this.kind = kind; this.state = null; this.real = null;
      this.bones = {}; this.ax = {}; this.rest = {}; this.touched = new Set();
      this.object.updateMatrixWorld(true);
      const inv = this.object.getWorldQuaternion(new T.Quaternion()).invert();
      this.object.traverse(o => {
        if (!o.isBone) return; this.bones[o.name] = o; this.rest[o.name] = o.quaternion.clone();
        /* 模型的左右轴 X、竖轴 Y 在这根骨骼自己坐标里的方向（按初始姿势算一次） */
        const q = o.getWorldQuaternion(new T.Quaternion()).premultiply(inv).invert();
        this.ax[o.name] = { x: new T.Vector3(1, 0, 0).applyQuaternion(q), y: new T.Vector3(0, 1, 0).applyQuaternion(q) };
      });
    }
    /* 切换动作状态，返回实际播放的动作名（没有就是回退的） */
    play(state, fade) { if (state === this.state) return this.real; this.state = state; this.real = this.inst.play(state, fade); return this.real; }
    get faked() { return this.real !== this.state; }
    has(name) { return this.inst.has(name); }
    setAccessories(map) { this.inst.setAccessories(map); }
    update(dt) {
      this.touched.forEach(n => this.bones[n].quaternion.copy(this.rest[n])); this.touched.clear();   // 没有动画轨道的骨骼也能复位
      this.inst.update(dt);
    }
    /* 骨骼绕「模型的」X / Y 轴转 a 弧度（以骨骼自己为支点） */
    rot(name, axis, a) { if (!a) return; const b = this.bones[name]; if (!b) return; b.quaternion.multiply(qa.setFromAxisAngle(this.ax[name][axis], a)); this.touched.add(name); }

    /* 人物：程序走路 / 跳跃。phase 步伐相位，amp 摆幅（0 站着），air 在空中 */
    heroGait(o) {
      const A = o.amp || 0;
      if (o.air) { this.rot('LeftUpLeg', 'x', -0.55); this.rot('RightUpLeg', 'x', 0.3); this.rot('LeftLeg', 'x', 0.8); this.rot('RightLeg', 'x', 0.45); this.rot('LeftArm', 'x', -0.7); this.rot('RightArm', 'x', -0.6); return; }
      if (A < 0.01) return;
      const s = Math.sin(o.phase), c = Math.cos(o.phase);
      this.rot('LeftUpLeg', 'x', s * A); this.rot('RightUpLeg', 'x', -s * A);                                   // 正值：脚往后
      this.rot('LeftLeg', 'x', Math.max(0, -c) * A * 1.3); this.rot('RightLeg', 'x', Math.max(0, c) * A * 1.3);  // 往前迈的那条腿屈膝
      this.rot('LeftArm', 'x', -s * A * 0.75); this.rot('RightArm', 'x', s * A * 0.75);                        // 手臂和同侧腿反向
      this.rot('Spine', 'x', o.lean || 0);
    }
    /* 狗：程序步态。a[j] 每条腿的摆角（正值脚往前），lift[j] 抬腿 0~1；腿顺序：右前、左前、右后、左后 */
    dogGait(o) {
      const L = Rig.DOG_LEGS;
      if (o.a) L.forEach(([up, lo], j) => { this.rot(up, 'x', -o.a[j]); this.rot(lo, 'x', (o.lift ? o.lift[j] : 0) * 0.7); });
      if (o.yaw) this.rot('head', 'y', o.yaw);
      if (o.pitch) this.rot('head', 'x', -o.pitch);
      if (o.wag) { this.rot('tail_1', 'y', o.wag); this.rot('tail_2', 'y', o.wag * 0.5); }
    }
    /* 没有游戏逻辑驱动时（预览页、压力测试）：按速度 v（米/秒）自己推进步态 */
    autoGait(dt, v) {
      this.ph = (this.ph || 0) + dt * v * (this.kind === 'dog' ? 1.5 : 1.15);
      if (this.kind !== 'dog') return this.heroGait({ phase: this.ph * Math.PI * 2, amp: Math.min(0.7, 0.3 + v * 0.18), lean: 0.05 });
      const A = Math.min(0.55, 0.28 + v * 0.06), a = [], lift = [];
      [0, 0.5, 0.5, 0].forEach(o => { const u = (this.ph + o) % 1 * Math.PI * 2; a.push(Math.sin(u) * A); lift.push(Math.max(0, Math.cos(u))); });   // 小跑：对角的两条腿一起
      this.dogGait({ a, lift, wag: Math.sin(this.ph * 5) * 0.25 });
    }
  }
  Rig.DOG_LEGS = [['front_right_upper', 'front_right_lower'], ['front_left_upper', 'front_left_lower'], ['hind_right_upper', 'hind_right_lower'], ['hind_left_upper', 'hind_left_lower']];

  async function spawn(lib, id, kind, opts) { const inst = await lib.spawn(id, opts); return new Rig(inst, kind || lib.info(id).kind); }
  function release(lib, rig, purge) { if (rig && rig.object.parent) rig.object.parent.remove(rig.object); if (rig) lib.release(rig.inst, purge); }

  root.Entity3 = { Rig, spawn, release };
})(typeof window !== 'undefined' ? window : globalThis);
