const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SEARCH_TERM = process.argv.slice(2).join(' ') || 'stainless steel water tank 5000L';
const MAX_RESULTS = Math.max(1, Math.min(20, Number(process.env.MAX_RESULTS || 10)));
const NAV_TIMEOUT_MS = 45000;
const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
const PROFILE_DIR = path.join(__dirname, '.profile');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(PROFILE_DIR, { recursive: true });

function log(section, msg){ console.log(`[${section}] ${msg}`); }

async function main(){
  const report={
    startedAt:new Date().toISOString(),
    searchTerm:SEARCH_TERM,
    checks:{
      browserLaunch:false,
      navigationSuccess:false,
      searchPageLoaded:false,
      resultsDetected:false,
      selectorsStable:false,
      botOrCaptchaEncountered:false,
      loginEncountered:false
    },
    selectorUsed:null,
    resultCountDetected:0,
    finalUrl:null,
    pageTitle:null,
    artifacts:{},
    results:[],
    error:null
  };

  let browser;
  try{
    log('browser','launching Chrome persistent profile...');
    const context=await chromium.launchPersistentContext(PROFILE_DIR,{
      channel:'chrome',
      headless:false,
      slowMo:80,
      locale:'en-US',
      viewport:{width:1366,height:900}
    });
    browser=context.browser();
    report.checks.browserLaunch=true;
    const page=context.pages()[0] || await context.newPage();

    const searchUrl='https://www.made-in-china.com/products-search/hot-china-products/'+encodeURIComponent(SEARCH_TERM.replace(/\s+/g,'_'))+'.html';
    log('nav',`going to: ${searchUrl}`);
    const resp=await page.goto(searchUrl,{waitUntil:'domcontentloaded',timeout:NAV_TIMEOUT_MS});
    report.checks.navigationSuccess=!!resp && resp.status()<400;
    report.finalUrl=page.url();
    report.pageTitle=await page.title().catch(()=>null);
    log('nav',`status=${resp?resp.status():'no-response'}`);

    await page.waitForTimeout(5000);
    const html=(await page.content()).toLowerCase();
    if(
      html.includes('captcha') ||
      html.includes('verify you are human') ||
      html.includes('security verification') ||
      html.includes('robot check')
    ){
      report.checks.botOrCaptchaEncountered=true;
      log('guard','verification/captcha detected');
    }
    if((html.includes('sign in')||html.includes('login')) && html.includes('password')){
      report.checks.loginEncountered=true;
    }

    await page.mouse.wheel(0,1400).catch(()=>{});
    await page.waitForTimeout(2500);

    const selectors=[
      '.prod-info',
      '.product-item',
      '.product-card',
      '[class*="product"]'
    ];

    let cards=[];
    for(const sel of selectors){
      const found=await page.locator(sel).elementHandles().catch(()=>[]);
      if(found.length){
        cards=found;
        report.selectorUsed=sel;
        report.resultCountDetected=found.length;
        log('results',`selector used: ${sel} (${found.length})`);
        break;
      }
    }

    const directResults = await page.evaluate((max) => {
      const anchors = [...document.querySelectorAll('a[href]')].filter(a => {
        const h = a.href || '';
        return /\.en\.made-in-china\.com\/product\//i.test(h) || /made-in-china\.com\/product\//i.test(h);
      });

      const seen = new Set();
      const out = [];

      for (const a of anchors) {
        const cleanUrl = (a.href || '').split('?')[0];
        if (!cleanUrl || seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);

        let root = a;
        let best = a;
        for (let i = 0; i < 7 && root && root.parentElement; i++, root = root.parentElement) {
          const txt = (root.innerText || '').trim();
          if (txt.length >= 80 && txt.length <= 1800) best = root;
        }

        const text = (best.innerText || a.innerText || '').trim();
        const lines = text.split(/\n+/).map(x => x.trim()).filter(Boolean);

        const linkText = (a.innerText || '').trim();
        const title =
          (linkText.length > 20 && !/^(?:US\$|USD|\$)/i.test(linkText) ? linkText : null) ||
          lines.find(x =>
            x.length > 30 &&
            !/^(?:US\$|USD|\$)/i.test(x) &&
            !/^(?:send inquiry|contact now|chat now)$/i.test(x)
          ) ||
          null;

        const price =
          lines.find(x => /(?:US\$|USD|\$)\s*[0-9][0-9,]*(?:\.\d+)?(?:\s*[-–]\s*[0-9][0-9,]*(?:\.\d+)?)?/i.test(x)) ||
          null;

        const supplier =
          lines.find(x => /(?:Co\.,?\s*Ltd\.?|Company|Factory|Manufacturer)/i.test(x)) ||
          null;

        if (title || price || supplier) out.push({ title, price, supplier, url: cleanUrl });
        if (out.length >= max * 4) break;
      }

      return out;
    }, MAX_RESULTS);

    const normalizedMap = new Map();
    for (const item of directResults) {
      if (!item || !item.url) continue;
      const prev = normalizedMap.get(item.url) || { title:null, price:null, supplier:null, url:item.url };
      if (item.title && (!prev.title || item.title.length > prev.title.length)) prev.title = String(item.title).trim();
      if (item.price && !prev.price) prev.price = String(item.price).trim();
      if (item.supplier && !prev.supplier) prev.supplier = String(item.supplier).trim();
      normalizedMap.set(item.url, prev);
    }

    const normalizedResults = [...normalizedMap.values()]
      .filter(x => x.title || x.price || x.supplier)
      .slice(0, MAX_RESULTS);

    report.selectorUsed = 'unique-product-links';
    report.resultCountDetected = normalizedMap.size;
    report.checks.searchPageLoaded=true;
    report.checks.resultsDetected=normalizedResults.length>0;
    report.checks.selectorsStable=normalizedResults.length>=Math.min(MAX_RESULTS,5);
    report.resultCountDetected = Math.max(report.resultCountDetected, normalizedResults.length);
    report.results=normalizedResults;

    const stamp=Date.now();
    const screenshotPath=path.join(ARTIFACT_DIR,`made-in-china-${stamp}.png`);
    const htmlPath=path.join(ARTIFACT_DIR,`made-in-china-${stamp}.html`);
    const reportPath=path.join(ARTIFACT_DIR,`report-${stamp}.json`);
    await page.screenshot({path:screenshotPath,fullPage:false});
    fs.writeFileSync(htmlPath,await page.content());
    report.artifacts={screenshotPath,htmlPath,reportPath};
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2));

    console.log('\n================ REPORT ================');
    console.log(JSON.stringify(report,null,2));
    console.log('========================================\n');

    const keepOpenMs=Math.max(0,Number(process.env.KEEP_OPEN_MS||10000));
    if(keepOpenMs) await page.waitForTimeout(keepOpenMs);
  }catch(err){
    report.error=err&&err.stack?err.stack:String(err);
    console.error('\n[ERROR]',err);
    process.exitCode=1;
  }finally{
    if(browser) await browser.close().catch(()=>{});
  }
}
main();
