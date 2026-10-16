'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ALHARIRMailUI=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function receivedAtText(record){
  const value=record?.receivedAt||record?.internalDate||null;
  if(!value)return 'تاريخ الاستلام غير متوفر من المصدر';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return 'تاريخ الاستلام غير صالح — يحتاج مراجعة';
  const formatter=new Intl.DateTimeFormat('ar-YE',{timeZone:'Asia/Aden',
   year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
  return formatter.format(d)+' (توقيت صنعاء)';
 }
 function attachmentHref(messageId,attachmentId){
  if(!messageId||!attachmentId)return null;
  return '/api/gmail/attachment?messageId='+encodeURIComponent(messageId)+
   '&attachmentId='+encodeURIComponent(attachmentId);
 }
 function attachmentHtml(message,opts={}){
  const aa=Array.isArray(message?.attachments)?message.attachments:[];
  if(!aa.length)return '<span class="muted">لا توجد مرفقات في هذه الرسالة.</span>';
  const disabled=opts.disabled===true;
  return '<div class="mail-attachments">'+aa.map(a=>{
   const label=esc(a.filename||'مرفق بلا اسم'),mime=esc(a.mimeType||'ملف');
   const href=attachmentHref(message.messageId,a.attachmentId);
   return '<div class="mail-file"><span class="mail-file-icon">▣</span><span><b>'+label+
    '</b><small>'+mime+' · '+(Number.isFinite(Number(a.size))?Math.round(Number(a.size)/1024)+' KB':'حجم غير محدد')+'</small></span>'+
    (disabled?'<span class="muted">عرض المرفق معطل في بيئة التجربة</span>':
      href?'<a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(href)+'">فتح / تنزيل</a>':
      '<span class="muted">غير قابل للفتح بهذه النسخة</span>')+'</div>';
  }).join('')+'</div>';
 }
 function messageHtml(message,opts={}){
  return '<article class="mail-message"><div class="mail-meta"><b>'+esc(message.subject||'رسالة دون عنوان')+'</b>'+
   '<span class="mail-date">تاريخ الاستلام: '+esc(receivedAtText(message))+'</span></div>'+
   '<div class="muted">المرسل: '+esc(message.from||'غير مسجل')+
   (message.requestId?' · الطلب: '+esc(message.requestId):' · لم يُحدد الطلب بعد')+'</div>'+
   '<details><summary>محتوى الرسالة</summary><p class="mail-body">'+esc(message.body||message.snippet||'نص غير متاح')+'</p></details>'+
   '<div class="mail-attachments-label">المرفقات ('+(message.attachments||[]).length+')</div>'+
   attachmentHtml(message,opts)+'</article>';
 }
 return {esc,receivedAtText,attachmentHref,attachmentHtml,messageHtml};
});
