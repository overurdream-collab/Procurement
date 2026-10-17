'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),path=require('node:path');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const port=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});
async function withHost(enabled,fn){
 const n=await port(),base='http://127.0.0.1:'+n;
 const env={...process.env,PORT:String(n),STAGING_HOSTED:'true',STAGING_DEMO:'true',
 HOSTED_ACCESS_USER:'agent-test',HOSTED_ACCESS_PASSWORD:'long-demo-password-for-agents',
 AGENT_TOOL_PREVIEW_ENABLED:enabled?'true':'false',MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env,stdio:'ignore'});
 const headers={Authorization:'Basic '+Buffer.from('agent-test:long-demo-password-for-agents').toString('base64')};
 try{
  let ready=false;for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Host quit before healthy');
   try{if((await fetch(base+'/health/live')).status===200){ready=true;break;}}catch{}
   await delay(70);
  }
  assert.equal(ready,true);await fn(base,headers);
 }finally{child.kill('SIGTERM');}
}
test('tool preview default OFF even to authenticated user',()=>withHost(false,async(base,headers)=>{
 const st=await (await fetch(base+'/api/state',{headers})).json(),id=st.requests[0].id;
 const r=await fetch(base+'/api/requests/'+encodeURIComponent(id)+'/agent/preview',{headers});
 assert.equal(r.status,404);assert.equal((await r.json()).error,'agent_preview_disabled');
}));
test('protected HTTP executes read-only tools, blocks unknown plans and keeps data identical',()=>withHost(true,async(base,headers)=>{
 const before=await (await fetch(base+'/api/state',{headers})).json();
 const id=before.requests[0].id,route='/api/requests/'+encodeURIComponent(id)+'/agent/preview';
 assert.equal((await fetch(base+route)).status,401);
 assert.equal((await fetch(base+route+'?task=send_email',{headers})).status,422);
 assert.equal((await fetch(base+'/api/requests/UNKNOWN/agent/preview',{headers})).status,404);
 const res=await fetch(base+route+'?task=full_review',{headers});
 assert.equal(res.status,200);assert.match(res.headers.get('cache-control')||'',/no-store/);
 const data=await res.json();assert.equal(data.toolsRun,7);
 assert.equal(data.modelConnected,false);assert.equal(data.effects.mailSent,0);
 assert.equal(data.effects.databaseWrites,0);assert.equal(data.effects.externalSearchCalls,0);
 assert.equal(data.outputs.prepare_rfq_drafts.sent,0);
 assert.ok(data.trace.every(x=>x.effect==='read_only'));
 const after=await (await fetch(base+'/api/state',{headers})).json();
 assert.deepEqual(after.requests,before.requests);
 assert.deepEqual(after.suppliers,before.suppliers);
 assert.deepEqual(after.quotes,before.quotes);
 assert.deepEqual(after.activity,before.activity);
 const page=await fetch(base+'/workspace.html?id='+encodeURIComponent(id),{headers});
 assert.equal(page.status,200);assert.match(await page.text(),/runAgentPreview/);
}));
