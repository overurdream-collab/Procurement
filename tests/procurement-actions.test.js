const assert=require('assert');
const {ensureSupplier,sendRfq}=require('../agents/procurement/actions');

(async function(){
 const st={suppliers:[],activity:[]};
 const first=ensureSupplier(st,{email:'factory@example.com'});
 assert.equal(first.created,true);
 assert.equal(st.suppliers.length,1);
 const second=ensureSupplier(st,{email:'FACTORY@example.com'});
 assert.equal(second.created,false);
 assert.equal(st.suppliers.length,1);
 const result=await sendRfq({st,email:'factory@example.com',rfqId:'RFQ-001',sendMail:async()=>({id:'msg-1',threadId:'thread-1'})});
 assert.equal(result.supplier.status,'تم الإرسال');
 assert.equal(result.supplier.messageId,'msg-1');
 assert.equal(result.supplier.rfqId,'RFQ-001');
 assert.equal(st.activity[0].type,'rfq_sent');
 console.log('Procurement agent action tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
