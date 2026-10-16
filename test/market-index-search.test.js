'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {searchIndexedWeb,configuredProvider}=require('../market-index-search');
test('keys alone never trigger a billable network call',async()=>{
  const r=await searchIndexedWeb('price',{env:{BRAVE_SEARCH_API_KEY:'present-but-disabled'},fetcher:()=>{throw Error('Unexpected API call')}});
  assert.equal(r.provider,'none');assert.equal(r.configured,false);
});
test('works without keys and makes no network calls',async()=>{
  const r=await searchIndexedWeb('product',{env:{},fetcher:()=>{throw Error('Must not fetch')}});
  assert.deepEqual(r,{configured:false,provider:'none',items:[]});
});
test('brave adapter normalizes indexed results without scraping',async()=>{
  const r=await searchIndexedWeb('100mm PIR panel price',{env:{BRAVE_SEARCH_API_KEY:'test-only',MARKET_ENABLE_LIVE_SEARCH:'true'},fetcher:async(u,o)=>{
    assert.match(u,/api.search.brave.com/);
    assert.equal(o.headers['X-Subscription-Token'],'test-only');
    return {ok:true,json:async()=>({web:{results:[{title:'Panel',url:'https://example.com/p',description:'USD 18.50/m²'}]}})};
  }});
  assert.equal(r.items[0].url,'https://example.com/p');
  assert.equal(r.provider,'brave');
});
test('legacy Google adapter only if already configured',async()=>{
  const r=await searchIndexedWeb('laser printer',{env:{GOOGLE_CSE_API_KEY:'test-key',GOOGLE_CSE_ID:'test-id',MARKET_ENABLE_LIVE_SEARCH:'true'},fetcher:async()=>{
    return {ok:true,json:async()=>({items:[{title:'A',link:'https://example.net/x',snippet:'USD 30/piece'}]})};
  }});
  assert.equal(r.items[0].url,'https://example.net/x');
  assert.equal(r.provider,'google-legacy');
});

test('prefer no-card Tavily over providers requiring card',async()=>{
 let calls=0;
 const v=await searchIndexedWeb('PIR cold room panel',{env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'tvly-test',BRAVE_SEARCH_API_KEY:'brave-test'},fetcher:async(u,o)=>{
   calls++;
   assert.equal(u,'https://api.tavily.com/search');
   assert.equal(o.method,'POST');
   assert.equal(o.headers.Authorization,'Bearer tvly-test');
   const b=JSON.parse(o.body);
   assert.equal(b.search_depth,'basic');
   assert.equal(b.max_results,8);
   return {ok:true,json:async()=>({results:[{title:'Sample',url:'https://www.alibaba.com/p',content:'US $19.5 / Square Meter'}]})};
 }});
 assert.equal(calls,1);
 assert.equal(v.provider,'tavily');
 assert.equal(v.items[0].snippet,'US $19.5 / Square Meter');
});
test('Serper normalizes organic web snippets with no card',async()=>{
 const v=await searchIndexedWeb('compressor R404A',{env:{MARKET_ENABLE_LIVE_SEARCH:'true',SERPER_API_KEY:'test'},fetcher:async(u,o)=>{
   assert.equal(u,'https://google.serper.dev/search');
   assert.equal(o.method,'POST');
   assert.equal(o.headers['X-API-KEY'],'test');
   assert.equal(JSON.parse(o.body).q,'compressor R404A');
   return {ok:true,json:async()=>({organic:[{title:'Compressor',link:'https://www.made-in-china.com/p',snippet:'USD 500 / piece'}]})};
 }});
 assert.equal(v.provider,'serper');
 assert.equal(v.items[0].url,'https://www.made-in-china.com/p');
});
test('non-successful external provider is not silently considered success',async()=>{
 await assert.rejects(
  ()=>searchIndexedWeb('panel',{env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'bad'},fetcher:async()=>({ok:false,status:429})}),
  /tavily search HTTP 429/
 );
});

test('self-hosted SearXNG reads JSON results from loopback only',async()=>{
 const env={MARKET_ENABLE_LIVE_SEARCH:'true',SEARXNG_URL:'http://127.0.0.1:8888/'};
 const r=await searchIndexedWeb('100mm PU sandwich panels price',{env,fetcher:async(u,o)=>{
   const url=new URL(u);
   assert.equal(url.hostname,'127.0.0.1');
   assert.equal(url.pathname,'/search');
   assert.equal(url.searchParams.get('format'),'json');
   assert.match(url.searchParams.get('q'),/sandwich panels/);
   return {ok:true,json:async()=>({results:[{
     title:'Panel',url:'https://www.alibaba.com/p',content:'US$19.50/sqm'
   }]})};
 }});
 assert.equal(r.provider,'searxng');
 assert.equal(r.items[0].url,'https://www.alibaba.com/p');
});
test('rejects non-local self-hosted search endpoint to prevent query exfiltration',async()=>{
 await assert.rejects(
   ()=>searchIndexedWeb('secret internal procurement',{env:{MARKET_ENABLE_LIVE_SEARCH:'true',SEARXNG_URL:'https://untrusted-search.example/secret'}}),
   /SEARXNG_URL/
 );
 await assert.rejects(
   ()=>searchIndexedWeb('secret',{env:{MARKET_ENABLE_LIVE_SEARCH:'true',SEARXNG_URL:'http://localhost.evil.test/'}}),
   /SEARXNG_URL/
 );
});

test('search provider cannot return more than requested limit',async()=>{
 const x=await searchIndexedWeb('cold room panels',{env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'mock'},limit:2,fetcher:async()=>({
   ok:true,json:async()=>({results:Array.from({length:30},(_,i)=>({title:'Part '+i,url:'https://example.com/'+i,content:'USD 10/unit'}))})
 })});
 assert.equal(x.items.length,2);
});
