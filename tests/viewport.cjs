const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const script = fs.readFileSync('web/viewport.js','utf8');
function run(width, phone) {
 const meta = {content:'width=device-width,initial-scale=1,viewport-fit=cover'};
 vm.runInNewContext(script, {document:{querySelector:()=>meta},matchMedia:()=>({matches:phone}),
 screen:{width:393,height:873}, innerWidth:width,addEventListener(){},setTimeout});
 return meta.content;
}
assert.equal(run(980,true),'width=393,initial-scale=1,viewport-fit=cover');
assert.equal(run(393,true),'width=device-width,initial-scale=1,viewport-fit=cover');
assert.equal(run(980,false),'width=device-width,initial-scale=1,viewport-fit=cover');
console.log('Touch phone viewport recovery and normal zoom declaration checks passed.');
