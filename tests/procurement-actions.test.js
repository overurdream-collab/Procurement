const assert=require('assert');
const {ensureSupplier,sendRfq}=require('../agents/procurement/actions');
const {getRequest,requiredQuoteFields}=require('../agents/procurement/requirements');
const {generateRfq}=require('../agents/procurement/rfq-generator');

(async function(){
 const request=getRequest('RFQ-001');
 assert.equal(request.application,'Fresh fruits and vegetables');
 assert.equal(request.configurations.length,2);
 assert(requiredQuoteFields(request).includes('power_kwh_24h'));
 const generated=generateRfq(request);
 assert(generated.body.includes('8 × 6 × 5 m'));
 assert(generated.body.includes('12 × 6 × 5 m'));
 assert(generated.body.includes('FOB price'));

 const st={suppliers:[],activity:[]};
 const first=ensureSupplier(st,{email:'factory@example.com'});
 assert.equal(first.created,true);
 const second=ensureSupplier(st,{email:'FACTORY@example.com'});
 assert.equal(second.created,false);
 assert.equal(st.suppliers.length,1);
 let captured=null;
 const result=await sendRfq({st,email:'factory@example.com',rfqId:'RFQ-001',sendMail:async(to,subject,body)=>{captured={to,subject,body};return {id:'msg-1',threadId:'thread-1'}}});
 assert.equal(result.supplier.status,'تم الإرسال');
 assert.equal(result.supplier.messageId,'msg-1');
 assert.equal(result.supplier.rfqId,'RFQ-001');
 assert(captured.body.includes('Fresh fruits and vegetables'));
 assert(captured.body.includes('Estimated energy consumption (kWh/24h)'));
 assert.equal(st.activity[0].type,'rfq_sent');
 console.log('Procurement agent action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
