const {requiredQuoteFields}=require('./requirements');
const LABELS={
 cooling_load_kw:'Cooling load and required refrigeration capacity (kW)',refrigeration_capacity_kw:'Required refrigeration capacity (kW)',
 compressor_brand:'Compressor brand',compressor_model:'Compressor model',evaporator_brand:'Evaporator brand',evaporator_model:'Evaporator model',
 daily_product_load:'Recommended daily product intake',product_entry_temperature:'Product entry temperature',pull_down_time:'Pull-down time',
 power_kwh_24h:'Estimated energy consumption (kWh/24h)',panel_type:'Insulation panel type (PIR/PU)',panel_density:'Panel density',
 panel_thickness:'Panel thickness',floor_specification:'Floor insulation specification',spare_parts:'Spare parts availability/list',
 fob_price:'FOB price',fob_port:'FOB port',cbm:'Total CBM',gross_weight:'Gross weight',production_lead_time:'Production lead time',
 warranty:'Warranty',payment_terms:'Payment terms',dealer_price:'Dealer/long-term partner price',future_supply:'Long-term equipment/parts supply confirmation'
};
function dims(r){let x=(r.configurations||[]).map(x=>`${x.length_m} × ${x.width_m} × ${x.height_m} m (Qty: ${x.quantity||1})`).join('\n');return x||('Quantity: '+(r.quantity||'Please quote as specified'))}
function generateRfq(r,{language='english'}={}){
 if(!r)throw Error('rfq_not_found');
 const fields=requiredQuoteFields(r).map(k=>'• '+(LABELS[k]||k)).join('\n');
 const subject=`${r.id}: Request for Quotation – ${r.title}`;
 const body=`Dear Sales Team,

We are sourcing a complete ${r.category.replaceAll('_',' ')} system for ${r.application} in ${r.location}.

Please quote separately for:
${dims(r)}

${r.temperature&&r.temperature.min_c!=null?'Operating temperature: '+r.temperature.min_c+'°C to '+r.temperature.max_c+'°C':''}
${r.max_storage_tons?'Maximum target storage: approximately '+r.max_storage_tons+' tons.':''}

Required scope:
${(r.scope||[]).map(x=>'• '+x.replaceAll('_',' ')).join('\n')}

Please include:
${fields}

Power may be supplied by diesel generator or solar, so energy efficiency is important. We are seeking a long-term manufacturing partner and stable future supply.

Please propose the technical solution you consider most suitable for each configuration.

Best regards,
${r.company?.name||''}
${(r.company?.locations||[]).join(' / ')}
${r.company?.email||''}`;
 return {subject,body,language};
}
module.exports={generateRfq};
