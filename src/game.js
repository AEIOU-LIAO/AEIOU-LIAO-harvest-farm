'use strict';
/* =====================================================
   丰收农场 · 客户端（联网版）
   服务器是金币、作物、偷菜结果的唯一权威；客户端只负责展示与请求。
   ===================================================== */
const $ = id => document.getElementById(id);
const CFG = GAMECFG, RULES = CFG.RULES;
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(1) + '亿' : n >= 1e4 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + '万' : String(Math.floor(n));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); if (s < 60) return s + '秒'; const m = Math.floor(s / 60), r = s % 60; if (m < 60) return m + '分' + (r ? r + '秒' : ''); const h = Math.floor(m / 60); return h + '小时' + (m % 60 ? (m % 60) + '分' : ''); }
function ago(t) { const s = (NET.now() - t) / 1000; if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + '分钟前'; if (s < 86400) return Math.floor(s / 3600) + '小时前'; return Math.floor(s / 86400) + '天前'; }
const cropOf = item => { const m = /^([cg])(\d+)$/.exec(item || ''); return m && CROPS[+m[2]] ? { golden: m[1] === 'g', id: +m[2] } : null; };
const itemName = item => item === 'fert' ? '化肥' : item === 'dogfood' ? '狗粮' : (c => c ? (c.golden ? '金色' : '') + CROPS[c.id].name : item)(cropOf(item));
const unitPrice = item => { const c = cropOf(item); if (!c) return 0; const b = (S && S.bonus || {})[c.id] || 0; let m = 1; (S && S.events || []).forEach(e => { if (e.kind === 'price_mult' && (e.params.crop == null || +e.params.crop === c.id)) m *= e.params.mult; }); return Math.round(CROPS[c.id].price * (1 + b) * (c.golden ? RULES.goldenPriceMult : 1) * m); };
const DEPTH_ORDER = (() => { const a = []; for (let i = 0; i < COLS * ROWS; i++) a.push(i); a.sort((p, q) => { const dp = (p % COLS) + Math.floor(p / COLS), dq = (q % COLS) + Math.floor(q / COLS); return dp - dq || (p % COLS) - (q % COLS); }); return a; })();
const stageOf = CFG.stageOf, STAGE_NAME = CFG.STAGE_NAME, expNeed = CFG.expNeed;
function plotPos(i) { return cellPos(i % COLS, Math.floor(i / COLS)); }

/* ============ 状态 ============ */
let S = null;                 // 服务器快照：me / plots / inv / badges / rain / bonus / events
let FR = { list: [], requests: [], sent: [], visitors: [] }; // 好友
let MSGS = [];                // 消息缓存
let PREF = { sound: true, music: true, notify: false, tod: 'auto', tut: 0 };
let view = { key: 'home', friend: null, plots: [], farm: null };
let tool = 'auto', hoverIdx = -1, painting = false, lastPaint = -1, mouse = { x: 0, y: 0, in: false };
let started = false, dogBarkUntil = 0;
const busy = new Set();
const blankPlots = () => { const a = []; for (let i = 0; i < CFG.NPLOTS; i++) a.push({ idx: i, u: CFG.UNLOCK_ORDER.indexOf(i) < RULES.startPlots ? 1 : 0, soil: 0, c: -1, p: 0, t: 0, sea: 0, y: 0, pr: { d: 0, w: 0, b: 0 } }); return a; };
view.plots = blankPlots();

const AVO = CFG.AVATAR_OPTS;
function avStyle(av) { av = av || {}; const bg = AVO.bg[av.bg || 0] || AVO.bg[0]; const hat = av.hat === undefined ? 1 : av.hat; return { skin: AVO.skin[av.skin || 0], hair: hat ? undefined : AVO.hair[av.hair || 0], hat, fringe: hat ? 0 : (av.fringe === undefined ? 1 : av.fringe), pig: !hat && av.pig, band: AVO.band[av.band || 0], shirt: AVO.shirt[av.shirt || 0], bg1: bg[0], bg2: bg[1] }; }
const frameColor = id => (CFG.FRAMES.find(f => f.id === id) || {}).color || '';
const themeOf = id => (CFG.THEMES.find(t => t.id === id) || CFG.THEMES[0]).th;
const unlockedCount = () => S ? S.plots.filter(p => p.u).length : RULES.startPlots;

/* ============ 音效 ============ */
let AC = null, master = null, musicTimer = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type, vol, delay, slide) {
  if (!PREF.sound) return; const a = ac(); if (!a) return;
  const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
}
function noise(d, vol, f0, f1) {
  if (!PREF.sound) return; const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
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
  golden: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.07)); },
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { } }
function startMusic() {
  if (musicTimer || !PREF.music) return; const notes = [262, 294, 330, 392, 440, 523, 587, 659]; let i = 0, last = 3;
  musicTimer = setInterval(() => {
    if (!PREF.music || !PREF.sound || document.hidden) return; const a = ac(); if (!a) return;
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

/* ============ 提示 ============ */
function toast(msg, kind) {
  const d = document.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : ''); d.textContent = msg; $('toasts').appendChild(d);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => d.remove(), 2600);
}

/* ============ 接口调用 ============ */
// 统一处理错误；成功后应用服务器返回的状态
async function api(path, body, opt) {
  opt = opt || {};
  try {
    const r = await NET.post(path, body);
    if (r.state) applyState(r.state);
    if (r.farm && view.key !== 'home' && r.farm.owner.id === view.friend.id) applyFarm(r.farm);
    if (r.me && S) { S.me = r.me; S.inv = r.inv; if (r.badges) S.badges = r.badges; renderHud(); renderToolbar(); }
    if (r.out && r.out.levelUp && r.out.levelUp.length) setTimeout(() => levelUp(r.out.levelUp[r.out.levelUp.length - 1]), opt.lvDelay || 500);
    return r;
  } catch (e) {
    if (!opt.quiet) { toast(e.code === 'network' ? '网络不稳定，操作没有完成，请稍后再试' : e.message, 'warn'); sfx('err'); }
    if (e.code === 'network') return null;
    if (e.status === 409 && !opt.noRefresh) refreshState(); // 状态可能过期，拉一次最新
    return null;
  }
}
async function refreshState() { try { const r = await NET.get('/api/state'); applyState(r); } catch (e) { } }
function applyState(st) {
  const prevUnread = S ? S.badges.unread : 0;
  S = st; PREF = Object.assign({ sound: true, music: true, notify: false, tod: 'auto', tut: 0 }, S.me.settings || {});
  if (view.key === 'home') { view.plots = S.plots; }
  if (!bgTheme || bgTheme !== S.me.theme) { bgTheme = S.me.theme; if (view.key === 'home') bgDirty = true; }
  renderHud(); renderToolbar(); renderTitle(); renderSide();
  if (S.badges.unread > prevUnread) { loadMessages(true); loadFriends(); }
}
function applyFarm(farm) { view.farm = farm; view.friend = farm.owner; view.plots = farm.plots; renderTitle(); renderToolbar(); }
async function loadMessages(notifyNew) {
  try {
    const r = await NET.get('/api/messages'); const old = new Set(MSGS.map(m => m.id + ':' + m.at)); MSGS = r.list; renderLog();
    if (notifyNew) MSGS.filter(m => !m.read && !old.has(m.id + ':' + m.at)).slice(0, 2).forEach(m => { if (m.kind === 'stolen' || m.kind === 'dog' || m.kind === 'market_sold' || m.kind === 'friend_ok' || m.kind === 'helped') { toast(stripTags(msgText(m)), m.kind === 'stolen' ? 'warn' : ''); if (m.kind === 'stolen') { sfx('steal'); if (view.key === 'home') { const d = m.data || {}; Object.keys(d.items || {}).forEach(() => { }); } } if (m.kind === 'dog') { dogBarkUntil = Date.now() + 2500; sfx('bark'); } sysNotify(stripTags(msgText(m))); } });
  } catch (e) { }
}
async function loadFriends() { try { FR = await NET.get('/api/friends'); renderFriends(); } catch (e) { } }
const stripTags = h => h.replace(/<[^>]+>/g, '');

/* ============ 消息文字 ============ */
function msgText(m) {
  const n = `<b>${esc(m.name)}</b>`, d = m.data || {};
  const items = d.items ? Object.entries(d.items).map(([k, v]) => `${v} 个${itemName(k)}`).join('、') : '';
  switch (m.kind) {
    case 'stolen': return `🥷 ${n} 摘走了你的 ${items || (d.qty || '') + ' 个果实'}${d.n > 1 ? `（${d.n} 次）` : ''}`;
    case 'helped': return `🤝 ${n} 帮你打理了农田${d.n > 1 ? ` ×${d.n}` : ''}`;
    case 'dog': return `🐶 你家小狗赶走了来偷菜的 ${n}${d.n > 1 ? ` ×${d.n}` : ''}`;
    case 'visit': return `👣 ${n} 来你的农场串门了`;
    case 'friend_ok': return `🎉 你和 ${n} 成为了好友`;
    case 'gb': return `💌 ${n} 给你留言：${esc(CFG.PHRASES[d.phrase] || '')}`;
    case 'market_sold': return `🏷️ ${n} 买走了你的 ${d.qty} 个${itemName(d.item)}，收入 🪙${d.gold}`;
    case 'market_expired': return `⌛ 集市挂单 ${d.qty} 个${itemName(d.item)} 已过期，已退回仓库`;
    default: return esc(m.kind);
  }
}
function renderLog() {
  const el = $('log'); const l = MSGS.slice(0, 4);
  el.innerHTML = l.map(m => `<div${m.read ? '' : ' class="new"'}>${msgText(m)} <small>${ago(m.at)}</small></div>`).join('') + (S && S.badges.unread ? `<div class="more">📬 ${S.badges.unread} 条新消息 · 点击查看</div>` : '');
  el.classList.toggle('empty', !l.length);
}

/* ============ 本地插值 ============ */
// 服务器只给出“某时刻的状态”，客户端按同一套规则推算进度，用于动画；每次请求后都以服务器为准
function tickView() {
  const now = NET.now();
  view.plots.forEach((P, i) => {
    if (!P.u || P.c < 0) return; const was = P.p;
    CFG.advancePlot(P, now);
    if (was < 1 && P.p >= 1) { const pos = plotPos(i); fxStars(pos.x, pos.y - 40, 10); if (view.key === 'home') ripeNotify(P); }
    if (view.key !== 'home') { P.canSteal = P.p >= 1 && !P.mine && P.left > 0 && now >= (P.ra || 0) + RULES.stealDelaySec * 1000; P.protectUntil = P.p >= 1 ? (P.ra || 0) + RULES.stealDelaySec * 1000 : 0; }
  });
}
const notified = new Set();
function ripeNotify(P) { const k = P.idx + ':' + Math.round(P.ra / 1000); if (notified.has(k)) return; notified.add(k); if (document.hidden) sysNotify(`🌾 ${CROPS[P.c].name} 成熟了，快去收获，小心被好友摘走！`); }
function sysNotify(txt) { if (!PREF.notify || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return; try { new Notification('丰收农场', { body: txt, tag: 'farm' }); } catch (e) { } }

/* ============ 自己农场的操作 ============ */
const posOf = i => plotPos(i);
async function doPlant(i, quiet) {
  const cr = CROPS[S.me.seed]; if (S.me.lv < cr.lv) { if (!quiet) toast(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'warn'); sfx('err'); return; }
  if (S.me.gold < cr.seed) { if (!quiet) toast('金币不够买种子啦', 'warn'); sfx('err'); return; }
  const r = await api('/api/farm/plant', { idx: i, crop: S.me.seed }); if (!r) return; const p = posOf(i);
  fxPuff(p.x, p.y); fxStars(p.x, p.y - 6, 5, '#b8e890'); fxText(p.x, p.y - 24, `-${cr.seed}`, '#ffd23a', 18); sfx('plant');
}
function harvestFx(x) {
  const p = posOf(x.idx), cr = CROPS[x.crop];
  fxCoins(p.x, p.y - 30, 7); fxStars(p.x, p.y - 40, 8); fxText(p.x, p.y - 50, `${cr.name} ×${x.n}`, '#fff6c0', 24); if (x.exp) fxText(p.x + 4, p.y - 20, `+${x.exp} 经验`, '#8fe8ff', 18);
  if (x.stolen) setTimeout(() => fxText(p.x, p.y - 78, `被好友摘走 ${x.stolen}`, '#ffb0a0', 15), 300);
  if (x.golden) setTimeout(() => { fxStars(p.x, p.y - 50, 24, '#ffd23a'); fxText(p.x, p.y - 96, `✨ 变异！金色${cr.name} ×${x.golden}`, '#ffd23a', 22); sfx('golden'); toast(`✨ 出现变异！获得 金色${cr.name} ×${x.golden}`); }, 500);
  if (x.season2) setTimeout(() => fxText(p.x, p.y - 70, '进入第二季', '#b8f08a', 17), 400);
}
async function doHarvest(i) { const r = await api('/api/farm/harvest', { idx: i }); if (!r) return; sfx('harvest'); harvestFx(r.result); }
function careFx(i, k, own) {
  const p = posOf(i);
  if (k === 'd') { fxDrops(p.x, p.y); sfx('water'); } else if (k === 'w') { fxLeaves(p.x, p.y); sfx('weed'); } else { fxPuff(p.x, p.y - 30); fxStars(p.x, p.y - 30, 6, '#ff9a9a'); sfx('bug'); }
  fxText(p.x, p.y - 50, own ? ({ d: '浇水', w: '除草', b: '除虫' })[k] + ' +2经验' : `帮忙 +${RULES.helpExp}经验 +${RULES.helpGold}🪙`, own ? '#8fe8ff' : '#b8f08a', 17);
}
async function doCare(i) { const r = await api('/api/farm/care', { idx: i }); if (r) careFx(i, r.result.kind, true); }
async function doShovel(i) { const P = view.plots[i]; if (P.c < 0) return; if (P.p >= 1) { toast('作物已成熟，先收获吧～', 'warn'); sfx('err'); return; } const r = await api('/api/farm/shovel', { idx: i }); if (!r) return; const p = posOf(i); fxPuff(p.x, p.y); fxLeaves(p.x, p.y, '#8a6a3a'); sfx('weed'); }
async function doFert(i) {
  const P = view.plots[i]; if (P.c < 0 || P.p >= 1) return; if (!(S.inv.fert > 0)) { toast('化肥用完了，去商店买点吧', 'warn'); sfx('err'); return; }
  const r = await api('/api/farm/fert', { idx: i }); if (!r) return; const p = posOf(i); fxStars(p.x, p.y - 30, 12, '#c8ff8a'); fxText(p.x, p.y - 56, '成长加速！', '#c8ff8a', 19); sfx('fert');
}
async function doRed(i) { const r = await api('/api/farm/red', { idx: i }); if (!r) return; const p = posOf(i); fxStars(p.x, p.y, 14, '#ff9a6a'); fxText(p.x, p.y - 40, '升级红土地！', '#ffb08a', 21); sfx('level'); toast('红土地：生长更快，产量 +20%'); tool = 'auto'; renderToolbar(); }
async function doExpand(i) { const r = await api('/api/farm/expand', { idx: i }); if (!r) return; const p = posOf(r.result.idx); fxPuff(p.x, p.y); fxStars(p.x, p.y - 10, 14); fxText(p.x, p.y - 40, '开垦成功！', '#ffe27a', 22); sfx('level'); }
function stagger(list, fn, gap) { list.forEach((x, k) => setTimeout(() => fn(x), k * (gap || 70))); }
async function allHarvest() { if (view.key !== 'home') return; const r = await api('/api/farm/harvest-all', null, { lvDelay: 900 }); if (!r) return; sfx('harvest'); stagger(r.result.filter(x => !x.err), harvestFx); }
async function allCare() { if (view.key !== 'home') return; const r = await api('/api/farm/care-all'); if (!r) return; stagger(r.result.filter(x => !x.err), x => careFx(x.idx, x.kind, true), 90); }
async function allPlant() {
  if (view.key !== 'home') return; const cr = CROPS[S.me.seed]; if (S.me.lv < cr.lv) { toast(`${cr.name} 需要 Lv.${cr.lv}`, 'warn'); return; }
  const r = await api('/api/farm/plant-all', { crop: S.me.seed }); if (!r) return; const ok = r.result.filter(x => !x.err);
  stagger(ok, x => { const p = posOf(x.idx); fxPuff(p.x, p.y); fxStars(p.x, p.y - 6, 5, '#b8e890'); fxText(p.x, p.y - 24, `-${cr.seed}`, '#ffd23a', 18); sfx('plant'); });
  const fail = r.result.length - ok.length; if (fail) toast(`种下 ${ok.length} 块，${fail} 块因金币不足没种上`, 'warn');
}

/* ============ 好友农场的操作 ============ */
async function visit(f) {
  closeModal(); $('tip').style.display = 'none';
  try {
    const r = await NET.get('/api/farm/' + f.id);
    view = { key: 'f' + f.id, friend: r.farm.owner, plots: r.farm.plots, farm: r.farm }; tool = 'auto'; hoverIdx = -1; bgDirty = true; sfx('open');
    renderToolbar(); renderTitle(); renderFriends(); toast(`来到了 ${f.name} 的农场`); refreshState();
  } catch (e) { toast(e.message, 'warn'); }
}
function goHome() { if (!S) return; view = { key: 'home', friend: null, plots: S.plots, farm: null }; hoverIdx = -1; bgDirty = true; sfx('open'); renderToolbar(); renderTitle(); renderFriends(); refreshState(); }
function stealFx(x) {
  const p = posOf(x.idx);
  if (x.blocked) { dogBarkUntil = Date.now() + 2500; sfx('bark'); fxText(p.x, p.y - 40, x.bite ? `被狗咬了 -${x.bite}🪙` : '被狗赶走了', '#ff8a8a', 20); return; }
  fxStars(p.x, p.y - 40, 8); fxText(p.x, p.y - 54, `${CROPS[x.crop].name} ×${x.qty}`, '#fff6c0', 22); fxText(p.x, p.y - 24, `+${RULES.stealExp} 经验`, '#8fe8ff', 17); sfx('steal');
}
async function fSteal(i) { const r = await api(`/api/farm/${view.friend.id}/steal`, { idx: i }); if (r) { stealFx(r.result); if (r.result.blocked) toast(`${view.friend.name} 家的小狗把你赶走了${r.result.bite ? `，损失 ${r.result.bite} 金币` : ''}`, 'warn'); } }
async function fHelp(i) { const r = await api(`/api/farm/${view.friend.id}/help`, { idx: i }); if (r) careFx(i, r.result.kind, false); }
async function allSteal() { if (view.key === 'home') return; const r = await api(`/api/farm/${view.friend.id}/steal-all`); if (!r) return; const ok = r.result.filter(x => !x.err); stagger(ok, stealFx, 120); const got = ok.filter(x => !x.blocked).reduce((a, x) => a + x.qty, 0); if (got) setTimeout(() => toast(`一共摘到 ${got} 个果实`), ok.length * 120); }
async function allHelp() { if (view.key === 'home') return; const r = await api(`/api/farm/${view.friend.id}/help-all`); if (!r) return; stagger(r.result.filter(x => !x.err), x => careFx(x.idx, x.kind, false), 120); }

/* ============ 点击土地 ============ */
async function clickPlot(i) {
  if (i < 0 || !S) return; const P = view.plots[i]; if (busy.has(view.key + i)) return; busy.add(view.key + i);
  try {
    if (view.key !== 'home') {
      if (!P.u || P.c < 0) return;
      if (P.p >= 1) {
        if (P.mine === 1) { toast('这块地你已经摘过了～'); return; } if (P.mine === 2) { toast('这块地被狗看着，下一季再来吧'); return; }
        if (P.left <= 0) { toast('已经被摘得差不多了，给主人留点吧'); return; }
        if (NET.now() < P.protectUntil) { toast(`刚成熟，主人保护中，${Math.ceil((P.protectUntil - NET.now()) / 1000)} 秒后才能摘`); return; }
        return await fSteal(i);
      }
      if (P.pr.d || P.pr.w || P.pr.b) return await fHelp(i); return;
    }
    if (!P.u) { if (tool === 'auto' && !painting) askExpand(i); return; }
    switch (tool) {
      case 'shovel': return await doShovel(i);
      case 'fert': return await doFert(i);
      case 'red': return await doRed(i);
      default: if (P.c < 0) return await doPlant(i); if (P.p >= 1) return await doHarvest(i); if (P.pr.d || P.pr.w || P.pr.b) return await doCare(i);
    }
  } finally { busy.delete(view.key + i); }
}
function askExpand(i) {
  const owned = unlockedCount(), cost = CFG.plotCost(owned), need = CFG.plotNeedLv(owned);
  openModal(`<div class="confirm"><div class="big">🌾</div><h3>开垦新土地</h3><p>花费 <b>🪙 ${fmt(cost)}</b> 金币开垦这块荒地${S.me.lv < need ? `<br><span class="warn">需要 Lv.${need}（当前 Lv.${S.me.lv}）</span>` : ''}</p>
    <div class="row"><button class="btn" onclick="closeModal()">再想想</button><button class="btn primary" id="okx">开垦</button></div></div>`, { small: true });
  $('okx').onclick = () => { closeModal(); doExpand(i); };
}

/* ============ HUD / 工具栏 / 好友栏 ============ */
function renderHud() {
  if (!S) return; const me = S.me;
  $('pname').textContent = me.name; $('lvbadge').textContent = 'Lv.' + me.lv; $('ptitle').textContent = me.title || ''; $('ptitle').style.display = me.title ? '' : 'none';
  const pct = me.lv >= RULES.maxLv ? 100 : me.exp / me.expNeed * 100; $('expfill').style.width = pct + '%'; $('exptext').textContent = me.lv >= RULES.maxLv ? '满级' : `${Math.floor(me.exp)} / ${me.expNeed}`;
  const g = $('goldnum'); if (g.textContent !== fmt(me.gold)) { g.textContent = fmt(me.gold); $('gold').classList.remove('bump'); void $('gold').offsetWidth; $('gold').classList.add('bump'); }
  drawAvatar($('avatar'), avStyle(me.avatar)); $('avatar').style.boxShadow = `0 0 0 3px ${frameColor(me.frame) || 'var(--wd)'}`;
  $('btn-snd').textContent = PREF.sound ? '🔊' : '🔈';
}
function renderTitle() {
  if (view.key === 'home') $('title').innerHTML = S ? `🌾 ${esc(S.me.name)}的农场` : '🌾 丰收农场';
  else $('title').innerHTML = `🏡 ${esc(view.friend.name)}的农场 <small>Lv.${view.friend.lv}${view.friend.dog ? ' · 🐶看家中' : ''}</small>`;
  $('todbtn').textContent = ({ auto: '🌤️', day: '☀️', dusk: '🌇', night: '🌙' })[PREF.tod] || '🌤️';
}
function renderToolbar() {
  if (!S) { $('toolbar').innerHTML = ''; return; }
  const home = view.key === 'home', tb = $('toolbar'), items = [], b = S.badges;
  const T = (id, ic, tx, extra) => items.push(Object.assign({ id, ic, tx, tool: true }, extra));
  if (home) {
    T('auto', '🖐️', '自动'); items.push({ id: 'seed', ic: `<img src="${cropIcon(S.me.seed)}">`, tx: CROPS[S.me.seed].name });
    T('shovel', '⛏️', '铲除'); T('fert', '🧪', '化肥', { badge: S.inv.fert || 0 });
    items.push({ id: 'allh', ic: '🧺', tx: '一键收获', badge: S.plots.filter(p => p.u && p.c >= 0 && p.p >= 1).length || 0 }, { id: 'allc', ic: '🛠️', tx: '一键护理' }, { id: 'allp', ic: '🌱', tx: '一键种植' });
    items.push({ id: 'wh', ic: '🎒', tx: '仓库' }, { id: 'shop', ic: '🏪', tx: '商店' }, { id: 'task', ic: '📜', tx: '任务', badge: b.tasks + b.newbie, alert: 1 });
  } else {
    T('auto', '🖐️', '自动'); items.push({ id: 'alls', ic: '🥷', tx: '一键摘取', badge: view.plots.filter(p => p.canSteal).length || 0 }, { id: 'allhp', ic: '🤝', tx: '一键帮忙' }, { id: 'gb', ic: '💌', tx: '留言' }, { id: 'wh', ic: '🎒', tx: '仓库' }, { id: 'home', ic: '🏠', tx: '回家' });
  }
  const html = items.map(it => `<button class="tbtn${it.tool && tool === it.id ? ' on' : ''}" data-id="${it.id}"><span class="ic">${it.ic}</span><span class="tx">${it.tx}</span>${it.badge ? `<i class="bd${it.alert ? ' al' : ''}">${it.badge}</i>` : ''}</button>`).join('');
  if (tb._h !== html) { tb._h = html; tb.innerHTML = html; tb.querySelectorAll('.tbtn').forEach(x => x.onclick = () => toolbarClick(x.dataset.id)); }
}
function toolbarClick(id) {
  ac(); sfx('click');
  if (['auto', 'shovel', 'fert'].includes(id)) { tool = id; renderToolbar(); updateCursor(); return; }
  const m = { seed: openSeeds, allh: allHarvest, allc: allCare, allp: allPlant, wh: openWarehouse, shop: () => openShop('item'), task: () => openTasks(), alls: allSteal, allhp: allHelp, home: goHome, gb: () => openGuestbook(view.friend) };
  m[id] && m[id]();
}
// 左侧活动入口
function renderSide() {
  if (!S) return; const b = S.badges;
  const items = [['friends', '👥', '好友', b.requests], ['msg', '📬', '消息', b.unread], ['orders', '📦', '订单'], ['market', '🏷️', '集市'], ['rank', '🏆', '排行'], ['ach', '🏅', '成就', b.ach], ['codex', '📖', '图鉴'], ['dress', '🎨', '装扮']];
  const html = items.map(([id, ic, tx, bd]) => `<button class="sbtn" data-s="${id}"><span>${ic}</span><em>${tx}</em>${bd ? `<i class="bd">${bd}</i>` : ''}</button>`).join('')
    + (S.events.length ? `<button class="sbtn ev" data-s="events"><span>🎉</span><em>活动</em></button>` : '');
  const el = $('side'); if (el._h !== html) { el._h = html; el.innerHTML = html; el.querySelectorAll('.sbtn').forEach(x => x.onclick = () => { ac(); sfx('click'); sideClick(x.dataset.s); }); }
  renderNewbie();
}
function sideClick(s) { ({ friends: () => openFriends(), msg: openMessages, orders: openOrders, market: () => openMarket(), rank: () => openRank(), ach: openAch, codex: openCodex, dress: () => openDress(), events: openEvents })[s](); }
function renderNewbie() {
  const el = $('newbie'); if (!S || !S.badges.newbieLeft) { el.style.display = 'none'; return; }
  const done = CFG.NEWBIE.length - S.badges.newbieLeft; el.style.display = '';
  const html = `<b>🌱 新手任务 ${done}/${CFG.NEWBIE.length}</b><small>${S.badges.newbie ? '有奖励可以领取！' : '点击查看下一步'}</small>${S.badges.newbie ? '<i class="bd al">!</i>' : ''}`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; } el.onclick = () => openTasks('newbie');
}
function renderFriends() {
  const el = $('friends'); if (!S) { el.innerHTML = ''; return; }
  const me = `<div class="fr${view.key === 'home' ? ' on' : ''}" data-id="me"><canvas width="96" height="96"></canvas><span>我家</span></div>`;
  const list = FR.list.map(f => `<div class="fr${view.key === 'f' + f.id ? ' on' : ''}" data-id="${f.id}" title="${esc(f.name)} Lv.${f.lv}"><canvas width="96" height="96"></canvas><span>${esc(f.name)}</span>${f.online ? '<em class="on"></em>' : ''}${f.steal ? `<i class="bd">${f.steal}</i>` : ''}${f.help ? `<i class="bd hp">${f.help}</i>` : ''}</div>`).join('');
  const html = me + list + `<div class="fr add" data-id="add"><div class="plus">＋</div><span>加好友</span>${S.badges.requests ? `<i class="bd">${S.badges.requests}</i>` : ''}</div>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html;
    el.querySelectorAll('.fr').forEach(d => { const id = d.dataset.id, cv = d.querySelector('canvas'); const f = FR.list.find(x => String(x.id) === id);
      if (cv) { drawAvatar(cv, avStyle(id === 'me' ? S.me.avatar : f.avatar)); const fc = frameColor(id === 'me' ? S.me.frame : f.frame); if (fc) cv.style.boxShadow = `0 0 0 3px ${fc}`; }
      d.onclick = () => { ac(); if (id === 'me') goHome(); else if (id === 'add') openFriends(FR.requests.length ? 'req' : 'add'); else visit(f); }; });
  }
}

/* ============ 弹窗基础 ============ */
let modalStack = null;
function openModal(html, opt) {
  opt = opt || {}; const m = $('modal'); m.className = opt.small ? 'small' : opt.wide ? 'wide' : ''; m.innerHTML = (opt.noclose ? '' : '<button class="x" onclick="closeModal()">✕</button>') + html; $('mback').classList.add('show'); $('mback').dataset.noclose = opt.noclose ? '1' : ''; sfx('open'); if (opt.mount) opt.mount(); modalStack = opt.onclose || null;
}
function closeModal(force) { if ($('mback').dataset.noclose === '1' && !force) return; $('mback').classList.remove('show'); $('mback').dataset.noclose = ''; const f = modalStack; modalStack = null; if (f) f(); }
const iconImg = id => `<img class="cimg" src="${cropIcon(id)}">`;
const itemIcon = item => { const c = cropOf(item); if (c) return `<span class="ii${c.golden ? ' gold' : ''}"><img class="cimg" src="${cropIcon(c.id)}"></span>`; return `<span class="ii emo">${item === 'fert' ? '🧪' : item === 'dogfood' ? '🍖' : '📦'}</span>`; };
const avHtml = (av, frame, size) => { const cv = document.createElement('canvas'); cv.width = cv.height = 96; drawAvatar(cv, avStyle(av)); const fc = frameColor(frame); return `<img class="av" src="${cv.toDataURL()}" style="width:${size || 40}px;height:${size || 40}px;${fc ? `box-shadow:0 0 0 3px ${fc}` : ''}">`; };
function levelUp(lv) {
  sfx('level'); const unlocked = CROPS.filter(c => c.lv === lv);
  openModal(`<div class="lvup"><div class="burst">🎉</div><h2>恭喜升级！</h2><div class="biglv">Lv.${lv}</div>
    <p>获得 <b>🪙 ${lv * 120}</b> 金币 和 <b>🧪 化肥 ×1</b></p>
    ${unlocked.length ? `<div class="unl">解锁新作物：${unlocked.map(c => `<span class="chip"><img src="${cropIcon(c.id)}">${c.name}</span>`).join('')}</div>` : ''}
    <button class="btn big" onclick="closeModal()">太棒了</button></div>`, { small: true });
}

/* ============ Canvas 主循环 ============ */
const cv = $('cv'), ctx = cv.getContext('2d'); let W = 0, H = 0, DPR = 1, K = 1, offX = 0, offY = 0, vb = { x0: 0, x1: 1600, y0: 0, y1: 900 }; const bg = document.createElement('canvas'); let bgDirty = true, bgTheme = '';
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  const narrow = W < 700; K = Math.max(0.3, Math.min((H - (narrow ? 190 : 150)) / 650, W / (narrow ? 920 : 1340))); offX = W / 2 - 800 * K + (narrow ? -12 * K : 0); offY = H / 2 - 490 * K - 6 + (narrow ? 10 : 0);
  vb = { x0: -offX / K, x1: (W - offX) / K, y0: -offY / K, y1: (H - offY) / K }; bg.width = cv.width; bg.height = cv.height; bgDirty = true;
}
function rebuildBg() {
  const c = bg.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bg.width, bg.height); c.setTransform(DPR * K, 0, 0, DPR * K, DPR * offX, DPR * offY);
  buildBackground(c, vb, themeOf(view.key === 'home' ? (S ? S.me.theme : 'classic') : view.friend.theme)); bgDirty = false;
}
function curHour() { const m = { day: 12, dusk: 18.6, night: 23 }; if (m[PREF.tod]) return m[PREF.tod]; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
const chickens = [{ x: 175, y: 560, vx: 0, tx: 175, d: 1, pk: 0, w: 140 }, { x: 1300, y: 500, vx: 0, tx: 1300, d: -1, pk: 0, w: 120 }, { x: 1180, y: 730, vx: 0, tx: 1180, d: 1, pk: 0, w: 100 }];
function updateChickens(dt) {
  chickens.forEach((c, i) => { c.pk -= dt; if (c.pk > 0) return; if (Math.abs(c.tx - c.x) < 3) { if (Math.random() < 0.5) { c.pk = 1 + Math.random() * 2; c.tx = c.x; } else { c.tx = clamp(c.x + (Math.random() - 0.5) * 2 * c.w, [120, 1230, 1150][i] - c.w, [120, 1230, 1150][i] + c.w); } } else { const s = 22 * dt; c.x += Math.sign(c.tx - c.x) * s; c.d = Math.sign(c.tx - c.x) || c.d; } });
}
let lastFrame = performance.now(), tAcc = 0, rainK = 0, wasRain = false;
function frame(now) {
  const dt = Math.min(0.06, (now - lastFrame) / 1000); lastFrame = now; tAcc += dt; const t = tAcc;
  if (bgDirty) rebuildBg(); updateFx(dt); updateChickens(dt);
  const raining = !!CFG.rainUntil(NET.now()); if (raining && !wasRain && started) { toast('🌧️ 下雨啦！农田被滋润了～'); sfx('rain'); } wasRain = raining;
  rainK += ((raining ? 1 : 0) - rainK) * Math.min(1, dt * 1.2);
  const h = curHour(), nk = nightK(h);
  ctx.setTransform(DPR * K, 0, 0, DPR * K, DPR * offX, DPR * offY);
  drawSky(ctx, vb, h, rainK); drawCelestial(ctx, vb, h, t); drawClouds(ctx, vb, t, rainK > 0.5, nk); if (nk < 0.5) drawBirds(ctx, vb, t);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.drawImage(bg, 0, 0, W, H); ctx.setTransform(DPR * K, 0, 0, DPR * K, DPR * offX, DPR * offY);
  drawSmoke(ctx, 250 + 44, 340 - 142, t); windmillBlades(ctx, 1240, 330, t, t * (rainK > 0.5 ? 1.3 : 0.55)); pondShimmer(ctx, 215, 667, t);
  drawButterfly(ctx, 600 + Math.sin(t * 0.7) * 160, 430 + Math.sin(t * 1.3) * 40, t, '#ff9ac8'); drawButterfly(ctx, 1000 + Math.cos(t * 0.5) * 140, 600 + Math.sin(t * 0.9) * 50, t + 2, '#ffe066');
  chickens.forEach((c, i) => drawChicken(ctx, c.x, c.y, t + i * 3, c.d, c.pk > 0));
  const nowS = NET.now();
  if (view.key === 'home') { if (S && S.me.dog.own) drawDog(ctx, 1410, 628, t, Date.now() < dogBarkUntil ? 'bark' : S.me.dog.until > nowS ? 'guard' : 'sleep'); }
  else if (view.friend.dog) drawDog(ctx, 1410, 628, t, Date.now() < dogBarkUntil ? 'bark' : 'guard');
  const plots = view.plots, cost = CFG.plotCost(unlockedCount());
  DEPTH_ORDER.forEach(i => { const P = plots[i], pos = plotPos(i); drawPlot(ctx, P, pos.x, pos.y, t, { hover: i === hoverIdx, idx: i, price: view.key === 'home' ? cost : null, stolen: view.key !== 'home' && P.mine }); });
  drawFrontFence(ctx); drawFx(ctx);
  const dusk = (h > 17 && h < 19.8) ? 1 - Math.abs(h - 18.4) / 1.4 : 0, dawn = (h > 5 && h < 7.5) ? 1 - Math.abs(h - 6.2) / 1.3 : 0;
  if (nk > 0) { ctx.fillStyle = `rgba(14,24,76,${0.46 * nk})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); }
  if (dusk > 0) { ctx.fillStyle = `rgba(255,140,60,${0.16 * dusk})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); }
  if (dawn > 0) { ctx.fillStyle = `rgba(255,170,130,${0.12 * dawn})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); }
  if (rainK > 0.01) { ctx.fillStyle = `rgba(40,60,90,${0.22 * rainK})`; ctx.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, vb.y1 - vb.y0); ctx.globalAlpha = rainK; drawRain(ctx, vb, t); ctx.globalAlpha = 1; }
  if (nk > 0.3) drawFireflies(ctx, vb, t, nk);
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
// 拖动连续操作：请求按顺序排队发送
const paintQ = []; let paintRunning = false;
async function runPaint() { if (paintRunning) return; paintRunning = true; while (paintQ.length) { await clickPlot(paintQ.shift()); } paintRunning = false; }
function paintAt(ev, first) {
  if (!S) return; const w = toWorld(ev), i = pickPlot(w.x, w.y); if (i < 0 || (!first && i === lastPaint)) return; lastPaint = i; ac(); startMusic();
  if (first) { paintQ.push(i); runPaint(); } else if (view.key === 'home' && view.plots[i].u && !paintQ.includes(i)) { paintQ.push(i); runPaint(); }
}
cv.addEventListener('pointerdown', ev => { if (ev.button !== 0 && ev.pointerType === 'mouse') return; painting = true; lastPaint = -1; mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = ev.pointerType === 'mouse'; const w = toWorld(ev); hoverIdx = pickPlot(w.x, w.y); paintAt(ev, true); try { cv.setPointerCapture(ev.pointerId); } catch (e) { } });
cv.addEventListener('pointermove', ev => { mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = true; const w = toWorld(ev); hoverIdx = pickPlot(w.x, w.y); if (painting) paintAt(ev, false); updateCursor(); });
cv.addEventListener('pointerup', ev => { painting = false; lastPaint = -1; if (ev.pointerType !== 'mouse') { setTimeout(() => { mouse.in = false; hoverIdx = -1; updateCursor(); }, 1400); } }); cv.addEventListener('pointercancel', () => { painting = false; });
cv.addEventListener('pointerleave', () => { mouse.in = false; hoverIdx = -1; updateCursor(); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); tool = 'auto'; renderToolbar(); updateCursor(); });
function updateCursor() {
  const el = $('curtool'); let h = ''; const i = hoverIdx, plots = view.plots;
  if (S && mouse.in && i >= 0 && view.key === 'home') {
    const P = plots[i];
    if (tool === 'shovel') h = '⛏️'; else if (tool === 'fert') h = '🧪'; else if (tool === 'red') h = '🟥';
    else if (P.u && P.c < 0) h = `<img src="${cropIcon(S.me.seed)}">`; else if (P.u && P.c >= 0 && P.p >= 1) h = '🧺'; else if (P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b)) h = P.pr.d ? '💧' : P.pr.w ? '🌿' : '🐛';
  } else if (mouse.in && i >= 0 && view.key !== 'home') { const P = plots[i]; if (P.u && P.c >= 0 && P.canSteal) h = '🥷'; else if (P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b)) h = '🤝'; }
  if (el._h !== h) { el._h = h; el.innerHTML = h; } el.style.display = h ? 'block' : 'none'; el.style.transform = `translate(${mouse.x + 14}px,${mouse.y + 12}px)`;
  cv.style.cursor = (h || i >= 0) ? 'pointer' : 'default';
}
function updateTip() {
  const tip = $('tip'); if (!S || !mouse.in || hoverIdx < 0 || painting) { tip.style.display = 'none'; return; }
  const P = view.plots[hoverIdx], home = view.key === 'home'; let h = '';
  if (!P.u) h = home ? `<b>🌾 荒地</b><div>开垦需要 🪙${fmt(CFG.plotCost(unlockedCount()))}（Lv.${CFG.plotNeedLv(unlockedCount())}）</div>` : '<b>🌾 荒地</b>';
  else if (P.c < 0) h = `<b>空地${P.soil ? '（红土地）' : ''}</b>${home ? `<div>点击种植 ${CROPS[S.me.seed].name}（🪙${CROPS[S.me.seed].seed}）</div>` : ''}`;
  else {
    const cr = CROPS[P.c], st = stageOf(P.p), pr = [P.pr.d && '💧缺水', P.pr.w && '🌿杂草', P.pr.b && '🐛害虫'].filter(Boolean);
    h = `<b>${cr.name}${P.soil ? '（红土地）' : ''}</b><div>${STAGE_NAME[st]}${cr.seasons > 1 ? ` · 第${P.sea + 1}季` : ''}</div>`;
    if (st === 4) {
      h += `<div>剩余 ×${P.y}${P.stolen ? `（被摘走 ${P.stolen}）` : ''}</div>`;
      if (!home) { const now = NET.now(); h += P.mine === 1 ? '<div class="warn">你已经摘过了</div>' : P.mine === 2 ? '<div class="warn">被狗赶走过，下季再来</div>' : P.left <= 0 ? '<div class="warn">已达保底，不能再摘</div>' : now < P.protectUntil ? `<div class="warn">主人保护中 ${Math.ceil((P.protectUntil - now) / 1000)} 秒</div>` : `<div class="ok">🥷 可以摘取（最多还能被摘 ${P.left}）</div>`; }
    } else h += `<div>成熟还需 ${fmtTime(CFG.remainSec(P))}</div><div class="bar"><i style="width:${Math.floor(P.p * 100)}%"></i></div>`;
    if (pr.length) h += `<div class="warn">${pr.join(' ')}${home ? '' : ' · 点击帮忙'}</div>`;
  }
  if (tip._h !== h) { tip._h = h; tip.innerHTML = h; } tip.style.display = 'block';
  const x = Math.min(window.innerWidth - 200, mouse.x + 18), y = Math.max(8, mouse.y - 90); tip.style.transform = `translate(${x}px,${y}px)`;
}

/* ============ 启动 ============ */
async function savePref(patch) { Object.assign(PREF, patch); try { localStorage.setItem('hf_pref', JSON.stringify(PREF)); } catch (e) { } if (S) await api('/api/me/profile', { settings: PREF }, { quiet: true }); }
async function enterGame(state, fresh) {
  applyState(state); started = true; closeModal(true); $('loading').style.display = 'none';
  view = { key: 'home', friend: null, plots: S.plots, farm: null }; bgDirty = true; renderTitle();
  await loadFriends(); loadMessages(false);
  const inv = new URLSearchParams(location.search).get('invite');
  if (inv) { history.replaceState(null, '', location.pathname); const r = await api('/api/invite/accept', { code: inv }, { quiet: true }); if (r && r.friend) { toast(r.added ? `🎉 你和 ${r.friend.name} 成为了好友！` : `你和 ${r.friend.name} 已经是好友了`); await loadFriends(); refreshState(); } else if (r && r.self) toast('这是你自己的邀请链接，发给朋友吧～'); else if (!r) toast('邀请链接无效', 'warn'); }
  checkMigrate(fresh);
  try { NET.post('/api/telemetry', { loadMs: Math.round(performance.now()) }).catch(() => { }); } catch (e) { }
  if (window.innerWidth < 600 && window.innerHeight > window.innerWidth) setTimeout(() => toast('📱 横屏体验更好哦'), 1500);
}
function checkMigrate(fresh) {
  let old = null; try { old = JSON.parse(localStorage.getItem('harvest_farm_save_v1') || 'null'); } catch (e) { }
  let dismissed = false; try { dismissed = localStorage.getItem('hf_migrate_done') === '1'; } catch (e) { }
  if (old && !S.me.migrated && !dismissed) return openMigrate(old);
  if (fresh || !PREF.tut) welcome();
}
async function boot() {
  resize(); window.addEventListener('resize', resize); requestAnimationFrame(frame);
  try { PREF = Object.assign(PREF, JSON.parse(localStorage.getItem('hf_pref') || '{}')); } catch (e) { }
  NET.onAuthLost(() => { if (started) { started = false; S = null; view = { key: 'home', friend: null, plots: blankPlots(), farm: null }; renderToolbar(); renderFriends(); toast('登录已失效，请重新登录', 'warn'); showLogin(); } });
  NET.onOnline(() => { if (started) { refreshState(); loadFriends(); } });
  // 拉取服务器的有效配置（运营后台可能改过作物数值）
  for (let i = 0; i < 3; i++) {
    try { const c = await NET.get('/api/config'); c.CROPS.forEach((x, k) => { if (CROPS[k]) ['seed', 'time', 'yield', 'price', 'exp', 'lv'].forEach(f => CROPS[k][f] = x[f]); }); Object.assign(RULES, c.RULES); CFG.setTz(c.TZ_MIN); break; }
    catch (e) { $('loading').querySelector('p').textContent = '正在连接服务器…（' + (i + 1) + '）'; await new Promise(r => setTimeout(r, 1500)); }
  }
  if (!NET.online) { $('loading').querySelector('p').innerHTML = '连接不上服务器，请检查网络后 <a href="javascript:location.reload()">刷新重试</a>'; return; }
  if (NET.token) { try { const st = await NET.get('/api/state'); return enterGame(st, false); } catch (e) { if (e.code === 'network') { $('loading').querySelector('p').innerHTML = '网络异常，<a href="javascript:location.reload()">点此重试</a>'; return; } } }
  $('loading').style.display = 'none'; showLogin();
}
function bindGlobal() {
  $('mback').addEventListener('pointerdown', e => { if (e.target === $('mback')) closeModal(); });
  $('btn-help').onclick = () => { ac(); openHelp(); }; $('btn-menu').onclick = () => { ac(); openMenu(); };
  $('btn-snd').onclick = () => { ac(); savePref({ sound: !PREF.sound }); renderHud(); if (PREF.sound) { startMusic(); sfx('click'); } };
  $('todbtn').onclick = () => { const o = ['auto', 'day', 'dusk', 'night']; savePref({ tod: o[(o.indexOf(PREF.tod) + 1) % 4] }); renderTitle(); sfx('click'); };
  $('card').onclick = () => { if (S) openProfile(); };
  $('log').onclick = () => openMessages();
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return; const k = e.key.toLowerCase();
    if (k === 'escape') { closeModal(); tool = 'auto'; renderToolbar(); updateCursor(); }
    else if ($('mback').classList.contains('show') || !S) return;
    else if (k === '1') toolbarClick('auto'); else if (k === '2' && view.key === 'home') toolbarClick('shovel'); else if (k === '3' && view.key === 'home') toolbarClick('fert');
    else if (k === 'q') (view.key === 'home' ? allHarvest : allSteal)(); else if (k === 'w') (view.key === 'home' ? allCare : allHelp)(); else if (k === 'e' && view.key === 'home') allPlant(); else if (k === 'h') goHome();
  });
  document.addEventListener('pointerdown', () => { ac(); startMusic(); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) { refreshState(); loadFriends(); if (view.key !== 'home') visitRefresh(); } });
  setInterval(() => { if (started) tickView(); }, 500);
  setInterval(() => { if (started && !document.hidden) refreshState(); }, 15000);
  setInterval(() => { if (started && !document.hidden) loadFriends(); }, 30000);
  setInterval(() => { if (started && document.hidden && PREF.notify) refreshState(); }, 60000);
  setInterval(() => { if (started && !document.hidden && view.key !== 'home') visitRefresh(); }, 10000);
  setInterval(() => { if (started && !document.hidden) renderLog(); }, 30000);
}
async function visitRefresh() { if (view.key === 'home') return; const key = view.key; try { const r = await NET.get('/api/farm/' + view.friend.id); if (view.key === key) applyFarm(r.farm); } catch (e) { if (e.status === 403) { toast('你们已经不是好友了', 'warn'); goHome(); } } }
window.addEventListener('DOMContentLoaded', () => { bindGlobal(); boot(); });
