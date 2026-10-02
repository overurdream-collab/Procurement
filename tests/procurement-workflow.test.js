const assert=require('assert');
const {runProcurementWorkflow}=require('../agents/procurement/workflow');
(async function(){
 const result=await runProcurementWorkflow({supplier:'Test Factory',emailText:'RFQ-001',documents:[{filename:'quote.pdf',mimeType:'application/pdf',size:1234,text:''}]});
 assert.equal(result.quote.supplier,'Test Factory');
 assert.equal(result.extraction_mode,'rules');
 assert.equal(result.document_status.length,1);\n assert.deepEqual(result.evidence,{});
 assert.equal(result.document_status[0].requires_document_ai,undefined);
 console.log('Procurement workflow tests passed');
})().catch(function(e){console.error(e);process.exit(1)});
