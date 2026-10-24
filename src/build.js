// 构建：把 shared/config.js 与 src/ 下的脚本、样式拼成单文件 index.html（根目录）；three.js 以 vendor/three.min.js 单独加载。
// 用法：node src/build.js            → 接口与页面同域
//       API_BASE=https://api.x.com node src/build.js → 前端单独托管时指定接口地址
const fs = require('fs'), path = require('path');
const d = __dirname, root = path.join(d, '..'), r = f => fs.readFileSync(path.join(d, f), 'utf8');
const api = (process.env.API_BASE || '').replace(/[^\w:/.\-]/g, '');
const tpl = r('template.html'); let out = tpl;
const parts = { '/*CSS*/': r('style.css'), '/*CONFIG*/': fs.readFileSync(path.join(root, 'shared/config.js'), 'utf8'), '/*NET*/': r('net.js'), '/*ICONS*/': r('icons.js'), '/*AVATAR*/': r('avatar2d.js'), '/*MC*/': r('mcubes.js'), '/*WORLD*/': r('world3d.js'), '/*GAME*/': r('game.js'), '/*UI*/': r('ui.js'), '/*API_BASE*/': api };
Object.keys(parts).forEach(k => { out = out.replace(k, () => parts[k]); });
const cnt = s => (s.match(/<\/script>/g) || []).length;
if (cnt(out) !== cnt(tpl)) throw new Error('脚本里出现了 </script>，会截断页面');
fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('built index.html', out.length, 'bytes', api ? '(API ' + api + ')' : '');
