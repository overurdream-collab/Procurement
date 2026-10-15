'use strict';
// Deterministic procurement reporting. No AI-generated numbers or false award recommendations.
// A quote may be recorded yet not be suitable for comparing with another quote.
const clean=x=>String(x??'').replace(/\s+/g,' ').trim();
const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:null;
const norm=x=>clean(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
// All daily reporting dates use the operating city's calendar (Asia/Aden).
// A timestamp with Z or an offset is converted before deciding "today".
function day(x){
 const v=String(x||'');
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
 if(!/^\d{4}-\d{2}-\d{2}T/.test(v))return null;
 const d=new Date(v);if(!Number.isFinite(d.getTime()))return null;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Aden',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
const unitName=x=>{
 const u=norm(x).replace(/\s/g,'');
 if(['sqm','m2','m²','㎡','平方米','平米'].includes(u))return 'm²';
 if(['piece','pieces','pc','pcs','قطعة','件','个'].includes(u))return 'piece';
 if(['set','sets','طقم','套'].includes(u))return 'set';
 if(['kg','كيلوجرام','kilogram'].includes(u))return 'kg';
 return clean(x||'')||null;
};
function quoteBasis(q){
 const b=clean(q.basis||q.incoterm).toUpperCase();
 const type=b.match(/\b(?:FOB|EXW|CIF|CFR|DAP|DDP)\b/)?.[0]||'UNKNOWN';
 const port=type==='FOB'?norm(b.replace(/\bFOB\b/,'').replace(/\bPRICE\b/g,'')):'';
 return {type,port:port||null,text:clean(q.basis||q.incoterm)||'غير معروف'};
}
function productKey(item){
 // item.comparisonKey must be agreed by the reviewer across suppliers;
 // otherwise exact normalized specification text only, avoiding fuzzy grouping.
 return norm(item.comparisonKey||item.description);
}
const isVerified=q=>['Verified Quote','verified-quotation'].includes(clean(q.evidenceClass));
function analyzeQuote(st,q){
 const supplier=(st.suppliers||[]).find(s=>s.id===q.supplierId)||{};
 const request=(st.requests||[]).find(r=>r.id===q.requestId)||{};
 const basis=quoteBasis(q);
 const issues=[];
 if(!supplier.id)issues.push('المورد غير موجود في سجل الموردين');
 if(!request.id)issues.push('الطلب غير موجود');
 if(!isVerified(q))issues.push('العرض لم يتم التحقق من دليله');
 if(basis.type!=='FOB')issues.push('أساس السعر '+basis.type+' وليس FOB');
 if(!basis.port)issues.push('ميناء FOB غير محدد');
 if(!['USD','CNY','EUR','YER'].includes(String(q.currency||'').toUpperCase()))issues.push('عملة العرض غير محددة');
 const items=(q.items||[]).map((item,i)=>{
  let local=[...issues],price=numeric(item.unitPrice),unit=unitName(item.unit),key=productKey(item);
  if(!key)local.push('مواصفة البند غير معروفة');
  if(!price)local.push('سعر الوحدة غير صالح');
  if(!unit)local.push('وحدة البيع غير معروفة');
  const quantity=numeric(item.quantity);
  if(!quantity)local.push('كمية المقارنة غير محددة أو لم توحد');
  const requiredFields=Array.isArray(q.missing)?q.missing:[];
  if(requiredFields.some(s=>/FOB|port|quotation|price/i.test(String(s))))local.push('نواقص تجارية أساسية مسجلة');
  return {index:i,quoteId:q.id,supplierId:q.supplierId,supplier:supplier.name||q.supplierId||'غير معروف',
    requestId:q.requestId,category:q.category||supplier.category||'غير مصنف',
    product:clean(item.description),key,price,quantity,unit,currency:String(q.currency||'').toUpperCase(),
    basis:basis.text,port:basis.port,moq:numeric(item.moq)||numeric(q.commercial?.moqQuantity)||null,
    issues:[...new Set(local)],status:local.length?'not-comparable':'eligible',
    evidenceClass:q.evidenceClass||'unverified',createdAt:q.createdAt||q.receivedAt||null,
    evidenceRef:clean(q.evidenceRef||q.documentUrl||'')||null,
    specs:clean(item.specifications||''),technical:q.technical||{}};
 });
 if(!items.length)issues.push('لا توجد بنود سعرية منظمة');
 const projectTechnical=request.id==='RFQ-001'&&['cold_room_manufacturer','complete_cold_room'].includes(q.category);
 if(projectTechnical){
  const required=['coolingLoadKw','storageTons','dailyLoadingTpd','pullDown','energyKwh24h'];
  const missing=required.filter(k=>q.technical?.[k]===undefined||q.technical?.[k]===null||q.technical?.[k]==='');
  if(missing.length)issues.push('بيانات غرف التبريد ناقصة: '+missing.join(', '));
  if(missing.length)for(const item of items){item.issues.push('القدرة والحمل اليومي والطاقة غير مكتملة');item.status='not-comparable'}
 }
 return {quoteId:q.id,supplier:supplier.name||q.supplierId||'غير معروف',supplierId:q.supplierId,
  requestId:q.requestId,basis:basis.text,currency:q.currency||null,
  verified:isVerified(q),category:q.category||supplier.category||null,
  issues:[...new Set([...issues,...items.flatMap(i=>i.issues)])],
  items,receivedAt:q.receivedAt||q.createdAt||null,
  evidenceRef:clean(q.evidenceRef||q.documentUrl||'')||null};
}
function priceAnalysis(st,{requestId=null}={}){
 const quotes=(st.quotes||[]).filter(q=>!requestId||q.requestId===requestId);
 const reviewed=quotes.map(q=>analyzeQuote(st,q));
 const groups=new Map();
 for(const q of reviewed){
  for(const item of q.items){
   if(item.status!=='eligible')continue;
   // Strict grouping by scope, exact product specification, unit, FOB port, currency and quantity.
   const scope=[item.requestId,item.category,item.key,item.specs?norm(item.specs):'',
    item.unit,item.currency,item.port,item.quantity,item.moq||'none'].join('|');
   if(!groups.has(scope))groups.set(scope,[]);
   groups.get(scope).push(item);
  }
 }
 const comparisons=[];
 for(const items of groups.values()){
  const bySupplier=new Map();
  for(const row of items){
   const prior=bySupplier.get(row.supplierId);
   if(!prior||new Date(row.createdAt||0)>new Date(prior.createdAt||0))bySupplier.set(row.supplierId,row);
  }
  if(bySupplier.size<2)continue;
  const rows=[...bySupplier.values()].sort((a,b)=>a.price-b.price);
  const low=rows[0].price,high=rows[rows.length-1].price,qty=rows[0].quantity;
  comparisons.push({requestId:rows[0].requestId,category:rows[0].category,product:rows[0].product,
   groupKey:rows[0].key,currency:rows[0].currency,unit:rows[0].unit,port:rows[0].port,
   quantity:qty,comparableSuppliers:rows.length,lowestPrice:low,highestPrice:high,
   spreadPerUnit:money(high-low),spreadForQuantity:money((high-low)*qty),
   lowestSupplier:rows[0].supplier,quoteIds:rows.map(x=>x.quoteId),
   rows:rows.map(x=>({supplier:x.supplier,quoteId:x.quoteId,unitPrice:x.price,
    total:money(x.price*qty),differenceFromLow:money((x.price-low)*qty)})),
   note:'فرق أسعار مرصود، وليس توفيرًا محققًا أو توصية شراء. يلزم فحص المصنع والجودة والضمان والمواصفات النهائية.'});
 }
 return {quotesReviewed:reviewed.length,verifiedQuotes:reviewed.filter(q=>q.verified).length,
  eligibleQuoteLines:reviewed.flatMap(q=>q.items).filter(x=>x.status==='eligible').length,
  excludedQuoteLines:reviewed.flatMap(q=>q.items).filter(x=>x.status!=='eligible').length,
  comparableGroups:comparisons.length,comparisons,
  quotes:reviewed,
  disclaimer:'لا تُقارن الأسعار بدون التحقق من المستند، أساس FOB ومينائه، العملة، وحدات البيع، الكمية، المواصفات والفئة. السعر المنشور على الإنترنت ليس عرضًا موثقًا.'};
}
function dailyReport(st,{requestId=null,date=null,audience='management'}={}){
 const dateLabel=day(date)||day(new Date().toISOString());
 const allRequests=(st.requests||[]).filter(x=>!requestId||x.id===requestId);
 const requestIds=new Set(allRequests.map(x=>x.id));
 const linkedSuppliers=new Set(allRequests.flatMap(r=>r.selectedSupplierIds||[]));
 const uniqueSuppliers=requestId?(st.suppliers||[]).filter(s=>linkedSuppliers.has(s.id)||s.associatedRequestId===requestId||
   (requestId==='RFQ-001'&&!s.associatedRequestId)):(st.suppliers||[]);
 const q=priceAnalysis(st,{requestId});
 const acts=(st.activity||[]).filter(a=>day(a.time||a.createdAt)===dateLabel&&
  (!requestId||String(a.text||'').includes(requestId)||a.requestId===requestId));
 const received=(st.gmailReplies||[]).filter(m=>day(m.receivedAt||m.time)===dateLabel &&
  (!requestId||m.requestId===requestId));
 const pending=(st.approvals||[]).filter(a=>a.status==='pending');
 const byRequest=allRequests.map(r=>{
  const quotes=q.quotes.filter(x=>x.requestId===r.id);
  return {id:r.id,title:r.title||r.product||r.id,product:r.product||'',status:r.status||'غير محدد',
   supplierCount:(st.suppliers||[]).filter(s=>(r.selectedSupplierIds||[]).includes(s.id)||
     s.associatedRequestId===r.id||(r.id==='RFQ-001'&&!s.associatedRequestId)).length,
   quotes:quotes.length,verifiedQuotes:quotes.filter(x=>x.verified).length,
   comparableGroups:q.comparisons.filter(x=>x.requestId===r.id).length};
 });
 const gaps=q.quotes.filter(x=>x.issues.length).slice(0,20).map(x=>({
  quoteId:x.quoteId,supplier:x.supplier,issues:x.issues
 }));
 const risks=[...new Set([
   ...(q.verifiedQuotes===0?['لا توجد عروض أسعار موثقة تتيح اتخاذ قرار سعر نهائي']:[]),
   ...(q.comparableGroups===0?['لا توجد حتى الآن مجموعتان من عروض FOB المتطابقة للمقارنة السعرية']:[]),
   ...(gaps.length?['عروض مستلمة تحتاج استكمال أو تسوية تجارية/فنية']:[]),
   ...(pending.length?['اعتمادات إدارية معلقة']:[])
 ])];
 const priorities=[
  ...(gaps.length?['طلب استكمال بيانات العروض الناقصة وتسوية EXW مقابل FOB']:[]),
  ...(q.comparableGroups===0?['استلام عرض ثانٍ مطابق في العملة والميناء والكمية والمواصفات']:[]),
  ...(pending.length?['مراجعة الموافقات المعلقة قبل أي مراسلة أو قرار شراء']:[]),
  ...(!allRequests.length?['إنشاء طلب شراء وتحديد المواصفات والكميات']:[])
 ];
 const publicBuyer=audience==='buyer';
 return {type:'ALHARIR_DAILY_PROCUREMENT_REPORT',date:dateLabel,generatedAt:new Date().toISOString(),
  audience:publicBuyer?'buyer':'management',requestId:requestId||null,
  company:'ALHARIR Shipping and Export',mode:process.env.STAGING_HOSTED==='true'?'synthetic-demo':'internal',
  kpis:{requests:allRequests.length,suppliers:uniqueSuppliers.length,
   quoteRecords:q.quotesReviewed,verifiedQuotes:q.verifiedQuotes,
   comparableGroups:q.comparableGroups,actionsToday:acts.length,repliesToday:received.length,
   pendingApprovals:publicBuyer?null:pending.length},
  requests:byRequest,priceComparisons:q.comparisons,
  quotationGaps:publicBuyer?gaps.map(x=>({quoteId:x.quoteId,issues:x.issues})):gaps,
  priorities,risks,
  activities:publicBuyer?[]:acts.slice(0,15).map(x=>({time:x.time,type:x.type,description:clean(x.text)})),
  evidence:{verifiedQuotes:q.verifiedQuotes,nonComparableLines:q.excludedQuoteLines},
  disclaimer:q.disclaimer,
  privacyNotice:'راجع المعلومات قبل مشاركتها؛ هذا التقرير ليس موافقة على الشراء ولا يتضمن البريد الشخصي للموردين.',
  delivery:'manual-share-only'};
}
module.exports={quoteBasis,analyzeQuote,priceAnalysis,dailyReport,unitName};
