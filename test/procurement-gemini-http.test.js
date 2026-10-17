'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),path=require('node:path');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
async function availablePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});}
async function withDemo(enabled,fn){
 const port=await availablePort(),base='http://127.0.0.1:'+port;
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'free-agent-tester',HOSTED_ACCESS_PASSWORD:'mock-only-long-demo-password',
  AGENT_GEMINI_FREE_ENABLED:enabled?'true':'false',GEMINI_API_KEY:'fake-non-billable-test-key',
  MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{env,cwd:path.join(__dirname,'..'),stdio:'ignore'});
 const headers={Authorization:'Basic '+Buffer.from('free-agent-tester:mock-only-long-demo-password').toString('base64'),
  'Content-Type':'application/json','X-ALHARIR-Model-Action':'demo'};
 try{
  let up=false;for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Server exited');
   try{if((await fetch(base+'/health/live')).status===200){up=true;break;}}catch{}
   await delay(65);
  }
  assert.equal(up,true);await fn(base,headers);
 }finally{child.kill('SIGTERM');}
}
test('free bridge absent unless explicitly enabled',()=>withDemo(false,async(base,headers)=>{
 const state=await (await fetch(base+'/api/state',{headers})).json();
 const url=base+'/api/requests/'+encodeURIComponent(state.requests[0].id)+'/agent/free-ai';
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({task:'overview'})});
 assert.equal(r.status,404);assert.equal((await r.json()).error,'free_model_not_configured_or_demo_only');
}));
test('free bridge refuses anonymous calls, missing explicit demo header and non-preset payloads',()=>withDemo(true,async(base,headers)=>{
 const original=await (await fetch(base+'/api/state',{headers})).json();
 const url=base+'/api/requests/'+encodeURIComponent(original.requests[0].id)+'/agent/free-ai';
 const noAuth={...headers};delete noAuth.Authorization;
 assert.equal((await fetch(url,{method:'POST',headers:noAuth,body:'{"task":"overview"}'})).status,401);
 const noConsent={...headers};delete noConsent['X-ALHARIR-Model-Action'];
 assert.equal((await fetch(url,{method:'POST',headers:noConsent,body:'{"task":"overview"}'})).status,403);
 const invalid=await fetch(url,{method:'POST',headers,body:'{"task":"overview","message":"confidential"}'});
 assert.equal(invalid.status,422);
 const noRecord=await fetch(base+'/api/requests/NOT-MY-REQUEST/agent/free-ai',
  {method:'POST',headers,body:'{"task":"overview"}'});
 assert.equal(noRecord.status,404);
 const after=await (await fetch(base+'/api/state',{headers})).json();
 assert.deepEqual(after.requests,original.requests);
 assert.deepEqual(after.suppliers,original.suppliers);
 assert.deepEqual(after.quotes,original.quotes);
 const ui=await fetch(base+'/workspace.html?id='+original.requests[0].id,{headers});
 assert.equal(ui.status,200);assert.match(await ui.text(),/freeGeminiSection/);
}));
