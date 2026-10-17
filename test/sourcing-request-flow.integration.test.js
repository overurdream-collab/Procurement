'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),net=require('node:net'),{setTimeout:delay}=require('node:timers/promises');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const workspace=fs.readFileSync(path.join(root,'public/workspace.html'),'utf8');
const form=fs.readFileSync(path.join(root,'public/request.html'),'utf8');
const outreach=fs.readFileSync(path.join(root,'public/market-outreach.js'),'utf8');
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n))})})}
test('all sourcing buttons lead to one consistent UI and explicitly selected RFQ, not old RFQ-001',()=>{
 assert.match(html,/new URLSearchParams\(location\.search\)\.get\('requestId'\)/);
 assert.match(html,/async function analyzeSelectedRequest/);
 assert.match(html,/function marketOnNavigate/);
 assert.match(html,/unifiedSearchPanel\(\)/);
 assert.match(html,/sourceAnalysisBtn|بحث عن موردين/);
 assert.doesNotMatch(html,/selectedMarketRequestId=\(all\.find\(x=>x\.id==='RFQ-001'/);
 assert.match(form,/\\?requestId=/);
 assert.match(form,/scan=1#market/);
 assert.match(workspace,/workspace-view\.css/);
 assert.match(workspace,/id="findSuppliers"/);
 assert.match(workspace,/id="requestMailCard"/);
 assert.match(workspace,/id="workspaceMain"/);
 assert.match(workspace,/مساحة طلب/);
 assert.match(outreach,/targetRequestId/);
 assert.match(outreach,/alreadyExists/);
 for(const x of [html,form,workspace]){
  for(const [,part] of x.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(part);
 }
});
test('protected HTTP: manual sourcing attaches just one chosen supplier to the existing purchase request',async()=>{
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'sourcing-tester',HOSTED_ACCESS_PASSWORD:'long-synthetic-sourcing-test-2026',
  MARKET_ENABLE_LIVE_SEARCH:'false',DATABASE_URL:'' ,PROCUREMENT_PRODUCTION:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:root,env,stdio:'ignore'});
 const headers={Authorization:'Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64'),
  'Content-Type':'application/json'};
 const post=(p,b)=>fetch(base+p,{method:'POST',headers,body:JSON.stringify(b)});
 try{
  let ready=false;
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Test server exited');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ready,true);
  let r=await fetch(base+'/api/state',{headers});assert.equal(r.status,200);
  const initial=await r.json();
  r=await post('/api/requests',{title:'100mm PIR panel sourcing test',product:'100mm PIR insulated panel',
   quantity:'100 sqm',specifications:'PIR 100mm, density 40kg, steel 0.5mm',
   incoterm:'FOB',currency:'USD',clientRequestKey:'synthetic-sourcing-integration'});
  assert.equal(r.status,201);const request=await r.json();
  const noProvider=await post('/api/market-intelligence/search',{query:request.product});
  assert.equal(noProvider.status,200);const discovery=await noProvider.json();
  assert.equal(discovery.searchConfigured,false);
  assert.equal(discovery.results.length,0);
  assert.equal(discovery.manualSearchLinks.length,4);
  r=await post('/api/market-intelligence/manual-leads',{query:request.product,urls:[
   'https://www.alibaba.com/product-detail/manufacturer-one',
   'https://www.made-in-china.com/offer/manufacturer-two'
  ]});
  assert.equal(r.status,200);const manual=await r.json();
  assert.equal(manual.count,2);assert.ok(manual.searchId);
  const chosen={index:manual.results[1].index,companyName:'Verified Example Manufacturing',
   email:'sales@vendor.example',websiteUrl:'https://vendor.example',
   contactEvidenceUrl:'https://vendor.example/contact'};
  const convert={searchId:manual.searchId,targetRequestId:request.id,selected:[chosen],
   details:{product:request.product,quantity:request.quantity,
    specifications:request.specifications,incoterm:'FOB'}};
  r=await post('/api/market-intelligence/convert',convert);
  assert.equal(r.status,200);const result=await r.json();
  assert.equal(result.attachedToExistingRequest,true);
  assert.equal(result.request.id,request.id);
  assert.equal(result.suppliers.length,1);
  assert.equal(result.sentCount,0);
  assert.equal(result.drafts.length,1);
  assert.equal(result.drafts[0].requiresReview,true);
  r=await fetch(base+'/api/state',{headers});const after=await r.json();
  assert.equal(after.requests.length,initial.requests.length+1,'must not create duplicate RFQ');
  assert.equal(after.suppliers.length,initial.suppliers.length+1);
  assert.equal(after.requests.find(x=>x.id===request.id).selectedSupplierIds.length,1);
  assert.equal(after.suppliers.find(x=>x.id===result.suppliers[0].id).associatedRequestId,request.id);
  r=await post('/api/market-intelligence/convert',convert);
  assert.equal(r.status,409,'do not duplicate same supplier on retry');
  const again=await r.json();assert.equal(again.error,'supplier_already_selected');
  r=await post('/api/market-intelligence/convert',{...convert,targetRequestId:'REQ-DOES-NOT-EXIST'});
  assert.equal(r.status,404);
  r=await fetch(base+'/workspace.html?id='+encodeURIComponent(request.id),{headers});
  assert.equal(r.status,200);
  const page=await r.text();
  assert.match(page,/workspace-view\.css/);
  assert.match(page,/findSuppliers/);
  assert.match(page,/مراسلات الموردين ومرفقاتهم/);
  r=await fetch(base+'/workspace-view.css',{headers});
  assert.equal(r.status,200);
 }finally{child.kill('SIGTERM')}
});
