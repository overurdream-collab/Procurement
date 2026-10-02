function risk(category,severity,risk,evidence,recommended_action){
  return {category,severity,risk,evidence,recommended_action};
}
function analyzeRisks(q={}){
  const out=[];
  if(!q.cooling_load_kw) out.push(risk('technical','high','Cooling load calculation missing','Quotation has no cooling_load_kw','Request cooling-load calculation and design assumptions'));
  if(!q.power_kwh_24h) out.push(risk('technical','medium','24h energy consumption missing','Quotation has no power_kwh_24h','Request estimated kWh/24h'));
  if(!q.compressor_brand || !q.compressor_model) out.push(risk('technical','medium','Compressor identification incomplete','Brand/model missing','Request exact compressor brand and model'));
  if(!q.warranty) out.push(risk('commercial','medium','Warranty terms missing','Warranty not stated','Request written warranty terms'));
  if(!q.spare_parts) out.push(risk('supply_chain','medium','Spare-parts support not confirmed','Spare-parts field missing','Confirm availability and lead time for critical spares'));
  if(!q.payment_terms) out.push(risk('payment','high','Payment terms missing','Payment terms not stated','Request payment schedule before commercial evaluation'));
  if(!q.production_lead_time) out.push(risk('delivery','medium','Production lead time missing','Lead time not stated','Request production lead time'));
  if(!q.fob_port) out.push(risk('commercial','medium','FOB port missing','FOB port not stated','Request FOB port'));
  return out;
}
module.exports={analyzeRisks};
