'use strict';
/* ============ 基础工具 ============ */
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
function vgrad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }

/* ============ 作物数据 ============ */
const CROPS = [
  { id: 0, name: '萝卜', lv: 1, seed: 20, time: 40, yield: 12, price: 3, exp: 8, seasons: 1, art: { type: 'root', shape: 'radish', leaf: '#5fb83f', root: '#fbf3f4', blush: '#ff8aa5', hh: 72, is: 1.15 } },
  { id: 1, name: '白菜', lv: 2, seed: 45, time: 90, yield: 20, price: 4, exp: 16, seasons: 1, art: { type: 'cabbage', head: '#b9e56e', hh: 70, is: 1.1 } },
  { id: 2, name: '胡萝卜', lv: 3, seed: 80, time: 150, yield: 26, price: 5, exp: 28, seasons: 1, art: { type: 'root', shape: 'carrot', leaf: '#4fa83a', root: '#ff8c1a', hh: 74, is: 1.15 } },
  { id: 3, name: '番茄', lv: 4, seed: 130, time: 240, yield: 30, price: 7, exp: 42, seasons: 2, art: { type: 'bush', kind: 'tomato', fruit: '#ec3b2e', unripe: '#a8d060', nf: 4, h: 58, hh: 80, is: 0.95 } },
  { id: 4, name: '草莓', lv: 5, seed: 200, time: 360, yield: 36, price: 9, exp: 62, seasons: 2, art: { type: 'bush', kind: 'berry', fruit: '#ff3355', unripe: '#d6e8a8', nf: 5, h: 24, low: true, hh: 54, is: 1.2 } },
  { id: 5, name: '玉米', lv: 6, seed: 300, time: 540, yield: 44, price: 11, exp: 90, seasons: 2, art: { type: 'corn', hh: 112, is: 0.72 } },
  { id: 6, name: '辣椒', lv: 7, seed: 420, time: 720, yield: 48, price: 13, exp: 125, seasons: 2, art: { type: 'bush', kind: 'chili', fruit: '#e8281e', unripe: '#6fbf3a', nf: 5, h: 54, hh: 78, is: 1.0 } },
  { id: 7, name: '茄子', lv: 8, seed: 560, time: 900, yield: 54, price: 15, exp: 160, seasons: 2, art: { type: 'bush', kind: 'egg', fruit: '#7b3fa8', unripe: '#8fae6a', nf: 3, h: 56, hh: 80, is: 1.0 } },
  { id: 8, name: '南瓜', lv: 10, seed: 800, time: 1200, yield: 60, price: 18, exp: 220, seasons: 1, art: { type: 'vine', kind: 'pumpkin', fruit: '#ff9a1f', hh: 64, is: 1.05 } },
  { id: 9, name: '西瓜', lv: 12, seed: 1200, time: 1800, yield: 66, price: 24, exp: 330, seasons: 2, art: { type: 'vine', kind: 'melon', fruit: '#37993b', hh: 62, is: 1.0 } },
  { id: 10, name: '向日葵', lv: 14, seed: 1800, time: 2400, yield: 72, price: 32, exp: 480, seasons: 1, art: { type: 'sunflower', hh: 120, is: 0.7 } },
  { id: 11, name: '菠萝', lv: 16, seed: 2800, time: 3600, yield: 80, price: 45, exp: 760, seasons: 1, art: { type: 'pine', hh: 80, is: 1.0 } },
];

/* ============ 作物绘制（原点=土地中心） ============ */
function seedMound(c) {
  ell(c, 0, 2, 16, 6.5, '#7a4b25', '#44280f', 1.6); ell(c, -3, 0, 7, 2.6, '#9a6334');
  ell(c, 4, 1, 2.2, 1.5, '#ecd9a0', '#5a3a1a', 0.8, 0.5); ell(c, -6, 2, 2.2, 1.5, '#ecd9a0', '#5a3a1a', 0.8, -0.4); ell(c, 1, -1, 2, 1.4, '#ecd9a0', '#5a3a1a', 0.8);
}
function sprout(c, sw) {
  c.save(); c.rotate(sw);
  c.strokeStyle = '#4e9a30'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(0, 1); c.quadraticCurveTo(1, -8, 0, -15); c.stroke();
  leaf(c, 0, -14, 14, 6, -2.55, '#86d953', '#3d7a24'); leaf(c, 0, -14, 14, 6, -0.6, '#93e05c', '#3d7a24');
  c.restore();
}
function cropRoot(c, a, k, ripe, sw) {
  const carrot = a.shape === 'carrot'; const rk = ripe ? 1 : (k > 0.8 ? 0.6 : 0);
  if (rk > 0) {
    if (carrot) { ell(c, 0, -1, 10 * rk + 1, 6 * rk, a.root, shade(a.root, -0.45), 1.6); ell(c, -3, -2.5, 3.5 * rk, 2 * rk, 'rgba(255,255,255,.4)'); }
    else {
      ell(c, 0, -6 * rk, 13 * rk, 12 * rk, a.root, '#b88a96', 1.6);
      c.save(); c.beginPath(); c.ellipse(0, -6 * rk, 13 * rk, 12 * rk, 0, Math.PI * 1.08, Math.PI * 1.92); c.lineTo(0, -6 * rk); c.closePath(); c.fillStyle = a.blush; c.fill(); c.restore();
      ell(c, -5 * rk, -9 * rk, 4 * rk, 3 * rk, 'rgba(255,255,255,.6)');
    }
  }
  const n = 7, by = rk > 0 ? (carrot ? -4 : -11 * rk) : -3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5, ang = -Math.PI / 2 + t * 2.1 + sw * 1.5, len = (30 + ((i % 2) ? 10 : 0) + (i === 3 ? 12 : 0)) * k;
    const w = carrot ? 4.5 * k + 1.5 : 9 * k + 2;
    leaf(c, 0, by, len, w, ang, i % 2 ? a.leaf : shade(a.leaf, 0.14), shade(a.leaf, -0.45), shade(a.leaf, -0.3));
  }
}
function cropCabbage(c, a, k, ripe, sw) {
  const R = 24 * k + 4;
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + (i - 2.5) * 0.66 + sw;
    c.save(); c.translate(0, -2); c.rotate(ang);
    ell(c, R * 0.58, 0, R * 0.66, R * 0.4, i % 2 ? '#6cbc47' : '#58a73b', '#2f6b1f', 1.5); c.restore();
  }
  const hk = ripe ? 1 : 0.6 + k * 0.25;
  const g = c.createRadialGradient(-R * 0.2, -R * 0.9 * hk, 2, 0, -R * 0.7 * hk, R * 1.1);
  g.addColorStop(0, '#f6ffd2'); g.addColorStop(1, a.head);
  ell(c, 0, -R * 0.62 * hk, R * 0.74 * hk, R * 0.86 * hk, g, '#4b8a2c', 1.8);
  c.strokeStyle = 'rgba(70,130,40,.5)'; c.lineWidth = 1.3;
  for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(j * R * 0.22 * hk, -R * 0.05 * hk); c.quadraticCurveTo(j * R * 0.5 * hk, -R * 0.65 * hk, j * R * 0.16 * hk, -R * 1.38 * hk); c.stroke(); }
}
function drawFruit(c, kind, x, y, s, ripe, a, sw) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const col = ripe ? a.fruit : a.unripe, dk = shade(col, -0.5);
  if (kind === 'tomato') {
    ell(c, 0, 0, 9.5, 8.5, col, dk, 1.5); ell(c, -3.5, -3, 3.2, 2.2, 'rgba(255,255,255,.55)', null, 0, -0.5);
    for (let i = 0; i < 5; i++) leaf(c, 0, -7, 6, 2, -Math.PI / 2 + (i - 2) * 0.9, '#3f9a2a', '#2b6a1c');
  } else if (kind === 'chili') {
    c.rotate(0.12 + sw * 2);
    c.beginPath(); c.moveTo(-3, -8); c.bezierCurveTo(6, -7, 6, 7, -2, 18); c.bezierCurveTo(-1, 7, -8, 0, -3, -8); c.closePath();
    c.fillStyle = col; c.fill(); c.lineWidth = 1.4; c.strokeStyle = dk; c.stroke(); ell(c, -1, -2, 1.3, 5, 'rgba(255,255,255,.4)', null, 0, 0.1);
    ell(c, -3, -9, 4.5, 2.6, '#3f9a2a', '#2b6a1c', 1.2);
  } else if (kind === 'egg') {
    c.rotate(0.1); ell(c, 0, 5, 7.5, 12, col, dk, 1.5); ell(c, -2.5, 0, 2, 6, 'rgba(255,255,255,.35)', null, 0, 0.1);
    ell(c, 0, -7, 7, 3.4, '#4aa030', '#2b6a1c', 1.2);
  } else if (kind === 'berry') {
    c.beginPath(); c.moveTo(0, 11); c.bezierCurveTo(-12, 3, -9, -9, 0, -6); c.bezierCurveTo(9, -9, 12, 3, 0, 11); c.closePath();
    c.fillStyle = col; c.fill(); c.lineWidth = 1.4; c.strokeStyle = dk; c.stroke();
    c.fillStyle = ripe ? '#ffe9a0' : '#fff7d0';
    [[-4, -1], [3, -2], [0, 3], [-5, 4], [5, 3], [0, -4]].forEach(p => ell(c, p[0], p[1], 0.9, 1.3, c.fillStyle));
    for (let i = 0; i < 5; i++) leaf(c, 0, -6, 6, 2, -Math.PI / 2 + (i - 2) * 0.8, '#4aa832', '#2b6a1c');
  }
  c.restore();
}
function cropBush(c, a, k, ripe, sw) {
  const H = a.h * k, lean = sw * 40;
  if (a.low) {
    // 草莓：矮丛
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI / 2 + (i - 3) * 0.55 + sw; const len = (20 + (i % 2) * 6) * k + 4;
      leaf(c, 0, -2, len, 7 * k + 2, ang, i % 2 ? '#58b043' : '#69c04f', '#2d6a1f', '#3e8a2c');
    }
    if (k >= 0.8) { const pos = [[-15, -3], [14, -4], [-6, -13], [8, -10], [0, -3]]; for (let i = 0; i < a.nf; i++) drawFruit(c, 'berry', pos[i][0], pos[i][1] - (ripe ? 0 : 1), ripe ? 0.95 : 0.6, ripe, a, sw); }
    return;
  }
  c.strokeStyle = '#2f6b1f'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.4, -H * 0.5, lean, -H); c.stroke();
  c.strokeStyle = '#58a73b'; c.lineWidth = 3.6; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.4, -H * 0.5, lean, -H); c.stroke();
  for (let i = 0; i < 7; i++) {
    const t = 0.18 + i * 0.12, px = lean * t * t * 1.6, py = -H * t, dir = i % 2 ? 1 : -1;
    leaf(c, px, py, 22 * k + 6, 7 * k + 2, dir > 0 ? -0.5 : Math.PI + 0.5, i % 2 ? '#5db044' : '#6cc04f', '#2d6a1f', '#3e8a2c');
  }
  leaf(c, lean, -H, 20 * k + 4, 7 * k + 2, -Math.PI / 2, '#6cc04f', '#2d6a1f');
  if (k >= 0.8) {
    const pos = [[-17, 0.42], [16, 0.55], [-7, 0.82], [10, 0.25], [-14, 0.15]];
    for (let i = 0; i < a.nf; i++) { const fx = pos[i][0] + lean * pos[i][1] * 0.5, fy = -H * pos[i][1]; drawFruit(c, a.kind, fx, fy + 6, ripe ? 1 : 0.62, ripe, a, sw); }
  }
}
function cropCorn(c, a, k, ripe, sw) {
  const H = 84 * k;
  c.strokeStyle = '#2f6b1f'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(sw * 36, -H); c.stroke();
  c.strokeStyle = '#7cc255'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(sw * 36, -H); c.stroke();
  for (let i = 0; i < 7; i++) {
    const t = 0.14 + i * 0.12, y = -H * t, x0 = sw * 36 * t, dir = i % 2 ? 1 : -1, len = ((i < 3 ? 40 : 32) * k) + 8;
    c.beginPath(); c.moveTo(x0, y);
    c.quadraticCurveTo(x0 + dir * len * 0.55, y - len * 0.55, x0 + dir * len, y + len * 0.28 + sw * 30 * dir);
    c.quadraticCurveTo(x0 + dir * len * 0.5, y - len * 0.2, x0, y + 4); c.closePath();
    c.fillStyle = i % 2 ? '#74bd4e' : '#86cf5c'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#3d7a24'; c.stroke();
  }
  if (k >= 0.8) {
    [[-1, 0.5], [1, 0.38]].forEach((p, i) => {
      const x = sw * 36 * p[1] + p[0] * 9, y = -H * p[1], s = ripe ? 1 : 0.7;
      c.save(); c.translate(x, y); c.rotate(p[0] * 0.25); c.scale(s, s);
      ell(c, 0, -2, 7, 17, ripe ? '#ffd23a' : '#d9e58a', '#a8841a', 1.4);
      if (ripe) { c.strokeStyle = 'rgba(190,140,20,.6)'; c.lineWidth = 1; for (let r = -12; r <= 8; r += 5) { c.beginPath(); c.moveTo(-5, r); c.lineTo(5, r); c.stroke(); } for (let q = -3; q <= 3; q += 3) { c.beginPath(); c.moveTo(q, -15); c.lineTo(q, 12); c.stroke(); } }
      leaf(c, 0, 12, 22, 6, -Math.PI / 2 - 0.5, '#5aae3f', '#2d6a1f'); leaf(c, 0, 12, 22, 6, -Math.PI / 2 + 0.5, '#6cc04f', '#2d6a1f');
      c.strokeStyle = '#d99a3a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -17); c.quadraticCurveTo(3, -23, 7, -24); c.stroke();
      c.restore();
    });
  }
  // 雄穗
  c.strokeStyle = '#b8a040'; c.lineWidth = 1.6;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(sw * 36, -H); c.quadraticCurveTo(sw * 36 + i * 5, -H - 14 * k, sw * 36 + i * 9, -H - 8 * k); c.stroke(); }
}
function cropVine(c, a, k, ripe, sw) {
  c.strokeStyle = '#3f8a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-30 * k, 4); c.quadraticCurveTo(0, -4, 32 * k, 3); c.stroke();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + 0.5, lx = Math.cos(ang) * 28 * k, ly = Math.sin(ang) * 11 * k - 5;
    ell(c, lx, ly - 7 * k, 13 * k + 2, 10 * k + 1, i % 2 ? '#5cae3d' : '#4f9f35', '#2d6a1f', 1.5, Math.cos(ang) * 0.4);
    ell(c, lx, ly - 7 * k, 5 * k, 1, null, 'rgba(30,90,20,.5)', 1, Math.cos(ang) * 0.4);
  }
  if (k >= 0.8) {
    const fs = ripe ? 1 : 0.62; const col = ripe ? a.fruit : mixc(a.fruit, '#7fbf4a', 0.5);
    if (a.kind === 'pumpkin') {
      const R = 22 * fs, Hh = 17 * fs;
      ell(c, 0, -Hh - 2, R, Hh, col, shade(col, -0.45), 2);
      c.strokeStyle = shade(col, -0.28); c.lineWidth = 1.6;
      for (let j = -2; j <= 2; j++) { c.beginPath(); c.ellipse(0, -Hh - 2, Math.max(1, Math.abs(j) * R * 0.28), Hh, 0, 0, TAU); if (j === 0) { c.beginPath(); c.moveTo(0, -Hh * 2 - 2); c.lineTo(0, -2); } c.stroke(); }
      ell(c, -R * 0.4, -Hh * 1.4, R * 0.18, Hh * 0.25, 'rgba(255,255,255,.4)', null, 0, -0.6);
      rrect(c, -3, -Hh * 2 - 8 * fs, 6, 9 * fs, 2, '#5a7a2a', '#33480f', 1.2);
    } else {
      const R = 26 * fs, Hh = 18 * fs; const cx = 0, cy = -Hh - 2;
      c.save(); c.beginPath(); c.ellipse(cx, cy, R, Hh, 0, 0, TAU); c.clip();
      c.fillStyle = shade(col, ripe ? 0.05 : 0.25); c.fillRect(-R, cy - Hh, R * 2, Hh * 2);
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 3.2 * fs;
      for (let j = -3; j <= 3; j++) { c.beginPath(); c.moveTo(j * R * 0.3, cy - Hh); c.quadraticCurveTo(j * R * 0.48, cy, j * R * 0.3, cy + Hh); c.stroke(); }
      c.restore();
      ell(c, cx, cy, R, Hh, null, shade(col, -0.55), 2);
      ell(c, -R * 0.4, cy - Hh * 0.45, R * 0.25, Hh * 0.18, 'rgba(255,255,255,.45)', null, 0, -0.4);
    }
  }
}
function cropSunflower(c, a, k, ripe, sw) {
  const H = 96 * k, hx = sw * 50, hy = -H;
  c.strokeStyle = '#2f6b1f'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(hx * 0.2, -H * 0.5, hx, hy); c.stroke();
  c.strokeStyle = '#69b044'; c.lineWidth = 5.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(hx * 0.2, -H * 0.5, hx, hy); c.stroke();
  for (let i = 0; i < 4; i++) { const t = 0.2 + i * 0.16, dir = i % 2 ? 1 : -1; leaf(c, hx * t * 0.3, -H * t, 34 * k + 6, 14 * k + 3, dir > 0 ? -0.35 : Math.PI + 0.35, '#5cae3d', '#2d6a1f', '#3e8a2c'); }
  c.save(); c.translate(hx, hy);
  if (ripe) {
    c.rotate(0.12); const R = 20;
    for (let i = 0; i < 16; i++) { c.save(); c.rotate(i / 16 * TAU); ell(c, R + 4, 0, 11, 4.6, i % 2 ? '#ffc61a' : '#ffd84a', '#c88a0a', 1.2); c.restore(); }
    ell(c, 0, 0, R * 0.9, R * 0.9, '#6b3f1a', '#3e2208', 1.8);
    c.fillStyle = '#8a5a2a'; for (let i = 0; i < 26; i++) { const r = Math.sqrt(i / 26) * R * 0.78, an = i * 2.4; ell(c, Math.cos(an) * r, Math.sin(an) * r, 1.6, 1.6, '#9c6a34'); }
    ell(c, 0, 0, R * 0.25, R * 0.25, '#4a2a10');
  } else {
    const s = 0.5 + k * 0.4; ell(c, 0, -2, 11 * s, 12 * s, '#6cbc47', '#2d6a1f', 1.6);
    for (let i = 0; i < 6; i++) leaf(c, 0, 2, 12 * s, 3.5, -Math.PI / 2 + (i - 2.5) * 0.55, '#4f9f35', '#2d6a1f');
    if (k > 0.8) for (let i = -1; i <= 1; i++) leaf(c, 0, -8, 9, 3, -Math.PI / 2 + i * 0.5, '#ffd84a', '#c88a0a');
  }
  c.restore();
}
function cropPine(c, a, k, ripe, sw) {
  const by = -2;
  const spikes = (cx, cy, n, len, spread, col) => { for (let i = 0; i < n; i++) { const t = i / (n - 1) - 0.5; leaf(c, cx, cy, len * (1 - Math.abs(t) * 0.35), 4.6, -Math.PI / 2 + t * spread + sw * 1.4, i % 2 ? col : shade(col, 0.15), '#2d6a1f', '#3e8a2c'); } };
  if (k < 0.8) { spikes(0, by, 9, 38 * k + 10, 2.9, '#5cae3d'); return; }
  const bw = 17 * (ripe ? 1 : 0.78), bh = 24 * (ripe ? 1 : 0.78), cy = -bh - 4;
  const col = ripe ? '#f2b631' : '#9ac45a';
  const g = c.createRadialGradient(-bw * 0.3, cy - bh * 0.4, 2, 0, cy, bh * 1.1); g.addColorStop(0, shade(col, 0.35)); g.addColorStop(1, shade(col, -0.12));
  ell(c, 0, cy, bw, bh, g, shade(col, -0.5), 2);
  c.save(); c.beginPath(); c.ellipse(0, cy, bw, bh, 0, 0, TAU); c.clip();
  c.strokeStyle = shade(col, -0.38); c.lineWidth = 1.3;
  for (let i = -5; i <= 5; i++) { c.beginPath(); c.moveTo(i * 6 - 22, cy - bh); c.lineTo(i * 6 + 22, cy + bh); c.stroke(); c.beginPath(); c.moveTo(i * 6 + 22, cy - bh); c.lineTo(i * 6 - 22, cy + bh); c.stroke(); }
  c.restore();
  spikes(0, cy - bh + 6, 9, 36 * (ripe ? 1 : 0.8), 2.2, '#4e9f35');
  leaf(c, -10, by, 22, 4.6, Math.PI + 0.4, '#5cae3d', '#2d6a1f'); leaf(c, 10, by, 22, 4.6, -0.4, '#5cae3d', '#2d6a1f');
}
function drawCrop(c, crop, stage, t, ph) {
  const a = crop.art, sw = Math.sin(t * 1.7 + ph) * 0.05;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (stage >= 1) ell(c, 0, 3, 9 + stage * 4, 3.5 + stage, 'rgba(0,0,0,.2)');
  if (stage === 0) seedMound(c);
  else if (stage === 1) sprout(c, sw * 2);
  else {
    const k = stage === 2 ? 0.62 : stage === 3 ? 0.86 : 1, ripe = stage === 4;
    switch (a.type) {
      case 'root': cropRoot(c, a, k, ripe, sw); break;
      case 'cabbage': cropCabbage(c, a, k, ripe, sw); break;
      case 'bush': cropBush(c, a, k, ripe, sw); break;
      case 'corn': cropCorn(c, a, k, ripe, sw); break;
      case 'vine': cropVine(c, a, k, ripe, sw); break;
      case 'sunflower': cropSunflower(c, a, k, ripe, sw); break;
      case 'pine': cropPine(c, a, k, ripe, sw); break;
    }
  }
  c.restore();
}
const _iconCache = {};
function cropIcon(id) {
  if (_iconCache[id]) return _iconCache[id];
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const c = cv.getContext('2d');
  const cr = CROPS[id]; const s = (cr.art.is || 1) * 0.95;
  c.translate(48, 82); c.scale(s * 1.15, s * 1.15); drawCrop(c, cr, 4, 0, 0);
  return (_iconCache[id] = cv.toDataURL());
}
