const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({args:['--no-sandbox']});
  fs.mkdirSync('mobile-verification',{recursive:true});
  const results=[];
  try {
    for (const width of [320,360,393,430]) {
      const context = await browser.newContext({viewport:{width,height:852},screen:{width,height:852},
        isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await context.newPage();
      await page.goto('http://localhost:8089');
      await page.locator('#play').waitFor();
      const metrics=await page.evaluate(() => ({
        width:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth,
        bodyFont:parseFloat(getComputedStyle(document.body).fontSize),
        labelFont:parseFloat(getComputedStyle(document.querySelector('#tuning')).fontSize),
        button:document.querySelector('#play').getBoundingClientRect().toJSON(),
        scale:visualViewport.scale,
        nav:document.querySelector('.bottom-nav').getBoundingClientRect().toJSON()
      }));
      console.log('Phone measurements',JSON.stringify({width,...metrics}));
      await page.screenshot({path:'mobile-verification/studio-'+width+'.png'});
      assert.equal(metrics.width,width);
      assert.ok(metrics.overflow<=width);
      assert.ok(metrics.bodyFont>=16 && metrics.labelFont>=14);
      assert.ok(metrics.button.height>=48 && metrics.button.width>=48);
      assert.ok(metrics.scale>=0.99 && metrics.scale<=1.01);
      assert.ok(metrics.nav.bottom<=853);
      await page.screenshot({path:'mobile-verification/studio-'+width+'.png'});
      await page.getByRole('link',{name:'Chakra Healing',exact:true}).click();
      assert.equal(await page.locator('.chakra-card').count(),7);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
      const root=page.locator('.chakra-card').first();
      await root.locator('[data-play]').click();
      await page.waitForFunction(()=>document.querySelector('[data-state]').textContent==='playing');
      await root.locator('[data-play]').click();
      await page.waitForFunction(()=>document.querySelector('[data-state]').textContent==='paused');
      await root.locator('[data-stop]').click();
      await page.screenshot({path:'mobile-verification/chakras-'+width+'.png'});
      results.push({width,...metrics});
      await context.close();
    }
    // Desktop-style wide viewport with a phone-sized screen must recover to device width.
    const context=await browser.newContext({viewport:{width:393,height:852},screen:{width:393,height:852},
      isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await context.newPage();
    await page.route('http://localhost:8089/',async route => {
      const response=await route.fetch();
      const body=(await response.text()).replace('width=device-width,initial-scale=1,viewport-fit=cover','width=980,initial-scale=0.4,viewport-fit=cover');
      await route.fulfill({response,body});
    });
    await page.goto('http://localhost:8089');
    const recovered=await page.evaluate(()=>({width:innerWidth,scale:visualViewport.scale}));
    assert.equal(recovered.width,393);
    assert.ok(recovered.scale>=0.99);
    results.push({recovered});
    fs.writeFileSync('mobile-verification/measurements.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify(results));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
