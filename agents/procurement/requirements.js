const REQUESTS={
 'RFQ-001':{
  id:'RFQ-001',
  title:"Cold Storage Project – Sana'a",
  category:'cold_storage',
  application:'Fresh fruits and vegetables',
  location:"Sana'a, Yemen",
  temperature:{min_c:0,max_c:5},
  max_storage_tons:70,
  configurations:[
   {length_m:8,width_m:6,height_m:5,quantity:1},
   {length_m:12,width_m:6,height_m:5,quantity:1}
  ],
  scope:['insulated_panels','cold_room_door','condensing_unit_compressor','evaporator','control_system','installation_accessories'],
  technical_requirements:{
   cooling_load_kw:true,refrigeration_capacity_kw:true,compressor_brand:true,compressor_model:true,
   evaporator_brand:true,evaporator_model:true,daily_product_load:true,product_entry_temperature:true,
   pull_down_time:true,power_kwh_24h:true,panel_type:true,panel_density:true,panel_thickness:true,
   floor_specification:true,spare_parts:true
  },
  commercial_requirements:{
   fob_price:true,fob_port:true,cbm:true,gross_weight:true,production_lead_time:true,
   warranty:true,payment_terms:true,dealer_price:true,future_supply:true
  },
  preferences:{power_sources:['diesel_generator','solar'],energy_efficiency:'high',relationship:'long_term'},
  company:{name:'Alharir shipping and export',locations:["Guangzhou, People's Republic of China","Sana'a, Republic of Yemen"],email:'Alharirexport@gmail.com'}
 }
};
function getRequest(id){return REQUESTS[id]||null}
function requiredQuoteFields(r){return [...Object.entries(r.technical_requirements||{}),...Object.entries(r.commercial_requirements||{})].filter(([,v])=>v===true).map(([k])=>k)}
module.exports={REQUESTS,getRequest,requiredQuoteFields};
