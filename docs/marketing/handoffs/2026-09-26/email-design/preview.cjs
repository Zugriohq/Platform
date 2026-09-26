const { chromium } = require('C:/Users/JOBA/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const candidates = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'];
  const executablePath = candidates.find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless:true, ...(executablePath ? { executablePath } : {}) });
  const results=[];
  for (const width of [800,390]) {
    const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
    const html = fs.readFileSync(path.join(__dirname,'zugrio-welcome-dark.html'),'utf8').replace('{{ contact.FIRSTNAME|default:"there" }}', 'Oluwaniyi');
    await page.setContent(html, {waitUntil:'networkidle'});
    const broken = await page.evaluate(()=>Array.from(document.images).some(img=>!img.complete || !img.naturalWidth));
    if (broken) throw Error('Image failed to load');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow) throw Error('Horizontal overflow at '+width);
    await page.screenshot({path:path.join(__dirname,`preview-${width}.png`),fullPage:true});
    results.push({width,horizontalOverflow:overflow});
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results));
})().catch(e=>{console.error(e.message);process.exit(1)});
