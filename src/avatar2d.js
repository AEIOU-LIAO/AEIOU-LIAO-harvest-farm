'use strict';
/* 2D 绘制工具：仅用于玩家头像（场景已改为 3D） */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(h, amt) { const [r, g, b] = hex2rgb(h); if (amt >= 0) return rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt); return rgb2hex(r * (1 + amt), g * (1 + amt), b * (1 + amt)); }
function mixc(h1, h2, t) { const a = hex2rgb(h1), b = hex2rgb(h2); return rgb2hex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function ell(c, x, y, rx, ry, fill, stroke, lw, rot) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
}
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}
function rpath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function rrect(c, x, y, w, h, r, fill, stroke, lw) {
  rpath(c, x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
}
function leaf(c, x, y, len, wid, ang, fill, stroke, vein) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(len * 0.25, -wid, len * 0.75, -wid * 0.9, len, 0);
  c.bezierCurveTo(len * 0.75, wid * 0.9, len * 0.25, wid, 0, 0); c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = 1.5; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
  if (vein) { c.beginPath(); c.moveTo(len * 0.08, 0); c.lineTo(len * 0.85, 0); c.lineWidth = 1.1; c.strokeStyle = vein; c.stroke(); }
  c.restore();
}

/* ============ 头像 ============ */
function drawAvatar(cv, st) {
  const c = cv.getContext('2d'), w = cv.width, s = w / 64; c.setTransform(s, 0, 0, s, 0, 0); c.clearRect(0, 0, 64, 64);
  const bgg = c.createLinearGradient(0, 0, 0, 64); bgg.addColorStop(0, st.bg1 || '#9fe0ff'); bgg.addColorStop(1, st.bg2 || '#d8f5c0'); c.fillStyle = bgg; c.fillRect(0, 0, 64, 64);
  ell(c, 32, 70, 26, 20, st.shirt || '#4a8fd8', shade(st.shirt || '#4a8fd8', -0.4), 2);
  rrect(c, 28, 44, 8, 8, 2, st.skin || '#ffd9b0');
  if (st.hair && !st.hat) { ell(c, 32, 30, 20, 20, st.hair, shade(st.hair, -0.4), 2); }
  ell(c, 32, 33, 17, 17, st.skin || '#ffd9b0', shade(st.skin || '#ffd9b0', -0.45), 2);
  if (st.hair && st.fringe) { c.beginPath(); c.ellipse(32, 23, 17, 10, 0, Math.PI, TAU); c.fillStyle = st.hair; c.fill(); c.lineWidth = 2; c.strokeStyle = shade(st.hair, -0.4); c.stroke(); }
  ell(c, 25, 34, 2.4, 3, '#2a2018'); ell(c, 39, 34, 2.4, 3, '#2a2018'); ell(c, 25.8, 33, 0.9, 0.9, '#fff'); ell(c, 39.8, 33, 0.9, 0.9, '#fff');
  ell(c, 20, 40, 3.4, 2.2, 'rgba(255,120,120,.4)'); ell(c, 44, 40, 3.4, 2.2, 'rgba(255,120,120,.4)');
  c.strokeStyle = '#8a3a2a'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.arc(32, 38, 5, 0.25, Math.PI - 0.25); c.stroke();
  if (st.hat) { ell(c, 32, 22, 27, 7, '#f0c860', '#8a6a1a', 2); c.beginPath(); c.ellipse(32, 20, 15, 12, 0, Math.PI, TAU); c.fillStyle = '#f6d878'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#8a6a1a'; c.stroke(); rrect(c, 17, 17, 30, 4, 1, st.band || '#d9553a'); }
  if (st.pig) { ell(c, 14, 34, 5, 12, st.hair, shade(st.hair, -0.4), 1.6); ell(c, 50, 34, 5, 12, st.hair, shade(st.hair, -0.4), 1.6); }
}
