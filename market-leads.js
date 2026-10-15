'use strict';
const crypto=require('node:crypto');
const {configuredProvider,searchIndexedWeb}=require('./market-index-search');
const {sourceMatchesDomain}=require('./market-price-core');
const {validateSearchInput}=require('./market-unified');
const sessions=new Map();
const TTL=30*60*1000,MAX_SESSIONS=25;
function clean(value,max=180){return String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function publicUrl(s){
 try{const u=new URL(String(s||''));if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;
  if(['localhost','127.0.0.1','::1'].includes(u.hostname)||/^(?:10|192\.168)\.\d+\./.test(u.hostname)||u.hostname.endsWith('.local'))return null;
  return u.toString();
 }catch{return null}
}
function validEmail(input){
 const s=clean(input,150).toLowerCase();
 return /^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)?s:null;
}
function registerSearch(results,query){
 const now=Date.now();
 for(const [k,v] of sessions)if(now-v.createdAt>TTL)sessions.delete(k);
 while(sessions.size>=MAX_SESSIONS)sessions.delete(sessions.keys().next().value);
 const id=crypto.randomUUID();
 const entries=(results||[]).filter(x=>publicUrl(x.url)).slice(0,30).map((x,i)=>({
  index:i,title:clean(x.title,250),source:clean(x.source,70),
  snippet:clean(x.snippet,420),url:publicUrl(x.url),matching:x.matching||'not-verified'
 }));
 sessions.set(id,{createdAt:now,query:clean(query,160),entries});
 return {searchId:id,results:entries};
}
function lookup(searchId){
 const x=sessions.get(String(searchId||''));if(!x||Date.now()-x.createdAt>TTL){sessions.delete(String(searchId||''));return null}
 return x;
}
function candidateLinks(companyName){
 return [{label:'البحث عن الموقع الرسمي',url:'https://www.google.com/search?q='+encodeURIComponent(companyName+' official company website')},
 {label:'البحث عن البريد التجاري',url:'https://www.google.com/search?q='+encodeURIComponent(companyName+' sales contact email')}];
}
const MARKETPLACES=/\b(?:alibaba|1688|taobao|made-in-china|globalsources|google|bing)\./i;
function extractIndexedEmails(s){
 const found=String(s||'').match(/[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9.-]+\.[a-z]{2,15}/ig)||[];
 return [...new Set(found.map(validEmail).filter(Boolean))].slice(0,8);
}
async function researchContact({searchId,index,companyName},opts={}){
 const session=lookup(searchId),item=session?.entries.find(e=>e.index===index);
 if(!item)return {ok:false,status:404,error:'search_session_expired'};
 const name=clean(companyName,120);
 if(name.length<3)return {ok:false,status:422,error:'company_name_required',message:'أدخل اسم الشركة كما يظهر في صفحة المورد أولاً.'};
 const env=opts.env||process.env,provider=configuredProvider(env);
 const manualLinks=candidateLinks(name);
 if(provider==='none')return {ok:true,status:200,companyName:name,provider,officialVerified:false,contacts:[],manualLinks,
  notice:'لا يوجد محرك بحث خارجي مفعّل. تحقق يدويًا من الموقع والبريد التجاري.'};
 try{
  const search=await (opts.searchIndexedWeb||searchIndexedWeb)(name+' official website contact sales email',{env,limit:8});
  const contacts=(search.items||[]).map(x=>{
    const url=publicUrl(x.url);if(!url)return null;
    const host=new URL(url).hostname.toLowerCase();
    // Ignore listing pages when looking for an official company contact website.
    if(MARKETPLACES.test(host))return null;
    const content=clean((x.title||'')+' '+(x.snippet||''),700);
    const nameTokens=name.toLowerCase().match(/[a-z]{4,}|[\u3400-\u9fff]{2,}/g)||[];
    const overlap=nameTokens.filter(tok=>content.toLowerCase().includes(tok)).length;
    if(nameTokens.length&&overlap===0)return null;
    return {title:clean(x.title,150),pageUrl:url,emails:extractIndexedEmails(content),
      evidence:'public-search-index-unverified',verified:false};
  }).filter(Boolean).slice(0,8);
  return {ok:true,status:200,companyName:name,provider,officialVerified:false,contacts,manualLinks,
   notice:'هذه صفحات وبريد محتمل من نتائج مفهرسة، وليست معلومات شركة مؤكدة. افتح الصفحات وتحقق يدويًا.'};
 }catch(e){return {ok:true,status:200,companyName:name,provider,officialVerified:false,contacts:[],manualLinks,
   errors:[clean(e.message,130)],notice:'تعذر استرجاع بيانات الاتصال آليًا. يمكن استخدام البحث اليدوي.'}}
}
function prepareConversion(payload){
 const session=lookup(payload?.searchId);
 if(!session)return {ok:false,status:409,error:'search_session_expired',message:'انتهت جلسة البحث. أعد البحث ثم اختر الموردين.'};
 const selected=Array.isArray(payload?.selected)?payload.selected:[];
 if(selected.length<1||selected.length>12)return {ok:false,status:422,error:'select_1_to_12_companies'};
 const details=payload.details||{},product=validateSearchInput(details.product||session.query),quantity=clean(details.quantity,100),specifications=clean(details.specifications,1500);
 if(!product||!quantity||!specifications)return {ok:false,status:422,error:'product_quantity_specifications_required',message:'أدخل المنتج والكمية والمواصفات قبل إنشاء RFQ.'};
 if(details.incoterm&&details.incoterm!=='FOB')return {ok:false,status:422,error:'only_FOB_supported'};
 const normalized=[],seen=new Set();
 for(const s of selected){
  const item=session.entries.find(x=>x.index===s.index);
  if(!item)return {ok:false,status:422,error:'invalid_selected_result'};
  const name=clean(s.companyName,120);
  if(name.length<3)return {ok:false,status:422,error:'company_name_required',message:'حدد اسم الشركة لكل مورد مختار، لا تستخدم عنوان المنتج.'};
  const k=name.toLowerCase();if(seen.has(k))continue;seen.add(k);
  const email=clean(s.email,150)?validEmail(s.email):null;
  if(s.email&&!email)return {ok:false,status:422,error:'invalid_contact_email'};
  const website=publicUrl(s.websiteUrl),contactEvidence=publicUrl(s.contactEvidenceUrl);
  normalized.push({name,email,website,contactEvidence,
   sourceUrl:item.url,sourcePlatform:item.source,sourceTitle:item.title,
   contactStatus:email?'needs_human_verification':'missing_email'});
 }
 if(!normalized.length)return {ok:false,status:422,error:'no_unique_suppliers'};
 const id='REQ-'+Date.now()+'-'+crypto.randomBytes(2).toString('hex');
 const request={id,title:'RFQ — '+product,product,quantity,specifications,
  currency:'USD',incoterm:'FOB',deliveryCountry:'',targetMarkets:'China / International',
  neededBy:clean(details.neededBy,90),notes:clean(details.notes,600),createdAt:new Date().toISOString(),
  status:'مسودة RFQ — لم تُرسل',sourceSearchId:String(payload.searchId),
  selectedSupplierIds:[],outreachStatus:'draft_review_required'};
 const suppliers=normalized.map((x,i)=>({
  id:'LEAD-'+Date.now()+'-'+i+'-'+crypto.randomBytes(2).toString('hex'),name:x.name,email:x.email,
  website:x.website,sourceUrl:x.sourceUrl,sourcePlatform:x.sourcePlatform,sourceTitle:x.sourceTitle,
  contactEvidenceUrl:x.contactEvidence,status:'مرشح — يحتاج تدقيق بيانات التواصل',source:'market_intelligence_selected',
  excluded:false,category:'unclassified',contactStatus:x.contactStatus,associatedRequestId:id
 }));
 request.selectedSupplierIds=suppliers.map(x=>x.id);
 return {ok:true,status:201,request,suppliers};
}
function outreachDrafts(req,suppliers){
 return suppliers.map(s=>{
   const subject='RFQ - '+req.product+' - ALHARIR';
   const text=['Dear '+s.name+',','','We are ALHARIR Shipping and Export, Guangzhou PRC / Sana’a ROY.',
    'Please provide your technical and commercial quotation for the following:',
    'Product: '+req.product,'Specifications: '+req.specifications,'Quantity: '+req.quantity,
    'Quotation basis: FOB only (please specify port).',
    'Please confirm the precise brand/model, technical datasheets, MOQ, lead time, packaging, warranty, spare parts and payment terms.',
    'Kindly state the quotation validity and any minimum-order conditions.',
    req.neededBy?'Required date: '+req.neededBy:'',
    req.notes?'Additional instructions: '+req.notes:'',
    'Please respond by email with your formal quotation.','','Best regards,','ALHARIR Shipping and Export','Alharirexport@gmail.com'
   ].filter(x=>x!==null).join('\n');
   return {supplierId:s.id,company:s.name,to:s.email||null,subject,body:text,canOpenEmail:!!s.email,
    requiresReview:true,emailStatus:s.contactStatus,sourceUrl:s.sourceUrl,contactEvidenceUrl:s.contactEvidenceUrl};
 });
}
module.exports={registerSearch,lookup,researchContact,prepareConversion,outreachDrafts,validEmail,publicUrl};
