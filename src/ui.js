'use strict';
/* =====================================================
   丰收农场 · 界面弹窗
   ===================================================== */
const qsa = s => document.querySelectorAll(s);
const val = id => ($(id) && $(id).value || '').trim();
const tabsHtml = (tabs, cur, attr) => `<div class="tabs">${tabs.map(([k, t, bd]) => `<button class="${k === cur ? 'on' : ''}" data-${attr || 't'}="${k}">${t}${bd ? `<i class="bd">${bd}</i>` : ''}</button>`).join('')}</div>`;
const bindTabs = (fn, attr) => qsa(`.tabs [data-${attr || 't'}]`).forEach(b => b.onclick = () => fn(b.dataset[attr || 't']));
async function getj(path) { try { return await NET.get(path); } catch (e) { toast(e.message, 'warn'); return null; } }

/* ---------------- 登录 / 注册 ---------------- */
async function showLogin(tab) {
  tab = tab || 'quick';
  const inv = new URLSearchParams(location.search).get('invite'); let inviter = null;
  if (inv) { try { inviter = await NET.get('/api/invite/' + encodeURIComponent(inv)); } catch (e) { } }
  const invHtml = inviter ? `<div class="invite">${avHtml(inviter.avatar, inviter.frame, 44)}<div><b>${esc(inviter.name)}</b>（Lv.${inviter.lv}）邀请你一起种菜！<small>进入游戏后你们会自动成为好友</small></div></div>` : '';
  const forms = {
    quick: `<p class="sub">起个名字就能开始，进入后可以随时绑定账号，换设备也能登录</p><input id="l-name" maxlength="10" placeholder="你的农场主昵称" value="小农夫"><button class="btn big primary" id="l-go">开始种田</button>`,
    login: `<input id="l-user" placeholder="账号" autocomplete="username"><input id="l-pass" type="password" placeholder="密码" autocomplete="current-password"><button class="btn big primary" id="l-go">登录</button><p class="sub"><a href="#" id="l-forgot">忘记密码？</a></p>`,
    reg: `<input id="l-name" maxlength="10" placeholder="昵称（最多10字）"><input id="l-user" placeholder="账号：4–20 位字母/数字/下划线" autocomplete="username"><input id="l-pass" type="password" placeholder="密码：至少 6 位" autocomplete="new-password"><button class="btn big primary" id="l-go">注册并开始</button>`,
    recover: `<p class="sub">用绑定账号时保存的<b>恢复码</b>重设密码</p><input id="l-user" placeholder="账号"><input id="l-code" placeholder="恢复码（12 位）"><input id="l-pass" type="password" placeholder="新密码"><button class="btn big primary" id="l-go">重设并登录</button>`,
  };
  openModal(`<div class="login"><div class="wtitle">🌾 丰收农场</div><p class="sub2">和朋友一起种菜、偷菜、做买卖的多人农场</p>${invHtml}
    ${tabsHtml([['quick', '快速开始'], ['login', '账号登录'], ['reg', '注册账号']], tab === 'recover' ? 'login' : tab)}<div class="lform">${forms[tab]}</div>
    <p class="fine">游戏数据保存在服务器上。继续即表示你同意我们为了运行游戏保存你的昵称和游戏数据，你可以随时在“设置 → 账号”中导出或注销。</p></div>`, {
    small: true, noclose: true, mount: () => {
      bindTabs(t => showLogin(t)); const f = $('l-forgot'); if (f) f.onclick = e => { e.preventDefault(); showLogin('recover'); };
      const go = async () => {
        const b = $('l-go'); b.disabled = true;
        try {
          let r;
          if (tab === 'quick') r = await NET.post('/api/auth/guest', { name: val('l-name') || '小农夫' });
          else if (tab === 'login') r = await NET.post('/api/auth/login', { username: val('l-user'), password: $('l-pass').value });
          else if (tab === 'reg') r = await NET.post('/api/auth/register', { name: val('l-name') || '小农夫', username: val('l-user'), password: $('l-pass').value });
          else { r = await NET.post('/api/auth/recover', { username: val('l-user'), code: val('l-code'), password: $('l-pass').value }); setTimeout(() => showRecovery(r.recovery), 800); }
          NET.setToken(r.token); sfx('level'); enterGame(r.state, tab === 'quick' || tab === 'reg');
        } catch (e) { toast(e.message, 'warn'); sfx('err'); b.disabled = false; }
      };
      $('l-go').onclick = go; qsa('.lform input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
    }
  });
}
function showRecovery(code) {
  openModal(`<div class="confirm"><div class="big">🔑</div><h3>请保存你的恢复码</h3><p>忘记密码时，用它重新设置密码。<b>它只显示这一次</b>，请截图或抄下来。</p><div class="reccode">${esc(code)}</div><div class="row"><button class="btn" id="cp">复制</button><button class="btn primary" onclick="closeModal(true)">我已保存</button></div></div>`, { small: true, noclose: true, mount: () => { $('cp').onclick = () => copyText(code); } });
}
function copyText(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('已复制'), () => { const i = document.createElement('textarea'); i.value = t; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败，请手动复制', 'warn'); } i.remove(); }); }
function welcome() {
  openModal(`<div class="welcome"><div class="wtitle">🌾 欢迎来到丰收农场</div><p>这是一个<b>真实多人</b>的农场：你种的菜，好友真的能来摘；好友的菜，你也能去摘！</p><ul>
    <li>🖐️ 点击空地 <b>种植</b>，成熟后点击 <b>收获</b>，按住拖动可以连续操作</li>
    <li>💧🌿🐛 作物会缺水、长草、生虫，处理掉才长得快（好友也能帮你）</li>
    <li>👥 点右侧 <b>＋</b> 复制邀请链接发给朋友，成为好友后就能互相串门</li>
    <li>🥷 好友的菜成熟后可以摘一点，但主人一定能保住 ${Math.round((1 - RULES.stealMaxPct) * 100)}% 以上；养只小狗看家吧</li>
    <li>🌱 左边的 <b>新手任务</b> 会一步步带你上手，完成有金币奖励</li></ul>
    <button class="btn big primary" id="wgo">开始种田！</button></div>`, { small: true, noclose: true, mount: () => { $('wgo').onclick = () => { closeModal(true); savePref({ tut: 1 }); }; } });
}
function openMigrate(old) {
  const lv = Math.min(30, parseInt(old.lv) || 1), gold = parseInt(old.gold) || 0;
  openModal(`<div class="confirm"><div class="big">📦</div><h3>发现本机的单机版存档</h3><p>旧存档：<b>Lv.${lv}</b> · 金币 <b>${fmt(gold)}</b></p>
    <p class="left">多人版的数据统一保存在服务器上，为了公平，旧存档里的数值无法直接导入（浏览器里的数据可以被随意修改）。作为补偿，你可以领取一次<b>老玩家礼包</b>：</p>
    <ul class="left"><li>等级提升到 <b>Lv.${Math.min(lv, 8)}</b>（最高 8 级）</li><li>金币 <b>${Math.min(gold, 3000) + 200}</b>、化肥 ×5</li></ul>
    <p class="left fine">旧存档会原样保留在这个浏览器里，不会被删除或覆盖。每个账号只能领取一次。</p>
    <div class="row"><button class="btn" id="mno">不需要</button><button class="btn primary" id="myes">领取礼包</button></div></div>`, {
    small: true, noclose: true, mount: () => {
      $('mno').onclick = () => { try { localStorage.setItem('hf_migrate_done', '1'); } catch (e) { } closeModal(true); if (!PREF.tut) welcome(); };
      $('myes').onclick = async () => { const r = await api('/api/me/migrate', { lv, gold }); if (r) { try { localStorage.setItem('hf_migrate_done', '1'); } catch (e) { } closeModal(true); sfx('level'); toast(`礼包已到账：Lv.${r.result.lv}，🪙${r.result.gold}，化肥×${r.result.fert}`); if (!PREF.tut) setTimeout(welcome, 600); } };
    }
  });
}

/* ---------------- 种子 / 仓库 / 商店 ---------------- */
function openSeeds() {
  const cards = CROPS.slice().sort((a, b) => a.lv - b.lv || a.seed - b.seed).map(c => {
    const lock = S.me.lv < c.lv, per = Math.floor(c.yield * c.price), perH = Math.round((per - c.seed) / (c.time / 3600));
    return `<div class="seedcard r${c.rarity}${lock ? ' lock' : ''}${S.me.seed === c.id ? ' sel' : ''}" data-id="${c.id}">
      ${c.seasons > 1 ? '<em class="tag">两季</em>' : ''}${c.rarity > 1 ? `<em class="rar">${CFG.RARITY[c.rarity]}</em>` : ''}${iconImg(c.id)}<h4>${c.name}</h4>
      <div class="meta"><span>🪙 ${fmt(c.seed)}</span><span>⏱ ${fmtTime(c.time)}</span></div>
      <div class="meta"><span>📦 ×${c.yield}</span><span>💰 ${fmt(per)}</span></div><div class="meta"><span>✨ ${c.exp}</span><span title="每小时净收益">📈 ${fmt(perH)}/时</span></div>
      ${lock ? `<div class="lockmask">🔒 Lv.${c.lv} 解锁</div>` : ''}</div>`;
  }).join('');
  openModal(`<h2>🌱 选择种子</h2><p class="sub">选好后点击空地播种，种子在播种时自动扣钱</p><div class="seedgrid">${cards}</div>`, {
    wide: true, mount: () => qsa('.seedcard').forEach(d => d.onclick = async () => {
      const id = +d.dataset.id; if (S.me.lv < CROPS[id].lv) { toast(`需要 Lv.${CROPS[id].lv} 解锁`, 'warn'); sfx('err'); return; }
      S.me.seed = id; tool = 'auto'; closeModal(); renderToolbar(); sfx('click'); toast(`已选择 ${CROPS[id].name}`); api('/api/me/profile', { seed: id }, { quiet: true });
    })
  });
}
function openWarehouse(tab) {
  tab = tab || 'fruit'; const inv = S.inv, crops = Object.keys(inv).filter(k => cropOf(k) && inv[k] > 0).sort((a, b) => cropOf(a).id - cropOf(b).id || (a < b ? -1 : 1));
  let total = 0; crops.forEach(k => total += inv[k] * unitPrice(k));
  const bonusTxt = Object.keys(S.bonus).map(id => `<span class="hot">🔥 ${CROPS[id].name} +${Math.round(S.bonus[id] * 100)}%</span>`).join('');
  let body;
  if (tab === 'fruit') {
    body = crops.length ? crops.map(k => { const c = cropOf(k); return `<div class="row-item"><div class="ri-ic">${itemIcon(k)}</div><div class="ri-main"><b>${itemName(k)}</b><small>单价 🪙${unitPrice(k)}${S.bonus[c.id] && !c.golden ? ' <span class="hot">🔥</span>' : ''}${c.golden ? ' · 变异稀有品' : ''}</small></div><div class="ri-n">×${inv[k]}</div>
      <button class="btn sm" data-sell="${k}" data-n="1">卖1个</button><button class="btn sm primary" data-sell="${k}" data-n="${inv[k]}">全部卖出</button></div>`; }).join('') : '<div class="empty">仓库空空如也，去收获点什么吧～</div>';
    if (crops.length) body += `<div class="sellall"><button class="btn big primary" id="sellall">一键卖出全部 · 约 🪙${fmt(total)}</button><p class="fine">想卖个好价钱？也可以去 🏷️ 集市挂单卖给其他玩家</p></div>`;
  } else {
    const d = S.me.dog, now = NET.now();
    body = `<div class="row-item"><div class="ri-ic big">🧪</div><div class="ri-main"><b>化肥</b><small>选择工具栏的「化肥」后点击作物，进度 +30%</small></div><div class="ri-n">×${inv.fert || 0}</div></div>
      <div class="row-item"><div class="ri-ic big">🍖</div><div class="ri-main"><b>狗粮</b><small>${d.own ? `小狗 Lv.${d.lv}（${d.exp}/${d.need}）· 拦截率 ${Math.round(Math.min(RULES.dogBlockMax, RULES.dogBlockBase + RULES.dogBlockPerLv * (d.lv - 1)) * 100)}%${d.until > now ? ` · 还能看家 ${fmtTime((d.until - now) / 1000)}` : ' · 饿着肚子在睡觉'}` : '需要先在商店领养小狗'}</small></div><div class="ri-n">×${inv.dogfood || 0}</div><button class="btn sm primary" id="feeddog" ${d.own ? '' : 'disabled'}>喂狗</button></div>`;
  }
  openModal(`<h2>🎒 仓库</h2>${tabsHtml([['fruit', '果实'], ['item', '道具']], tab)}<div class="hots">${bonusTxt ? '今日行情：' + bonusTxt : ''}</div><div class="list">${body}</div>`, {
    wide: true, mount: () => {
      bindTabs(openWarehouse);
      qsa('[data-sell]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await api('/api/wh/sell', { item: b.dataset.sell, n: +b.dataset.n }); if (r) { sfx('coin'); toast(`卖出获得 🪙${r.result.gold}`); } openWarehouse(tab); });
      const sa = $('sellall'); if (sa) sa.onclick = async () => { sa.disabled = true; const r = await api('/api/wh/sell-all'); if (r) { sfx('coin'); toast(`一共卖出 🪙${r.result.gold}`); } openWarehouse(tab); };
      const fd = $('feeddog'); if (fd) fd.onclick = async () => { const r = await api('/api/dog/feed'); if (r) { sfx('bark'); toast(r.result.lvUp ? `🐶 小狗升到 Lv.${r.result.lvUp} 了！看家更厉害了` : `🐶 小狗吃饱啦，接下来 ${RULES.dogFeedMin} 分钟会帮你看家`); } openWarehouse('item'); };
    }
  });
}
function openShop(tab) {
  tab = tab || 'item'; let body = '';
  if (tab === 'item') body = CFG.SHOP_ITEMS.map(it => `<div class="row-item"><div class="ri-ic big">${it.ic}</div><div class="ri-main"><b>${it.name}</b><small>${it.desc} · 已有 ${S.inv[it.id] || 0}</small></div><div class="price">🪙 ${it.price}</div><button class="btn sm primary" data-buy="${it.id}" data-n="1">购买</button><button class="btn sm" data-buy="${it.id}" data-n="10">×10</button></div>`).join('');
  else if (tab === 'land') {
    const owned = unlockedCount(), can = owned < CFG.NPLOTS, nRed = S.plots.filter(p => p.soil).length;
    body = `<div class="row-item"><div class="ri-ic big">🌾</div><div class="ri-main"><b>开垦荒地</b><small>已开垦 ${owned}/${CFG.NPLOTS} 块 · 需要 Lv.${CFG.plotNeedLv(owned)}</small></div><div class="price">🪙 ${can ? fmt(CFG.plotCost(owned)) : '—'}</div><button class="btn sm primary" id="buyland" ${can ? '' : 'disabled'}>开垦</button></div>
    <div class="row-item"><div class="ri-ic big" style="background:linear-gradient(#d9663a,#a53a1a)">🟥</div><div class="ri-main"><b>红土地升级</b><small>生长速度 +20%，产量 +20% · 需要 Lv.${RULES.redNeedLv}<br>点击后选择要升级的土地</small></div><div class="price">🪙 ${fmt(CFG.redCost(nRed))}</div><button class="btn sm primary" id="buyred">选择土地</button></div>`;
  } else {
    const d = S.me.dog;
    body = `<div class="row-item"><div class="ri-ic big">🐶</div><div class="ri-main"><b>${d.own ? `看家小狗 Lv.${d.lv}` : '领养小狗'}</b><small>${d.own ? '喂狗粮后会看家，有几率赶走来偷菜的好友（会咬掉对方一点金币）；喂得越多等级越高、拦截率越高' : '好友会来摘你的菜，有只小狗帮你看家吧'}${S.me.lv < RULES.dogNeedLv && !d.own ? ` · 需要 Lv.${RULES.dogNeedLv}` : ''}</small></div><div class="price">${d.own ? '' : '🪙 ' + RULES.dogPrice}</div><button class="btn sm primary" id="buydog" ${d.own ? 'disabled' : ''}>${d.own ? '已拥有' : '领养'}</button></div>`;
  }
  openModal(`<h2>🏪 商店</h2>${tabsHtml([['item', '道具'], ['land', '土地'], ['dog', '宠物']], tab)}<div class="mygold">我的金币：🪙 ${fmt(S.me.gold)}</div><div class="list">${body}</div>`, {
    wide: true, mount: () => {
      bindTabs(openShop);
      qsa('[data-buy]').forEach(b => b.onclick = async () => { const r = await api('/api/shop/buy', { item: b.dataset.buy, n: +b.dataset.n }); if (r) { sfx('coin'); toast(`购买成功 ×${b.dataset.n}`); openShop('item'); } });
      const bl = $('buyland'); if (bl) bl.onclick = async () => { if (view.key !== 'home') goHome(); await doExpand(-1); openShop('land'); };
      const br = $('buyred'); if (br) br.onclick = () => { if (S.me.lv < RULES.redNeedLv) { toast(`红土地需要 Lv.${RULES.redNeedLv}`, 'warn'); sfx('err'); return; } closeModal(); if (view.key !== 'home') goHome(); tool = 'red'; renderToolbar(); updateCursor(); toast('点击一块已开垦的土地进行升级（右键或点「自动」取消）'); };
      const bd = $('buydog'); if (bd) bd.onclick = async () => { const r = await api('/api/shop/dog'); if (r) { sfx('bark'); toast('🐶 小狗来啦！送你一份狗粮，记得喂它'); openShop('dog'); } };
    }
  });
}

/* ---------------- 任务 / 签到 / 赛季 ---------------- */
async function openTasks(tab) {
  const T = await getj('/api/tasks'); if (!T) return; const nbLeft = T.newbie.filter(x => !x.claimed).length;
  tab = tab || (S.badges.newbie ? 'newbie' : 'daily');
  const row = (def, st, kind) => { const p = Math.min(st.need, st.prog), ok = st.prog >= st.need; return `<div class="row-item task"><div class="ri-ic big">${def.ic || '🌱'}</div><div class="ri-main"><b>${def.tx}</b><div class="pbar"><i style="width:${p / st.need * 100}%"></i><span>${fmt(p)}/${fmt(st.need)}</span></div><small>奖励 🪙${def.gold}${def.exp ? ' · ✨' + def.exp : ''}</small></div><button class="btn sm ${ok && !st.claimed ? 'primary' : ''}" data-claim="${def.id}" data-kind="${kind}" ${ok && !st.claimed ? '' : 'disabled'}>${st.claimed ? '已领取' : ok ? '领取' : '进行中'}</button></div>`; };
  let body = '';
  if (tab === 'daily') {
    const done = S.me.checkin.last === T.day, n = done ? ((S.me.checkin.streak - 1) % 7) + 1 : (S.me.checkin.streak % 7) + 1;
    const days = [1, 2, 3, 4, 5, 6, 7].map(d => `<div class="day${(done ? d <= n : d < n) ? ' got' : ''}${!done && d === n ? ' today' : ''}"><small>第${d}天</small><b>🪙${d * 100}</b>${d % 3 === 0 ? '<em>+🧪</em>' : ''}${d === 7 ? '<em>+🍖</em>' : ''}</div>`).join('');
    body = `<div class="checkin"><div class="cih"><b>📅 每日签到</b><span>已连续 ${S.me.checkin.streak} 天 · 每天 0 点（北京时间）刷新</span><button class="btn sm primary" id="checkin" ${done ? 'disabled' : ''}>${done ? '今日已签' : '签到'}</button></div><div class="days">${days}</div></div>
      <div class="list">${CFG.TASKS.map(d => row(d, T.daily.find(x => x.id === d.id), 'daily')).join('')}</div>`;
  } else if (tab === 'weekly') body = `<p class="sub">本周剩余 ${fmtTime((T.weekEnd - NET.now()) / 1000)}</p><div class="list">${CFG.WEEKLY.map(d => row(d, T.weekly.find(x => x.id === d.id), 'weekly')).join('')}</div>`;
  else if (tab === 'newbie') body = `<p class="sub">跟着做，几分钟就能学会多人农场的玩法</p><div class="list">${CFG.NEWBIE.map(d => row(d, T.newbie.find(x => x.id === d.id), 'newbie')).join('')}</div>${T.newbie.find(x => x.id === 'n_friend' && x.prog < 1) ? '<div class="sellall"><button class="btn primary" id="tinv">📨 复制邀请链接</button></div>' : ''}`;
  else {
    const s = await getj('/api/season'); if (!s) return;
    body = `<div class="season"><h3>🏆 本周赛季 ${s.week}</h3><p>赛季积分 = 本周获得的经验值。剩余 ${fmtTime((s.end - NET.now()) / 1000)}</p><div class="big">${fmt(s.pts)} <small>分</small></div>
      <p>结算奖励（积分 ≥ 100）：第1名 🪙5000 · 2–3名 🪙3000 · 4–10名 🪙1500 · 11–50名 🪙800 · 其余 🪙300</p>
      <div class="last">上赛季 ${s.last.week}：${s.last.pts ? `${fmt(s.last.pts)} 分 · 第 ${s.last.rank} 名 · 奖励 🪙${s.last.reward}` : '没有参加'}
      ${s.last.reward ? `<button class="btn sm ${s.last.claimed ? '' : 'primary'}" id="sclaim" ${s.last.claimed ? 'disabled' : ''}>${s.last.claimed ? '已领取' : '领取'}</button>` : ''}</div>
      <button class="btn" id="srank">查看赛季排行榜</button></div>`;
  }
  const tabs = [['daily', '每日'], ['weekly', '每周'], ['season', '赛季']]; if (nbLeft) tabs.unshift(['newbie', '新手', S.badges.newbie]);
  openModal(`<h2>📜 任务</h2>${tabsHtml(tabs, tab)}${body}`, {
    wide: true, mount: () => {
      bindTabs(openTasks);
      qsa('[data-claim]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await api('/api/tasks/claim', { kind: b.dataset.kind, id: b.dataset.claim }); if (r) { sfx('coin'); toast(`领取成功！🪙+${r.result.gold}${r.result.exp ? '  ✨+' + r.result.exp : ''}`); } openTasks(tab); });
      const ci = $('checkin'); if (ci) ci.onclick = async () => { ci.disabled = true; const r = await api('/api/checkin'); if (r) { sfx('level'); toast(`签到成功！第${r.result.day}天 🪙+${r.result.gold}${r.result.back ? `，回归奖励 🪙+${r.result.back}` : ''}`); } openTasks('daily'); };
      const sc = $('sclaim'); if (sc) sc.onclick = async () => { const r = await api('/api/season/claim'); if (r) { sfx('level'); toast(`赛季奖励 🪙+${r.result.gold}`); } openTasks('season'); };
      const sr = $('srank'); if (sr) sr.onclick = () => openRank('season', 'global'); const ti = $('tinv'); if (ti) ti.onclick = () => copyText(inviteLink());
    }
  });
}

/* ---------------- 好友 ---------------- */
const inviteLink = () => location.origin + location.pathname + '?invite=' + S.me.code;
async function openFriends(tab) {
  await loadFriends(); tab = tab || (FR.requests.length ? 'req' : 'list');
  let body = '';
  const urow = (u, btns, sub) => `<div class="row-item">${avHtml(u.avatar, u.frame, 44)}<div class="ri-main"><b>${esc(u.name)}</b> <span class="lv">Lv.${u.lv}</span>${u.title ? ` <span class="ttl">${esc(u.title)}</span>` : ''}<small>${sub || '玩家号 ' + u.code}</small></div>${btns}</div>`;
  if (tab === 'list') body = FR.list.length ? FR.list.map(f => urow(f, `<button class="btn sm primary" data-visit="${f.id}">串门${f.steal ? ` 🥷${f.steal}` : ''}</button><button class="btn sm" data-more="${f.id}">⋯</button>`, `${f.online ? '🟢 在线' : '最近 ' + ago(f.last)} · 玩家号 ${f.code}${f.soon ? ` · ${f.soon} 块快成熟` : ''}`)).join('') : '<div class="empty">还没有好友，去「添加」页邀请朋友吧</div>';
  else if (tab === 'req') body = (FR.requests.length ? FR.requests.map(u => urow(u, `<button class="btn sm primary" data-acc="${u.id}">同意</button><button class="btn sm" data-rej="${u.id}">拒绝</button>`, `${ago(u.at)} 申请加你为好友`)).join('') : '<div class="empty">没有新的好友申请</div>')
    + (FR.sent.length ? `<h4 class="sec">我发出的申请</h4>` + FR.sent.map(u => urow(u, '<span class="fine">等待对方同意</span>', ago(u.at))).join('') : '');
  else if (tab === 'add') body = `<div class="invbox"><b>📨 邀请朋友</b><p>把链接发给朋友，对方打开后直接成为你的好友</p><div class="copyrow"><input readonly value="${esc(inviteLink())}" id="invl"><button class="btn sm primary" id="cpinv">复制</button></div><p>我的玩家号：<b class="code">${S.me.code}</b></p></div>
    <div class="copyrow"><input id="fq" placeholder="输入玩家号（7 位数字）或昵称搜索"><button class="btn sm primary" id="fsearch">搜索</button></div><div id="fres"></div>`;
  else body = FR.visitors.length ? FR.visitors.map(u => urow(u, FR.list.find(f => f.id === u.id) ? `<button class="btn sm" data-visit="${u.id}">回访</button>` : '', `${ago(u.at)} 来过你的农场`)).join('') : '<div class="empty">最近还没有人来串门</div>';
  openModal(`<h2>👥 好友</h2>${tabsHtml([['list', `好友 ${FR.list.length}`], ['req', '申请', FR.requests.length], ['add', '添加'], ['visit', '来访']], tab)}<div class="list">${body}</div>`, {
    wide: true, mount: () => {
      bindTabs(openFriends);
      qsa('[data-visit]').forEach(b => b.onclick = () => visit(FR.list.find(f => f.id === +b.dataset.visit)));
      qsa('[data-acc]').forEach(b => b.onclick = async () => { const r = await api('/api/friends/respond', { id: +b.dataset.acc, accept: true }); if (r) { sfx('level'); toast('已成为好友'); refreshState(); } openFriends('req'); });
      qsa('[data-rej]').forEach(b => b.onclick = async () => { await api('/api/friends/respond', { id: +b.dataset.rej, accept: false }); refreshState(); openFriends('req'); });
      qsa('[data-more]').forEach(b => b.onclick = () => friendMore(FR.list.find(f => f.id === +b.dataset.more)));
      const cp = $('cpinv'); if (cp) cp.onclick = () => copyText(inviteLink());
      const fs = $('fsearch'); if (fs) { const go = async () => { const q = val('fq'); if (!q) return; const r = await getj('/api/friends/search?q=' + encodeURIComponent(q)); if (!r) return; $('fres').innerHTML = r.list.length ? r.list.map(u => urow(u, u.friend ? '<span class="fine">已是好友</span>' : u.pending ? '<span class="fine">已申请</span>' : `<button class="btn sm primary" data-req="${u.id}">加好友</button>`)).join('') : '<div class="empty">没有找到这个玩家</div>'; qsa('[data-req]').forEach(b => b.onclick = async () => { b.disabled = true; const x = await api('/api/friends/request', { id: +b.dataset.req }); if (x) { toast(x.friend ? '对方也申请过你，已直接成为好友！' : '申请已发送，等待对方同意'); if (x.friend) { loadFriends(); refreshState(); } b.textContent = x.friend ? '已是好友' : '已申请'; } }); }; fs.onclick = go; $('fq').onkeydown = e => { if (e.key === 'Enter') go(); }; }
    }
  });
}
function friendMore(f) {
  openModal(`<div class="confirm">${avHtml(f.avatar, f.frame, 64)}<h3>${esc(f.name)}</h3><p>玩家号 ${f.code} · 成为好友于 ${new Date(f.since).toLocaleDateString()}</p>
    <div class="row"><button class="btn primary" id="fvis">去串门</button><button class="btn" id="fgb">留言板</button></div><div class="row"><button class="btn danger sm" id="fdel">删除好友</button><button class="btn danger sm" id="fblk">拉黑</button></div></div>`, {
    small: true, mount: () => {
      $('fvis').onclick = () => visit(f); $('fgb').onclick = () => openGuestbook(f);
      $('fdel').onclick = async () => { if (!confirm(`确定删除好友 ${f.name} 吗？`)) return; await api('/api/friends/remove', { id: f.id }); await loadFriends(); if (view.key === 'f' + f.id) goHome(); openFriends('list'); };
      $('fblk').onclick = async () => { if (!confirm(`拉黑后将删除好友，且对方不能再向你发申请。确定吗？`)) return; await api('/api/friends/block', { id: f.id, on: true }); await loadFriends(); if (view.key === 'f' + f.id) goHome(); openFriends('list'); };
    }
  });
}
async function openMessages() {
  await loadMessages(false);
  const rows = MSGS.length ? MSGS.map(m => `<div class="row-item${m.read ? '' : ' new'}">${m.actor ? avHtml(m.avatar, '', 36) : '<span class="ii emo">📢</span>'}<div class="ri-main">${msgText(m)}<small>${ago(m.at)}</small></div>${m.friend && (m.kind === 'stolen' || m.kind === 'visit' || m.kind === 'dog') ? `<button class="btn sm primary" data-visit="${m.actor}">回访</button>` : ''}${m.friend && m.kind === 'helped' ? `<button class="btn sm" data-thank="${m.actor}">道谢</button>` : ''}</div>`).join('') : '<div class="empty">暂时没有消息</div>';
  openModal(`<h2>📬 消息</h2><div class="list logfull">${rows}</div>`, {
    mount: () => {
      qsa('[data-visit]').forEach(b => b.onclick = () => { const f = FR.list.find(x => x.id === +b.dataset.visit); if (f) visit(f); });
      qsa('[data-thank]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await api('/api/guestbook/' + b.dataset.thank, { phrase: 5 }); if (r) toast('已发送感谢 🎁'); });
    }, onclose: () => { }
  });
  if (S.badges.unread) { await api('/api/messages/read', {}, { quiet: true }); MSGS.forEach(m => m.read = true); S.badges.unread = 0; renderSide(); renderLog(); }
}
async function openGuestbook(f) {
  const r = await getj('/api/guestbook/' + f.id); if (!r) return; const mine = f.id === S.me.id;
  const rows = r.list.length ? r.list.map(g => `<div class="row-item">${avHtml(g.avatar, '', 36)}<div class="ri-main"><b>${esc(g.name)}</b>：${esc(CFG.PHRASES[g.phrase] || '')}<small>${ago(g.at)}</small></div>${mine ? `<button class="btn sm" data-hide="${g.id}">隐藏</button>` : ''}</div>`).join('') : '<div class="empty">留言板还是空的</div>';
  openModal(`<h2>💌 ${esc(f.name)} 的留言板</h2>${mine ? '' : `<p class="sub">选一句话留给 ${esc(f.name)}</p><div class="phrases">${CFG.PHRASES.map((p, i) => `<button class="btn sm" data-ph="${i}">${esc(p)}</button>`).join('')}</div>`}<div class="list">${rows}</div>`, {
    mount: () => {
      qsa('[data-ph]').forEach(b => b.onclick = async () => { const x = await api('/api/guestbook/' + f.id, { phrase: +b.dataset.ph }); if (x) { toast('留言成功'); openGuestbook(f); } });
      qsa('[data-hide]').forEach(b => b.onclick = async () => { await api('/api/guestbook/hide', { id: +b.dataset.hide }); openGuestbook(f); });
    }
  });
}

/* ---------------- 订单 / 集市 ---------------- */
async function openOrders() {
  const o = await getj('/api/orders'); if (!o) return;
  const cards = o.list.map(x => { const ok = x.have >= x.qty; return `<div class="order${x.done ? ' done' : ''}"><div class="oi">${itemIcon(x.item)}</div><b>${itemName(x.item)} ×${x.qty}</b><small>仓库有 ${x.have}</small><div class="rw">🪙${fmt(x.gold)} · ✨${x.exp}</div>
    ${x.done ? '<div class="stamp">已完成</div>' : `<button class="btn sm ${ok ? 'primary' : ''}" data-dl="${x.slot}" ${ok ? '' : 'disabled'}>交货</button><button class="btn sm" data-rf="${x.slot}" ${o.refreshLeft ? '' : 'disabled'} title="花 50 金币换一个订单">换一个</button>`}</div>`; }).join('');
  openModal(`<h2>📦 订单</h2><p class="sub">村民们需要这些作物，交货能拿到比直接卖更多的金币和经验。每天刷新（今日还能换 ${o.refreshLeft} 次，每次 🪙50）</p><div class="orders">${cards}</div>`, {
    wide: true, mount: () => {
      qsa('[data-dl]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await api('/api/orders/deliver', { slot: +b.dataset.dl }); if (r) { sfx('coin'); toast(`交货成功 🪙+${r.result.gold} ✨+${r.result.exp}`); } openOrders(); });
      qsa('[data-rf]').forEach(b => b.onclick = async () => { b.disabled = true; await api('/api/orders/refresh', { slot: +b.dataset.rf }); openOrders(); });
    }
  });
}
async function openMarket(tab, item) {
  tab = tab || 'buy'; const m = await getj('/api/market' + (item ? '?item=' + item : '')); if (!m) return; let body = '';
  const ownCrops = Object.keys(S.inv).filter(k => cropOf(k) && S.inv[k] > 0);
  if (tab === 'buy') {
    const opts = CROPS.map(c => `<option value="c${c.id}" ${item === 'c' + c.id ? 'selected' : ''}>${c.name}</option>`).join('') + CROPS.map(c => `<option value="g${c.id}" ${item === 'g' + c.id ? 'selected' : ''}>金色${c.name}</option>`).join('');
    body = `<div class="copyrow"><select id="mf"><option value="">全部商品（最新）</option>${opts}</select></div><div class="list">${m.list.length ? m.list.map(x => `<div class="row-item"><div class="ri-ic">${itemIcon(x.item)}</div><div class="ri-main"><b>${itemName(x.item)} ×${x.qty}</b><small>卖家 ${esc(x.seller.name)}${x.seller.friend ? ' · 好友' : ''} · 单价 🪙${x.price}（系统价 ${unitPrice(x.item)}）· ${fmtTime((x.expires - NET.now()) / 1000)}后下架</small></div><div class="price">🪙 ${fmt(x.qty * x.price)}</div><button class="btn sm primary" data-mbuy="${x.id}" ${S.me.gold >= x.qty * x.price ? '' : 'disabled'}>购买</button></div>`).join('') : '<div class="empty">暂时没有人在卖这个</div>'}</div>`;
  } else {
    const sel = ownCrops.map(k => `<option value="${k}">${itemName(k)}（有 ${S.inv[k]}）</option>`).join('');
    body = `<div class="mform">${ownCrops.length ? `<b>上架作物</b><div class="copyrow"><select id="msel">${sel}</select><input id="mqty" type="number" min="1" placeholder="数量"><input id="mprice" type="number" min="1" placeholder="单价"><button class="btn sm primary" id="mlist">上架</button></div><p class="fine" id="mband"></p>` : '<p class="fine">仓库里没有可以上架的作物</p>'}
      <p class="fine">成交后收取 ${Math.round(RULES.marketFee * 100)}% 手续费；最多同时上架 ${RULES.marketMaxListings} 件，${RULES.marketTtlHours} 小时未售出自动退回。单价限制在系统价的 ${RULES.marketMinMult}–${RULES.marketMaxMult} 倍，防止刷金币。</p></div>
      <div class="list">${m.mine.length ? m.mine.map(x => `<div class="row-item"><div class="ri-ic">${itemIcon(x.item)}</div><div class="ri-main"><b>${itemName(x.item)} ×${x.qty}</b><small>单价 🪙${x.price} · ${({ open: '在售 · ' + fmtTime((x.expires - NET.now()) / 1000) + '后下架', sold: '✅ 已售出', cancelled: '已下架', expired: '已过期退回' })[x.status]}</small></div>${x.status === 'open' ? `<button class="btn sm" data-mcan="${x.id}">下架</button>` : ''}</div>`).join('') : '<div class="empty">还没有挂单</div>'}</div>`;
  }
  openModal(`<h2>🏷️ 集市</h2><p class="sub">玩家之间买卖作物，价格由卖家决定</p>${tabsHtml([['buy', '逛集市'], ['sell', '我的摊位']], tab)}${body}`, {
    wide: true, mount: () => {
      bindTabs(t => openMarket(t));
      const mf = $('mf'); if (mf) mf.onchange = () => openMarket('buy', mf.value);
      qsa('[data-mbuy]').forEach(b => b.onclick = async () => { b.disabled = true; const r = await api('/api/market/buy', { id: +b.dataset.mbuy }); if (r) { sfx('coin'); toast(`买到 ${itemName(r.result.item)} ×${r.result.qty}`); } openMarket('buy', item); });
      qsa('[data-mcan]').forEach(b => b.onclick = async () => { const r = await api('/api/market/cancel', { id: +b.dataset.mcan }); if (r) toast('已下架，作物退回仓库'); openMarket('sell'); });
      const ms = $('msel'); if (ms) {
        const band = () => { const c = cropOf(ms.value), base = CROPS[c.id].price * (c.golden ? RULES.goldenPriceMult : 1); const lo = Math.max(1, Math.floor(base * RULES.marketMinMult)), hi = Math.ceil(base * RULES.marketMaxMult); $('mband').textContent = `单价范围 ${lo}–${hi}，今日系统收购价 ${unitPrice(ms.value)}`; $('mprice').value = Math.min(hi, Math.max(lo, Math.round(unitPrice(ms.value) * 1.2))); $('mqty').value = S.inv[ms.value]; };
        ms.onchange = band; band();
        $('mlist').onclick = async () => { const r = await api('/api/market/list', { item: ms.value, qty: +$('mqty').value, price: +$('mprice').value }); if (r) { sfx('coin'); toast('上架成功'); openMarket('sell'); } };
      }
    }
  });
}

/* ---------------- 排行 / 成就 / 图鉴 ---------------- */
async function openRank(dim, scope) {
  dim = dim || 'lv'; scope = scope || 'friends'; const r = await getj(`/api/rank?dim=${dim}&scope=${scope}`); if (!r) return;
  const unit = { lv: '级', gold: '金币', harvest: '次', steal: '次', help: '次', season: '分' }[dim];
  const rows = r.list.map(u => `<div class="row-item rank${u.id === S.me.id ? ' me' : ''}"><div class="rk r${u.rank}">${u.rank <= 3 ? ['🥇', '🥈', '🥉'][u.rank - 1] : u.rank}</div>${avHtml(u.avatar, u.frame, 40)}<div class="ri-main"><b>${esc(u.name)}</b>${u.title ? ` <span class="ttl">${esc(u.title)}</span>` : ''}<small>Lv.${u.lv}</small></div><div class="ri-n">${dim === 'lv' ? 'Lv.' + u.score : fmt(u.score)} <small>${dim === 'lv' ? '' : unit}</small></div></div>`).join('');
  const mine = r.mine && !r.list.find(u => u.id === S.me.id) ? `<div class="row-item rank me"><div class="rk">${r.mine.rank}</div>${avHtml(r.mine.avatar, r.mine.frame, 40)}<div class="ri-main"><b>${esc(r.mine.name)}（我）</b></div><div class="ri-n">${fmt(r.mine.score)}</div></div>` : '';
  openModal(`<h2>🏆 排行榜</h2>${tabsHtml([['lv', '等级'], ['gold', '财富'], ['harvest', '本周收获'], ['steal', '本周摘菜'], ['help', '本周互助'], ['season', '赛季积分']], dim)}
    <div class="scope"><button class="${scope === 'friends' ? 'on' : ''}" data-sc="friends">好友榜</button><button class="${scope === 'global' ? 'on' : ''}" data-sc="global">全服榜</button></div>
    ${['harvest', 'steal', 'help', 'season'].includes(dim) ? `<p class="sub">每周一 0 点（北京时间）重新计算 · 本周剩余 ${fmtTime((r.weekEnd - NET.now()) / 1000)}</p>` : ''}<div class="list">${rows || '<div class="empty">还没有数据</div>'}${mine}</div>`, {
    wide: true, mount: () => { bindTabs(d => openRank(d, scope)); qsa('[data-sc]').forEach(b => b.onclick = () => openRank(dim, b.dataset.sc)); }
  });
}
async function openAch() {
  const r = await getj('/api/achievements'); if (!r) return;
  const rows = CFG.ACHIEVEMENTS.map(a => { const s = r.list.find(x => x.id === a.id), ok = s.prog >= s.need, frame = CFG.FRAMES.find(f => f.ach === a.id); return `<div class="row-item task${s.claimed ? ' got' : ''}"><div class="ri-ic big">${s.claimed ? '🏅' : ok ? '🎁' : '🔒'}</div><div class="ri-main"><b>${a.tx}</b>${a.title ? ` <span class="ttl">称号「${a.title}」</span>` : ''}${frame ? ` <span class="ttl">${frame.name}</span>` : ''}<div class="pbar"><i style="width:${Math.min(100, s.prog / s.need * 100)}%"></i><span>${fmt(Math.min(s.prog, s.need))}/${fmt(s.need)}</span></div><small>${a.desc} · 奖励 🪙${a.gold}</small></div><button class="btn sm ${ok && !s.claimed ? 'primary' : ''}" data-ach="${a.id}" ${ok && !s.claimed ? '' : 'disabled'}>${s.claimed ? '已领取' : ok ? '领取' : '未达成'}</button></div>`; }).join('');
  openModal(`<h2>🏅 成就</h2><p class="sub">领取成就可以获得称号，在「装扮」里佩戴</p><div class="list">${rows}</div>`, {
    wide: true, mount: () => qsa('[data-ach]').forEach(b => b.onclick = async () => { const x = await api('/api/achievements/claim', { id: b.dataset.ach }); if (x) { sfx('level'); toast(`成就达成！🪙+${x.result.gold}${x.result.title ? ` 获得称号「${x.result.title}」` : ''}`); } openAch(); })
  });
}
async function openCodex() {
  const r = await getj('/api/codex'); if (!r) return; const got = {}; r.list.forEach(x => got[x.item] = x);
  const cell = (k, c, gold) => { const g = got[k]; return `<div class="cx${g ? ' on' : ''}${gold ? ' gold' : ''} r${c.rarity}" title="${g ? `首次获得：${new Date(g.first_at).toLocaleDateString()}，累计 ${g.n}` : '未获得'}">${iconImg(c.id)}<b>${gold ? '金色' : ''}${g ? c.name : '？？？'}</b><small>${CFG.RARITY[c.rarity]}${g ? ' · ×' + fmt(g.n) : ''}</small></div>`; };
  const n = CROPS.filter(c => got['c' + c.id]).length, ng = CROPS.filter(c => got['g' + c.id]).length;
  openModal(`<h2>📖 作物图鉴</h2><p class="sub">普通 ${n}/${CROPS.length} · 金色变异 ${ng}/${CROPS.length}（每次收获有 ${Math.round(RULES.goldenChance * 100)}% 几率变异）</p>
    <h4 class="sec">普通作物</h4><div class="codex">${CROPS.map(c => cell('c' + c.id, c)).join('')}</div><h4 class="sec">✨ 金色变异</h4><div class="codex">${CROPS.map(c => cell('g' + c.id, c, true)).join('')}</div>`, { wide: true });
}
function openEvents() {
  const rows = S.events.map(e => `<div class="row-item"><div class="ri-ic big">🎉</div><div class="ri-main"><b>${esc(e.name)}</b><small>${esc(e.descr || '')} ${({ exp_mult: '经验', price_mult: '收购价', golden_mult: '变异几率', yield_mult: '产量' })[e.kind]} ×${e.params.mult}${e.params.crop != null ? `（${CROPS[e.params.crop].name}）` : ''} · 剩余 ${fmtTime((e.end_at - NET.now()) / 1000)}</small></div></div>`).join('');
  openModal(`<h2>🎉 限时活动</h2><div class="list">${rows || '<div class="empty">当前没有活动</div>'}</div>`, {});
}

/* ---------------- 装扮 ---------------- */
async function openDress(tab, draft) {
  tab = tab || 'avatar'; const own = new Set((await getj('/api/cosmetics') || { list: [] }).list); const me = S.me; let body = '';
  if (tab === 'avatar') {
    const a = draft || Object.assign({ skin: 0, hair: 0, hat: 1, fringe: 1, pig: 0, band: 0, shirt: 0, bg: 0 }, me.avatar);
    const sw = (k, arr) => `<div class="swrow"><span>${({ skin: '肤色', hair: '发色', shirt: '衣服', band: '帽带', bg: '背景' })[k]}</span>${arr.map((c, i) => `<button class="sw${a[k] === i ? ' on' : ''}" data-k="${k}" data-v="${i}" style="background:${Array.isArray(c) ? `linear-gradient(${c[0]},${c[1]})` : c}"></button>`).join('')}</div>`;
    body = `<div class="dress"><canvas id="avprev" width="160" height="160"></canvas><div>${sw('skin', AVO.skin)}${sw('shirt', AVO.shirt)}${sw('bg', AVO.bg)}
      <div class="swrow"><span>造型</span><button class="btn sm ${a.hat ? 'primary' : ''}" data-tog="hat">草帽</button><button class="btn sm ${!a.hat && a.pig ? 'primary' : ''}" data-tog="pig">双马尾</button></div>${a.hat ? sw('band', AVO.band) : sw('hair', AVO.hair)}
      <div class="swrow"><span>昵称</span><input id="dname" maxlength="10" value="${esc(me.name)}"></div></div></div><div class="sellall"><button class="btn big primary" id="dsave">保存</button></div>`;
    openModal(`<h2>🎨 装扮</h2>${tabsHtml([['avatar', '形象'], ['theme', '农场主题'], ['frame', '头像框'], ['title', '称号']], tab)}${body}`, {
      wide: true, mount: () => {
        bindTabs(t => openDress(t)); drawAvatar($('avprev'), avStyle(a));
        qsa('[data-k]').forEach(b => b.onclick = () => { a[b.dataset.k] = +b.dataset.v; openDress('avatar', a); });
        qsa('[data-tog]').forEach(b => b.onclick = () => { const k = b.dataset.tog; if (k === 'hat') a.hat = a.hat ? 0 : 1; else { a.hat = 0; a.pig = a.pig ? 0 : 1; } openDress('avatar', a); });
        $('dsave').onclick = async () => { const r = await api('/api/me/profile', { avatar: a, name: val('dname') }); if (r) { toast('形象已保存'); renderFriends(); renderTitle(); } };
      }
    }); return;
  }
  const list = tab === 'theme' ? CFG.THEMES : tab === 'frame' ? CFG.FRAMES : null;
  if (list) body = `<div class="cosgrid">${list.map(it => { const has = own.has(tab + ':' + it.id), using = me[tab] === it.id, ach = it.ach && CFG.ACHIEVEMENTS.find(a => a.id === it.ach);
    const prev = tab === 'theme' ? `<div class="thprev" style="--roof:${it.th.roof};--wall:${it.th.wall};--tree:${it.th.tree}"><i></i><b></b><em></em></div>` : `<div class="frprev" style="box-shadow:0 0 0 5px ${it.color || '#ddd'}">${avHtml(me.avatar, '', 56)}</div>`;
    return `<div class="cos${using ? ' on' : ''}">${prev}<b>${it.name}</b>${using ? '<button class="btn sm" disabled>使用中</button>' : has ? `<button class="btn sm primary" data-use="${it.id}">使用</button>` : ach ? `<small>成就「${ach.tx}」解锁</small>` : `<button class="btn sm" data-cbuy="${it.id}">🪙 ${fmt(it.price)}</button>`}</div>`; }).join('')}</div>`;
  else { const titles = CFG.ACHIEVEMENTS.filter(a => a.title); const claimed = new Set((await getj('/api/achievements') || { list: [] }).list.filter(x => x.claimed).map(x => x.id));
    body = `<div class="titles"><button class="btn sm ${!me.title ? 'primary' : ''}" data-ttl="">不佩戴</button>${titles.map(a => claimed.has(a.id) ? `<button class="btn sm ${me.title === a.title ? 'primary' : ''}" data-ttl="${esc(a.title)}">${esc(a.title)}</button>` : `<button class="btn sm" disabled title="完成成就「${a.tx}」">🔒 ${esc(a.title)}</button>`).join('')}</div>`; }
  openModal(`<h2>🎨 装扮</h2>${tabsHtml([['avatar', '形象'], ['theme', '农场主题'], ['frame', '头像框'], ['title', '称号']], tab)}<div class="mygold">我的金币：🪙 ${fmt(me.gold)}</div>${body}`, {
    wide: true, mount: () => {
      bindTabs(t => openDress(t));
      qsa('[data-use]').forEach(b => b.onclick = async () => { const r = await api('/api/me/profile', { [tab]: b.dataset.use }); if (r) { bgDirty = true; toast('已更换'); openDress(tab); } });
      qsa('[data-cbuy]').forEach(b => b.onclick = async () => { const r = await api('/api/cosmetics/buy', { kind: tab, id: b.dataset.cbuy }); if (r) { sfx('coin'); await api('/api/me/profile', { [tab]: b.dataset.cbuy }, { quiet: true }); bgDirty = true; toast('购买成功，已经换上了'); openDress(tab); } });
      qsa('[data-ttl]').forEach(b => b.onclick = async () => { const r = await api('/api/me/profile', { title: b.dataset.ttl }); if (r) openDress('title'); });
    }
  });
}

/* ---------------- 资料 / 设置 / 账号 ---------------- */
function openProfile() {
  const me = S.me, st = me.stats;
  openModal(`<div class="profile">${avHtml(me.avatar, me.frame, 84)}<h3>${esc(me.name)} <span class="lv">Lv.${me.lv}</span></h3>${me.title ? `<span class="ttl">${esc(me.title)}</span>` : ''}<p>玩家号 <b class="code">${me.code}</b> <button class="btn sm" id="pcp">复制邀请链接</button></p>
    <div class="stats"><div><b>${fmt(st.harvest)}</b><small>收获</small></div><div><b>${fmt(st.steal)}</b><small>摘菜</small></div><div><b>${fmt(st.help)}</b><small>互助</small></div><div><b>${fmt(st.earned)}</b><small>累计金币</small></div><div><b>${fmt(st.stolenFrom)}</b><small>被摘走</small></div></div>
    <div class="row"><button class="btn" id="pdress">🎨 装扮</button><button class="btn" id="pgb">💌 我的留言板</button><button class="btn" id="pacc">🔐 账号</button></div></div>`, {
    small: true, mount: () => { $('pcp').onclick = () => copyText(inviteLink()); $('pdress').onclick = () => openDress(); $('pgb').onclick = () => openGuestbook(S.me); $('pacc').onclick = openAccount; }
  });
}
function openMenu() {
  if (!S) return;
  const row = (t, s, btn) => `<div class="row-item"><div class="ri-main"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>${btn}</div>`;
  openModal(`<h2>⚙️ 设置</h2><div class="list">
    ${row('游戏音效', '', `<button class="btn sm ${PREF.sound ? 'primary' : ''}" id="tsound">${PREF.sound ? '开启' : '关闭'}</button>`)}
    ${row('昼夜', '', `<button class="btn sm" id="ttod">${({ auto: '跟随时间', day: '白天', dusk: '黄昏', night: '夜晚' })[PREF.tod] || '跟随时间'}</button>`)}
    ${row('背景音乐', '', `<button class="btn sm ${PREF.music ? 'primary' : ''}" id="tmusic">${PREF.music ? '开启' : '关闭'}</button>`)}
    ${row('成熟 / 被偷提醒', '页面在后台时，用浏览器通知提醒你（默认关闭）', `<button class="btn sm ${PREF.notify ? 'primary' : ''}" id="tnotify">${PREF.notify ? '开启' : '关闭'}</button>`)}
    ${row('账号与数据', S.me.guest ? '⚠️ 游客账号只能在这个浏览器登录，建议绑定' : '已绑定账号：' + esc(S.me.username), '<button class="btn sm" id="tacc">管理</button>')}
    ${row('玩法与规则', '', '<button class="btn sm" id="thelp">查看</button>')}
    ${S.me.role === 'admin' ? row('运营后台', '', '<a class="btn sm" href="admin.html" target="_blank">打开</a>') : ''}
    ${row('退出登录', '', '<button class="btn sm danger" id="tlogout">退出</button>')}</div>`, {
    small: true, mount: () => {
      $('tsound').onclick = () => { savePref({ sound: !PREF.sound }); renderHud(); openMenu(); }; $('tmusic').onclick = () => { savePref({ music: !PREF.music }); if (PREF.music) startMusic(); openMenu(); };
      $('tnotify').onclick = async () => { if (!PREF.notify && 'Notification' in window) { const p = await Notification.requestPermission(); if (p !== 'granted') { toast('浏览器没有允许通知', 'warn'); return; } } else if (!('Notification' in window)) { toast('这个浏览器不支持通知', 'warn'); return; } savePref({ notify: !PREF.notify }); openMenu(); };
      $('ttod').onclick = () => { const o = ['auto', 'day', 'dusk', 'night']; savePref({ tod: o[(o.indexOf(PREF.tod) + 1) % 4] }); renderTitle(); openMenu(); };
      $('tacc').onclick = openAccount; $('thelp').onclick = openHelp; $('tlogout').onclick = logout;
    }
  });
}
async function logout() {
  if (S.me.guest && !confirm('你还是游客账号，退出后将无法再登录这个农场（除非先绑定账号）。确定退出吗？')) return;
  try { await NET.post('/api/auth/logout'); } catch (e) { } NET.setToken(''); location.reload();
}
function openAccount() {
  const me = S.me;
  const bind = me.guest ? `<div class="mform"><b>绑定账号</b><p class="fine">绑定后可以在手机、电脑等任意设备登录这个农场</p><input id="bu" placeholder="账号：4–20 位字母/数字/下划线" autocomplete="username"><input id="bp" type="password" placeholder="密码：至少 6 位" autocomplete="new-password"><button class="btn primary" id="bgo">绑定</button></div>`
    : `<div class="mform"><b>修改密码</b><input id="po" type="password" placeholder="原密码"><input id="pn" type="password" placeholder="新密码"><button class="btn" id="pgo">修改</button></div>`;
  openModal(`<h2>🔐 账号与数据</h2><div class="acct"><p>玩家号 <b>${me.code}</b> · ${me.guest ? '游客账号' : '账号 <b>' + esc(me.username) + '</b>'} · 注册于 ${new Date(me.created_at).toLocaleDateString()}</p>${bind}
    <div class="mform"><b>我的数据</b><p class="fine">导出你在服务器上的全部游戏数据（JSON 文件）</p><button class="btn" id="exp">导出数据</button></div>
    <div class="mform danger"><b>注销账号</b><p class="fine">永久删除你的农场、仓库、好友关系和记录，无法恢复</p>${me.guest ? '<input id="dc" placeholder="输入：确认注销">' : '<input id="dc" type="password" placeholder="输入密码确认">'}<button class="btn danger" id="del">注销账号</button></div></div>`, {
    mount: () => {
      const bg = $('bgo'); if (bg) bg.onclick = async () => { const r = await api('/api/auth/bind', { username: val('bu'), password: $('bp').value }); if (r) { await refreshState(); showRecovery(r.recovery); } };
      const pg = $('pgo'); if (pg) pg.onclick = async () => { const r = await api('/api/auth/password', { old: $('po').value, password: $('pn').value }); if (r) { NET.setToken(r.token); toast('密码已修改，其他设备需要重新登录'); closeModal(); } };
      $('exp').onclick = async () => { const d = await getj('/api/me/export'); if (!d) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = `harvest-farm-${me.code}.json`; a.click(); };
      $('del').onclick = async () => { if (!confirm('真的要永久注销账号吗？此操作不能撤销。')) return; const v = $('dc').value; const r = await api('/api/me/delete', me.guest ? { confirm: v.trim() } : { password: v }); if (r) { NET.setToken(''); alert('账号已注销'); location.reload(); } };
    }
  });
}
function openHelp() {
  const R = RULES;
  openModal(`<h2>📖 玩法与规则</h2><div class="help">
  <p><b>🖐️ 自动模式</b>：直接点击土地，系统按状态自动处理——空地播种、成熟收获、有💧🌿🐛就顺手处理。按住拖动可以连续操作。</p>
  <p><b>🌱 生长</b>：所有作物的生长都由服务器计时，下线也会继续长。每出现一种问题（缺水/杂草/害虫）生长速度降到 ${Math.round(R.probSlow * 100)}%，下雨会防止缺水。红土地生长与产量 +20%。</p>
  <p><b>✨ 变异</b>：每次收获有 ${Math.round(R.goldenChance * 100)}% 几率额外获得金色作物，价值 ${R.goldenPriceMult} 倍，可收集进图鉴。</p>
  <h3>🥷 摘菜规则</h3>
  <p>① 只能摘<b>好友</b>的作物；② 作物成熟后主人有 <b>${R.stealDelaySec} 秒</b>保护时间；③ 每块地每一季你只能摘一次，每次约为产量的 ${Math.round(R.stealPctMin * 100)}–${Math.round(R.stealPctMax * 100)}%；④ 一块地最多被摘走 <b>${Math.round(R.stealMaxPct * 100)}%</b>，主人至少保留 ${Math.round((1 - R.stealMaxPct) * 100)}%；Lv.${R.newbieLv} 以下的新手最多只会被摘 ${Math.round(R.newbieMaxPct * 100)}%；⑤ 每人每天最多成功摘 ${R.stealDailyLimit} 次；⑥ 主人的小狗吃饱时有 ${Math.round(R.dogBlockBase * 100)}%（1 级）–${Math.round(Math.min(R.dogBlockMax, R.dogBlockBase + R.dogBlockPerLv * 9) * 100)}%（10 级）几率把你赶走，并咬掉 ${R.dogBiteMin}–${R.dogBiteMax} 金币，这一季这块地你就不能再摘了。</p>
  <p><b>🤝 互助</b>：帮好友浇水/除草/除虫，每次得 ${R.helpExp} 经验和 ${R.helpGold} 金币，每天最多 ${R.helpDailyLimit} 次。</p>
  <h3>💰 经济</h3>
  <p>作物可以卖给系统（每日行情🔥有两种作物涨价），也可以交给 📦订单（更高收益），或在 🏷️集市卖给其他玩家（手续费 ${Math.round(R.marketFee * 100)}%，价格限制在系统价 ${R.marketMinMult}–${R.marketMaxMult} 倍）。</p>
  <p><b>📅 时间</b>：每日任务、签到和订单在每天 0 点（北京时间）刷新；每周任务、周排行和赛季在每周一 0 点结算。</p>
  <p><b>⌨️ 快捷键</b>：1 自动 · 2 铲除 · 3 化肥 · Q 一键收获/摘取 · W 一键护理/帮忙 · E 一键种植 · H 回家 · Esc 关闭</p>
  </div>`, { wide: true });
}
