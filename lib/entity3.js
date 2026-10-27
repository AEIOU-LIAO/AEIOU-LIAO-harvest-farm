/* =====================================================
   丰收农场 · 实体模块（V0.2）
   美术的骨骼模型（lib/assets3.js 加载）+ 动作状态机 + 缺省回退 + 程序补动作。
   - rig.play('walk')：有 walk 就播 walk；没有就按 Assets3.FALLBACK 回退（walk → idle），rig.faked 为 true
   - rig.pace(速度, 缩放)：按资源清单里的实测步幅（loco）调动作快慢（v4 起美术交了实测步幅）
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
  const T = root.THREE, qa = new T.Quaternion(), qb = new T.Quaternion();

  class Rig {
    constructor(inst, kind) {
      this.inst = inst; this.object = inst.object; this.kind = kind; this.state = null; this.real = null;
      this.bones = {}; this.ax = {}; this.rest = {}; this.base = {}; this.touched = new Set();
      this.object.updateMatrixWorld(true);
      const inv = this.object.getWorldQuaternion(new T.Quaternion()).invert();
      this.object.traverse(o => {
        if (!o.isBone) return; this.bones[o.name] = o; this.rest[o.name] = o.quaternion.clone();
        /* 模型的左右轴 X、竖轴 Y 在这根骨骼自己坐标里的方向（按初始姿势算一次） */
        const q = o.getWorldQuaternion(new T.Quaternion()).premultiply(inv).invert();
        this.ax[o.name] = { x: new T.Vector3(1, 0, 0).applyQuaternion(q), y: new T.Vector3(0, 1, 0).applyQuaternion(q), z: new T.Vector3(0, 0, 1).applyQuaternion(q) };
      });
    }
    /* 做一个表情（face_smile / face_brow_raise / face_frown）：模型有这个表情就播，没有（其他人物、动物）就什么也不做 */
    face(name) { this.blinkT = this.blinkT === null ? null : 2.5 + Math.random() * 2; return this.inst.playFace ? this.inst.playFace(name) : false; }
    faceBusy() { return Object.values(this.inst.faceActs || {}).some(a => a.isRunning()); }
    /* 切换动作状态，返回实际播放的动作名（没有就是回退的） */
    play(state, fade) { if (state === this.state) return this.real; this.state = state; this.real = this.inst.play(state, fade === undefined ? 0.2 : fade); return this.real; }
    /* 需要程序补动作：要的动作没有，回退到的又不是移动动作（比如没有 walk 时用 idle 顶着） */
    get faked() { return this.real !== this.state && !this.loco[this.real]; }
    get loco() { return (this.inst.asset && this.inst.asset.loco) || {}; }
    /* 美术动作已经自带扭腰、摆臂、起伏（v6 起，资源清单 natural: true），不再叠加放松跑姿 */
    get natural() { return !!(this.inst.asset && this.inst.asset.natural); }
    /* 按真实移动速度（米/秒，已经是游戏里的尺寸）调整移动动作的快慢：动画相位 = 移动距离 / (实测步幅 × 缩放)，脚不打滑 */
    pace(speed, scale) { const L = this.loco[this.real], a = this.inst.actions[this.real]; if (!a) return; if (!L) { a.timeScale = 1; return; }
      const k = this.kind === 'hero' && Rig.LIVEN.on && !this.natural ? (Rig.LIVEN[this.real] || {}).stride || 1 : 1;   // 放松跑姿把腿摆大了，步幅跟着变大，动画不用放那么快
      a.timeScale = Math.max(0.25, Math.min(3.5, speed / (L.stride * k * (scale || 1) / L.dur))); }
    /* 骨骼现在相对初始姿势绕模型 axis 轴转了多少（弧度，带正负） */
    ang(name, axis) { const b = this.bones[name]; if (!b) return 0; const q = qb.copy(this.rest[name]).invert().multiply(b.quaternion), a = this.ax[name][axis]; return 2 * Math.atan2(q.x * a.x + q.y * a.y + q.z * a.z, q.w); }
    /* 放松跑姿（v3.16）：美术的走 / 跑动画躯干是僵的（腰、胸、头 0° 转动），程序按腿的实际摆动叠加：
       骨盆随腿扭、胸口反向扭、身体前倾、头保持平视、手臂摆大并弯肘、腿摆大一点、身体上下起伏。返回起伏高度（米，模型原尺寸） */
    liven() {
      const P = Rig.LIVEN[this.real]; if (!P || !Rig.LIVEN.on || this.kind !== 'hero' || this.natural || this.faked) { this.lv = 0; return 0; }
      this.lv = Math.min(1, (this.lv || 0) + 0.08);                       // 切换到这个动作时慢慢加上，不跳
      const w = this.lv, sw = this.ang('LeftUpLeg', 'x') - this.ang('RightUpLeg', 'x');   // 两腿前后差：正 = 左脚在后
      this.swMax = Math.max(0.15, (this.swMax || 0.6) * 0.995, Math.abs(sw)); const n = sw / this.swMax;   // -1 ~ 1
      /* 只放大「围绕平均位置的来回摆动」，不放大动作本身的固定姿势（比如女主角拎包时手臂一直抬着） */
      if (this.lvClip !== this.real) { this.lvClip = this.real; this.mean = {}; this.amp = {}; }
      const M = this.mean || (this.mean = {}), AM = this.amp || (this.amp = {}), cl = (v, m) => Math.max(-m, Math.min(m, v));
      const osc = (b, ax) => { const a = this.ang(b, ax), k = b + ax; M[k] = M[k] === undefined ? a : M[k] + (a - M[k]) * 0.03; const d = a - M[k]; AM[k] = (AM[k] || 0) + (Math.abs(d) - (AM[k] || 0)) * 0.03; return d; };
      /* 手臂在原动作里本来就几乎不摆（拎包、提东西），就不放大它，也不给它弯肘 */
      const swings = (b) => Math.max(0, Math.min(1, ((AM[b + 'x'] || 0) - 0.07) / 0.08));
      const kL = Math.max(0, osc('LeftLeg', 'x')), kR = Math.max(0, osc('RightLeg', 'x'));
      this.rot('LeftUpLeg', 'x', cl(osc('LeftUpLeg', 'x') * P.leg, 0.4) * w); this.rot('RightUpLeg', 'x', cl(osc('RightUpLeg', 'x') * P.leg, 0.4) * w);
      this.rot('LeftLeg', 'x', cl(kL * P.knee, 0.4) * w); this.rot('RightLeg', 'x', cl(kR * P.knee, 0.4) * w);
      this.rot('Hips', 'y', -n * P.twist * w); this.rot('Hips', 'z', n * P.roll * w);
      this.rot('Spine', 'x', P.lean * w); this.rot('Spine', 'y', n * P.twist * 0.9 * w); this.rot('Spine1', 'y', n * P.twist * 0.8 * w); this.rot('Spine1', 'x', P.lean * 0.4 * w);
      this.rot('Neck', 'y', -n * P.twist * 0.6 * w); this.rot('Head', 'x', -P.lean * 1.1 * w); this.rot('Head', 'y', -n * P.twist * 0.3 * w);
      const gL = swings('LeftArm'), gR = swings('RightArm');
      this.rot('LeftArm', 'x', cl(osc('LeftArm', 'x') * P.arm, 0.6) * w * gL); this.rot('RightArm', 'x', cl(osc('RightArm', 'x') * P.arm, 0.6) * w * gR);
      this.rot('LeftArm', 'z', P.armIn * w * gL); this.rot('RightArm', 'z', -P.armIn * w * gR);
      /* 弯肘：补到目标弯度为止；动作里已经弯够了（比如抱东西）就不再加，免得手甩到头顶 */
      const es = Rig.LIVEN.elbowSign, elbow = (b, t, g) => this.rot(b, 'x', cl(Math.max(0, t - this.ang(b, 'x') * es), 1.2) * w * g * es);
      elbow('LeftForeArm', P.elbow + Math.max(0, -n) * P.elbowSw, gL); elbow('RightForeArm', P.elbow + Math.max(0, n) * P.elbowSw, gR);
      this.rot('LeftShoulder', 'x', n * P.shoulder * w); this.rot('RightShoulder', 'x', -n * P.shoulder * w);
      return (Math.abs(n) - 0.5) * P.bounce * w;                        // 两腿分得最开时腾空最高
    }
    has(name) { return this.inst.has(name); }
    setAccessories(map) { this.inst.setAccessories(map); }
    update(dt) {
      /* 复位到叠加之前的姿势（没有动画轨道的骨骼就是初始姿势）。不能一律复位到初始姿势：动画混合器发现数值和上一帧一样时不会重写骨骼 */
      this.touched.forEach(n => this.bones[n].quaternion.copy(this.base[n])); this.touched.clear();
      /* 自动眨眼（2026-10-27 美术 v10 女主一号有 face_blink）：没有在做别的表情时，每 2.5~5.5 秒眨一次眼 */
      if (this.blinkT === undefined) this.blinkT = this.inst.has && this.inst.has('face_blink') ? 1.5 + Math.random() * 3 : null;
      if (this.blinkT !== null) { this.blinkT -= dt; if (this.blinkT <= 0) { this.blinkT = 2.5 + Math.random() * 3; if (!this.faceBusy()) this.inst.playFace('face_blink'); } }
      this.inst.update(dt);
    }
    /* 骨骼绕「模型的」X / Y 轴转 a 弧度（以骨骼自己为支点） */
    rot(name, axis, a) { if (!a) return; const b = this.bones[name]; if (!b) return; if (!this.touched.has(name)) { (this.base[name] || (this.base[name] = new T.Quaternion())).copy(b.quaternion); this.touched.add(name); } b.quaternion.multiply(qa.setFromAxisAngle(this.ax[name][axis], a)); }

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
  /* 放松跑姿参数：leg / knee / arm 是在美术动作基础上再放大的比例，其余是弧度；stride 是腿摆大以后步幅放大的比例 */
  Rig.LIVEN = { on: true, elbowSign: -1,
    run: { leg: 0.6, knee: 0.4, arm: 1.6, armIn: 0.1, elbow: 1.35, elbowSw: 0.45, twist: 0.22, roll: 0.06, lean: 0.24, shoulder: 0.08, bounce: 0.08, stride: 1.6 },
    walk: { leg: 0.1, knee: 0.1, arm: 0.5, armIn: 0.06, elbow: 0.3, elbowSw: 0.15, twist: 0.1, roll: 0.03, lean: 0.04, shoulder: 0.04, bounce: 0.02, stride: 1.08 } };
  Rig.DOG_LEGS =[['front_right_upper', 'front_right_lower'], ['front_left_upper', 'front_left_lower'], ['hind_right_upper', 'hind_right_lower'], ['hind_left_upper', 'hind_left_lower']];

  async function spawn(lib, id, kind, opts) { const inst = await lib.spawn(id, opts); return new Rig(inst, kind || lib.info(id).kind); }
  function release(lib, rig, purge) { if (rig && rig.object.parent) rig.object.parent.remove(rig.object); if (rig) lib.release(rig.inst, purge); }

  root.Entity3 = { Rig, spawn, release };
})(typeof window !== 'undefined' ? window : globalThis);
