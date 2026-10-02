const {analyzeQuotation}=require('./agent');
const {configured,extractWithAI}=require('./document-intelligence');

async function runProcurementWorkflow({supplier,emailText='',documents=[],extractor=null}){
  const combined=[emailText,...documents.map(d=>d.text||'')].filter(Boolean).join('\n\n');
  let extracted={},mode='rules';
  const chosen=extractor||(configured()?extractWithAI:null);
  if(chosen){
    extracted=(await chosen({supplier,text:combined,documents}))||{};
    mode=extractor?'custom':'ai';
  }
  const source_attachments=documents.map(d=>({filename:d.filename,mimeType:d.mimeType,size:d.size,requires_document_ai:d.requires_document_ai}));
  const analysis=analyzeQuotation({supplier,...extracted,source_attachments});
  return {...analysis,extraction_mode:mode,evidence:extracted.evidence||{},document_status:source_attachments};
}
module.exports={runProcurementWorkflow};
