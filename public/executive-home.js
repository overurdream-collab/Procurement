'use strict';
/* Premium home is the one authoritative SPA homepage, not another app.
 * The KPI/chart areas are filled from existing protected Procurement APIs. */
function executiveHomeView(){
 return '<div class="executive-home" dir="rtl">'+
 '<header class="executive-head">'+
 '<div class="head-copy">'+
 '<span class="eyebrow">ALHARIR · PROCUREMENT INTELLIGENCE</span>'+
 '<h2>مساحة القرار.<br>كل المشتريات تحت نظرك.</h2>'+
 '<p>من البحث عن المورد المناسب إلى تحليل عروض الأسعار والتقرير التنفيذي. صورة واحدة واضحة ومتصلة بالبيانات المسجلة، دون تقديرات مضللة.</p>'+
 '<div class="executive-actions">'+
 '<a href="#market">⌕ البحث عن موردين</a>'+
 '<a href="/request.html">＋ طلب شراء جديد</a>'+
 '<a href="#reports">▤ مركز التقارير</a>'+
 '<a href="#quotes">⚖ تحليل العروض</a></div></div>'+
 '<div class="head-aside" aria-label="حالة أوامر المشتريات">'+
 '<div class="aside-top"><i></i> مركز العمليات · متابعة مباشرة</div>'+
 '<strong id="executiveActiveRequests">—</strong>'+
 '<div class="aside-sub">طلبات الشراء المسجلة</div>'+
 '<div class="aside-rule"></div>'+
 '<div class="aside-foot"><span>مقارنات سعرية متكافئة</span><b id="executiveComparableCount">—</b></div>'+
 '<div class="aside-foot"><span>عروض موثقة</span><b id="executiveVerifiedCount">—</b></div>'+
 '</div></header>'+
 '<div class="executive-tools">'+
 '<label>الطلب <select id="pilotRequest" aria-label="تصفية أمر الشراء"><option value="">جميع الطلبات</option></select></label>'+
 '<label>الفترة الزمنية <select id="pilotRange" aria-label="الفترة الزمنية">'+
 '<option value="7">آخر 7 أيام</option><option value="30" selected>آخر 30 يومًا</option><option value="90">آخر 90 يومًا</option></select></label>'+
 '<button class="btn" type="button" id="pilotRefresh">↻ تحديث البيانات</button></div>'+
 '<div class="executive-warning" id="pilotDemo" hidden role="note">نسخة عرض ببيانات تجريبية. لا تمثل هذه الأرقام نشاطًا تجاريًا حقيقيًا، ولا تعتبر فروق الأسعار وفورات محققة.</div>'+
 '<div class="executive-message" id="pilotStatus" role="status" aria-live="polite">جارٍ التحقق من السجلات...</div>'+
 '<div class="section-kicker">OPERATIONAL OVERVIEW</div>'+
 '<h3 class="section-title">نظرة تنفيذية</h3>'+
 '<p class="section-lead">اضغط أي مؤشر للانتقال إلى بياناته وتفاصيله.</p>'+
 '<section class="stats" id="pilotStats" aria-label="مؤشرات المشتريات المباشرة"></section>'+
 '<div class="section-kicker">PROCUREMENT ANALYTICS</div>'+
 '<h3 class="section-title">تحليلات سير المشتريات</h3>'+
 '<p class="section-lead">رسوم مشتقة من السجلات: لا تُعرض أسعار أو نشاطات افتراضية عند غيابها.</p>'+
 '<section class="panels" id="pilotPanels" aria-label="رسوم الأداء وتحليلات الموردين"></section>'+
 '<div class="executive-foot">مصدر البيانات: واجهات Procurement المحمية. تعرض اللوحة حالة السجل المتاحة فقط. لا يبدأ الاعتماد أو الإرسال دون تحقق وموافقة.</div>'+
 '</div>';
}
