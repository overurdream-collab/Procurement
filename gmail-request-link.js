'use strict';
// Deterministic email-to-request linking. Never assign every reply to RFQ-001.
function referencedRequestIds(requests,subject='',body=''){
 const items=(requests||[]).filter(r=>typeof r.id==='string'&&r.id);
 const text=String(subject||'')+'\n'+String(body||'');
 return items.filter(r=>{
   const escaped=r.id.replace(/[^A-Za-z0-9_-]/g,'\\$&');
   return new RegExp('(^|[^\\p{L}\\p{N}-])'+escaped+'(?=$|[^\\p{L}\\p{N}-])','iu').test(text);
 }).map(r=>r.id);
}
function matchRequestForEmail(state,message){
 const requests=state?.requests||[];
 const bySubject=referencedRequestIds(requests,message?.subject||'','');
 if(bySubject.length===1)return {requestId:bySubject[0],method:'explicit-subject'};
 if(bySubject.length>1)return {requestId:null,method:'ambiguous-subject'};
 const byBody=referencedRequestIds(requests,'',message?.body||'');
 if(byBody.length===1)return {requestId:byBody[0],method:'explicit-body'};
 if(byBody.length>1)return {requestId:null,method:'ambiguous-body'};
 const s=(state?.suppliers||[]).find(x=>x.id===message?.supplierId);
 if(!s)return {requestId:null,method:'unassigned'};
 const linked=requests.filter(r=>r.id===s.associatedRequestId||
   Array.isArray(r.selectedSupplierIds)&&r.selectedSupplierIds.includes(s.id));
 if(linked.length===1)return {requestId:linked[0].id,method:'linked-supplier'};
 return {requestId:null,method:'needs-human-review'};
}
module.exports={referencedRequestIds,matchRequestForEmail};
