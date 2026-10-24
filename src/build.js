// 构建：把 shared/config.js 与 src/ 下的脚本、样式拼成单文件 index.html（根目录），供 Node 服务或任意静态托管使用。
// 用法：node src/build.js            → 接口与页面同域
//       API_BASE=https://api.x.com node src/build.js → 前端单独托管时指定接口地址
const fs = require('fs'), path = require('path');
const d = __dirname, root = path.join(d, '..'), r = f => fs.readFileSync(path.join(d, f), 'utf8');
const api = (process.env.API_BASE || '').replace(/[^\w:/.\-]/g, '');
let out = r('template.html');
const parts = { '/*CSS*/': r('style.css'), '/*CONFIG*/': fs.readFileSync(path.join(root, 'shared/config.js'), 'utf8'), '/*NET*/': r('net.js'), '/*ART*/': r('art.js'), '/*SCENE*/': r('scene.js'), '/*GAME*/': r('game.js'), '/*UI*/': r('ui.js'), '/*API_BASE*/': api };
Object.keys(parts).forEach(k => { out = out.replace(k, () => parts[k]); });
if (out.includes('</script') && (out.match(/<\/script>/g) || []).length !== 1) throw new Error('脚本里出现了 </script>，会截断页面');
fs.writeFileSync(path.join(root, 'index.html'), out);
console.log('built index.html', out.length, 'bytes', api ? '(API ' + api + ')' : '');
