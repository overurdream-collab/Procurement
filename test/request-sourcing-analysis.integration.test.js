'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),net=require('node:net'),{setTimeout:delay}=require('node:timers/promises');
const ui=require('../public/workspace-view.js');
const source=fs.readFileSync(path.join(__dirname,'../public/workspace.html'),'utf8');
const market=fs.readFileSync(path.join(__dirname,'../public/market-outreach.js'),'utf8');
const analysis=fs.readFileSync(path.join(__dirname,'../public/ops-dashboard.js'),'utf8');
const dashboard=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const port=()=>new Promise((ok,fail)=>{const s=net.createServer();s.once('error',fail);s.listen(0,'127.0.0.1',()=>{const v=s.address().port;s.close(()=>ok(v))})});
test('workspace is a real per-request cockpit and never silently defaults to RFQ-001',()=>{
 assert.match(source,/<html lang="ar" dir="rtl"/);
 for(const name of ['title','requestStats','requestSuppliers','requestAnalysis','requestMailCard','requestMailList','tabs','send','add'])assert.match(source,new RegExp('id="'+name+'"'));
 assert.match(source,/workspace-view\.js/);
 assert.match(source,/workspace-view\.css/);
 assert.equal(ui.requestId('?id=REQ-ABC'),'REQ-ABC');
 assert.equal(ui.requestId(''),'');
 assert.equal(ui.route('REQ-ABC','market'),'/?requestId=REQ-ABC#market');
 const data={requests:[{id:'REQ-A',title:'Panel',selectedSupplierIds:['S1']}],suppliers:[
  {id:'S1',name:'Supplier 1',associatedRequestId:'REQ-A'},
  {id:'S2',name:'Another',associatedRequestId:'REQ-B'}],quotes:[
  {id:'Q1',requestId:'REQ-A'},{id:'Q2',requestId:'REQ-B'}]};
 const view=ui.deriveOverview(data,'REQ-A',{quotes:[{quoteId:'Q1',verified:true}],
  comparisons:[{requestId:'REQ-A',lowestPrice:20},{requestId:'REQ-B',lowestPrice:1}]});
 assert.equal(view.suppliers.length,1);assert.equal(view.quotes.length,1);
 assert.equal(view.verified,1);assert.equal(view.comparable.length,1);
 assert.doesNotMatch(ui.supplierHtml(view),/Another/);
 assert.match(ui.overviewHtml(view),/Panel/);
 assert.match(ui.analysisHtml(view),/20/);
});
test('market selection and quote analysis are request-scoped and preserve human review',()=>{
 assert.match(dashboard,/new URLSearchParams\(location\.search\)\.get\('requestId'\)/);
 assert.match(market,/\/market-suppliers/);
 assert.match(market,/ml-target-request/);
 assert.match(market,/marketTargetChanged/);
 assert.match(market,/workspace\.html\?id=/);
 assert.match(analysis,/syncQuoteSupplierOptions/);
 assert.match(analysis,/quote\.evidenceRef|qeEvidence/);
 assert.match(analysis,/مقارنة|تحليل/);
});
test('protected HTTP: a chosen supplier links to an existing request once without cross-linking',async()=>{
 const p=await port(),base='http://127.0.0.1:'+p;
 const env={...process.env,PORT:String(p),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'request-pipeline',HOSTED_ACCESS_PASSWORD:'long-private-synthetic-test-password-2026',
  MARKET_ENABLE_LIVE_SEARCH:'false'};
 const server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
 const headers={'Authorization':'Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64'),'Content-Type':'application/json'};
 const post=(endpoint,body)=>fetch(base+endpoint,{method:'POST',headers,body:JSON.stringify(body)});
 try{
  let online=false;
  for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('server exited');
   try{if((await fetch(base+'/health/live')).status===200){online=true;break}}catch{}await delay(80)}
  assert.equal(online,true);
  for(const url of ['/workspace.html?id=RFQ-001','/workspace-view.js','/workspace-view.css']){
   assert.equal((await fetch(base+url)).status,401);
   assert.equal((await fetch(base+url,{headers})).status,200);
  }
  const requestBody={title:'Distinct cold room 150mm',product:'PIR 150mm panel',
   specifications:'PIR 150mm core, density 40 kg/m3 and steel 0.5mm',quantity:'100 m²',currency:'USD',incoterm:'FOB'};
  let r=await post('/api/requests',requestBody);assert.equal(r.status,201);const req=await r.json();
  r=await post('/api/market-intelligence/manual-leads',{query:'PIR 150mm panel',urls:[
   'https://www.alibaba.com/product-detail/pir-150mm-first',
   'https://www.made-in-china.com/product/pir-150mm-second'
  ]});
  assert.equal(r.status,200);const found=await r.json();
  assert.equal(found.count,2);
  const selected={searchId:found.searchId,selected:[{index:0,companyName:'Factory Example One',
   email:'sales@example-factory.test',websiteUrl:'https://example-factory.test/',
   contactEvidenceUrl:'https://example-factory.test/contact'}]};
  r=await post('/api/requests/'+req.id+'/market-suppliers',selected);
  assert.equal(r.status,200);const linked=await r.json();
  assert.equal(linked.requestId,req.id);
  assert.equal(linked.added.length,1);assert.equal(linked.sentCount,0);
  assert.equal(linked.request.id,req.id);
  assert.equal(linked.request.selectedSupplierIds.length,1);
  assert.equal(linked.drafts.length,1);
  r=await post('/api/requests/'+req.id+'/market-suppliers',selected);
  assert.equal(r.status,200);const again=await r.json();
  assert.equal(again.added.length,0);assert.equal(again.alreadyExists.length,1);
  r=await fetch(base+'/api/requests/'+req.id+'/workspace',{headers});
  assert.equal(r.status,200);assert.equal((await r.json()).request.id,req.id);
  r=await fetch(base+'/api/price-comparison?requestId='+encodeURIComponent(req.id),{headers});
  assert.equal(r.status,200);const report=await r.json();
  assert.equal(report.comparableGroups,0);
  r=await fetch(base+'/api/state',{headers});const state=await r.json();
  assert.equal(state.requests.filter(x=>x.id===req.id).length,1);
  assert.equal(state.suppliers.filter(x=>x.associatedRequestId===req.id).length,1);
  assert.equal((state.requests.find(x=>x.id==='RFQ-001').selectedSupplierIds||[]).includes(linked.added[0].id),false);
 }finally{server.kill('SIGTERM')}
});
