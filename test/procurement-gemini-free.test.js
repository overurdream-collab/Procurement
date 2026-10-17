'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {MODEL,enabled,modelDeclarations,runFreeGemini,FreeModelError}=require('../procurement-gemini-free');
const demo=require('../staging-demo-data.json');
const env={STAGING_HOSTED:'true',STAGING_DEMO:'true',PROCUREMENT_PRODUCTION:'false',
 AGENT_GEMINI_FREE_ENABLED:'true',GEMINI_API_KEY:'fake-gemini-key-that-is-not-real'};
const requestId=demo.requests[0].id;
const clone=x=>JSON.parse(JSON.stringify(x));
const mockReply=parts=>({ok:true,status:200,text:async()=>JSON.stringify({candidates:[{content:{role:'model',parts}}]})});
test('free-model bridge pins only the approved Gemini model',()=>{
 assert.equal(MODEL,'gemini-3.1-flash-lite');assert.equal(modelDeclarations().length,7);
 assert.ok(modelDeclarations().every(x=>x.parameters?.required?.includes('scope')));
});
test('disabled for live production and until both demo opt-in and nonempty API key exist',()=>{
 assert.equal(enabled(env),true);
 for(const e of [
  {...env,PROCUREMENT_PRODUCTION:'true'},
  {...env,STAGING_HOSTED:'false'},
  {...env,STAGING_DEMO:'false'},
  {...env,AGENT_GEMINI_FREE_ENABLED:'false'},
  {...env,GEMINI_API_KEY:''}
 ])assert.equal(enabled(e),false);
 assert.rejects(()=>runFreeGemini(demo,{requestId,task:'overview'},{env:{...env,PROCUREMENT_PRODUCTION:'true'},applyRateLimit:false}),/free_model_not_configured_or_demo_only/);
});
test('actual structured Gemini function-call -> existing tool -> response loop, synthetic only',async()=>{
 const state=clone(demo),before=JSON.stringify(state),requests=[];
 const fakeFetch=async(url,init)=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
  assert.equal(init.method,'POST');assert.equal(init.headers['x-goog-api-key'],env.GEMINI_API_KEY);
  const body=JSON.parse(init.body);requests.push(body);
  if(requests.length===1)return mockReply([{functionCall:{name:'read_request',id:'fc-001',args:{scope:'current_request'}},thoughtSignature:'opaque-signature'}]);
  return mockReply([{text:'ملخص من بيانات تجريبية، ولا توجد مراسلات حقيقية.'}]);
 };
 const out=await runFreeGemini(state,{requestId,task:'overview'},{env,fetchImpl:fakeFetch,applyRateLimit:false});
 assert.equal(out.provider,'Google Gemini API');assert.equal(out.model,MODEL);
 assert.equal(out.modelRequests,2);assert.equal(out.invokedTools.length,1);
 assert.equal(out.invokedTools[0].tool,'read_request');assert.equal(out.mailSent,0);
 assert.equal(out.databaseWrites,0);assert.equal(out.externalSearchCalls,0);
 assert.equal(out.syntheticDataOnly,true);assert.match(out.answer,/بيانات تجريبية/);
 assert.equal(JSON.stringify(state),before);
 assert.equal(requests[0].toolConfig.functionCallingConfig.mode,'ANY');
 assert.equal(requests[1].contents[1].parts[0].thoughtSignature,'opaque-signature');
 const reply=requests[1].contents[2].parts[0].functionResponse;
 assert.equal(reply.id,'fc-001');assert.equal(reply.name,'read_request');
 assert.equal(reply.response.result.id,requestId);
});
test('malicious model tool name is not allowed and never executed',async()=>{
 const fakeFetch=async()=>mockReply([{functionCall:{name:'send_email',args:{scope:'current_request'}}}]);
 await assert.rejects(()=>runFreeGemini(demo,{requestId},{env,fetchImpl:fakeFetch,applyRateLimit:false}),x=>x.code==='model_requested_disallowed_tool'&&x.status===403);
});
test('model cannot widen request scope by changing tool arguments',async()=>{
 const fakeFetch=async()=>mockReply([{functionCall:{name:'read_request',args:{scope:'another_request',request_id:'RFQ-OTHER'}}}]);
 await assert.rejects(()=>runFreeGemini(demo,{requestId},{env,fetchImpl:fakeFetch,applyRateLimit:false}),x=>x.code==='model_requested_invalid_scope');
});
test('no user-supplied arbitrary prompt or free-form task accepted',async()=>{
 await assert.rejects(()=>runFreeGemini(demo,{requestId,task:'Send confidential supplier offers'},{env,applyRateLimit:false}),x=>x.code==='invalid_model_task');
});
test('upstream rejects calls with rate limit response and bridge never retries',async()=>{
 let calls=0;
 const fakeFetch=async()=>{calls++;return {ok:false,status:429}};
 await assert.rejects(()=>runFreeGemini(demo,{requestId},{env,fetchImpl:fakeFetch,applyRateLimit:false}),x=>x.code==='provider_rate_limited');
 assert.equal(calls,1);
});
test('free model may answer without calling a tool: do not fabricate successful tool usage',async()=>{
 const fakeFetch=async()=>mockReply([{text:'لا توجد عروض مؤهلة.'}]);
 const out=await runFreeGemini(demo,{requestId},{env,fetchImpl:fakeFetch,applyRateLimit:false});
 assert.equal(out.invokedTools.length,0);
 assert.equal(out.answer,'لا توجد عروض مؤهلة.');
});
