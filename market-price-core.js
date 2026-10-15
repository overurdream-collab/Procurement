'use strict';
// Search snippet evidence is provisional; no website bypass or fabricated quotations.
function parsePrices(input) {
  const text=String(input||'');
  const re=/(USD|US\$|RMB|CNY|CN¥|\$|¥|￥)\s*[:：]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USD|US\$|RMB|CNY|CN¥|¥|￥)/gi;
  const prices=[];
  for (const m of text.matchAll(re)) {
    const token=String(m[1]||m[4]).toUpperCase();
    const currency=/^(USD|US\$|\$)$/.test(token)?'USD':'CNY';
    const amount=Number(String(m[2]||m[3]).replace(/,/g,''));
    if(!Number.isFinite(amount)||amount<=0)continue;
    const after=text.slice(m.index+m[0].length,m.index+m[0].length+35);
    const found=after.match(/^\s*(?:\/|per\s+|each\s+)(?:([mM](?:2|²)|sqm|sq\.?\s*m|㎡|square\s*met(?:er|re)s?)|([pP]c|piece|pieces)|([sS]et|sets)|([kK]g)|([uU]nit|units)|([mM]et(?:er|re)s?))/i);
    const unit=!found?null:found[1]?'sqm':found[2]?'piece':found[3]?'set':found[4]?'kg':found[5]?'unit':'meter';
    prices.push({amount,currency,unit,raw:m[0].trim(),evidence:'unverified-search-snippet'});
  }
  return prices;
}
function buildMarketQuery(request) {
  const keywords=[request.product,request.title,request.specifications,request.productChinese]
    .filter(Boolean).map(x=>String(x).trim()).join(' ').replace(/\s+/g,' ').slice(0,280);
  return keywords?keywords+' wholesale unit price':'';
}
function sourceMatchesDomain(link,domain) {
  try { const u=new URL(link); const host=u.hostname.toLowerCase();
    return ['https:','http:'].includes(u.protocol)&&(!domain||host===domain||host.endsWith('.'+domain));
  } catch {return false;}
}
function summarizePublishedPrices(sources) {
  const groups=new Map();
  for(const s of sources){
    if(s.type!=='Published Market Source'||!s.url)continue;
    for(const p of s.priceEvidence||[]){
      if(p.currency!=='USD'||!p.unit)continue;
      if(!groups.has(p.unit))groups.set(p.unit,new Map());
      if(!groups.get(p.unit).has(s.url))groups.get(p.unit).set(s.url,p.amount);
    }
  }
  const ranked=[...groups.entries()].sort((a,b)=>b[1].size-a[1].size);
  if(!ranked.length)return null;
  const [unit,bySource]=ranked[0],values=[...bySource.values()].sort((a,b)=>a-b),mid=Math.floor(values.length/2);
  return {low:values[0],median:values.length%2?values[mid]:(values[mid-1]+values[mid])/2,
    high:values[values.length-1],count:values.length,currency:'USD',unit,
    evidence:'unverified-public-search-snippets',comparableSpecVerified:false};
}
module.exports={parsePrices,buildMarketQuery,sourceMatchesDomain,summarizePublishedPrices};
