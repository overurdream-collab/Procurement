'use strict';
/* Visual acceptance, against a local protected Node server with synthetic only data.
 * Run after installing playwright in a temporary CI directory:
 * NODE_PATH=/tmp/alharir-qa/node_modules node test/visual-qa.cjs */
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const net=require('node:net'),{setTimeout:delay}=require('node:timers/promises');
const {chromium}=require('playwright');
const out=path.join(__dirname,'..','visual-qa-artifacts');fs.mkdirSync(out,{recursive:true});
const getPort=()=>new Promise((resolve,reject)=>{
 const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});
async function run(){
 const port=await getPort(),base='http://127.0.0.1:'+port;
 const user='visual-qa',pass='synthetic-visual-test-password-2026';
 const child=spawn(process.execPath,['server.js'],{
  cwd:path.join(__dirname,'..'),stdio:['ignore','pipe','pipe'],
  env:{...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
   HOSTED_ACCESS_USER:user,HOSTED_ACCESS_PASSWORD:pass,MARKET_ENABLE_LIVE_SEARCH:'false'}
 });
 let serverLog='';child.stderr.on('data',d=>serverLog+=String(d));
 let browser;
 const errors=[];
 try{
  let ok=false;
  for(let n=0;n<120;n++){
   if(child.exitCode!==null)throw Error('server exited '+serverLog.slice(-1000));
   try{if((await fetch(base+'/health/live')).status===200){ok=true;break}}catch{}
   await delay(100);
  }
  if(!ok)throw Error('server did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  async function context(name,width,height,isMobile=false){
   const c=await browser.newContext({viewport:{width,height},deviceScaleFactor:isMobile?2:1,
    isMobile,hasTouch:isMobile,httpCredentials:{username:user,password:pass},locale:'ar-YE'});
   const p=await c.newPage();p.on('pageerror',err=>errors.push(name+': '+err.message));
   p.on('console',message=>{if(message.type()==='error')errors.push(name+' console: '+message.text())});
   return {c,p};
  }
  const desktop=await context('desktop',1440,900);
  await desktop.p.goto(base+'/#dashboard',{waitUntil:'domcontentloaded'});
  await desktop.p.waitForSelector('.executive-home .stat strong',{timeout:20000});
  await desktop.p.waitForFunction(()=>[...document.querySelectorAll('.executive-home .stat strong')].length===8&&
   !document.querySelector('#pilotStatus')?.textContent?.includes('جارٍ'),{timeout:15000});
  if(!await desktop.p.locator('.side-nav').isVisible())throw Error('Desktop sidebar hidden');
  if(await desktop.p.locator('.executive-home .stat').count()!==8)throw Error('KPI count mismatch');
  if(await desktop.p.locator('.executive-home .panel').count()<4)throw Error('Charts incomplete');
  await desktop.p.screenshot({path:path.join(out,'desktop-home.png'),fullPage:true});
  await desktop.p.getByRole('link',{name:/التقارير/}).first().click();
  await desktop.p.waitForSelector('.eod-document .eod-sheet',{timeout:18000});
  if(!await desktop.p.locator('#reportPeriod').isVisible())throw Error('Report period missing');
  await desktop.p.screenshot({path:path.join(out,'desktop-reports.png'),fullPage:true});
  await desktop.p.selectOption('#reportPeriod','monthly');
  await desktop.p.waitForFunction(()=>document.querySelector('.eod-head h2')?.textContent.includes('الشهري'),{timeout:15000});
  await desktop.p.selectOption('#dailyAudience','buyer');
  await desktop.p.waitForFunction(()=>document.querySelector('.eod-head')?.textContent.includes('مشتري'),{timeout:15000});
  await desktop.p.screenshot({path:path.join(out,'desktop-buyer-monthly.png'),fullPage:true});
  if(await desktop.p.locator('.eod-sheet').count()!==2)throw Error('EOD report must have two sheets');
  await desktop.p.goto(base+'/request.html',{waitUntil:'domcontentloaded'});
  await desktop.p.waitForSelector('#rfqForm',{timeout:15000});
  await desktop.p.screenshot({path:path.join(out,'desktop-new-request.png'),fullPage:true});
  await desktop.p.locator('[name=title]').fill('Synthetic 100mm PIR panels');
  await desktop.p.locator('[name=product]').fill('100mm PIR insulated cold room panels');
  await desktop.p.locator('[name=quantity]').fill('150 m²');
  await desktop.p.locator('[name=specifications]').fill('PIR core, 100mm, steel skin 0.5mm, density 40 kg per m3');
  if(!await desktop.p.locator('#sumTitle').textContent().then(x=>x.includes('Synthetic')))throw Error('Live new request preview not updating');
  await desktop.p.locator('#confirm').check();
  await desktop.p.locator('#save').click();
  await desktop.p.waitForSelector('#result.show',{timeout:18000});
  const resultText=await desktop.p.locator('#result').innerText();
  if(!resultText.includes('تم إنشاء الطلب'))throw Error('New RFQ request failed: '+resultText);
  await desktop.p.getByText('فتح مساحة الطلب',{exact:true}).click();
  await desktop.p.waitForSelector('#requestMailCard',{timeout:18000});
  await desktop.p.waitForSelector('#requestMailList',{timeout:10000});
  await desktop.p.screenshot({path:path.join(out,'desktop-request-workspace-email.png'),fullPage:true});
  await desktop.c.close();
  const mobile=await context('mobile',390,844,true);
  await mobile.p.goto(base+'/#dashboard',{waitUntil:'domcontentloaded'});
  await mobile.p.waitForSelector('.executive-home .stat strong',{timeout:18000});
  await mobile.p.waitForFunction(()=>document.querySelectorAll('.executive-home .stat').length===8,{timeout:12000});
  await mobile.p.screenshot({path:path.join(out,'mobile-home.png'),fullPage:true});
  await mobile.p.locator('#sidebarToggle').click();
  if(!await mobile.p.locator('body').evaluate(node=>node.classList.contains('nav-open')))throw Error('Mobile sidebar did not open');
  await mobile.p.screenshot({path:path.join(out,'mobile-navigation.png'),fullPage:false});
  await mobile.p.locator('.side-nav [data-view=reports]').click();
  await mobile.p.waitForSelector('.eod-document .eod-sheet',{timeout:20000});
  if(await mobile.p.locator('body').evaluate(node=>node.classList.contains('nav-open')))throw Error('Mobile sidebar remained open');
  await mobile.p.screenshot({path:path.join(out,'mobile-reports.png'),fullPage:true});
  await mobile.p.goto(base+'/request.html',{waitUntil:'domcontentloaded'});
  await mobile.p.waitForSelector('#rfqForm',{timeout:15000});
  await mobile.p.screenshot({path:path.join(out,'mobile-new-request.png'),fullPage:true});
  await mobile.p.locator('#menu').click();
  if(!await mobile.p.locator('body').evaluate(n=>n.classList.contains('nav-open')))throw Error('New request mobile sidebar not opening');
  await mobile.p.screenshot({path:path.join(out,'mobile-request-sidebar.png')});
  await mobile.p.locator('#closeMenu').click();
  if(await mobile.p.locator('body').evaluate(n=>n.classList.contains('nav-open')))throw Error('New request sidebar not closing');

  const overflow=await mobile.p.evaluate(()=>({doc:document.documentElement.scrollWidth,window:window.innerWidth}));
  if(overflow.doc>overflow.window+4)throw Error('Mobile horizontal overflow '+JSON.stringify(overflow));
  await mobile.c.close();
  if(errors.length)throw Error('Browser script errors: '+errors.join('; ').slice(0,2500));
  console.log(JSON.stringify({result:'VISUAL_SMOKE_PASS',screenshots:fs.readdirSync(out),checked:['desktop-sidebar','8 KPI','4 chart panels','two-page daily monthly buyer reports','new request submitted safely','request mail section','mobile request form/drawer','mobile viewport overflow','browser console']}));
 }finally{if(browser)await browser.close();child.kill('SIGTERM')}
}
run().catch(e=>{console.error('VISUAL_SMOKE_FAIL',e.stack||e);process.exitCode=1});
