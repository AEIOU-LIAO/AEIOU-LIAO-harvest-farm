'use strict';
/* =====================================================
   丰收农场 · 客户端（联网版 · 3D）
   服务器是金币、作物、偷菜结果的唯一权威；客户端只负责展示与请求。
   ===================================================== */
const $ = id => document.getElementById(id);
const CFG = GAMECFG, RULES = CFG.RULES, CROPS = CFG.CROPS;
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(1) + '亿' : n >= 1e4 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + '万' : String(Math.floor(n));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); if (s < 60) return s + '秒'; const m = Math.floor(s / 60), r = s % 60; if (m < 60) return m + '分' + (r ? r + '秒' : ''); const h = Math.floor(m / 60); return h + '小时' + (m % 60 ? (m % 60) + '分' : ''); }
function ago(t) { const s = (NET.now() - t) / 1000; if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + '分钟前'; if (s < 86400) return Math.floor(s / 3600) + '小时前'; return Math.floor(s / 86400) + '天前'; }
const cropOf = item => { const m = /^([cg])(\d+)$/.exec(item || ''); return m && CROPS[+m[2]] ? { golden: m[1] === 'g', id: +m[2] } : null; };
const itemName = item => { const ri = CFG.ranchItem(item); if (ri) return ri.name; const si = CFG.SHOP_ITEMS.find(x => x.id === item); if (si) return si.name; const c = cropOf(item); return c ? (c.golden ? '金色' : '') + CROPS[c.id].name : item; };
const unitPrice = item => { const ri = CFG.ranchItem(item); if (ri) return ri.price; const c = cropOf(item); if (!c) return 0; const b = (S && S.bonus || {})[c.id] || 0; let m = 1; (S && S.events || []).forEach(e => { if (e.kind === 'price_mult' && (e.params.crop == null || +e.params.crop === c.id)) m *= e.params.mult; }); return Math.round(CROPS[c.id].price * (1 + b) * (c.golden ? RULES.goldenPriceMult : 1) * m); };
const stageOf = CFG.stageOf, STAGE_NAME = CFG.STAGE_NAME;
const cropIcon = (id, golden) => W3.cropIcon(id, golden);

/* ============ 状态 ============ */
let S = null;                 // 服务器快照：me / plots / inv / badges / rain / bonus / events
let FR = { list: [], requests: [], sent: [], visitors: [] }; // 好友
let NB = { list: [] };        // 附近的人
let MSGS = [];
let PREF = { sound: true, music: true, notify: false, tod: 'auto', tut: 0, mvol: 70, svol: 80, pan: 0, v3char: false, v3hero: '', sea: 'auto', wfx: true };
let view = { key: 'home', friend: null, plots: [], farm: null };
let redTo = 0, tool = 'auto', hoverIdx = -1, painting = false, lastPaint = -1, mouse = { x: 0, y: 0, in: false };
let started = false, dogBarkUntil = 0, sideTab = 'nearby';
const busy = new Set();
const blankPlots = () => { const a = []; for (let i = 0; i < CFG.NPLOTS; i++) a.push({ idx: i, u: CFG.UNLOCK_ORDER.indexOf(i) < RULES.startPlots ? 1 : 0, soil: 0, c: -1, p: 0, t: 0, sea: 0, y: 0, pr: { d: 0, w: 0, b: 0 } }); return a; };
view.plots = blankPlots();

const AVO = CFG.AVATAR_OPTS;
function avStyle(av) { av = av || {}; const bg = AVO.bg[av.bg || 0] || AVO.bg[0]; const hat = av.hat === undefined ? 1 : av.hat; return { skin: AVO.skin[av.skin || 0], hair: hat ? undefined : AVO.hair[av.hair || 0], hat, fringe: hat ? 0 : (av.fringe === undefined ? 1 : av.fringe), pig: !hat && av.pig, band: AVO.band[av.band || 0], shirt: AVO.shirt[av.shirt || 0], bg1: bg[0], bg2: bg[1] }; }
const frameColor = id => (CFG.FRAMES.find(f => f.id === id) || {}).color || '';
const themeOf = id => (CFG.THEMES.find(t => t.id === id) || CFG.THEMES[0]).th;
const unlockedCount = () => S ? S.plots.filter(p => p.u && p.idx < CFG.NPLOTS).length : RULES.startPlots;
const isFriend = id => FR.list.some(f => f.id === id);

/* ============ 声音（v3.3）============
   - 背景音乐和操作音效是两个独立开关，各有音量（PREF.music / PREF.sound，PREF.mvol / PREF.svol 0~100）
   - 背景音乐是原创的乡村小调，用 Web Audio 现场合成：低音“嘣-恰”、拨弦和弦、口哨主旋律、沙锤，还有小鸟叫。不用外部音频文件，没有版权问题
   - iPhone：静音拨片打开时网页声音会被系统静掉，所以在第一次点击时把音频会话切到「播放」类型，并在后台循环一段无声音频；微信内置浏览器同样处理 */
let AC = null, master = null, sfxBus = null, musBus = null, musicTimer = null;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const vol01 = v => Math.max(0, Math.min(100, v === undefined ? 75 : +v)) / 100;
function applyVol() { if (!AC) return; const t = AC.currentTime; sfxBus.gain.setTargetAtTime(PREF.sound ? 0.9 * vol01(PREF.svol) : 0, t, 0.03); musBus.gain.setTargetAtTime(PREF.music ? 0.75 * vol01(PREF.mvol) : 0, t, 0.25); }
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master = AC.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(AC.destination); sfxBus = AC.createGain(); musBus = AC.createGain(); sfxBus.connect(master); musBus.connect(master); sfxBus.gain.value = 0; musBus.gain.value = 0; applyVol(); } catch (e) { AC = null; } }
  if (AC && AC.state !== 'running') { try { AC.resume(); } catch (e) { } } return AC;
}
let silentEl = null;
function unlockAudio() {
  const a = ac(); if (!a) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
  try { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch (e) { }
  if (IOS && !silentEl && (PREF.sound || PREF.music)) { try { const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf), w = (o, t) => { for (let k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); for (let k = 0; k < n; k++) v.setUint8(44 + k, 128);
    silentEl = document.createElement('audio'); silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('x-webkit-airplay', 'deny'); silentEl.loop = true; silentEl.preload = 'auto'; silentEl.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); silentEl.play().catch(() => { silentEl = null; }); } catch (e) { silentEl = null; } }
  startMusic();
}
['pointerup', 'touchend', 'click', 'keydown'].forEach(n => document.addEventListener(n, () => { if (!AC || AC.state !== 'running' || (IOS && !silentEl && (PREF.sound || PREF.music))) unlockAudio(); }, { passive: true, capture: true }));
document.addEventListener('WeixinJSBridgeReady', () => { try { ac(); } catch (e) { } }, false);
document.addEventListener('visibilitychange', () => { if (!document.hidden && AC && AC.state !== 'running') { try { AC.resume(); } catch (e) { } } });
function tone(f, d, type, vol, delay, slide) {
  if (!PREF.sound) return; const a = ac(); if (!a) return;
  const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + d + 0.05);
}
function noise(d, vol, f0, f1) {
  if (!PREF.sound) return; const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(); s.buffer = buf; const fl = a.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(f0, a.currentTime); fl.frequency.exponentialRampToValueAtTime(f1, a.currentTime + d);
  const g = a.createGain(); g.gain.value = vol; s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start();
}
const SFX = {
  click: () => tone(660, 0.06, 'triangle', 0.06),
  plant: () => { tone(180, 0.12, 'sine', 0.14, 0, 90); tone(360, 0.1, 'triangle', 0.05, 0.04); },
  harvest: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.08, i * 0.055)); },
  coin: () => { tone(1318, 0.09, 'square', 0.035); tone(1760, 0.16, 'square', 0.035, 0.07); },
  water: () => { noise(0.45, 0.22, 2400, 700); tone(520, 0.2, 'sine', 0.03, 0.05, 300); },
  weed: () => { noise(0.18, 0.28, 900, 300); },
  bug: () => { tone(900, 0.08, 'square', 0.04, 0, 200); noise(0.1, 0.2, 1500, 500); },
  fert: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'sine', 0.07, i * 0.07)); noise(0.3, 0.1, 4000, 1500); },
  err: () => { tone(200, 0.18, 'sawtooth', 0.05, 0, 140); },
  level: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.09, i * 0.1)); },
  steal: () => { tone(300, 0.1, 'triangle', 0.07, 0, 600); tone(500, 0.12, 'triangle', 0.05, 0.08); },
  bark: () => { tone(420, 0.1, 'sawtooth', 0.08, 0, 220); tone(380, 0.12, 'sawtooth', 0.08, 0.16, 200); },
  rain: () => { noise(1.4, 0.12, 5000, 2500); },
  open: () => { tone(520, 0.08, 'triangle', 0.05); tone(780, 0.1, 'triangle', 0.05, 0.05); },
  golden: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.07)); },
  on: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, i * 0.08)); },
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { } }

/* ---- 背景音乐：《丰收小调》（原创），C 大调，116 拍/分，32 小节循环（A A' B A），约 66 秒 ---- */
const MUS = (() => {
  const CH = { C: [60, 64, 67], F: [60, 65, 69], G: [59, 62, 67], Am: [60, 64, 69] }, ROOT = { C: 48, F: 41, G: 43, Am: 45 };
  const A = ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'], B = ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'C'];
  const mA = [[76, 2], [79, 1], [76, 1], [72, 2], [74, 1], [76, 1], [77, 2], [81, 1], [77, 1], [72, 2], [0, 1], [72, 1], [74, 1], [76, 1], [77, 1], [79, 1], [81, 1], [79, 1], [77, 1], [74, 1], [76, 3], [72, 1], [67, 4],
    [69, 1], [72, 1], [76, 2], [81, 2], [79, 1], [76, 1], [77, 2], [76, 1], [74, 1], [72, 2], [69, 2], [71, 1], [74, 1], [79, 2], [77, 1], [74, 1], [71, 2], [72, 4], [0, 2], [67, 1], [71, 1]];
  const mB = [[84, 2], [81, 2], [77, 2], [81, 2], [79, 2], [76, 1], [79, 1], [84, 4], [83, 1], [81, 1], [79, 2], [74, 2], [79, 2], [81, 3], [79, 1], [76, 4],
    [77, 1], [79, 1], [81, 2], [84, 2], [81, 2], [79, 2], [76, 2], [72, 2], [76, 2], [74, 1], [76, 1], [77, 1], [74, 1], [71, 2], [74, 2], [72, 6], [0, 2]];
  const sec = [[A, mA, 'whistle'], [A, mA, 'marimba'], [B, mB, 'whistle'], [A, mA, 'whistle']], chords = [], mel = [];
  sec.forEach(([cs, m, v], si) => { const b0 = si * 64; cs.forEach((c, k) => chords[si * 8 + k] = c); let p = 0; m.forEach(([n, d]) => { if (n) mel.push({ at: b0 + p, n, d, v }); p += d; }); });
  return { chords, mel, len: 256, step: 60 / 116 / 2 };
})();
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
let musPos = 0, musNext = 0, musEcho = null, noiseBuf = null;
function musVoice(a, f, t, d, kind, vol) {
  const o = a.createOscillator(), g = a.createGain(); let out = g;
  if (kind === 'whistle') { o.type = 'sine'; const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 0.3);
    o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + Math.max(0.04, d - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12); }
  else if (kind === 'marimba') { o.type = 'sine'; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 1.3, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); const o2 = a.createOscillator(), g2 = a.createGain(); o2.frequency.value = f * 4; g2.gain.setValueAtTime(vol * 0.35, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o2.connect(g2); g2.connect(musBus); o2.start(t); o2.stop(t + 0.1); d = 0.5; }
  else if (kind === 'pluck') { o.type = 'triangle'; const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(700, t + 0.25); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); o.connect(fl); fl.connect(g); g.connect(musBus); o.frequency.value = f; o.start(t); o.stop(t + 0.36); return; }
  else { o.type = 'triangle'; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); }
  if (kind !== 'whistle') o.frequency.value = f;
  o.connect(g); g.connect(musBus); if ((kind === 'whistle' || kind === 'marimba') && musEcho) g.connect(musEcho); o.start(t); o.stop(t + d + 0.2);
}
function musPerc(a, t, kind) {
  if (!noiseBuf) { const n = a.sampleRate * 0.2; noiseBuf = a.createBuffer(1, n, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; }
  if (kind === 'kick') { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.18); return; }
  const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf; fl.type = 'highpass'; fl.frequency.value = kind === 'clap' ? 1500 : 6500; const v = kind === 'clap' ? 0.06 : kind === 'shk2' ? 0.035 : 0.018, d = kind === 'clap' ? 0.09 : 0.05;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(g); g.connect(musBus); s.start(t); s.stop(t + d + 0.01);
}
function musBird(a, t) { [0, 0.13].forEach(k => { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(2900, t + k); o.frequency.exponentialRampToValueAtTime(4200, t + k + 0.07); g.gain.setValueAtTime(0.0001, t + k); g.gain.exponentialRampToValueAtTime(0.03, t + k + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.09); o.connect(g); g.connect(musBus); o.start(t + k); o.stop(t + k + 0.1); }); }
function musStep(a, i, t) {
  const bar = i >> 3, e = i & 7, c = MUS.chords[bar], ch = MUS.step;
  if (e === 0 || e === 4) { musVoice(a, mtof(MUS_ROOT(c) + (e === 4 ? 7 : 0)), t, ch * 1.7, 'bass', 0.2); musPerc(a, t, 'kick'); }
  if (e === 2 || e === 6) { CH_OF(c).forEach((n, k) => musVoice(a, mtof(n), t + k * 0.012, 0, 'pluck', 0.05)); musPerc(a, t, 'clap'); }
  if (e === 3 || e === 7) CH_OF(c).forEach((n, k) => musVoice(a, mtof(n + 12), t + k * 0.01, 0, 'pluck', 0.025));
  musPerc(a, t, e % 2 ? 'shk2' : 'shk');
  MUS.mel.forEach(m => { if (m.at === i) musVoice(a, mtof(m.n), t, m.d * ch * 0.92, m.v, m.v === 'whistle' ? 0.075 : 0.09); });
  if ((i % 64 === 60 || i % 64 === 30) && Math.random() < 0.7) musBird(a, t + ch * 0.5);
}
const CH_OF = c => ({ C: [60, 64, 67], F: [60, 65, 69], G: [59, 62, 67], Am: [60, 64, 69] })[c], MUS_ROOT = c => ({ C: 48, F: 41, G: 43, Am: 45 })[c];
function startMusic() {
  if (musicTimer || !PREF.music) return; const a = ac(); if (!a) return; applyVol();
  if (!musEcho) { const dl = a.createDelay(1), fb = a.createGain(), wet = a.createGain(); dl.delayTime.value = MUS.step * 3; fb.gain.value = 0.22; wet.gain.value = 0.16; dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musBus); musEcho = dl; }
  musNext = a.currentTime + 0.15;
  musicTimer = setInterval(() => { if (!PREF.music) { stopMusic(); return; } if (document.hidden || a.state !== 'running') { musNext = a.currentTime + 0.15; return; }
    if (musNext < a.currentTime - 0.3) musNext = a.currentTime + 0.05; while (musNext < a.currentTime + 0.25) { musStep(a, musPos, musNext); musPos = (musPos + 1) % MUS.len; musNext += MUS.step; } }, 60);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; applyVol(); }
/* 声音状态改变：立刻听到 / 看到反馈 */
function setSound(patch, quiet) {
  const was = { m: PREF.music, s: PREF.sound }; savePref(patch); ac(); applyVol(); renderHud(); renderSndPop();
  if (patch.music !== undefined && patch.music !== was.m) { if (PREF.music) { startMusic(); if (!quiet) toast('背景音乐已开启'); } else { stopMusic(); if (!quiet) toast('背景音乐已关闭'); } }
  if (patch.sound !== undefined && patch.sound !== was.s) { if (PREF.sound) { sfx('on'); if (!quiet) toast('操作音效已开启'); } else if (!quiet) toast('操作音效已关闭'); }
}
function sndState() { return PREF.music && PREF.sound ? 'on' : PREF.music || PREF.sound ? 'half' : 'off'; }
function renderSndPop() {
  const el = $('sndpop'); if (!el || !el.classList.contains('show')) return;
  const sw = (id, on) => `<button class="sw${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}"><i></i><span>${on ? '开' : '关'}</span></button>`;
  el.innerHTML = `<div class="sp-h">${ICON(sndState() === 'off' ? 'mute' : 'sound')}<b>${({ on: '声音已开启', half: PREF.music ? '只开了背景音乐' : '只开了操作音效', off: '声音已关闭' })[sndState()]}</b></div>
    <div class="sp-r"><span>${ICON('music')}背景音乐</span>${sw('sp-m', PREF.music)}</div><input type="range" min="0" max="100" step="5" id="sp-mv" value="${PREF.mvol === undefined ? 70 : PREF.mvol}" ${PREF.music ? '' : 'disabled'} aria-label="背景音乐音量">
    <div class="sp-r"><span>${ICON('sound')}操作音效</span>${sw('sp-s', PREF.sound)}</div><input type="range" min="0" max="100" step="5" id="sp-sv" value="${PREF.svol === undefined ? 80 : PREF.svol}" ${PREF.sound ? '' : 'disabled'} aria-label="操作音效音量">
    <div class="sp-b"><button class="btn sm" id="sp-all">${sndState() === 'off' ? '全部打开' : '全部静音'}</button></div>`;
  $('sp-m').onclick = () => setSound({ music: !PREF.music }); $('sp-s').onclick = () => setSound({ sound: !PREF.sound });
  $('sp-all').onclick = () => { const on = sndState() === 'off'; setSound({ music: on, sound: on }, true); toast(on ? '声音已开启' : '声音已关闭'); };
  let vt = 0; const vol = (id, k) => { const r = $(id); r.oninput = () => { PREF[k] = Math.round(+r.value); applyVol(); }; r.onchange = () => { clearTimeout(vt); vt = setTimeout(() => savePref({ [k]: PREF[k] }), 300); if (k === 'svol') sfx('click'); }; }; vol('sp-mv', 'mvol'); vol('sp-sv', 'svol');
}
function toggleSndPop(force) {
  let el = $('sndpop'); if (!el) { el = document.createElement('div'); el.id = 'sndpop'; document.body.appendChild(el); document.addEventListener('pointerdown', e => { if (el.classList.contains('show') && !el.contains(e.target) && !$('btn-snd').contains(e.target)) el.classList.remove('show'); }); }
  const show = force === undefined ? !el.classList.contains('show') : force; el.classList.toggle('show', show); if (show) { const r = $('btn-snd').getBoundingClientRect(); el.style.top = Math.round(r.bottom + 8) + 'px'; el.style.right = Math.max(8, Math.round(window.innerWidth - r.right - 8)) + 'px'; renderSndPop(); }
}

/* ============ 提示 ============ */
/* act = { label, fn }：提示条上带一个按钮（比如「去看看」），停留更久，玩家自己决定点不点 */
function toast(msg, kind, act) {
  const d = document.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : '') + (act ? ' act' : ''); d.textContent = msg; $('toasts').appendChild(d);
  if (act) { const b = document.createElement('button'); b.textContent = act.label; b.onclick = e => { e.stopPropagation(); d.remove(); act.fn(); }; d.appendChild(b); }
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => d.remove(), act ? 5600 : 2800);
}
const FX = W3.fx;

/* ============ 接口调用 ============ */
let modalBusy = 0;
async function api(path, body, opt) {
  opt = opt || {};
  // 弹窗里的按钮：请求进行中锁住整个弹窗，快速连点不会重复购买、重复扣钱
  const inModal = $('mback').classList.contains('show') && !opt.free; if (inModal) { if (modalBusy) return null; modalBusy++; $('modal').classList.add('busy'); }
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
    if (e.status === 409 && !opt.noRefresh) poll(false);
    return null;
  } finally { if (inModal) { modalBusy = Math.max(0, modalBusy - 1); $('modal').classList.remove('busy'); } }
}
async function refreshState() { try { const r = await NET.get('/api/state'); applyState(r); } catch (e) { } }
function applyState(st) {
  if (st && st.me && W3.ready) W3.setHero((() => { const a = st.me.avatar || {}, A = CFG.AVATAR_OPTS; return { skin: A.skin[a.skin | 0], hair: A.hair[a.hair | 0], shirt: A.shirt[a.shirt | 0], band: A.band[a.band | 0], hat: a.hat ? 1 : 0 }; })());
  const prevUnread = S ? S.badges.unread : 0;
  S = st; PREF = Object.assign({ sound: true, music: true, notify: false, tod: 'auto', tut: 0, mvol: 70, svol: 80, pan: 0, v3char: false, v3hero: '', sea: 'auto', wfx: true }, S.me.settings || {}); applyVol(); if (!PREF.music) stopMusic(); applyNewChar();
  if (view.key === 'home') view.plots = S.plots;
  renderHud(); renderToolbar(); renderTitle(); renderSide();
  if (S.badges.unread > prevUnread) { loadMessages(true); loadFriends(); }
}
function applyFarm(farm) { view.farm = farm; view.friend = farm.owner; view.plots = farm.plots; renderTitle(); renderToolbar(); syncSide(farm); }
// 侧栏头像上的数字（可摘 / 要帮忙）：拿到某人农场的最新状态就立刻同步，不等定时刷新
function syncSide(farm) { if (!farm || !farm.owner) return; const id = farm.owner.id; [FR.list, NB.list].forEach(l => { const f = l.find(x => x.id === id); if (f) { f.steal = farm.steal; f.help = farm.help; f.soon = farm.soon; } }); renderFriends(); }
async function loadMessages(notifyNew) {
  try {
    const r = await NET.get('/api/messages'); const old = new Set(MSGS.map(m => m.id + ':' + m.at)); MSGS = r.list; renderLog();
    if (notifyNew) MSGS.filter(m => !m.read && !old.has(m.id + ':' + m.at)).slice(0, 2).forEach(m => {
      if (!['stolen', 'dog', 'market_sold', 'friend_ok', 'helped', 'gb'].includes(m.kind)) return;
      toast(stripTags(msgText(m)), m.kind === 'stolen' ? 'warn' : ''); if (m.kind === 'stolen') sfx('steal'); if (m.kind === 'dog') { dogBarkUntil = Date.now() + 2500; sfx('bark'); } sysNotify(stripTags(msgText(m)));
    });
  } catch (e) { }
}
async function loadFriends() { try { FR = await NET.get('/api/friends'); renderFriends(); } catch (e) { } }
async function loadNeighbors() { try { NB = await NET.get('/api/neighbors'); renderFriends(); } catch (e) { } }
const stripTags = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* ============ 消息文字 ============ */
function msgText(m) {
  const n = `<b>${esc(m.name)}</b>`, d = m.data || {}, I = k => ICON(k, 'mi');
  const items = d.items ? Object.entries(d.items).map(([k, v]) => `${v} 个${itemName(k)}`).join('、') : '';
  switch (m.kind) {
    case 'stolen': return `${I('mask')}${n} 摘走了你的 ${items || (d.qty || '') + ' 个果实'}${d.n > 1 ? `（${d.n} 次）` : ''}`;
    case 'helped': return `${I('hands')}${n} 帮你打理了农田${d.n > 1 ? ` ×${d.n}` : ''}`;
    case 'dog': return `${I('paw')}你家的${d.dogs && d.dogs.length ? d.dogs.join('和') : '狗'}赶走了来偷菜的 ${n}${d.n > 1 ? ` ×${d.n}` : ''}`;
    case 'visit': return `${I('home')}${n} 来你的农场逛了逛`;
    case 'friend_ok': return `${I('users')}你和 ${n} 成为了好友`;
    case 'gb': return `${I('mail')}${n} 留言：${esc(CFG.PHRASES[d.phrase] || '').replace(/^\S+\s/, '')}`;
    case 'market_sold': return `${I('tag')}${n} 买走了你的 ${d.qty} 个${itemName(d.item)}，收入 ${fmt(d.gold)} 金币`;
    case 'market_expired': return `${I('clock')}集市挂单 ${d.qty} 个${itemName(d.item)} 已过期，已退回仓库`;
    default: return esc(m.kind);
  }
}
function renderLog() {
  const el = $('log'); const l = MSGS.slice(0, 4);
  el.innerHTML = l.map(m => `<div${m.read ? '' : ' class="new"'}>${msgText(m)} <small>${ago(m.at)}</small></div>`).join('') + (S && S.badges.unread ? `<div class="more">${S.badges.unread} 条新消息 · 点击查看</div>` : '');
  el.classList.toggle('empty', !l.length);
}

/* ============ 本地插值 ============ */
function tickView() {
  const now = NET.now();
  view.plots.forEach((P, i) => {
    if (!P.u || P.c < 0) return; const was = P.p;
    CFG.advancePlot(P, now);
    if (was < 1 && P.p >= 1) { FX.stars(i, 10); if (view.key === 'home') ripeNotify(P); }
    if (view.key !== 'home') { P.canSteal = P.p >= 1 && !P.mine && P.left > 0 && now >= (P.ra || 0) + RULES.stealDelaySec * 1000; P.protectUntil = P.p >= 1 ? (P.ra || 0) + RULES.stealDelaySec * 1000 : 0; }
  });
}
const notified = new Set();
function ripeNotify(P) { const k = P.idx + ':' + Math.round(P.ra / 1000); if (notified.has(k)) return; notified.add(k); if (document.hidden) sysNotify(`${CROPS[P.c].name} 成熟了，快去收获，小心被人摘走！`); }
function sysNotify(txt) { if (!PREF.notify || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return; try { new Notification('丰收农场', { body: txt, tag: 'farm' }); } catch (e) { } }

/* ============ 自己农场的操作 ============ */
async function doPlant(i, quiet) {
  const cr = CROPS[S.me.seed]; if (S.me.lv < cr.lv) { if (!quiet) toast(`${cr.name} 需要 Lv.${cr.lv} 解锁`, 'warn'); sfx('err'); return; }
  if (S.me.gold < cr.seed) { if (!quiet) toast('金币不够买种子了', 'warn'); sfx('err'); return; }
  const r = await api('/api/farm/plant', { idx: i, crop: S.me.seed }); if (!r) return;
  FX.puff(i); FX.stars(i, 5); FX.text(i, `-${cr.seed}`, '#ffd56a', 18); sfx('plant');
}
function harvestFx(x) {
  const cr = CROPS[x.crop], i = x.idx;
  FX.coins(i, 7); FX.stars(i, 8); FX.text(i, `${cr.name} ×${x.n}`, '#fff2c4', 24); if (x.exp) FX.text(i, `+${x.exp} 经验`, '#9fe4ff', 17, 1);
  if (x.stolen) setTimeout(() => FX.text(i, `被摘走 ${x.stolen}`, '#ffb3a3', 15, 2), 300);
  if (x.golden) setTimeout(() => { FX.stars(i, 24); FX.text(i, `变异！金色${cr.name} ×${x.golden}`, '#ffd23a', 22, 3); sfx('golden'); toast(`出现变异！获得 金色${cr.name} ×${x.golden}`); }, 500);
  if (x.season2) setTimeout(() => FX.text(i, '进入第二季', '#c4f09a', 16, 2), 400);
  if (x.bonus) setTimeout(() => { FX.coins(i, 10); FX.stars(i, 16); FX.text(i, `大丰收！额外 +${x.bonus}`, '#ffb84a', 22, 2); sfx('golden'); }, 650);
}
async function doHarvest(i) { const r = await api('/api/farm/harvest', { idx: i }); if (!r) return; sfx('harvest'); harvestFx(r.result); }
function careFx(i, k, own, x) {
  if (k === 'd') { FX.drops(i); sfx('water'); } else if (k === 'w') { FX.leaves(i); sfx('weed'); } else { FX.puff(i); FX.stars(i, 6); sfx('bug'); }
  const helpTx = x && x.tired ? '帮忙成功（今日奖励已领满）' : `帮忙 +${x && x.exp !== undefined ? x.exp : RULES.helpExp}经验 +${x && x.gold !== undefined ? x.gold : RULES.helpGold}金币`;
  FX.text(i, own ? ({ d: '浇水', w: '除草', b: '除虫' })[k] + ' +2经验' : helpTx, own ? '#9fe4ff' : '#c4f09a', 16);
}
async function doCare(i) { const r = await api('/api/farm/care', { idx: i }); if (r) careFx(i, r.result.kind, true); }
async function doShovel(i) { const P = view.plots[i]; if (P.c < 0) return; if (P.p >= 1) { toast('作物已成熟，先收获吧', 'warn'); sfx('err'); return; } const r = await api('/api/farm/shovel', { idx: i }); if (!r) return; FX.puff(i); FX.leaves(i, 'soil'); sfx('weed'); }
async function doFert(i) {
  const P = view.plots[i]; if (P.c < 0 || P.p >= 1) return; if (!(S.inv.fert > 0)) { toast('化肥用完了，去商店买一些吧', 'warn'); sfx('err'); return; }
  const r = await api('/api/farm/fert', { idx: i }); if (!r) return; FX.stars(i, 12); FX.text(i, '成长加速', '#c8ff8a', 19); sfx('fert');
}
async function doRed(i) {
  const P = view.plots[i], cur = P.soil | 0, to = redTo || cur + 1, S1 = CFG.SOILS[to]; if (!CFG.SOILS[cur + 1]) { toast('这块已经是最高级的金土地了', 'warn'); return; }
  if (!S1 || cur >= to) { toast(`这块已经是${CFG.SOILS[cur].name}了，换一块地吧`, 'warn'); return; }
  const r = await api('/api/farm/red', { idx: i, to }); if (!r) return; const S2 = CFG.SOILS[r.result.soil];
  FX.stars(i, 14 + 6 * r.result.soil); FX.text(i, `升级为${S2.name}`, ['', '#ffb08a', '#c8c0b0', '#ffd23a'][r.result.soil], 21); sfx('level');
  toast(`${S2.name}：生长速度 +${Math.round((S2.speed - 1) * 100)}%，产量 +${Math.round((S2.yield - 1) * 100)}%`);
}
async function doExpand(i) { const r = await api('/api/farm/expand', i >= 0 ? { idx: i } : {}); if (!r) return; FX.puff(r.result.idx); FX.stars(r.result.idx, 14); FX.text(r.result.idx, '开垦成功', '#ffe27a', 22); sfx('level'); }
// 批量操作的特效：只给当前看着的那片田播放，最多 24 块、总时长不超过 1.6 秒（几百块地一起操作时不卡）
function stagger(list, fn, gap) { const f = W3.field || 0, vis = list.filter(x => x.idx === undefined || Math.floor(x.idx / CFG.NPLOTS) === f), pick = (vis.length ? vis : list).slice(0, 24), g = Math.min(gap || 70, 1600 / Math.max(1, pick.length));
  pick.forEach((x, k) => setTimeout(() => fn(x), k * g)); if (list.length > pick.length) setTimeout(() => toast(`共 ${list.length} 块地完成`), 300); }
async function allHarvest() { if (view.key !== 'home') return; const r = await api('/api/farm/harvest-all', null, { lvDelay: 900 }); if (!r) return; sfx('harvest'); stagger(r.result.filter(x => !x.err), harvestFx); }
async function allCare() { if (view.key !== 'home') return; const r = await api('/api/farm/care-all'); if (!r) return; stagger(r.result.filter(x => !x.err), x => careFx(x.idx, x.kind, true), 90); }
async function allFert() {
  if (view.key !== 'home') return; if (!(S.inv.fert > 0)) { toast('没有化肥了，去商店买一些吧', 'warn'); openShop('item'); return; }
  const r = await api('/api/farm/fert-all'); if (!r) return; const x = r.result;
  stagger(x.res, p => { FX.stars(p.idx, 8); FX.text(p.idx, p.ripe ? `催熟！化肥×${p.n}` : `化肥×${p.n}`, '#b8ff8a', 16); sfx('fert'); }, 110);
  toast(`用了 ${x.used} 袋化肥，${x.ripe ? `${x.ripe} 块地马上成熟` : '作物长得更快了'}${x.left ? `，还剩 ${x.left} 袋` : '，化肥用完了'}`);
}
async function allPlant() {
  if (view.key !== 'home') return; const cr = CROPS[S.me.seed]; if (S.me.lv < cr.lv) { toast(`${cr.name} 需要 Lv.${cr.lv}`, 'warn'); return; }
  const r = await api('/api/farm/plant-all', { crop: S.me.seed }); if (!r) return; const ok = r.result.filter(x => !x.err);
  stagger(ok, x => { FX.puff(x.idx); FX.stars(x.idx, 5); FX.text(x.idx, `-${cr.seed}`, '#ffd56a', 18); sfx('plant'); });
  const fail = r.result.length - ok.length; if (fail) toast(`种下 ${ok.length} 块，${fail} 块因金币不足没种上`, 'warn');
}

/* ============ 别人农场的操作 ============ */
async function visit(f) {
  if (!f) return; closeModal(); $('tip').style.display = 'none';
  try {
    const r = await NET.get('/api/farm/' + f.id);
    view = { key: 'f' + f.id, friend: r.farm.owner, plots: r.farm.plots, farm: r.farm }; tool = 'auto'; hoverIdx = -1; sfx('open'); syncSide(r.farm); W3.resetHero(); W3.setField(0);
    renderToolbar(); renderTitle(); renderFriends(); toast(`来到了 ${f.name} 的农场`); refreshState();
  } catch (e) { toast(e.message, 'warn'); }
}
function goHome() { if (!S) return; W3.resetHero(); W3.setField(0); view = { key: 'home', friend: null, plots: S.plots, farm: null }; hoverIdx = -1; sfx('open'); renderToolbar(); renderTitle(); renderFriends(); refreshState(); }
function stealFx(x) {
  if (x.blocked) { const who = x.dogs && x.dogs.length ? x.dogs.join('和') : '狗'; dogBarkUntil = Date.now() + 2500; sfx('bark'); FX.text(x.idx, x.bite ? `被${who}咬了 -${x.bite}金币` : `被${who}赶走了`, '#ff9a8a', 20); return; }
  FX.stars(x.idx, x.crit ? 18 : 8); FX.text(x.idx, `${x.crit ? '手气爆棚！' : ''}${CROPS[x.crop].name} ×${x.qty}`, x.crit ? '#ffd23a' : '#fff2c4', x.crit ? 24 : 22);
  if (x.exp) FX.text(x.idx, `+${x.exp} 经验`, '#9fe4ff', 16, 1); else if (x.tired) FX.text(x.idx, '今日经验已满', '#c8c8c8', 14, 1);
  sfx(x.crit ? 'golden' : 'steal');
}
async function fSteal(i) { const r = await api(`/api/farm/${view.friend.id}/steal`, { idx: i }); if (r) { stealFx(r.result); if (r.result.blocked) toast(`${view.friend.name} 家的${(r.result.dogs || ['狗']).join('和')}把你赶走了${r.result.bite ? `，被咬掉 ${r.result.bite} 金币` : ''}`, 'warn'); } }
async function fHelp(i) { const r = await api(`/api/farm/${view.friend.id}/help`, { idx: i }); if (r) careFx(i, r.result.kind, false, r.result); }
async function allSteal() { if (view.key === 'home') return; const r = await api(`/api/farm/${view.friend.id}/steal-all`); if (!r) return; const ok = r.result.filter(x => !x.err); stagger(ok, stealFx, 120); const got = ok.filter(x => !x.blocked).reduce((a, x) => a + x.qty, 0), crit = ok.filter(x => x.crit).length; if (got) setTimeout(() => toast(`一共摘到 ${got} 个果实${crit ? `，其中 ${crit} 次手气爆棚` : ''}`), ok.length * 120); }
async function allHelp() { if (view.key === 'home') return; const r = await api(`/api/farm/${view.friend.id}/help-all`); if (!r) return; stagger(r.result.filter(x => !x.err), x => careFx(x.idx, x.kind, false, x), 120); }
async function addFriendNow(u) { const r = await api('/api/friends/add', { id: u.id }); if (r) { sfx('level'); toast(`已添加 ${u.name} 为好友`); await loadFriends(); renderToolbar(); refreshState(); } }

/* ============ 点击土地 ============ */
async function clickPlot(i, first) {
  if (i < 0 || !S) return; const P = view.plots[i], bk = view.key + ':' + i; if (!P || busy.has(bk)) return; busy.add(bk); // 记下这次用的键：操作中途切换农场也能正确清除
  try {
    if (view.key !== 'home') {
      if (!P.u || P.c < 0) return;
      if (P.p >= 1) {
        if (P.mine === 1) { toast('这块地你已经摘过了'); return; } if (P.mine === 2) { toast('这块地有狗看着，下一季再来吧'); return; }
        if (P.left <= 0) { toast('已经被摘得差不多了，给主人留点吧'); return; }
        if (NET.now() < P.protectUntil) { toast(`刚成熟，主人保护中，${Math.ceil((P.protectUntil - NET.now()) / 1000)} 秒后才能摘`); return; }
        return await fSteal(i);
      }
      if (P.pr.d || P.pr.w || P.pr.b) return await fHelp(i); return;
    }
    if (!P.u) { if (first !== false) askExpand(i); return; } // 点荒地（任何工具下）都弹出开垦确认；拖动经过的荒地不弹
    switch (tool) {
      case 'shovel': return await doShovel(i);
      case 'fert': return await doFert(i);
      case 'red': return await doRed(i);
      default: if (P.c < 0) return await doPlant(i); if (P.p >= 1) return await doHarvest(i); if (P.pr.d || P.pr.w || P.pr.b) return await doCare(i);
    }
  } finally { busy.delete(bk); }
}
function askExpand(i) {
  const owned = unlockedCount(), cost = CFG.plotCost(owned), need = CFG.plotNeedLv(owned);
  openModal(`<div class="confirm"><div class="bigico">${ICON('grid')}</div><h3>开垦新土地</h3><p>花费 <b class="gold">${fmt(cost)}</b> 金币开垦这块荒地${S.me.lv < need ? `<br><span class="warn">需要 Lv.${need}（当前 Lv.${S.me.lv}）</span>` : ''}</p>
    <div class="row"><button class="btn" onclick="closeModal()">再想想</button><button class="btn primary" id="okx">开垦</button></div></div>`, { small: true });
  $('okx').onclick = () => { closeModal(); doExpand(i); };
}

/* ============ HUD / 工具栏 / 侧栏 ============ */
function renderHud() {
  if (!S) return; const me = S.me;
  $('pname').textContent = me.name; $('lvbadge').textContent = 'Lv.' + me.lv; $('ptitle').textContent = me.title || ''; $('ptitle').style.display = me.title ? '' : 'none';
  const pct = me.lv >= RULES.maxLv ? 100 : me.exp / me.expNeed * 100; $('expfill').style.width = pct + '%'; $('exptext').textContent = me.lv >= RULES.maxLv ? '满级' : `${Math.floor(me.exp)} / ${me.expNeed}`;
  const g = $('goldnum'); if (g.textContent !== fmt(me.gold)) { g.textContent = fmt(me.gold); $('gold').classList.remove('bump'); void $('gold').offsetWidth; $('gold').classList.add('bump'); }
  drawAvatar($('avatar'), avStyle(me.avatar)); const fc = frameColor(me.frame); $('avatar').style.boxShadow = fc ? `0 0 0 2px ${fc}, 0 0 10px ${fc}` : '';
  { const st = sndState(), b = $('btn-snd'); b.innerHTML = ICON(st === 'off' ? 'mute' : 'sound') + `<em class="sndst ${st}">${st === 'off' ? '关' : '开'}</em>`; b.className = 'snd-' + st; b.title = ({ on: '声音已开启（点击调节）', half: '部分声音已开启（点击调节）', off: '声音已关闭（点击打开）' })[st]; b.setAttribute('aria-label', b.title); }
}
// 切换到某片田：俯视时镜头移过去；漫游时人物走过去太远，直接传送到那片田边
function setField(f) { const nf = Math.ceil((view.plots || []).length / CFG.NPLOTS); f = Math.max(0, Math.min(nf - 1, f | 0)); W3.setField(f); if (W3.mode === 'walk') { const [x, z] = W3.fieldCenter(f); W3.teleport(x, z + 6.2, 0); } renderTitle(); }
/* 第 1 期：四季（网址加 ?season=winter 可以预览别的季节，只改画面，不影响结算） */
const SEASON_PREVIEW = (new URLSearchParams(location.search).get('season') || '').toLowerCase(); let seasonSeen = '';
/* 画面上的季节：设置里可以固定成某个季节（只改画面；当季作物和产量加成仍按真实日期） */
function seasonLook() { return (SEASON_PREVIEW && CFG.SEASONS.list.find(s => s.id === SEASON_PREVIEW)) || (PREF.sea && PREF.sea !== 'auto' && CFG.SEASONS.list.find(s => s.id === PREF.sea)) || CFG.seasonOf(NET.now()); }
function seasonNow() { return (SEASON_PREVIEW && CFG.SEASONS.list.find(s => s.id === SEASON_PREVIEW)) || CFG.seasonOf(NET.now()); }
const SEASON_TAGS = { root: '根菜', cabbage: '叶菜', flower: '花卉', bush: '茄果', melon: '瓜类', sunflower: '向日葵', corn: '玉米', pumpkin: '南瓜', grain: '麦稻', pine: '菠萝' };
function seasonCropText(s) { return (s || seasonNow()).crops.map(k => SEASON_TAGS[k] || k).join('、'); }
function renderTitle() {
  const nf = Math.ceil((view.plots || []).length / CFG.NPLOTS), fnav = nf > 1 ? `<em class="fnav"><b data-f="-1">‹</b>第${W3.field + 1}/${nf}片田<b data-f="1">›</b></em>` : '';
  const sz = seasonNow(), chip = `<em class="seachip s-${sz.id}" data-sea="1" title="${sz.full}">${sz.name}</em>`;
  if (view.key === 'home') $('title').innerHTML = S ? `${chip}<span>${esc(S.me.name)}的农场</span>${fnav}` : '<span>丰收农场</span>';
  else $('title').innerHTML = `<span>${esc(view.friend.name)}的农场</span>${fnav}<small>Lv.${view.friend.lv}${view.friend.title ? ' · ' + esc(view.friend.title) : ''}${(view.friend.dogs || []).length ? ' · ' + view.friend.dogs.map(d => d.name + (d.fed ? '看家中' : '在睡觉')).join('，') : ''}</small>`;
  $('title').querySelectorAll('[data-f]').forEach(b => b.onclick = e => { e.stopPropagation(); ac(); sfx('click'); setField((W3.field + +b.dataset.f + nf) % nf); });
  $('title').querySelectorAll('[data-sea]').forEach(b => b.onclick = e => { e.stopPropagation(); ac(); sfx('click'); openSeason(); });
  $('todbtn').innerHTML = ICON(({ auto: 'cloudsun', day: 'sun', dusk: 'sunset', night: 'moon' })[PREF.tod] || 'cloudsun');
}
function renderToolbar() {
  if (!S) { $('toolbar').innerHTML = ''; return; }
  const home = view.key === 'home', tb = $('toolbar'), items = [], b = S.badges;
  const T = (id, ic, tx, extra) => items.push(Object.assign({ id, ic: ICON(ic), tx, tool: true }, extra));
  const A = (id, ic, tx, extra) => items.push(Object.assign({ id, ic: ICON(ic), tx }, extra));
  if (home) {
    T('auto', 'wand', '自动'); items.push({ id: 'seed', ic: `<img src="${cropIcon(S.me.seed)}">`, tx: CROPS[S.me.seed].name });
    T('shovel', 'shovel', '铲除'); T('fert', 'flask', '化肥', { badge: S.inv.fert || 0 });
    A('allh', 'basket', '一键收获', { badge: S.plots.filter(p => p.u && p.c >= 0 && p.p >= 1).length || 0 }); A('allf', 'bolt', '一键催熟', { badge: S.plots.some(p => p.u && p.c >= 0 && p.p < 1) && S.inv.fert ? S.inv.fert : 0 }); A('allc', 'wrench', '一键护理'); A('allp', 'sprouts', '一键种植');
    A('wh', 'bag', '仓库'); A('shop', 'store', '商店'); A('task', 'scroll', '任务', { badge: b.tasks + b.newbie, alert: 1 });
  } else {
    T('auto', 'wand', '自动'); A('alls', 'mask', '一键摘取', { badge: view.plots.filter(p => p.canSteal).length || 0 }); A('allhp', 'hands', '一键帮忙');
    if (!isFriend(view.friend.id)) A('addf', 'plus', '加好友'); A('gb', 'mail', '留言'); A('wh', 'bag', '仓库'); A('home', 'home', '回家');
  }
  const html = items.map(it => `<button class="tbtn${it.tool && tool === it.id ? ' on' : ''}" data-id="${it.id}"><span class="ic">${it.ic}</span><span class="tx">${it.tx}</span>${it.badge ? `<i class="bd${it.alert ? ' al' : ''}">${it.badge}</i>` : ''}</button>`).join('');
  if (tb._h !== html) { tb._h = html; tb.innerHTML = html; tb.querySelectorAll('.tbtn').forEach(x => x.onclick = () => toolbarClick(x.dataset.id)); }
}
function toolbarClick(id) {
  ac(); sfx('click');
  if (['auto', 'shovel', 'fert'].includes(id)) { tool = id; renderToolbar(); updateCursor(); return; }
  const m = { seed: openSeeds, allh: allHarvest, allc: allCare, allf: allFert, allp: allPlant, wh: openWarehouse, shop: () => openShop('item'), task: () => openTasks(), alls: allSteal, allhp: allHelp, home: goHome, gb: () => openGuestbook(view.friend), addf: () => addFriendNow(view.friend) };
  m[id] && m[id]();
}
// 牧场角标：可以收的鱼 + 可以剪毛的羊
function ranchBadge() { const R = S && S.me.ranch; if (!R) return 0; const now = NET.now(); return (R.fish.some(f => fishLeftC(f, now) <= 0) ? 1 : 0) + (R.sheep.some(s => sheepCyclesC(s, now, R) >= 1 || s.pend) ? 1 : 0) + ((R.trees || []).some(r => CFG.treeCycles(r, now) >= 1) ? 1 : 0); }
const fishLeftC = (f, now) => CFG.fishLeft(f, now), sheepCyclesC = (s, now, R) => CFG.sheepCycles(s, now, R.herd);
function renderSide() {
  if (!S) return; const b = S.badges;
  const items = [['map', 'compass', '地图'], ['build', 'hammer', '建造'], ['friends', 'users', '好友', b.requests], ['msg', 'mail', '消息', b.unread], ['orders', 'box', '订单'], ['market', 'tag', '集市'], ['rank', 'trophy', '排行'], ['ach', 'medal', '成就', b.ach], ['codex', 'book', '图鉴'], ['ranch', 'sheep', '牧场', ranchBadge()], ['dress', 'palette', '装扮']];
  const html = items.map(([id, ic, tx, bd]) => `<button class="sbtn" data-s="${id}">${ICON(ic)}<em>${tx}</em>${bd ? `<i class="bd">${bd}</i>` : ''}</button>`).join('')
    + (S.events.length ? `<button class="sbtn ev" data-s="events">${ICON('party')}<em>活动</em></button>` : '');
  const el = $('side'); if (el._h !== html) { el._h = html; el.innerHTML = html; el.querySelectorAll('.sbtn').forEach(x => x.onclick = () => { ac(); sfx('click'); sideClick(x.dataset.s); }); }
  renderNewbie();
}
function sideClick(s) { ({ map: openWorldMap, build: () => (BUILD.on ? closeBuild() : openBuild()), ranch: () => openRanch(), friends: () => openFriends(), msg: openMessages, orders: openOrders, market: () => openMarket(), rank: () => openRank(), ach: openAch, codex: openCodex, dress: () => openDress(), events: openEvents })[s](); }
function renderNewbie() {
  const el = $('newbie'); if (!S || !S.badges.newbieLeft) { el.style.display = 'none'; return; }
  const done = CFG.NEWBIE.length - S.badges.newbieLeft; el.style.display = '';
  const html = `<b>新手任务 ${done}/${CFG.NEWBIE.length}</b><small>${S.badges.newbie ? '有奖励可以领取' : '点击查看下一步'}</small><span class="np"><i style="width:${done / CFG.NEWBIE.length * 100}%"></i></span>${S.badges.newbie ? '<i class="bd al">!</i>' : ''}`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; } el.onclick = () => openTasks('newbie');
}
const AVC = new Map(); function avURL(av, sz) { const k = JSON.stringify(av || {}); if (AVC.has(k)) return AVC.get(k); const c = document.createElement('canvas'); c.width = c.height = sz || 96; drawAvatar(c, avStyle(av)); const u = c.toDataURL(); AVC.set(k, u); return u; }
function renderFriends() {
  const el = $('friends'); if (!S) { el.innerHTML = ''; return; }
  const list = sideTab === 'friends' ? FR.list : NB.list;
  const item = f => `<div class="fr${view.key === 'f' + f.id ? ' on' : ''}" data-id="${f.id}" title="${esc(f.name)} Lv.${f.lv}"><img src="${avURL(f.avatar)}" style="${frameColor(f.frame) ? `box-shadow:0 0 0 2px ${frameColor(f.frame)}` : ''}">${f.online ? '<em class="on"></em>' : ''}<span>${esc(f.name)}</span><small>Lv.${f.lv}</small>${f.steal ? `<i class="bd">${f.steal}</i>` : ''}${f.help ? `<i class="bd hp">${f.help}</i>` : ''}</div>`;
  const html = `<div class="ftabs"><button class="${sideTab === 'friends' ? 'on' : ''}" data-tab="friends">好友${FR.list.length ? ' ' + FR.list.length : ''}</button><button class="${sideTab === 'nearby' ? 'on' : ''}" data-tab="nearby">附近</button></div>
    <div class="fr me${view.key === 'home' ? ' on' : ''}" data-id="me"><img src="${avURL(S.me.avatar)}"><span>我家</span></div>
    <div class="flist">${list.length ? list.map(item).join('') : `<div class="fempty">${sideTab === 'friends' ? '还没有好友<br>去「附近」看看' : '附近暂时没人'}</div>`}</div>
    <div class="fr add" data-id="add"><div class="plus">${ICON('plus')}</div><span>找人</span>${S.badges.requests ? `<i class="bd">${S.badges.requests}</i>` : ''}</div>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sideTab = b.dataset.tab; sfx('click'); renderFriends(); if (sideTab === 'nearby') loadNeighbors(); else loadFriends(); });
    el.querySelectorAll('.fr').forEach(d => { const id = d.dataset.id; d.onclick = () => { ac(); if (id === 'me') goHome(); else if (id === 'add') openFriends('add'); else visit(list.find(x => String(x.id) === id)); }; });
  }
}

/* ============ 弹窗基础 ============ */
let modalStack = null;
/* v3.3：同一个弹窗（同标题、同标签页）刷新时保留滚动位置、输入的文字和焦点，买东西不会跳回顶部 */
const modalKey = root => { const h = root.querySelector('h2'), t = root.querySelector('.tabs .on'); return h ? h.textContent + '|' + (t ? t.textContent.replace(/\d+$/, '') : '') : ''; };
function modalSnap(m) {
  const sc = [], inp = {}; [m, ...m.querySelectorAll('*')].forEach((el, i) => { if (el.scrollTop > 0 || el.scrollLeft > 0) sc.push([el === m ? '' : el.className + '#' + (el.id || ''), el.scrollTop, el.scrollLeft]); });
  m.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => { if (el.type !== 'checkbox' && el.type !== 'radio') inp[el.id] = el.value; else inp[el.id] = el.checked; });
  const f = document.activeElement && m.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : null;
  return { key: modalKey(m), sc, inp, f };
}
function modalRestore(m, st) {
  Object.keys(st.inp).forEach(id => { const el = document.getElementById(id); if (!el || !m.contains(el) || el.disabled) return; if (el.type === 'checkbox' || el.type === 'radio') el.checked = st.inp[id]; else if (el.type !== 'range') el.value = st.inp[id]; });
  const seen = {}; st.sc.forEach(([k, t, l]) => { let el; if (k === '') el = m; else { const [cls, id] = k.split('#'); if (id) el = document.getElementById(id); else { seen[cls] = (seen[cls] || 0); el = [...m.querySelectorAll('*')].filter(x => x.className === cls)[seen[cls]++]; } } if (el) { el.scrollTop = t; el.scrollLeft = l; } });
  if (st.f) { const el = document.getElementById(st.f); if (el && !el.disabled) try { el.focus({ preventScroll: true }); } catch (e) { /* 旧浏览器 */ } }
}
function openModal(html, opt) {
  opt = opt || {}; const m = $('modal'), shown = $('mback').classList.contains('show'), st = shown ? modalSnap(m) : null;
  m.className = opt.small ? 'small' : opt.wide ? 'wide' : ''; m.innerHTML = (opt.noclose ? '' : `<button class="x" onclick="closeModal()">${ICON('close')}</button>`) + html; if (m.querySelector(':scope > .list')) m.classList.add('haslist'); $('mback').classList.add('show'); document.body.classList.add('mopen'); $('mback').dataset.noclose = opt.noclose ? '1' : '';
  const same = st && st.key && st.key === modalKey(m); if (!same) sfx('open');
  if (opt.mount) opt.mount(); if (same) modalRestore(m, st); else m.scrollTop = 0; modalStack = opt.onclose || null;
}
function closeModal(force) { if ($('mback').dataset.noclose === '1' && !force) return; $('mback').classList.remove('show'); document.body.classList.remove('mopen'); $('mback').dataset.noclose = ''; const f = modalStack; modalStack = null; if (f) f(); }
const iconImg = id => `<img class="cimg" src="${cropIcon(id)}">`;
const itemIcon = item => { const ri = CFG.ranchItem(item); if (ri) { const d = ri.kind === 'fish' ? CFG.FISH[ri.id] : ri.kind === 'wool' ? CFG.SHEEP[ri.id] : CFG.TREES[ri.id]; return `<span class="ii emo" style="color:${ri.kind === 'wool' ? (d.body === '#fbf8f0' ? '#e8e0d0' : d.body) : d.col}">${ICON(ri.kind === 'fish' ? 'fish' : ri.kind === 'wool' ? 'sheep' : 'leaf')}</span>`; } if (['ffeed', 'sfeed', 'tfert'].includes(item)) return `<span class="ii emo">${ICON(item === 'ffeed' ? 'fish' : item === 'sfeed' ? 'sheep' : 'drop')}</span>`; const c = cropOf(item); if (c) return `<span class="ii${c.golden ? ' gold' : ''}"><img class="cimg" src="${cropIcon(c.id, c.golden)}"></span>`; return `<span class="ii emo">${ICON(item === 'fert' ? 'flask' : item === 'dogfood' ? 'paw' : 'box')}</span>`; };
const avHtml = (av, frame, size) => { const fc = frameColor(frame); return `<img class="av" src="${avURL(av)}" style="width:${size || 40}px;height:${size || 40}px;${fc ? `box-shadow:0 0 0 2px ${fc}` : ''}">`; };
function levelUp(lv) {
  sfx('level'); const unlocked = CROPS.filter(c => c.lv === lv);
  /* 正在买东西时升级：不要盖掉当前弹窗，用提示条告诉玩家，可以点「看看」再打开升级详情 */
  if ($('mback').classList.contains('show') && !$('modal').querySelector('.lvup')) { toast(`升到 Lv.${lv} 了！获得 ${lv * 120} 金币${unlocked.length ? `，解锁 ${unlocked.map(c => c.name).join('、')}` : ''}`, 'lv', { label: '看看', fn: () => { closeModal(); levelUpPop(lv); } }); return; }
  levelUpPop(lv);
}
function levelUpPop(lv) {
  const unlocked = CROPS.filter(c => c.lv === lv);
  openModal(`<div class="lvup"><div class="lvring"><span>Lv.${lv}</span></div><h2>等级提升</h2>
    <p>获得 <b class="gold">${lv * 120}</b> 金币 和 <b>化肥 ×1</b></p>
    ${CFG.DOGS.filter(d => d.lv === lv).map(d => `<div class="unl">可以领养 <b>${d.name}</b> 了！点农场右边的狗窝，或者 商店 → 宠物</div>`).join('')}
    ${unlocked.length ? `<div class="unl">解锁新作物：${unlocked.map(c => `<span class="chip"><img src="${cropIcon(c.id)}">${c.name}</span>`).join('')}</div>` : ''}
    <button class="btn big primary" onclick="closeModal()">好的</button></div>`, { small: true });
}

/* ============ 3D 渲染循环 ============ */
const cv = $('cv');
function curHour() { const m = { day: 12.5, dusk: 18.4, night: 22.5 }; if (m[PREF.tod]) return m[PREF.tod]; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
// 两只狗各自的状态：none 没养 / sleep 饿着在睡觉 / guard 看家 / bark 正在叫
function ranchOfView() { return view.key === 'home' ? S && S.me.ranch : view.friend && view.friend.ranch; }
// 传给 3D 场景的鱼和羊（每帧）
// 3D 场景里画出来的数量有上限（鱼每个池塘最多 24 条、羊最多 360 只、果树最多 160 棵），按比例展开各个批次
function expand(list, total, max, fn) { const out = []; if (!total) return out; const k = Math.min(1, max / total); list.forEach(x => { let m = Math.round(x.n * k); if (x.n > 0 && m < 1) m = 1; for (let i = 0; i < m && out.length < max; i++) out.push(fn(x)); }); return out; }
let R3 = { key: '', v: null };
function ranch3d() { const R = ranchOfView(); if (!R) return { fish: [], sheep: [], trees: [], herd: { on: false }, lv: {} }; const now = NET.now(), tick = Math.floor(now / 1000);
  if (R3.r === R && R3.tick === tick) return R3.v; // 每秒重算一次
  const lvs = { pond: R.pondLv || 1, pasture: R.pastLv || 1, orchard: R.orchLv || 1, ponds: CFG.pondsOf(R.pondLv) };
  const v = { lv: lvs, fish: expand(R.fish, R.fishN !== undefined ? R.fishN : R.fish.length, 24 * lvs.ponds, f => { const d = CFG.FISH[f.t], left = CFG.fishLeft(f, now); return { t: f.t, k: d ? 1 - left / d.time : 1, ripe: left <= 0 }; }),
    sheep: expand(R.sheep, R.sheepN !== undefined ? R.sheepN : R.sheep.length, 360, s => ({ t: s.t, c: s.last ? CFG.sheepCycles(s, now, R.herd) : (s.cycles || 0) })),
    trees: expand(R.trees || [], R.treeN || 0, 160, r => { const d = CFG.TREES[r.t], g = CFG.treeGrowLeft(r, now); return { t: r.t, k: d ? 1 - g / d.grow : 1, c: CFG.treeCycles(r, now) }; }),
    herd: { on: R.herd && R.herd.until > now, dog: R.herd && R.herd.dog } };
  R3 = { r: R, tick, v }; return v; }
function dogMode() {
  const bark = Date.now() < dogBarkUntil;
  const dogs = view.key === 'home' ? (S && S.me.dogs || []).map(d => ({ id: d.id, own: d.own, fed: d.until > NET.now() })) : ((view.friend && view.friend.dogs) || []).map(d => ({ id: d.id, own: true, fed: d.fed }));
  const R = ranchOfView(), herdOn = R && R.herd && R.herd.until > NET.now() && (R.sheepN || R.sheep.length);
  const o = {}; CFG.DOGS.forEach(def => { const d = dogs.find(x => x.id === def.id); o[def.id] = !d || !d.own ? 'none' : !d.fed ? 'sleep' : herdOn && R.herd.dog === def.id ? 'herd' : bark ? 'bark' : 'guard'; });
  const pets = view.key === 'home' ? (S && S.me.pets || []) : ((view.friend && view.friend.pets) || []); pets.forEach(p => { o[p.id] = !(p.until > NET.now() || p.fed) ? 'sleep' : herdOn && R.herd.dog === p.id ? 'herd' : 'guard'; });
  return o;
}
let lastT = performance.now(), rainK = 0, wasRain = false;
/* 加载画面还盖着时只画前两帧（顺便编译着色器），之后暂停，把手机的计算留给加载（V0.4） */
let warmFrames = 0, loadingEl = null;
function frame(now) {
  loadingEl = loadingEl || $('loading');
  if (!loadingEl.classList.contains('gone') && warmFrames++ > 1) { lastT = now; requestAnimationFrame(frame); return; }
  if (BOOT_T.frame1 === undefined && started) bootMark('frame1');
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const raining = !!CFG.rainUntil(NET.now()); if (raining && !wasRain && started) { toast('下雨了，农田被滋润了'); sfx('rain'); } wasRain = raining;
  rainK += ((raining ? 1 : 0) - rainK) * Math.min(1, dt * 1.2);
  const home = view.key === 'home';
  W3.setTheme(themeOf(home ? (S ? S.me.theme : 'classic') : view.friend.theme)); W3.setDog(dogMode()); W3.setRanch(ranch3d()); W3.setPets(view.key === 'home' ? (S && S.me.pets || []) : ((view.friend && view.friend.pets) || [])); W3.setEnv(curHour(), rainK);
  { const pn = W3.mode !== 'walk' && W3.panned; if (pn !== document.body.classList.contains('panned')) document.body.classList.toggle('panned', pn); }
  { const sid = seasonNow().id; W3.setWeatherFx(PREF.wfx !== false); W3.setSeason(seasonLook().id); if (started && seasonSeen && sid !== seasonSeen) { toast(`${seasonNow().full}到了：${seasonCropText()}当季，产量 +10%`); renderTitle(); } if (started) seasonSeen = sid; }
  if (BUILD.on && (!home || W3.mode === 'walk' || !S)) closeBuild();
  W3.setLayout(home ? (S && S.me.layout) : (view.friend && view.friend.layout)); if (BUILD.on && (BUILD.tick = (BUILD.tick || 0) + 1) % 20 === 0) buildSync(); /* 金币、等级变化时刷新建造栏 */
  W3.setPlots(view.plots, home); W3.setHover(!BUILD.on && (mouse.in || painting) ? hoverIdx : -1); W3.render(dt);
  updateTip(); updateWalkUi(); requestAnimationFrame(frame);
}

/* ============ 漫游模式：视角切换、键盘、虚拟摇杆、附近地块操作 ============ */
const KEYS = new Set(); let walkHintShown = false;
function heroLook() { const a = (S && S.me.avatar) || {}, A = CFG.AVATAR_OPTS; return { skin: A.skin[a.skin | 0], hair: A.hair[a.hair | 0], shirt: A.shirt[a.shirt | 0], band: A.band[a.band | 0], hat: a.hat ? 1 : 0 }; }
function setViewMode(m, quiet) {
  W3.setHero(heroLook()); W3.setMode(m); try { localStorage.setItem('hf_view', m); } catch (e) { }
  document.body.classList.toggle('walk', m === 'walk'); $('btn-view').innerHTML = ICON(m === 'walk' ? 'eye' : 'walk'); $('btn-view').title = m === 'walk' ? '切换到俯视' : '切换到漫游';
  painting = false; paintQ.length = 0; KEYS.clear(); W3.setInput({ x: 0, z: 0, run: false });
  if (!quiet) { sfx('open'); toast(m === 'walk' ? (window.matchMedia('(pointer: coarse)').matches ? '漫游模式：左下摇杆移动，右下按钮跳跃和操作，拖动画面转镜头' : '漫游模式：WASD / 方向键移动，Shift 跑，空格跳，F 操作，拖动画面转镜头') : '俯视模式：点击土地直接操作'); }
}
function keyInput() { const x = (KEYS.has('d') || KEYS.has('arrowright') ? 1 : 0) - (KEYS.has('a') || KEYS.has('arrowleft') ? 1 : 0), z = (KEYS.has('s') || KEYS.has('arrowdown') ? 1 : 0) - (KEYS.has('w') || KEYS.has('arrowup') ? 1 : 0); if (!joy.on) W3.setInput({ x, z, run: KEYS.has('shift') }); }
// 附近地块要做的事（与点击地块的逻辑一致），用于操作按钮上的文字
function actionOf(i) {
  if (i < 0 || !S || !view.plots[i]) return ''; const P = view.plots[i], home = view.key === 'home';
  if (!home) { if (!P.u || P.c < 0) return ''; if (P.p >= 1) return P.mine ? '' : P.left > 0 && NET.now() >= P.protectUntil ? `摘取${CROPS[P.c].name}` : ''; return P.pr.d || P.pr.w || P.pr.b ? '帮忙打理' : ''; }
  if (!P.u) return '开垦';
  if (tool === 'shovel') return P.c >= 0 && P.p < 1 ? '铲除' : ''; if (tool === 'fert') return P.c >= 0 && P.p < 1 ? '施肥' : ''; if (tool === 'red') { const to = redTo || (P.soil | 0) + 1; return CFG.SOILS[to] && (P.soil | 0) < to ? `升级为${CFG.SOILS[to].name}` : ''; }
  if (P.c < 0) return `种${CROPS[S.me.seed].name}`; if (P.p >= 1) return `收获${CROPS[P.c].name}`; if (P.pr.d) return '浇水'; if (P.pr.w) return '除草'; if (P.pr.b) return '除虫'; return '';
}
const DOG_PET_LINES = { fuwang: ['福旺开心地蹭蹭你', '福旺：汪！再摸摸～', '福旺眯起了眼睛'], ruibao: ['睿宝把头埋进你手心', '睿宝：嗷呜～', '睿宝摇成了螺旋桨'] };
// 点到场景里的特殊物体：狗窝 → 宠物商店（自己家）；狗 → 摸摸头
function pickSpecial(i) {
  ac();
  if (i === -30 || i === -31 || i === -32) { const tb = i === -30 ? 'pond' : i === -31 ? 'pasture' : 'orchard'; if (view.key === 'home') { sfx('open'); openRanch(tb); } else toast(`这是好友家的${({ pond: '鱼塘', pasture: '牧场', orchard: '果园' })[tb]}`); return; }
  if (i === -10) { if (view.key === 'home') { sfx('open'); openShop('dog'); } else toast('这是好友家的狗窝'); return; }
  const k = -20 - i, d = W3.dogInfo(k); if (d && W3.petDog(k)) { sfx('bark'); const L = DOG_PET_LINES[d.did] || [`${d.name}开心地蹭蹭你`, `${d.name}：汪！`, `${d.name}摇成了螺旋桨`]; toast(L[Math.random() * L.length | 0]); }
}
function petAction() { const k = W3.nearDog; if (k < 0) return null; const d = W3.dogInfo(k); return d ? { k, label: `摸摸${d.name}`, id: d.did, name: d.name } : null; }
function doAct() { const i = W3.near; if (i >= 0 && actionOf(i)) { ac(); clickPlot(i, true); return; } if (!petAction() && W3.nearKennel() && view.key === 'home') { ac(); sfx('open'); openShop('dog'); return; } if (!petAction() && W3.nearZone() && view.key === 'home') { ac(); sfx('open'); openRanch(W3.nearZone()); return; } const p = petAction(); if (p && W3.petDog(p.k)) { ac(); sfx('bark'); const L = DOG_PET_LINES[p.id] || [`${p.name}开心地蹭蹭你`, `${p.name}：汪！`]; toast(L[Math.random() * L.length | 0]); } }
/* 2026-10-26 世界变大了：漫游走远了（离农场 70 米以上）出现「回农场」按钮 */
let farBtnT = 0;
function updateFarBtn() { const now = performance.now(); if (now - farBtnT < 500) return; farBtnT = now; let b = $('gofarm'); const h = W3.heroInfo(), far = W3.mode === 'walk' && !BUILD.on && Math.hypot(h.x, h.z - 4) > 70;
  if (far && !b) { b = document.createElement('button'); b.id = 'gofarm'; b.className = 'btn primary'; b.innerHTML = ICON('home') + '<span>回农场</span>'; b.onclick = () => { ac(); sfx('open'); W3.resetHero(); toast('回到农场了'); }; document.body.appendChild(b); }
  if (b) { b.style.display = far ? '' : 'none'; if (far) b.querySelector('span').textContent = `回农场（${Math.round(Math.hypot(h.x, h.z - 4))} 米）`; } }
function updateWalkUi() {
  updateFarBtn();
  if (W3.mode !== 'walk') return; const i = W3.near, pa = petAction(), a = actionOf(i) || (pa ? pa.label : '') || (W3.nearKennel() && view.key === 'home' ? (S.me.dogs || []).some(d => d.own) ? '宠物商店' : '领养狗狗' : '') || (view.key === 'home' && W3.nearZone() ? ({ pond: '打开鱼塘', pasture: '打开牧场', orchard: '打开果园' })[W3.nearZone()] : ''), el = $('actbtn'), pr = $('actprompt');
  el.classList.toggle('ready', !!a); el.querySelector('span').textContent = a || '操作';
  pr.style.display = a && !window.matchMedia('(pointer: coarse)').matches ? 'block' : 'none'; if (a) pr.innerHTML = `<kbd>F</kbd> ${esc(a)}`;
}
// 虚拟摇杆
const joy = { on: false, id: -1, cx: 0, cy: 0 };
function initWalkUi() {
  const base = $('joy'), knob = base.querySelector('i'), R0 = 46;
  const set = (x, y) => { let dx = x - joy.cx, dy = y - joy.cy; const d = Math.hypot(dx, dy); if (d > R0) { dx *= R0 / d; dy *= R0 / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; W3.setInput({ x: dx / R0, z: dy / R0, run: d > R0 * 0.95 }); };
  base.addEventListener('pointerdown', e => { e.preventDefault(); ac(); joy.on = true; joy.id = e.pointerId; const r = base.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; set(e.clientX, e.clientY); try { base.setPointerCapture(e.pointerId); } catch (_) { } });
  base.addEventListener('pointermove', e => { if (joy.on && e.pointerId === joy.id) set(e.clientX, e.clientY); });
  const end = e => { if (e.pointerId !== joy.id) return; joy.on = false; knob.style.transform = ''; W3.setInput({ x: 0, z: 0, run: false }); };
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  $('jumpbtn').innerHTML = ICON('jump'); $('jumpbtn').addEventListener('pointerdown', e => { e.preventDefault(); W3.setInput({ jump: true }); sfx('click'); });
  $('actbtn').innerHTML = ICON('sparkle') + '<span>操作</span>'; $('actbtn').addEventListener('pointerdown', e => { e.preventDefault(); doAct(); });
  $('btn-view').onclick = () => { ac(); setViewMode(W3.mode === 'walk' ? 'top' : 'walk'); };
  let m = 'top'; try { m = localStorage.getItem('hf_view') || 'top'; } catch (e) { } setViewMode(m, true);
}

/* ============ 指针 & 提示 ============ */
const paintQ = []; let paintRunning = false;
async function runPaint() { if (paintRunning) return; paintRunning = true; while (paintQ.length) { const q = paintQ.shift(); await clickPlot(q.i, q.first); } paintRunning = false; }
function paintAt(ev, first) {
  if (!S) return; const i = W3.pick(ev.clientX, ev.clientY); if (i <= -10) { if (first) pickSpecial(i); return; } if (i < 0 || (!first && i === lastPaint)) return; lastPaint = i; ac(); startMusic();
  if (first) { paintQ.push({ i, first: true }); runPaint(); } else if (view.key === 'home' && view.plots[i].u && !paintQ.some(q => q.i === i)) { paintQ.push({ i, first: false }); runPaint(); }
}
let tipTimer = 0;
const touches = new Map(); let pinch0 = 0, pinchM = null;
cv.addEventListener('pointerdown', ev => { if (ev.pointerType === 'touch') { touches.set(ev.pointerId, ev); if (touches.size === 2) { painting = false; paintQ.length = 0; const [a, b] = [...touches.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); return; } } });
cv.addEventListener('pointermove', ev => { if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) { touches.set(ev.pointerId, ev); if (touches.size === 2 && pinch0) { const [a, b] = [...touches.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2; W3.zoomBy(pinch0 / d); pinch0 = d; if (W3.mode !== 'walk' && pinchM) W3.panBy(mx - pinchM[0], my - pinchM[1]); pinchM = [mx, my]; } } });
['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, ev => { touches.delete(ev.pointerId); if (touches.size < 2) { pinch0 = 0; pinchM = null; } }));
// 漫游模式：拖动转镜头，轻点地块直接操作
const drag = { on: false, x: 0, y: 0, moved: 0, id: -1 };
cv.addEventListener('pointerdown', ev => { if (W3.mode !== 'walk') return; if (ev.button !== 0 && ev.pointerType === 'mouse') return; if (touches.size > 1) { drag.on = false; return; } drag.on = true; drag.x = ev.clientX; drag.y = ev.clientY; drag.moved = 0; drag.id = ev.pointerId; ac(); startMusic(); try { cv.setPointerCapture(ev.pointerId); } catch (e) { } });
cv.addEventListener('pointermove', ev => { if (W3.mode !== 'walk') return; mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = true; hoverIdx = W3.pick(ev.clientX, ev.clientY); if (!drag.on || ev.pointerId !== drag.id || touches.size > 1) return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = ev.clientX; drag.y = ev.clientY; W3.orbit(dx * 0.0065, dy * 0.0045); });
cv.addEventListener('pointerup', ev => { if (W3.mode !== 'walk') return; if (drag.on && ev.pointerId === drag.id && drag.moved < 8 && touches.size < 2) { const i = W3.pick(ev.clientX, ev.clientY); if (i >= 0) clickPlot(i, true); else if (i <= -10) pickSpecial(i); } drag.on = false; if (ev.pointerType !== 'mouse') { mouse.in = false; hoverIdx = -1; } });
/* 俯视模式（v3.3）：
   - 按住拖动 = 平移地图（鼠标左键 / 单指），不会碰到任何地块
   - 轻点（移动不到 8 像素就松开）= 操作那块地
   - 按住不动 0.4 秒后再拖 = 连续操作（以前的「刷地」玩法），会有震动 / 光圈提示
   - 双指 = 缩放 + 平移；鼠标滚轮缩放 */
const tdrag = { on: false, id: -1, x: 0, y: 0, sx: 0, sy: 0, moved: 0, t: 0, hold: 0, paint: false, pan: false };
/* 用事件自带的时间戳判断「按住多久才开始移动」，就算手机一时卡顿、事件排队，也不会把拖地图误判成连续操作 */
const HOLD_MS = 420;
cv.addEventListener('pointerdown', ev => { if (W3.mode === 'walk') return; if (ev.button !== 0 && ev.pointerType === 'mouse') return; if (touches.size > 1) { tdrag.on = false; clearTimeout(tdrag.hold); return; }
  Object.assign(tdrag, { on: true, id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, moved: 0, t: ev.timeStamp, paint: false, pan: false }); ac(); startMusic();
  mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = true; hoverIdx = W3.pick(ev.clientX, ev.clientY);
  clearTimeout(tdrag.hold); tdrag.hold = setTimeout(() => { if (!tdrag.on || tdrag.pan || tdrag.moved >= 8 || touches.size > 1 || BUILD.on) return; const i = W3.pick(tdrag.sx, tdrag.sy); if (i < 0 || view.key !== 'home') return; cv.classList.add('painting'); try { navigator.vibrate && navigator.vibrate(18); } catch (e) { } }, HOLD_MS);
  try { cv.setPointerCapture(ev.pointerId); } catch (e) { } });
cv.addEventListener('pointermove', ev => { if (W3.mode === 'walk') return; mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.in = true;
  if (touches.size > 1) { tdrag.on = false; clearTimeout(tdrag.hold); return; }
  if (tdrag.on && ev.pointerId === tdrag.id) { const dx = ev.clientX - tdrag.x, dy = ev.clientY - tdrag.y; tdrag.x = ev.clientX; tdrag.y = ev.clientY; tdrag.moved = Math.max(tdrag.moved, Math.hypot(ev.clientX - tdrag.sx, ev.clientY - tdrag.sy));
    if (!tdrag.paint && !tdrag.pan && tdrag.moved >= 8) { clearTimeout(tdrag.hold); const i0 = W3.pick(tdrag.sx, tdrag.sy);
      if (!BUILD.on && ev.timeStamp - tdrag.t >= HOLD_MS && i0 >= 0 && view.key === 'home') { tdrag.paint = true; painting = true; lastPaint = -1; cv.classList.add('painting'); paintAt({ clientX: tdrag.sx, clientY: tdrag.sy }, true); }
      else { tdrag.pan = true; cv.classList.remove('painting'); cv.classList.add('panning'); } }
    if (tdrag.paint) { hoverIdx = W3.pick(ev.clientX, ev.clientY); paintAt(ev, false); }
    else if (tdrag.pan) { hoverIdx = -1; W3.panBy(dx, dy); }
  } else hoverIdx = W3.pick(ev.clientX, ev.clientY);
  updateCursor(); });
cv.addEventListener('pointerup', ev => { if (W3.mode === 'walk') return; clearTimeout(tdrag.hold); cv.classList.remove('panning', 'painting');
  if (tdrag.on && ev.pointerId === tdrag.id && !tdrag.paint && !tdrag.pan && tdrag.moved < 8 && touches.size < 2) { if (BUILD.on) buildTap(ev.clientX, ev.clientY); else { hoverIdx = W3.pick(ev.clientX, ev.clientY); paintAt(ev, true); } }
  tdrag.on = false; tdrag.paint = false; tdrag.pan = false; painting = false; lastPaint = -1;
  if (ev.pointerType !== 'mouse') { clearTimeout(tipTimer); tipTimer = setTimeout(() => { mouse.in = false; hoverIdx = -1; updateCursor(); }, 1600); } });
cv.addEventListener('pointercancel', () => { painting = false; tdrag.on = false; tdrag.paint = false; clearTimeout(tdrag.hold); cv.classList.remove('panning', 'painting'); });
cv.addEventListener('pointerleave', () => { if (painting) return; mouse.in = false; hoverIdx = -1; updateCursor(); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); tool = 'auto'; renderToolbar(); updateCursor(); });
function updateCursor() {
  const el = $('curtool'); let h = ''; const i = hoverIdx, plots = view.plots;
  if (S && mouse.in && i >= 0 && view.key === 'home') {
    const P = plots[i];
    if (tool === 'shovel') h = ICON('shovel'); else if (tool === 'fert') h = ICON('flask'); else if (tool === 'red') h = ICON('sparkle');
    else if (P.u && P.c < 0) h = `<img src="${cropIcon(S.me.seed)}">`; else if (P.u && P.c >= 0 && P.p >= 1) h = ICON('basket'); else if (P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b)) h = ICON(P.pr.d ? 'drop' : P.pr.w ? 'leaf' : 'bug');
  } else if (S && mouse.in && i >= 0) { const P = plots[i]; if (P.u && P.c >= 0 && P.canSteal) h = ICON('mask'); else if (P.u && P.c >= 0 && (P.pr.d || P.pr.w || P.pr.b)) h = ICON('hands'); }
  if (el._h !== h) { el._h = h; el.innerHTML = h; } el.style.display = h && matchMedia('(pointer:fine)').matches ? 'block' : 'none'; el.style.transform = `translate(${mouse.x + 16}px,${mouse.y + 14}px)`;
  cv.style.cursor = (h || i >= 0) ? 'pointer' : 'default';
}
function updateTip() {
  const tip = $('tip'); if (!S || !mouse.in || hoverIdx < 0 || painting) { tip.style.display = 'none'; return; }
  const P = view.plots[hoverIdx], home = view.key === 'home'; let h = '';
  if (!P.u) h = home ? `<b>荒地</b><div>开垦需要 ${fmt(CFG.plotCost(unlockedCount()))} 金币（Lv.${CFG.plotNeedLv(unlockedCount())}）</div>` : '<b>荒地</b>';
  else if (P.c < 0) h = `<b>空地${P.soil ? `（${CFG.SOILS[P.soil].name}）` : ''}</b>${home ? `<div>点击种植 ${CROPS[S.me.seed].name}（${CROPS[S.me.seed].seed} 金币）</div>` : ''}`;
  else {
    const cr = CROPS[P.c], st = stageOf(P.p), pr = [P.pr.d && '缺水', P.pr.w && '杂草', P.pr.b && '害虫'].filter(Boolean);
    h = `<b>${cr.name}${P.soil ? `（${CFG.SOILS[P.soil].name}）` : ''}</b><div>${STAGE_NAME[st]}${cr.seasons > 1 ? ` · 第${P.sea + 1}季` : ''}</div>`;
    if (st === 4) {
      h += `<div>剩余 ×${P.y}${P.stolen ? `（被摘走 ${P.stolen}）` : ''}</div>`;
      if (!home) { const now = NET.now(); h += P.mine === 1 ? '<div class="warn">你已经摘过了</div>' : P.mine === 2 ? '<div class="warn">被狗赶走过，下季再来</div>' : P.left <= 0 ? '<div class="warn">已达保底，不能再摘</div>' : now < P.protectUntil ? `<div class="warn">主人保护中 ${Math.ceil((P.protectUntil - now) / 1000)} 秒</div>` : `<div class="ok">可以摘取（最多还能被摘 ${P.left}）</div>`; }
    } else h += `<div>成熟还需 ${fmtTime(CFG.remainSec(P))}</div><div class="bar"><i style="width:${Math.floor(P.p * 100)}%"></i></div>`;
    if (pr.length) h += `<div class="warn">${pr.join(' · ')}${home ? '' : '，点击帮忙'}</div>`;
  }
  if (tip._h !== h) { tip._h = h; tip.innerHTML = h; } tip.style.display = 'block';
  const x = Math.min(window.innerWidth - 210, mouse.x + 18), y = Math.max(8, mouse.y - 96); tip.style.transform = `translate(${x}px,${y}px)`;
}

/* ============ 启动 ============ */
/* V0.2 新角色模型（测试开关）：设置里打开，或网址带 ?v3=1。加载失败时保持原来的角色 */
async function applyNewChar(loud) {
  const on = true, hid = PREF.v3hero || 'v4_hero_boy';   /* 2026-10-26：新角色固定开启，原始小人不再使用 */
  if (!W3.ready) { setTimeout(() => applyNewChar(loud), 500); return; }
  const info = W3.ncInfo(); if (W3.newChar && info.heroId === hid && !loud) return; if (applyNewChar.busy && !loud) return; applyNewChar.busy = true;
  if (loud && on) toast('正在加载新角色…');
  try { const ok = await W3.setNewChar(on, hid); applyNewChar.tries = 0; if (loud && ok) toast(`已换上：${(CFG.ASSETS.find(a => a.id === hid) || { name: '男主角' }).name}`); }
  catch (e) { console.warn('角色模型加载失败', e); if (loud) toast('角色模型加载失败，正在重试…', 'warn'); const n = applyNewChar.tries = (applyNewChar.tries || 0) + 1; setTimeout(() => applyNewChar(false), Math.min(30000, 3000 * n)); /* 网络不好时自动重试 */ }
  finally { applyNewChar.busy = false; }
}
/* 选择自己的角色（男主角 / 14 位女主角），选了就自动打开「新角色模型」 */
function openCharPick() {
  const list = CFG.ASSETS.filter(a => a.kind === 'hero' && a.thumb), cur = PREF.v3hero || 'v4_hero_boy';
  openModal(`${H2('user', '选择角色', '美术新模型（测试中）：男主角和 14 位女主角都有走、跑、跳')}<div class="charpick">${list.map(a => `<button class="cpick${a.id === cur ? ' on' : ''}" data-hid="${a.id}"><img src="${a.thumb}" alt="" loading="lazy"><b>${esc(a.name)}</b></button>`).join('')}</div>`, {
    wide: true, mount: () => qsa('[data-hid]').forEach(b => b.onclick = async () => { sfx('click'); closeModal(true); await savePref({ v3hero: b.dataset.hid, v3char: true }); applyNewChar(true); })
  });
}
async function savePref(patch) { Object.assign(PREF, patch); try { localStorage.setItem('hf_pref', JSON.stringify(PREF)); } catch (e) { } if (S) await api('/api/me/profile', { settings: PREF }, { quiet: true }); }
async function enterGame(state, fresh) {
  bootMark('state'); applyState(state); started = true; closeModal(true); $('loading').classList.add('gone'); bootMark('shown'); W3.afterShown();
  NET.rememberAccount(S.me); NET.post('/api/accounts/remember').catch(() => { });
  view = { key: 'home', friend: null, plots: S.plots, farm: null }; renderTitle();
  await Promise.all([loadFriends(), loadNeighbors()]); loadMessages(false);
  const inv = new URLSearchParams(location.search).get('invite');
  if (inv) { history.replaceState(null, '', location.pathname); const r = await api('/api/invite/accept', { code: inv }, { quiet: true }); if (r && r.friend) { toast(r.added ? `你和 ${r.friend.name} 成为了好友` : `你和 ${r.friend.name} 已经是好友了`); await loadFriends(); refreshState(); } else if (r && r.self) toast('这是你自己的邀请链接，发给朋友吧'); else if (!r) toast('邀请链接无效', 'warn'); }
  checkMigrate(fresh);
  try { NET.post('/api/telemetry', { loadMs: Math.round(performance.now()), t: BOOT_T }).catch(() => { }); } catch (e) { }
  if (window.innerWidth < 600 && window.innerHeight > window.innerWidth) setTimeout(() => toast('横屏体验更好'), 1500);
  if (!PREF.pan) setTimeout(() => { if (W3.mode === 'walk') return; toast('新功能：按住拖动可以查看整个农场，轻点地块才会操作；双指或滚轮缩放'); savePref({ pan: 1 }); }, 3500);
}
function checkMigrate(fresh) {
  let old = null; try { old = JSON.parse(localStorage.getItem('harvest_farm_save_v1') || 'null'); } catch (e) { }
  let dismissed = false; try { dismissed = localStorage.getItem('hf_migrate_done') === '1'; } catch (e) { }
  if (old && !S.me.migrated && !dismissed) return openMigrate(old);
  if (fresh || !PREF.tut) welcome();
}
/* 启动耗时（毫秒，从页面开始加载算起），随遥测上报，用来看真机上哪一步慢 */
const BOOT_T = {}; function bootMark(k) { if (BOOT_T[k] === undefined) BOOT_T[k] = Math.round(performance.now()); }
async function boot() {
  bootMark('js');
  /* V0.4：先把配置和存档请求发出去，再生成 3D 场景（网络和计算同时进行，以前是场景生成完才开始请求） */
  const pre = { cfg: NET.get('/api/config'), st: NET.token ? NET.get('/api/state') : null }; pre.cfg.catch(() => { }); if (pre.st) pre.st.catch(() => { });
  try { W3.init(cv); initWalkUi(); bootMark('w3'); } catch (e) { console.error('3D 初始化失败', e && (e.stack || e.message)); $('loading').querySelector('p').innerHTML = '你的浏览器不支持 3D 画面（WebGL），请换用最新版 Chrome、Edge 或 Safari'; return; }
  window.addEventListener('resize', () => W3.resize()); requestAnimationFrame(frame);
  try { PREF = Object.assign(PREF, JSON.parse(localStorage.getItem('hf_pref') || '{}')); } catch (e) { }
  NET.onAuthLost(() => { if (started) { started = false; S = null; view = { key: 'home', friend: null, plots: blankPlots(), farm: null }; renderToolbar(); renderFriends(); toast('登录已失效，请重新登录', 'warn'); showLogin(); } });
  NET.onOnline(() => { if (started) poll(true); });
  for (let i = 0; i < 3; i++) {
    try { const c = await (i === 0 ? pre.cfg : NET.get('/api/config')); bootMark('cfg'); c.CROPS.forEach((x, k) => { if (CROPS[k]) ['seed', 'time', 'yield', 'price', 'exp', 'lv'].forEach(f => CROPS[k][f] = x[f]); }); Object.assign(RULES, c.RULES); CFG.setTz(c.TZ_MIN); break; }
    catch (e) { $('loading').querySelector('p').textContent = '正在连接服务器…（' + (i + 1) + '）'; await new Promise(r => setTimeout(r, 1500)); }
  }
  if (!NET.online) { $('loading').querySelector('p').innerHTML = '连接不上服务器，请检查网络后 <a href="javascript:location.reload()">刷新重试</a>'; return; }
  if (NET.token) { try { const st = await (pre.st || NET.get('/api/state')); return enterGame(st, false); } catch (e) { if (e.code === 'network') { $('loading').querySelector('p').innerHTML = '网络异常，<a href="javascript:location.reload()">点此重试</a>'; return; } } }
  // 没有当前登录：本机保存过账号就自动进入最近用过的那个（刚退出或要切换时显示账号列表）
  const accs = await NET.accounts(); let pickMode = false; try { pickMode = sessionStorage.getItem('hf_pick') === '1'; sessionStorage.removeItem('hf_pick'); } catch (e) { }
  if (accs.length && !pickMode) { try { const st = await NET.useAccount(accs[0]); return enterGame(st, false); } catch (e) { } }
  $('loading').classList.add('gone'); W3.afterShown(); showLogin(null, accs);
}
function bindGlobal() {
  $('mback').addEventListener('pointerdown', e => { if (e.target === $('mback')) closeModal(); });
  $('btn-help').innerHTML = ICON('help'); $('btn-menu').innerHTML = ICON('gear'); $('btn-snd').innerHTML = ICON('sound'); $('todbtn').innerHTML = ICON('cloudsun'); $('coinico').innerHTML = ICON('coin');
  $('btn-help').onclick = () => { ac(); openHelp(); }; $('btn-menu').onclick = () => { ac(); openMenu(); };
  $('btn-snd').onclick = () => { ac(); toggleSndPop(); };
  $('recenter').innerHTML = ICON('target') + '<span>回到农场中心</span>'; $('recenter').onclick = () => { sfx('click'); W3.resetView(); };
  $('todbtn').onclick = () => { const o = ['auto', 'day', 'dusk', 'night']; savePref({ tod: o[(o.indexOf(PREF.tod) + 1) % 4] }); renderTitle(); sfx('click'); toast(({ auto: '跟随真实时间', day: '白天', dusk: '黄昏', night: '夜晚' })[PREF.tod]); };
  $('card').onclick = () => { if (S) openProfile(); };
  $('log').onclick = () => openMessages();
  document.addEventListener('keydown', e => {
    if (typeof Zones !== 'undefined' && Zones.current !== 'home') return; /* 在野外区域时不响应家园的快捷键 */
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return; const k = e.key.toLowerCase();
    if (k === 'escape') { closeBuild(); closeModal(); tool = 'auto'; renderToolbar(); updateCursor(); }
    else if ($('mback').classList.contains('show') || !S) return;
    else if (k === 'v') setViewMode(W3.mode === 'walk' ? 'top' : 'walk');
    else if (W3.mode === 'walk' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { e.preventDefault(); KEYS.add(k); keyInput(); }
    else if (W3.mode === 'walk' && k === ' ') { e.preventDefault(); if (!e.repeat) { W3.setInput({ jump: true }); } }
    else if (W3.mode === 'walk' && (k === 'f' || k === 'enter')) { if (!e.repeat) doAct(); }
    else if (k === '1') toolbarClick('auto'); else if (k === '2' && view.key === 'home') toolbarClick('shovel'); else if (k === '3' && view.key === 'home') toolbarClick('fert');
    else if (W3.mode === 'walk') return;
    else if (k === 'q') (view.key === 'home' ? allHarvest : allSteal)(); else if (k === 'w') (view.key === 'home' ? allCare : allHelp)(); else if (k === 'e' && view.key === 'home') allPlant(); else if (k === 'h') goHome();
  });
  document.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (KEYS.delete(k)) keyInput(); });
  window.addEventListener('blur', () => { KEYS.clear(); keyInput(); });
  document.addEventListener('pointerdown', () => { ac(); startMusic(); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) poll(true); });
  setInterval(() => { if (started) tickView(); }, 500);
  // 合并轮询：页面在前台时每 15 秒一次（好友列表每 30 秒顺带一次）；后台且开了通知时每分钟一次
  setInterval(() => { if (!started) return; pollN++; if (!document.hidden) poll(pollN % 2 === 0); else if (PREF.notify && pollN % 4 === 0) poll(false); }, 15000);
  setInterval(() => { if (started && !document.hidden) renderLog(); }, 30000);
  // 后台任务（虚拟玩家等）：无服务器部署时由在线页面顺手触发，服务器端有租约去重
  setInterval(() => { if (started && !document.hidden) NET.post('/api/cron', {}).catch(() => { }); }, 120000 + Math.floor(Math.random() * 30000));
}
let pollN = 0, polling = false;
async function poll(side) {
  if (polling) return; polling = true; const key = view.key, vid = key !== 'home' && view.friend ? view.friend.id : 0;
  try {
    const r = await NET.get('/api/poll' + (side || vid ? '?' : '') + [side ? 'side=1' : '', vid ? 'visit=' + vid : ''].filter(Boolean).join('&'));
    if (r.friends) FR = r.friends; if (r.neighbors) NB = r.neighbors; if (r.friends || r.neighbors) renderFriends();
    if (r.state) applyState(r.state);
    if (vid && view.key === key) { if (r.farm) applyFarm(r.farm); else if (r.farmErr && r.farmErr.status === 403) { toast('无法再访问这个农场了', 'warn'); goHome(); } }
  } catch (e) { } finally { polling = false; }
}
async function visitRefresh() { if (view.key === 'home') return; const key = view.key; try { const r = await NET.get('/api/farm/' + view.friend.id); if (view.key === key) applyFarm(r.farm); } catch (e) { if (e.status === 403) { toast('无法再访问这个农场了', 'warn'); goHome(); } } }
window.addEventListener('DOMContentLoaded', () => { bindGlobal(); boot(); });
