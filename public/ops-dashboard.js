'use strict';
let dailySnapshot=null,comparisonSnapshot=null,dailyAudience='management';


function agentStatusView(){
 const demo=/DEMO/i.test(st.project?.name||'');
 const settings=Object.entries(st.settings||{}).map(([k,v])=>
 '<div class="log"><b>'+dEsc(k)+'</b> : '+(v?'مفعّل':'معطّل')+'</div>').join('');
 return '<section class="page-intro"><h2>الوكيل والسياسات</h2>'+
  '<p>أعمال التحليل والمسودات تخضع لمراجعة بشرية. لا توجد رسائل جماعية تلقائية.</p></section>'+
  '<div class="data-warning">'+(demo?'الوضع التجريبي: ربط البريد والإرسال متوقفان، ويمكن مراجعة المسودات فقط.':
  'يحتاج ربط البريد وصلاحيات اعتماد منفصلة قبل الإرسال.')+'</div>'+
  '<p><a class="btn primary" href="/workspace.html?id='+encodeURIComponent(activeMarketRequestId())+
  '">فتح مساعد مساحة الطلب</a></p>'+
  '<section class="panel"><div class="ph"><h2>إعدادات الأمان الحالية (للقراءة)</h2></div>'+
  '<div class="pb">'+settings+'</div></section>';
}
function gmailStatusView(){
 const demo=/DEMO/i.test(st.project?.name||'');
 const count=(st.gmailReplies||[]).length;
 return '<section class="page-intro"><h2>البريد ومراسلات الموردين</h2>'+
 '<p>المراسلات المرتبطة بالطلبات، حالة الاتصال ومصادر العروض المستلمة.</p></section>'+
 '<div class="data-warning"><b>'+(demo?'غير متاح على استضافة التجربة':'يتطلب التحقق من اتصال Gmail')+
 '</b><p>لا يمكن مزامنة البريد أو إرسال الرسائل من هذه النسخة التجريبية. استخدم قائمة ردود الموردين والمسودات للمراجعة.</p></div>'+
 '<div class="mini-stats">'+statCard('الردود المحفوظة',count)+statCard('ربط Gmail',demo?'معطل':'يحتاج تحقق')+'</div>'+
 '<p><button class="btn" onclick="show(\'responses\')">فتح ردود الموردين</button> '+
 '<button class="btn" onclick="show(\'market\')">فتح مسودات RFQ</button></p>';
}

function diagnosticsShell(){
 return '<details class="service-status no-print"><summary>حالة الخدمات والتكاملات — ما يعمل وما يحتاج إعدادًا</summary>'+
  '<div id="serviceStatusTable" class="muted">جارٍ فحص حالة الخدمات...</div></details>';
}
async function loadDiagnostics(){
 const container=document.getElementById('serviceStatusTable');if(!container)return;
 try{
  const r=await fetch('/api/system-status'),x=await r.json();
  if(!r.ok){container.textContent='تعذر جلب حالة الخدمات';return}
  container.innerHTML='<div class="status-grid">'+(x.services||[]).map(s=>{
    const ready=s.status==='available',kind=ready?'service-good':'service-limited';
    const label=ready?'جاهز':s.status==='configured'?'مفعّل — يحتاج اختبار حقيقي':
      s.status==='temporary-demo'?'مؤقت':s.status==='not-integrated'?'غير متكامل':
      s.status==='disabled-in-demo'?'معطّل للتجربة':'يحتاج إعدادًا';
    return '<div class="service-card '+kind+'"><b>'+dEsc(s.name)+'</b>'+
      '<span>'+dEsc(label)+'</span><small>'+dEsc(s.detail||'')+'</small></div>';
   }).join('')+'</div>';
 }catch(e){container.textContent='الخدمة لا تستجيب حاليًا'}
}

const dEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const dAmount=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{maximumFractionDigits:2}):'—';
const statCard=(label,value,caption='')=>'<div class="mini-stat"><span>'+dEsc(label)+'</span><strong>'+dEsc(value)+'</strong><small>'+dEsc(caption)+'</small></div>';
function reportOptions(){
 return '<option value="">جميع الطلبات</option>'+(st.requests||[]).map(x=>
   '<option value="'+dEsc(x.id)+'">'+dEsc(x.title||x.product||x.id)+' — '+dEsc(x.id)+'</option>').join('');
}
function dailyView(){
 return '<div class="reports-page"><section class="page-intro"><div><span class="eyebrow">ALHARIR REPORTS</span>'+
  '<h2>مركز التقارير التنفيذية</h2><p>تقارير الإدارة والمشتري، اليومية والشهرية، بملفات للمشاركة وملخص WeChat.</p></div></section>'+
  '<div class="report-toolbar no-print">'+
  '<label>النطاق <select id="dailyScope" onchange="loadDailyReport()">'+reportOptions()+'</select></label>'+
  '<label>نوع التقرير <select id="dailyAudience" onchange="loadDailyReport()"><option value="management">للإدارة — داخلي</option><option value="buyer">للمشتري — دون التفاصيل الداخلية</option></select></label>'+
   '<label>الفترة <select id="reportPeriod" onchange="updateReportPeriod()"><option value="daily">يومي</option><option value="monthly">شهري</option></select></label>'+
   '<label id="dailyDateLabel">تاريخ التقرير <input type="date" id="dailyDate" onchange="loadDailyReport()"></label>'+
   '<label id="monthlyDateLabel" style="display:none">شهر التقرير <input type="month" id="monthlyDate" onchange="loadDailyReport()"></label>'+
  '<button class="btn primary" onclick="loadDailyReport()">تحديث الآن</button>'+
  '<button class="btn" onclick="downloadDailyHtml()">تنزيل تقرير HTML</button>'+
  '<button class="btn" onclick="printDailyReport()">طباعة / PDF</button>'+
  '<button class="btn" onclick="shareDailyReport()">مشاركة الملف / WeChat</button>'+
  '<button class="btn" onclick="copyWeChatDailyText()">نسخ ملخص WeChat</button></div>'+
  '<div id="dailyReportOutput" aria-live="polite"><p class="muted">جارٍ تحميل نتائج اليوم...</p></div>'+diagnosticsShell()+'</div>';
}
function comparisonView(){
 return '<section class="page-intro"><div><span class="eyebrow">EVIDENCE BASED BID LEVELING</span>'+
   '<h2>تحليل الطلبات ومقارنة العروض</h2><p>اختر أمر الشراء لمراجعة عروض مورديه. لا نقارن الأسعار غير الموثقة أو المختلفة في شروط FOB والمواصفات والوحدات.</p></div></section>'+
   '<div class="report-toolbar no-print"><label>طلب الشراء <select id="comparisonScope" onchange="loadComparisons()">'+reportOptions()+'</select></label>'+
   '<button class="btn primary" onclick="loadComparisons()">تحديث المقارنة</button>'+
   '<button class="btn" onclick="document.getElementById(\'quoteEntryForm\').hidden=!document.getElementById(\'quoteEntryForm\').hidden">إضافة عرض أسعار مستلم</button></div>'+
   '<div id="comparisonOutput" aria-live="polite"><p class="muted">جارٍ تحليل العروض المسجلة...</p></div>'+
   quoteEntryForm();
}
function quoteEntryForm(){
 const supplierOptions='<option value="">اختر المورد المرتبط بالطلب</option>';
 return '<section class="panel no-print" id="quoteEntryForm" hidden><div class="ph"><h2>إدخال عرض سعر مستلم — مراجعة المستند إلزامية</h2></div>'+
 '<div class="pb"><div class="approval-details" style="display:block">كل سعر يُسجّل أولاً كعرض غير موثق. يجب تحديد الدليل والمراجعة لاحقًا قبل استخدامه في المقارنة.</div>'+
 '<div class="form-grid"><label>الطلب <select id="qeRequest" onchange="syncQuoteSupplierOptions()">'+(st.requests||[]).map(r=>
 '<option value="'+dEsc(r.id)+'">'+dEsc(r.id)+' — '+dEsc(r.product||r.title)+'</option>').join('')+'</select></label>'+
 '<label>المورد <select id="qeSupplier">'+supplierOptions+'</select></label>'+
 '<label>العملة <select id="qeCurrency"><option>USD</option><option>CNY</option><option>EUR</option><option>YER</option></select></label>'+
 '<label>أساس العرض وميناؤه <input id="qeBasis" placeholder="FOB Guangzhou"></label>'+
 '<label>وصف البند <input id="qeProduct" placeholder="PIR panel 100 mm, 0.5 mm steel"></label>'+
 '<label>رمز المقارنة الموحد (اختياري) <input id="qeKey" placeholder="PIR-100MM-STEEL05"></label>'+
 '<label>سعر الوحدة <input id="qePrice" inputmode="decimal" type="number" step="0.01" min="0.01"></label>'+
 '<label>الكمية <input id="qeQuantity" inputmode="decimal" type="number" step="0.001" min="0.001"></label>'+
 '<label>الوحدة <select id="qeUnit"><option>m²</option><option>piece</option><option>set</option><option>kg</option><option>unit</option></select></label>'+
 '<label>الدليل (رابط/معرّف بريد/رقم مستند) <input id="qeEvidence" placeholder="Gmail message ID or quotation URL"></label></div>'+
 '<label>تفاصيل المواصفات <textarea id="qeSpecs" rows="2" placeholder="المادة والسمك والموديل والضمان أو شروط المطابقة"></textarea></label>'+
 '<button class="btn primary" onclick="saveStructuredQuote()">تسجيل العرض للمراجعة</button>'+
 '<p id="qeStatus" aria-live="polite" class="muted"></p></div></section>';
}
function syncQuoteSupplierOptions(){
 const requestId=document.getElementById('qeRequest')?.value,request=(st.requests||[]).find(r=>r.id===requestId);
 const input=document.getElementById('qeSupplier');if(!input||!request)return;
 const ids=new Set(request.selectedSupplierIds||[]),old=input.value;
 const suppliers=(st.suppliers||[]).filter(s=>ids.has(s.id)||s.associatedRequestId===requestId);
 input.replaceChildren(new Option('اختر المورد المرتبط بالطلب',''));
 for(const s of suppliers)input.append(new Option(s.name,s.id));
 if(suppliers.some(s=>s.id===old))input.value=old;
}
const field=id=>document.getElementById(id)?.value?.trim()||'';
async function saveStructuredQuote(){
 const status=document.getElementById('qeStatus');status.textContent='جارٍ تسجيل العرض...';
 const payload={requestId:field('qeRequest'),supplierId:field('qeSupplier'),currency:field('qeCurrency'),
  basis:field('qeBasis'),evidenceRef:field('qeEvidence'),
  items:[{description:field('qeProduct'),comparisonKey:field('qeKey'),unit:field('qeUnit'),
    unitPrice:Number(field('qePrice')),quantity:Number(field('qeQuantity')),specifications:field('qeSpecs')}]};
 try{
  const r=await fetch('/api/quotes/structured',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
    x=await r.json();
  if(!r.ok){status.textContent=x.error||'بيانات العرض غير مكتملة';return}
  st.quotes.unshift(x);status.textContent='تم حفظ '+x.id+' كعرض مستلم يحتاج مراجعة الدليل.';
  await loadComparisons();
 }catch(e){status.textContent='تعذر حفظ العرض؛ تحقق من الاتصال.'}
}
function comparisonMarkup(info){
 const cards='<div class="mini-stats">'+
  statCard('العروض المسجلة',info.quotesReviewed)+
  statCard('العروض المتحقق منها',info.verifiedQuotes)+
  statCard('مجموعات قابلة للمقارنة',info.comparableGroups)+
  statCard('بنود غير مؤهلة',info.excludedQuoteLines)+'</div>';
 const matched=info.comparisons?.length?info.comparisons.map(x=>
  '<div class="compare-group"><h3>'+dEsc(x.product)+'</h3>'+
  '<p class="muted">الطلب '+dEsc(x.requestId)+' · '+dEsc(x.currency)+
  ' / '+dEsc(x.unit)+' · FOB '+dEsc(x.port)+' · الكمية '+dEsc(x.quantity)+'</p>'+
  '<div class="table-scroll"><table><thead><tr><th>الشركة</th><th>عرض السعر</th><th>السعر/وحدة</th><th>الإجمالي على نفس الكمية</th><th>الفرق عن الأقل</th></tr></thead><tbody>'+
  x.rows.map(r=>'<tr><td>'+dEsc(r.supplier)+'</td><td>'+dEsc(r.quoteId)+'</td><td>'+
   dAmount(r.unitPrice)+'</td><td>'+dAmount(r.total)+'</td><td>'+dAmount(r.differenceFromLow)+'</td></tr>').join('')+
  '</tbody></table></div><p class="muted">'+dEsc(x.note)+'</p></div>').join(''):
  '<div class="data-warning"><b>لا توجد بعد عروض موثقة ومتطابقة كافية لإجراء مقارنة سعرية.</b>'+
  '<p>يجب استلام عرضين على الأقل للمواصفات والكمية والعملة وميناء FOB ونفس وحدة البيع، ولا يجوز تقدير التوفير دون دليل.</p></div>';
 const rows=(info.quotes||[]).map(q=>{
  const state=q.verified?'عرض متحقق منه':'بانتظار التحقق';
  return '<div class="quote-record"><div><b>'+dEsc(q.supplier)+'</b><small>'+dEsc(q.quoteId)+
   ' · '+dEsc(q.requestId)+' · '+dEsc(q.basis)+' · '+dEsc(state)+'</small></div>'+
   '<div class="missing-list">'+(q.issues?.length?q.issues.map(x=>'<span>'+dEsc(x)+'</span>').join(''):
     '<span class="tag-ok">لا توجد نواقص أولية مكتشفة</span>')+'</div>'+
   (!q.verified&&q.evidenceRef?
    '<button class="btn no-print" onclick="verifyQuotation('+JSON.stringify(q.quoteId).replace(/"/g,'&quot;')+')">مراجعة وتوثيق العرض</button>':'')+
   '</div>';
 }).join('');
 return cards+matched+'<h3>سجل العروض وحالة اكتمالها</h3>'+
 (rows||'<p class="muted">لم تسجل عروض لهذا النطاق بعد.</p>')+
 '<p class="muted">'+dEsc(info.disclaimer)+'</p>';
}
async function verifyQuotation(id){
 const note=prompt('قبل توثيق العرض: اكتب ما راجعته في المستند ومصدر السعر والمواصفات وشروطه (12 حرفًا على الأقل).');
 if(!note||note.trim().length<12)return;
 if(!confirm('هل راجعت المستند الأصلي والمواصفات بنفسك؟ التوثيق لا يعني إرسال طلب شراء.'))return;
 const r=await fetch('/api/quotes/'+encodeURIComponent(id)+'/verify',{method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({confirmVerified:true,reviewNote:note.trim()})});
 const x=await r.json();
 if(!r.ok){alert(x.error||'تعذرت عملية التوثيق');return}
 await loadComparisons();
}
async function loadComparisons(){
 const output=document.getElementById('comparisonOutput');if(!output)return;
 const scope=field('comparisonScope');output.textContent='جارٍ مقارنة العروض...';
 const requestControl=document.getElementById('qeRequest');
 if(requestControl&&scope&&[...requestControl.options].some(o=>o.value===scope))requestControl.value=scope;
 syncQuoteSupplierOptions();
 try{
  const r=await fetch('/api/price-comparison'+(scope?'?requestId='+encodeURIComponent(scope):'')),data=await r.json();
  if(!r.ok){output.textContent=data.error||'تعذر قراءة المقارنات';return}
  comparisonSnapshot=data;
  output.innerHTML=(scope?
   '<div class="approval-details" style="display:block;margin:12px 0"><b>تحليل الطلب '+dEsc(scope)+'</b>'+
   '<p class="muted">فروق الأسعار لا تمثل توفيرًا محققًا. تُقارن العروض الموثقة والمتطابقة فقط.</p>'+
   '<div class="actions"><a class="btn" href="/workspace.html?id='+encodeURIComponent(scope)+'">مساحة الطلب</a>'+
   '<a class="btn" href="/?requestId='+encodeURIComponent(scope)+'#market">البحث عن موردين</a>'+
   '<a class="btn" href="/?requestId='+encodeURIComponent(scope)+'#reports">تقرير الطلب</a></div></div>':'')+
   comparisonMarkup(data);
 }catch(e){output.textContent='تعذر الاتصال بالخادم.'}
}
function dailyMarkup(r){
 return executiveReportMarkup(r);
}
function updateReportPeriod(){
 const monthly=document.getElementById('reportPeriod')?.value==='monthly';
 const d=document.getElementById('dailyDateLabel'),m=document.getElementById('monthlyDateLabel');
 if(d)d.style.display=monthly?'none':'';
 if(m)m.style.display=monthly?'':'none';
 loadDailyReport();
}
async function loadDailyReport(){
 const output=document.getElementById('dailyReportOutput');if(!output)return;
 const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Asia/Aden',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const localDay=dateParts.year+'-'+dateParts.month+'-'+dateParts.day;
 const dayControl=document.getElementById('dailyDate'),monthControl=document.getElementById('monthlyDate');
 if(dayControl&&!dayControl.value)dayControl.value=localDay;
 if(monthControl&&!monthControl.value)monthControl.value=localDay.slice(0,7);
 const scope=field('dailyScope'),audience=field('dailyAudience')||'management',
 monthly=field('reportPeriod')==='monthly',date=monthly?field('monthlyDate'):field('dailyDate');
 dailyAudience=audience;output.textContent='جارٍ إعداد التقرير من البيانات المسجلة...';
 const u=(monthly?'/api/monthly-report':'/api/daily-report')+'?audience='+encodeURIComponent(audience)+
   (scope?'&requestId='+encodeURIComponent(scope):'')+
   (date?(monthly?'&month=':'&date=')+encodeURIComponent(date):'');
 try{
  const r=await fetch(u),j=await r.json();
  if(!r.ok){output.textContent=j.error||'تعذر إعداد التقرير';return}
  dailySnapshot=j;output.innerHTML=dailyMarkup(j);
  loadDiagnostics();
 }catch(e){output.textContent='تعذر الاتصال بالخادم.'}
}

function formatWeChatDailyText(r){
 if(!r)return '';
 const k=r.kpis||{},management=r.audience==='management';
 const clean=s=>String(s??'').replace(/[\r\n\t]+/g,' ').trim();
 const safeList=(list,max=5)=>Array.isArray(list)?list.slice(0,max).map(x=>'• '+clean(x)):[];
 const lines=[
  'ALHARIR | تقرير إنجاز المشتريات '+(r.period==='monthly'?'الشهري':'اليومي'),
  (r.period==='monthly'?'الشهر: ':'التاريخ: ')+clean(r.date)+' | '+(management?'للإدارة':'للمشتري'),
  r.mode==='synthetic-demo'?'⚠️ بيانات تجريبية، ليست نتائج تشغيل فعلية.':'',
  '',
  'الطلبات: '+(k.requests??0)+' | الموردون: '+(k.suppliers??0)+
    ' | العروض: '+(k.quoteRecords??0)+' | الموثقة: '+(k.verifiedQuotes??0),
  'مقارنات FOB متكافئة: '+(k.comparableGroups??0)+
    ' | نشاط '+(r.period==='monthly'?'الشهر':'اليوم')+': '+(k.actionsToday??0)+' | ردود '+(r.period==='monthly'?'الشهر':'اليوم')+': '+(k.repliesToday??0),
  '',
  'الإنجاز:',
  ...(safeList(r.achievements).length?safeList(r.achievements):['• لا توجد إنجازات جديدة مسجلة لهذا التاريخ']),
  '',
  'متابعة الموردين:',
  ...((r.supplierProgress||[]).length?r.supplierProgress.slice(0,6).map(x=>
    '• '+clean(x.supplier)+': '+clean(x.stage)+' | ردود '+(x.replies??0)+' | عروض '+(x.quotes??0)):
   ['• لا توجد بيانات متابعة موردين مسجلة']),
  '',
  'مقارنة الأسعار:',
  ...(Array.isArray(r.priceComparisons)&&r.priceComparisons.length?
    r.priceComparisons.slice(0,4).map(g=>'• '+clean(g.product)+': '+
      clean(g.lowestPrice)+' '+clean(g.currency)+'/'+clean(g.unit)+
      ' | فرق العرض الأعلى والأقل: '+clean(g.spreadForQuantity)+' '+clean(g.currency)+
      ' (ليس توفيرًا محققًا)'):
    ['• لا توجد عروض متكافئة كافية لإصدار مقارنة سعرية موثوقة']),
  '',
  'المهام القادمة:',
  ...(safeList(r.priorities).length?safeList(r.priorities):['• لا توجد مهام إضافية مسجلة']),
  '',
  'ملاحظة: الأسعار الاسترشادية لا تعادل عروض FOB موثقة. يتطلب أي اعتماد مراجعة المستندات والمواصفات.'
 ];
 return lines.filter((line,i)=>line!==''||i===3||i===8).join('\n').trim();
}
async function copyWeChatDailyText(){
 if(!dailySnapshot){alert('حمّل التقرير اليومي أولاً');return}
 const message=formatWeChatDailyText(dailySnapshot);
 try{
   if(!navigator.clipboard?.writeText)throw Error('clipboard_not_supported');
   await navigator.clipboard.writeText(message);
   alert('نُسخ ملخص التقرير. يمكنك لصقه في محادثة WeChat بعد مراجعته.');
 }catch(e){
   const blob=new Blob([message],{type:'text/plain;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='ALHARIR-WeChat-Brief-'+dailySnapshot.date+'.txt';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
   alert('لم يسمح المتصفح بالنسخ؛ نُزّل الملخص كملف نصي للمشاركة.');
 }
}

function reportDoc(data){
 // Inline the SAME visual stylesheet into the downloadable file: works offline.
 const link=document.querySelector('link[href="/executive-report.css"]');
 let styles='';
 try{styles=Array.from(link?.sheet?.cssRules||[]).map(rule=>rule.cssText).join('\n')}
 catch(_){styles=''}
 const base='body{background:white;color:#142d44;font-family:Tahoma,Arial,sans-serif;margin:0}'+
  '.eod-document{display:block}.eod-sheet{break-after:page}.eod-sheet:last-child{break-after:auto}';
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>ALHARIR Procurement '+dEsc(data.date)+'</title><style>'+base+styles+'</style></head><body>'+
 executiveReportMarkup(data)+'</body></html>';
}
function dailyFile(){
 if(!dailySnapshot)return null;
 const content=reportDoc(dailySnapshot);
 return {content,name:'ALHARIR-'+(dailySnapshot.period==='monthly'?'Monthly':'Daily')+'-'+dailySnapshot.audience+'-'+dailySnapshot.date+'.html',
  file:new File([content],'ALHARIR-'+(dailySnapshot.period==='monthly'?'Monthly':'Daily')+'-'+dailySnapshot.audience+'-'+dailySnapshot.date+'.html',{type:'text/html'})};
}
function downloadDailyHtml(){
 const d=dailyFile();if(!d)return alert('حمّل التقرير أولاً');
 const blob=new Blob([d.content],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=d.name;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function printDailyReport(){
 if(!dailySnapshot)return alert('حمّل التقرير أولاً');
 window.print();
}
async function shareDailyReport(){
 const d=dailyFile();if(!d)return alert('حمّل التقرير أولاً');
 const title='ALHARIR '+(dailySnapshot.period==='monthly'?'Monthly':'Daily')+' Procurement Report — '+dailySnapshot.date;
 if(navigator.canShare&&navigator.canShare({files:[d.file]})&&navigator.share){
  try{await navigator.share({title,files:[d.file]});return}catch(e){if(e.name==='AbortError')return}
 }
 downloadDailyHtml();
 alert('تم تجهيز تنزيل التقرير. افتح الملف من تطبيق الملفات، ثم استخدم مشاركة iPhone لإرساله عبر WeChat أو البريد.');
}
