const {QUOTE_FIELDS}=require('./quote-schema');
function findMissingFields(q={}){return QUOTE_FIELDS.filter(k=>q[k]===null||q[k]===undefined||q[k]==='');}
function buildFollowup(q={}){
  const missing=findMissingFields(q);
  if(!missing.length) return null;
  return {supplier:q.supplier,missing_fields:missing,subject:'Missing information – RFQ-001',body:'Please provide the following missing information for RFQ-001:\n\n- '+missing.join('\n- ')};
}
module.exports={findMissingFields,buildFollowup};
