'use strict';
// Search snippet evidence is provisional; no website bypass or fabricated quotations.
function parsePrices(input) {
  const text=String(input||'');
  const re=/(USD|US\s*\$|RMB|CNY|CN¥|\$|¥|￥|元)\s*[:：]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(USD|US\s*\$|RMB|CNY|CN¥|¥|￥|元)/gi;
  const prices=[];
  for (const m of text.matchAll(re)) {
    const token=String(m[1]||m[4]).toUpperCase();
    const currency=/^(USD|US\s*\$|\$)$/.test(token)?'USD':'CNY';
    const amount=Number(String(m[2]||m[3]).replace(/,/g,''));
    if(!Number.isFinite(amount)||amount<=0)continue;
    let after=text.slice(m.index+m[0].length,m.index+m[0].length+50);
    // Price ranges are not precise quotes, so only show them as unverified bounds.
    const range=after.match(/^\s*[-–—~]\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
    const rangeMax=range?Number(range[1].replace(/,/g,'')):null;
    if(range)after=after.slice(range[0].length);
    after=after.replace(/^\s*元\s*/, '');
    const found=after.match(/^\s*(?:\/\s*|per\s+|each\s+)(?:([mM](?:2|²)|sqm|sq\.?\s*m|㎡|平方米|平米|square\s*met(?:er|re)s?)|([pP]c|piece|pieces|件|个|片)|([sS]et|sets|套)|([kK]g|公斤|千克)|([uU]nit|units)|([mM]et(?:er|re)s?|米))/i);
    const unit=!found?null:found[1]?'sqm':found[2]?'piece':found[3]?'set':found[4]?'kg':found[5]?'unit':'meter';
    prices.push({amount,currency,unit,rangeMax:Number.isFinite(rangeMax)&&rangeMax>amount?rangeMax:null,raw:m[0].trim(),evidence:'unverified-search-snippet'});
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
// A price source must match the product's distinguishing description before it
// may contribute to an indicative benchmark. A search hit alone is NOT enough.
function matchesRequestedProduct(source,request) {
  if(!request||!request.product)return true;
  const input=String(request.product).toLowerCase();
  const text=(String(source.title||'')+' '+String(source.snippet||'')).toLowerCase();
  // Preserve numeric product distinctions such as 100 mm / 2 HP and R410A.
  const sizes=(input.match(/\b\d+(?:\.\d+)?\s*(?:mm|cm|hp|kw|inch|inches)\b/g)||[])
    .map(s=>s.replace(/\s+/g,''));
  const models=(input.match(/\br\d{3,4}[a-z]?\b/g)||[]);
  const simplified=text.replace(/\s+/g,'');
  if(sizes.some(s=>!simplified.includes(s)))return false;
  if(models.some(s=>!simplified.includes(s)))return false;
  const tokens=[...new Set(input.match(/[a-z]{4,}/g)||[])]
    .filter(s=>!['with','from','price','wholesale','unit','part','parts','general','original'].includes(s));
  const matched=tokens.filter(t=>new RegExp('\\b'+t+'\\b').test(text)).length;
  if(tokens.length===0)return sizes.length>0||models.length>0;
  return matched>=Math.min(2,tokens.length);
}

function summarizePublishedPrices(sources,request) {
  const groups=new Map();
  for(const s of sources){
    if(s.type!=='Published Market Source'||!s.url||!matchesRequestedProduct(s,request))continue;
    for(const p of s.priceEvidence||[]){
      if(p.currency!=='USD'||!p.unit||p.rangeMax)continue;
      if(!groups.has(p.unit))groups.set(p.unit,new Map());
      if(!groups.get(p.unit).has(s.url))groups.get(p.unit).set(s.url,p.amount);
    }
  }
  const ranked=[...groups.entries()].sort((a,b)=>b[1].size-a[1].size);
  if(!ranked.length||ranked[0][1].size<2)return null;
  const [unit,bySource]=ranked[0],values=[...bySource.values()].sort((a,b)=>a-b),mid=Math.floor(values.length/2);
  return {low:values[0],median:values.length%2?values[mid]:(values[mid-1]+values[mid])/2,
    high:values[values.length-1],count:values.length,currency:'USD',unit,
    evidence:'unverified-public-search-snippets',comparableSpecVerified:false};
}
module.exports={parsePrices,buildMarketQuery,sourceMatchesDomain,summarizePublishedPrices,matchesRequestedProduct};
