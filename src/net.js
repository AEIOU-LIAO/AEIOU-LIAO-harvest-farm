'use strict';
/* =====================================================
   丰收农场 · 网络层
   - Bearer 令牌（localStorage）
   - 写操作带 Idempotency-Key，网络失败自动重试且不会重复结算
   - 服务器时间校准、断网提示
   ===================================================== */
/* 按需加载脚本（V0.4）：区域、新角色用到的 three 扩展和资源模块不在首屏加载，第一次用到时按顺序加载，只加载一次 */
const LAZY = {};
function needScripts(list) {
  return list.reduce((p, src) => p.then(() => LAZY[src] || (LAZY[src] = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src + '?v=' + (typeof CFG !== 'undefined' ? CFG.VERSION : ''); s.async = false;
    s.onload = ok; s.onerror = () => { delete LAZY[src]; s.remove(); no(new Error('加载失败：' + src)); }; document.head.appendChild(s);
  }))), Promise.resolve());
}
const LAZY_3D = ['vendor/three-addons.js'], LAZY_CHAR = ['vendor/three-addons.js', 'lib/assets3.js', 'lib/entity3.js'];
const NET = (() => {
  const meta = document.querySelector('meta[name="farm-api"]');
  const qs = new URLSearchParams(location.search);
  const BASE = (qs.get('api') || (meta && meta.content) || '').replace(/\/$/, '');
  const TK = 'hf_token';
  let token = ''; try { token = localStorage.getItem(TK) || ''; } catch (e) { }
  let offset = 0, online = true, onAuthLost = null, onOnline = null;
  const banner = () => document.getElementById('netbar');
  function setOnline(v) {
    if (online === v) return; online = v; const b = banner(); if (b) b.classList.toggle('show', !v);
    if (v && onOnline) onOnline();
  }
  function setToken(t) { token = t || ''; try { t ? localStorage.setItem(TK, t) : localStorage.removeItem(TK); } catch (e) { } }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  class ApiErr extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }

  async function once(method, path, body, ik) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
    const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token; if (ik) h['Idempotency-Key'] = ik;
    const t0 = Date.now();
    try {
      const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store', credentials: BASE ? 'include' : 'same-origin' });
      const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch (e) { throw new ApiErr(r.status, 'bad_json', /^\s*</.test(txt) ? '接口没有部署成功（服务器返回了网页而不是数据），请检查云函数部署' : '服务器返回异常（HTTP ' + r.status + '）'); }
      setOnline(true);
      const sn = j.now || (j.state && j.state.now); if (sn) offset = sn - (t0 + Date.now()) / 2;
      if (!r.ok || !j.ok) {
        if (r.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/recover') { setToken(''); onAuthLost && onAuthLost(); }
        if (j.detail) console.error('[server]', path, j.detail);
        throw new ApiErr(r.status, j.code || 'error', (j.error || '请求失败') + (j.detail ? '（' + String(j.detail).slice(0, 60) + '）' : ''));
      }
      return j;
    } catch (e) {
      if (e instanceof ApiErr) throw e;
      setOnline(false); throw new ApiErr(0, 'network', '网络连接中断');
    } finally { clearTimeout(to); }
  }
  // 写操作：同一个幂等键最多重试 3 次
  async function post(path, body) {
    const ik = uuid(); let last;
    for (let i = 0; i < 4; i++) {
      try { return await once('POST', path, body || {}, ik); }
      catch (e) { last = e; if (e.status !== 0 && e.status !== 502 && e.status !== 503 && e.status !== 504) throw e; await sleep([400, 1200, 2500, 0][i]); }
    }
    throw last;
  }
  const get = (path) => once('GET', path);
  // 本机账号：服务器 HttpOnly Cookie 为主（苹果设备清理网页存储后仍在），localStorage 为备份
  const AK = 'hf_accounts';
  const readAcc = () => { try { return JSON.parse(localStorage.getItem(AK) || '[]'); } catch (e) { return []; } };
  const writeAcc = l => { try { localStorage.setItem(AK, JSON.stringify(l.slice(0, 8))); } catch (e) { } };
  function rememberAccount(me, tok) { const l = readAcc().filter(a => a.id !== me.id); l.unshift({ id: me.id, code: me.code, name: me.name, lv: me.lv, avatar: me.avatar, frame: me.frame, guest: me.guest, token: tok || token, at: Date.now() }); writeAcc(l); }
  function forgetAccount(id) { writeAcc(readAcc().filter(a => a.id !== id)); }
  async function accounts() {
    const local = readAcc(); let server = [];
    try { server = (await once('GET', '/api/accounts')).list; } catch (e) { if (e.code === 'network') return local.map(a => Object.assign({}, a, { localOnly: true })); }
    const out = server.map(u => Object.assign({}, local.find(a => a.id === u.id) || {}, u));
    local.forEach(a => { if (!out.find(u => u.id === a.id) && a.token) out.push(Object.assign({ localOnly: true }, a)); });
    writeAcc(out.map(a => ({ id: a.id, code: a.code, name: a.name, lv: a.lv, avatar: a.avatar, frame: a.frame, guest: a.guest, token: (local.find(x => x.id === a.id) || {}).token, at: a.at || Date.now() })));
    return out;
  }
  async function useAccount(acc) {
    try { const r = await once('POST', '/api/accounts/use', { id: acc.id }); setToken(r.token); return r.state; }
    catch (e) { if (e.code === 'network') throw e; const l = readAcc().find(a => a.id === acc.id); if (l && l.token) { setToken(l.token); return (await once('GET', '/api/state')); } throw e; }
  }
  return {
    accounts, useAccount, rememberAccount, forgetAccount, forgetRemote: id => once('POST', '/api/accounts/forget', { id }).catch(() => { }),
    get, post, setToken, ApiErr, get token() { return token; }, get online() { return online; },
    now: () => Date.now() + offset, onAuthLost: f => onAuthLost = f, onOnline: f => onOnline = f,
    ping: () => once('GET', '/api/health').then(() => true, () => false),
  };
})();
