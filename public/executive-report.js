'use strict';
// A4 landscape / two-sheet executive report, generated strictly from evidence-backed report JSON.
// Do not populate a price, vendor comparison or progress unless it exists in the underlying request data.
function executiveReportMarkup(r){
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const number=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('en-US',{maximumFractionDigits:2}):'—';
 const k=r.kpis||{},monthly=r.period==='monthly',management=r.audience==='management';
 const day=E(r.date),label=monthly?'الشهر':'التاريخ',period=monthly?'الشهري':'اليومي';
 const scope=(r.requests||[]),suppliers=(r.supplierProgress||[]),comp=(r.priceComparisons||[]);
 const priorities=(r.priorities||[]).slice(0,5),risks=(r.risks||[]).slice(0,4);
 const headline=r.requestId?(scope.find(x=>x.id===r.requestId)?.title||r.requestId):
   scope.length===1?scope[0].title:'ملخص جميع طلبات المشتريات';
 const demo=r.mode==='synthetic-demo';
 const subtitle=demo?'بيانات تدريب تجريبية، لا يجوز استخدامها لاعتماد أي عملية شراء.':
  'مؤشرات من سجل الطلبات والعروض والمراسلات المسجلة، وليست تقديرات.';
 const stats=[
  {value:k.actionsToday??0,label:monthly?'نشاطات الشهر':'متابعات اليوم',sub:'ACTIVITY LOG'},
  {value:k.quoteRecords??0,label:'عروض أسعار مسجلة',sub:'RECEIVED QUOTES'},
  {value:k.repliesToday??0,label:monthly?'ردود الشهر':'ردود اليوم',sub:'SUPPLIER REPLIES'},
  {value:k.comparableGroups??0,label:'مجموعات أسعار متكافئة',sub:'VERIFIED COMPARISONS'}
 ];
 const badge=stats.map((s,i)=>'<div class="eod-stat eod-stat-'+i+'"><small>'+E(s.label)+'</small>'+
  '<b>'+E(s.value)+'</b><span>'+s.sub+'</span></div>').join('');
 const quoteBars=comp.length?(()=>{
  const listings=comp.flatMap(group=>{
   const rows=management&&Array.isArray(group.rows)&&group.rows.length?group.rows.slice(0,5):null;
   if(rows)return rows.map(row=>({
     label:row.supplier,value:row.unitPrice,unit:group.unit,currency:group.currency,
     detail:group.product,verified:true
   }));
   return [{label:group.lowestSupplier||'أقل عرض متكافئ',value:group.lowestPrice,
    unit:group.unit,currency:group.currency,detail:group.product,verified:true}];
  }).slice(0,6);
  const max=Math.max(1,...listings.map(x=>Number(x.value)||0));
  return listings.map(c=>{
   const price=Number(c.value)||0,pct=Math.max(0,Math.min(100,price/max*100));
   return '<div class="eod-price-row"><div><b>'+E(c.label)+'</b><small>'+
    E(c.detail)+'</small></div>'+
    '<div class="eod-bar-track"><span class="eod-bar-fill" style="width:'+pct.toFixed(1)+'%"></span></div>'+
    '<strong>'+number(price)+' '+E(c.currency)+' / '+E(c.unit)+'</strong></div>';
  }).join('');
 })():'<div class="eod-empty"><strong>لا توجد مقارنة سعرية موثقة بعد</strong>'+
  '<p>لن نرتب عروض EXW مع FOB أو نقارن البنود مختلفة الوحدات والمواصفات والكمية. أدخل العروض المستلمة وراجع مستنداتها أولًا.</p></div>';
 const firstRisk=risks[0]||(!comp.length?'لا توجد عروض FOB متكافئة كافية لاتخاذ قرار سعري نهائي.':'تتطلب الأسعار والمواصفات موافقة صاحب الصلاحية.');
 const stageNote=scope.length?scope.slice(0,3).map(x=>
  '<li><strong>'+E(x.title)+'</strong><span>'+E(x.status||'متابعة')+
  ' · '+E(x.supplierCount)+' مورد · '+E(x.quotes)+' عرض</span></li>').join(''):
  '<li><strong>لم تسجل طلبات بعد</strong><span>أنشئ طلبًا لتظهر حالته هنا.</span></li>';
 const decision='<div class="eod-decision"><strong>موقف اليوم: '+
  (comp.length?'مقارنات متاحة للمراجعة — لا توجد ترسية آلية.':'لا ترسية ولا اعتماد سعر نهائي قبل استكمال العروض المتكافئة.')+
  '</strong><p>'+E(firstRisk)+'</p></div>';
 const progressRows=suppliers.map((s,i)=>{
  const next=s.verifiedQuotes?'مراجعة الاعتماد التجاري والفني':s.quotes?
   'استكمال المستندات والتحقق من العرض':s.replies?'متابعة طلب العرض وتوثيق الرد':'تحديد وسيلة تواصل والتحقق من حالة الطلب';
  const tone=s.verifiedQuotes?'ok':s.quotes?'blue':s.replies?'amber':'muted';
  return '<tr><td data-label="المورد"><strong>'+E(s.supplier)+'</strong></td>'+
   '<td data-label="الحالة"><span class="eod-pill '+tone+'">'+E(s.stage)+'</span></td>'+
   '<td data-label="المعلومات المسجلة">'+E(s.replies)+' ردود · '+E(s.quotes)+' عروض · '+E(s.verifiedQuotes)+' موثقة</td>'+
   '<td data-label="الخطوة التالية">'+E(next)+'</td></tr>';
 }).join('');
 const priorityCards=priorities.slice(0,3).map((x,i)=>
  '<div class="eod-priority"><b>'+String(i+1).padStart(2,'0')+'</b><p>'+E(x)+'</p></div>').join('')||
  '<div class="eod-priority"><b>01</b><p>لا توجد أولويات إضافية مدخلة في السجل الحالي.</p></div>';
 const warn=demo?'<div class="eod-demo">بيانات تجريبية / SYNTHETIC DEMO — ليست تقرير عمل حقيقيًا.</div>':'';
 const timestamp=E(r.generatedAt||'');
 const hdr=(title,tag,small)=>'<header class="eod-head"><div><span class="eod-head-tag">'+tag+'</span><h2>'+title+
  '</h2><p>'+small+'</p></div><div class="eod-head-brand">ALHARIR<small>PROCUREMENT INTELLIGENCE</small></div></header>';
 const foot=(page)=>'<footer class="eod-foot"><span>ALHARIR Shipping and Export · '+(management?'للاستخدام الإداري الداخلي':'نسخة مخصصة للمشتري')+
   '</span><span>المصدر: السجل التشغيلي · '+timestamp+'</span><b>'+page+' / 2</b></footer>';
 return '<article id="dailyPrintable" class="eod-document" dir="rtl">'+
  '<section class="eod-sheet eod-sheet-first">'+
   hdr('تقرير المشتريات '+period, 'EXECUTIVE PROCUREMENT BRIEF',
    label+': '+day+' · '+E(headline)+' · '+(management?'الإدارة':'المشتري'))+
   warn+'<div class="eod-stats">'+badge+'</div>'+
   '<div class="eod-columns">'+
    '<section class="eod-block eod-quotes"><div class="eod-blockhead"><span>QUOTATION SNAPSHOT</span><h3>نتيجة تحليل عروض الأسعار</h3><p>الأسعار المقبولة للمقارنة فقط، مع الحفاظ على شروط FOB والمواصفات.</p></div>'+
     quoteBars+'</section>'+
    '<section class="eod-block eod-scope"><div class="eod-blockhead"><span>REQUEST STATUS</span><h3>نطاق المتابعة الحالية</h3><p>نظرة إلى الطلبات وسيرها الموثق</p></div>'+
     '<div class="eod-scope-number"><strong>'+E(k.requests??0)+'</strong><span>طلبات شراء<br>مسجلة</span></div>'+
     '<ul class="eod-scope-list">'+stageNote+'</ul></section></div>'+
   decision+foot(1)+'</section>'+
   '<section class="eod-sheet eod-sheet-second">'+
    hdr('سجل الموردين والمتابعة', 'SUPPLIER TRACKER / '+day,
     'حالة موثقة وفق الرسائل والعروض المسجلة، وليست تقديرًا لنشاط لم يحدث.')+
    '<div class="eod-tablewrap"><table class="eod-table"><thead><tr>'+
    '<th>المورد</th><th>الحالة</th><th>المعلومة المثبتة</th><th>الإجراء القادم</th>'+
    '</tr></thead><tbody>'+ (progressRows||'<tr><td colspan="4" class="eod-nodata">لا توجد شركات مرتبطة بهذا التقرير.</td></tr>')+
    '</tbody></table></div>'+
    '<div class="eod-priorities"><div class="eod-priority-head"><span>PRIORITY ACTIONS</span><h3>الأعمال والخطوات القادمة</h3></div>'+
    '<div class="eod-prioritygrid">'+priorityCards+'</div></div>'+
    '<p class="eod-fineprint">'+E(subtitle)+' '+E(r.disclaimer||'')+'</p>'+foot(2)+
   '</section></article>';
}
