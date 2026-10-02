const assert=require('assert');
const {canExecute,requestApproval,consumeApproval}=require('../agents/procurement/approval-policy');

(function(){
 const st={settings:{autoFollowup:false,autoSend:false},approvals:[]};
 assert.equal(canExecute(st,'followup',{explicitUser:true}),true);
 assert.equal(canExecute(st,'followup',{explicitUser:false}),false);
 const a=requestApproval(st,{type:'followup',title:'Follow up',payload:{rfqId:'RFQ-001'}});
 assert.equal(a.status,'pending');
 assert.equal(st.approvals.length,1);
 const same=requestApproval(st,{type:'followup',title:'Follow up',payload:{rfqId:'RFQ-001'}});
 assert.equal(same.id,a.id);
 assert.equal(st.approvals.length,1);
 a.status='approved';
 assert.equal(canExecute(st,'followup',{explicitUser:false}),true);
 consumeApproval(st,'followup');
 assert(a.consumedAt);
 assert.equal(canExecute(st,'followup',{explicitUser:false}),false);
 console.log('Procurement approval policy tests passed');
})();
