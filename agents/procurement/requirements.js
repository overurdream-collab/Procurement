const COMPANY={name:'Alharir shipping and export',locations:["Guangzhou, People's Republic of China","Sana'a, Republic of Yemen"],email:'Alharirexport@gmail.com'};
function requiredQuoteFields(r={}){return [...Object.entries(r.technical_requirements||{}),...Object.entries(r.commercial_requirements||{})].filter(([,v])=>v===true).map(([k])=>k)}
function getRequest(st,id){return (st.requests||[]).find(r=>r.id===id)||null}
function nextRequestId(requests=[]){let n=Math.max(1,...requests.map(r=>Number(String(r.id||'').replace(/\D/g,''))||0));return 'RFQ-'+String(n+1).padStart(3,'0')}
function list(v){if(Array.isArray(v))return v.filter(Boolean);return String(v||'').split(/[,،\n]/).map(x=>x.trim()).filter(Boolean)}
function configurations(v=[]){if(Array.isArray(v))return v;return []}
function createRequest(st,input={}){
 const id=input.id||nextRequestId(st.requests||[]);
 const r={id,title:input.title||'طلب شراء جديد',status:'مسودة',source_text:input.source_text||'',category:input.category||'',application:input.application||'',location:input.location||'',quantity:input.quantity||null,temperature:input.temperature||{},max_storage_tons:input.max_storage_tons||null,configurations:configurations(input.configurations),scope:list(input.scope),technical_requirements:input.technical_requirements||{},commercial_requirements:input.commercial_requirements||{},preferences:input.preferences||{},attachments:input.attachments||[],company:COMPANY,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 st.requests.unshift(r);return r
}
function updateRequest(st,id,patch={}){let r=getRequest(st,id);if(!r)throw Error('rfq_not_found');for(const k of ['title','source_text','category','application','location','quantity','temperature','max_storage_tons','configurations','scope','technical_requirements','commercial_requirements','preferences','attachments','status'])if(patch[k]!==undefined)r[k]=patch[k];r.updatedAt=new Date().toISOString();return r}
function approveRequest(st,id){let r=getRequest(st,id);if(!r)throw Error('rfq_not_found');r.status='معتمد';r.approvedAt=new Date().toISOString();r.updatedAt=r.approvedAt;return r}
module.exports={COMPANY,getRequest,requiredQuoteFields,createRequest,updateRequest,approveRequest,nextRequestId};
