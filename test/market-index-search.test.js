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
