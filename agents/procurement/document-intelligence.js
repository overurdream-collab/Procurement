const {QUOTE_FIELDS}=require('./quote-schema');
const MODEL=process.env.OPENAI_MODEL||'gpt-5-mini';
function configured(){return Boolean(process.env.OPENAI_API_KEY)}
function responseText(data){if(data.output_text)return data.output_text;return (data.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join('')}
function cleanJson(text=''){return text.trim().replace(/^\`\`\`json\s*/i,'').replace(/\s*\`\`\`$/,'')}
function fileInput(d){if(!d.data_base64)return null;if(d.type==='image')return {type:'input_image',image_url:'data:'+(d.mimeType||'image/jpeg')+';base64,'+d.data_base64};if(d.type==='pdf')return {type:'input_file',filename:d.filename,file_data:'data:application/pdf;base64,'+d.data_base64};return null}
async function extractWithAI({supplier,text='',documents=[]}){
 if(!configured())return null;
 const fields=QUOTE_FIELDS.filter(x=>x!=='supplier');
 const instructions=['Extract cold-storage supplier quotation facts.','Never guess. Missing values must be null.','Return JSON only.','Keys: '+fields.join(', ')+', confidence, evidence.','confidence must be 0..1. evidence maps each extracted field to a short source reference.','Supplier: '+supplier,'Email/text content:',text.slice(0,50000)].join('\n');
 const content=[{type:'input_text',text:instructions}];
 for(const d of documents){const x=fileInput(d);if(x)content.push(x);else if(d.type==='spreadsheet')content.push({type:'input_text',text:'Spreadsheet attachment '+d.filename+' is present but binary spreadsheet parsing is not available in this stage; do not infer its contents.'})}
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,input:[{role:'user',content}]})});
 const data=await r.json();if(!r.ok)throw Error(data.error?.message||'document_ai_error');
 const parsed=JSON.parse(cleanJson(responseText(data))),safe={supplier};
 for(const key of fields)safe[key]=parsed[key]??null;
 safe.confidence=Number.isFinite(parsed.confidence)?parsed.confidence:null;
 safe.evidence=parsed.evidence&&typeof parsed.evidence==='object'?parsed.evidence:{};
 return safe;
}
module.exports={configured,extractWithAI,fileInput};
