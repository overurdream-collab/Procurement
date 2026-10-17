'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),net=require('node:net');
const {setTimeout:delay}=require('node:timers/promises');
const {priceAnalysis,dailyReport}=require('../procurement-reports');
const {matchRequestForEmail}=require('../gmail-request-link');
const demo=require('../staging-demo-data.json');
const html=fs.readFileSync(path.join(__dirname,'../public/request.html'),'utf8');
const src=fs.readFileSync(path.join(__dirname,'../public/executive-report.js'),'utf8');
const makeHtml=new Function(src+';return executiveReportMarkup;')();

test('new request has genuine RTL design, accessible fields, no fake prices and one safe submit flow',()=>{
 assert.match(html,/<html lang="ar" dir="rtl">/);
 for(const key of ['title','product','quantity','specifications','incoterm','targetMarkets','neededBy'])
  assert.match(html,new RegExp('name="'+key+'"'));
 assert.match(html,/id="rfqForm"/);
 assert.match(html,/id="sumTitle"/);
 assert.match(html,/id="sidebar"/);
 assert.match(html,/clientRequestKey/);
 assert.match(html,/scan=1#market/);
 assert.match(html,/requestId=/);
 assert.doesNotMatch(html,/<script[^>]*src="https?:/);
 const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 assert.equal(script.length,1);new Function(script[0]);
});
test('never match supplier emails to an unrelated RFQ and never choose among ambiguous IDs',()=>{
 const state={requests:[{id:'RFQ-001',selectedSupplierIds:['S1']},{id:'REQ-A1B2C3',selectedSupplierIds:['S2']}],
  suppliers:[{id:'S1',associatedRequestId:'RFQ-001'},{id:'S2',associatedRequestId:'REQ-A1B2C3'}]};
 assert.equal(matchRequestForEmail(state,{subject:'Quote for REQ-A1B2C3',supplierId:'S1'}).requestId,'REQ-A1B2C3');
 assert.equal(matchRequestForEmail(state,{subject:'Re: RFQ-001',supplierId:'S2'}).requestId,'RFQ-001');
 assert.equal(matchRequestForEmail(state,{subject:'Re: RFQ-001 and REQ-A1B2C3',supplierId:'S1'}).requestId,null);
 assert.equal(matchRequestForEmail(state,{subject:'General price catalog',supplierId:'S2'}).requestId,'REQ-A1B2C3');
 assert.equal(matchRequestForEmail(state,{subject:'General price catalog',supplierId:'UNKNOWN'}).requestId,null);
});
test('strict live analysis excludes EXW and only compares verified same FOB evidence',()=>{
 const st=JSON.parse(JSON.stringify(demo));
 function quote(id,supplierId,unitPrice,basis='FOB Shanghai',evidenceClass='Verified Quote'){
  return {id,supplierId,requestId:'RFQ-001',category:'panel_door_manufacturer',
   evidenceClass,basis,currency:'USD',receivedAt:'2026-10-16T08:00:00Z',
   evidenceRef:'document-'+id,items:[{description:'100mm PU cold room insulated panel',
    specifications:'100mm PU panel, steel 0.5mm',unit:'m²',quantity:100,unitPrice}]};
 }
 st.quotes=[quote('Q1','DEMO-S1',25),quote('Q2','DEMO-S2',29),
  quote('Q3','DEMO-S2',12,'EXW Samail'),quote('Q4','DEMO-S1',11,'FOB Shanghai','Received Quote — Pending Review')];
 const analysis=priceAnalysis(st,{requestId:'RFQ-001'});
 assert.equal(analysis.comparableGroups,1);
 assert.equal(analysis.comparisons[0].lowestPrice,25);
 assert.equal(analysis.comparisons[0].highestPrice,29);
 assert.equal(analysis.comparisons[0].spreadForQuantity,400);
 assert.equal(analysis.comparisons[0].comparableSuppliers,2);
 assert.ok(analysis.excludedQuoteLines>=2);
 const management=dailyReport(st,{requestId:'RFQ-001',date:'2026-10-16',audience:'management'});
 const buyer=dailyReport(st,{requestId:'RFQ-001',date:'2026-10-16',audience:'buyer'});
 const first=makeHtml(management),second=makeHtml(buyer);
 assert.match(first,/تقرير المشتريات اليومي/);
 assert.match(first,/SUPPLIER TRACKER/);
 assert.match(first,/eod-sheet-first/);assert.match(first,/eod-sheet-second/);
 assert.match(first,/25/);assert.match(first,/29/);
 assert.doesNotMatch(first,/EXW Samail/);
 assert.match(second,/مورد 01/);
 assert.doesNotMatch(second,/Demo Supplier A/);
 assert.doesNotMatch(second,/Demo Supplier B/);
 assert.doesNotMatch(second,/Q1|Q2|Q3|Q4/);
});
test('no quotation evidence means empty comparison visualization, never invented prices',()=>{
 const report=dailyReport(demo,{requestId:'RFQ-001',date:'2026-10-16',audience:'management'});
 const html=makeHtml(report);
 assert.match(html,/لا توجد مقارنة سعرية موثقة بعد/);
 assert.match(html,/بيانات تدريب تجريبية/);
 assert.doesNotMatch(html,/27,451|29,240/);
});
const port=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n))})});
test('protected HTTP create real draft, dedupe retries, serve report design, and reject invalid request',async()=>{
 const p=await port(),base='http://127.0.0.1:'+p,cred='tester:new-request-phase2-strong-password';
 const env={...process.env,PORT:String(p),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'tester',HOSTED_ACCESS_PASSWORD:cred.split(':')[1],MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
 const headers={Authorization:'Basic '+Buffer.from(cred).toString('base64'),'Content-Type':'application/json'};
 const send=(endpoint,body)=>fetch(base+endpoint,{method:'POST',headers,body:JSON.stringify(body)});
 try{
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('host exited');try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}await delay(90)}
  assert.equal(ready,true);
  for(const url of ['/request.html','/executive-report.js','/executive-report.css']){
   assert.equal((await fetch(base+url)).status,401);
   assert.equal((await fetch(base+url,{headers})).status,200);
  }
  let r=await send('/api/requests',{title:'Missing specification',product:'PIR panel',quantity:'100m²',specifications:'x'});
  assert.equal(r.status,422);
  const body={title:'PIR panels for cold room',product:'PIR 100mm panel',quantity:'100 m²',
   specifications:'PIR 100mm; steel skin 0.5mm; core density 40kg/m3',
   currency:'USD',incoterm:'FOB',clientRequestKey:'phase2-one-time-creation'};
  r=await send('/api/requests',{...body,incoterm:'EXW',clientRequestKey:'reject-exw'});
  assert.equal(r.status,422);
  r=await send('/api/requests',body);assert.equal(r.status,201);const request=await r.json();
  assert.match(request.id,/^REQ-[A-F0-9]{12}$/);
  assert.equal(request.incoterm,'FOB');
  r=await send('/api/requests',body);assert.equal(r.status,200);
  assert.equal((await r.json()).id,request.id);
  r=await fetch(base+'/api/state',{headers});const state=await r.json();
  assert.equal(state.requests.filter(x=>x.id===request.id).length,1);
  r=await fetch(base+'/api/daily-report?audience=buyer&requestId='+request.id,{headers});
  assert.equal(r.status,200);const report=await r.json();
  assert.equal(report.kpis.requests,1);assert.equal(report.supplierProgress.length,0);
  r=await fetch(base+'/api/gmail/status',{headers});assert.equal(r.status,403);
 }finally{child.kill('SIGTERM')}
});
