/* ALHARIR Request Workspace: request-scoped, evidence-based, no automatic correspondence */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.ALHARIRRequestUI=api;if(root.document)api.init();}})(typeof globalThis==='object'?globalThis:this,function(root){
'use strict';
const qs=(name)=>document.getElementById(name);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections={specifications:'المواصفات',analysisRules:'قواعد التحليل',commercialTerms:'الشروط التجارية',supplierStrategy:'استراتيجية الموردين',scenarios:'السيناريوهات',facts:'القرارات والحقائق',aiInstructions:'تعليمات الوكيل',changeHistory:'سجل التغييرات'};
const requestId=(query)=>new URLSearchParams(query||'').get('id')||'';
const route=(id,view)=>'/?requestId='+encodeURIComponent(id)+'#'+view;
function deriveOverview(st,id,analysis){
 const req=(st.requests||[]).find(x=>x.id===id);
 if(!req)return null;
 const supplierIds=new Set(req.selectedSupplierIds||[]);
 const suppliers=(st.suppliers||[]).filter(s=>supplierIds.has(s.id)||s.associatedRequestId===id);
 const unique=[...new Map(suppliers.map(s=>[s.id,s])).values()];
 const quotes=(st.quotes||[]).filter(q=>q.requestId===id);
 const verifiedQuoteIds=new Set((analysis?.quotes||[]).filter(q=>q.verified).map(q=>q.quoteId));
 const comparable=(analysis?.comparisons||[]).filter(x=>x.requestId===id);
 return {request:req,suppliers:unique,quotes,verified:quotes.filter(q=>verifiedQuoteIds.has(q.id)).length,comparable};
}
function overviewHtml(record){
 if(!record)return '<p class="muted">الطلب غير موجود.</p>';
 const r=record.request;
 const lines=[['عنوان الطلب',r.title],['المنتج',r.product],['الكمية',r.quantity],['العملة',r.currency],['أساس التسعير',r.incoterm],['الأسواق المستهدفة',r.targetMarkets],['التاريخ المطلوب',r.neededBy]];
 return lines.map(([label,value])=>'<div class="detail"><small>'+esc(label)+'</small><b>'+esc(value||'لم يحدد')+'</b></div>').join('')+
  '<div class="detail full"><small>المواصفات الفنية الأساسية</small><b>'+esc(r.specifications||'لم تُسجل المواصفات')+'</b></div>';
}
function supplierHtml(record){
 if(!record?.suppliers.length)return '<p class="empty">لا يوجد مورد مرتبط بهذا الطلب حتى الآن. استخدم «بحث عن موردين لهذا الطلب»، ثم اختر الشركات وأضفها إلى قائمته دون مراسلة تلقائية.</p>';
 return record.suppliers.map(s=>'<div class="supplier-row"><div><b>'+esc(s.name||'مورد غير مسمى')+'</b><small>'+esc(s.country||s.sourcePlatform||'المصدر غير محدد')+' · '+esc(s.contactStatus||s.status||'بانتظار التحقق')+'</small></div>'+
 (s.sourceUrl?'<a href="'+esc(s.sourceUrl)+'" rel="noopener noreferrer" target="_blank">مصدر الترشيح ↗</a>':'<span class="muted">المصدر غير مسجل</span>')+'</div>').join('');
}
function analysisHtml(record){
 if(!record)return '<p class="empty">البيانات غير متاحة.</p>';
 if(!record.comparable.length)return '<div class="empty"><b>لا توجد مقارنة متكافئة موثقة حتى الآن.</b><p>يجب إدخال عروض الموردين ومراجعتها، ثم مطابقة المواصفات والكمية والعملة ووحدة البيع وميناء FOB. نتائج الإنترنت ليست عروض شراء موثقة.</p></div>';
 return record.comparable.map(x=>'<div class="comparison-row"><div><b>'+esc(x.product||'بند')+'</b><small>FOB '+esc(x.port||'غير محدد')+' · '+esc(x.unit||'')+' · '+esc(x.quantity||'')+'</small></div><strong>'+esc(x.lowestPrice)+' '+esc(x.currency)+'</strong><span>أقل سعر مؤهل، وليس توفيرًا محققًا</span></div>').join('');
}
async function http(url,options){
 const r=await fetch(url,{cache:'no-store',...(options||{})});
 let data={};try{data=await r.json()}catch{}
 if(!r.ok)throw Error(data.message||data.error||'خطأ HTTP '+r.status);
 return data;
}
function updateNav(id){
 for(const [name,view] of [['sideSearch','market'],['sideQuotes','quotes'],['sideReport','reports'],['findSuppliers','market'],['analyzeQuotes','quotes'],['viewReport','reports']])qs(name).href=route(id,view);
}
function statBox(name,value){return '<div class="stat"><small>'+esc(name)+'</small><b>'+esc(value)+'</b></div>'}
function renderCounts(x){
 qs('requestStats').innerHTML=statBox('الموردون المستهدفون',x.suppliers.length)+statBox('عروض الأسعار',x.quotes.length)+statBox('العروض الموثقة',x.verified)+statBox('المقارنات المؤهلة',x.comparable.length);
}
function showWorkspace(data,active){
 qs('tabs').innerHTML=Object.entries(sections).map(([key,name])=>'<button type="button" class="tab '+(active===key?'active':'')+'" data-section="'+esc(key)+'">'+esc(name)+'</button>').join('');
 qs('sectionTitle').textContent=sections[active];
 const items=data.workspace[active]||[];
 qs('items').innerHTML=items.length?items.map(x=>'<article class="context-item"><p>'+esc(x.value||x.text||'')+'</p><small>'+esc(x.status||x.kind||'')+' · '+esc(x.source||'')+' · '+esc(x.updatedAt||x.time||'')+'</small></article>').join(''):'<p class="empty">لا توجد عناصر في هذا القسم بعد.</p>';
 qs('contextForm').hidden=active==='changeHistory';
 qs('chat').innerHTML=(data.workspace.chat||[]).map(x=>'<div class="chat-bubble '+(x.role==='user'?'user':'assistant')+'">'+esc(x.text)+'</div>').join('');
 qs('chat').scrollTop=qs('chat').scrollHeight;
}
function init(){
 const id=requestId(root.location?.search);
 if(!id){qs('workspaceMain').hidden=true;qs('title').textContent='اختر طلب مشتريات أولًا';qs('errorMessage').textContent='لم تحدد رقم الطلب. افتح قائمة الطلبات ثم اختر مساحة الطلب المطلوبة.';qs('errorMessage').hidden=false;return;}
 updateNav(id);
 let data=null,active='specifications';
 const render=()=>{if(data)showWorkspace(data,active);};
 async function loadAll(){
  qs('errorMessage').hidden=true;
  try{
   const workspace=await http('/api/requests/'+encodeURIComponent(id)+'/workspace');
   data=workspace;
   qs('title').textContent=workspace.request.id+' — '+(workspace.request.title||workspace.request.product||'طلب مشتريات');
   qs('sub').textContent=workspace.request.product||'متابعة الطلب وتقييم الموردين والعروض';
   qs('requestStatus').textContent=workspace.request.status||'قيد المتابعة';
   qs('requestMeta').textContent=(workspace.request.quantity||'الكمية غير محددة')+' · '+(workspace.request.incoterm||'الأساس غير محدد')+
     ' · '+(workspace.request.currency||'');
   render();
   const [st,a]=await Promise.all([
    http('/api/state'),http('/api/price-comparison?requestId='+encodeURIComponent(id))
   ]);
   const record=deriveOverview(st,id,a);
   if(record){
    renderCounts(record);
    qs('requestDetails').innerHTML=overviewHtml(record);
    qs('requestSuppliers').innerHTML=supplierHtml(record);
    qs('requestAnalysis').innerHTML=analysisHtml(record);
   }
  }catch(e){qs('errorMessage').textContent='تعذر تحميل بيانات الطلب: '+e.message;qs('errorMessage').hidden=false;}
 }
 async function loadMail(){
  const box=qs('requestMailList');box.textContent='جارٍ تحميل مراسلات الطلب...';
  try{const result=await http('/api/requests/'+encodeURIComponent(id)+'/correspondence');
   box.innerHTML=result.records?.length?result.records.map(m=>root.ALHARIRMailUI.messageHtml(m,{disabled:result.integrationAvailable===false})).join(''):'<p class="empty">لا توجد رسائل مرتبطة بهذا الطلب حتى الآن.</p>';
   if(result.unassigned>0){const p=document.createElement('p');p.className='hint';p.textContent='هناك '+result.unassigned+' رسالة غير مرتبطة بطلب؛ تُراجع من صفحة البريد دون نسبتها تلقائيًا لهذا الطلب.';box.append(p)}
   if(result.notice){const p=document.createElement('p');p.className='hint';p.textContent=result.notice;box.append(p)}
  }catch(e){box.textContent='تعذر تحميل سجل البريد: '+e.message;}
 }
 qs('tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-section]');if(!b)return;active=b.dataset.section;render();});
 qs('contextForm').addEventListener('submit',async e=>{
  e.preventDefault();const value=qs('value').value.trim(),feedback=qs('contextFeedback');
  if(!value){feedback.textContent='أدخل النص أولًا.';return}
  qs('add').disabled=true;feedback.textContent='جارٍ الحفظ...';
  try{const x=await http('/api/requests/'+encodeURIComponent(id)+'/workspace',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:active,value,status:qs('status').value,source:'Manual UI'})});
   data.workspace=x.workspace;qs('value').value='';render();feedback.textContent='حُفظت المعلومة في هذا الطلب.';}
  catch(err){feedback.textContent=err.message}finally{qs('add').disabled=false}
 });
 qs('assistantForm').addEventListener('submit',async e=>{
  e.preventDefault();const message=qs('message').value.trim(),feedback=qs('assistantFeedback');
  if(!message)return;
  if(/(?:أضف|اضف|سجل|احفظ|add|save)/i.test(message)&&!confirm('قد يغيّر هذا الأمر سجل مساحة الطلب. هل راجعته وتوافق على تنفيذه؟'))return;
  qs('send').disabled=true;feedback.textContent='جارٍ تنفيذ الطلب...';
  try{const x=await http('/api/requests/'+encodeURIComponent(id)+'/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});
   qs('message').value='';data.workspace=x.workspace;render();feedback.textContent=x.intent==='act'?'تم حفظ التحديث في السجل.':'تمت الإجابة من السجلات المتاحة.';}
  catch(err){feedback.textContent=err.message}finally{qs('send').disabled=false}
 });
 qs('refreshOverview').addEventListener('click',()=>Promise.all([loadAll(),loadMail()]));
 qs('refreshMail').addEventListener('click',loadMail);
 const toggle=open=>{document.body.classList.toggle('nav-open',open);qs('mobileNav').setAttribute('aria-expanded',String(open))};
 qs('mobileNav').addEventListener('click',()=>toggle(!document.body.classList.contains('nav-open')));
 qs('navBackdrop').addEventListener('click',()=>toggle(false));
 Promise.all([loadAll(),loadMail()]);
}
return {init,deriveOverview,overviewHtml,supplierHtml,analysisHtml,requestId,route};
});