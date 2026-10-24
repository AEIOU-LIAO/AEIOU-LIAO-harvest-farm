// EdgeOne Pages 构建：先生成 index.html，再把需要公开的静态文件复制到 dist/（服务端源码不会出现在静态目录里）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
require('../src/build.js');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
for (const f of ['index.html', 'admin.html', 'vendor/three.min.js', 'vendor/THREE-LICENSE.txt']) fs.copyFileSync(path.join(root, f), path.join(out, f));
console.log('dist ready:', fs.readdirSync(out).join(', '));
