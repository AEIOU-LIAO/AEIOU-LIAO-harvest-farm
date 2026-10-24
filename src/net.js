'use strict';
/* =====================================================
   丰收农场 · 网络层
   - Bearer 令牌（localStorage）
   - 写操作带 Idempotency-Key，网络失败自动重试且不会重复结算
   - 服务器时间校准、断网提示
   ===================================================== */
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
      const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store' });
      let j; try { j = await r.json(); } catch (e) { throw new ApiErr(r.status, 'bad_json', '服务器返回异常'); }
      setOnline(true);
      const sn = j.now || (j.state && j.state.now); if (sn) offset = sn - (t0 + Date.now()) / 2;
      if (!r.ok || !j.ok) {
        if (r.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/recover') { setToken(''); onAuthLost && onAuthLost(); }
        throw new ApiErr(r.status, j.code || 'error', j.error || '请求失败');
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
  return {
    get, post, setToken, ApiErr, get token() { return token; }, get online() { return online; },
    now: () => Date.now() + offset, onAuthLost: f => onAuthLost = f, onOnline: f => onOnline = f,
    ping: () => once('GET', '/api/health').then(() => true, () => false),
  };
})();
