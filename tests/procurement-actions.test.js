const assert=require('assert');
const {ensureSupplier,sendRfq}=require('../agents/procurement/actions');
const {createRequest,approveRequest,requiredQuoteFields}=require('../agents/procurement/requirements');
const {generateRfq}=require('../agents/procurement/rfq-generator');

(async function(){
 const st={requests:[],suppliers:[],activity:[]};
 const request=createRequest(st,{id:'RFQ-001',title:'Cold Storage',category:'cold_storage',application:'Fresh fruits and vegetables',location:"Sana'a, Yemen",temperature:{min_c:0,max_c:5},configurations:[{length_m:8,width_m:6,height_m:5,quantity:1},{length_m:12,width_m:6,height_m:5,quantity:1}],scope:['insulated_panels'],technical_requirements:{power_kwh_24h:true},commercial_requirements:{fob_price:true}});
 assert.equal(request.status,'مسودة');
 assert(requiredQuoteFields(request).includes('power_kwh_24h'));
 assert.throws(()=>generateRfq(null),/rfq_not_found/);
 approveRequest(st,'RFQ-001');
 const generated=generateRfq(request);
 assert(generated.body.includes('8 × 6 × 5 m'));
 assert(generated.body.includes('FOB price'));
 const first=ensureSupplier(st,{email:'factory@example.com'});assert.equal(first.created,true);
 const second=ensureSupplier(st,{email:'FACTORY@example.com'});assert.equal(second.created,false);
 let captured=null;
 const result=await sendRfq({st,email:'factory@example.com',rfqId:'RFQ-001',sendMail:async(to,subject,body)=>{captured={to,subject,body};return {id:'msg-1',threadId:'thread-1'}}});
 assert.equal(result.supplier.status,'تم الإرسال');assert.equal(result.supplier.messageId,'msg-1');assert(captured.body.includes('Fresh fruits and vegetables'));
 console.log('Procurement agent action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
