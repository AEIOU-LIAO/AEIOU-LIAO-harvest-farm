'use strict';
const crypto = require('crypto');

class ApiError extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }
const bad = (msg, code) => new ApiError(400, code || 'bad_request', msg);
const forbid = (msg) => new ApiError(403, 'forbidden', msg || '没有权限');
const notFound = (msg) => new ApiError(404, 'not_found', msg || '不存在');
const conflict = (msg, code) => new ApiError(409, code || 'conflict', msg);

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function randToken(n) { return crypto.randomBytes(n || 32).toString('base64url'); }
function hashPassword(pw) {
  const salt = crypto.randomBytes(16); const h = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('base64') + '$' + h.toString('base64');
}
function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, s, h] = stored.split('$'); const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}
function randInt(a, b) { return a + crypto.randomInt(b - a + 1); }
function rand() { return crypto.randomInt(1 << 30) / (1 << 30); }

// 令牌桶限流（内存）
class Limiter {
  constructor() { this.m = new Map(); setInterval(() => { const now = Date.now(); for (const [k, v] of this.m) if (now - v.t > 600000) this.m.delete(k); }, 60000).unref(); }
  take(key, rate, burst, cost) {
    const now = Date.now(); let b = this.m.get(key); if (!b) { b = { tok: burst, t: now }; this.m.set(key, b); }
    b.tok = Math.min(burst, b.tok + (now - b.t) / 1000 * rate); b.t = now;
    if (b.tok < (cost || 1)) return false; b.tok -= (cost || 1); return true;
  }
}

// 昵称校验：长度、字符、简单敏感词
const BANNED = ['admin', '管理员', '官方', 'gm', '客服', '傻逼', '操你', '妈的', 'fuck', 'shit', '习近平', '共产党', '法轮'];
function cleanName(s) {
  s = String(s || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) throw bad('名字不能为空'); if ([...s].length > 10) throw bad('名字最多 10 个字');
  const low = s.toLowerCase(); if (BANNED.some(w => low.includes(w))) throw bad('名字包含不允许的词');
  return s;
}
function cleanUsername(s) {
  s = String(s || '').trim(); if (!/^[A-Za-z0-9_]{4,20}$/.test(s)) throw bad('账号需为 4–20 位字母、数字或下划线'); return s;
}
function checkPw(pw) { pw = String(pw || ''); if (pw.length < 6 || pw.length > 64) throw bad('密码长度需为 6–64 位'); return pw; }
const int = (v, name, lo, hi) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw bad((name || '参数') + '不合法'); return n; };
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) { let v = p.slice(i + 1).trim(); try { v = decodeURIComponent(v); } catch (e) { } o[p.slice(0, i).trim()] = v; } }); return o; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = { ApiError, bad, forbid, notFound, conflict, sha256, randToken, hashPassword, checkPassword, randInt, rand, Limiter, parseCookies, cleanName, cleanUsername, checkPw, int, esc };
