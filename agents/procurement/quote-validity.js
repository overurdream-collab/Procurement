const MEANINGFUL_FIELDS=[
 'price','fob_price','currency','cooling_load_kw','refrigeration_capacity_kw',
 'compressor_brand','compressor_model','evaporator_brand','evaporator_model',
 'daily_product_load','product_entry_temperature','pull_down_time','power_kwh_24h',
 'panel_type','panel_density','panel_thickness','floor_specification','fob_port',
 'cbm','gross_weight','production_lead_time','warranty','payment_terms','spare_parts',
 'dealer_price','future_supply'
];
function hasMeaningfulQuoteData(q={}){
 return MEANINGFUL_FIELDS.some(k=>q[k]!==null&&q[k]!==undefined&&q[k]!=='');
}
function quoteCoverage(q={}){
 const filled=MEANINGFUL_FIELDS.filter(k=>q[k]!==null&&q[k]!==undefined&&q[k]!=='').length;
 return {filled,total:MEANINGFUL_FIELDS.length,percent:Math.round((filled/MEANINGFUL_FIELDS.length)*100)};
}
module.exports={MEANINGFUL_FIELDS,hasMeaningfulQuoteData,quoteCoverage};
