'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const layout=require('../public/agent-native-layout.js');
const pilot=require('../public/agent-native-pilot.js');
const html=fs.readFileSync(path.join(__dirname,'../public/agent-native-pilot.html'),'utf8');
function fixtures(){
 const today=new Date().toISOString();
 return {state:{
  requests:[{id:'R1',title:'First RFQ',selectedSupplierIds:['S1']},{id:'R2',title:'Second RFQ',selectedSupplierIds:['S2']}],
  suppliers:[{id:'S1',associatedRequestId:'R1'},{id:'S2',associatedRequestId:'R2'}],
  quotes:[{requestId:'R1',receivedAt:today},{requestId:'R2',receivedAt:today}],
  activity:[{type:'demo',requestId:'R1',time:today}],approvals:[{status:'pending'}]},
  report:{mode:'synthetic-demo',kpis:{requests:2,suppliers:2,quoteRecords:2}},
  comparison:{quotes:[{requestId:'R1',verified:true},{requestId:'R2',verified:false}],
   comparisons:[{requestId:'R1',lowestPrice:1,quantity:10}]}};
}
test('Agent-Native MIT adapted layout balances cards with no dependency',()=>{
 const rows=layout.buildDashboardRows([{id:'a',width:1},{id:'b',width:1},{id:'c',width:2}],2);
 assert.deepEqual(rows.map(x=>x.panels.map(y=>y.id)),[['a','b'],['c']]);
 assert.equal(layout.clampDashboardColumns(10),6);
 assert.equal(layout.clampPanelWidth(20,2),2);
});
test('same server-side values drive read-only pilot KPIs and RFQ filters',()=>{
 const f=fixtures(),a=pilot.model(f.state,f.report,f.comparison,'',30,new Date());
 assert.deepEqual([a.counts.requests,a.counts.suppliers,a.counts.quotes], [2,2,2]);
 assert.equal(a.counts.requests,f.report.kpis.requests);
 assert.equal(a.counts.groups,1);assert.equal(a.counts.verified,1);
 assert.equal(a.counts.actions,1);assert.equal(a.counts.recentQuotes,2);
 const x=pilot.model(f.state,f.report,f.comparison,'R1',7,new Date());
 assert.deepEqual([x.counts.requests,x.counts.suppliers,x.counts.quotes,x.counts.verified,x.counts.groups],[1,1,1,1,1]);
 assert.equal(x.requests[0].id,'R1');
 assert.equal(x.demo,true);
});
test('trend refuses to invent dated events',()=>{
 const f=fixtures();f.state.activity=[];f.state.quotes=[{requestId:'R1'}];
 const m=pilot.model(f.state,f.report,f.comparison,'',30,new Date());
 assert.equal(m.counts.recentQuotes,0);
 assert.equal(m.monthly.every(x=>x.quotes===0&&x.actions===0),true);
});
test('Arabic pilot references only three read-only private APIs',()=>{
 assert.match(html,/<html lang="ar" dir="rtl"/);
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,/id="pilotStats"/);
 assert.match(html,/id="pilotPanels"/);
 assert.match(html,/id="pilotRequest"/);
 assert.match(html,/\/#market/);
 assert.match(html,/agent-native-layout\.js/);
 assert.deepEqual(pilot.ENDPOINTS,['/api/state','/api/daily-report?audience=management','/api/price-comparison']);
 assert.doesNotMatch(html,/\/api\/agent\/run|MAIL_TOKEN|sk-[a-z0-9]/i);
});
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});}
test('live local hosted server guards pilot and reports, without writing data',async()=>{
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'test-staff',HOSTED_ACCESS_PASSWORD:'secure-test-password-2026-only',
  MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{
  cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
 const headers={Authorization:'Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64')};
 try{
  let ready=false;
  for(let i=0;i<85;i++){if(child.exitCode!==null)throw Error('Test server quit');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ready,true);
  for(const target of ['/agent-native-pilot.html','/agent-native-layout.js','/agent-native-pilot.js']){
   assert.equal((await fetch(base+target)).status,401);
   assert.equal((await fetch(base+target,{headers})).status,200);
  }
  const fetchWithAuth=(path,opts)=>fetch(base+path,{...opts,headers});
  const {state,report,comparison}=await pilot.loadData(fetchWithAuth);
  const m=pilot.model(state,report,comparison);
  assert.equal(m.demo,true);
  assert.equal(m.counts.requests,report.kpis.requests);
  assert.equal(m.counts.quotes,report.kpis.quoteRecords);
  assert.equal(m.counts.suppliers,report.kpis.suppliers);
  assert.equal(m.counts.groups,comparison.comparableGroups);
 }finally{child.kill('SIGTERM')}
});