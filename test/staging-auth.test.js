'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const {guardHostedRequest,requireHostedAccessConfig}=require('../staging-access');

test('cannot start hosted service without strong credentials and safe demo mode',()=>{
 assert.throws(()=>requireHostedAccessConfig({STAGING_HOSTED:'true',STAGING_DEMO:'true'}),/requires/);
 assert.throws(()=>requireHostedAccessConfig({STAGING_HOSTED:'true',STAGING_DEMO:'true',HOSTED_ACCESS_USER:'admin',HOSTED_ACCESS_PASSWORD:'short'}),/requires/);
 assert.throws(()=>requireHostedAccessConfig({STAGING_HOSTED:'true',STAGING_DEMO:'false',HOSTED_ACCESS_USER:'admin',HOSTED_ACCESS_PASSWORD:'1234567890abcdef'}),/synthetic/);
 assert.doesNotThrow(()=>requireHostedAccessConfig({STAGING_HOSTED:'true',STAGING_DEMO:'true',HOSTED_ACCESS_USER:'admin',HOSTED_ACCESS_PASSWORD:'1234567890abcdef'}));
});
test('hosted demo requires login before serving any Procurement data',async()=>{
 const port=28600+Math.floor(Math.random()*600);
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',HOSTED_ACCESS_USER:'demo-staff',
    HOSTED_ACCESS_PASSWORD:'test-only-strong-password-2026',MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 try{
   let ready=false;
   for(let i=0;i<60;i++){
     if(child.exitCode!==null)throw Error('Server quit early');
     try{let r=await fetch(base+'/health/live');if(r.ok){ready=true;break}}catch{}
     await delay(100);
   }
   assert.equal(ready,true,'server should start');
   let r=await fetch(base+'/');
   assert.equal(r.status,401);
   assert.match(r.headers.get('www-authenticate'),/ALHARIR/);
   r=await fetch(base+'/api/state');assert.equal(r.status,401);
   const good={Authorization:'Basic '+Buffer.from('demo-staff:test-only-strong-password-2026').toString('base64')};
   const wrong={Authorization:'Basic '+Buffer.from('demo-staff:incorrect-password').toString('base64')};
   // Both earlier anonymous requests count toward 10 failures. Exhaust the limit.
   for(let i=0;i<8;i++){
     r=await fetch(base+'/api/state',{headers:wrong});assert.equal(r.status,401);
   }
   r=await fetch(base+'/api/state',{headers:wrong});assert.equal(r.status,429);
   assert.ok(Number(r.headers.get('retry-after'))>=1);
   // Correct sign-in from another browser using the same proxy IP must succeed.
   r=await fetch(base+'/api/state',{headers:good});assert.equal(r.status,200);
   // Successful authentication clears previous failures, instead of locking users out.
   r=await fetch(base+'/api/state',{headers:wrong});assert.equal(r.status,401);
   r=await fetch(base+'/api/state',{headers:good});assert.equal(r.status,200);
   const state=await r.json();
   assert.equal(state.project.name,'ALHARIR Procurement DEMO');
   assert.equal(state.suppliers.every(x=>x.source==='demo'),true);
   assert.equal(state.settings.dryRun,true);
   r=await fetch(base+'/api/gmail/connect',{headers:good});assert.equal(r.status,403);
   r=await fetch(base+'/api/agent/run',{method:'POST',headers:{...good,'Content-Type':'application/json'},body:'{}'});
   assert.equal(r.status,403);
   r=await fetch(base+'/',{headers:good});
   assert.equal(r.status,200);
   assert.match(await r.text(),/Procurement Command Center/);
 }finally{child.kill('SIGTERM')}
});
