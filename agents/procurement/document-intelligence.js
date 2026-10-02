const {QUOTE_FIELDS}=require('./quote-schema');

const MODEL=process.env.OPENAI_MODEL||'gpt-5-mini';

function configured(){return Boolean(process.env.OPENAI_API_KEY)}

function responseText(data){
  if(data.output_text)return data.output_text;
  return (data.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join('');
}

function cleanJson(text=''){
  return text.trim().replace(/^\`\`\`json\s*/i,'').replace(/\s*\`\`\`$/,'');
}

async function extractWithAI({supplier,text='',documents=[]}){
  if(!configured())return null;
  const fields=QUOTE_FIELDS.filter(x=>x!=='supplier');
  const prompt=[
    'You extract facts from supplier quotations for cold-storage procurement.',
    'Return one JSON object only. Never infer or guess missing values.',
    'Unknown values must be null.',
    'Required keys: '+fields.join(', ')+', confidence, evidence.',
    'confidence is 0 to 1.',
    'evidence is an object keyed by extracted field; each value must briefly identify the source text or document.',
    'Supplier: '+supplier,
    'Email/document text:',
    text.slice(0,60000),
    'Attachment names: '+documents.map(d=>d.filename).join(', ')
  ].join('\n');

  const r=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,input:prompt})
  });
  const data=await r.json();
  if(!r.ok)throw Error(data.error?.message||'document_ai_error');
  const parsed=JSON.parse(cleanJson(responseText(data)));
  const safe={supplier};
  for(const key of fields)safe[key]=parsed[key]??null;
  safe.confidence=Number.isFinite(parsed.confidence)?parsed.confidence:null;
  safe.evidence=parsed.evidence&&typeof parsed.evidence==='object'?parsed.evidence:{};
  return safe;
}

module.exports={configured,extractWithAI};
