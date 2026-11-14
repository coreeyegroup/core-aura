const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const script = fs.readFileSync('web/viewport.js','utf8');
function run({touch=1,width=393,height=873,outer=393}={}) {
 const meta = {content:'width=device-width,initial-scale=1,viewport-fit=cover'};
 vm.runInNewContext(script,{document:{querySelector:()=>meta},navigator:{maxTouchPoints:touch},
 screen:{width,height},window:{outerWidth:outer},addEventListener(){},setTimeout});
 return meta.content;
}
assert.match(run(), /width=393/);
assert.match(run({outer:980}), /width=393/);
assert.match(run({width:873,height:393,outer:873}), /width=873/);
assert.match(run({touch:0}), /width=device-width/);
assert.match(run({width:1366,height:768,outer:1366}), /width=device-width/);
console.log('Phone viewport, landscape, desktop pointer and tablet checks passed.');
