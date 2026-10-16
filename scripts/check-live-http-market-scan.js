'use strict';
const fs=require('node:fs');
const base=process.env.PROCUREMENT_API_BASE||'http://127.0.0.1:8787';
(async()=>{
 const r=await fetch(base+'/api/requests/RFQ-001/market-scan',{
   method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
   signal:AbortSignal.timeout(90000)
 });
 if(!r.ok)throw Error('HTTP market-scan status '+r.status+' '+(await r.text()).slice(0,300));
 const payload=await r.json();
 const published=(payload.sources||[]).filter(x=>x.type==='Published Market Source');
 const summary={
   observedAt:new Date().toISOString(),
   source:'actual Procurement HTTP POST /api/requests/RFQ-001/market-scan',
   requestId:payload.requestId,
   provider:payload.searchStatus?.provider,
   queriesExecuted:payload.searchStatus?.queriesExecuted||0,
   status:payload.resultStatus,
   publishedSources:published.length,
   publishedWithAnyPrice:published.filter(x=>(x.priceEvidence||[]).length).length,
   publishedWithUsdUnit:published.filter(x=>(x.priceEvidence||[]).some(y=>y.currency==='USD'&&y.unit)).length,
   platforms:payload.coverage?.platforms,
   searchErrors:payload.searchStatus?.errors||[],
   benchmarkApproved:false
 };
 fs.writeFileSync('live-http-market-scan-summary.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary));
 if(summary.requestId!=='RFQ-001'||summary.provider!=='searxng'||summary.queriesExecuted<1||
   !['sources-need-price-review','indicative-needs-review'].includes(summary.status)||summary.publishedSources<1)
   throw Error('Live HTTP market scan did not prove the application-to-search connection');
})().catch(err=>{console.error(err);process.exitCode=1});
