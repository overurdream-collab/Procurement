const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEFAULT_SEARCH_TERM = '5000L \u4e0d\u9508\u94a2 \u6c34\u7bb1';
const SEARCH_TERM = process.argv.slice(2).join(' ') || DEFAULT_SEARCH_TERM;
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
    searchTermEscaped:[...SEARCH_TERM].map(ch=>ch.charCodeAt(0)>127?'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0'):ch).join(''),
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
      locale:'zh-CN',
      viewport:{width:1366,height:900}
    });
    browser=context.browser();
    report.checks.browserLaunch=true;
    const page=context.pages()[0] || await context.newPage();

    const searchUrl='https://s.1688.com/selloffer/offer_search.htm?keywords='+encodeURIComponent(SEARCH_TERM);
    log('nav',`going to: ${searchUrl}`);
    const resp=await page.goto(searchUrl,{waitUntil:'domcontentloaded',timeout:NAV_TIMEOUT_MS});
    report.checks.navigationSuccess=!!resp && resp.status()<400;
    report.finalUrl=page.url();
    report.pageTitle=await page.title().catch(()=>null);
    log('nav',`status=${resp?resp.status():'no-response'}`);

    await page.waitForTimeout(5000);
    let html=(await page.content()).toLowerCase();

    if(
      html.includes('captcha') ||
      html.includes('滑块') ||
      html.includes('安全验证') ||
      html.includes('please slide') ||
      html.includes('verify you are human')
    ){
      report.checks.botOrCaptchaEncountered=true;
      log('guard','VERIFICATION_REQUIRED');
      log('guard','manual verification required; waiting up to 300 seconds');
      const deadline=Date.now()+300000;
      while(Date.now()<deadline){
        await page.waitForTimeout(3000);
        html=(await page.content()).toLowerCase();
        const blocked=
          html.includes('滑块') ||
          html.includes('安全验证') ||
          html.includes('please slide') ||
          html.includes('verify you are human') ||
          html.includes('captcha');
        if(!blocked){
          log('guard','VERIFICATION_CLEARED');
          break;
        }
      }
    }

    const loginUrlDetected = /login\.(?:taobao|1688)\.com|passport\.taobao\.com/i.test(page.url());
    const loginTextDetected =
      (html.includes('密码登录') || html.includes('短信登录') || html.includes('免费注册') ||
       html.includes('扫码登录') || html.includes('忘记密码') || html.includes('登录页面'));

    if(loginUrlDetected || loginTextDetected){
      report.checks.loginEncountered=true;
      log('guard','LOGIN_REQUIRED');
      log('guard','1688/Taobao login required; waiting up to 300 seconds for manual login');

      const deadline=Date.now()+300000;
      let cleared=false;
      while(Date.now()<deadline){
        await page.waitForTimeout(3000);
        const currentUrl=page.url();
        const currentHtml=(await page.content()).toLowerCase();
        const stillLogin=
          /login\.(?:taobao|1688)\.com|passport\.taobao\.com/i.test(currentUrl) ||
          currentHtml.includes('密码登录') ||
          currentHtml.includes('短信登录') ||
          currentHtml.includes('扫码登录');

        if(!stillLogin){
          cleared=true;
          log('guard','LOGIN_CLEARED');
          break;
        }
      }

      if(!cleared){
        log('guard','LOGIN_TIMEOUT');
      }else{
        await page.waitForLoadState('domcontentloaded').catch(()=>{});
        await page.waitForTimeout(2500);

        if(!/s\.1688\.com\/selloffer\/offer_search\.htm/i.test(page.url())){
          log('guard','returning to 1688 search after login');
          await page.goto(searchUrl,{waitUntil:'domcontentloaded',timeout:NAV_TIMEOUT_MS}).catch(()=>{});
          await page.waitForTimeout(5000);
        }

        report.finalUrl=page.url();
        report.pageTitle=await page.title().catch(()=>report.pageTitle);
      }
    }

    await page.mouse.wheel(0,1600).catch(()=>{});
    await page.waitForTimeout(2500);

    const diagnostics = await page.evaluate(() => {
      const all=[...document.querySelectorAll('a[href]')].map(a=>a.href||'');
      const detail=all.filter(h=>/detail\.1688\.com/i.test(h));
      const offer=all.filter(h=>/offer/i.test(h));
      const body=(document.body && document.body.innerText || '').slice(0,12000);
      return {
        anchorCount:all.length,
        detailLinkCount:detail.length,
        offerLikeCount:offer.length,
        sampleLinks:[...new Set([...detail.slice(0,8),...offer.slice(0,8)])].slice(0,12),
        noResultText:/没有找到|暂无相关|无相关商品|没有相关/i.test(body)
      };
    });
    report.diagnostics=diagnostics;
    log('diag', 'anchors='+diagnostics.anchorCount+' detail='+diagnostics.detailLinkCount+' offerLike='+diagnostics.offerLikeCount+' noResult='+diagnostics.noResultText);

    const directResults = await page.evaluate((max) => {
      const nodes=[...document.querySelectorAll('a[href], [data-href], [data-url]')];
      const anchors=nodes.map(el=>({
        el,
        href:el.href || el.getAttribute('data-href') || el.getAttribute('data-url') || ''
      })).filter(x=>{
        const h=x.href||'';
        return /detail\.1688\.com\/offer\//i.test(h) ||
               /1688\.com\/offer\//i.test(h) ||
               /detail\.1688\.com/i.test(h);
      });

      const out=[],seen=new Set();
      for(const row of anchors){
        const a=row.el;
        const cleanUrl=(row.href||'').split('#')[0].split('?')[0];
        if(!cleanUrl||seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);

        let root=a,best=a;
        for(let i=0;i<8&&root&&root.parentElement;i++,root=root.parentElement){
          const txt=(root.innerText||'').trim();
          if(txt.length>=80 && txt.length<=2200) best=root;
        }
        const text=(best.innerText||a.innerText||'').trim();
        const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);

        const rawTitle=(a.innerText||'').trim();
        const title=
          (rawTitle.length>8 && !/^[¥￥]?\s*[0-9,.]+/.test(rawTitle) ? rawTitle : null) ||
          lines.find(x=>x.length>10 && !/^[¥￥]?\s*[0-9,.]+/.test(x)) ||
          null;

        const price=
          lines.find(x=>/(?:¥|￥)\s*[0-9][0-9,.]*(?:\s*[-–~]\s*[0-9][0-9,.]*)?/i.test(x)) ||
          null;

        const supplier=
          lines.find(x=>/(?:有限公司|工厂|厂|公司|商行|制造|科技)/.test(x) && x.length<120) ||
          null;

        if(title||price||supplier) out.push({title,price,supplier,url:cleanUrl});
        if(out.length>=max*4) break;
      }
      return out;
    }, MAX_RESULTS);

    const map=new Map();
    for(const item of directResults){
      if(!item||!item.url) continue;
      const prev=map.get(item.url)||{title:null,price:null,supplier:null,url:item.url};
      if(item.title && (!prev.title || item.title.length>prev.title.length)) prev.title=String(item.title).trim();
      if(item.price && !prev.price) prev.price=String(item.price).trim();
      if(item.supplier && !prev.supplier) prev.supplier=String(item.supplier).trim();
      map.set(item.url,prev);
    }

    const normalized=[...map.values()].filter(x=>x.title||x.price||x.supplier).slice(0,MAX_RESULTS);
    report.selectorUsed='unique-offer-links';
    report.resultCountDetected=map.size;
    report.checks.searchPageLoaded=true;
    report.checks.resultsDetected=normalized.length>0;
    report.checks.selectorsStable=normalized.length>=Math.min(MAX_RESULTS,5);
    report.results=normalized;

    const stamp=Date.now();
    const screenshotPath=path.join(ARTIFACT_DIR,`1688-${stamp}.png`);
    const htmlPath=path.join(ARTIFACT_DIR,`1688-${stamp}.html`);
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
