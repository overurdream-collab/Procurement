'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const samples=require('./fixtures/public-market-observations-20261015.json');
const {marketScan}=require('../market-scan');

test('replay five public-source samples without credentials or network access',async()=>{
 assert.equal(samples.cases.length,5);
 for (const entry of samples.cases){
   const collected=[];
   const scan=await marketScan({quotes:[]},{id:'REPLAY-'+entry.product,product:entry.product},{
     env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'FAKE-FOR-OFFLINE-REPLAY',MARKET_MAX_SEARCH_QUERIES:'3'},
     searchIndexedWeb:async query=>{
       const match=query.match(/site:(\S+)/);const domain=match?match[1]:null;
       const items=entry.sources.filter(x=>new URL(x.url).hostname.endsWith(domain||'___')).map(x=>({
         title:x.title,url:x.url,snippet:x.snippet
       }));
       collected.push(...items);
       return {configured:true,provider:'fixture-replay',items};
     },disableCache:true
   });
   assert.equal(scan.searchStatus.queriesExecuted,3);
   assert.equal(scan.sourceCount,collected.length);
   assert.ok(scan.sources.every(x=>x.verification==='indexed-snippet-only'));
   assert.equal(scan.classification.verifiedQuotes,0);
   assert.ok(scan.sources.every(x=>x.url.startsWith('https://')));
   assert.ok(['indicative-needs-review','sources-need-price-review','no-published-sources'].includes(scan.resultStatus));
   // Intentional: noncomparable product specifications must never be marked verified.
   assert.ok(!scan.benchmark||scan.benchmark.comparableSpecVerified===false);
 }
});
