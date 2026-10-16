'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const {unifiedMarketSearch,validateSearchInput}=require('../market-unified');
test('validates arbitrary product names and protects input length',()=>{
 assert.equal(validateSearchInput('   3D printer P2S  '),'3D printer P2S');
 assert.equal(validateSearchInput('x'),null);
 assert.equal(validateSearchInput('a'.repeat(161)),null);
 assert.equal(validateSearchInput('\u0000'),null);
});
test('returns authentic-shaped multi-market source evidence without inventing prices',async()=>{
 const env={MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'offline-mock',MARKET_MAX_SEARCH_QUERIES:'3'};
 const r=await unifiedMarketSearch({query:'100mm PU cold room panel'},{
   env,disableCache:true,searchIndexedWeb:async q=>{
     const hit=q.includes('site:alibaba.com')?
       {title:'100mm PU cold room panel',url:'https://www.alibaba.com/p1',snippet:'US$18.50/m²'}:
       q.includes('site:made-in-china.com')?
       {title:'100mm PU cold room panel',url:'https://www.made-in-china.com/p2',snippet:'US $19.50 / Square Meter'}:
       {title:'100mm PU cold room panel',url:'https://detail.1688.com/offer/123',snippet:'￥120 / 平方米'};
     return {configured:true,provider:'mock-search',items:[hit]};
   }
 });
 assert.equal(r.ok,true);
 assert.equal(r.count,3);
 assert.deepEqual(r.sitesCovered,['Alibaba','Made-in-China','1688']);
 assert.equal(r.priceBearingSources,3);
 assert.deepEqual(r.results.map(x=>x.prices[0].currency),['USD','USD','CNY']);
 assert.ok(r.results.every(x=>x.url.startsWith('https://')));
 assert.equal(r.results.every(x=>x.prices.every(y=>y.status==='published-snippet-unverified')),true);
});
test('honest zero-key fallback returns no simulated live products',async()=>{
 const r=await unifiedMarketSearch({query:'laser printer A4 duplex'},{
   env:{MARKET_ENABLE_LIVE_SEARCH:'false'},disableCache:true,
   searchIndexedWeb:()=>{throw Error('Must not use provider')}
 });
 assert.equal(r.searchConfigured,false);
 assert.equal(r.count,0);
 assert.equal(r.results.length,0);
 assert.equal(r.manualSearchLinks.length,4);
 assert.ok(r.manualSearchLinks.every(x=>x.url.startsWith('https://www.google.com/search?q=')));
});
test('hosted HTML and API use one protected, read-only search endpoint',async()=>{
 const port=30000+Math.floor(Math.random()*15000);
 const env={...process.env,PORT:String(port),STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'market-staff',HOSTED_ACCESS_PASSWORD:'no-real-secret-test-only-2026',
  MARKET_ENABLE_LIVE_SEARCH:'false'};
 const child=spawn(process.execPath,['server.js'],{
  cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 try{
  let ready=false;
  for(let i=0;i<65;i++){
   if(child.exitCode!==null)throw Error('Backend process exited');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ready,true);
  const post={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'Bambu Lab P2S Combo'})};
  let r=await fetch(base+'/api/market-intelligence/search',post);
  assert.equal(r.status,401);
  const headers={...post.headers,Authorization:'Basic '+Buffer.from('market-staff:no-real-secret-test-only-2026').toString('base64')};
  r=await fetch(base+'/api/state',{headers});assert.equal(r.status,200);
  const before=await r.json();
  r=await fetch(base+'/api/market-intelligence/search',{...post,headers});assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.query,'Bambu Lab P2S Combo');
  assert.equal(result.searchConfigured,false);
  assert.equal(result.results.length,0);
  assert.equal(result.manualSearchLinks.length,4);
  r=await fetch(base+'/api/market-intelligence/search',{method:'POST',headers,body:JSON.stringify({query:'x'})});
  assert.equal(r.status,422);
  r=await fetch(base+'/api/state',{headers});const after=await r.json();
  assert.deepEqual(after.requests,before.requests);
  assert.deepEqual(after.marketScans,before.marketScans);
  r=await fetch(base+'/',{headers});assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/البحث الموحد عن المنتجات والأسعار/);
  assert.doesNotMatch(html,/alibabaSearchPanel\(\)\+madeInChinaSearchPanel\(\)/);
 }finally{child.kill('SIGTERM')}
});
