function b64decode(data=''){return Buffer.from(data.replace(/-/g,'+').replace(/_/g,'/'),'base64')}
function collectAttachments(payload,out=[]){for(const p of payload?.parts||[]){if(p.filename&&p.body?.attachmentId)out.push({filename:p.filename,mimeType:p.mimeType||'',attachmentId:p.body.attachmentId});collectAttachments(p,out)}return out}
async function fetchAttachment(gmail,messageId,a){const x=await gmail('messages/'+messageId+'/attachments/'+a.attachmentId);return b64decode(x.data||'')}
function extractText(buffer,mimeType,filename){const name=(filename||'').toLowerCase();if((mimeType||'').startsWith('text/')||name.endsWith('.txt')||name.endsWith('.csv'))return buffer.toString('utf8');return ''}
async function ingestAttachments({gmail,messageId,payload}){const meta=collectAttachments(payload),docs=[];for(const a of meta){const buf=await fetchAttachment(gmail,messageId,a),text=extractText(buf,a.mimeType,a.filename);docs.push({...a,size:buf.length,text,requires_document_ai:!text})}return docs}
module.exports={collectAttachments,ingestAttachments};
