// Existing regression flows accept replacement prompts. Targeted tests install
// their own handler to verify cancellation and draft protection.
const {chromium}=require('playwright');
const launch=chromium.launch;
chromium.launch=async function(...args){const browser=await launch.apply(this,args),newContext=browser.newContext.bind(browser);browser.newContext=async(...args)=>{const context=await newContext(...args),newPage=context.newPage.bind(context);context.newPage=async(...args)=>{const page=await newPage(...args);page.on('dialog',dialog=>{const hasHandler=page.listenerCount('dialog')>1;queueMicrotask(()=>{if(!hasHandler&&dialog.type()==='confirm'&&/^Replace current playback|Replace the unfinished sound workspace/.test(dialog.message()))void dialog.accept().catch(()=>{});});});return page;};return context;};return browser;};
