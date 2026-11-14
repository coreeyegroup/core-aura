const vm=require('node:vm'), fs=require('node:fs'), assert=require('node:assert/strict');
const script=fs.readFileSync('web/viewport.js','utf8');
function run({touch=1,width=393,height=873,outer=393,inner=393,innerHeight=873,mode='auto'}={}) {
 const meta={content:''}, root={style:{},classList:{add(){},remove(){}}};
 vm.runInNewContext(script,{document:{querySelector:()=>meta,documentElement:root},
 localStorage:{getItem:()=>mode},navigator:{maxTouchPoints:touch,userAgent:''},
 screen:{width,height},window:{outerWidth:outer,innerWidth:inner,innerHeight},addEventListener(){},setTimeout});
 return {meta:meta.content,zoom:root.style.zoom};
}
assert.equal(run().zoom,'1');
assert.equal(run({inner:980}).zoom,String(980/393));
assert.equal(run({width:980,height:2100,outer:980,inner:980,innerHeight:2100}).zoom,String(980/360));
assert.equal(run({touch:0,width:1366,height:768,outer:1366,inner:1366}).zoom,'');
assert.equal(run({touch:0,inner:980,mode:'phone'}).zoom,String(980/360));
console.log('Ignored viewport, desktop-sized touch screen, normal phone and saved display override passed.');
