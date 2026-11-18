// Existing regression flows accept explicit replacement prompts; targeted tests
// attach their own handler to test cancellation and draft protection.
const {BrowserContext}=require('playwright');
const original=BrowserContext.prototype.newPage;
BrowserContext.prototype.newPage=async function(...args){const page=await original.apply(this,args);page.on('dialog',dialog=>{const hasHandler=page.listenerCount('dialog')>1;queueMicrotask(()=>{if(!hasHandler&&dialog.type()==='confirm'&&/^Replace current playback|Replace the unfinished sound workspace/.test(dialog.message()))void dialog.accept().catch(()=>{});});});return page;};
