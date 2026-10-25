// 构建：把 shared/config.js 与 src/ 下的脚本、样式拼成单文件 index.html（根目录）；three.js 以 vendor/three.min.js 单独加载。
// 用法：node src/build.js            → 接口与页面同域
//       API_BASE=https://api.x.com node src/build.js → 前端单独托管时指定接口地址
const fs = require('fs'), path = require('path');
const d = __dirname, root = path.join(d, '..'), r = f => fs.readFileSync(path.join(d, f), 'utf8');
const api = (process.env.API_BASE || '').replace(/[^\w:/.\-]/g, '');
require('../tools/build-content').build(); // 先从 content/*.jsonc 生成 shared/content.js（并校验）
const tpl = r('template.html'); let out = tpl;
const parts = { '/*CSS*/': r('style.css'), '/*CONTENT*/': fs.readFileSync(path.join(root, 'shared/content.js'), 'utf8'), '/*CONFIG*/': fs.readFileSync(path.join(root, 'shared/config.js'), 'utf8'), '/*NET*/': r('net.js'), '/*ICONS*/': r('icons.js'), '/*AVATAR*/': r('avatar2d.js'), '/*MC*/': r('mcubes.js'), '/*WORLD*/': r('world3d.js'), '/*ZONES*/': r('zones.js'), '/*GAME*/': r('game.js'), '/*UI*/': r('ui.js'), '/*HOMEBUILD*/': r('homebuild.js'), '/*API_BASE*/': api };
// 构建时间（北京时间），显示在设置页，用来确认线上是不是最新版本
const bt = new Date(Date.now() + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
parts['/*CONFIG*/'] = `var HF_BUILT = '${bt}';\n` + parts['/*CONFIG*/'];
Object.keys(parts).forEach(k => { out = out.replace(k, () => parts[k]); });
const cnt = s => (s.match(/<\/script>/g) || []).length;
if (cnt(out) !== cnt(tpl)) throw new Error('脚本里出现了 </script>，会截断页面');
// 语法自检：页面脚本有语法错误就不输出，避免把打不开的页面部署上线
{ const vm = require('vm'), re = /<script>([\s\S]*?)<\/script>/g; let m, i = 0; while ((m = re.exec(out))) { i++; try { new vm.Script(m[1], { filename: 'index.html#script' + i }); } catch (e) { throw new Error('页面脚本语法错误：' + e.message); } } }
fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('built index.html', out.length, 'bytes', api ? '(API ' + api + ')' : '');
