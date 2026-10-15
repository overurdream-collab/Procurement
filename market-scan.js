'use strict';
const {parsePrices,buildMarketQuery,sourceMatchesDomain,summarizePublishedPrices,matchesRequestedProduct}=require('./market-price-core');
const {configuredProvider,searchIndexedWeb}=require('./market-index-search');
const MARKET_TARGETS=[
  {platform:'Alibaba',domain:'alibaba.com',region:'China / International',query:'site:alibaba.com'},
  {platform:'Made-in-China',domain:'made-in-china.com',region:'China / International',query:'site:made-in-china.com'},
  {platform:'1688',domain:'1688.com',region:'China',query:'site:1688.com'},
  {platform:'Taobao',domain:'taobao.com',region:'China',query:'site:taobao.com'},
  {platform:'Global Sources',domain:'globalsources.com',region:'Asia / International',query:'site:globalsources.com'},
  {platform:'Company websites',domain:null,region:'International',query:'manufacturer supplier factory official website'}
];
const marketSearchCache=new Map();
function marketBaseQuery(req){return buildMarketQuery(req)}
function marketPriceMentions(v){return parsePrices(v).map(p=>p.raw).slice(0,8)}
function historicalMarketSources(st,req){
  return (st.quotes||[]).filter(x=>!x.requestId||x.requestId===req.id).map(x=>({
    type:'Historical Price',platform:'Internal',region:'Internal',domain:null,
    title:'Internal quote '+x.id,url:null,snippet:x.basis||'',
    priceMentions:[],priceEvidence:[],prices:[],
    historicalUnitPrice:x.unitPrice||null,historicalCurrency:x.currency||null
  }));
}
async function googleMarketSources(req,options={}){
  const base=marketBaseQuery(req);
  const env=options.env||process.env;
  const provider=configuredProvider(env),configured=provider!=='none';
  const maxQueries=Math.min(6,Math.max(1,parseInt(env.MARKET_MAX_SEARCH_QUERIES||'3',10)||3));
  const targets=MARKET_TARGETS.slice(0,maxQueries);
  const errors=[],out=[];let queriesExecuted=0;
  if(!base)return {configured,provider,sources:out,errors:['product_details_required'],queriesExecuted,maxQueries};
  if(!configured)return {configured,provider,sources:out,errors:['search_provider_not_configured'],queriesExecuted,maxQueries};
  for(const target of targets){
    const q=base+' '+target.query,cacheKey=provider+':'+q;
    try{
      let r=options.disableCache?null:marketSearchCache.get(cacheKey);
      if(!r||Date.now()-r.time>30*60*1000){
        const fresh=await (options.searchIndexedWeb||searchIndexedWeb)(q,{limit:8,env});
        r={time:Date.now(),result:fresh};marketSearchCache.set(cacheKey,r);
        queriesExecuted++;
      }
      for(const hit of r.result.items){
        if(!sourceMatchesDomain(hit.url,target.domain))continue;
        let domain='';try{domain=new URL(hit.url).hostname.replace(/^www\./,'')}catch{continue}
        const snippet=hit.snippet||'',title=hit.title||'';
        const priceEvidence=parsePrices(title+'\n'+snippet);
        out.push({type:'Published Market Source',platform:target.platform,region:target.region,domain,title,url:hit.url,
          snippet,priceMentions:priceEvidence.map(x=>x.raw).slice(0,8),priceEvidence,
          prices:priceEvidence.filter(p=>p.currency==='USD'&&p.unit).map(p=>p.amount),
          searchQuery:q,verification:'indexed-snippet-only'});
      }
    }catch(e){errors.push(target.platform+': '+String(e.message||e))}
  }
  const seen=new Set();
  return {configured,provider,sources:out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}),
    errors,queriesExecuted,maxQueries};
}
async function marketScan(st,req,options={}){
  const query=marketBaseQuery(req),sources=historicalMarketSources(st,req);
  let searchStatus={configured:false,provider:'none',targets:MARKET_TARGETS.map(x=>x.platform),errors:[],queriesExecuted:0,maxQueries:3};
  try{
    const live=await googleMarketSources(req,options);
    searchStatus={configured:live.configured,provider:live.provider,targets:MARKET_TARGETS.slice(0,live.maxQueries).map(x=>x.platform),
      errors:live.errors,queriesExecuted:live.queriesExecuted,maxQueries:live.maxQueries};
    sources.push(...live.sources);
  }catch(e){searchStatus.errors.push(String(e.message||e))}
  for(const x of req.sourceObservations||[]){
    const snippet=String(x.price||'')+' '+String(x.note||''),prices=parsePrices(snippet);
    sources.push({type:'User supplied source',platform:x.platform||'Manual',region:x.region||'',
      domain:x.domain||'',title:x.title||'User supplied source',url:x.url||null,
      snippet,priceMentions:prices.map(x=>x.raw),priceEvidence:prices,
      prices:prices.filter(p=>p.currency==='USD'&&p.unit).map(p=>p.amount),verification:'user-supplied-unverified'});
  }
  const published=sources.filter(x=>x.type==='Published Market Source');
  for(const x of published)x.productMatch=matchesRequestedProduct(x,req);
  const platforms=[...new Set(published.map(x=>x.platform))],domains=[...new Set(published.map(x=>x.domain))];
  const benchmark=summarizePublishedPrices(published,req);
  const resultStatus=!query?'input-required':!searchStatus.configured?'search-not-configured':
    !published.length?'no-published-sources':!benchmark?'sources-need-price-review':'indicative-needs-review';
  return {
    id:'MS-'+Date.now(),requestId:req.id,createdAt:new Date().toISOString(),query,
    mode:published.length?'indexed-public-results':'no-public-results',
    resultStatus,sourceCount:sources.length,
    confidence:benchmark?Math.min(35,10+benchmark.count*5):0,benchmark,
    searchStatus,coverage:{platforms,domains,platformCount:platforms.length,domainCount:domains.length},
    classification:{verifiedQuotes:0,publishedPrices:published.length,
      historicalPrices:sources.filter(x=>x.type==='Historical Price').length,aiEstimates:0},
    sources:sources.slice(0,80),
    disclaimer:'Indicative search-index snippets only; prices, specifications, stock, currency, quantities and Incoterms require verification from the seller. Never treat these as binding supplier quotations. Comparable benchmark includes only explicit USD/unit pairs from distinct published URLs. Historical and user-provided prices are excluded.'
  };
}


module.exports={marketScan,googleMarketSources,marketBaseQuery};
