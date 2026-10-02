const {getRequest}=require('./requirements');
const {generateRfq}=require('./rfq-generator');
function nextSupplierId(suppliers=[]){let n=Math.max(0,...suppliers.map(s=>Number(String(s.id||'').replace(/\D/g,''))||0));return 'S'+(n+1)}
function ensureSupplier(st,{email,name}){let normalized=String(email||'').trim().toLowerCase();if(!normalized||!normalized.includes('@'))throw Error('invalid_supplier_email');let supplier=st.suppliers.find(s=>String(s.email||'').toLowerCase()===normalized);let created=false;if(!supplier){supplier={id:nextSupplierId(st.suppliers),name:name||normalized.split('@')[0],email:normalized,status:'جديد',excluded:false,createdAt:new Date().toISOString()};st.suppliers.push(supplier);created=true}return {supplier,created}}
async function sendRfq({st,email,name,rfqId='RFQ-001',sendMail,language='english'}){
 const request=getRequest(st,rfqId);if(request&&request.status!=='معتمد')throw Error('rfq_not_approved');if(!request)throw Error('rfq_not_found');
 let {supplier,created}=ensureSupplier(st,{email,name});if(supplier.excluded)throw Error('supplier_excluded');
 const rfq=generateRfq(request,{language});
 let sent=await sendMail(supplier.email,rfq.subject,rfq.body);
 supplier.status='تم الإرسال';supplier.rfqId=rfqId;supplier.sentAt=new Date().toISOString();supplier.messageId=sent.id||null;supplier.threadId=sent.threadId||null;
 st.activity.unshift({id:Date.now()+Math.random(),time:new Date().toISOString(),type:'rfq_sent',text:'تم إرسال '+rfqId+' إلى '+supplier.name,supplierId:supplier.id,messageId:supplier.messageId});
 return {supplier,created,messageId:supplier.messageId,threadId:supplier.threadId,rfq:{id:rfqId,subject:rfq.subject,language:rfq.language}};
}
module.exports={ensureSupplier,sendRfq};
