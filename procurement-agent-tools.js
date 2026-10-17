'use strict';
// ALHARIR agent-tool preview — deterministic, read-only, no LLM/network/mail/DB writes.
const {analyzeRequest}=require('./request-intelligence');
const {priceAnalysis,dailyReport}=require('./procurement-reports');
const {manualSearchLinks}=require('./market-unified');
const {outreachDrafts}=require('./market-leads');
const CATALOG=Object.freeze([
 {name:'read_request',risk:'read'},
 {name:'analyze_specifications',risk:'read'},
 {name:'plan_supplier_search',risk:'read'},
 {name:'list_request_suppliers',risk:'read'},
 {name:'compare_verified_quotes',risk:'read'},
 {name:'prepare_rfq_drafts',risk:'preview'},
 {name:'read_request_report',risk:'read'}
]);
const PLANS=Object.freeze({
 overview:['read_request','analyze_specifications','list_request_suppliers','compare_verified_quotes'],
 sourcing:['read_request','analyze_specifications','plan_supplier_search','list_request_suppliers','prepare_rfq_drafts'],
 quotations:['read_request','compare_verified_quotes','read_request_report'],
 full_review:['read_request','analyze_specifications','plan_supplier_search','list_request_suppliers','compare_verified_quotes','prepare_rfq_drafts','read_request_report']
});
class AgentPreviewError extends Error{
 constructor(code,status=422){super(code);this.code=code;this.status=status;}
}
const cut=(v,n=180)=>String(v??'').slice(0,n);
function contextFor(state,requestId){
 if(typeof requestId!=='string'||requestId.length>100||!requestId.trim())throw new AgentPreviewError('invalid_request_id');
 const request=(state?.requests||[]).find(x=>x.id===requestId);
 if(!request)throw new AgentPreviewError('request_not_found',404);
 const selected=new Set(request.selectedSupplierIds||[]);
 const suppliers=(state.suppliers||[]).filter(s=>selected.has(s.id)||s.associatedRequestId===requestId);
 return {state,request,suppliers:[...new Map(suppliers.map(s=>[s.id,s])).values()].slice(0,12)};
}
function callTool(name,ctx){
 const {state,request,suppliers}=ctx;
 switch(name){
 case 'read_request':
  return {id:request.id,title:cut(request.title),product:cut(request.product),
   quantity:cut(request.quantity,100),incoterm:request.incoterm||null,currency:request.currency||null,
   status:cut(request.status,90),specifications:cut(request.specifications,2000),linkedSupplierCount:suppliers.length};
 case 'analyze_specifications':return analyzeRequest(request);
 case 'plan_supplier_search':{
  const a=analyzeRequest(request);
  return {canSearch:a.canSearch,productType:a.productType,searchQuery:a.searchQuery,
   requiredSupplierCategories:a.supplierCategories,missingTechnical:a.missingTechnical,
   liveSearchPerformed:false,externalCalls:0,
   manualLinks:a.canSearch?manualSearchLinks(a.searchQuery):[],
   notice:'Suggested links only: not verified factories, emails, prices or real search results.'};
 }
 case 'list_request_suppliers':
  return {count:suppliers.length,entries:suppliers.map(s=>({id:cut(s.id,100),name:cut(s.name),
   category:cut(s.category,90),sourceUrl:cut(s.sourceUrl||s.website,450),
   contactStatus:cut(s.contactStatus||'not_verified',80),
   hasEmail:Boolean(s.email),verifiedFactory:false}))};
 case 'compare_verified_quotes':{
  const a=priceAnalysis(state,{requestId:request.id});
  return {quotesReviewed:a.quotesReviewed,verifiedQuotes:a.verifiedQuotes,comparableGroups:a.comparableGroups,
   excludedQuoteLines:a.excludedQuoteLines,comparisons:a.comparisons.slice(0,8),
   gaps:a.quotes.filter(x=>x.issues.length).slice(0,12).map(x=>({quoteId:x.quoteId,issues:x.issues})),
   disclaimer:a.disclaimer};
 }
 case 'prepare_rfq_drafts':
  return {count:suppliers.length,sent:0,requiresExplicitApproval:true,
   drafts:outreachDrafts(request,suppliers).map(x=>({
    supplierId:x.supplierId,company:x.company,to:x.to,subject:x.subject,body:x.body,
    requiresReview:true,contactStatus:x.emailStatus,sourceUrl:x.sourceUrl,
    canOpenEmail:false,verifiedContact:false})),
   notice:'Draft preview only. No mail sending, no approval persisted.'};
 case 'read_request_report':{
  const r=dailyReport(state,{requestId:request.id,audience:'management'});
  return {scope:request.id,priorities:(r.priorities||[]).slice(0,12),
    risks:(r.risks||[]).slice(0,12),
    source:'existing procurement-reports.js: no fabricated financial figures'};
 }
 default:throw new AgentPreviewError('tool_not_allowed',403);
 }
}
function previewWorkflow(state,{requestId,task='overview'}={}){
 if(typeof task!=='string'||!Object.hasOwn(PLANS,task))throw new AgentPreviewError('invalid_preview_plan');
 const ctx=contextFor(state,requestId),trace=[],outputs={};
 for(const name of PLANS[task]){
  const t=process.hrtime.bigint();
  try{
   outputs[name]=callTool(name,ctx);
   trace.push({tool:name,status:'completed',elapsedMs:Number((process.hrtime.bigint()-t)/1000000n),effect:'read_only'});
  }catch{throw new AgentPreviewError('tool_preview_failed',500);}
 }
 return {mode:'deterministic_tool_preview',modelConnected:false,requestId:ctx.request.id,
  plan:task,toolsRun:trace.length,trace,outputs,
  approvals:{sendAllowed:false,approvalGranted:false},
  effects:{mailSent:0,databaseWrites:0,externalSearchCalls:0},
  disclaimer:'Scripted tool preview, NOT a model-driven AI agent. Human supplier verification is mandatory.'};
}
module.exports={CATALOG,PLANS,AgentPreviewError,contextFor,callTool,previewWorkflow};
