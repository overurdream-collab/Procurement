'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const net=require('node:net');
async function getPort(){return new Promise((resolve,reject)=>{const s=net.createServer();
 s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})}
test('protected daily operations dashboard, quote intake, verification and buyer share data',async()=>{
 const port=await getPort();
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'daily-auditor',HOSTED_ACCESS_PASSWORD:'test-only-strong-pass-123456',
  MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const headers={'Content-Type':'application/json',
   Authorization:'Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64')};
 const post=(url,obj)=>fetch(base+url,{method:'POST',headers,body:JSON.stringify(obj)});
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('server exited before ready');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ready,true);
  assert.equal((await fetch(base+'/api/daily-report')).status,401);
  let r=await fetch(base+'/api/daily-report?audience=management',{headers});
  assert.equal(r.status,200);let daily=await r.json();
  assert.equal(daily.kpis.requests,1);
  assert.equal(daily.kpis.quoteRecords,0);
  assert.equal(daily.kpis.comparableGroups,0);
  assert.equal(daily.mode,'synthetic-demo');
  assert.equal(daily.delivery,'manual-share-only');
  r=await fetch(base+'/api/daily-report?audience=buyer',{headers});
  assert.equal(r.status,200);let buyer=await r.json();
  assert.equal(buyer.kpis.pendingApprovals,null);
  assert.equal(buyer.activities.length,0);
  r=await fetch(base+'/api/price-comparison',{headers});assert.equal(r.status,200);
  assert.equal((await r.json()).comparisons.length,0);
  // Every primary navigation destination must resolve through the protected server.
  for(const dest of ['/request.html','/workspace.html?id=RFQ-001','/market-outreach.js']){
    let p=await fetch(base+dest,{headers});assert.equal(p.status,200,dest);
  }
  const statusResponse=await fetch(base+'/api/system-status',{headers});
  assert.equal(statusResponse.status,200);
  const statusPayload=await statusResponse.json();
  const statuses=new Map(statusPayload.services.map(s=>[s.id,s.status]));
  assert.equal(statuses.get('daily-report'),'available');
  assert.equal(statuses.get('quote-analysis'),'available');
  assert.equal(statuses.get('storage'),'temporary-demo');
  assert.equal(statuses.get('email'),'disabled-in-demo');
  assert.equal(statuses.get('wechat'),'not-integrated');
  assert.equal(statuses.get('quote-ingestion'),'not-integrated');
  const noAuthServices=await fetch(base+'/api/system-status');
  assert.equal(noAuthServices.status,401);
  const state=await (await fetch(base+'/api/state',{headers})).json();
  const req=state.requests[0].id,supp=state.suppliers.map(s=>s.id);
  const quote=(supplierId,price)=>({supplierId,requestId:req,currency:'USD',basis:'FOB Guangzhou',
   evidenceRef:'source-email-quotation-ABC123',
   items:[{description:'100mm PIR panel grade B',comparisonKey:'PIR-100MM-B',unit:'m²',
     quantity:100,unitPrice:price,specifications:'PIR 100mm steel 0.5mm'}]});
  r=await post('/api/quotes/structured',{...quote(supp[0],18),evidenceRef:''});
  assert.equal(r.status,422);
  r=await post('/api/quotes/structured',quote(supp[0],18));assert.equal(r.status,201);
  const q1=await r.json();assert.equal(q1.evidenceClass,'Received Quote — Pending Review');
  r=await post('/api/quotes/structured',quote(supp[1],21));assert.equal(r.status,201);
  const q2=await r.json();
  r=await fetch(base+'/api/price-comparison',{headers});let c=await r.json();
  assert.equal(c.comparableGroups,0,'unverified quotes cannot create savings');
  r=await post('/api/quotes/'+q1.id+'/verify',{confirmVerified:true,reviewNote:'short'});
  assert.equal(r.status,422);
  for(const q of [q1,q2]){
   r=await post('/api/quotes/'+q.id+'/verify',{confirmVerified:true,
    reviewNote:'I reviewed the original PDF and specification details for demo.'});
   assert.equal(r.status,200);
  }
  r=await fetch(base+'/api/price-comparison',{headers});c=await r.json();
  assert.equal(c.comparableGroups,1);
  assert.equal(c.comparisons[0].lowestPrice,18);
  assert.equal(c.comparisons[0].spreadForQuantity,300);
  r=await fetch(base+'/api/daily-report?audience=management',{headers});daily=await r.json();
  assert.equal(daily.kpis.quoteRecords,2);
  assert.equal(daily.kpis.verifiedQuotes,2);
  assert.equal(daily.kpis.comparableGroups,1);
  r=await fetch(base+'/',{headers});assert.equal(r.status,200);const html=await r.text();
  assert.match(html,/class="side-nav"/);
  assert.match(html,/id="mainSidebar"/);
  assert.match(html,/ops-dashboard\.js/);
  assert.equal((html.match(/data-view="market"/g)||[]).length,1);
  assert.equal((html.match(/data-view="quotes"/g)||[]).length,1);
  assert.equal((html.match(/data-view="dashboard"/g)||[]).length,1);
  assert.doesNotMatch(html,/class="controls"/);
  for(const file of ['/ops-dashboard.js','/market-outreach.js']){
   const fileReq=await fetch(base+file,{headers});assert.equal(fileReq.status,200);
  }
  const publicView=await (await fetch(base+'/ops-dashboard.js',{headers})).text();
  assert.match(publicView,/downloadDailyHtml/);
  assert.match(publicView,/shareDailyReport/);
  assert.match(publicView,/comparisonView/);
 }finally{child.kill('SIGTERM')}
});
