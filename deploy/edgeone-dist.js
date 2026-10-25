// EdgeOne Pages 构建：先生成 index.html，再把需要公开的静态文件复制到 dist/（服务端源码不会出现在静态目录里）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
require('../src/build.js'); require('./bundle-functions.js');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
for (const f of ['index.html', 'admin.html', 'art-preview.html', 'vendor/three.min.js', 'vendor/three-addons.js', 'vendor/THREE-LICENSE.txt']) fs.copyFileSync(path.join(root, f), path.join(out, f));
// 美术测试包（新角色预览页用）：只复制游戏用的 glb / jpg
fs.cpSync(path.join(root, 'art'), path.join(out, 'art'), { recursive: true, filter: f => fs.statSync(f).isDirectory() || /\.(glb|gz|jpg)$/.test(f) });
console.log('dist ready:', fs.readdirSync(out).join(', '));
