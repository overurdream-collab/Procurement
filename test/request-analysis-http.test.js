'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
function availablePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});});}
test('protected request analysis HTTP returns normalized fields without modifying business state',async()=>{
 const port=await availablePort(),user='analysis-user',password='demo-password-long-enough-2026';
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:user,HOSTED_ACCESS_PASSWORD:password,MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const headers={Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')};
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Server quit');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break;}}catch{}
   await delay(80);
  }
  assert.equal(ready,true,'expected healthy synthetic test server');
  const beforeResponse=await fetch(base+'/api/state',{headers});
  assert.equal(beforeResponse.status,200);
  const before=await beforeResponse.json();
  const request=before.requests[0];
  assert.ok(request?.id);
  const endpoint=base+'/api/requests/'+encodeURIComponent(request.id)+'/analysis';
  assert.equal((await fetch(endpoint)).status,401);
  const resp=await fetch(endpoint,{headers});assert.equal(resp.status,200);
  const a=await resp.json();
  assert.equal(a.requestId,request.id);
  assert.equal(a.analysisMode,'deterministic-rules-no-llm');
  assert.equal(a.liveSearch.configured,false);
  assert.equal(a.requiresHumanVerification,true);
  assert.equal(typeof a.searchQuery,'string');
  assert.ok(Array.isArray(a.missingTechnical));
  assert.equal((await fetch(base+'/api/requests/NO-SUCH-ID/analysis',{headers})).status,404);
  const after=await (await fetch(base+'/api/state',{headers})).json();
  assert.deepEqual(after.requests,before.requests,'analysis must never create or update RFQs');
  assert.deepEqual(after.suppliers,before.suppliers,'analysis must never create suppliers');
  assert.deepEqual(after.quotes,before.quotes,'analysis must never invent quotation records');
  const workspace=await fetch(base+'/workspace.html?id='+encodeURIComponent(request.id),{headers});
  assert.equal(workspace.status,200);
  assert.match(await workspace.text(),/requestIntelligence/);
 }finally{
  child.kill('SIGTERM');
 }
});
