function approvalSetting(action){
 const map={followup:'autoFollowup',send:'autoSend',exclude:'autoExclude',award:'autoAward'};
 return map[action]||null;
}
function canExecute(st,action,{explicitUser=false}={}){
 if(explicitUser)return true;
 const key=approvalSetting(action);
 if(key&&st.settings?.[key])return true;
 return (st.approvals||[]).some(a=>a.type===action&&a.status==='approved'&&!a.consumedAt);
}
function requestApproval(st,{type,title,payload={}}){
 st.approvals=st.approvals||[];
 const existing=st.approvals.find(a=>a.type===type&&a.status==='pending'&&JSON.stringify(a.payload||{})===JSON.stringify(payload||{}));
 if(existing)return existing;
 const a={id:'A-'+Date.now(),type,title,status:'pending',payload,createdAt:new Date().toISOString()};
 st.approvals.unshift(a);return a;
}
function consumeApproval(st,action){
 const a=(st.approvals||[]).find(x=>x.type===action&&x.status==='approved'&&!x.consumedAt);
 if(a)a.consumedAt=new Date().toISOString();
 return a||null;
}
module.exports={approvalSetting,canExecute,requestApproval,consumeApproval};
