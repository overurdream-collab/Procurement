/* ALHARIR Agent-Native dashboard pilot.
 * Presentation-only, read-only. No second procurement DB or actions.
 * Calls three existing authenticated endpoints and uses the MIT layout adapter. */
(function(root,factory){const app=factory();
 if(typeof module==='object'&&module.exports)module.exports=app;
 else {root.ALHARIRDashboardPilot=app;if(root.document?.getElementById('pilotStats'))app.init();}
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const ENDPOINTS=['/api/state','/api/daily-report?audience=management','/api/price-comparison'];
 const colors=['#56dac5','#59b4ff','#ffce73','#b4a6f6','#f3a578'];
 const numeric=x=>Number.isFinite(Number(x))&&Number(x)>=0?Number(x):0;
 function inRange(s,days,now=new Date()){
  if(!s)return false;const t=new Date(s).getTime();
  return Number.isFinite(t)&&t<=now.getTime()&&t>=now.getTime()-days*86400000;
 }
 function monthKey(s){
  if(!s||Number.isNaN(new Date(s).getTime()))return '';
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Aden',year:'numeric',month:'2-digit'}).format(new Date(s)).slice(0,7);
 }
 function model(st,report,cmp,requestId='',days=30,now=new Date()){
  const requests=requestId?(st.requests||[]).filter(x=>x.id===requestId):(st.requests||[]);
  const reqIds=new Set(requests.map(x=>x.id));
  const linked=new Set(requests.flatMap(x=>x.selectedSupplierIds||[]));
  const suppliers=requestId?(st.suppliers||[]).filter(s=>linked.has(s.id)||s.associatedRequestId===requestId||(requestId==='RFQ-001'&&!s.associatedRequestId)):(st.suppliers||[]);
  const quotes=requestId?(st.quotes||[]).filter(q=>reqIds.has(q.requestId)):(st.quotes||[]);
  const scanned=requestId?(cmp.quotes||[]).filter(q=>reqIds.has(q.requestId)):(cmp.quotes||[]);
  const groups=requestId?(cmp.comparisons||[]).filter(g=>reqIds.has(g.requestId)):(cmp.comparisons||[]);
  const acts=(st.activity||[]).filter(a=>(!requestId||reqIds.has(a.requestId)||String(a.text||'').includes(requestId))&&inRange(a.time||a.createdAt,days,now));
  const recentQuotes=quotes.filter(q=>inRange(q.receivedAt||q.createdAt,days,now));
  const counts={requests:requests.length,suppliers:suppliers.length,quotes:quotes.length,
   verified:scanned.filter(q=>q.verified).length,pending:scanned.filter(q=>!q.verified).length,
   groups:groups.length,actions:acts.length,recentQuotes:recentQuotes.length,
   approvals:(st.approvals||[]).filter(a=>a.status==='pending').length};
  // Include every month touched by the selected rolling range, including boundary months.
  const start=new Date(now.getTime()-days*86400000);
  const monthly=[];
  for(let t=Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),1);
      t<=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1);
      t=Date.UTC(new Date(t).getUTCFullYear(),new Date(t).getUTCMonth()+1,1)){
   const d=new Date(t),key=d.toISOString().slice(0,7);
   monthly.push({key,label:new Intl.DateTimeFormat('ar',{month:'short',timeZone:'UTC'}).format(d),
    actions:acts.filter(x=>monthKey(x.time||x.createdAt)===key).length,
    quotes:recentQuotes.filter(x=>monthKey(x.receivedAt||x.createdAt)===key).length});
  }
  return {requests,groups,counts,monthly,days,demo:report.mode==='synthetic-demo',
   reportKPIs:requestId?null:report.kpis,requestId};
 }
 async function loadData(request=fetch){
  const [state,report,comparison]=await Promise.all(ENDPOINTS.map(async url=>{
   const r=await request(url,{credentials:'same-origin',cache:'no-store'});
   if(!r.ok)throw Error(url+': HTTP '+r.status);return r.json();
  }));
  return {state,report,comparison};
 }
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
 function card(title,value,color,href,description){
  const root=el('article',undefined,'stat');root.style.setProperty('--accent',color);
  root.append(el('label',title),el('strong',value),el('small',description));
  const link=el('a');link.href=href;link.setAttribute('aria-label',title+' — عرض التفاصيل');root.append(link);
  return root;
 }
 function panel(title,desc){const p=el('section',undefined,'panel');p.append(el('h2',title),el('p',desc));return p;}
 function funnel(p,m){
  const data=[['الطلبات',m.counts.requests,'/#rfq'],['الموردون',m.counts.suppliers,'/#suppliers'],
   ['عروض الأسعار',m.counts.quotes,'/#quotes'],['العروض الموثقة',m.counts.verified,'/#quotes'],
   ['مجموعات مقارنة',m.counts.groups,'/#quotes']];
  const max=Math.max(1,...data.map(x=>x[1]));const wrap=el('div',undefined,'funnel');
  data.forEach((x,i)=>{
   const row=el('div',undefined,'funnelrow'),title=el('a',x[0]),track=el('div',undefined,'track'),
    fill=el('div',undefined,'fill');title.href=x[2];
   fill.style.width=Math.min(100,numeric(x[1])/max*100)+'%';fill.style.background=colors[i];track.append(fill);
   row.append(title,track,el('strong',x[1]));wrap.append(row);
  });p.append(wrap);
 }
 function donut(p,m){
  const values=[['عروض موثقة',m.counts.verified],['بانتظار التحقق',m.counts.pending]];
  const total=values.reduce((s,x)=>s+x[1],0);
  if(!total){p.append(el('div','لا توجد عروض يمكن تصنيفها حتى الآن.','empty'));return;}
  const outer=el('div',undefined,'piezone'),circle=el('div',undefined,'donut');
  let pos=0;circle.style.background='conic-gradient('+values.map((x,i)=>{
   const start=pos;pos+=x[1]/total*100;return colors[i]+' '+start+'% '+pos+'%';
  }).join(',')+')';
  const center=el('div',undefined,'center');center.append(el('strong',total),el('small','إجمالي العروض'));
  circle.append(center);const legend=el('div',undefined,'legend');
  values.forEach((x,i)=>{const line=el('div'),dot=el('i');dot.style.background=colors[i];
   line.append(dot,el('span',x[0]),el('b',x[1]));legend.append(line);});
  outer.append(circle,legend);p.append(outer);
 }
 function trend(p,m){
  if(!m.monthly.some(x=>x.actions||x.quotes)){p.append(el('div','لا توجد أنشطة أو عروض مؤرخة في الفترة المختارة.','empty'));return;}
  const root=el('div',undefined,'trend'),max=Math.max(1,...m.monthly.flatMap(x=>[x.actions,x.quotes]));
  m.monthly.forEach(x=>{
   const col=el('div',undefined,'trendcol'),bars=el('div',undefined,'bars');
   [['actions','activity'],['quotes','quote']].forEach(([k,cls])=>{
    const bar=el('span',undefined,cls);bar.style.height=(x[k]/max*100)+'%';
    bar.title=(k==='quotes'?'العروض: ':'الأنشطة: ')+x[k];bars.append(bar);
   });col.append(bars,el('small',x.label));root.append(col);
  });p.append(root,el('p','الأزرق: أنشطة مسجلة · الذهبي: عروض مستلمة'));
 }
 function requestCards(p,m){
  if(!m.requests.length){p.append(el('div','لا توجد طلبات ضمن التصفية.','empty'));return;}
  m.requests.slice(0,5).forEach(r=>{
   const a=el('a',undefined,'request');a.href='/workspace.html?id='+encodeURIComponent(r.id);
   const comparisonCount=m.groups.filter(x=>x.requestId===r.id).length;
   a.append(el('b',r.title||r.product||r.id),
    el('small',r.id+' · '+(r.status||'قيد المتابعة')+' · مقارنات: '+comparisonCount));
   p.append(a);
  });
 }
 function render(m){
  const stats=document.getElementById('pilotStats'),area=document.getElementById('pilotPanels');
  stats.replaceChildren();area.replaceChildren();document.getElementById('pilotDemo').hidden=!m.demo;
  const c=m.counts;[
   ['أوامر الشراء',c.requests,colors[1],'رابط تفاصيل الطلبات','/#rfq'],
   ['الموردون',c.suppliers,colors[0],'الشركات المسجلة','/#suppliers'],
   ['عروض الأسعار',c.quotes,colors[2],'عروض مسجلة','/#quotes'],
   ['موثقة',c.verified,colors[3],'بعد مراجعة بشرية','/#quotes'],
   ['مجموعات مقارنة',c.groups,colors[0],'FOB بنفس المواصفات','/#quotes'],
   ['موافقات معلقة',c.approvals,colors[4],'تحتاج قرارًا','/#approvals'],
   ['أنشطة الفترة',c.actions,colors[1],'بتاريخ معروف','/#dashboard'],
   ['عروض الفترة',c.recentQuotes,colors[2],'مستلمة خلال الفترة','/#quotes']
  ].forEach(x=>stats.append(card(x[0],x[1],x[2],x[4],x[3])));
  const specs=[{id:'funnel',title:'مسار المشتريات',desc:'مراحل مستقلة مبنية على سجلات النظام.',render:funnel},
   {id:'quotes',title:'حالة التحقق من العروض',desc:'عروض موثقة مقابل عروض تحت المراجعة.',render:donut},
   {id:'trend',title:'حركة النشاط',desc:'اتجاه النشاط والعروض في الفترة المحددة.',render:trend},
   {id:'requests',title:'أوامر الشراء النشطة',desc:'افتح الطلب مباشرة لمراجعة الموردين والأدلة.',render:requestCards}];
  const rows=globalThis.ALHARIRAgentNativeLayout.buildDashboardRows(specs.map(x=>({...x,width:1})),2);
  rows.forEach(row=>row.panels.forEach(spec=>{const p=panel(spec.title,spec.desc);spec.render(p,m);area.append(p);}));
  document.getElementById('pilotStatus').textContent='تم جلب المؤشرات من واجهات Procurement · '+(m.demo?'بيانات وهمية':'بيانات مسجلة')+' · نطاق النشاط آخر '+m.days+' يومًا.';
 }
 async function init(){
  const select=document.getElementById('pilotRequest'),range=document.getElementById('pilotRange');
  const status=document.getElementById('pilotStatus');let cache=null;
  const display=()=>{if(cache)render(model(cache.state,cache.report,cache.comparison,select.value,Number(range.value)));};
  async function refresh(){status.textContent='جارٍ تحديث المؤشرات...';
   try{cache=await loadData();const prev=select.value;
    select.replaceChildren(new Option('جميع الطلبات',''));
    (cache.state.requests||[]).forEach(r=>select.append(new Option(r.title||r.product||r.id,r.id)));
    if([...select.options].some(x=>x.value===prev))select.value=prev;
    display();
   }catch(e){status.textContent='تعذر تحميل اللوحة: '+e.message+' · تحقق من تسجيل الدخول.';}
  }
  select.addEventListener('change',display);range.addEventListener('change',display);
  document.getElementById('pilotRefresh').addEventListener('click',refresh);await refresh();
 }
 return {ENDPOINTS,model,loadData,init,inRange,render};
});