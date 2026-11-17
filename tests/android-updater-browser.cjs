const {chromium}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs");
(async()=>{const browser=await chromium.launch({args:["--no-sandbox"]});try{
 const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];let popups=0;
 p.on("pageerror",e=>errors.push(e.message));p.on("popup",()=>popups++);
 await p.addInitScript(()=>{
  window.__installCalls=0;window.__openDownloads=0;window.__installedCode=22;
  window.CapacitorCustomPlatform={name:"android"};
  const promiseMethods=["info","updateStatus","installUpdate","cancelUpdate","openDownload","removeListener"];
  window.Capacitor={PluginHeaders:[{name:"AppDistribution",methods:[...promiseMethods.map(name=>({name,rtype:"promise"})),{name:"addListener",rtype:"callback"}]},{name:"LocalNotifications",methods:[...["checkPermissions","getPending","schedule","cancel","removeListener"].map(name=>({name,rtype:"promise"})),{name:"addListener",rtype:"callback"}]}],
   nativeCallback(plugin,method,options,callback){if(plugin==="AppDistribution"&&method==="addListener")window.__updateProgress=callback;return "listener-1";},
   async nativePromise(plugin,method,options){
    if(plugin==="LocalNotifications")return method==="checkPermissions"?{display:"granted"}:method==="getPending"?{notifications:[]}:{};
    if(method==="info")return {applicationId:"in.coreeye.coreaura",versionName:"0."+window.__installedCode+".0",versionCode:window.__installedCode,sdk:34,certificateSha256:"b".repeat(64),debug:false};
    if(method==="updateStatus")return {phase:"idle",busy:false,received:0,total:0};
    if(method==="installUpdate"){window.__installCalls++;window.__lastRelease=options.release;return new Promise(resolve=>{window.__finishUpdate=resolve;});}
    if(method==="cancelUpdate"){window.__updateProgress?.({phase:"cancelled",busy:false,received:0,total:8000000});window.__finishUpdate?.({status:"cancelled"});return {};}
    if(method==="openDownload"){window.__openDownloads++;throw Error("An update must not use an external browser.");}
    return {};
   }};
 });
 await p.route("https://core-aura.coreeye.in/android/latest.json",route=>route.fulfill({headers:{"access-control-allow-origin":"*"},json:{schemaVersion:1,applicationId:"in.coreeye.coreaura",versionName:"0.23.0",versionCode:23,minSdk:23,url:"https://core-aura.coreeye.in/android/releases/"+"a".repeat(64)+"/core-aura-0.23.0.apk",sha256:"a".repeat(64),certificateSha256:"b".repeat(64),size:8000000,publishedAt:"2026-11-17T10:00:00Z"}}));
 await p.goto("http://localhost:8089/#home");await p.getByRole("button",{name:"Settings",exact:true}).click();
 const button=p.getByRole("button",{name:"Update latest",exact:true});assert.equal(await button.count(),1);await button.click();await p.waitForFunction(()=>window.__installCalls===1);
 await p.evaluate(()=>window.__updateProgress({phase:"downloading",busy:true,received:4000000,total:8000000}));await p.getByText("50% downloaded",{exact:true}).waitFor();assert.equal(await button.isDisabled(),true);
 await p.getByRole("button",{name:"Close settings",exact:true}).click();await p.getByRole("button",{name:"Settings",exact:true}).click();await p.getByText("50% downloaded",{exact:true}).waitFor();
 await p.getByRole("button",{name:"Cancel update",exact:true}).click();await p.getByText("Update cancelled. The installed app was kept.",{exact:true}).waitFor();
 await button.click();await p.waitForFunction(()=>window.__installCalls===2);await p.evaluate(()=>window.__updateProgress({phase:"permission",busy:true,received:8000000,total:8000000}));await p.getByText("Allow updates from Core-aura in Android, then return here to continue.",{exact:true}).waitFor();
 await p.evaluate(()=>window.__updateProgress({phase:"installing",busy:true,received:8000000,total:8000000}));assert.equal(await p.getByRole("button",{name:"Cancel update",exact:true}).count(),0);
 await p.evaluate(()=>window.__updateProgress({phase:"confirming",busy:true,received:8000000,total:8000000}));await p.getByText("Confirm Update in Android to finish.",{exact:true}).waitFor();assert.equal(await p.getByRole("button",{name:"Cancel update",exact:true}).count(),0);
 await p.evaluate(()=>{window.__installedCode=23;window.__finishUpdate({status:"installed"});});await p.getByText("Installed: 0.23.0 · build 23",{exact:true}).waitFor();
 await button.click();await p.getByText("You have the latest Android app.",{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.__installCalls),2);assert.equal(await p.evaluate(()=>window.__openDownloads),0);assert.equal(popups,0);
 for(const width of [320,393]){await p.setViewportSize({width,height:852});await p.locator(".android-updates").scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));fs.mkdirSync("mobile-verification",{recursive:true});await p.screenshot({path:"mobile-verification/android-native-updater-"+width+".png"});}
 assert.deepEqual(errors,[]);await c.close();console.log("Mocked native UI: one Update latest action, private installer invocation, progress across Settings, cancellation, permission/installer phases, current version and no browser download passed.");
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
