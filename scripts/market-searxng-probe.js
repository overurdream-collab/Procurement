'use strict';
// Genuine live discovery using locally hosted SearXNG. No marketplace login or scraping.
const fs=require('node:fs');
const {marketScan}=require('../market-scan');
const cases=[
  {id:'LIVE-PU',product:'100mm PU cold room insulated sandwich panel',specifications:'price per square meter'},
  {id:'LIVE-DOOR',product:'100mm cold room sliding door',specifications:'USD price per set'},
  {id:'LIVE-COMP',product:'2HP R410A rotary refrigeration compressor',specifications:'price per piece'},
  {id:'LIVE-EVAP',product:'2HP cold room evaporator',specifications:'unit wholesale price'},
  {id:'LIVE-VALVE',product:'Danfoss T2 TE2 expansion valve',specifications:'unit price'}
];
const env={
  ...process.env,
  MARKET_ENABLE_LIVE_SEARCH:'true',
  SEARXNG_URL:'http://127.0.0.1:8888/',
  MARKET_MAX_SEARCH_QUERIES:process.env.MARKET_MAX_SEARCH_QUERIES||'3'
};
(async()=>{
 const results=[];
 for (const input of cases){
   const r=await marketScan({quotes:[]},input,{env,disableCache:true});
   const extract=r.sources.filter(s=>s.type==='Published Market Source').map(s=>({
     platform:s.platform,url:s.url,title:s.title,
     priceEvidence:s.priceEvidence,verification:s.verification
   }));
   results.push({name:input.product,status:r.resultStatus,provider:r.searchStatus.provider,
     queries:r.searchStatus.queriesExecuted,errors:r.searchStatus.errors,
     sourceCount:extract.length,bench:r.benchmark,sources:extract.slice(0,12)});
   process.stdout.write(JSON.stringify({
     product:input.product,status:r.resultStatus,sourceCount:extract.length,
     distinctPlatforms:r.coverage.platforms,prices:extract.flatMap(x=>x.priceEvidence).length,
     errors:r.searchStatus.errors
   })+'\n');
   await new Promise(done=>setTimeout(done,1200));
 }
 const report={
   type:'real-no-key-search-probe',observedAt:new Date().toISOString(),provider:'self-hosted-searxng',
   liveSearch:true,verifiedSupplierQuotes:false,results
 };
 fs.writeFileSync('live-searxng-probe.json',JSON.stringify(report,null,2));
 const count=results.reduce((n,x)=>n+x.sourceCount,0);
 const sum=results.reduce((n,x)=>n+x.sources.flatMap(y=>y.priceEvidence).filter(y=>y.currency==='USD'&&y.unit).length,0);
 const summary=['## Procurement live search probe','',
   '- Backend: privately hosted SearXNG (no API key or paid subscription)',
   '- Products: '+cases.length,
   '- Indexed links returned: '+count,
   '- Explicit USD/unit observations: '+sum,
   '- No commercial price or product-page verification was performed.',
   '- This is not a validated supplier quotation or production acceptance.','',
   '| Product | Status | Sources | Errors |','|---|---|---:|---:|',
   ...results.map(x=>'| '+x.name+' | '+x.status+' | '+x.sourceCount+' | '+x.errors.length+' |')
 ].join('\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
 process.stdout.write(summary+'\n');
 if(count===0){console.error('Zero market source links returned: live discovery has NOT been proven.');process.exitCode=2;}
})().catch(err=>{console.error(String(err));process.exitCode=1});
