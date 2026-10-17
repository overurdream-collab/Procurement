'use strict';
// Market Intelligence -> shortlist -> contact validation -> RFQ drafts.
// All output is escaped; no emails are sent through this script.
let marketLeadResult=null, marketLeadContacts={},lastCreatedRfqExport=null,lastMarketDiscovery=null;
function mEsc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function leadField(i,key){return document.getElementById('ml-'+key+'-'+i)}
function fieldVal(i,key){return leadField(i,key)?.value.trim()||''}

function manualMarketInput(){
 return '<div class="approval-details" style="display:block;margin-top:12px"><b>بديل مجاني: إضافة روابط الموردين التي وجدتها بنفسك</b>'+
 '<p class="muted">عندما لا يعمل محرك البحث الآلي، افتح روابط البحث اليدوي وانسخ روابط صفحات المنتجات أو الشركات. رابط واحد في كل سطر، حتى 12 رابطًا.</p>'+
 '<textarea id="marketManualUrls" class="ml-field" rows="3" placeholder="https://supplier.example/product-a\nhttps://other-supplier.example/product-b"></textarea>'+
 '<button type="button" class="btn primary" onclick="registerManualMarketLinks()">إضافة الروابط إلى قائمة الشركات المرشحة</button>'+
 '<div id="marketManualFeedback" aria-live="polite" class="muted"></div></div>';
}
async function registerManualMarketLinks(){
 const raw=document.getElementById('marketManualUrls')?.value||'';
 const urls=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const feedback=document.getElementById('marketManualFeedback'),
  query=document.getElementById('unifiedMarketQuery')?.value.trim()||'';
 if(!feedback)return;
 if(urls.length<1||urls.length>12){feedback.textContent='أدخل من رابط واحد إلى 12 رابطًا، كل واحد في سطر.';return}
 if(query.length<2){feedback.textContent='اكتب المنتج في خانة البحث الموحد أولًا.';return}
 feedback.textContent='جارٍ تجهيز قائمة الشركات من الروابط المدخلة...';
 try{
  const r=await fetch('/api/market-intelligence/manual-leads',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({query,urls})});
  const x=await r.json();if(!r.ok){feedback.textContent=x.message||x.error;return}
  lastMarketDiscovery=x;
  const results=document.getElementById('unifiedMarketResults');
  const status=document.getElementById('unifiedMarketStatus');
  status.textContent='تم إدراج '+x.count+' روابط أدخلتها بنفسك. لا توجد أسعار بحث آلي مؤكدة.';
  results.innerHTML=unifiedMarketResultsView(x)+marketLeadPanel(x);
 }catch(e){feedback.textContent='تعذر إدراج الروابط. تأكد من صحة الرابط.'}
}

function marketLeadPanel(data){
 marketLeadResult=data;marketLeadContacts={};

 if(!data.searchId||!data.results?.length)return '';
 const currentRequest=(st.requests||[]).find(r=>r.id===new URLSearchParams(location.search).get('requestId'))||null;
 const rows=data.results.map(x=>{
   const i=x.index;
   return '<div class="approval" style="margin:8px 0">'+
   '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="marketLeadChoice" value="'+i+'">'+
   '<b>'+mEsc(x.source)+' — '+mEsc(x.title)+'</b></label>'+
   '<p><a href="'+mEsc(x.url)+'" target="_blank" rel="noopener noreferrer">افتح صفحة المنتج لتحديد هوية الشركة ↗</a></p>'+
   '<p class="muted">قد تكون الصفحة إعلان منتج لا الموقع الرسمي للشركة.</p>'+
   '<input id="ml-name-'+i+'" maxlength="120" placeholder="اسم الشركة الفعلي من صفحة المورد" class="ml-field">'+
   '<button class="btn" style="margin:8px 0" type="button" onclick="researchLead('+i+')">البحث عن موقع الشركة وبريدها</button>'+
   '<div id="ml-feedback-'+i+'" class="muted" aria-live="polite"></div><div id="ml-suggestions-'+i+'"></div>'+
   '<input id="ml-email-'+i+'" type="email" placeholder="البريد التجاري بعد التحقق — اختياري" class="ml-field">'+
   '<input id="ml-site-'+i+'" type="url" placeholder="الموقع الرسمي — اختياري" class="ml-field">'+
   '<input id="ml-evidence-'+i+'" type="url" placeholder="رابط إثبات البريد — اختياري" class="ml-field">'+
   '</div>'
 }).join('');
 return '<div class="panel" style="margin-top:16px"><div class="ph"><h2>المرحلة ٢: اختيار الشركات وتجهيز RFQ</h2></div><div class="pb">'+
  '<div class="approval-details" style="display:block"><b>قائمة مستهدفة وليست قائمة إرسال</b>'+
  '<p class="muted">اختر الشركات التي تريد التعامل معها، وتحقق من اسم الشركة والموقع والبريد. لا يعتمد النظام البريد المستخرج تلقائيًا ولا يرسل رسائل جماعية.</p></div>'+
  '<div style="max-height:500px;overflow-y:auto">'+rows+'</div>'+
  '<h3>وجهة الموردين المختارين</h3>'+
  '<label class="ml-scope-label">أضف المرشحين إلى طلب موجود أو أنشئ مسودة RFQ مستقلة'+
   '<select id="ml-target-request" class="ml-field" onchange="marketTargetChanged()">'+
   '<option value="__new__">طلب جديد مستقل — دون إرسال</option>'+
   (st.requests||[]).map(r=>'<option value="'+mEsc(r.id)+'"'+
    ((new URLSearchParams(location.search).get('requestId')===r.id)?' selected':'')+'>'+
    mEsc(r.id)+' — '+mEsc(r.product||r.title||'')+'</option>').join('')+
   '</select></label>'+
  '<p class="muted" id="ml-target-note">لا تُرسل رسائل تلقائيًا. حدّد الطلب الصحيح قبل الحفظ.</p>'+
  '<h3>تفاصيل طلب عرض الأسعار</h3>'+
  '<input id="ml-product" class="ml-field" maxlength="160" value="'+mEsc(currentRequest?.product||data.query)+'" placeholder="المنتج">'+
  '<input id="ml-quantity" class="ml-field" maxlength="100" value="'+mEsc(currentRequest?.quantity||'')+'" placeholder="الكمية المطلوبة — إلزامية">'+
  '<textarea id="ml-specs" class="ml-field" rows="3" maxlength="1500" placeholder="المواصفات الفنية المطلوبة — إلزامية">'+mEsc(currentRequest?.specifications||'')+'</textarea>'+
  '<p class="muted">شروط العرض: FOB فقط. يجب مراجعة رسائل كل شركة قبل الإرسال.</p>'+
  '<button class="btn primary" id="ml-convert" onclick="convertMarketLeads()">إنشاء RFQ للموردين المختارين — دون إرسال</button>'+
  '<div id="ml-conversion-result" role="status" aria-live="polite" style="margin-top:14px"></div>'+
  '</div></div>';
}
function marketTargetChanged(){
 const id=document.getElementById('ml-target-request')?.value;
 const r=(st.requests||[]).find(x=>x.id===id);
 const note=document.getElementById('ml-target-note');
 if(!note)return;
 if(!r){note.textContent='سيُنشئ النظام مسودة RFQ جديدة مع الموردين المختارين دون إرسال.';return}
 document.getElementById('ml-product').value=r.product||r.title||'';
 document.getElementById('ml-quantity').value=r.quantity||'';
 document.getElementById('ml-specs').value=r.specifications||'';
 note.textContent='الموردون سيُضافون إلى '+r.id+' فقط، دون إنشاء أمر شراء مكرر أو إرسال مراسلات.';
}
async function researchLead(i){
 const panel=document.getElementById('ml-suggestions-'+i),status=document.getElementById('ml-feedback-'+i);
 const name=fieldVal(i,'name');
 if(name.length<3){status.textContent='راجع رابط المصدر ثم اكتب اسم الشركة، وليس اسم المنتج.';return}
 status.textContent='جارٍ البحث عن صفحات الشركة وبريدها العام...';panel.textContent='';
 try{
  const res=await fetch('/api/market-intelligence/contacts',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({searchId:marketLeadResult.searchId,index:i,companyName:name})});
  const data=await res.json();
  if(!res.ok){status.textContent=data.message||data.error;return}
  marketLeadContacts[i]=data;
  status.textContent=data.notice||'معلومات محتملة، تتطلب التحقق';
  let html='<div class="approval-details" style="display:block"><b>صفحات وبيانات اتصال عامة غير مؤكدة</b>';
  const c=data.contacts||[];
  html+=c.length?c.map((v,k)=>'<p><a href="'+mEsc(v.pageUrl)+'" target="_blank" rel="noopener noreferrer">'+mEsc(v.title)+'</a>'+
   (v.emails||[]).map((email,e)=>' <button type="button" class="btn" onclick="chooseLeadEmail('+i+','+k+','+e+')">اعتماد مقترح: '+mEsc(email)+'</button>').join('')+'</p>').join(''):
   '<p class="muted">لا توجد نتائج اتصال كافية من مزود البحث. يمكنك إضافة البريد يدويًا بعد التحقق.</p>';
  html+='<div class="actions">'+(data.manualLinks||[]).map(x=>
   '<a href="'+mEsc(x.url)+'" target="_blank" rel="noopener noreferrer" class="btn">'+mEsc(x.label)+'</a>').join('')+'</div></div>';
  panel.innerHTML=html;
 }catch(e){status.textContent='تعذر الاتصال بمحرك بيانات التواصل.'}
}
function chooseLeadEmail(i,k,e){
 const c=marketLeadContacts[i]?.contacts?.[k];const email=c?.emails?.[e];
 if(!c||!email)return;
 leadField(i,'email').value=email;
 leadField(i,'site').value=new URL(c.pageUrl).origin+'/';
 leadField(i,'evidence').value=c.pageUrl;
 document.getElementById('ml-feedback-'+i).textContent='تم اقتراح البريد. افتح صفحة الدليل وتأكد منه بنفسك قبل المراسلة.';
}
let reviewedDrafts=[];
function openReviewedDraft(index){
 const draft=reviewedDrafts[index];
 const box=document.getElementById('review-rfq-'+index);
 if(!draft||!draft.to||!box?.checked){alert('راجع النص وبريد المستلم وأكّد الموافقة قبل فتح الرسالة.');return;}
 // This opens the local mail client; the Procurement server NEVER sends messages.
 const uri='mailto:'+encodeURIComponent(draft.to)+'?subject='+encodeURIComponent(draft.subject)+'&body='+encodeURIComponent(draft.body);
 window.location.href=uri;
}
function marketDraftHtml(drafts){
 if(!drafts?.length)return '<p>لا توجد مسودات.</p>';
 reviewedDrafts=drafts;
 return '<div class="approval-details" style="display:block"><b>المسودات فقط — لم تُرسل أي رسالة.</b>'+
 '<p>لكل مورد: تحقق من البريد والمصدر، اقرأ النص الكامل ثم وافق صراحة. فتح برنامج البريد لا يعني الإرسال.</p></div>'+
 drafts.map((x,i)=>{
  return '<div class="approval"><b>'+mEsc(x.company)+'</b> — '+mEsc(x.to||'لا يوجد بريد')+
   '<p class="muted">هوية الشركة والبريد تحتاج تحققًا بشريًا من المصدر الرسمي.</p>'+
   '<p><b>الموضوع: </b>'+mEsc(x.subject)+'</p>'+
   '<details open><summary>النص الكامل — مطلوب مراجعته</summary><pre style="direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere">'+mEsc(x.body)+'</pre></details>'+
   (x.to?'<p><label><input id="review-rfq-'+i+'" type="checkbox"> أوافق صراحة على هذا النص وعنوان المستلم بعد التحقق منهما</label></p>'+
   '<button type="button" class="btn primary" onclick="openReviewedDraft('+i+')">فتح المسودة المعتمدة في برنامجي البريدي</button>':
     '<p class="muted">لا يمكن فتح رسالة للمورد دون عنوان بريد.</p>')+'</div>';
 }).join('');
}

function downloadMarketRFQ(){
 if(!lastCreatedRfqExport)return;
 const result=lastCreatedRfqExport;
 const snapshot={
  exportedAt:new Date().toISOString(),purpose:'ALHARIR RFQ draft backup, not a signed quotation',
  request:result.request,suppliers:result.suppliers,drafts:result.drafts,
  warning:'Contains unverified business contact information. No messages were sent. Protect this file.'
 };
 const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download='ALHARIR-'+String(result.request.id).replace(/[^a-zA-Z0-9-]/g,'')+'-RFQ-DRAFT.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}

async function convertMarketLeads(){
 const status=document.getElementById('ml-conversion-result'),btn=document.getElementById('ml-convert'),data=marketLeadResult;
 if(!status||!data?.searchId)return;
 const selected=[...document.querySelectorAll('input[name="marketLeadChoice"]:checked')].map(e=>{
  const i=Number(e.value);return {index:i,companyName:fieldVal(i,'name'),email:fieldVal(i,'email'),
   websiteUrl:fieldVal(i,'site'),contactEvidenceUrl:fieldVal(i,'evidence')};
 });
 if(selected.length===0){status.textContent='حدد موردًا واحدًا على الأقل.';return}
 if(selected.length>12){status.textContent='يمكن اختيار 12 موردًا في التجربة الواحدة.';return}
 if(selected.some(x=>x.companyName.length<3)){status.textContent='راجع اسم الشركة لكل مورد محدد.';return}
 const product=document.getElementById('ml-product').value.trim(),
 quantity=document.getElementById('ml-quantity').value.trim(),
 specifications=document.getElementById('ml-specs').value.trim();
 if(!product||!quantity||!specifications){status.textContent='المنتج والكمية والمواصفات إلزامية.';return}
 btn.disabled=true;status.textContent='جارٍ إنشاء مسودة RFQ دون إرسال بريد...';
 try{
  const targetId=document.getElementById('ml-target-request')?.value||'__new__';
  const existing=targetId!=='__new__';
  const endpoint=existing?'/api/requests/'+encodeURIComponent(targetId)+'/market-suppliers':'/api/market-intelligence/convert';
  const r=await fetch(endpoint,{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({
    searchId:data.searchId,selected,targetRequestId:existing?targetId:null,
    details:{product,quantity,specifications,incoterm:'FOB'}})});
  const x=await r.json();if(!r.ok){status.textContent=x.message||x.error;return}
  lastCreatedRfqExport=x;
  if(existing){
   const saved=(st.requests||[]).find(req=>req.id===targetId);
   if(saved)Object.assign(saved,x.request);
  }else st.requests.unshift(x.request);
  st.suppliers.push(...(x.suppliers||[]));
  selectedMarketRequestId=x.request.id;
  status.innerHTML='<div class="safe">'+
   (existing?'تمت إضافة '+(x.suppliers?.length||0)+' موردًا إلى الطلب '+mEsc(x.request.id):
     'تم إنشاء مسودة '+mEsc(x.request.id)+' مع '+(x.suppliers?.length||0)+' موردين')+
   ' — لم تُرسل أي رسائل.</div>'+
   (x.alreadyExists?.length?'<p class="muted">تجاوزنا '+x.alreadyExists.length+' موردين مكررين.</p>':'')+
   (x.persistence==='temporary-demo'?'<p class="muted">تنبيه: هذه نسخة اختبار وبياناتها مؤقتة على Render.</p>':'')+
   '<p><a href="/workspace.html?id='+encodeURIComponent(x.request.id)+'" class="btn primary">مساحة الطلب</a> '+
   '<a href="/?requestId='+encodeURIComponent(x.request.id)+'#quotes" class="btn">تحليل عروض الطلب</a></p>'+
   '<p><button class="btn" onclick="downloadMarketRFQ()">حفظ نسخة من الطلب والموردين والمسودات على جهازك</button></p>'+
   marketDraftHtml(x.drafts);
 }catch(e){status.textContent='تعذر الاتصال. تحقق من الطلبات قبل إعادة المحاولة.'}
 finally{btn.disabled=false}
}
async function viewSelectedRfqDrafts(){
 const id=activeMarketRequestId(),target=document.getElementById('marketExistingRfqDrafts');
 if(!target||!id)return;
 target.textContent='جارٍ تحميل مسودات الطلب...';
 const r=await fetch('/api/requests/'+encodeURIComponent(id)+'/outreach-drafts'),x=await r.json();
 target.innerHTML=r.ok?marketDraftHtml(x.drafts):'<p class="muted">تعذر عرض مسودات هذا الطلب.</p>';
}
