const {QUOTE_FIELDS}=require('./quote-schema');
const {getRequest,requiredQuoteFields}=require('./requirements');
function findMissingFields(q={},rfqId='RFQ-001'){const r=getRequest(rfqId);const fields=r?requiredQuoteFields(r):QUOTE_FIELDS.filter(k=>k!=='supplier');return fields.filter(k=>q[k]===null||q[k]===undefined||q[k]==='')}
function buildFollowup(q={},rfqId='RFQ-001'){const missing=findMissingFields(q,rfqId);if(!missing.length)return null;return {supplier:q.supplier,rfqId,missing_fields:missing,subject:'Missing information – '+rfqId,body:'Please provide the following missing information for '+rfqId+':\n\n- '+missing.join('\n- ')}}
module.exports={findMissingFields,buildFollowup};
