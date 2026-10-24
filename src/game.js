'use strict';
/* =====================================================
   丰收农场 · 游戏逻辑
   ===================================================== */
const $ = id => document.getElementById(id);
const SAVE_KEY = 'harvest_farm_save_v1';
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.floor(n));
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); if (s < 60) return s + '秒'; const m = Math.floor(s / 60), r = s % 60; if (m < 60) return m + '分' + (r ? r + '秒' : ''); const h = Math.floor(m / 60); return h + '小时' + (m % 60 ? (m % 60) + '分' : ''); }
function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + (d.getDate()); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const OWN_THEME = { roof: '#c8483a', wall: '#f6e7c8', tree: '#4aa83a', bush: '#4ea43a' };
const FRIENDS = [
  { id: 'xm', name: '小美', lv: 6, dog: 0, av: { skin: '#ffe0c0', hair: '#6a3a1a', fringe: 1, pig: 1, shirt: '#ff7aa5', bg1: '#ffd9ec', bg2: '#fff0e0' }, theme: { roof: '#d9658a', wall: '#fff0e0', tree: '#5ab84e', bush: '#52b04a' } },
  { id: 'an', name: '阿牛', lv: 9, dog: 0.35, av: { skin: '#f2c89a', hat: 1, band: '#3a7ad9', shirt: '#6aa84a', bg1: '#c8ecff', bg2: '#e8f6c8' }, theme: { roof: '#3e7ac8', wall: '#f0ead0', tree: '#3f9a3a', bush: '#3f9a3a' } },
  { id: 'dx', name: '大熊', lv: 12, dog: 0, av: { skin: '#e8b88a', hair: '#2a1a10', fringe: 1, shirt: '#8a5a3a', bg1: '#ffe8b8', bg2: '#ffd09a' }, theme: { roof: '#7a5a3a', wall: '#f2dfc0', tree: '#6aa83a', bush: '#6aa83a' } },
  { id: 'tt', name: '糖糖', lv: 15, dog: 0.2, av: { skin: '#ffe4cc', hair: '#e8a0c0', fringe: 1, pig: 1, shirt: '#b08aff', bg1: '#e8d8ff', bg2: '#ffe0f0' }, theme: { roof: '#9a6ad9', wall: '#fff4f8', tree: '#58b890', bush: '#4aa87a' } },
];

/* 土地解锁顺序：从中心向外 */
const UNLOCK_ORDER = (() => { const a = []; for (let i = 0; i < COLS * ROWS; i++) { const c = i % COLS, r = Math.floor(i / COLS); a.push({ i, d: Math.hypot(c - 2.5, (r - 1.5) * 1.15), c }); } a.sort((p, q) => p.d - q.d || p.c - q.c); return a.map(o => o.i); })();
const DEPTH_ORDER = (() => { const a = []; for (let i = 0; i < COLS * ROWS; i++) a.push(i); a.sort((p, q) => { const dp = (p % COLS) + Math.floor(p / COLS), dq = (q % COLS) + Math.floor(q / COLS); return dp - dq || (p % COLS) - (q % COLS); }); return a; })();

const TASKS = [
  { id: 'plant', ic: '🌱', tx: '种植作物', need: 12, gold: 150, exp: 30 },
  { id: 'harvest', ic: '🧺', tx: '收获作物', need: 15, gold: 250, exp: 50 },
  { id: 'care', ic: '💧', tx: '浇水 / 除草 / 除虫', need: 10, gold: 150, exp: 30 },
  { id: 'steal', ic: '🥷', tx: '摘取好友的果实', need: 6, gold: 220, exp: 40 },
  { id: 'help', ic: '🤝', tx: '帮好友打理农田', need: 4, gold: 180, exp: 35 },
  { id: 'sell', ic: '💰', tx: '卖出作物赚取金币', need: 800, gold: 300, exp: 60 },
];
const STAGE_NAME = ['种子期', '发芽期', '成长期', '即将成熟', '已成熟'];
const expNeed = lv => Math.round(50 * lv * (1 + lv * 0.35));
const MAX_LV = 30;

/* ============ 状态 ============ */
let S, view = { friend: null, plots: null, key: 'home' }, hoverIdx = -1, painting = false, lastPaint = -1, mouse = { x: 0, y: 0, in: false };
function newPlot() { return { u: false, soil: 0, c: -1, p: 0, sea: 0, y: 0, pr: { d: 0, w: 0, b: 0 }, wet: 0 }; }
function newState() {
  const plots = []; for (let i = 0; i < COLS * ROWS; i++) plots.push(newPlot());
  UNLOCK_ORDER.slice(0, 6).forEach(i => plots[i].u = true);
  return { v: 1, name: '小农夫', gold: 300, exp: 0, lv: 1, plots, wh: {}, items: { fert: 3, dogfood: 0 }, dog: { own: false, until: 0 }, seed: 0, tool: 'auto', tasks: { date: today(), prog: {}, claimed: {} }, checkin: { last: '', streak: 0 }, stolen: {}, helped: {}, log: [], t: Date.now(), sound: true, music: true, tod: 'auto', fresh: true, soldTotal: 0 };
}
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return newState();
    const d = JSON.parse(raw), base = newState(); const s = Object.assign(base, d);
    s.items = Object.assign(base.items, d.items || {}); s.dog = Object.assign(base.dog, d.dog || {}); s.tasks = Object.assign(base.tasks, d.tasks || {});
    s.plots = base.plots.map((bp, i) => Object.assign(bp, (d.plots || [])[i] || {}, { pr: Object.assign({ d: 0, w: 0, b: 0 }, ((d.plots || [])[i] || {}).pr || {}) }));
    s.fresh = false; return s;
  } catch (e) { return newState(); }
}
let noSave = false;
function saveState() { if (noSave) return; try { S.t = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }

/* ============ 音效 ============ */
let AC = null, master = null, musicTimer = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type, vol, delay, slide) {
  if (!S.sound) return; const a = ac(); if (!a) return;
  const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
}
function noise(d, vol, f0, f1) {
  if (!S.sound) return; const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(); s.buffer = buf; const fl = a.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(f0, a.currentTime); fl.frequency.exponentialRampToValueAtTime(f1, a.currentTime + d);
  const g = a.createGain(); g.gain.value = vol; s.connect(fl); fl.connect(g); g.connect(master); s.start();
}
const SFX = {
  click: () => tone(660, 0.06, 'triangle', 0.07),
  plant: () => { tone(180, 0.12, 'sine', 0.14, 0, 90); tone(360, 0.1, 'triangle', 0.06, 0.04); },
  harvest: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.055)); },
  coin: () => { tone(1318, 0.09, 'square', 0.04); tone(1760, 0.16, 'square', 0.04, 0.07); },
  water: () => { noise(0.45, 0.22, 2400, 700); tone(520, 0.2, 'sine', 0.03, 0.05, 300); },
  weed: () => { noise(0.18, 0.28, 900, 300); },
  bug: () => { tone(900, 0.08, 'square', 0.05, 0, 200); noise(0.1, 0.2, 1500, 500); },
  fert: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'sine', 0.08, i * 0.07)); noise(0.3, 0.1, 4000, 1500); },
  err: () => { tone(200, 0.18, 'sawtooth', 0.06, 0, 140); },
  level: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.1)); },
  steal: () => { tone(300, 0.1, 'triangle', 0.07, 0, 600); tone(500, 0.12, 'triangle', 0.06, 0.08); },
  bark: () => { tone(420, 0.1, 'sawtooth', 0.09, 0, 220); tone(380, 0.12, 'sawtooth', 0.09, 0.16, 200); },
  rain: () => { noise(1.4, 0.12, 5000, 2500); },
  open: () => { tone(520, 0.08, 'triangle', 0.06); tone(780, 0.1, 'triangle', 0.06, 0.05); },
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { } }
function startMusic() {
  if (musicTimer || !S.music) return; const notes = [262, 294, 330, 392, 440, 523, 587, 659]; let i = 0, last = 3;
  musicTimer = setInterval(() => {
    if (!S.music || !S.sound || document.hidden) return; const a = ac(); if (!a) return;
    last = clamp(last + pick([-2, -1, -1, 0, 1, 1, 2]), 0, notes.length - 1); const f = notes[last], t0 = a.currentTime;
    const o = a.createOscillator(), g = a.createGain(), fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1800;
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.028, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    o.connect(fl); fl.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 1.7);
    if (i % 4 === 0) { const o2 = a.createOscillator(), g2 = a.createGain(); o2.type = 'triangle'; o2.frequency.value = f / 2; g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(0.022, t0 + 0.08); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4); o2.connect(g2); g2.connect(master); o2.start(t0); o2.stop(t0 + 2.5); }
    i++;
  }, 820);
}

/* ============ 特效（世界坐标） ============ */
const parts = [], floats = [];
function fxText(x, y, txt, col, size) { floats.push({ x, y, txt, col: col || '#fff', size: size || 22, t: 0, life: 1.5 }); }
function fxCoins(x, y, n) { for (let i = 0; i < n; i++) parts.push({ k: 'coin', x, y: y - 10, vx: (Math.random() - 0.5) * 220, vy: -200 - Math.random() * 200, g: 700, r: Math.random() * 6, t: 0, life: 0.9 + Math.random() * 0.3 }); }
function fxStars(x, y, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; parts.push({ k: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 120, r: Math.random() * 3, t: 0, life: 0.7 + Math.random() * 0.4, col: col || '#fff7a8' }); } }
function fxDrops(x, y) { for (let i = 0; i < 16; i++) parts.push({ k: 'drop', x: x + (Math.random() - 0.5) * 50, y: y - 80 - Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: 100 + Math.random() * 160, g: 600, t: 0, life: 0.55 + Math.random() * 0.2 }); }
function fxLeaves(x, y, col) { for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; parts.push({ k: 'leaf', x: x + (Math.random() - 0.5) * 40, y: y - 10, vx: Math.cos(a) * v, vy: -Math.abs(Math.sin(a)) * v - 40, g: 500, r: Math.random() * 6, t: 0, life: 0.8, col: col || '#5cb83c' }); } }
function fxPuff(x, y) { for (let i = 0; i < 10; i++) { const a = Math.random() * TAU; parts.push({ k: 'puff', x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 25 - 20, g: 0, t: 0, life: 0.5 }); } }
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) parts.splice(i, 1); }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; if (f.t > f.life) floats.splice(i, 1); }
}
function drawFx(c) {
  parts.forEach(p => {
    const a = clamp(1 - p.t / p.life, 0, 1); c.save(); c.globalAlpha = Math.min(1, a * 1.6); c.translate(p.x, p.y);
    if (p.k === 'coin') { c.rotate(p.r + p.t * 8); const w = Math.abs(Math.cos(p.t * 10)) * 7 + 1.5; ell(c, 0, 0, w, 8, '#ffd23a', '#b8860b', 1.6); ell(c, -w * 0.2, -2, w * 0.3, 3, 'rgba(255,255,255,.7)'); }
    else if (p.k === 'star') { star4(c, 0, 0, 5 + p.r, p.t * 6); }
    else if (p.k === 'drop') { c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(5, 1, 0, 5); c.quadraticCurveTo(-5, 1, 0, -6); c.fillStyle = '#5cc8f8'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#2a8ac8'; c.stroke(); }
    else if (p.k === 'leaf') { c.rotate(p.t * 9 + p.r); leaf(c, 0, 0, 12, 4, 0, p.col, '#2d6a1f'); }
    else if (p.k === 'puff') { ell(c, 0, 0, 6 + p.t * 20, 5 + p.t * 16, 'rgba(255,255,255,.7)'); }
    c.restore();
  });
  floats.forEach(f => {
    const k = f.t / f.life, y = f.y - 20 - k * 60, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, sc = k < 0.12 ? 0.5 + k / 0.12 * 0.6 : 1.1 - Math.min(0.1, (k - 0.12) * 0.4);
    c.save(); c.globalAlpha = a; c.translate(f.x, y); c.scale(sc, sc); c.font = `900 ${f.size}px "Microsoft YaHei","PingFang SC",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = 6; c.strokeStyle = 'rgba(50,30,10,.85)'; c.strokeText(f.txt, 0, 0); c.fillStyle = f.col; c.fillText(f.txt, 0, 0); c.restore();
  });
}

/* ============ 提示与日志 ============ */
function toast(msg, kind) {
  const d = document.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : ''); d.textContent = msg; $('toasts').appendChild(d);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => d.remove(), 2600);
}
function addLog(msg) { S.log.push({ t: Date.now(), m: msg }); if (S.log.length > 40) S.log.shift(); renderLog(); }
function renderLog() { const el = $('log'); const l = S.log.slice(-5); el.innerHTML = l.map(x => `<div>${x.m}</div>`).join(''); el.classList.toggle('empty', !l.length); }

/* ============ 经济 / 成长 ============ */
function setGold(v) { S.gold = Math.max(0, Math.floor(v)); $('goldnum').textContent = fmt(S.gold); $('gold').classList.remove('bump'); void $('gold').offsetWidth; $('gold').classList.add('bump'); }
function addGold(n) { setGold(S.gold + n); }
function addExp(n) {
  if (S.lv >= MAX_LV) return; S.exp += n; let up = 0;
  while (S.lv < MAX_LV && S.exp >= expNeed(S.lv)) { S.exp -= expNeed(S.lv); S.lv++; up++; }
  renderHud(); if (up) levelUp();
}
function levelUp() {
  sfx('level'); const reward = S.lv * 120; addGold(reward); S.items.fert += 1;
  const unlocked = CROPS.filter(c => c.lv === S.lv);
  openModal(`<div class="lvup"><div class="burst">🎉</div><h2>恭喜升级！</h2><div class="biglv">Lv.${S.lv}</div>
    <p>获得 <b>🪙 ${reward}</b> 金币 和 <b>🧪 化肥 ×1</b></p>
    ${unlocked.length ? `<div class="unl">解锁新作物：${unlocked.map(c => `<span class="chip"><img src="${cropIcon(c.id)}">${c.name}</span>`).join('')}</div>` : ''}
    <button class="btn big" onclick="closeModal()">太棒了</button></div>`, { small: true });
  renderToolbar();
}
function task(id, n) { const t = S.tasks; if (t.date !== today()) resetTasks(); t.prog[id] = (t.prog[id] || 0) + (n || 1); renderToolbar(); }
function resetTasks() { S.tasks = { date: today(), prog: {}, claimed: {} }; }
const dayBonus = (() => { let cache = {}; return function () { const k = today(); if (cache.k !== k) { const r = mulberry32(hashStr(k)), list = CROPS.map(c => c.id), a = list.splice(Math.floor(r() * list.length), 1)[0], b = list.splice(Math.floor(r() * list.length), 1)[0]; cache = { k, m: { [a]: 0.3 + Math.floor(r() * 3) * 0.1, [b]: 0.2 + Math.floor(r() * 3) * 0.1 } }; } return cache.m; }; })();
const unitPrice = id => Math.round(CROPS[id].price * (1 + (dayBonus()[id] || 0)));
const dogActive = () => S.dog.own && S.dog.until > Date.now();
const cropYield = (P, id) => Math.round(CROPS[id].yield * (P.soil ? 1.2 : 1));
const stageOf = p => p >= 1 ? 4 : p < 0.1 ? 0 : p < 0.35 ? 1 : p < 0.65 ? 2 : 3;
function plotSpeed(P) { const n = (P.pr.d ? 1 : 0) + (P.pr.w ? 1 : 0) + (P.pr.b ? 1 : 0); return (P.soil ? 1.2 : 1) * Math.pow(0.62, n); }
function plotDur(P) { return CROPS[P.c].time * 1000 * (P.sea > 0 ? 0.9 : 1); }
function remainSec(P) { return (1 - P.p) * plotDur(P) / 1000 / plotSpeed(P); }
function plotPos(i) { return cellPos(i % COLS, Math.floor(i / COLS)); }

/* ============ 时间推进 ============ */
let rainUntil = 0, nextRain = Date.now() + 5 * 60000, nextThief = Date.now() + 120000, rainK = 0, dogBarkUntil = 0, lastTick = Date.now();
function tickOwn(dt, online) {
  const now = Date.now();
  if (S.tasks.date !== today()) { resetTasks(); renderToolbar(); }
  S.plots.forEach((P, i) => {
    P.wet = Math.max(0, P.wet - dt / 90000);
    if (!P.u || P.c < 0) return;
    const raining = now < rainUntil;
    if (P.p < 1) {
      P.p = Math.min(1, P.p + dt / plotDur(P) * (online ? plotSpeed(P) : (P.soil ? 1.2 : 1)));
      if (P.p >= 1) { const pos = plotPos(i); if (online && view.key === 'home') { fxStars(pos.x, pos.y - 40, 10); } }
    }
    if (raining) { P.pr.d = 0; P.wet = 1; }
    if (online && dt <= 3500 && P.p > 0.1 && P.p < 0.93) {
      const n = (P.pr.d ? 1 : 0) + (P.pr.w ? 1 : 0) + (P.pr.b ? 1 : 0);
      if (n < 2 && Math.random() < (dt / 1000) * 1.6 / Math.max(CROPS[P.c].time, 60)) {
        const opts = ['d', 'w', 'b'].filter(k => !P.pr[k] && !(k === 'd' && raining)); if (opts.length) { P.pr[pick(opts)] = 1; }
      }
    }
  });
  if (online && dt <= 3500) {
    if (now > nextRain && now > rainUntil && Math.random() < 0.02) { rainUntil = now + 28000; nextRain = now + (8 + Math.random() * 8) * 60000; toast('🌧️ 下雨啦！农田被滋润了～'); sfx('rain'); }
    if (now > nextThief) { nextThief = now + rint(75, 160) * 1000; thiefEvent(); }
  }
}
function thiefEvent() {
  const ripe = S.plots.filter(P => P.u && P.c >= 0 && P.p >= 1 && P.y > 1); if (!ripe.length) return;
  const f = pick(FRIENDS), P = pick(ripe), cr = CROPS[P.c], idx = S.plots.indexOf(P), pos = plotPos(idx);
  if (dogActive() && Math.random() < 0.85) { dogBarkUntil = Date.now() + 2500; sfx('bark'); addLog(`🐶 小狗汪汪叫，把 <b>${f.name}</b> 赶跑了！`); return; }
  const n = Math.min(P.y - 1, rint(2, 5)); P.y -= n; addLog(`🦊 <b>${f.name}</b> 偷走了你的 ${n} 个${cr.name}`); toast(`${f.name} 偷走了 ${n} 个${cr.name}！`, 'warn'); sfx('steal');
  if (view.key === 'home') fxText(pos.x, pos.y - 40, `-${n} ${cr.name}`, '#ff8a8a', 20);
  renderFriends();
}

/* ============ 玩家动作（自己的农场） ============ */
function actPlant(i, quiet) {
  const P = S.plots[i], cr = CROPS[S.seed], pos = plotPos(i);
  if (S.lv < cr.lv) { if (!quiet) toast(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'warn'); sfx('err'); return false; }
  if (S.gold < cr.seed) { if (!quiet) toast('金币不够买种子啦', 'warn'); sfx('err'); return false; }
  setGold(S.gold - cr.seed); P.c = S.seed; P.p = 0; P.sea = 0; P.y = cropYield(P, S.seed); P.pr = { d: 0, w: 0, b: 0 }; P.wet = 0.5;
  fxPuff(pos.x, pos.y); fxStars(pos.x, pos.y - 6, 5, '#b8e890'); fxText(pos.x, pos.y - 24, `-${cr.seed}`, '#ffd23a', 18); sfx('plant'); addExp(2); task('plant'); return true;
}
function actHarvest(i) {
  const P = S.plots[i], cr = CROPS[P.c], pos = plotPos(i), n = P.y;
  S.wh[P.c] = (S.wh[P.c] || 0) + n; sfx('harvest');
  fxCoins(pos.x, pos.y - 30, 7); fxStars(pos.x, pos.y - 40, 8); fxText(pos.x, pos.y - 50, `${cr.name} ×${n}`, '#fff6c0', 24); fxText(pos.x + 4, pos.y - 20, `+${cr.exp} 经验`, '#8fe8ff', 18);
  addExp(cr.exp); task('harvest');
  if (cr.seasons > 1 && P.sea < cr.seasons - 1) { P.sea++; P.p = 0.45; P.y = cropYield(P, P.c); P.pr = { d: 0, w: 0, b: 0 }; setTimeout(() => fxText(pos.x, pos.y - 70, '进入第二季', '#b8f08a', 17), 400); }
  else { P.c = -1; P.p = 0; P.y = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; }
  renderFriends(); return true;
}
function actCare(i) {
  const P = S.plots[i], pos = plotPos(i); const k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) return false;
  P.pr[k] = 0;
  if (k === 'd') { P.wet = 1; fxDrops(pos.x, pos.y); sfx('water'); fxText(pos.x, pos.y - 50, '浇水 +2经验', '#8fe8ff', 17); }
  else if (k === 'w') { fxLeaves(pos.x, pos.y); sfx('weed'); fxText(pos.x, pos.y - 50, '除草 +2经验', '#b8f08a', 17); }
  else { fxPuff(pos.x, pos.y - 30); fxStars(pos.x, pos.y - 30, 6, '#ff9a9a'); sfx('bug'); fxText(pos.x, pos.y - 50, '除虫 +2经验', '#ffb0b0', 17); }
  addExp(2); task('care'); return true;
}
function actShovel(i) {
  const P = S.plots[i], pos = plotPos(i); if (P.c < 0) return false;
  if (P.p >= 1) { toast('作物已成熟，先收获吧～', 'warn'); sfx('err'); return false; }
  P.c = -1; P.p = 0; P.y = 0; P.sea = 0; P.pr = { d: 0, w: 0, b: 0 }; fxPuff(pos.x, pos.y); fxLeaves(pos.x, pos.y, '#8a6a3a'); sfx('weed'); return true;
}
function actFert(i) {
  const P = S.plots[i], pos = plotPos(i); if (P.c < 0 || P.p >= 1) return false;
  if (S.items.fert <= 0) { toast('化肥用完了，去商店买点吧', 'warn'); sfx('err'); return false; }
  S.items.fert--; P.p = Math.min(1, P.p + 0.3); fxStars(pos.x, pos.y - 30, 12, '#c8ff8a'); fxText(pos.x, pos.y - 56, '成长加速！', '#c8ff8a', 19); sfx('fert'); renderToolbar(); return true;
}
function plotCost() { const n = S.plots.filter(p => p.u).length - 6; return Math.round(500 * Math.pow(1.28, n)); }
function plotNeedLv() { const n = S.plots.filter(p => p.u).length - 6; return 2 + Math.floor(n * 0.8); }
function actExpand(i) {
  const cost = plotCost(), need = plotNeedLv(), P = S.plots[i], pos = plotPos(i);
  if (S.lv < need) { toast(`扩建这块地需要 Lv.${need}`, 'warn'); sfx('err'); return false; }
  if (S.gold < cost) { toast(`金币不足，扩建需要 ${cost} 金币`, 'warn'); sfx('err'); return false; }
  setGold(S.gold - cost); P.u = true; fxPuff(pos.x, pos.y); fxStars(pos.x, pos.y - 10, 14); fxText(pos.x, pos.y - 40, '开垦成功！', '#ffe27a', 22); sfx('level'); addExp(10); return true;
}
function redCost() { return 1500 + 600 * S.plots.filter(p => p.soil).length; }
function actRed(i) {
  const P = S.plots[i], pos = plotPos(i); if (!P.u) return false; if (P.soil) { toast('这块已经是红土地了', 'warn'); return false; }
  if (S.lv < 5) { toast('红土地需要 Lv.5', 'warn'); return false; } const c = redCost(); if (S.gold < c) { toast(`金币不足，需要 ${c}`, 'warn'); sfx('err'); return false; }
  setGold(S.gold - c); P.soil = 1; fxStars(pos.x, pos.y, 14, '#ff9a6a'); fxText(pos.x, pos.y - 40, '升级红土地！', '#ffb08a', 21); sfx('level'); addExp(15); toast('红土地：生长更快，产量 +20%'); return true;
}
function sellCrop(id, n) {
  const have = S.wh[id] || 0; n = Math.min(n, have); if (n <= 0) return 0; const g = n * unitPrice(id);
  S.wh[id] = have - n; if (!S.wh[id]) delete S.wh[id]; addGold(g); S.soldTotal += g; task('sell', g); sfx('coin'); return g;
}
function feedDog() {
  if (!S.dog.own) { toast('你还没有小狗，先去商店领养吧', 'warn'); return; } if (S.items.dogfood <= 0) { toast('没有狗粮了', 'warn'); sfx('err'); return; }
  S.items.dogfood--; S.dog.until = Math.max(S.dog.until, Date.now()) + 20 * 60000; toast('🐶 小狗吃饱啦，接下来20分钟会帮你看家'); sfx('bark'); renderToolbar();
}

/* ============ 好友农场 ============ */
function genFriend(f) {
  const bucket = Math.floor(Date.now() / 600000), start = bucket * 600000, elapsed = Date.now() - start, rnd = mulberry32(hashStr(f.id) ^ Math.imul(bucket, 2654435761));
  const nUnlock = Math.min(24, 8 + f.lv), avail = CROPS.filter(c => c.lv <= f.lv), plots = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const P = newPlot(); P.u = UNLOCK_ORDER.indexOf(i) < nUnlock; P.soil = rnd() < (f.lv > 8 ? 0.3 : 0) ? 1 : 0; P.key = `${f.id}:${bucket}:${i}`;
    if (P.u && rnd() < 0.88) {
      const cr = avail[Math.floor(rnd() * avail.length)]; P.c = cr.id; const base = rnd() < 0.45 ? 1 : rnd() * 1.05; P.p = Math.min(1, base * 0.9 + elapsed / (cr.time * 1000)); if (base >= 1) P.p = 1; P.y = cropYield(P, cr.id);
      if (P.p < 1 && P.p > 0.1 && rnd() < 0.4 && !S.helped[P.key]) P.pr[pick(['d', 'w', 'b'])] = 1;
      if (S.stolen[P.key]) { P.stolen = true; P.y = Math.max(1, Math.round(P.y * 0.8)); }
    }
    plots.push(P);
  }
  return plots;
}
function pruneKeys() { const b = Math.floor(Date.now() / 600000); [S.stolen, S.helped].forEach(o => Object.keys(o).forEach(k => { if (+k.split(':')[1] < b - 2) delete o[k]; })); }
function friendStats(f) { const ps = genFriend(f); let steal = 0, help = 0; ps.forEach(P => { if (P.u && P.c >= 0) { if (P.p >= 1 && !P.stolen) steal++; if (P.pr.d || P.pr.w || P.pr.b) help++; } }); return { steal, help }; }
function visit(f) {
  closeModal(); view = { friend: f, plots: genFriend(f), key: f.id }; S.tool = 'auto'; hoverIdx = -1; bgDirty = true; sfx('open'); $('tip').style.display = 'none';
  renderToolbar(); renderTitle(); renderFriends(); toast(`来到了 ${f.name} 的农场`);
}
function goHome() { view = { friend: null, plots: S.plots, key: 'home' }; hoverIdx = -1; bgDirty = true; sfx('open'); renderToolbar(); renderTitle(); renderFriends(); }
function fSteal(i) {
  const f = view.friend, P = view.plots[i], cr = CROPS[P.c], pos = plotPos(i);
  if (P.stolen) { toast('这块地你已经摘过了～', 'warn'); return false; }
  if (f.dog && Math.random() < f.dog) { const loss = Math.min(S.gold, rint(20, 60)); setGold(S.gold - loss); sfx('bark'); fxText(pos.x, pos.y - 40, `被狗咬了 -${loss}`, '#ff8a8a', 20); addLog(`🐕 被 <b>${f.name}</b> 家的狗咬了，损失 ${loss} 金币`); return false; }
  const n = Math.max(2, Math.min(P.y, Math.round(P.y * (0.08 + Math.random() * 0.1)))); P.stolen = true; S.stolen[P.key] = 1; S.wh[P.c] = (S.wh[P.c] || 0) + n;
  fxStars(pos.x, pos.y - 40, 8); fxText(pos.x, pos.y - 54, `${cr.name} ×${n}`, '#fff6c0', 22); fxText(pos.x, pos.y - 24, '+3 经验', '#8fe8ff', 17); sfx('steal'); addExp(3); task('steal'); addLog(`🥷 从 <b>${f.name}</b> 家摘了 ${n} 个${cr.name}`); renderFriends(); return true;
}
function fHelp(i) {
  const P = view.plots[i], pos = plotPos(i), k = P.pr.d ? 'd' : P.pr.w ? 'w' : P.pr.b ? 'b' : null; if (!k) return false; P.pr[k] = 0; S.helped[P.key] = 1;
  if (k === 'd') { fxDrops(pos.x, pos.y); sfx('water'); } else if (k === 'w') { fxLeaves(pos.x, pos.y); sfx('weed'); } else { fxStars(pos.x, pos.y - 30, 6, '#ff9a9a'); sfx('bug'); }
  fxText(pos.x, pos.y - 50, '帮忙 +4经验 +6🪙', '#b8f08a', 17); addExp(4); addGold(6); task('help'); renderFriends(); return true;
}

/* ============ 输入 ============ */
function clickPlot(i) {
  const isHome = view.key === 'home'; if (i < 0) return false; const P = view.plots[i];
  if (!isHome) {
    if (!P.u || P.c < 0) return false; if (P.p >= 1 && !P.stolen) return fSteal(i); if (P.pr.d || P.pr.w || P.pr.b) return fHelp(i); return false;
  }
  if (!P.u) { if (S.tool === 'auto') { askExpand(i); } return false; }
  switch (S.tool) {
    case 'shovel': return actShovel(i);
    case 'fert': return actFert(i);
    case 'red': return actRed(i);
    default:
      if (P.c < 0) return actPlant(i); if (P.p >= 1) return actHarvest(i); if (P.pr.d || P.pr.w || P.pr.b) return actCare(i); return false;
  }
}
function askExpand(i) {
  const cost = plotCost(), need = plotNeedLv();
  openModal(`<div class="confirm"><div class="big">🌾</div><h3>开垦新土地</h3><p>花费 <b>🪙 ${cost}</b> 金币开垦这块荒地${S.lv < need ? `<br><span class="warn">需要 Lv.${need}（当前 Lv.${S.lv}）</span>` : ''}</p>
    <div class="row"><button class="btn" onclick="closeModal()">再想想</button><button class="btn primary" id="okx">开垦</button></div></div>`, { small: true });
  $('okx').onclick = () => { closeModal(); if (actExpand(i)) { renderFriends(); } };
}
function batch(fn, list) { list.forEach((i, k) => setTimeout(() => { if (fn(i) === false) { } }, k * 70)); }
function allHarvest() { if (view.key !== 'home') return; const l = S.plots.map((P, i) => P.u && P.c >= 0 && P.p >= 1 ? i : -1).filter(i => i >= 0); if (!l.length) { toast('还没有成熟的作物～'); return; } batch(actHarvest, l); }
function allCare() { if (view.key !== 'home') return; const l = []; S.plots.forEach((P, i) => { if (P.u && P.c >= 0) { ['d', 'w', 'b'].forEach(k => { if (P.pr[k]) l.push(i); }); } }); if (!l.length) { toast('农田都很健康～'); return; } let d = 0; l.forEach(i => { setTimeout(() => actCare(i), d); d += 90; }); }
function allPlant() {
  if (view.key !== 'home') return; const cr = CROPS[S.seed]; const l = S.plots.map((P, i) => P.u && P.c < 0 ? i : -1).filter(i => i >= 0); if (!l.length) { toast('没有空地了'); return; }
  if (S.lv < cr.lv) { toast(`${cr.name} 需要 Lv.${cr.lv}`, 'warn'); return; } const can = Math.min(l.length, Math.floor(S.gold / cr.seed)); if (can <= 0) { toast('金币不够买种子啦', 'warn'); sfx('err'); return; }
  l.slice(0, can).forEach((i, k) => setTimeout(() => actPlant(i, true), k * 70));
}
function allSteal() { if (view.key === 'home') return; const l = view.plots.map((P, i) => P.u && P.c >= 0 && P.p >= 1 && !P.stolen ? i : -1).filter(i => i >= 0); if (!l.length) { toast('没有可以摘的果实了'); return; } l.forEach((i, k) => setTimeout(() => fSteal(i), k * 120)); }
function allHelp() { if (view.key === 'home') return; const l = view.plots.map((P, i) => P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b) ? i : -1).filter(i => i >= 0); if (!l.length) { toast('这里不需要帮忙～'); return; } l.forEach((i, k) => setTimeout(() => fHelp(i), k * 120)); }

/* ============ HUD / 工具栏 / 好友栏 ============ */
function renderHud() {
  $('pname').textContent = S.name; $('lvbadge').textContent = 'Lv.' + S.lv;
  const need = expNeed(S.lv), pct = S.lv >= MAX_LV ? 100 : S.exp / need * 100; $('expfill').style.width = pct + '%'; $('exptext').textContent = S.lv >= MAX_LV ? '满级' : `${Math.floor(S.exp)} / ${need}`;
  $('goldnum').textContent = fmt(S.gold);
}
function renderTitle() { $('title').innerHTML = view.key === 'home' ? `🌾 ${S.name}的农场` : `🏡 ${view.friend.name}的农场 <small>Lv.${view.friend.lv}</small>`; const day = ['自动', '白天', '黄昏', '夜晚'][['auto', 'day', 'dusk', 'night'].indexOf(S.tod)]; $('todbtn').textContent = ({ auto: '🌤️', day: '☀️', dusk: '🌇', night: '🌙' })[S.tod]; $('todbtn').title = '时间：' + day + '（点击切换）'; }
function claimable() { if (S.tasks.date !== today()) resetTasks(); return TASKS.filter(t => (S.tasks.prog[t.id] || 0) >= t.need && !S.tasks.claimed[t.id]).length + (S.checkin.last !== today() ? 1 : 0); }
function renderToolbar() {
  const home = view.key === 'home', tb = $('toolbar'); const items = [];
  const tool = (id, ic, tx, extra) => items.push({ id, ic, tx, tool: true, ...extra });
  if (home) {
    tool('auto', '🖐️', '自动');
    items.push({ id: 'seed', ic: `<img src="${cropIcon(S.seed)}">`, tx: CROPS[S.seed].name, raw: 1 });
    tool('shovel', '⛏️', '铲除'); tool('fert', '🧪', '化肥', { badge: S.items.fert });
    items.push({ id: 'allh', ic: '🧺', tx: '一键收获' }, { id: 'allc', ic: '🛠️', tx: '一键护理' }, { id: 'allp', ic: '🌱', tx: '一键种植' });
    items.push({ id: 'wh', ic: '🎒', tx: '仓库' }, { id: 'shop', ic: '🏪', tx: '商店' }, { id: 'task', ic: '📜', tx: '任务', badge: claimable(), alert: 1 });
  } else {
    tool('auto', '🖐️', '自动'); items.push({ id: 'alls', ic: '🥷', tx: '一键摘取' }, { id: 'allhp', ic: '🤝', tx: '一键帮忙' }, { id: 'wh', ic: '🎒', tx: '仓库' }, { id: 'home', ic: '🏠', tx: '回家' });
  }
  tb.innerHTML = items.map(it => `<button class="tbtn${it.tool && S.tool === it.id ? ' on' : ''}" data-id="${it.id}"><span class="ic">${it.raw ? it.ic : it.ic}</span><span class="tx">${it.tx}</span>${it.badge ? `<i class="bd${it.alert ? ' al' : ''}">${it.badge}</i>` : ''}</button>`).join('');
  tb.querySelectorAll('.tbtn').forEach(b => b.onclick = () => toolbarClick(b.dataset.id));
}
function toolbarClick(id) {
  ac(); sfx('click');
  if (['auto', 'shovel', 'fert'].includes(id)) { S.tool = id; renderToolbar(); updateCursor(); return; }
  const m = { seed: openSeeds, allh: allHarvest, allc: allCare, allp: allPlant, wh: openWarehouse, shop: () => openShop('item'), task: openTasks, alls: allSteal, allhp: allHelp, home: goHome }; m[id] && m[id]();
}
function renderFriends() {
  const el = $('friends'); const list = [{ me: 1 }].concat(FRIENDS);
  el.innerHTML = list.map(f => {
    if (f.me) return `<div class="fr${view.key === 'home' ? ' on' : ''}" data-id="me"><canvas width="96" height="96" data-av="me"></canvas><span>我家</span></div>`;
    const st = friendStats(f); return `<div class="fr${view.key === f.id ? ' on' : ''}" data-id="${f.id}"><canvas width="96" height="96" data-av="${f.id}"></canvas><span>${f.name}</span>${st.steal ? `<i class="bd">${st.steal}</i>` : ''}${st.help ? `<i class="bd hp">${st.help}</i>` : ''}</div>`;
  }).join('');
  el.querySelectorAll('.fr').forEach(d => { const id = d.dataset.id, cv = d.querySelector('canvas'); drawAvatar(cv, id === 'me' ? MY_AV : FRIENDS.find(f => f.id === id).av); d.onclick = () => { ac(); id === 'me' ? goHome() : visit(FRIENDS.find(f => f.id === id)); }; });
  const my = $('avatar'); drawAvatar(my, MY_AV);
}
const MY_AV = { skin: '#ffd9b0', hat: 1, band: '#d9553a', shirt: '#4a8fd8', bg1: '#a8e4ff', bg2: '#d8f5b8' };

/* ============ 弹窗 ============ */
function openModal(html, opt) {
  opt = opt || {}; const m = $('modal'); m.className = opt.small ? 'small' : opt.wide ? 'wide' : ''; m.innerHTML = (opt.noclose ? '' : '<button class="x" onclick="closeModal()">✕</button>') + html; $('mback').classList.add('show'); sfx('open'); if (opt.mount) opt.mount();
}
function closeModal() { $('mback').classList.remove('show'); }
const iconImg = id => `<img class="cimg" src="${cropIcon(id)}">`;
function openSeeds() {
  const cards = CROPS.map(c => {
    const lock = S.lv < c.lv, per = Math.floor(c.yield * c.price);
    return `<div class="seedcard${lock ? ' lock' : ''}${S.seed === c.id ? ' sel' : ''}" data-id="${c.id}">
      ${c.seasons > 1 ? '<em class="tag">两季</em>' : ''}${iconImg(c.id)}<h4>${c.name}</h4>
      <div class="meta"><span>🪙 ${c.seed}</span><span>⏱ ${fmtTime(c.time)}</span></div>
      <div class="meta"><span>📦 ×${c.yield}</span><span>💰 ${per}</span></div><div class="meta"><span>✨ ${c.exp}经验</span></div>
      ${lock ? `<div class="lockmask">🔒 Lv.${c.lv} 解锁</div>` : ''}</div>`;
  }).join('');
  openModal(`<h2>🌱 选择种子</h2><p class="sub">选好后点击空地播种，种子在播种时自动购买</p><div class="seedgrid">${cards}</div>`, { wide: true, mount: () => { document.querySelectorAll('.seedcard').forEach(d => d.onclick = () => { const id = +d.dataset.id; if (S.lv < CROPS[id].lv) { toast(`需要 Lv.${CROPS[id].lv} 解锁`, 'warn'); sfx('err'); return; } S.seed = id; S.tool = 'auto'; closeModal(); renderToolbar(); sfx('click'); toast(`已选择 ${CROPS[id].name}`); }); } });
}
function openWarehouse(tab) {
  tab = tab || 'fruit'; const bonus = dayBonus(), ids = Object.keys(S.wh).map(Number).sort((a, b) => a - b); let total = 0; ids.forEach(id => total += S.wh[id] * unitPrice(id));
  const bonusTxt = Object.keys(bonus).map(id => `<span class="hot">🔥 ${CROPS[id].name} +${Math.round(bonus[id] * 100)}%</span>`).join('');
  let body;
  if (tab === 'fruit') {
    body = ids.length ? ids.map(id => `<div class="row-item"><div class="ri-ic">${iconImg(id)}</div><div class="ri-main"><b>${CROPS[id].name}</b><small>单价 🪙${unitPrice(id)}${bonus[id] ? ' <span class="hot">🔥</span>' : ''}</small></div><div class="ri-n">×${S.wh[id]}</div>
      <button class="btn sm" data-sell="${id}" data-n="1">卖1个</button><button class="btn sm primary" data-sell="${id}" data-n="9999">全部卖出</button></div>`).join('') : '<div class="empty">仓库空空如也，去收获点什么吧～</div>';
    body += ids.length ? `<div class="sellall"><button class="btn big primary" id="sellall">一键卖出全部 · 约 🪙${total}</button></div>` : '';
  } else {
    body = `<div class="row-item"><div class="ri-ic big">🧪</div><div class="ri-main"><b>化肥</b><small>选择工具栏的「化肥」后点击作物，加速 30% 成长</small></div><div class="ri-n">×${S.items.fert}</div></div>
      <div class="row-item"><div class="ri-ic big">🍖</div><div class="ri-main"><b>狗粮</b><small>喂食后小狗会看家 20 分钟，赶走偷菜的人${S.dog.own ? (dogActive() ? `（还剩 ${fmtTime((S.dog.until - Date.now()) / 1000)}）` : '') : '（需先领养小狗）'}</small></div><div class="ri-n">×${S.items.dogfood}</div><button class="btn sm primary" id="feeddog">喂狗</button></div>`;
  }
  openModal(`<h2>🎒 仓库</h2><div class="tabs"><button class="${tab === 'fruit' ? 'on' : ''}" data-t="fruit">果实</button><button class="${tab === 'item' ? 'on' : ''}" data-t="item">道具</button></div><div class="hots">${bonusTxt ? '今日行情：' + bonusTxt : ''}</div><div class="list">${body}</div>`, {
    wide: true, mount: () => {
      document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => openWarehouse(b.dataset.t));
      document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const g = sellCrop(+b.dataset.sell, +b.dataset.n); if (g) { toast(`卖出获得 🪙${g}`); openWarehouse(tab); } });
      const sa = $('sellall'); if (sa) sa.onclick = () => { let g = 0; ids.forEach(id => g += sellCrop(id, 9999)); toast(`一共卖出 🪙${g}`); openWarehouse(tab); };
      const fd = $('feeddog'); if (fd) fd.onclick = () => { feedDog(); openWarehouse('item'); };
    }
  });
}
function openShop(tab) {
  tab = tab || 'item'; let body = '';
  if (tab === 'item') {
    body = `<div class="row-item"><div class="ri-ic big">🧪</div><div class="ri-main"><b>化肥</b><small>让作物成长进度 +30%</small></div><div class="price">🪙 60</div><button class="btn sm primary" data-buy="fert" data-n="1">购买</button><button class="btn sm" data-buy="fert" data-n="10">×10</button></div>
    <div class="row-item"><div class="ri-ic big">🍖</div><div class="ri-main"><b>狗粮</b><small>小狗吃饱后看家 20 分钟</small></div><div class="price">🪙 120</div><button class="btn sm primary" data-buy="dogfood" data-n="1">购买</button><button class="btn sm" data-buy="dogfood" data-n="5">×5</button></div>`;
  } else if (tab === 'land') {
    const owned = S.plots.filter(p => p.u).length, can = owned < COLS * ROWS;
    body = `<div class="row-item"><div class="ri-ic big">🌾</div><div class="ri-main"><b>开垦荒地</b><small>已开垦 ${owned}/${COLS * ROWS} 块 · 需要 Lv.${plotNeedLv()}</small></div><div class="price">🪙 ${can ? plotCost() : '—'}</div><button class="btn sm primary" id="buyland" ${can ? '' : 'disabled'}>开垦</button></div>
    <div class="row-item"><div class="ri-ic big" style="background:linear-gradient(#d9663a,#a53a1a)">🟥</div><div class="ri-main"><b>红土地升级</b><small>生长速度 +20%，产量 +20% · 需要 Lv.5<br>购买后点击要升级的土地</small></div><div class="price">🪙 ${redCost()}</div><button class="btn sm primary" id="buyred">选择土地</button></div>`;
  } else {
    body = `<div class="row-item"><div class="ri-ic big">🐶</div><div class="ri-main"><b>${S.dog.own ? '看家小狗（已领养）' : '领养小狗'}</b><small>${S.dog.own ? '喂狗粮后它会帮你赶走小偷' : '好友会来偷菜，有一只小狗帮你看家吧'}${S.lv < 3 && !S.dog.own ? ' · 需要 Lv.3' : ''}</small></div><div class="price">${S.dog.own ? '' : '🪙 400'}</div><button class="btn sm primary" id="buydog" ${S.dog.own ? 'disabled' : ''}>${S.dog.own ? '已拥有' : '领养'}</button></div>`;
  }
  openModal(`<h2>🏪 商店</h2><div class="tabs"><button class="${tab === 'item' ? 'on' : ''}" data-t="item">道具</button><button class="${tab === 'land' ? 'on' : ''}" data-t="land">土地</button><button class="${tab === 'dog' ? 'on' : ''}" data-t="dog">宠物</button></div><div class="mygold">我的金币：🪙 ${S.gold}</div><div class="list">${body}</div>`, {
    wide: true, mount: () => {
      document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => openShop(b.dataset.t));
      document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const k = b.dataset.buy, n = +b.dataset.n, price = (k === 'fert' ? 60 : 120) * n; if (S.gold < price) { toast('金币不足', 'warn'); sfx('err'); return; } setGold(S.gold - price); S.items[k] += n; sfx('coin'); toast(`购买成功 ×${n}`); renderToolbar(); openShop('item'); });
      const bl = $('buyland'); if (bl) bl.onclick = () => { const next = UNLOCK_ORDER.find(i => !S.plots[i].u); if (next === undefined) return; if (S.lv < plotNeedLv()) { toast(`需要 Lv.${plotNeedLv()}`, 'warn'); sfx('err'); return; } if (actExpand(next)) { goHomeIfNeeded(); openShop('land'); } };
      const br = $('buyred'); if (br) br.onclick = () => { if (S.lv < 5) { toast('红土地需要 Lv.5', 'warn'); sfx('err'); return; } closeModal(); S.tool = 'red'; renderToolbar(); updateCursor(); toast('点击一块已开垦的土地进行升级（点工具栏「自动」取消）'); };
      const bd = $('buydog'); if (bd) bd.onclick = () => { if (S.lv < 3) { toast('需要 Lv.3', 'warn'); sfx('err'); return; } if (S.gold < 400) { toast('金币不足', 'warn'); sfx('err'); return; } setGold(S.gold - 400); S.dog.own = true; S.items.dogfood += 1; sfx('bark'); toast('🐶 小狗来啦！送你一份狗粮，记得喂它'); openShop('dog'); renderToolbar(); };
    }
  });
}
function goHomeIfNeeded() { if (view.key !== 'home') goHome(); }
function claimTask(id) {
  const t = TASKS.find(x => x.id === id); if ((S.tasks.prog[id] || 0) < t.need || S.tasks.claimed[id]) return; S.tasks.claimed[id] = 1; addGold(t.gold); addExp(t.exp); sfx('coin'); toast(`任务完成！🪙+${t.gold}  ✨+${t.exp}`); openTasks(); renderToolbar();
}
function doCheckin() {
  if (S.checkin.last === today()) return; const y = new Date(); y.setDate(y.getDate() - 1); const ys = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
  S.checkin.streak = S.checkin.last === ys ? S.checkin.streak + 1 : 1; S.checkin.last = today(); const n = ((S.checkin.streak - 1) % 7) + 1, g = 100 * n;
  addGold(g); let extra = ''; if (n % 3 === 0) { S.items.fert += 2; extra = '、化肥 ×2'; } if (n === 7) { S.items.dogfood += 2; extra += '、狗粮 ×2'; } sfx('level'); toast(`签到成功！第${n}天 🪙+${g}${extra}`); openTasks(); renderToolbar();
}
function openTasks() {
  if (S.tasks.date !== today()) resetTasks(); const done = S.checkin.last === today(), n = done ? ((S.checkin.streak - 1) % 7) + 1 : (S.checkin.streak % 7) + 1;
  const days = [1, 2, 3, 4, 5, 6, 7].map(d => `<div class="day${(done ? d <= n : d < n) ? ' got' : ''}${!done && d === n ? ' today' : ''}"><small>第${d}天</small><b>🪙${d * 100}</b>${d % 3 === 0 ? '<em>+🧪</em>' : ''}${d === 7 ? '<em>+🍖</em>' : ''}</div>`).join('');
  const rows = TASKS.map(t => { const p = Math.min(t.need, S.tasks.prog[t.id] || 0), ok = p >= t.need, cl = S.tasks.claimed[t.id]; return `<div class="row-item task"><div class="ri-ic big">${t.ic}</div><div class="ri-main"><b>${t.tx}</b><div class="pbar"><i style="width:${p / t.need * 100}%"></i><span>${p}/${t.need}</span></div><small>奖励 🪙${t.gold} · ✨${t.exp}</small></div><button class="btn sm ${ok && !cl ? 'primary' : ''}" data-claim="${t.id}" ${ok && !cl ? '' : 'disabled'}>${cl ? '已领取' : ok ? '领取' : '进行中'}</button></div>`; }).join('');
  openModal(`<h2>📜 每日任务</h2><div class="checkin"><div class="cih"><b>📅 每日签到</b><span>已连续 ${S.checkin.streak} 天</span><button class="btn sm primary" id="checkin" ${done ? 'disabled' : ''}>${done ? '今日已签' : '签到'}</button></div><div class="days">${days}</div></div><div class="list">${rows}</div>`, {
    wide: true, mount: () => { document.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claimTask(b.dataset.claim)); const ci = $('checkin'); if (ci) ci.onclick = doCheckin; }
  });
}
function openHelp() {
  openModal(`<h2>📖 玩法说明</h2><div class="help">
  <p><b>🖐️ 自动模式（默认）</b>：直接点击土地，系统会按状态自动处理——空地播种、成熟收获、有💧🌿🐛就顺手处理。按住鼠标在土地上拖动可以连续操作！</p>
  <p><b>🌱 种子</b>：点工具栏「种子」选择要种的作物。种子在播种时自动扣钱。等级越高，能种的作物越值钱。</p>
  <p><b>💧🌿🐛 照看农田</b>：作物生长中会缺水、长草、生虫，不处理会让成长变慢。照料还能得到经验。下雨天农田会自动被浇灌。</p>
  <p><b>🧪 化肥</b>：选择「化肥」后点击生长中的作物，立即加快 30% 的进度。</p>
  <p><b>🎒 仓库 / 🏪 商店</b>：收获的果实放在仓库里，可以随时出售（注意每日行情🔥）。商店可以买化肥、狗粮、扩建土地、升级红土地和领养小狗。</p>
  <p><b>🥷 好友农场</b>：点击右侧好友头像去串门，成熟的果实可以摘取（每块地只能摘一次），有💧🌿🐛的地可以帮忙打理拿奖励。小心有些好友家养了狗！</p>
  <p><b>🦊 小偷</b>：你的作物成熟后没有及时收获，好友也会来偷。养一只小狗并喂狗粮可以帮你看家。</p>
  <p><b>🌾 两季作物</b>：带「两季」标记的作物收获后会自动长第二季，不用重新买种子。</p>
  <p><b>⌨️ 快捷键</b>：1 自动 · 2 铲除 · 3 化肥 · Q 一键收获 · W 一键护理 · E 一键种植 · Esc 关闭弹窗</p>
  </div>`, { wide: true });
}
function openMenu() {
  openModal(`<h2>⚙️ 设置</h2><div class="list">
    <div class="row-item"><div class="ri-main"><b>农场名字</b><small>${S.name}</small></div><button class="btn sm" id="rename">修改</button></div>
    <div class="row-item"><div class="ri-main"><b>游戏音效</b></div><button class="btn sm ${S.sound ? 'primary' : ''}" id="tsound">${S.sound ? '开启' : '关闭'}</button></div>
    <div class="row-item"><div class="ri-main"><b>背景音乐</b></div><button class="btn sm ${S.music ? 'primary' : ''}" id="tmusic">${S.music ? '开启' : '关闭'}</button></div>
    <div class="row-item"><div class="ri-main"><b>玩法说明</b></div><button class="btn sm" id="thelp">查看</button></div>
    <div class="row-item"><div class="ri-main"><b>重置存档</b><small>清除所有进度，重新开始</small></div><button class="btn sm danger" id="reset">重置</button></div></div>`, {
    small: true, mount: () => {
      $('rename').onclick = () => { const n = prompt('给你的农场起个名字（最多8个字）', S.name); if (n && n.trim()) { S.name = n.trim().slice(0, 8); renderHud(); renderTitle(); openMenu(); } };
      $('tsound').onclick = () => { S.sound = !S.sound; openMenu(); }; $('tmusic').onclick = () => { S.music = !S.music; if (S.music) startMusic(); openMenu(); };
      $('thelp').onclick = openHelp; $('reset').onclick = () => { if (confirm('确定要清除所有存档重新开始吗？')) { noSave = true; localStorage.removeItem(SAVE_KEY); location.reload(); } };
    }
  });
}
function welcome() {
  openModal(`<div class="welcome"><div class="wtitle">🌾 丰收农场</div><p>欢迎来到你的小农场！</p><ul><li>点击土地 <b>种植</b>，等作物成熟后点击 <b>收获</b></li><li>留意作物上的 💧🌿🐛，及时照顾它们</li><li>在右边 <b>好友</b> 家串门摘果实，赚金币升级</li></ul><p class="sub">鼠标按住拖动可以连续操作哦</p><button class="btn big primary" onclick="closeModal()">开始种田！</button></div>`, { small: true, noclose: true });
}

/* ============ Canvas 主循环 ============ */
const cv = $('cv'), ctx = cv.getContext('2d'); let W = 0, H = 0, DPR = 1, K = 1, offX = 0, offY = 0, vb = { x0: 0, x1: 1600, y0: 0, y1: 900 }; const bg = document.createElement('canvas'); let bgDirty = true;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  K = Math.max(0.4, Math.min((H - 150) / 650, W / 1340)); offX = W / 2 - 800 * K; offY = H / 2 - 490 * K - 6;
  vb = { x0: -offX / K, x1: (W - offX) / K, y0: -offY / K, y1: (H - offY) / K }; bg.width = cv.width; bg.height = cv.height; bgDirty = true;
}
function rebuildBg() {
  const c = bg.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bg.width, bg.height); c.setTransform(DPR * K, 0, 0, DPR * K, DPR * offX, DPR * offY);
  buildBackground(c, vb, view.friend ? view.friend.theme : OWN_THEME); bgDirty = false;
}
function curHour() { const m = { day: 12, dusk: 18.6, night: 23 }; if (m[S.tod]) return m[S.tod]; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
const chickens = [{ x: 175, y: 560, vx: 0, tx: 175, d: 1, pk: 0, w: 140 }, { x: 1300, y: 500, vx: 0, tx: 1300, d: -1, pk: 0, w: 120 }, { x: 1180, y: 730, vx: 0, tx: 1180, d: 1, pk: 0, w: 100 }];
function updateChickens(dt, t) {
  chickens.forEach((c, i) => { c.pk -= dt; if (c.pk > 0) return; if (Math.abs(c.tx - c.x) < 3) { if (Math.random() < 0.5) { c.pk = 1 + Math.random() * 2; c.tx = c.x; } else { c.tx = clamp(c.x + (Math.random() - 0.5) * 2 * c.w, [120, 1230, 1150][i] - c.w, [120, 1230, 1150][i] + c.w); } } else { const s = 22 * dt; c.x += Math.sign(c.tx - c.x) * s; c.d = Math.sign(c.tx - c.x) || c.d; } });
}
let lastFrame = performance.now(), tAcc = 0;
function frame(now) {
  const dt = Math.min(0.06, (now - lastFrame) / 1000); lastFrame = now; tAcc += dt; const t = tAcc;
  if (bgDirty) rebuildBg(); updateFx(dt); updateChickens(dt, t);
  const raining = Date.now() < rainUntil; rainK += ((raining ? 1 : 0) - rainK) * Math.min(1, dt * 1.2);
  const h = curHour(), nk = nightK(h);
  ctx.setTransform(DPR * K, 0, 0, DPR * K, DPR * offX, DPR * offY);
  drawSky(ctx, vb, h, rainK); drawCelestial(ctx, vb, h, t); drawClouds(ctx, vb, t, rainK > 0.5, nk); if (nk < 0.5) drawBirds(ctx, vb, t);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.drawImage(bg, 0, 0, W, H); ctx.setTransform(DPR * K, 0, 0, DPR * K, DPR * offX, DPR * offY);
  // 动态小物
  drawSmoke(ctx, 250 + 44, 340 - 142, t); windmillBlades(ctx, 1240, 330, t, t * (rainK > 0.5 ? 1.3 : 0.55)); pondShimmer(ctx, 215, 667, t);
  const sl = Math.sin(t * 0.37);
  drawButterfly(ctx, 600 + Math.sin(t * 0.7) * 160, 430 + Math.sin(t * 1.3) * 40, t, '#ff9ac8'); drawButterfly(ctx, 1000 + Math.cos(t * 0.5) * 140, 600 + Math.sin(t * 0.9) * 50, t + 2, '#ffe066');
  chickens.forEach((c, i) => drawChicken(ctx, c.x, c.y, t + i * 3, c.d, c.pk > 0));
  if (view.key === 'home') { const mode = !S.dog.own ? 'none' : (Date.now() < dogBarkUntil ? 'bark' : dogActive() ? 'guard' : 'sleep'); drawDog(ctx, 1352 + 58, 628, t, mode); if (!S.dog.own) { ctx.save(); ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.restore(); } }
  else if (view.friend.dog) drawDog(ctx, 1410, 628, t, Math.sin(t * 0.3) > 0.2 ? 'bark' : 'guard');
  // 土地
  const plots = view.plots;
  DEPTH_ORDER.forEach(i => {
    const P = plots[i], pos = plotPos(i); drawPlot(ctx, P, pos.x, pos.y, t, { hover: i === hoverIdx, idx: i, price: plotCost(), stolen: P.stolen && view.key !== 'home' });
  });
  drawFrontFence(ctx);
  drawFx(ctx);
  // 光照
  const dusk = (h > 17 && h < 19.8) ? 1 - Math.abs(h - 18.4) / 1.4 : 0, dawn = (h > 5 && h < 7.5) ? 1 - Math.abs(h - 6.2) / 1.3 : 0;
  if (nk > 0) { ctx.fillStyle = `rgba(14,24,76,${0.46 * nk})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); }
  if (dusk > 0) { ctx.fillStyle = `rgba(255,140,60,${0.16 * dusk})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); }
  if (dawn > 0) { ctx.fillStyle = `rgba(255,170,130,${0.12 * dawn})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); }
  if (rainK > 0.01) { ctx.fillStyle = `rgba(40,60,90,${0.22 * rainK})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); ctx.globalAlpha = rainK; drawRain(ctx, vb, t); ctx.globalAlpha = 1; }
  if (nk > 0.3) drawFireflies(ctx, vb, t, nk);
  // 暗角
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,30,10,.28)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  updateTip(); requestAnimationFrame(frame);
}

/* ============ 指针 & 提示 ============ */
function toWorld(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left - offX) / K, y: (ev.clientY - r.top - offY) / K }; }
function pickPlot(wx, wy) {
  const plots = view.plots;
  for (let n = DEPTH_ORDER.length - 1; n >= 0; n--) {
    const i = DEPTH_ORDER[n], P = plots[i], p = plotPos(i); if (Math.abs(wx - p.x) / 80 + Math.abs(wy - p.y) / 40 <= 1.02) return i;
    if (P.u && P.c >= 0) { const top = (CROPS[P.c].art.hh || 70) * (stageOf(P.p) >= 3 ? 1 : 0.6); if (Math.abs(wx - p.x) < 32 && wy < p.y && wy > p.y - top) return i; }
  }
  return -1;
}
function paintAt(ev, first) {
  const w = toWorld(ev), i = pickPlot(w.x, w.y); if (i < 0 || (!first && i === lastPaint)) return; lastPaint = i; ac(); startMusic();
  if (first || view.key === 'home') clickPlot(i);
}
cv.addEventListener('pointerdown', ev => { if (ev.button !== 0 && ev.pointerType === 'mouse') return; painting = true; lastPaint = -1; mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = true; hoverIdx = pickPlot(...Object.values(toWorld(ev))); paintAt(ev, true); try { cv.setPointerCapture(ev.pointerId); } catch (e) { } });
cv.addEventListener('pointermove', ev => { mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = true; const w = toWorld(ev); hoverIdx = pickPlot(w.x, w.y); if (painting) paintAt(ev, false); updateCursor(); });
cv.addEventListener('pointerup', () => { painting = false; lastPaint = -1; }); cv.addEventListener('pointercancel', () => { painting = false; });
cv.addEventListener('pointerleave', () => { mouse.in = false; hoverIdx = -1; updateCursor(); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); S.tool = 'auto'; renderToolbar(); updateCursor(); });
function updateCursor() {
  const el = $('curtool'); let h = ''; const i = hoverIdx, plots = view.plots;
  if (mouse.in && i >= 0 && view.key === 'home') {
    const P = plots[i];
    if (S.tool === 'shovel') h = '⛏️'; else if (S.tool === 'fert') h = '🧪'; else if (S.tool === 'red') h = '🟥';
    else if (P.u && P.c < 0) h = `<img src="${cropIcon(S.seed)}">`; else if (P.u && P.c >= 0 && P.p >= 1) h = '🧺'; else if (P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b)) h = P.pr.d ? '💧' : P.pr.w ? '🌿' : '🐛';
  } else if (mouse.in && i >= 0 && view.key !== 'home') { const P = plots[i]; if (P.u && P.c >= 0 && P.p >= 1 && !P.stolen) h = '🥷'; else if (P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b)) h = '🤝'; }
  else if (mouse.in && S.tool !== 'auto' && view.key === 'home') h = S.tool === 'shovel' ? '⛏️' : S.tool === 'fert' ? '🧪' : '🟥';
  if (el._h !== h) { el._h = h; el.innerHTML = h; } el.style.display = h ? 'block' : 'none'; el.style.transform = `translate(${mouse.x + 14}px,${mouse.y + 12}px)`;
  cv.style.cursor = h ? 'pointer' : (i >= 0 ? 'pointer' : 'default');
}
function updateTip() {
  const tip = $('tip'); if (!mouse.in || hoverIdx < 0 || painting) { tip.style.display = 'none'; return; }
  const P = view.plots[hoverIdx]; let h = '';
  if (!P.u) h = `<b>🌾 荒地</b><div>开垦需要 🪙${plotCost()}（Lv.${plotNeedLv()}）</div>`;
  else if (P.c < 0) h = `<b>空地${P.soil ? '（红土地）' : ''}</b><div>点击种植 ${CROPS[S.seed].name}${view.key === 'home' ? `（🪙${CROPS[S.seed].seed}）` : ''}</div>`;
  else {
    const cr = CROPS[P.c], st = stageOf(P.p), pr = [P.pr.d && '💧缺水', P.pr.w && '🌿杂草', P.pr.b && '🐛害虫'].filter(Boolean);
    h = `<b>${cr.name}${P.soil ? '（红土地）' : ''}</b><div>${STAGE_NAME[st]}${cr.seasons > 1 ? ` · 第${P.sea + 1}季` : ''}</div>`;
    h += st === 4 ? `<div>预计 ×${P.y}${P.stolen ? '（已被摘过）' : ''}</div>` : `<div>成熟还需 ${fmtTime(remainSec(P))}</div><div class="bar"><i style="width:${Math.floor(P.p * 100)}%"></i></div>`;
    if (pr.length) h += `<div class="warn">${pr.join(' ')}</div>`;
  }
  if (tip._h !== h) { tip._h = h; tip.innerHTML = h; } tip.style.display = 'block';
  const x = Math.min(window.innerWidth - 190, mouse.x + 18), y = Math.max(8, mouse.y - 80); tip.style.transform = `translate(${x}px,${y}px)`;
}

/* ============ 初始化 ============ */
function init() {
  S = loadState(); view = { friend: null, plots: S.plots, key: 'home' }; pruneKeys();
  const now = Date.now(), off = Math.min(now - S.t, 8 * 3600 * 1000);
  if (!S.fresh && off > 15000) {
    const before = S.plots.filter(P => P.u && P.c >= 0 && P.p >= 1).length; tickOwn(off, false); const after = S.plots.filter(P => P.u && P.c >= 0 && P.p >= 1).length;
    setTimeout(() => toast(`欢迎回来！离开的 ${fmtTime(off / 1000)} 里，农田${after > before ? `有 ${after - before} 块作物成熟了` : '继续生长着'}`), 600);
  }
  nextThief = now + 90000; resize(); window.addEventListener('resize', resize); renderHud(); renderTitle(); renderToolbar(); renderFriends(); renderLog();
  lastTick = now; setInterval(() => { const n = Date.now(), dt = Math.min(n - lastTick, 8 * 3600 * 1000); lastTick = n; if (dt > 0) tickOwn(dt, dt <= 3500); }, 500);
  setInterval(saveState, 6000); setInterval(() => { renderFriends(); }, 20000); window.addEventListener('beforeunload', saveState); document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
  $('mback').addEventListener('pointerdown', e => { if (e.target === $('mback')) closeModal(); });
  $('btn-help').onclick = () => { ac(); openHelp(); }; $('btn-menu').onclick = () => { ac(); openMenu(); };
  $('btn-snd').onclick = () => { ac(); S.sound = !S.sound; $('btn-snd').textContent = S.sound ? '🔊' : '🔈'; if (S.sound) { startMusic(); sfx('click'); } };
  $('btn-snd').textContent = S.sound ? '🔊' : '🔈';
  $('todbtn').onclick = () => { const o = ['auto', 'day', 'dusk', 'night']; S.tod = o[(o.indexOf(S.tod) + 1) % 4]; renderTitle(); sfx('click'); };
  $('log').onclick = () => { openModal(`<h2>📋 消息</h2><div class="list logfull">${S.log.length ? S.log.slice().reverse().map(x => `<div class="row-item"><div class="ri-main">${x.m}<small>${new Date(x.t).toLocaleTimeString()}</small></div></div>`).join('') : '<div class="empty">暂时没有消息</div>'}</div>`, { small: true }); };
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase();
    if (k === 'escape') { closeModal(); S.tool = 'auto'; renderToolbar(); updateCursor(); }
    else if ($('mback').classList.contains('show')) return;
    else if (k === '1') toolbarClick('auto'); else if (k === '2' && view.key === 'home') toolbarClick('shovel'); else if (k === '3' && view.key === 'home') toolbarClick('fert');
    else if (k === 'q') (view.key === 'home' ? allHarvest : allSteal)(); else if (k === 'w') (view.key === 'home' ? allCare : allHelp)(); else if (k === 'e') allPlant();
  });
  if (S.fresh) { S.fresh = false; welcome(); }
  document.addEventListener('pointerdown', () => { ac(); startMusic(); }, { once: true });
  requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', init);
