'use strict';
// Request-scoped, evidence-first procurement analysis. No LLM, guessed values, search, or writes.
const clean=(value,max=2200)=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const numeric=(text,re)=>{const m=clean(text).match(re);return m?Number(m[1]):null;};
function analyzeRequest(request){
 if(!request||typeof request!=='object')throw Error('request_required');
 const id=clean(request.id,100),product=clean(request.product||request.title,180),
  specifications=clean(request.specifications,2200),quantity=clean(request.quantity,100),
  incoterm=clean(request.incoterm||'',15).toUpperCase(),currency=clean(request.currency||'',10).toUpperCase(),
  market=clean(request.targetMarkets||request.deliveryCountry||'',180);
 const t=(product+' '+specifications).toLowerCase();
 const isPanel=/\b(?:pir|pur|puf|pu)\b|(?:cold\s*room|insulated|sandwich)\s*panels?|(?:ألواح|ساندوتش|عزل).*?(?:تبريد|p[iu]r|غرف)/i.test(t);
 const isColdRoom=!isPanel&&/cold\s*(?:storage|room)|walk.?in\s*(?:cooler|freezer)|غرف[ة]?\s*(?:تبريد|تجميد)|مخزن\s*(?:مبرد|مجمد)/i.test(t);
 const isRefrigeration=!isPanel&&!isColdRoom&&/compressor|condensing\s*unit|refrigeration\s*unit|evaporator|ضاغط|كمبروسر|وحدة\s*تكثيف|مبخر/i.test(t);
 const kind=isPanel?'insulated_panels':isColdRoom?'complete_cold_room':isRefrigeration?'refrigeration_equipment':'general_product';
 const panelThickness=numeric(t,/\b(\d{2,3}(?:\.\d+)?)\s*(?:mm|ملم|مم)\b/i);
 const coreDensity=numeric(t,/\b(\d{2,3}(?:\.\d+)?)\s*(?:kg\s*\/?\s*m\s*(?:3|³)|كجم\s*\/\s*م3)\b/i);
 const skinThickness=numeric(t,/(?:steel|sheet|skin|سماكة\s*الصاج|صاج|steel\s*thickness)[^\n\r,;]{0,45}?\b(0\.\d{1,2})\s*(?:mm|ملم|مم)/i)
  ??numeric(t,/\b(0\.\d{1,2})\s*(?:mm|ملم|مم)[^\n\r,;]{0,30}?(?:steel|sheet|skin|صاج)/i);
 const voltage=numeric(t,/\b(\d{3})\s*(?:v|volt|فولت)\b/i);
 const power=numeric(t,/\b(\d+(?:\.\d+)?)\s*(?:kw|كيلو\s*واط)\b/i);
 const missingCritical=[],missingTechnical=[],missingCommercial=[];
 if(product.length<3)missingCritical.push('اسم المنتج ونوعه');
 if(!quantity)missingCritical.push('الكمية ووحدة القياس');
 if(specifications.length<8)missingCritical.push('مواصفات فنية قابلة للإرسال');
 if(incoterm!=='FOB')missingCommercial.push('تأكيد أساس سعر FOB قبل المقارنة');
 if(!currency)missingCommercial.push('عملة التسعير');
 if(isPanel){
  if(panelThickness===null)missingTechnical.push('سماكة ألواح العزل بالملليمتر');
  if(coreDensity===null)missingTechnical.push('كثافة مادة العزل kg/m³');
  if(skinThickness===null)missingTechnical.push('سماكة الصاج الخارجي والداخلي');
  if(!/\bPIR\b|\bPUR\b|\bPU\b|بولي\s*يوريثان|بولي\s*أيزو/i.test(t))missingTechnical.push('نوع مادة العزل PIR أو PUR');
 }else if(isColdRoom){
  if(!/[-+]?\d+\s*(?:°\s*c|°c|درجة|celsius)/i.test(t))missingTechnical.push('درجة الحرارة المطلوبة');
  if(!/\b\d+(?:\.\d+)?\s*[×x*]\s*\d+(?:\.\d+)?\s*[×x*]\s*\d+/i.test(t))missingTechnical.push('الأبعاد الداخلية أو المساحة والارتفاع');
  if(!/\b(?:kg|ton|tons|tonnes|طن|كجم)\b/i.test(t))missingTechnical.push('الحمولة وكمية المنتج');
 }else if(isRefrigeration){
  if(power===null)missingTechnical.push('قدرة التبريد المطلوبة kW');
  if(!/r\s*\d{3,4}[a-z]?|refrigerant|الفريون|غاز\s*التبريد/i.test(t))missingTechnical.push('نوع وسيط التبريد');
  if(voltage===null)missingTechnical.push('جهد التشغيل والتردد');
 }
 // FOB port is intentionally unconfirmed: ask suppliers for their departure port.
 missingCommercial.push('ميناء FOB المقترح لكل مورد — يُطلب في العرض ولا يُفترض');
 const categories=isPanel?['panel_door_manufacturer']:isColdRoom?['cold_room_manufacturer']:isRefrigeration?['refrigeration_equipment_manufacturer']:['manufacturer_or_authorized_supplier'];
 const searchBits=[product];
 if(panelThickness!==null&&!/\b\d{2,3}\s*mm\b/i.test(product))searchBits.push(panelThickness+'mm');
 if(isPanel&&/\bPIR\b/i.test(t)&&!/\bPIR\b/i.test(product))searchBits.push('PIR');
 if(isPanel&&/\bPUR\b/i.test(t)&&!/\bPUR\b/i.test(product))searchBits.push('PUR');
 const searchQuery=clean(searchBits.join(' ')+' manufacturer factory',160);
 return {
  requestId:id,analysisMode:'deterministic-rules-no-llm',analysedAt:null,
  productType:kind,normalized:{product,quantity,specifications,incoterm,currency,targetMarkets:market,
   panelThicknessMm:panelThickness,coreDensityKgM3:coreDensity,steelSkinMm:skinThickness,
   voltageV:voltage,coolingPowerKw:power},
  missingCritical,missingTechnical,missingCommercial,
  supplierCategories:categories,searchQuery,
  canSearch:missingCritical.length===0,
  comparisonPolicy:['مصدر ومستند عرض سعر موثق','المواصفات والكمية ووحدة البيع نفسها','عملة التسعير نفسها','FOB وميناء الشحن نفسه','عدم مقارنة أسعار منتجات أو فئات مختلفة'],
  nextSteps:['مراجعة نواقص المواصفات قبل المراسلة','بحث مصادر عامة ثم تأكيد صفة المصنع وهوية الشركة','التحقق من البريد الرسمي والمستند قبل اعتماد المورد','مراجعة رسالة RFQ والمستلمين صراحة قبل فتح البريد','إدخال عروض الموردين الموثقة في المقارنة الأصلية'],
  caution:'تحليل قواعدي محلي، وليس استنتاج AI أو عرض سعر أو إثبات هوية مورد. لا إرسال ولا حفظ ولا أسعار مختلقة.'
 };
}
module.exports={analyzeRequest};
