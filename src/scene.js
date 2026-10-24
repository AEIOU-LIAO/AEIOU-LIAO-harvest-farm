'use strict';
/* ============ 场景几何 ============ */
const HW = 85, HH = 42.5, OX = 715, OY = 285 + 42.5, COLS = 6, ROWS = 4, GROUND_Y = 232;
const GU = (u, v) => OX + (u - v) * HW, GV = (u, v) => OY - HH + (u + v) * HH;
function cellPos(c, r) { return { x: OX + (c - r) * HW, y: OY + (c + r) * HH }; }
const YE = 0.5; // 院子外扩
const YARD = { T: [GU(-YE, -YE), GV(-YE, -YE)], R: [GU(COLS + YE, -YE), GV(COLS + YE, -YE)], B: [GU(COLS + YE, ROWS + YE), GV(COLS + YE, ROWS + YE)], L: [GU(-YE, ROWS + YE), GV(-YE, ROWS + YE)] };
function inYard(x, y, m) {
  m = m || 0; const u = ((x - OX) / HW + (y - (OY - HH)) / HH) / 2, v = ((y - (OY - HH)) / HH - (x - OX) / HW) / 2;
  return u > -YE - m && u < COLS + YE + m && v > -YE - m && v < ROWS + YE + m;
}
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/* ============ 天空与光照 ============ */
const SKY = [[0, '#0a1432', '#1c2a5c'], [5, '#1f2f6a', '#8a6a9a'], [6.5, '#7fb0e8', '#ffd2a0'], [9, '#4fb0f0', '#bfe9ff'], [15, '#46a8ee', '#d6f1ff'], [17.5, '#6fa0e0', '#ffd9a0'], [18.8, '#e8805a', '#ffc880'], [19.8, '#3a3878', '#c8706a'], [21, '#10204a', '#2a3a78'], [24, '#0a1432', '#1c2a5c']];
function skyAt(h) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [mixc(a[1], b[1], t), mixc(a[2], b[2], t)]; }
  }
  return [SKY[0][1], SKY[0][2]];
}
function nightK(h) {
  if (h >= 7 && h <= 17.5) return 0;
  if (h < 5 || h >= 21) return 1;
  if (h < 7) return 1 - (h - 5) / 2;
  return (h - 17.5) / 3.5;
}
function drawSky(c, vb, h, rain) {
  const [top, bot] = skyAt(h);
  let g = c.createLinearGradient(0, vb.y0, 0, GROUND_Y + 20); g.addColorStop(0, rain ? mixc(top, '#7b8794', 0.55) : top); g.addColorStop(1, rain ? mixc(bot, '#aab4bd', 0.5) : bot);
  c.fillStyle = g; c.fillRect(vb.x0, vb.y0, vb.x1 - vb.x0, GROUND_Y + 20 - vb.y0);
}
function drawCelestial(c, vb, h, t) {
  const nk = nightK(h);
  if (nk > 0.2) {
    const rnd = mulberry32(7); c.save();
    for (let i = 0; i < 90; i++) {
      const x = vb.x0 + rnd() * (vb.x1 - vb.x0), y = vb.y0 + rnd() * (GROUND_Y - 30 - vb.y0), tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
      c.globalAlpha = nk * (0.35 + 0.65 * tw) * (rnd() * 0.6 + 0.4); c.fillStyle = '#fff'; c.fillRect(x, y, 2, 2);
    }
    c.restore();
  }
  const mid = (vb.x0 + vb.x1) / 2, span = (vb.x1 - vb.x0) * 0.42;
  if (h >= 5.5 && h <= 19.5) {
    const p = (h - 5.5) / 14, x = mid + (p - 0.5) * 2 * span, y = GROUND_Y - 30 - Math.sin(p * Math.PI) * 170;
    const g = c.createRadialGradient(x, y, 5, x, y, 90); g.addColorStop(0, 'rgba(255,240,170,.75)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.fillRect(x - 100, y - 100, 200, 200);
    ell(c, x, y, 28, 28, '#ffe45e', '#ffb61e', 3);
    c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#ffe9a0'; c.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.15; c.beginPath(); c.moveTo(x + Math.cos(a) * 36, y + Math.sin(a) * 36); c.lineTo(x + Math.cos(a) * (44 + (i % 2) * 8), y + Math.sin(a) * (44 + (i % 2) * 8)); c.stroke(); }
    c.restore();
  }
  if (h >= 18.5 || h <= 6.5) {
    const p = h >= 18.5 ? (h - 18.5) / 12 : (h + 5.5) / 12, x = mid + (p - 0.5) * 2 * span, y = GROUND_Y - 40 - Math.sin(p * Math.PI) * 190;
    const g = c.createRadialGradient(x, y, 5, x, y, 80); g.addColorStop(0, 'rgba(220,230,255,.5)'); g.addColorStop(1, 'rgba(220,230,255,0)');
    c.fillStyle = g; c.fillRect(x - 90, y - 90, 180, 180);
    ell(c, x, y, 24, 24, '#f6f3d8', '#d6d2a8', 2); ell(c, x + 6, y - 6, 5, 5, 'rgba(180,176,140,.5)'); ell(c, x - 8, y + 7, 7, 6, 'rgba(180,176,140,.4)');
  }
}
function cloud(c, x, y, s, alpha) {
  c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = alpha;
  c.fillStyle = '#fff';
  [[0, 0, 34, 20], [-34, 6, 26, 15], [34, 6, 28, 16], [-12, -12, 22, 18], [16, -10, 24, 17], [60, 10, 18, 11], [-58, 10, 17, 10]].forEach(p => ell(c, p[0], p[1], p[2], p[3], '#fff'));
  c.globalAlpha = alpha * 0.45; ell(c, 0, 14, 62, 8, '#c6d8ee'); c.restore();
}
const CLOUDS = [{ x: 150, y: 90, s: 1.2, v: 6 }, { x: 520, y: 150, s: 0.8, v: 4 }, { x: 900, y: 70, s: 1.5, v: 5 }, { x: 1250, y: 130, s: 1.0, v: 7 }, { x: 1550, y: 60, s: 1.3, v: 4.5 }, { x: 1900, y: 150, s: 0.9, v: 6 }];
function drawClouds(c, vb, t, rain, nk) {
  const W = (vb.x1 - vb.x0) + 400;
  CLOUDS.forEach((cl, i) => {
    const x = vb.x0 - 200 + (((cl.x + t * cl.v) % W) + W) % W;
    cloud(c, x, cl.y + vb.y0 * 0 + Math.sin(t * 0.3 + i) * 3, cl.s * (rain ? 1.3 : 1), rain ? 0.95 : 0.9 * (1 - nk * 0.55));
  });
}
function drawBirds(c, vb, t) {
  c.save(); c.strokeStyle = 'rgba(40,50,70,.7)'; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const span = vb.x1 - vb.x0 + 300, x = vb.x0 - 150 + (((t * 38 + i * 160) % span) + span) % span, y = 110 + i * 26 + Math.sin(t * 0.8 + i) * 12, f = Math.sin(t * 9 + i * 2) * 5;
    c.beginPath(); c.moveTo(x - 10, y + f * 0.5); c.quadraticCurveTo(x - 5, y - f, x, y); c.quadraticCurveTo(x + 5, y - f, x + 10, y + f * 0.5); c.stroke();
  }
  c.restore();
}

/* ============ 静态背景 ============ */
function hillLayer(c, vb, baseY, amp, c1, c2, f, ph) {
  c.beginPath(); c.moveTo(vb.x0, GROUND_Y + 30);
  for (let x = vb.x0; x <= vb.x1 + 20; x += 16) c.lineTo(x, baseY - amp * (0.5 + 0.5 * Math.sin(x * f + ph)) - amp * 0.45 * Math.sin(x * f * 2.3 + ph * 1.7));
  c.lineTo(vb.x1, GROUND_Y + 30); c.closePath();
  const g = vgrad(c, baseY - amp * 1.4, GROUND_Y + 30, [[0, c1], [1, c2]]); c.fillStyle = g; c.fill();
}
function tree(c, x, y, s, hue, apples) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 0, 4, 40, 11, 'rgba(0,0,0,.18)');
  rrect(c, -8, -50, 16, 52, 4, '#8a5a2b', '#4a2d12', 2); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(2, -48, 5, 48);
  const base = hue || '#4aa83a', hi = shade(base, 0.22), dk = shade(base, -0.38);
  [[0, -92, 34], [-30, -68, 28], [30, -68, 28], [0, -62, 34], [-16, -108, 24], [18, -104, 24]].forEach(b => ell(c, b[0], b[1], b[2], b[2] * 0.92, base, dk, 2.2));
  [[-8, -100, 15], [-26, -74, 11], [14, -84, 12], [-2, -66, 12]].forEach(b => ell(c, b[0], b[1], b[2], b[2] * 0.8, hi));
  if (apples) [[-18, -82], [14, -96], [24, -66], [-30, -62], [2, -70]].forEach(p => { ell(c, p[0], p[1], 5, 5, '#e8372e', '#8a1a14', 1.2); ell(c, p[0] - 1.5, p[1] - 1.5, 1.5, 1.2, 'rgba(255,255,255,.7)'); });
  c.restore();
}
function bush(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s); ell(c, 0, 3, 32, 8, 'rgba(0,0,0,.16)');
  const base = col || '#4ea43a'; [[-16, -10, 16], [0, -16, 20], [16, -10, 16], [0, -6, 22]].forEach(b => ell(c, b[0], b[1], b[2], b[2] * 0.8, base, shade(base, -0.4), 2));
  ell(c, -6, -20, 9, 6, shade(base, 0.25)); c.restore();
}
function flower(c, x, y, col, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = '#3f8a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 7); c.stroke();
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(c, Math.cos(a) * 3, Math.sin(a) * 3 - 1, 2.4, 2.4, col); }
  ell(c, 0, -1, 1.7, 1.7, '#ffd23a'); c.restore();
}
function house(c, x, y, roof, wall) {
  c.save(); c.translate(x, y);
  ell(c, 0, 4, 100, 16, 'rgba(0,0,0,.2)');
  // 烟囱
  rrect(c, 34, -138, 20, 46, 2, '#b05a4a', '#5a2a22', 2); rrect(c, 31, -142, 26, 8, 2, '#8a463a', '#5a2a22', 2);
  // 墙
  rrect(c, -72, -78, 144, 80, 3, wall, shade(wall, -0.55), 2.4);
  c.strokeStyle = shade(wall, -0.2); c.lineWidth = 1.2; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(-72, -78 + i * 13.3); c.lineTo(72, -78 + i * 13.3); c.stroke(); }
  // 屋顶
  poly(c, [[-92, -70], [0, -146], [92, -70]], roof, shade(roof, -0.55), 3);
  poly(c, [[-92, -70], [0, -146], [0, -138], [-84, -70]], shade(roof, 0.25));
  c.strokeStyle = shade(roof, -0.25); c.lineWidth = 1.6; for (let i = 1; i <= 4; i++) { const yy = -70 - i * 15, hw = 92 * (1 - i * 0.2); c.beginPath(); c.moveTo(-hw + 2, yy + 4); c.lineTo(hw - 2, yy + 4); c.stroke(); }
  rrect(c, -96, -75, 192, 9, 3, shade(roof, -0.15), shade(roof, -0.55), 2);
  // 门
  c.beginPath(); c.moveTo(-34, 2); c.lineTo(-34, -36); c.arc(-20, -36, 14, Math.PI, 0); c.lineTo(-6, 2); c.closePath(); c.fillStyle = '#8a5a2b'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = '#4a2d12'; c.stroke();
  ell(c, -12, -16, 2, 2, '#ffd23a'); c.strokeStyle = '#6a4220'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-20, -50); c.lineTo(-20, 2); c.stroke();
  // 窗
  rrect(c, 18, -58, 38, 34, 3, '#bfe6ff', '#4a2d12', 2.4); c.strokeStyle = '#4a2d12'; c.lineWidth = 2; c.beginPath(); c.moveTo(37, -58); c.lineTo(37, -24); c.moveTo(18, -41); c.lineTo(56, -41); c.stroke();
  ell(c, 28, -50, 4, 6, 'rgba(255,255,255,.7)', null, 0, 0.6);
  rrect(c, 14, -24, 46, 10, 2, '#8a5a2b', '#4a2d12', 1.8); [20, 30, 40, 50].forEach((fx, i) => ell(c, fx, -27, 4, 4, ['#ff6b8a', '#ffd23a', '#fff', '#ff9a3a'][i]));
  c.restore();
}
function windmillTower(c, x, y) {
  c.save(); c.translate(x, y); ell(c, 0, 4, 52, 12, 'rgba(0,0,0,.2)');
  poly(c, [[-38, 2], [38, 2], [24, -150], [-24, -150]], '#f1e6cf', '#6a4a2a', 2.6);
  c.strokeStyle = 'rgba(120,90,50,.35)'; c.lineWidth = 1.4; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(-38 + i * 1.6, 2 - i * 19); c.lineTo(38 - i * 1.6, 2 - i * 19); c.stroke(); }
  poly(c, [[-32, -150], [32, -150], [0, -192]], '#c8483a', '#5a2a22', 2.6);
  c.beginPath(); c.moveTo(-12, 2); c.lineTo(-12, -28); c.arc(0, -28, 12, Math.PI, 0); c.lineTo(12, 2); c.closePath(); c.fillStyle = '#8a5a2b'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a2d12'; c.stroke();
  rrect(c, -9, -92, 18, 22, 8, '#bfe6ff', '#4a2d12', 2);
  c.restore();
}
function windmillBlades(c, x, y, t, spin) {
  c.save(); c.translate(x, y - 160); c.rotate(spin);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2);
    rrect(c, -3, -86, 6, 86, 2, '#8a5a2b', '#4a2d12', 1.6);
    rrect(c, 3, -84, 26, 52, 2, 'rgba(255,248,230,.95)', '#6a4a2a', 2);
    c.strokeStyle = '#a07a4a'; c.lineWidth = 1.2; for (let j = 1; j < 4; j++) { c.beginPath(); c.moveTo(3, -84 + j * 13); c.lineTo(29, -84 + j * 13); c.stroke(); } c.beginPath(); c.moveTo(16, -84); c.lineTo(16, -32); c.stroke();
    c.restore();
  }
  ell(c, 0, 0, 9, 9, '#b8512f', '#4a2d12', 2.4); ell(c, -2, -2, 3, 3, 'rgba(255,255,255,.5)');
  c.restore();
}
function pond(c, x, y) {
  c.save(); c.translate(x, y);
  ell(c, 0, 10, 128, 54, 'rgba(0,0,0,.15)');
  ell(c, 0, 4, 122, 50, '#9a9a8a', '#5a5a4a', 2.4);
  const g = c.createLinearGradient(0, -40, 0, 50); g.addColorStop(0, '#5cc8f0'); g.addColorStop(1, '#2f8fd0');
  ell(c, 0, 2, 108, 40, g, '#2a6a9a', 2);
  const rnd = mulberry32(5); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, sx = Math.cos(a) * 116, sy = Math.sin(a) * 46; ell(c, sx, sy + 2, 10 + rnd() * 5, 6 + rnd() * 3, i % 2 ? '#b8b8a6' : '#a4a494', '#5a5a4a', 1.6); ell(c, sx - 2, sy, 4, 2, 'rgba(255,255,255,.4)'); }
  [[-50, 4, 15], [30, -8, 12], [60, 14, 11], [-10, 18, 13]].forEach((p, i) => { ell(c, p[0], p[1], p[2], p[2] * 0.45, '#4aa83a', '#2d6a1f', 1.6); if (i < 2) { ell(c, p[0] + 2, p[1] - 2, 5, 2.4, '#ffb3c8', '#e0708f', 1); ell(c, p[0] + 2, p[1] - 3, 2, 1.2, '#ffd23a'); } });
  c.strokeStyle = '#4a8a2c'; c.lineWidth = 2.2; [[-100, 6], [-92, 14], [96, 12], [104, 4]].forEach(p => { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + 2, p[1] - 34); c.stroke(); rrect(c, p[0] - 1, p[1] - 44, 6, 14, 3, '#7a4a22', '#3e2208', 1.2); });
  c.restore();
}
function pondShimmer(c, x, y, t) {
  c.save(); c.translate(x, y); c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = Math.sin(t * 1.3 + i * 1.9), px = -70 + i * 26 + a * 8, py = -16 + (i % 3) * 18; c.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i)); c.beginPath(); c.moveTo(px - 8, py); c.lineTo(px + 8, py); c.stroke(); }
  c.restore();
}
function scarecrow(c, x, y) {
  c.save(); c.translate(x, y); ell(c, 0, 4, 22, 6, 'rgba(0,0,0,.2)');
  c.strokeStyle = '#7a4a22'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -88); c.moveTo(-34, -56); c.lineTo(34, -56); c.stroke();
  poly(c, [[-14, -60], [14, -60], [11, -30], [-11, -30]], '#d9553a', '#7a2a1a', 2); c.strokeStyle = 'rgba(255,230,160,.5)'; c.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 7, -58); c.lineTo(i * 6, -32); c.stroke(); }
  c.strokeStyle = '#e8c860'; c.lineWidth = 2; [-36, 36].forEach(sx => { for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(sx, -56); c.lineTo(sx + Math.sign(sx) * 5, -56 + i * 5); c.stroke(); } });
  ell(c, 0, -74, 13, 13, '#e8d0a0', '#7a5a2a', 2); ell(c, -4, -76, 1.8, 1.8, '#222'); ell(c, 4, -76, 1.8, 1.8, '#222'); c.strokeStyle = '#7a2a1a'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -71, 4, 0.2, Math.PI - 0.2); c.stroke();
  ell(c, 0, -85, 19, 5, '#e8b94a', '#7a5a1a', 2); poly(c, [[-10, -86], [10, -86], [7, -100], [-7, -100]], '#e8b94a', '#7a5a1a', 2); rrect(c, -10, -90, 20, 4, 1, '#b8372e');
  c.restore();
}
function doghouse(c, x, y) {
  c.save(); c.translate(x, y); ell(c, 0, 4, 46, 11, 'rgba(0,0,0,.2)');
  rrect(c, -34, -44, 68, 46, 3, '#d9a05a', '#6a4220', 2.2); c.strokeStyle = 'rgba(106,66,32,.4)'; c.lineWidth = 1.2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-34 + i * 17, -44); c.lineTo(-34 + i * 17, 2); c.stroke(); }
  poly(c, [[-42, -40], [0, -72], [42, -40]], '#c8483a', '#5a2a22', 2.6);
  c.beginPath(); c.moveTo(-14, 2); c.lineTo(-14, -20); c.arc(0, -20, 14, Math.PI, 0); c.lineTo(14, 2); c.closePath(); c.fillStyle = '#3a2412'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a2d12'; c.stroke();
  rrect(c, 40, -24, 30, 14, 3, '#fff3d6', '#6a4220', 1.8); c.fillStyle = '#6a4220'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('汪汪', 55, -14);
  c.restore();
}
function drawFence(c, x0, y0, x1, y1, h, sp) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / sp)), pts = [];
  for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
  [0.35, 0.72].forEach(f => {
    c.lineCap = 'round'; c.strokeStyle = '#5a3416'; c.lineWidth = 7; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1] - h * f) : c.moveTo(p[0], p[1] - h * f)); c.stroke();
    c.strokeStyle = '#d8a45e'; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = 'rgba(255,240,200,.45)'; c.lineWidth = 1.2; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1] - h * f - 1) : c.moveTo(p[0], p[1] - h * f - 1)); c.stroke();
  });
  pts.forEach(p => { rrect(c, p[0] - 4.5, p[1] - h - 4, 9, h + 6, 3, '#e0b070', '#5a3416', 1.8); ell(c, p[0], p[1] - h - 4, 4.5, 2.6, '#f0c88a', '#5a3416', 1.4); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(p[0] + 1, p[1] - h, 3, h); });
}
function drawYard(c) {
  const T = YARD.T, R = YARD.R, B = YARD.B, L = YARD.L, th = 16;
  ell(c, (T[0] + B[0]) / 2, (T[1] + B[1]) / 2 + 14, 480, 240, 'rgba(0,0,0,.12)');
  poly(c, [L, B, [B[0], B[1] + th], [L[0], L[1] + th]], '#8a5a2e', '#3e2208', 2.4);
  poly(c, [B, R, [R[0], R[1] + th], [B[0], B[1] + th]], '#6e4421', '#3e2208', 2.4);
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.5; for (let i = 1; i < 12; i++) { const f = i / 12; c.beginPath(); c.moveTo(lerp(L[0], B[0], f), lerp(L[1], B[1], f)); c.lineTo(lerp(L[0], B[0], f), lerp(L[1], B[1], f) + th); c.stroke(); c.beginPath(); c.moveTo(lerp(B[0], R[0], f), lerp(B[1], R[1], f)); c.lineTo(lerp(B[0], R[0], f), lerp(B[1], R[1], f) + th); c.stroke(); }
  const g = c.createLinearGradient(0, T[1], 0, B[1]); g.addColorStop(0, '#b4e86c'); g.addColorStop(1, '#8fd350');
  poly(c, [T, R, B, L], g, '#4f8a2c', 2.4);
  // 割草条纹
  c.save(); c.beginPath(); c.moveTo(T[0], T[1]); c.lineTo(R[0], R[1]); c.lineTo(B[0], B[1]); c.lineTo(L[0], L[1]); c.closePath(); c.clip();
  const total = COLS + 2 * YE; for (let i = 0; i < total; i += 2) {
    const u0 = -YE + i, u1 = -YE + i + 1; poly(c, [[GU(u0, -YE), GV(u0, -YE)], [GU(u1, -YE), GV(u1, -YE)], [GU(u1, ROWS + YE), GV(u1, ROWS + YE)], [GU(u0, ROWS + YE), GV(u0, ROWS + YE)]], 'rgba(255,255,255,.1)');
  }
  c.restore();
}

/* ============ 地面装饰 ============ */
function drawGround(c, vb) {
  const g = vgrad(c, GROUND_Y - 6, vb.y1, [[0, '#9be063'], [0.25, '#7fd04c'], [1, '#62bb3e']]);
  c.fillStyle = g; c.fillRect(vb.x0, GROUND_Y - 6, vb.x1 - vb.x0, vb.y1 - GROUND_Y + 6);
  const rnd = mulberry32(11); c.lineCap = 'round';
  const n = Math.floor((vb.x1 - vb.x0) * (vb.y1 - GROUND_Y) / 2200);
  for (let i = 0; i < n; i++) {
    const x = vb.x0 + rnd() * (vb.x1 - vb.x0), y = GROUND_Y + rnd() * (vb.y1 - GROUND_Y), s = 0.6 + (y - GROUND_Y) / 600;
    if (inYard(x, y, 0.7)) continue;
    c.strokeStyle = rnd() > 0.5 ? '#4fa832' : '#8fe05a'; c.lineWidth = 2;
    for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(x + j * 3 * s, y); c.lineTo(x + j * 5 * s, y - 7 * s); c.stroke(); }
  }
  const cols = ['#ffffff', '#ffd23a', '#ff8aa5', '#c58aff', '#ff9a3a'];
  for (let i = 0; i < n / 5; i++) { const x = vb.x0 + rnd() * (vb.x1 - vb.x0), y = GROUND_Y + 14 + rnd() * (vb.y1 - GROUND_Y - 14); if (inYard(x, y, 0.8)) continue; flower(c, x, y, cols[Math.floor(rnd() * cols.length)], 0.8 + (y - GROUND_Y) / 500); }
}
function buildBackground(c, vb, th) {
  hillLayer(c, vb, GROUND_Y - 38, 46, '#a6d6b0', '#b9e0b0', 0.0042, 1.2);
  hillLayer(c, vb, GROUND_Y - 6, 38, '#6fc06a', '#8fd470', 0.0061, 4.1);
  hillLayer(c, vb, GROUND_Y + 14, 26, '#58b04c', '#76c758', 0.0088, 2.4);
  drawGround(c, vb);
  // 小路
  c.save(); c.strokeStyle = '#d8b678'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(250, 340); c.quadraticCurveTo(270, 400, 296, 440); c.stroke();
  c.strokeStyle = '#e8c88a'; c.lineWidth = 26; c.stroke(); c.restore();
  pond(c, 215, 665);
  const objs = [];
  const add = (y, fn) => objs.push({ y, fn });
  add(340, () => house(c, 250, 340, th.roof, th.wall));
  add(330, () => windmillTower(c, 1240, 330));
  const rnd = mulberry32(21);
  const trees = [[60, 300, 1.05, 0], [150, 262, 0.92, 1], [440, 276, 0.85, 0], [530, 258, 0.8, 0], [880, 262, 0.82, 1], [990, 250, 0.78, 0], [1090, 272, 0.9, 0], [1400, 300, 1.05, 1], [1500, 270, 1.15, 0], [100, 520, 1.1, 0], [60, 760, 1.0, 1], [1460, 640, 1.1, 0], [1520, 500, 1.0, 1], [1380, 790, 1.0, 0], [380, 790, 0.95, 0]];
  trees.forEach(t => add(t[1], () => tree(c, t[0], t[1], t[2], th.tree, t[3])));
  for (let x = vb.x0 - 60; x < -60; x += 110) add(280 + rnd() * 30, () => tree(c, x, 280 + rnd() * 20, 1, th.tree, 0));
  for (let x = 1660; x < vb.x1 + 60; x += 110) add(290 + rnd() * 30, () => tree(c, x, 290 + rnd() * 25, 1.05, th.tree, 0));
  [[360, 372, 0.9], [160, 400, 1], [1130, 340, 0.9], [1330, 380, 1], [1420, 520, 0.9], [150, 600, 0.8], [1250, 760, 0.9], [520, 770, 0.8]].forEach(b => add(b[1], () => bush(c, b[0], b[1], b[2], th.bush)));
  add(520, () => scarecrow(c, 232, 528));
  add(612, () => doghouse(c, 1352, 612));
  objs.sort((a, b) => a.y - b.y).forEach(o => o.fn());
  drawYard(c);
  drawFence(c, YARD.L[0], YARD.L[1], YARD.T[0], YARD.T[1], 28, 38);
  drawFence(c, YARD.T[0], YARD.T[1], YARD.R[0], YARD.R[1], 28, 38);
}
function drawFrontFence(c) {
  drawFence(c, YARD.L[0], YARD.L[1], YARD.B[0], YARD.B[1], 22, 38);
  drawFence(c, YARD.B[0], YARD.B[1], YARD.R[0], YARD.R[1], 22, 38);
}

/* ============ 动态小物 ============ */
function drawSmoke(c, x, y, t) {
  for (let i = 0; i < 5; i++) { const p = ((t * 0.28 + i / 5) % 1), s = 5 + p * 13; c.globalAlpha = (1 - p) * 0.55; ell(c, x + Math.sin(t + i * 2) * 5 + p * 22, y - p * 70, s, s * 0.85, '#f2f2f2'); }
  c.globalAlpha = 1;
}
function drawChicken(c, x, y, t, dir, peck) {
  c.save(); c.translate(x, y); c.scale(dir, 1); ell(c, 0, 3, 13, 4, 'rgba(0,0,0,.2)');
  const bob = Math.abs(Math.sin(t * 8)) * (peck ? 0 : 1.5);
  c.strokeStyle = '#e0902a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, -4); c.lineTo(-3, 2); c.moveTo(3, -4); c.lineTo(3, 2); c.stroke();
  c.translate(0, -bob);
  ell(c, 0, -12, 12, 10, '#fffdf5', '#9a8a6a', 1.8);
  poly(c, [[-11, -14], [-18, -22], [-9, -9]], '#fffdf5', '#9a8a6a', 1.6);
  ell(c, -1, -10, 6, 4.5, '#f2ead2', '#b8a888', 1.2);
  const hy = peck ? Math.abs(Math.sin(t * 6)) * 7 : 0;
  ell(c, 9, -21 + hy, 6, 6, '#fffdf5', '#9a8a6a', 1.8); poly(c, [[14, -21 + hy], [20, -19 + hy], [14, -18 + hy]], '#ff9a2a', '#b8661a', 1.2);
  ell(c, 11, -23 + hy, 1.3, 1.3, '#222'); ell(c, 8, -28 + hy, 2.4, 3, '#e8372e', '#8a1a14', 1);
  c.restore();
}
function drawButterfly(c, x, y, t, col) {
  c.save(); c.translate(x, y); const f = Math.abs(Math.sin(t * 14)); c.rotate(Math.sin(t * 3) * 0.3);
  ell(c, -4, -2, 5 * f + 1, 6, col, shade(col, -0.4), 1, -0.4); ell(c, 4, -2, 5 * f + 1, 6, col, shade(col, -0.4), 1, 0.4);
  ell(c, -3, 3, 3.5 * f + 1, 4, shade(col, 0.2), shade(col, -0.4), 1); ell(c, 3, 3, 3.5 * f + 1, 4, shade(col, 0.2), shade(col, -0.4), 1);
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, 5); c.stroke(); c.restore();
}
function drawDog(c, x, y, t, mode) {
  // mode: 'none' 未拥有, 'sleep', 'guard', 'bark'
  if (mode === 'none') return;
  c.save(); c.translate(x, y); ell(c, 0, 4, 26, 7, 'rgba(0,0,0,.22)');
  const sleep = mode === 'sleep', br = Math.sin(t * 2) * (sleep ? 1.2 : 0.5), tail = Math.sin(t * (mode === 'bark' ? 18 : 6)) * 0.5;
  if (sleep) {
    ell(c, 0, -9 + br, 24, 11, '#c8884a', '#6a4220', 2); ell(c, 14, -4, 12, 8, '#f0d8a8', '#6a4220', 1.8);
    ell(c, 18, -10, 8, 6, '#b87a3e', '#6a4220', 1.6); ell(c, 22, -9, 3, 2.2, '#222'); c.strokeStyle = '#3a2412'; c.lineWidth = 1.6; c.beginPath(); c.arc(17, -11, 2, 0.1, Math.PI - 0.1); c.stroke();
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; const zy = -30 - (t * 12 % 14); c.globalAlpha = 0.9 - (t * 12 % 14) / 20; c.strokeText('Z', 26, zy); c.fillText('Z', 26, zy); c.globalAlpha = 1;
  } else {
    c.save(); c.translate(-22, -16); c.rotate(-0.6 + tail); rrect(c, -3, -14, 6, 16, 3, '#b87a3e', '#6a4220', 1.6); c.restore();
    ell(c, 0, -17, 20, 12, '#c8884a', '#6a4220', 2); ell(c, 8, -12, 10, 8, '#f0d8a8');
    rrect(c, -14, -10, 7, 14, 3, '#c8884a', '#6a4220', 1.8); rrect(c, 10, -10, 7, 14, 3, '#c8884a', '#6a4220', 1.8);
    const hb = mode === 'bark' ? Math.sin(t * 16) * 2 : 0;
    ell(c, 18, -33 + hb, 11, 10, '#d9965a', '#6a4220', 2); ell(c, 27, -30 + hb, 7, 5.5, '#f0d8a8', '#6a4220', 1.6); ell(c, 31, -31 + hb, 2.6, 2, '#222');
    ell(c, 19, -37 + hb, 2, 2.2, '#222'); ell(c, 19.8, -37.8 + hb, 0.7, 0.7, '#fff');
    c.save(); c.translate(11, -40 + hb); c.rotate(-0.4); ell(c, 0, 4, 4, 8, '#8a5a2b', '#4a2d12', 1.6); c.restore();
    if (mode === 'bark') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 3; c.strokeText('汪!', 40, -48); c.fillStyle = '#fff'; c.fillText('汪!', 40, -48); }
  }
  c.restore();
}
function drawFireflies(c, vb, t, a) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x = 150 + (i * 137) % 1300 + Math.sin(t * 0.6 + i) * 30, y = 330 + (i * 89) % 420 + Math.cos(t * 0.5 + i * 1.3) * 22, tw = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 2.1);
    const g = c.createRadialGradient(x, y, 0, x, y, 12); g.addColorStop(0, `rgba(230,255,120,${0.9 * tw * a})`); g.addColorStop(1, 'rgba(230,255,120,0)'); c.fillStyle = g; c.fillRect(x - 12, y - 12, 24, 24);
  }
  c.restore();
}
function drawRain(c, vb, t) {
  c.save(); c.strokeStyle = 'rgba(200,225,255,.55)'; c.lineWidth = 1.6; c.lineCap = 'round';
  const W = vb.x1 - vb.x0, H = vb.y1 - vb.y0;
  for (let i = 0; i < 220; i++) {
    const sp = 700 + (i % 7) * 60, x = vb.x0 + (((i * 97.3 + t * 160) % W) + W) % W, y = vb.y0 + (((i * 61.7 + t * sp) % H) + H) % H;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5, y + 16); c.stroke();
  }
  c.restore();
}

/* ============ 土地与作物层 ============ */
function soilTile(c, soil, wet, dry) {
  const hw = 79, hh = 39.5, d = 13;
  const topC = soil ? ['#b9552f', '#8a3a1c'] : ['#a36a36', '#6a421f'];
  let col = mixc(topC[0], topC[1], wet * 0.85);
  if (dry) col = mixc(col, soil ? '#d98a5a' : '#cfa56a', 0.55);
  poly(c, [[-hw, 0], [0, hh], [0, hh + d], [-hw, d]], soil ? '#7a2e14' : '#5a3818', '#2e1a0a', 1.6);
  poly(c, [[0, hh], [hw, 0], [hw, d], [0, hh + d]], soil ? '#64240e' : '#48290f', '#2e1a0a', 1.6);
  const g = c.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, shade(col, 0.12)); g.addColorStop(1, shade(col, -0.1));
  poly(c, [[0, -hh], [hw, 0], [0, hh], [-hw, 0]], g, '#2e1a0a', 1.8);
  // 垄沟
  c.save(); c.beginPath(); c.moveTo(0, -hh + 2); c.lineTo(hw - 3, 0); c.lineTo(0, hh - 2); c.lineTo(-hw + 3, 0); c.closePath(); c.clip();
  for (let i = 1; i <= 4; i++) {
    const v = i / 5;
    const P = (u) => [(u - v) * hw, -hh + (u + v) * hh];
    const p0 = P(0), p1 = P(1);
    c.strokeStyle = shade(col, -0.32); c.lineWidth = 3.4; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
    c.strokeStyle = shade(col, 0.2); c.lineWidth = 1.6; c.beginPath(); c.moveTo(p0[0], p0[1] - 2.2); c.lineTo(p1[0], p1[1] - 2.2); c.stroke();
  }
  if (dry) { c.strokeStyle = 'rgba(90,50,20,.55)'; c.lineWidth = 1.3; [[-30, -4, -12, 6, -4, 2], [20, -10, 34, 0, 40, -6], [-8, 14, 6, 10, 20, 16], [-46, 6, -36, 12, -28, 10]].forEach(p => { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.stroke(); }); }
  if (wet > 0.3) { c.fillStyle = `rgba(255,255,255,${0.12 * wet})`; ell(c, -14, -8, 22, 6, c.fillStyle, null, 0, -0.45); }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-hw + 3, 0.5); c.lineTo(0, -hh + 2); c.lineTo(hw - 3, 0.5); c.stroke();
}
function lockedTile(c, t, hover, price) {
  const hw = 79, hh = 39.5, d = 9;
  poly(c, [[-hw, 0], [0, hh], [0, hh + d], [-hw, d]], '#4a8a30', '#2d5a1c', 1.4); poly(c, [[0, hh], [hw, 0], [hw, d], [0, hh + d]], '#3c7526', '#2d5a1c', 1.4);
  const g = c.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, '#78c24e'); g.addColorStop(1, '#5aa83a');
  poly(c, [[0, -hh], [hw, 0], [0, hh], [-hw, 0]], g, '#2d5a1c', 1.6);
  c.strokeStyle = '#3f8a2a'; c.lineWidth = 2; c.lineCap = 'round';
  [[-34, -4], [30, 6], [-8, 16], [14, -14], [-50, 8], [44, -4]].forEach((p, i) => { for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(p[0] + j * 3, p[1]); c.lineTo(p[0] + j * 6 + Math.sin(t + i) * 1.5, p[1] - 9); c.stroke(); } });
  bush(c, -22, 4, 0.34, '#4ea43a'); bush(c, 28, -2, 0.28, '#5ab544');
  // 木牌
  c.save(); c.translate(0, -2); rrect(c, -2.5, -26, 5, 28, 2, '#8a5a2b', '#4a2d12', 1.4); rrect(c, -20, -42, 40, 22, 4, '#e8c07a', '#6a4220', 2);
  c.font = `15px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#6a4220'; c.fillText('🔒', 0, -31); c.restore();
  if (hover && price != null) { c.save(); c.font = 'bold 14px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(60,40,10,.85)'; c.fillStyle = '#ffe27a'; const s = '扩建 🪙' + price; c.strokeText(s, 0, -52); c.fillText(s, 0, -52); c.restore(); }
}
function star4(c, x, y, r, a) {
  c.save(); c.translate(x, y); c.rotate(a); c.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r; const an = i / 8 * TAU; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  c.closePath(); c.fillStyle = '#fffbd0'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#ffc61a'; c.stroke(); c.restore();
}
const _wp = [[-44, 4], [38, 8], [-14, 24], [20, -16], [-52, -4]];
function drawWeeds(c, t, idx) {
  c.lineCap = 'round';
  _wp.forEach((p, i) => {
    const sw = Math.sin(t * 2 + i + idx) * 2;
    for (let j = -2; j <= 2; j++) {
      c.strokeStyle = (j + i) % 2 ? '#3f8a2a' : '#5cb83c'; c.lineWidth = 3; c.beginPath(); c.moveTo(p[0] + j * 2, p[1]); c.quadraticCurveTo(p[0] + j * 4 + sw, p[1] - 8, p[0] + j * 7 + sw * 1.5, p[1] - 15 + Math.abs(j) * 2); c.stroke();
    }
  });
}
function drawLadybug(c, x, y, t) {
  c.save(); c.translate(x, y); const f = Math.sin(t * 20) * 2;
  ell(c, -5, -4, 5, 3 + Math.abs(f) * 0.3, 'rgba(255,255,255,.7)', null, 0, -0.5); ell(c, 5, -4, 5, 3 + Math.abs(f) * 0.3, 'rgba(255,255,255,.7)', null, 0, 0.5);
  ell(c, 0, 0, 7, 6, '#e8372e', '#5a1410', 1.4); c.strokeStyle = '#2a0a08'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 6); c.stroke();
  ell(c, -3, -1, 1.4, 1.4, '#2a0a08'); ell(c, 3, 2, 1.4, 1.4, '#2a0a08'); ell(c, 0, -7, 3.4, 2.6, '#2a0a08'); c.restore();
}
function bubble(c, x, y, ch, t, i) {
  const bob = Math.sin(t * 3 + i * 1.7) * 3;
  c.save(); c.translate(x, y + bob);
  c.fillStyle = 'rgba(255,255,255,.96)'; c.strokeStyle = '#6a8aaa'; c.lineWidth = 2.2;
  c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-5, 12); c.lineTo(0, 21); c.lineTo(5, 12); c.fillStyle = 'rgba(255,255,255,.96)'; c.fill();
  c.font = `18px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ch, 0, 1);
  c.restore();
}
/* P: {u,soil,c,p,pr:{d,w,b},wet} ; o: {hover,idx,price,t,ripeBeat} */
function drawPlot(c, P, x, y, t, o) {
  c.save(); c.translate(x, y);
  if (!P.u) { lockedTile(c, t, o.hover, o.price); c.restore(); return; }
  soilTile(c, P.soil, P.wet || 0, P.pr && P.pr.d);
  if (P.pr && P.pr.w) drawWeeds(c, t, o.idx);
  let top = 40;
  if (P.c >= 0) {
    const crop = CROPS[P.c], stage = P.p >= 1 ? 4 : P.p < 0.1 ? 0 : P.p < 0.35 ? 1 : P.p < 0.65 ? 2 : 3;
    c.save(); c.translate(0, 3);
    let sc = 1; if (stage === 4) { sc = 1 + Math.sin(t * 3 + o.idx) * 0.018; }
    c.scale(sc, sc);
    if (P.pr && P.pr.d && stage > 0) { c.rotate(Math.sin(t * 1.5) * 0.015 + 0.06); c.scale(1, 0.92); }
    drawCrop(c, crop, stage, t, o.idx * 1.7);
    c.restore();
    top = (crop.art.hh || 70) * (stage >= 3 ? 1 : stage === 2 ? 0.7 : 0.35) + 18;
    if (stage === 4) { for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3 + o.idx * 0.13) % 1; c.globalAlpha = Math.sin(ph * Math.PI); star4(c, Math.cos(i * 2.4 + o.idx) * 28, -top * (0.35 + 0.5 * ((i * 0.37) % 1)) + 6, 3 + 5 * Math.sin(ph * Math.PI), ph * 3); } c.globalAlpha = 1; }
    if (P.pr && P.pr.b && stage > 0) drawLadybug(c, Math.cos(t * 1.4 + o.idx) * 24, -top * 0.45 + Math.sin(t * 2.3) * 8, t);
    const list = []; if (P.pr) { if (P.pr.d) list.push('💧'); if (P.pr.w) list.push('🌿'); if (P.pr.b) list.push('🐛'); }
    list.forEach((ch, i) => bubble(c, (i - (list.length - 1) / 2) * 34, -top - 22, ch, t, i));
    if (o.stolen) { c.font = `16px ${EMOJI}`; c.textAlign = 'center'; c.fillText('👣', 40, 12); }
  }
  if (o.hover) {
    c.save(); poly(c, [[0, -40], [80, 0], [0, 40], [-80, 0]], 'rgba(255,255,255,.2)', 'rgba(255,255,255,.95)', 3);
    c.restore();
  }
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
