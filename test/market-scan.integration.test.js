'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {marketScan}=require('../market-scan');
const inputs={id:'REQ-TEST',product:'100mm PU panel',specifications:'metal sheet 0.4mm'};

test('three public marketplaces yield a clearly unverified same-unit benchmark',async()=>{
 const queries=[];
 const adapter=async(q,{env})=>{
   queries.push(q);
   assert.equal(env.MARKET_ENABLE_LIVE_SEARCH,'true');
   const base={configured:true,provider:'tavily'};
   if(q.includes('site:alibaba.com'))return {...base,items:[
     {url:'https://www.alibaba.com/product-detail/p1',title:'100mm panel',snippet:'US$18.50/m²'},
     {url:'https://alibaba.com.evil.test/cheat',title:'Spoofed panel',snippet:'US$0.01/m²'}
   ]};
   if(q.includes('site:made-in-china.com'))return {...base,items:[
     {url:'https://www.made-in-china.com/panel',title:'100mm panel',snippet:'FOB Price: US $19.50 / Square Meter'}
   ]};
   if(q.includes('site:1688.com'))return {...base,items:[
     {url:'https://detail.1688.com/offer/100',title:'冷库板',snippet:'￥110 / 平方米'}
   ]};
   throw Error('Unexpected target '+q);
 };
 const state=await marketScan({quotes:[]},inputs,{env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'mock'},searchIndexedWeb:adapter,disableCache:true});
 assert.equal(queries.length,3);
 assert.equal(state.resultStatus,'indicative-needs-review');
 assert.deepEqual(state.coverage.platforms,['Alibaba','Made-in-China','1688']);
 assert.equal(state.benchmark.low,18.5);
 assert.equal(state.benchmark.high,19.5);
 assert.equal(state.benchmark.count,2);
 assert.equal(state.benchmark.unit,'sqm');
 assert.equal(state.benchmark.comparableSpecVerified,false);
 assert.equal(state.sources.some(x=>x.url.includes('evil.test')),false);
 assert.equal(state.classification.verifiedQuotes,0);
});
test('explicit opt-in is required even when a provider key exists',async()=>{
 const state=await marketScan({quotes:[]},{id:'REQ-B',product:'A4 laser printer'},{
   env:{TAVILY_API_KEY:'saved-key'},
   searchIndexedWeb:async()=>{throw Error('No API calls expected')},disableCache:true
 });
 assert.equal(state.resultStatus,'search-not-configured');
 assert.equal(state.benchmark,null);
});
test('no false success from provider errors and old supplier quote',async()=>{
 const state=await marketScan({quotes:[{id:'old',unitPrice:1,currency:'USD'}]},{
   id:'REQ-C',product:'2HP compressor'
 },{
   env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'mock',MARKET_MAX_SEARCH_QUERIES:'1'},
   searchIndexedWeb:async()=>{throw Error('quota exceeded')},disableCache:true
 });
 assert.equal(state.resultStatus,'no-published-sources');
 assert.equal(state.benchmark,null);
 assert.equal(state.searchStatus.queriesExecuted,0);
 assert.match(state.searchStatus.errors[0],/quota exceeded/);
 assert.equal(state.classification.historicalPrices,1);
});
test('search budgets limit provider requests',async()=>{
 let requests=0;
 const state=await marketScan({quotes:[]},{id:'REQ-D',product:'evaporator'},{
   env:{MARKET_ENABLE_LIVE_SEARCH:'true',SERPER_API_KEY:'mock',MARKET_MAX_SEARCH_QUERIES:'1'},
   searchIndexedWeb:async()=>{requests++;return {configured:true,provider:'serper',items:[]}},disableCache:true
 });
 assert.equal(requests,1);
 assert.equal(state.searchStatus.maxQueries,1);
 assert.equal(state.benchmark,null);
});
