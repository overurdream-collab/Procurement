'use strict';
/* Runs against the actual Procurement HTTP server, not static mocks.
 * Uses Playwright Core with Chrome installed on the free GitHub runner.
 * Failure if RTL/mobile layout clips, sidebar is inaccessible, KPIs vanish, or reports break. */
const {spawn}=require('node:child_process');
const net=require('node:net'),fs=require('node:fs'),path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const {chromium}=require('playwright-core');
const dir=process.env.UI_SCREENSHOT_DIR||path.join('/tmp','alharir-ui-evidence');
fs.mkdirSync(dir,{recursive:true});
const executable=process.env.CHROME_BIN||
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']
 .find(x=>fs.existsSync(x));
if(!executable)throw Error('Chromium/Chrome executable not found for visual audit');
async function freePort(){
 return new Promise((resolve,reject)=>{
  const server=net.createServer();server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});
 });
}
(async()=>{
 const port=await freePort(),root='http://127.0.0.1:'+port;
 const username='ui-reviewer',password='secure-local-demo-password-2026';
 const child=spawn(process.execPath,['server.js'],{
  cwd:path.resolve(__dirname,'..'),
  env:{...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
    HOSTED_ACCESS_USER:username,HOSTED_ACCESS_PASSWORD:password,MARKET_ENABLE_LIVE_SEARCH:'false'},
  stdio:['ignore','pipe','pipe']
 });
 let error='',browser;
 child.stderr.on('data',x=>error+=x.toString());
 try{
  let healthy=false;
  for(let tries=0;tries<90;tries++){
   if(child.exitCode!==null)throw Error('Procurement exited: '+error.slice(0,1000));
   try{if((await fetch(root+'/health/live')).ok){healthy=true;break;}}catch(e){}
   await delay(100);
  }
  if(!healthy)throw Error('Backend did not start within visual test timeout: '+error);
  browser=await chromium.launch({headless:true,executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const screen of [
   {name:'desktop',width:1440,height:900,isMobile:false},
   {name:'iphone',width:390,height:844,isMobile:true}
  ]){
   const context=await browser.newContext({
    viewport:{width:screen.width,height:screen.height},
    deviceScaleFactor:1,isMobile:screen.isMobile,hasTouch:screen.isMobile,
    httpCredentials:{username,password}
   });
   const page=await context.newPage();
   const scriptErrors=[];page.on('pageerror',e=>scriptErrors.push(e.message));
   // Verify browser actually receives stylesheets, not text/plain (previous root cause).
   for(const sheet of ['/executive-home.css','/ux-overhaul.css']){
    const css=await page.request.get(root+sheet);
    if(css.status()!==200||!/^text\/css/i.test(css.headers()['content-type']||'')){
     throw Error(screen.name+': stylesheet rejected by browser due MIME: '+sheet+' '+css.status()+' '+css.headers()['content-type']);
    }
   }
   await page.goto(root+'/#dashboard',{waitUntil:'networkidle',timeout:30000});
   await page.locator('#pilotStats .stat').first().waitFor({timeout:12000});
   await page.waitForFunction(()=>document.querySelectorAll('#pilotStats .stat').length===8,{timeout:12000});
   const kpis=await page.locator('#pilotStats .stat').count();
   const charts=await page.locator('#pilotPanels .panel').count();
   if(kpis!==8||charts!==4)throw Error(screen.name+': missing KPI/chart components: '+kpis+'/'+charts);
   const source=await page.locator('#pilotStatus').innerText();
   if(!source.includes('Procurement'))throw Error(screen.name+': not API-bound: '+source);
   if(screen.name==='desktop'){
    if(!await page.locator('#mainSidebar').isVisible())throw Error('Desktop sidebar hidden');
   }else{
    const initial=await page.locator('#mainSidebar').boundingBox();
    if(initial&&initial.x<screen.width-4)throw Error('Mobile drawer intersects viewport when closed: '+JSON.stringify(initial));
    await page.locator('#sidebarToggle').click();
    await page.waitForFunction(()=>document.body.classList.contains('nav-open'));
    await page.waitForFunction(()=>{const r=document.querySelector('#mainSidebar')?.getBoundingClientRect();return r&&r.left>=0&&r.left<innerWidth&&r.right>0;});
    const openBox=await page.locator('#mainSidebar').boundingBox();
    if(!openBox||openBox.x>=screen.width)throw Error('Mobile nav drawer did not enter viewport');
    await page.locator('#sidebarBackdrop').click({position:{x:1,y:1}});
    await page.waitForFunction(()=>!document.body.classList.contains('nav-open'));
   }
   const box=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
    home:!!document.querySelector('.executive-head .head-aside'),
    heroBackground:getComputedStyle(document.querySelector('.executive-head')).backgroundImage,
    cardsLayout:getComputedStyle(document.querySelector('#pilotStats')).display,
    heroFont:parseInt(getComputedStyle(document.querySelector('.executive-head h2')).fontSize,10)
   }));
   if(box.width>screen.width+5||!box.home||box.cardsLayout!=='grid'||!box.heroBackground.includes('gradient')||box.heroFont<24)
    throw Error(screen.name+': unstyled, clipped home or missing premium hero: '+JSON.stringify(box));
   await page.screenshot({path:path.join(dir,screen.name+'-dashboard.png'),fullPage:true,animations:'disabled'});
   await page.goto(root+'/#reports',{waitUntil:'networkidle'});
   await page.locator('#dailyPrintable').waitFor({timeout:12000});
   if(!await page.locator('#reportPeriod').isVisible())throw Error('Separate Reports page missing');
   await page.locator('#reportPeriod').selectOption('monthly');
   await page.locator('#dailyPrintable').waitFor({timeout:12000});
   if(!((await page.locator('#dailyPrintable').innerText()).includes('الشهري')))throw Error(screen.name+': monthly report not rendered');
   const reportOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   if(reportOverflow>5)throw Error(screen.name+': report horizontal overflow '+reportOverflow);
   await page.screenshot({path:path.join(dir,screen.name+'-reports.png'),fullPage:true,animations:'disabled'});
   if(scriptErrors.length)throw Error(screen.name+': JS page errors: '+scriptErrors.join(' | '));
   console.log('UI_PASS',screen.name,JSON.stringify({kpis,charts,report:'monthly',width:screen.width}));
   await context.close();
  }
 }finally{
  if(browser)await browser.close();
  child.kill('SIGTERM');
 }
})().catch(e=>{console.error('UI_VISUAL_FAIL',e.stack||e);process.exitCode=1;});
