'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 {spawn}=require('node:child_process'),net=require('node:net'),
 {setTimeout:delay}=require('node:timers/promises'),fs=require('node:fs');
const {monthlyReport,validateMonth,sanaaDate}=require('../monthly-report');
const demo=require('../staging-demo-data.json');
const {dailyReport}=require('../procurement-reports');
test('monthly report is calendar scoped, with clear cumulative-vs-period metrics',()=>{
 const st={
  ...demo,
  requests:[{id:'REQ-OCT',title:'PIR',createdAt:'2026-10-01T10:00:00Z'}],
  suppliers:[{id:'SUP-A',name:'Supplier A',associatedRequestId:'REQ-OCT'}],
  quotes:[],
  activity:[
   {type:'review',requestId:'REQ-OCT',time:'2026-09-30T20:00:00Z',text:'October in Sana’a'},
   {type:'review',requestId:'REQ-OCT',time:'2026-10-14T10:00:00Z',text:'October follow up'},
   {type:'review',requestId:'REQ-OCT',time:'2026-11-01T01:00:00Z',text:'November only'}],
  gmailReplies:[{receivedAt:'2026-10-07T10:00:00Z',requestId:'REQ-OCT'}],
  approvals:[{status:'pending',title:'Internal approval'}]
 };
 const r=monthlyReport(st,{month:'2026-10',requestId:'REQ-OCT',audience:'management'});
 assert.equal(r.period,'monthly');
 assert.equal(r.date,'2026-10');
 assert.equal(r.periodStart,'2026-10-01');assert.equal(r.periodEnd,'2026-10-31');
 assert.equal(r.kpis.actionsToday,2);assert.equal(r.kpis.repliesToday,1);
 assert.equal(r.kpis.requests,1);assert.equal(r.kpis.newRequestsInPeriod,1);
 assert.equal(r.kpis.pendingApprovals,1);assert.equal(r.activities.length,2);
 assert.ok(r.privacyNotice.includes('تراكمية'));
});
test('monthly report buyer excludes internal notes and supplier emails',()=>{
 const st={...demo,activity:[{type:'private',time:'2026-10-10T10:00:00Z',text:'Internal margin 50%'}],
  approvals:[{id:'SECRET-APPROVAL',status:'pending',title:'Secrets'}]};
 const r=monthlyReport(st,{month:'2026-10',audience:'buyer'});
 assert.equal(r.activities.length,0);
 assert.equal(r.kpis.pendingApprovals,null);
 assert.doesNotMatch(JSON.stringify(r),/Internal margin|SECRET-APPROVAL/);
 assert.doesNotMatch(JSON.stringify(r),/@gmail.com/);
});
test('month and time validation',()=>{
 assert.equal(validateMonth('2026-10'),'2026-10');
 assert.equal(validateMonth('2026-13'),null);
 assert.equal(validateMonth('2026-1'),null);
 assert.equal(sanaaDate('2026-09-30T22:01:00Z'),'2026-10-01');
});
const getFreePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();
 s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
test('hosted integration serves real home, month report, protected assets and buyer mode',async()=>{
 const port=await getFreePort(),base='http://127.0.0.1:'+port;
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'report-pilot',HOSTED_ACCESS_PASSWORD:'test-only-long-password-2026',
  MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'});
 const headers={Authorization:'Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64')};
 try{
  let ready=false;for(let i=0;i<80;i++){
   if(child.exitCode!==null)throw Error('Server exited');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }assert.equal(ready,true);
  for(const url of ['/','/executive-home.js','/executive-home.css','/agent-native-pilot.js','/api/monthly-report']){
   assert.equal((await fetch(base+url)).status,401,url);
   assert.equal((await fetch(base+url,{headers})).status,200,url);
  }
  let r=await fetch(base+'/',{headers});const h=await r.text();
  assert.match(h,/data-view="dashboard"/);assert.match(h,/data-view="reports"/);
  assert.match(h,/dashboard:executiveHomeView,reports:dailyView/);
  assert.match(h,/executive-home\.css/);
  r=await fetch(base+'/api/monthly-report?audience=management&month=2026-10',{headers});
  assert.equal(r.status,200);const manager=await r.json();
  assert.equal(manager.period,'monthly');assert.equal(manager.mode,'synthetic-demo');
  const state=await (await fetch(base+'/api/state',{headers})).json();
  assert.equal(manager.kpis.requests,state.requests.length);
  r=await fetch(base+'/api/monthly-report?audience=buyer&month=2026-10',{headers});
  assert.equal(r.status,200);const buyer=await r.json();
  assert.equal(buyer.kpis.pendingApprovals,null);assert.deepEqual(buyer.activities,[]);
  r=await fetch(base+'/api/monthly-report?month=2026-13',{headers});assert.equal(r.status,422);
  r=await fetch(base+'/api/monthly-report?audience=external',{headers});assert.equal(r.status,422);
 }finally{child.kill('SIGTERM')}
});