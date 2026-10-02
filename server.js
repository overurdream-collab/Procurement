const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {analyzeQuotation,compareQuotations}=require('./agents/procurement/agent');
const {ingestAttachments}=require('./services/documents');
const {runProcurementWorkflow}=require('./agents/procurement/workflow');
const {sendRfq}=require('./agents/procurement/actions');
const {createRequest,updateRequest,approveRequest}=require('./agents/procurement/requirements');
const {generateRfq}=require('./agents/procurement/rfq-generator');
const {canExecute,requestApproval,consumeApproval}=require('./agents/procurement/approval-policy');
const {hasMeaningfulQuoteData,quoteCoverage}=require('./agents/procurement/quote-validity');
const {isCompanyInfoRequest,buildCompanyInfoReply}=require('./agents/procurement/auto-reply');
const DATA=path.join(__dirname,'data.json'),OAUTH=path.join(__dirname,'.gmail-oauth.json'),PUB=path.join(__dirname,'public');
const GCLIENT=process.env.GOOGLE_CLIENT_ID||'',GSECRET=process.env.GOOGLE_CLIENT_SECRET||'',BASE=process.env.APP_BASE_URL||'http://localhost:'+(process.env.PORT||8787),REDIRECT=BASE+'/api/gmail/callback';
const load=()=>JSON.parse(fs.readFileSync(DATA,'utf8')),save=x=>fs.writeFileSync(DATA,JSON.stringify(x,null,2));
const oauth=()=>fs.existsSync(OAUTH)?JSON.parse(fs.readFileSync(OAUTH,'utf8')):{},saveOauth=x=>fs.writeFileSync(OAUTH,JSON.stringify(x,null,2),{mode:0o600});
const json=(r,s,x)=>{r.writeHead(s,{'Content-Type':'application/json; charset=utf-8'});r.end(JSON.stringify(x))},body=req=>new Promise((ok,no)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch(e){no(e)}})});
async function formPost(url,obj){let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(obj)}),t=await r.json();if(!r.ok)throw Error(t.error_description||t.error||'oauth_error');return t}
async function accessToken(){let o=oauth();if(o.access_token&&o.expires_at>Date.now()+60000)return o.access_token;if(!o.refresh_token)throw Error('gmail_not_connected');let t=await formPost('https://oauth2.googleapis.com/token',{client_id:GCLIENT,client_secret:GSECRET,refresh_token:o.refresh_token,grant_type:'refresh_token'});o={...o,...t,expires_at:Date.now()+t.expires_in*1000};saveOauth(o);return o.access_token}
async function gmail(endpoint,opt={}){let token=await accessToken(),r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+endpoint,{...opt,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opt.headers||{})}}),t=await r.json();if(!r.ok)throw Error(t.error?.message||'gmail_error');return t}
const b64url=s=>Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function sendMail(to,subject,text,threadId=null,replyToMessageId=null){let hdr=['To: '+to,'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?='];if(replyToMessageId){hdr.push('In-Reply-To: '+replyToMessageId);hdr.push('References: '+replyToMessageId)}let raw=[...hdr,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',''+text].join('\r\n');let payload={raw:b64url(raw)};if(threadId)payload.threadId=threadId;return gmail('messages/send',{method:'POST',body:JSON.stringify(payload)})}
function headers(m){return Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]))}
function decodePart(p){if(p?.body?.data&&(!p.mimeType||p.mimeType.startsWith('text/')))return Buffer.from(p.body.data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');for(let x of p?.parts||[]){let v=decodePart(x);if(v)return v}return ''}
function attachmentMeta(p,out=[]){for(const x of p?.parts||[]){if(x.filename&&x.body?.attachmentId)out.push({filename:x.filename,mimeType:x.mimeType||'',attachmentId:x.body.attachmentId});attachmentMeta(x,out)}return out}
function isInbound(m){return !(m.labelIds||[]).includes('SENT')}
function emailFromHeader(v=''){let m=String(v).match(/<([^>]+)>/);return (m?m[1]:String(v)).trim().toLowerCase()}
function emailDomain(v=''){let e=emailFromHeader(v),i=e.lastIndexOf('@');return i>=0?e.slice(i+1):''}
function findSupplierBySender(st,from=''){
 const sender=emailFromHeader(from),domain=emailDomain(from);
 let exact=(st.suppliers||[]).find(x=>String(x.email||'').toLowerCase()===sender);
 if(exact)return exact;
 if(domain){let same=(st.suppliers||[]).filter(x=>emailDomain(x.email)===domain);if(same.length===1)return same[0]}
 return null;
}
function migrateLegacyEmptyQuotes(st){
 st.replies=st.replies||[];st.quotes=st.quotes||[];
 const keep=[];
 for(const q of st.quotes){
  if(hasMeaningfulQuoteData(q)){keep.push(q);continue}
  if(!st.replies.some(r=>r.source_message_id&&r.source_message_id===q.source_message_id)){
   st.replies.unshift({id:'R-legacy-'+(q.id||Date.now()),rfqId:q.rfqId||'RFQ-001',supplierId:q.supplierId||null,supplier:q.supplier||'Unknown supplier',subject:q.subject||'',rawText:q.rawText||'',source_message_id:q.source_message_id||null,createdAt:q.createdAt||new Date().toISOString(),kind:'reply_only'});
  }
 }
 st.quotes=keep;
}
function extractQuoteHints(text=''){const v=(re)=>{let m=text.match(re);return m?m[1].trim():null};return {
  price:v(/(?:FOB\s*(?:price)?|total\s*(?:price|amount)|quotation)\s*[:：-]?\s*(?:USD|US\$|\$)?\s*([\d,.]+)/i),
  currency:/\bUSD\b|US\$/i.test(text)?'USD':null,
  cooling_load_kw:v(/cooling\s*load[^\d]{0,30}([\d.]+)\s*kW/i),
  refrigeration_capacity_kw:v(/(?:refrigeration|cooling)\s*capacity[^\d]{0,30}([\d.]+)\s*kW/i),
  power_kwh_24h:v(/([\d.]+)\s*kWh\s*\/\s*24\s*h/i),
  panel_thickness:v(/(?:panel|PIR|PU)[^\n]{0,50}?(\d{2,3})\s*mm/i),
  fob_port:v(/FOB\s+([A-Za-z][A-Za-z .-]{2,30})/i),
  production_lead_time:v(/(?:lead|production)\s*time\s*[:：-]?\s*([^\n,;]+)/i),
  warranty:v(/warranty\s*[:：-]?\s*([^\n;]+)/i),
  payment_terms:v(/payment\s*terms?\s*[:：-]?\s*([^\n;]+)/i)
}}
async function autoHandleSupplierReply(st,{m,h,sub,txt,sup}){
 if(!st.settings?.autoInfoReply)return null;
 st.autoHandledMessages=st.autoHandledMessages||[];
 if(st.autoHandledMessages.includes(m.id))return null;
 if(!isCompanyInfoRequest(txt))return null;
 const reply=buildCompanyInfoReply({supplierName:sup.name});
 const msgId=h['message-id']||null;
 const sent=await sendMail(emailFromHeader(h.from||''),reply.subjectPrefix+sub,reply.body,m.threadId||null,msgId);
 st.autoHandledMessages.push(m.id);
 st.activity.unshift({id:Date.now()+Math.random(),time:new Date().toISOString(),type:'auto_reply',text:'رد الوكيل تلقائيًا على طلب معلومات الشركة من '+sup.name,messageId:m.id,replyMessageId:sent.id||null});
 return {messageId:sent.id||null,threadId:sent.threadId||m.threadId||null};
}
async function syncGmail({force=false}={}){let st=load();migrateLegacyEmptyQuotes(st);let list=await gmail('messages?q='+encodeURIComponent('in:anywhere RFQ-001 newer_than:90d')+'&maxResults=50'),known=new Set(st.gmailMessages||[]),recorded=new Set([...(st.quotes||[]),...(st.replies||[]),...(st.unmatchedReplies||[])].map(x=>x.source_message_id).filter(Boolean)),added=0,analyzed=0;for(let it of list.messages||[]){if(recorded.has(it.id))continue;if(!force&&known.has(it.id))continue;let m=await gmail('messages/'+it.id+'?format=full');if(!isInbound(m))continue;let h=headers(m),from=h.from||'',sub=h.subject||'',txt=decodePart(m.payload)||m.snippet||'';if(!/RFQ-001/i.test(sub+' '+txt))continue;let sup=findSupplierBySender(st,from);if(!sup){st.unmatchedReplies=st.unmatchedReplies||[];st.unmatchedReplies.unshift({id:'U-'+Date.now(),rfqId:'RFQ-001',from,subject:sub,rawText:txt,source_message_id:it.id,createdAt:new Date().toISOString(),kind:'unmatched_reply'});known.add(it.id);added++;st.activity.unshift({id:Date.now()+Math.random(),time:new Date().toISOString(),type:'unmatched_reply',text:'وصل رد RFQ-001 من '+emailFromHeader(from)+' ويحتاج ربطه بمورد',messageId:it.id,subject:sub});continue;}known.add(it.id);sup.status='رد';sup.lastReply=new Date().toISOString();sup.lastSubject=sub;let autoReply=await autoHandleSupplierReply(st,{m,h,sub,txt,sup});let documents=await ingestAttachments({gmail,messageId:it.id,payload:m.payload});let hints=extractQuoteHints([txt,...documents.map(d=>d.text||'')].join('\n'));let workflow=await runProcurementWorkflow({supplier:sup.name,emailText:txt,documents,extractor:process.env.OPENAI_API_KEY?null:async()=>hints});let q={id:'Q-'+Date.now()+'-'+sup.id,rfqId:'RFQ-001',supplierId:sup.id,rawText:txt,...workflow.quote,risks:workflow.risks,followup:workflow.followup,extraction_mode:workflow.extraction_mode,document_status:workflow.document_status,source_message_id:it.id,createdAt:new Date().toISOString()};added++;st.replies=st.replies||[];if(hasMeaningfulQuoteData(q)){q.coverage=quoteCoverage(q);q.kind='quotation';st.quotes=st.quotes||[];st.quotes.unshift(q);st.activity.unshift({id:Date.now()+Math.random(),time:new Date().toISOString(),type:'quote_analyzed',text:'تم استخراج عرض سعر من '+sup.name,messageId:it.id,subject:sub,missingFields:q.missing_fields.length,riskCount:q.risks.length});analyzed++}else{st.replies.unshift({id:'R-'+Date.now()+'-'+sup.id,rfqId:'RFQ-001',supplierId:sup.id,supplier:sup.name,subject:sub,rawText:txt,source_message_id:it.id,createdAt:new Date().toISOString(),kind:'reply_only',auto_reply:autoReply||null});st.activity.unshift({id:Date.now()+Math.random(),time:new Date().toISOString(),type:'supplier_reply',text:'وصل رد من '+sup.name+' بدون بيانات عرض سعر قابلة للمقارنة',messageId:it.id,subject:sub})}}st.gmailMessages=[...known];st.quoteComparison=compareQuotations((st.quotes||[]).filter(q=>q.rfqId==='RFQ-001'&&q.kind!=='reply_only'));save(st);return {added,analyzed,replies:(st.replies||[]).length,quotes:(st.quotes||[]).length}}

const server=http.createServer(async(req,res)=>{try{let u=new URL(req.url,'http://localhost');if(u.pathname==='/api/state'&&req.method==='GET'){let st=load();st.gmail={connected:!!oauth().refresh_token,configured:!!(GCLIENT&&GSECRET)};return json(res,200,st)}
if(u.pathname==='/api/gmail/status'&&req.method==='GET')return json(res,200,{connected:!!oauth().refresh_token,configured:!!(GCLIENT&&GSECRET),redirectUri:REDIRECT});
if(u.pathname==='/api/gmail/connect'&&req.method==='GET'){if(!GCLIENT||!GSECRET)return json(res,400,{error:'missing_google_oauth_config',message:'أضف GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET أولاً.'});let state=crypto.randomBytes(18).toString('hex');saveOauth({...oauth(),state});let q=new URLSearchParams({client_id:GCLIENT,redirect_uri:REDIRECT,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state});res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+q});return res.end()}
if(u.pathname==='/api/gmail/callback'&&req.method==='GET'){let o=oauth();if(!u.searchParams.get('code')||u.searchParams.get('state')!==o.state)return json(res,400,{error:'invalid_oauth_state'});let t=await formPost('https://oauth2.googleapis.com/token',{code:u.searchParams.get('code'),client_id:GCLIENT,client_secret:GSECRET,redirect_uri:REDIRECT,grant_type:'authorization_code'});saveOauth({...t,expires_at:Date.now()+t.expires_in*1000});res.writeHead(302,{Location:'/#agent'});return res.end()}
if(u.pathname==='/api/gmail/disconnect'&&req.method==='POST'){if(fs.existsSync(OAUTH))fs.unlinkSync(OAUTH);return json(res,200,{ok:true})}
if(u.pathname==='/api/gmail/sync'&&req.method==='POST'){let b=await body(req);return json(res,200,await syncGmail({force:!!b.force}))}
if(u.pathname==='/api/agent/comparison'&&req.method==='GET'){let st=load();return json(res,200,{rfqId:'RFQ-001',comparison:compareQuotations((st.quotes||[]).filter(q=>q.rfqId==='RFQ-001'))})}
if(u.pathname==='/api/requests'&&req.method==='POST'){let st=load(),b=await body(req),x=createRequest(st,b);st.activity.unshift({time:new Date().toISOString(),type:'request',text:'إنشاء مسودة '+x.id});save(st);return json(res,201,x)}
let rm=u.pathname.match(/^\/api\/requests\/([^/]+)$/);if(rm&&req.method==='PATCH'){let st=load(),b=await body(req),x=updateRequest(st,rm[1],b);save(st);return json(res,200,x)}
let ra=u.pathname.match(/^\/api\/requests\/([^/]+)\/approve$/);if(ra&&req.method==='POST'){let st=load(),x=approveRequest(st,ra[1]);st.activity.unshift({time:new Date().toISOString(),type:'request_approved',text:'اعتماد '+x.id});save(st);return json(res,200,{request:x,rfq:generateRfq(x)})}
let rp=u.pathname.match(/^\/api\/requests\/([^/]+)\/preview$/);if(rp&&req.method==='GET'){let st=load(),x=(st.requests||[]).find(r=>r.id===rp[1]);if(!x)return json(res,404,{error:'not_found'});return json(res,200,{request:x,rfq:generateRfq(x)})}
let sm=u.pathname.match(/^\/api\/suppliers\/([^/]+)$/);if(sm&&req.method==='PATCH'){let st=load(),b=await body(req),x=st.suppliers.find(x=>x.id===sm[1]);if(!x)return json(res,404,{error:'not_found'});Object.assign(x,b);save(st);return json(res,200,x)}
let am=u.pathname.match(/^\/api\/approvals\/([^/]+)$/);if(am&&req.method==='PATCH'){let st=load(),b=await body(req),x=st.approvals.find(x=>x.id===am[1]);if(!x)return json(res,404,{error:'not_found'});x.status=b.status||x.status;x.updatedAt=new Date().toISOString();save(st);return json(res,200,x)}
if(u.pathname==='/api/settings'&&req.method==='PATCH'){let st=load(),b=await body(req);st.settings={...st.settings,...b};save(st);return json(res,200,st.settings)}
if(u.pathname==='/api/quotes'&&req.method==='POST'){let st=load(),b=await body(req),x={id:'Q-'+Date.now(),...b,createdAt:new Date().toISOString()};st.quotes.unshift(x);save(st);return json(res,201,x)}
if(u.pathname==='/api/agent/run'&&req.method==='POST'){let st=load(),b=await body(req);if(b.action==='send_rfq'){if(!b.email)return json(res,400,{error:'supplier_email_required'});let explicitUser=b.source==='user';if(!canExecute(st,'send',{explicitUser})){let approval=requestApproval(st,{type:'send',title:'إرسال RFQ إلى '+b.email,payload:{email:b.email,name:b.name||'',rfqId:b.rfqId||'RFQ-001'}});save(st);return json(res,409,{error:'approval_required',message:'تم إنشاء موافقة حقيقية قبل الإرسال',approval})}let result=await sendRfq({st,email:b.email,name:b.name,rfqId:b.rfqId||'RFQ-001',sendMail});if(!explicitUser)consumeApproval(st,'send');save(st);return json(res,200,{ok:true,action:'send_rfq',...result})}if(b.action==='followup'){let explicitUser=b.source==='user';if(!canExecute(st,'followup',{explicitUser})){let approval=requestApproval(st,{type:'followup',title:'إرسال متابعة للموردين غير المستجيبين',payload:{rfqId:b.rfqId||'RFQ-001'}});save(st);return json(res,409,{error:'approval_required',message:'تم إنشاء موافقة حقيقية قبل الإرسال',approval})}let targets=st.suppliers.filter(s=>s.status!=='رد'&&!s.excluded&&s.email);let sent=[];for(let s of targets){await sendMail(s.email,'Follow-up: RFQ-001 – Cold Storage Project, Sana’a','Dear '+s.name+',\n\nThis is a follow-up regarding RFQ-001 for our cold storage project in Sana’a, Yemen. Please send your technical and commercial quotation, including cooling load, equipment brands/models, daily pull-down capacity, 24h power consumption, panel specifications, FOB price/port, CBM/gross weight, lead time, warranty and payment terms.\n\nBest regards,\nAlharir shipping and export');sent.push(s.name)}if(!explicitUser)consumeApproval(st,'followup');st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تم إرسال متابعة إلى '+sent.length+' مورد'});save(st);return json(res,200,{ok:true,sent})}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تشغيل الوكيل: '+(b.action||'analyze')});save(st);return json(res,200,{ok:true,action:b.action||'analyze'})}
let file=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');let fp=path.join(PUB,file);if(fp.startsWith(PUB)&&fs.existsSync(fp)){let ext=path.extname(fp);res.writeHead(200,{'Content-Type':ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript':'text/plain'});return fs.createReadStream(fp).pipe(res)}res.writeHead(404);res.end('Not found')
}catch(e){json(res,500,{error:e.message})}});server.listen(process.env.PORT||8787,()=>console.log('Procurement V2: http://localhost:'+(process.env.PORT||8787)));