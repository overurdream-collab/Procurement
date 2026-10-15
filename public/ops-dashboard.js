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
 return '<section class="page-intro"><div><span class="eyebrow">ALHARIR REPORTS</span>'+
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
  '<div id="dailyReportOutput" aria-live="polite"><p class="muted">جارٍ تحميل نتائج اليوم...</p></div>'+diagnosticsShell();
}
function comparisonView(){
 return '<section class="page-intro"><div><span class="eyebrow">EVIDENCE BASED BID LEVELING</span>'+
   '<h2>تحليل عروض الأسعار الفعلية</h2><p>لا يتم ترتيب أسعار غير موثقة أو بوحدات وكمية وشروط تجارية غير متكافئة.</p></div></section>'+
   '<div class="report-toolbar no-print"><label>طلب الشراء <select id="comparisonScope" onchange="loadComparisons()">'+reportOptions()+'</select></label>'+
   '<button class="btn primary" onclick="loadComparisons()">تحديث المقارنة</button>'+
   '<button class="btn" onclick="document.getElementById(\'quoteEntryForm\').hidden=!document.getElementById(\'quoteEntryForm\').hidden">إضافة عرض أسعار مستلم</button></div>'+
   '<div id="comparisonOutput" aria-live="polite"><p class="muted">جارٍ تحليل العروض المسجلة...</p></div>'+
   quoteEntryForm();
}
function quoteEntryForm(){
 const supplierOptions=(st.suppliers||[]).map(s=>'<option value="'+dEsc(s.id)+'">'+dEsc(s.name)+'</option>').join('');
 return '<section class="panel no-print" id="quoteEntryForm" hidden><div class="ph"><h2>إدخال عرض سعر مستلم — مراجعة المستند إلزامية</h2></div>'+
 '<div class="pb"><div class="approval-details" style="display:block">كل سعر يُسجّل أولاً كعرض غير موثق. يجب تحديد الدليل والمراجعة لاحقًا قبل استخدامه في المقارنة.</div>'+
 '<div class="form-grid"><label>الطلب <select id="qeRequest">'+(st.requests||[]).map(r=>
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
 try{
  const r=await fetch('/api/price-comparison'+(scope?'?requestId='+encodeURIComponent(scope):'')),data=await r.json();
  if(!r.ok){output.textContent=data.error||'تعذر قراءة المقارنات';return}
  comparisonSnapshot=data;output.innerHTML=comparisonMarkup(data);
 }catch(e){output.textContent='تعذر الاتصال بالخادم.'}
}
function dailyMarkup(r){
 const k=r.kpis||{},management=r.audience==='management';
 const requestRows=(r.requests||[]).map(x=>
   '<tr><td>'+dEsc(x.id)+'</td><td>'+dEsc(x.title)+'</td><td>'+dEsc(x.status)+
   '</td><td>'+dEsc(x.supplierCount)+'</td><td>'+dEsc(x.quotes)+'</td><td>'+dEsc(x.comparableGroups)+'</td></tr>').join('');
 const comparisonRows=(r.priceComparisons||[]).map(x=>
  '<tr><td>'+dEsc(x.product)+'</td><td>'+dEsc(x.lowestSupplier)+'</td><td>'+dAmount(x.lowestPrice)+
  ' '+dEsc(x.currency)+'/'+dEsc(x.unit)+'</td><td>'+dAmount(x.spreadForQuantity)+
  ' '+dEsc(x.currency)+'</td><td>'+dEsc(x.comparableSuppliers)+'</td></tr>').join('');
 const achievements=(r.achievements||[]).map(x=>'<li>'+dEsc(x)+'</li>').join('');
 const risks=(r.risks||[]).map(x=>'<li>'+dEsc(x)+'</li>').join('');
 const priorities=(r.priorities||[]).map(x=>'<li>'+dEsc(x)+'</li>').join('');
 const gaps=(r.quotationGaps||[]).map(x=>
 '<li><b>'+dEsc(x.quoteId)+'</b>'+(x.supplier?' — '+dEsc(x.supplier):'')+
 ' : '+dEsc((x.issues||[]).join('، '))+'</li>').join('');
 const activities=(r.activities||[]).map(x=>'<li>'+dEsc(x.time)+' — '+dEsc(x.description)+'</li>').join('');
 return '<article id="dailyPrintable" class="daily-printable" dir="rtl">'+
  '<header class="daily-heading"><div><div class="eyebrow">ALHARIR / EXECUTIVE PROCUREMENT REPORT</div>'+
   '<h2>'+(r.period==='monthly'?'تقرير المشتريات الشهري':'تقرير المشتريات اليومي')+
    '</h2><p>'+(r.period==='monthly'?'الشهر: ':'التاريخ: ')+dEsc(r.date)+' · نوع النسخة: '+
   (management?'إدارة — سري':'مشتري — نسخة مراجعة')+'</p></div>'+
   '<strong>ALHARIR</strong></header>'+
   (r.mode==='synthetic-demo'?'<p class="data-warning"><b>نسخة تجريبية ببيانات غير تشغيلية.</b> لا تعتمد لاتخاذ قرار شراء فعلي.</p>':'')+
   '<div class="mini-stats">'+statCard('طلبات الشراء',k.requests)+statCard('الموردون',k.suppliers)+
    statCard('عروض مسجلة',k.quoteRecords)+statCard('عروض متحقق منها',k.verifiedQuotes)+
    statCard('مقارنات متكافئة',k.comparableGroups)+
    statCard(r.period==='monthly'?'نشاط الشهر':'نشاط اليوم',k.actionsToday)+
    statCard(r.period==='monthly'?'ردود الشهر':'ردود اليوم',k.repliesToday)+
    (management?statCard('اعتمادات معلقة',k.pendingApprovals):'')+'</div>'+
   '<h3>متابعة الطلبات</h3><div class="table-scroll"><table><thead><tr>'+
   '<th>رقم الطلب</th><th>المنتج أو المشروع</th><th>الحالة</th><th>موردون</th><th>عروض</th><th>مقارنات</th>'+
   '</tr></thead><tbody>'+requestRows+'</tbody></table></div>'+
   '<h3>نتيجة تحليل الأسعار المتكافئة</h3>'+
   (comparisonRows?'<div class="table-scroll"><table><thead><tr>'+
    '<th>البند</th><th>الأقل سعرًا في المجموعة</th><th>السعر</th><th>فرق السعر على الكمية</th><th>عدد العروض</th>'+
    '</tr></thead><tbody>'+comparisonRows+'</tbody></table></div>':
    '<p class="data-warning">لا توجد مقارنات قابلة للاعتماد حتى الآن؛ تُعرض الأسعار غير المتكافئة في سجل العروض وليس كمكاسب أو وفورات.</p>')+
   '<div class="report-columns"><section><h3>الإنجازات المثبتة</h3>'+
   (achievements?'<ul>'+achievements+'</ul>':'<p class="muted">لم يسجل إنجاز جديد في التاريخ المحدد.</p>')+
   '</section><section><h3>الأولويات والقرارات المطلوبة</h3>'+
   (priorities?'<ul>'+priorities+'</ul>':'<p>لا توجد أولويات إضافية مسجلة.</p>')+'</section></div>'+
   (risks?'<section><h3>المخاطر والفجوات الرئيسية</h3><ul>'+risks+'</ul></section>':'')+
   (gaps?'<section><h3>نواقص العروض</h3><ul>'+gaps+'</ul></section>':'')+
   (management&&activities?'<section><h3>'+(r.period==='monthly'?'سجل نشاط الشهر':'سجل نشاط اليوم')+'</h3><ul>'+activities+'</ul></section>':'')+
   '<footer><p>'+dEsc(r.disclaimer)+'</p><p>'+dEsc(r.privacyNotice)+'</p>'+
    '<p>المصدر: سجل المشتريات لدى ALHARIR · توليد: '+dEsc(r.generatedAt)+'</p></footer></article>';
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

const reportDoc=(data)=>'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>ALHARIR Daily Procurement '+dEsc(data.date)+'</title>'+
  '<style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#17233e;line-height:1.7}'+
  'h2,h3{color:#102550}.eyebrow{color:#3c668b;font-size:11px;letter-spacing:1px}.daily-heading{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #183772;padding-bottom:12px}.mini-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.mini-stat{border:1px solid #d9e2ed;border-radius:9px;padding:12px}.mini-stat span,.mini-stat small{display:block;color:#60748b}.mini-stat strong{display:block;font-size:25px;color:#153d7b}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:9px;border:1px solid #dae4ee;text-align:right}th{background:#edf3f9}.report-columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}.data-warning{background:#fff6e3;padding:12px}.daily-printable footer{border-top:1px solid #b9c7da;margin-top:24px;font-size:11px;color:#50657b}li{margin-bottom:5px} @page{size:A4;margin:14mm}@media print{body{margin:0}}</style></head><body>'+
  dailyMarkup(data)+'</body></html>';
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
