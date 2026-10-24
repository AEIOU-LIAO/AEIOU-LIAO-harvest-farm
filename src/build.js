const fs = require('fs'), path = require('path');
const d = __dirname, r = f => fs.readFileSync(path.join(d, f), 'utf8');
let out = r('template.html');
out = out.replace('/*CSS*/', () => r('style.css')).replace('/*ART*/', () => r('art.js')).replace('/*SCENE*/', () => r('scene.js')).replace('/*GAME*/', () => r('game.js'));
fs.writeFileSync(path.join(d, 'farm.html'), out);
console.log('built', out.length, 'bytes');
