'use strict';
// Deterministic monthly procurement report. Reuses vetted dailyReport and priceAnalysis;
// "cumulative" project KPIs are not falsely presented as monthly new business.
const {dailyReport}=require('./procurement-reports');
function sanaaDate(x){
 const raw=String(x||'');
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
 const t=new Date(raw);if(!Number.isFinite(t.getTime()))return null;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Aden',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
}
function validateMonth(v){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||'')))return null;
 return v;
}
function monthlyReport(st,{month=null,requestId=null,audience='management'}={}){
 const current=validateMonth(month)||sanaaDate(new Date().toISOString()).slice(0,7);
 const start=current+'-01';
 const end=new Date(Date.UTC(Number(current.slice(0,4)),Number(current.slice(5,7)),0)).toISOString().slice(0,10);
 const base=dailyReport(st,{requestId,date:end,audience});
 const match=(x)=>{const d=sanaaDate(x);return !!d&&d.startsWith(current)};
 const belongs=a=>!requestId||a.requestId===requestId||String(a.text||'').includes(requestId);
 const activities=(st.activity||[]).filter(a=>match(a.time||a.createdAt)&&belongs(a));
 const emails=(st.gmailReplies||[]).filter(a=>match(a.receivedAt||a.time)&&(!requestId||a.requestId===requestId));
 const requests=(st.requests||[]).filter(r=>match(r.createdAt)&&(!requestId||r.id===requestId));
 const quotes=(st.quotes||[]).filter(q=>match(q.receivedAt||q.createdAt)&&(!requestId||q.requestId===requestId));
 const publicBuyer=audience==='buyer';
 const achievements=[
  ...(activities.length?['تم تسجيل '+activities.length+' أنشطة متابعة في الشهر المحدد']:[]),
  ...(emails.length?['وصل '+emails.length+' ردًا من مورد خلال الشهر']:[]),
  ...(requests.length?['تم فتح '+requests.length+' طلبات شراء جديدة خلال الشهر']:[]),
  ...(quotes.length?['تم استلام '+quotes.length+' عروض أسعار خلال الشهر (قد تحتاج مراجعة)']:[])
 ];
 return {...base,type:'ALHARIR_MONTHLY_PROCUREMENT_REPORT',period:'monthly',periodLabel:current,
  date:current,periodStart:start,periodEnd:end,achievements,
  kpis:{...base.kpis,
   actionsToday:activities.length,repliesToday:emails.length,
   newRequestsInPeriod:requests.length,newQuotesInPeriod:quotes.length},
  activities:publicBuyer?[]:activities.slice(-40).reverse().map(a=>({
   time:a.time||a.createdAt,type:a.type||'update',description:String(a.text||'').slice(0,700)
  })),
  privacyNotice:'عرض شهري مستخرج من السجل حتى نهاية الفترة؛ مؤشرات إجمالي الطلبات والعروض تراكمية، بينما نشاط الشهر وردوده تخص هذه الفترة فقط. راجع المعلومات قبل المشاركة.'
 };
}
module.exports={monthlyReport,validateMonth,sanaaDate};
