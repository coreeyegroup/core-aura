const {chromium}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs");
function wav(hz){const rate=16000,seconds=25,b=Buffer.alloc(44+rate*seconds*2);b.write("RIFF");b.writeUInt32LE(b.length-8,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(b.length-44,40);for(let n=0;n<rate*seconds;n++)b.writeInt16LE(Math.round(Math.sin(n*2*Math.PI*hz/rate)*4000),44+n*2);return b;}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:["--no-sandbox"]});try{
 const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];
 p.on("pageerror",e=>errors.push(e.message));await p.addInitScript(()=>{const original=AudioContext.prototype.createAnalyser;AudioContext.prototype.createAnalyser=function(){const a=original.call(this);window.__trackAnalyser=a;return a;};});await p.goto("http://localhost:8089/#chakras");
 await p.locator(".soundtrack-panel > summary").click();
 const input=p.getByLabel("Import sound tracks",{exact:true});
 await input.setInputFiles([{name:"rain.wav",mimeType:"audio/wav",buffer:wav(222)},{name:"river.wav",mimeType:"audio/wav",buffer:wav(333)}]);
 await p.getByText("2 track(s) added.",{exact:true}).waitFor();assert.equal(await p.locator(".soundtrack-row").count(),2);
 const rain=p.getByRole("article",{name:"rain sound track",exact:true}),river=p.getByRole("article",{name:"river sound track",exact:true});
 await rain.getByRole("button",{name:"Play rain",exact:true}).click();await rain.getByRole("button",{name:"Pause rain",exact:true}).waitFor();await p.waitForFunction(()=>{const a=window.__trackAnalyser;if(!a)return false;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return data.some(n=>Math.abs(n)>.00001);});
 await p.getByRole("article",{name:"Root chakra",exact:true}).getByRole("button",{name:"Play",exact:true}).click();
 await rain.getByRole("button",{name:"Pause rain",exact:true}).waitFor();await p.waitForFunction(()=>document.querySelectorAll(".chakra-row.active").length===1);
 await river.getByRole("button",{name:"Play river",exact:true}).click();await river.getByRole("button",{name:"Pause river",exact:true}).waitFor();
 await rain.getByRole("button",{name:"Pause rain",exact:true}).click();await rain.getByRole("button",{name:"Resume rain",exact:true}).waitFor();
 await rain.getByLabel("rain position",{exact:true}).press("End");assert.ok(Number(await rain.getByLabel("rain position",{exact:true}).inputValue())>=20);
 await rain.getByRole("button",{name:"Repeat rain",exact:true}).click();await rain.getByRole("button",{name:"Mute rain",exact:true}).click();await rain.getByRole("button",{name:"Unmute rain",exact:true}).waitFor();
 await rain.getByRole("button",{name:"Resume rain",exact:true}).click();
 // Starting an extra generated layer keeps chakra and imported audio playing.
 await p.locator(".generated-track-panel > summary").click();await p.locator(".generated-track-panel").getByRole("button",{name:"Play",exact:true}).first().click();
 await p.waitForFunction(()=>document.querySelectorAll(".chakra-row.active").length===1);await rain.getByRole("button",{name:"Pause rain",exact:true}).waitFor();
 await input.setInputFiles({name:"rain.wav",mimeType:"audio/wav",buffer:wav(222)});await p.getByText(/already in your tracks/).waitFor();assert.equal(await p.locator(".soundtrack-row").count(),2);
 await input.setInputFiles({name:"broken.wav",mimeType:"audio/wav",buffer:Buffer.from("invalid")});await p.getByText(/cannot play that audio/).waitFor();
 await rain.locator(".track-options > summary").click();await rain.getByRole("button",{name:"Rename",exact:true}).click();await rain.getByLabel("Track name",{exact:true}).fill("Evening rain");await rain.getByRole("button",{name:"Save name",exact:true}).click();
 await p.getByRole("article",{name:"Evening rain sound track",exact:true}).waitFor();
 await p.getByRole("button",{name:"Settings",exact:true}).click();await p.getByRole("button",{name:"Stop all audio",exact:true}).click();await p.getByRole("button",{name:"Close settings",exact:true}).click();
 await p.getByRole("button",{name:"Play Evening rain",exact:true}).waitFor();
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await c.setOffline(true);await p.reload();await p.locator(".soundtrack-panel > summary").click();
 const restored=p.getByRole("article",{name:"Evening rain sound track",exact:true});await restored.getByRole("button",{name:"Repeat Evening rain",exact:true}).waitFor();assert.equal(await restored.getByRole("button",{name:"Repeat Evening rain",exact:true}).getAttribute("aria-pressed"),"true");
 await restored.getByRole("button",{name:"Play Evening rain",exact:true}).click();await restored.getByRole("button",{name:"Pause Evening rain",exact:true}).waitFor();
 await restored.locator(".track-options > summary").click();const downloading=p.waitForEvent("download");await restored.getByRole("button",{name:"Export original",exact:true}).click();const download=await downloading;assert.equal(download.suggestedFilename(),"rain.wav");
 p.once("dialog",d=>d.accept());await restored.getByRole("button",{name:"Delete track",exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll(".soundtrack-row").length===1);
 for(const width of [320,393,430]){await p.setViewportSize({width,height:852});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));fs.mkdirSync("mobile-verification",{recursive:true});await p.locator(".soundtrack-panel").scrollIntoViewIfNeeded();await p.screenshot({path:"mobile-verification/soundtracks-"+width+".png"});}
 assert.deepEqual(errors,[]);await c.close();console.log("Track imports, actual media playback, chakra/generated coexistence, seek, mute, repeat, duplicate/invalid rejection, rename, global Stop, offline restoration, original export, active deletion and phone layout passed.");
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
