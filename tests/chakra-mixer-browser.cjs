const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
(async()=>{
 const browser=await chromium.launch({args:["--no-sandbox"]});
 try {
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const p=await ctx.newPage(), errors=[];
  p.on("pageerror",e=>errors.push(e.message));
  await p.addInitScript(()=>{
   const original=AudioContext.prototype.createAnalyser;
   AudioContext.prototype.createAnalyser=function(){const result=original.call(this);window.__chakraAnalyser=result;return result;};
  });
  await p.goto("http://localhost:8089/#chakras");
  const rows=p.locator(".chakra-console .chakra-row"),dock=p.locator(".player-dock");
  assert.equal(await rows.count(),7);
  const root=rows.filter({has:p.getByLabel("Select Root",{exact:true})});
  const sacral=rows.filter({has:p.getByLabel("Select Sacral",{exact:true})});
  await root.getByLabel("Root sound type",{exact:true}).selectOption("bell");
  await root.getByRole("button",{name:"Play",exact:true}).click();
  await root.getByRole("button",{name:"Pause",exact:true}).waitFor();
  await p.waitForFunction(()=>{const a=window.__chakraAnalyser;if(!a)return false;const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return x.some(v=>Math.abs(v)>.00001);});
  await root.getByRole("button",{name:"Pause",exact:true}).click();
  await root.getByRole("button",{name:"Resume",exact:true}).waitFor();
  await root.getByRole("button",{name:"Resume",exact:true}).click();
  await root.getByRole("button",{name:"Mute Root",exact:true}).click();
  await root.locator(".chakra-row-state").filter({hasText:"Muted"}).waitFor();
  await root.getByRole("button",{name:"Unmute Root",exact:true}).click();
  await sacral.getByLabel("Sacral options",{exact:true}).click();
  await sacral.getByRole("button",{name:"Solo Sacral",exact:true}).click();
  await sacral.getByLabel("Sacral options",{exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll(".chakra-row.active").length===1 && document.querySelector('article[aria-label="Sacral chakra"]').classList.contains("active"));
  await dock.getByRole("button",{name:"Stop",exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector(".chakra-row.active"));
  await p.getByRole("button",{name:"All seven",exact:true}).click();
  await dock.getByRole("button",{name:"Play",exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll(".chakra-row.active").length===7);
  // No selection is needed to stop independently started or deselected voices.
  await p.getByRole("button",{name:"Selected (0)",exact:true}).click();
  await dock.getByRole("button",{name:"Pause",exact:true}).click();
  await p.waitForFunction(()=>Array.from(document.querySelectorAll(".chakra-row-state")).every(e=>e.textContent.includes("paused")));
  await dock.getByRole("button",{name:"Stop",exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector(".chakra-row.active"));
  await p.getByLabel("Select Root",{exact:true}).check();
  await p.getByLabel("Select Sacral",{exact:true}).check();
  await dock.getByRole("button",{name:"Play",exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll(".chakra-row.active").length===2);
  await p.getByLabel("Select Root",{exact:true}).uncheck();
  await p.getByLabel("Select Sacral",{exact:true}).uncheck();
  await dock.getByRole("button",{name:"Stop",exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector(".chakra-row.active"));
  await p.getByRole("heading",{name:"Chakra meditation"}).scrollIntoViewIfNeeded();
  await p.locator(".chakra-tools > summary").click();
  await p.getByLabel("Sound for all chakras",{exact:true}).selectOption("flute");
  await p.getByRole("button",{name:"Apply sound",exact:true}).click();
  assert.deepEqual(await rows.locator(".chakra-sound select").evaluateAll(es=>es.map(e=>e.value)),Array(7).fill("flute"));
  await p.getByLabel("Select Root",{exact:true}).check();
  await p.getByRole("button",{name:"Save",exact:true}).click();
  await p.getByLabel("Session name",{exact:true}).fill("Chakra flute mix");
  await p.getByRole("button",{name:"Save to Library",exact:true}).click();
  await p.reload();
  await p.getByLabel("Root sound type",{exact:true}).waitFor();
  assert.equal(await p.getByLabel("Root sound type",{exact:true}).inputValue(),"flute");
  for(const width of [320,360,393,430]){
   await p.setViewportSize({width,height:852});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Overflow at "+width);
   const buttons=await rows.first().locator(".compact-transport button").evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
   assert.ok(buttons.every(b=>b.w>=36&&b.h>=36));
   await p.getByRole("heading",{name:"Chakra meditation"}).scrollIntoViewIfNeeded();
   fs.mkdirSync("mobile-verification",{recursive:true});
   await p.screenshot({path:"mobile-verification/chakra-mixer-"+width+".png"});
  }
  assert.deepEqual(errors,[]);
  await ctx.close();
  console.log("Chakra audible output, individual pause/resume, mute, solo, all/selected, deselected-voice stop, group pause, bulk sound, save/restore and phone layout passed.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
