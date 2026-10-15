import { useActionQuery } from "@agent-native/core/client/hooks";
export default function ProcurementRoute(){
 const {data,isLoading,error}=useActionQuery("compare-quotations",{rfqId:"RFQ-POC-001"}) as any;
 const c=data as any;
 return <main dir="rtl" style={{padding:"2rem",fontFamily:"system-ui",maxWidth:1080,margin:"auto"}}>
  <div style={{background:"#13254c",color:"#fff",borderRadius:20,padding:28}}>
   <p style={{color:"#f7c74b",margin:0}}>ALHARIR — تجربة Agent-Native</p>
   <h1 style={{fontSize:"2rem",margin:"8px 0"}}>مركز المشتريات الذكي</h1>
   <p>بيانات تجريبية فقط · مقارنة FOB · نتائج قابلة للتحقق</p>
  </div>
  <section style={{marginTop:30}}>
   <h2>مقارنة طلب RFQ-POC-001</h2>
   {isLoading?<p>جار تحميل النتائج…</p>:error?<p role="alert">تعذر تحميل الإجراء: {String(error)}</p>:<div>
    <p><strong>المورد الأفضل:</strong> {c?.winner?.vendor??"لا يوجد عرض مؤهل"} — {c?.winner?.totalCents!=null?(c.winner.totalCents/100).toFixed(2)+" USD":""}</p>
    <p><strong>عدد العروض المؤهلة:</strong> {c?.eligibleCount??0}</p>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"right"}}>
     <thead><tr><th>المورد</th><th>التقييم</th><th>الإجمالي USD</th><th>الملاحظات</th></tr></thead>
     <tbody>{(c?.offers??[]).map((q:any)=><tr key={q.id} style={{borderTop:"1px solid #ddd"}}><td style={{padding:12}}>{q.vendor}</td><td>{q.eligible?"مؤهل":"مستبعد"}</td><td>{q.totalCents==null?"—":(q.totalCents/100).toFixed(2)}</td><td>{q.issues.join("، ")||"مطابق"}</td></tr>)}</tbody>
    </table></div>
   </div>}
  </section>
  <p style={{marginTop:25,color:"#687487"}}>البيانات وهمية، ولا توجد مراسلات أو موافقات أو عمليات دفع حقيقية.</p>
 </main>;
}
