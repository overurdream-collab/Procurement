'use strict';
/* Single authoritative home route; metrics/charts are produced by existing Agent-Native
 * geometry pilot and protected Procurement endpoints. No second database or actions. */
function executiveHomeView(){
 return '<div class="executive-home" dir="rtl"><header class="executive-head">'+
 '<div><span class="eyebrow">ALHARIR PROCUREMENT OS · EXECUTIVE COMMAND CENTER</span>'+
 '<h2>الرئيسية | لوحة قيادة المشتريات</h2>'+
 '<p>لوحة تفاعلية تعرض الأوامر والموردين والعروض وحالة المقارنة من سجلات النظام.</p></div>'+
 '<div class="executive-actions"><a href="#market">⌕ البحث عن موردين لمنتج</a>'+
 '<a href="/request.html">＋ أمر شراء جديد</a>'+
 '<a href="#reports">▤ التقارير</a>'+
 '<a href="#quotes">⚖ تحليل الأسعار</a></div></header>'+
 '<div class="executive-tools">'+
 '<label>تصفية أمر الشراء<select id="pilotRequest"><option value="">جميع أوامر الشراء</option></select></label>'+
 '<label>الفترة الزمنية للنشاط<select id="pilotRange">'+
 '<option value="7">آخر 7 أيام</option><option value="30" selected>آخر 30 يومًا</option><option value="90">آخر 90 يومًا</option></select></label>'+
 '<button class="btn" type="button" id="pilotRefresh">↻ تحديث المؤشرات</button></div>'+
 '<div class="executive-warning" id="pilotDemo" hidden>بيانات تجريبية توضيحية، وليست سجلًا تجاريًا دائمًا أو توصية شراء موثقة.</div>'+
 '<div class="executive-message" id="pilotStatus" role="status" aria-live="polite">جارٍ تحميل بيانات المشتريات...</div>'+
 '<section class="stats" id="pilotStats" aria-label="مؤشرات المشتريات"></section>'+
 '<section class="panels" id="pilotPanels" aria-label="رسوم وتحليلات المشتريات"></section>'+
 '<div class="executive-foot">جميع المؤشرات من واجهات Procurement المحمية. الرسوم لا تساوي مبالغ موفرة محققة، وتحتاج العروض إلى أدلة قبل اعتمادها.</div></div>';
}
