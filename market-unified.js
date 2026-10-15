'use strict';
const {marketScan}=require('./market-scan');
const {sourceMatchesDomain}=require('./market-price-core');
const {configuredProvider}=require('./market-index-search');

// URLs are search pages opened explicitly by the staff member, not claims of live API data.
function manualSearchLinks(query){
 const sites=[
  ['Alibaba','alibaba.com'],['Made-in-China','made-in-china.com'],
  ['1688','1688.com'],['Global Sources','globalsources.com']
 ];
 return sites.map(([source,domain])=>({source,
  url:'https://www.google.com/search?q='+encodeURIComponent('site:'+domain+' '+query+' wholesale price')}));
}
function validateSearchInput(value){
 if(typeof value!=='string')return null;
 const clean=value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim();
 return clean.length>=2&&clean.length<=160?clean:null;
}
function asSearchResults(scan){
 const entries=(scan.sources||[]).filter(x=>x.type==='Published Market Source'&&sourceMatchesDomain(x.url,null));
 return entries.slice(0,30).map(x=>({
  source:x.platform,url:x.url,title:x.title||'صفحة منتج',snippet:(x.snippet||'').slice(0,420),
  matching:x.productMatch===true?'possible-match':'not-verified',
  prices:(x.priceEvidence||[]).slice(0,8).map(p=>({
   amount:p.amount,rangeMax:p.rangeMax,currency:p.currency,unit:p.unit,
   status:'published-snippet-unverified'
  }))
 }));
}
async function unifiedMarketSearch(input,options={}){
 const query=validateSearchInput(input?.query);
 if(!query)return {ok:false,status:422,error:'invalid_product_query',message:'اكتب اسم المنتج بوضوح، من 2 إلى 160 حرفًا.'};
 // No RFQ creation or database writes. This is independent market exploration.
 const data=await marketScan({quotes:[]},{id:'TRANSIENT',product:query},options);
 const results=asSearchResults(data);
 return {
  ok:true,status:200,query,provider:data.searchStatus.provider,
  searchConfigured:data.searchStatus.configured,searchState:data.resultStatus,
  errors:data.searchStatus.errors||[],
  count:results.length,
  priceBearingSources:results.filter(x=>x.prices.some(p=>p.unit)).length,
  sitesCovered:data.coverage.platforms,
  results,manualSearchLinks:manualSearchLinks(query),
  warning:'الأسعار إن وجدت مأخوذة من مقتطفات مفهرسة، وليست عروضًا موثقة أو أسعارًا FOB مؤكدة. راجع الرابط والمواصفات والكمية.'
 };
}
module.exports={unifiedMarketSearch,validateSearchInput,manualSearchLinks};
