'use strict';
/* 各玩法模块共用的工具（V0.4 从 server/game.js 拆出） */
const CFG = require('../../shared/config');
const U = require('../util');
const { CROPS, RULES, NPLOTS, UNLOCK_ORDER } = CFG;
const { bad, forbid, notFound, conflict } = U;
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[U.randInt(0, a.length - 1)];
const SHEEP_W = t => (CFG.SHEEP[t] || { wool: 0 }).wool;
const cropOfItem = item => { const m = /^([cg])(\d+)$/.exec(item || ''); if (!m || !CROPS[+m[2]]) return null; return { golden: m[1] === 'g', id: +m[2] }; };
const itemName = item => { const ri = CFG.ranchItem(item); if (ri) return ri.name; const si = CFG.SHOP_ITEMS.find(x => x.id === item); if (si) return si.name; const c = cropOfItem(item); return c ? (c.golden ? '金色' : '') + CROPS[c.id].name : item; };
const all = Promise.all.bind(Promise);
module.exports = { CFG, U, CROPS, RULES, NPLOTS, UNLOCK_ORDER, bad, forbid, notFound, conflict, J, clampN, pick, SHEEP_W, cropOfItem, itemName, all };
