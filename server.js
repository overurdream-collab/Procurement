const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const OAUTH=path.join(__dirname,'.gmail-oauth.json'),PUB=path.join(__dirname,'public');

// Load a local .env file without adding a dependency. Existing process environment wins.
const ENVFILE=path.join(__dirname,'.env');
if(fs.existsSync(ENVFILE)){
  for(const raw of fs.readFileSync(ENVFILE,'utf8').split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith('#'))continue;
    const i=line.indexOf('='); if(i<1)continue;
    const k=line.slice(0,i).trim(); let v=line.slice(i+1).trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
    if(process.env[k]===undefined)process.env[k]=v;
  }
}
const {guardHostedRequest,requireHostedAccessConfig}=require('./staging-access');
requireHostedAccessConfig();
const {productionConfig,guardProduction}=require('./commercial-access');
const {createStateStore}=require('./persistent-store');
productionConfig();
const HOSTED_DEMO=process.env.STAGING_HOSTED==='true';
const LIVE=process.env.PROCUREMENT_PRODUCTION==='true';
const DATA=HOSTED_DEMO?path.join(require('node:os').tmpdir(),'alharir-procurement-synthetic-demo-'+crypto.randomBytes(8).toString('hex')+'.json'):path.join(__dirname,'data.json');
if(HOSTED_DEMO && !fs.existsSync(DATA)){
  fs.copyFileSync(path.join(__dirname,'staging-demo-data.json'),DATA);
}
const GCLIENT=(process.env.GOOGLE_CLIENT_ID||'').trim(),GSECRET=(process.env.GOOGLE_CLIENT_SECRET||'').trim(),BASE=(process.env.APP_BASE_URL||'http://localhost:'+(process.env.PORT||8787)).replace(/\/$/,''),REDIRECT=BASE+'/api/gmail/callback';
const oauthConfig=()=>{
  if(!GCLIENT||!GSECRET)return {ok:false,error:'missing_google_oauth_config',message:'إعداد Gmail غير مكتمل. أضف GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في متغيرات البيئة الخاصة بخدمة Render المحمية.'};
  if(LIVE && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.GMAIL_EXPECTED_EMAIL||''))
    return {ok:false,error:'missing_expected_mailbox',message:'حدد GMAIL_EXPECTED_EMAIL لضمان ربط حساب الشركة الصحيح فقط.'};
  if(!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(GCLIENT))return {ok:false,error:'invalid_google_client_id',message:'GOOGLE_CLIENT_ID غير صالح. استخدم OAuth Client ID من نوع Web application والمنتهي بـ apps.googleusercontent.com.'};
  if(!/^https?:\/\//i.test(BASE))return {ok:false,error:'invalid_app_base_url',message:'APP_BASE_URL غير صالح.'};
  return {ok:true};
};
const RECENT_SUPPLIERS=[
  {id:'SA1',name:'Al Musairiey Steel Industries',country:'Saudi Arabia',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'SA2',name:'BTR',country:'Saudi Arabia',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'SA3',name:'TSSC',country:'Saudi Arabia',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'OM1',name:'Panel Tech International',country:'Oman',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'OM2',name:'Al Jazeera Panel',country:'Oman',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'CN1',name:'Shandong Lantian',country:'China',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'CN2',name:'Dongmeng Group',country:'China',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'},
  {id:'CN3',name:'Propanel',country:'China',email:null,status:'مورد جديد — يحتاج تحقق التواصل',excluded:false,source:'recent_sourcing',category:'panel_door_manufacturer'}
];
const SUPPLIER_COUNTRIES={
  'YangtzeCooling':'China',
  'Yanghu Refrigeration':'China',
  'Yourshine Group':'China',
  'Hengliang Cooling':'China',
  'Xiamen Jialiang':'China',
  'Guangzhou Cryo Systems':'China',
  'YuanShengHeTong':'China',
  'Emaar Industries LLC':'Oman',
  'Shanghai Champion':'China',
  'Deye':'China',
  'Al Musairiey Steel Industries':'Saudi Arabia',
  'BTR':'Saudi Arabia',
  'TSSC':'Saudi Arabia',
  'Panel Tech International':'Oman',
  'Al Jazeera Panel':'Oman',
  'Shandong Lantian':'China',
  'Dongmeng Group':'China',
  'Propanel':'China'
};
function ensureRecentSuppliers(st){
  st.suppliers=Array.isArray(st.suppliers)?st.suppliers:[];
  let changed=false;
  for(const s of RECENT_SUPPLIERS){
    let exists=st.suppliers.some(x=>String(x.name||'').trim().toLowerCase()===s.name.toLowerCase());
    if(!exists){st.suppliers.push({...s});changed=true}
  }
  for(const s of st.suppliers){
    if(!s.country&&SUPPLIER_COUNTRIES[s.name]){s.country=SUPPLIER_COUNTRIES[s.name];changed=true}
  }
  return changed
}
const store=createStateStore({localFile:DATA,oauthFile:OAUTH});
const load=store.load,save=store.save,oauth=store.oauth,saveOauth=store.saveOauth,clearOauth=store.clearOauth;
const json=(r,s,x)=>{r.writeHead(s,{'Content-Type':'application/json; charset=utf-8'});r.end(JSON.stringify(x))},body=req=>new Promise((ok,no)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch(e){no(e)}})});
async function formPost(url,obj){let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(obj)}),t=await r.json();if(!r.ok){let e=Error(t.error_description||t.error||'oauth_error');e.oauthError=t.error||null;e.oauthDescription=t.error_description||null;throw e}return t}
async function accessToken(){
  let o=await oauth();
  if(o.access_token&&o.expires_at>Date.now()+60000)return o.access_token;
  if(!o.refresh_token)throw Error('gmail_not_connected');
  try{
    let t=await formPost('https://oauth2.googleapis.com/token',{client_id:GCLIENT,client_secret:GSECRET,refresh_token:o.refresh_token,grant_type:'refresh_token'});
    o={...o,...t,expires_at:Date.now()+t.expires_in*1000};
    await saveOauth(o);
    return o.access_token
  }catch(e){
    let msg=(String(e.message||'')+' '+String(e.oauthError||'')+' '+String(e.oauthDescription||'')).toLowerCase();
    if(msg.includes('invalid_grant')||msg.includes('expired or revoked')||msg.includes('token has been expired or revoked')){
      await clearOauth();
      let x=Error('gmail_token_expired_or_revoked');
      x.code='gmail_token_expired_or_revoked';
      throw x
    }
    throw e
  }
}
async function gmail(endpoint,opt={}){let token=await accessToken(),r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+endpoint,{...opt,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opt.headers||{})}}),t=await r.json();if(!r.ok)throw Error(t.error?.message||'gmail_error');return t}
async function verifyCompanyMailbox(){
 const p=await gmail('profile'),address=String(p.emailAddress||'').trim().toLowerCase();
 if(!address)throw Error('gmail_profile_missing_email');
 const expected=String(process.env.GMAIL_EXPECTED_EMAIL||'').trim().toLowerCase();
 if(expected&&address!==expected)throw Error('gmail_account_mismatch');
 return {emailAddress:address,messagesTotal:Number(p.messagesTotal||0)};
}
const b64url=s=>Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function sendMail(to,subject,text){if(process.env.PRODUCTION_READONLY_MAIL==='true')throw Error('gmail_outbound_disabled_in_readonly_mode');let raw=['To: '+to,'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',''+text].join('\r\n');return gmail('messages/send',{method:'POST',body:JSON.stringify({raw:b64url(raw)})})}
function headers(m){return Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]))}
function decodePart(p){if(p?.body?.data)return Buffer.from(p.body.data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');for(let x of p?.parts||[]){let v=decodePart(x);if(v)return v}return ''}
function emailDomain(v){let m=String(v||'').toLowerCase().match(/@([a-z0-9.-]+)/);return m?m[1]:''}
function internalSender(from){let f=String(from||'').toLowerCase();return ['alharirexport@gmail.com','numbersinchina@gmail.com'].some(e=>f.includes(e))}
function supplierForFrom(st,from){
  let f=String(from||'').toLowerCase(),free=new Set(['gmail.com','outlook.com','hotmail.com','yahoo.com','qq.com','163.com']);
  return (st.suppliers||[]).find(s=>{
    let emails=[s.email,...(s.alternateEmails||[])].filter(Boolean).map(x=>String(x).toLowerCase());
    let domains=[...(s.emailDomains||[]),s.emailDomain].filter(Boolean).map(x=>String(x).toLowerCase());
    if(/emaar industries/i.test(String(s.name||'')))domains.push('emaarllc.com');
    if(emails.some(e=>f.includes(e)))return true;
    domains.push(...emails.map(emailDomain).filter(d=>d&&!free.has(d)));
    return [...new Set(domains)].some(d=>f.includes('@'+d));
  })
}
function attachmentsFromPayload(p,out=[]){
  if(p?.filename&&p?.body?.attachmentId)out.push({filename:p.filename,mimeType:p.mimeType||'application/octet-stream',attachmentId:p.body.attachmentId,size:p.body.size||0});
  for(let x of p?.parts||[])attachmentsFromPayload(x,out);return out
}
function cleanReplySummary(body){
  let s=String(body||'').replace(/\r/g,'').trim();
  for(const marker of ['\n发件人：','\nFrom:','\n-----Original Message-----','\n----------------------------转发邮件内容','\nOn ']){let i=s.indexOf(marker);if(i>120)s=s.slice(0,i)}
  let lines=s.split('\n').map(x=>x.trim()).filter(Boolean);
  let out=[];for(let line of lines){if(/^(best regards|kind regards|regards|thanks|thank you|此致|敬礼)$/i.test(line)&&out.length>=2)break;out.push(line);if(out.join(' ').length>700)break}
  return out.join(' ').slice(0,700)
}
function classifyReply(subject,body,attachments=[]){
  let t=(String(subject||'')+' '+String(body||'')).toLowerCase(),files=(attachments||[]).map(a=>a.filename||'').join(' ').toLowerCase();
  let promised=/10[.\/-]?8|8[.\/-]?10|will send|send.*quotation|quotation.*later|报价.*发给|价格.*发给|可以.*报价|报价.*可以吗/.test(t);
  let info=/who are you|company info|company information|contact number|联系电话|公司信息|贵公司信息|联系方式/.test(t);
  let priced=/(?:usd|us\$|\$|rmb|cny|fob|exw|cif|cfr)\s*[:：]?\s*[0-9]|[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:usd|us\$|\$|rmb|cny)|单价|总价|unit price|total price/.test(t);
  let quoteFile=/quotation|quote|报价|offer|proposal|price|commercial/i.test(files);
  let technicalFile=attachments.length>0||/catalog|catalogue|datasheet|technical|specification|solar|hybrid|product/i.test(files+' '+t);
  if(priced||quoteFile)return 'quote_received';
  if(promised)return 'quote_promised';
  if(info&&technicalFile)return 'technical_reply';
  if(technicalFile)return 'technical_reply';
  if(info)return 'info_request';
  return 'general_reply';
}
function ensureVerifiedRfqSuppliers(st){
  const defs=[
    {id:'S4',name:'Hengliang Cooling',email:'info@hengliangcooling.com',alt:['alan@hengliangcooling.com']},
    {id:'S10',name:'Deye',email:'service@deye.com.cn',alt:['bob.lee@deye.com.cn']},
    {id:'S13',name:'Moon Refrigeration (Sophia)',email:'sophia@moonrefrigeration.com',country:'China',status:'وعد بإرسال العرض',category:'cold_room_manufacturer'},
    {id:'S14',name:'Damai (Michelle)',email:'sales3@dmllcn.com',country:'China',status:'رد — يطلب معلومات',category:'cold_room_manufacturer'}
  ];
  st.suppliers=st.suppliers||[];
  for(const d of defs){
    let x=st.suppliers.find(s=>s.id===d.id||String(s.email||'').toLowerCase()===d.email);
    if(!x){x={id:d.id,name:d.name,email:d.email,country:d.country||'China',status:d.status||'تم الرد',excluded:false,source:'verified_email_thread',category:d.category||'cold_room_manufacturer'};st.suppliers.push(x)}
    x.alternateEmails=[...new Set([...(x.alternateEmails||[]),...(d.alt||[])])];
  }
}
async function projectMessageCandidates(st){
  // Scope searches to explicit RFQ IDs and supplier addresses. No generic whole-inbox scan.
  const queries=[],seenQ=new Set();
  function push(q){if(!seenQ.has(q)){queries.push(q);seenQ.add(q)}}
  for(const req of (st.requests||[]).slice(0,30)){
    if(/^(?:RFQ|REQ)-[A-Za-z0-9-]+$/.test(req.id))
      push('"'+req.id+'" newer_than:90d -from:me -in:trash -in:spam');
  }
  for(const sup of (st.suppliers||[]).slice(0,100))
    for(const e of [sup.email,...(sup.alternateEmails||[])].filter(Boolean)){
      if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
        push('from:'+e+' newer_than:90d -from:me -in:trash -in:spam');
    }
  if(!queries.length)return {messages:[],queryCount:0};
  const map=new Map();
  for(const q of queries.slice(0,120)){
    const r=await gmail('messages?q='+encodeURIComponent(q)+'&maxResults=100');
    for(const item of r.messages||[])map.set(item.id,item);
  }
  return {messages:[...map.values()],queryCount:Math.min(queries.length,120)};
}
async function syncGmail(){
  let st=await load();if(!LIVE)ensureVerifiedRfqSuppliers(st);let found=await projectMessageCandidates(st),list=found.messages;st.gmailReplies=(Array.isArray(st.gmailReplies)?st.gmailReplies:[]).filter(x=>!internalSender(x.from));st.correspondence=(st.correspondence||[]).filter(x=>!internalSender(x.from));
  let byId=new Map(st.gmailReplies.map(x=>[x.messageId,x])),recovered=0;
  for(let old of st.correspondence||[]){let mid=old.messageId||old.id;if(mid&&!byId.has(mid)){let rec={...old,messageId:mid};delete rec.id;const link=matchRequestForEmail(st,rec);rec.requestId=link.requestId;rec.requestMatchMethod=link.method;st.gmailReplies.push(rec);byId.set(mid,rec);recovered++}}
  let relinked=0;for(let rec of st.gmailReplies){let sup=supplierForFrom(st,rec.from||'');if(sup&&rec.supplierId!==sup.id){rec.supplierId=sup.id;rec.supplierName=sup.name;relinked++}
  const link=matchRequestForEmail(st,rec);rec.requestId=link.requestId;rec.requestMatchMethod=link.method;}
  let known=new Set(st.gmailReplies.map(x=>x.messageId)),added=0,matched=0,unmatched=0;
  for(let it of list){if(known.has(it.id))continue;let m=await gmail('messages/'+it.id+'?format=full'),h=headers(m),from=h.from||'';if(internalSender(from))continue;let sub=h.subject||'',txt=decodePart(m.payload)||m.snippet||'',sup=supplierForFrom(st,from);let matchedRequest=matchRequestForEmail(st,{subject:sub,body:txt,supplierId:sup?.id||null}),relevant=!!matchedRequest.requestId||!!sup||/RFQ-001|cold room|cold rooms|cold storage|refrigeration|fresh produce|冷库|报价|询价|solar|hybrid/i.test(sub+' '+txt);if(!relevant)continue;let receivedAt=m.internalDate&&Number.isFinite(Number(m.internalDate))?new Date(Number(m.internalDate)).toISOString():Number.isFinite(Date.parse(h.date||''))?new Date(h.date).toISOString():null,attachments=attachmentsFromPayload(m.payload),replyType=classifyReply(sub,txt,attachments),rec={messageId:it.id,threadId:m.threadId||'',supplierId:sup?.id||null,supplierName:sup?.name||null,from,to:h.to||'',cc:h.cc||'',subject:sub,body:LIVE?'':txt,snippet:String(m.snippet||'').slice(0,240),summary:cleanReplySummary(txt),receivedAt,attachments,replyType};const link=matchRequestForEmail(st,rec);
  rec.requestId=link.requestId;rec.requestMatchMethod=link.method;st.gmailReplies.unshift(rec);known.add(it.id);added++;if(sup){matched++;if(replyType==='quote_received')sup.status='عرض مستلم — يحتاج استخراج';else if(replyType==='quote_promised')sup.status='وعد بإرسال العرض';else if(replyType==='technical_reply')sup.status='رد فني + مرفقات للمراجعة';else if(replyType==='info_request')sup.status='رد — يطلب معلومات';else sup.status='رد غير سعري';sup.lastReply=receivedAt;sup.lastSubject=sub}else unmatched++;st.activity.unshift({id:Date.now()+Math.random(),time:receivedAt,type:'gmail_reply',text:'رد جديد: '+(sup?.name||from),messageId:it.id,supplierId:sup?.id||null,requestId:rec.requestId,subject:sub})}
  st.gmailReplies=st.gmailReplies.filter((x,i,a)=>x.messageId&&a.findIndex(y=>y.messageId===x.messageId)===i).slice(0,500);
  for(let rec of st.gmailReplies){if(!rec.supplierId)unmatched++}
  st.correspondence=st.gmailReplies.map(x=>({...x,id:x.messageId,requestId:x.requestId||null,extractionStatus:(x.attachments||[]).length?'needs_extraction':'received'}));
  st.gmailSyncStatus={time:new Date().toISOString(),queries:found.queryCount,candidates:list.length,added,matched,relinked,recovered,totalReplies:st.gmailReplies.length,unmatched:st.gmailReplies.filter(x=>!x.supplierId).length,
    unassignedToRequest:st.gmailReplies.filter(x=>!x.requestId).length,
    importedAsVerifiedQuotes:0};
  await save(st);return st.gmailSyncStatus
}
function ensureWorkspace(x){
  x.workspace=x.workspace||{};
  x.workspace.specifications=x.workspace.specifications||[];
  x.workspace.analysisRules=x.workspace.analysisRules||[];
  x.workspace.commercialTerms=x.workspace.commercialTerms||[];
  x.workspace.supplierStrategy=x.workspace.supplierStrategy||[];
  x.workspace.scenarios=x.workspace.scenarios||[];
  x.workspace.facts=x.workspace.facts||[];
  x.workspace.aiInstructions=x.workspace.aiInstructions||[];
  x.workspace.changeHistory=x.workspace.changeHistory||[];
  x.workspace.chat=x.workspace.chat||[];
  return x.workspace;
}
function auditWorkspace(x,kind,text,source='user',before=null,after=null){let w=ensureWorkspace(x),e={id:'CH-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),time:new Date().toISOString(),kind,text,source,before,after};w.changeHistory.unshift(e);return e}
function addWorkspaceItem(x,section,value,status='Confirmed Decision',source='User instruction'){
  let w=ensureWorkspace(x);if(!Array.isArray(w[section]))throw Error('invalid_workspace_section');
  let item={id:'WI-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),value:String(value).trim(),status,source,updatedAt:new Date().toISOString(),updatedBy:'Procurement AI Copilot'};
  w[section].unshift(item);auditWorkspace(x,'add',section+': '+item.value,source,null,item);return item;
}
function requestRef(st,message,currentId){
  let m=String(message||''),hit=m.match(/(?:RFQ|REQ)[-\s]?\d+/i);
  if(hit){let raw=hit[0].toUpperCase().replace(/\s/g,'');return (st.requests||[]).find(x=>x.id.toUpperCase()===raw)||null}
  return (st.requests||[]).find(x=>x.id===currentId)||null;
}
function elapsed(iso){if(!iso)return 'غير متوفر';let ms=Date.now()-new Date(iso).getTime();if(!Number.isFinite(ms))return 'غير متوفر';let h=Math.floor(ms/36e5),d=Math.floor(h/24);return d>0?d+' يوم و '+(h%24)+' ساعة':h+' ساعة'}
function copilotRead(st,req,message){
  let m=String(message||''),w=ensureWorkspace(req),supplierCount=(st.suppliers||[]).filter(x=>!x.excluded).length,quoteCount=(st.quotes||[]).filter(q=>!q.requestId||q.requestId===req.id).length;
  if(/كم.*(?:عدد)?.*المورد|عدد الموردين/i.test(m))return {answer:'عدد الموردين المسجلين والنشطين حاليًا للمنظومة: '+supplierCount+' مورد. الطلب المرجعي: '+req.id+'.',source:'Supplier Master'};
  if(/كم.*(?:استلمنا|وصلنا).*عروض|كم.*عرض سعر|عدد.*العروض/i.test(m))return {answer:'العروض السعرية المسجلة في النظام للطلب '+req.id+': '+quoteCount+'.',source:'Quotes Register'};
  if(/(?:وضع|حالة|status).*الطلب|ماهو.*الطلب/i.test(m))return {answer:'حالة الطلب '+req.id+': '+(req.status||'غير محددة')+'.',source:'Request Record'};
  if(/مواصفات|specifications/i.test(m)){let vals=(w.specifications||[]).map(x=>x.value);return {answer:'مواصفات '+req.id+':\n- '+(vals.length?vals.join('\n- '):JSON.stringify(req.designBasis||{})),source:'Request Intelligence Workspace'}}
  if(/شروط|terms|شرط/i.test(m)&&!/(أضف|اضف|غيّر|غير|اجعل|يجب)/i.test(m)){let vals=[...(w.commercialTerms||[]),...(w.analysisRules||[])].map(x=>x.value);return {answer:'الشروط والقواعد الحالية للطلب '+req.id+':\n- '+(vals.length?vals.join('\n- '):'لا توجد شروط مسجلة.'),source:'Workspace Terms + Analysis Rules'}}
  if(/آخر.*(?:ايميل|إيميل|بريد)|كم مضى.*(?:ايميل|إيميل|بريد)/i.test(m)){let arr=[...(st.gmailMessages||[]),...(st.activity||[]).filter(x=>/gmail|email|إيميل|بريد|إرسال/i.test((x.type||'')+' '+(x.text||'')))];let last=arr.sort((x,y)=>new Date(y.time||y.date||y.createdAt||0)-new Date(x.time||x.date||x.createdAt||0))[0];let t=last&&(last.time||last.date||last.createdAt);return {answer:last?'آخر نشاط بريد مسجل كان '+t+'، أي منذ '+elapsed(t)+'.':'لا يوجد في بيانات النظام نشاط بريد مؤرخ يمكن الاعتماد عليه.',source:'Gmail/Activity Log'}}
  if(/من.*لم يرد|غير المستجيبين/i.test(m)){let xs=(st.suppliers||[]).filter(x=>!x.excluded&&!['رد','تم الرد — ننتظر العرض'].includes(x.status)).map(x=>x.name);return {answer:'الموردون غير المصنفين كمستجيبين حاليًا ('+xs.length+'): '+(xs.join('، ')||'لا يوجد')+'.',source:'Supplier Master'}}
  return null;
}
function copilotPlan(message){
  let m=String(message||'').trim(),actions=[];
  const rules=[[/مصانع?\s*الألواح.*مصانع?\s*الثلاجات|افصل.*الألواح.*الثلاجات/i,'analysisRules','Keep Panel & Door Manufacturers separate from Complete Cold Room Manufacturers. Never compare panel-only pricing directly with a complete cold-room package.'],[/التركيب.*صنعاء|التجميع.*صنعاء/i,'scenarios','Panels, doors, floor/ceiling components may be imported and assembled/installed locally in Sana’a.']];
  for(const [re,section,value] of rules)if(re.test(m))actions.push({type:'add_context',section,value});
  let country=m.match(/(?:أضف|اضف|اجعل|يجب).*?(?:المورد|الموردين).*?(?:من|في)\s+(الصين|China|السعودية|Saudi Arabia|عمان|Oman)/i);
  if(country)actions.push({type:'add_context',section:'analysisRules',value:'Supplier eligibility rule: supplier country must be '+country[1]+'.'});
  let price=m.match(/(?:أقل|اقل|تحت|لا يزيد|أقل من|اقل من).*?(\d[\d,]*(?:\.\d+)?)\s*(?:دولار|USD|\$)?/i);
  if(price&&/(عرض|عروض|سعر|اعتمد|اعتماد)/i.test(m))actions.push({type:'add_context',section:'commercialTerms',value:'Commercial eligibility rule: only offers below '+price[1].replace(/,/g,'')+' USD qualify unless explicitly overridden.'});
  let generic=m.match(/(?:أضف|اضف|سجل|احفظ)\s+(?:شرط|قاعدة)\s*[:：-]?\s*(.+)/i);if(generic&&!actions.length)actions.push({type:'add_context',section:'analysisRules',value:generic[1]});
  let fact=m.match(/(?:أضف|اضف|سجل|احفظ)\s+(?:معلومة|ملاحظة|حقيقة)\s*[:：-]?\s*(.+)/i);if(fact&&!actions.length)actions.push({type:'add_context',section:'facts',value:fact[1]});
  return actions;
}
function gate(st,action){let map={followup:'autoFollowup',send:'autoSend',exclude:'autoExclude',award:'autoAward'},key=map[action];if(key&&st.settings?.[key])return true;return st.approvals.some(a=>a.type===action&&a.status==='approved')}

const {marketScan}=require('./market-scan');
const {analyzeRequest}=require('./request-intelligence');
const {priceAnalysis,dailyReport}=require('./procurement-reports');
const {matchRequestForEmail}=require('./gmail-request-link');
const {monthlyReport,validateMonth}=require('./monthly-report');
const {unifiedMarketSearch,validateSearchInput}=require('./market-unified');
const {registerSearch,researchContact,prepareConversion,outreachDrafts,publicUrl}=require('./market-leads');
const {configuredProvider}=require('./market-index-search');
const marketTrialBudget={day:'',count:0};
function rateLimitUnifiedSearch(res){
  // A modest in-process ceiling for free-API experiments, not a provider billing guarantee.
  if(configuredProvider()==='none')return false;
  const day=new Date().toISOString().slice(0,10);
  if(marketTrialBudget.day!==day){marketTrialBudget.day=day;marketTrialBudget.count=0;}
  if(marketTrialBudget.count>=8){
    json(res,429,{error:'trial_daily_search_limit',message:'تم الوصول إلى حد البحث التجريبي اليومي (8 عمليات). حاول غدًا.'});
    return true;
  }
  marketTrialBudget.count++;return false;
}


let syncInProgress=false;
const server=http.createServer(async(req,res)=>{try{if(!guardHostedRequest(req,res)||!guardProduction(req,res))return;
res.setHeader('X-Content-Type-Options','nosniff');
res.setHeader('X-Frame-Options','DENY');
res.setHeader('Referrer-Policy','no-referrer');
res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
let u=new URL(req.url,'http://localhost');if(u.pathname==='/api/state'&&req.method==='GET'){let st=await load();st.gmail={connected:!!(await oauth()).refresh_token,configured:!!(GCLIENT&&GSECRET),demoDisabled:HOSTED_DEMO};return json(res,200,st)}
if(u.pathname==='/api/storage/status'&&req.method==='GET'){
 const status=await store.diagnostics();return json(res,200,status);
}
if(u.pathname==='/api/gmail/status'&&req.method==='GET'){
 const cfg=oauthConfig(),tokens=await oauth(),st=await load();
 return json(res,200,{connected:!!tokens.refresh_token,configured:cfg.ok,readOnly:true,
 verifiedAccount:tokens.verifiedEmail||null,lastSync:st.gmailSyncStatus||null,
 autoSyncEnabled:LIVE&&process.env.GMAIL_AUTO_SYNC==='true',
 autoSyncMode:'best-effort-while-service-awake',
 redirectUri:REDIRECT,error:cfg.ok?null:cfg.error,message:cfg.ok?null:cfg.message});
}
if(u.pathname==='/api/gmail/verify'&&req.method==='GET'){
 const cfg=oauthConfig();if(!cfg.ok)return json(res,409,cfg);
 if(!(await oauth()).refresh_token)return json(res,409,{error:'gmail_not_connected'});
 const p=await verifyCompanyMailbox();
 return json(res,200,{ok:true,account:p.emailAddress,readOnly:true,messagesTotal:p.messagesTotal});
}
if(u.pathname==='/api/gmail/connect'&&req.method==='GET'){let cfg=oauthConfig();if(!cfg.ok)return json(res,400,cfg);let state=crypto.randomBytes(18).toString('hex');await saveOauth({...(await oauth()),state});let q=new URLSearchParams({client_id:GCLIENT,redirect_uri:REDIRECT,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.readonly',access_type:'offline',prompt:'consent',state});res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+q});return res.end()}
if(u.pathname==='/api/gmail/callback'&&req.method==='GET'){let o=await oauth();if(!u.searchParams.get('code')||u.searchParams.get('state')!==o.state)return json(res,400,{error:'invalid_oauth_state'});let t=await formPost('https://oauth2.googleapis.com/token',{code:u.searchParams.get('code'),client_id:GCLIENT,client_secret:GSECRET,redirect_uri:REDIRECT,grant_type:'authorization_code'});
 const scopes=String(t.scope||'').split(/\s+/).filter(Boolean);
 if(!scopes.includes('https://www.googleapis.com/auth/gmail.readonly')||
    scopes.some(v=>/gmail\.(?:send|modify)/.test(v)))
   return json(res,403,{error:'unexpected_oauth_scope',message:'التفويض لا يطابق صلاحية Gmail للقراءة فقط.'});
 if(!t.refresh_token)return json(res,409,{error:'google_refresh_token_missing'});
 await saveOauth({...t,state:null,expires_at:Date.now()+t.expires_in*1000});
 try{
  const p=await verifyCompanyMailbox();await saveOauth({...await oauth(),verifiedEmail:p.emailAddress});
 }catch(e){await clearOauth();throw e}
 res.writeHead(302,{Location:'/#gmail'});return res.end()}
if(u.pathname==='/api/gmail/disconnect'&&req.method==='POST'){await clearOauth();return json(res,200,{ok:true})}
if(u.pathname==='/api/gmail/sync'&&req.method==='POST'){
 const cfg=oauthConfig();if(!cfg.ok)return json(res,400,cfg);
 if(!(await oauth()).refresh_token)return json(res,409,{error:'gmail_not_connected',message:'اربط Gmail أولاً ثم أعد المزامنة.'});
 if(syncInProgress)return json(res,409,{error:'gmail_sync_in_progress'});
 await verifyCompanyMailbox();
 syncInProgress=true;
 try{return json(res,200,await syncGmail())}finally{syncInProgress=false}
}

if(u.pathname==='/api/gmail/message'&&req.method==='GET'){
 const messageId=u.searchParams.get('messageId')||'';
 const st=await load();
 const matched=(st.gmailReplies||[]).find(x=>x.messageId===messageId);
 if(!matched)return json(res,404,{error:'email_not_in_procurement'});
 const mail=await gmail('messages/'+encodeURIComponent(messageId)+'?format=full');
 const hdr=headers(mail);
 return json(res,200,{
  messageId,requestId:matched.requestId||null,
  subject:hdr.subject||matched.subject,from:hdr.from||matched.from,
  receivedAt:matched.receivedAt,
  body:decodePart(mail.payload),
  attachments:matched.attachments||[],
  notice:'Message fetched live via read-only Gmail OAuth, not stored permanently.'
 });
}
if(u.pathname==='/api/gmail/attachment'&&req.method==='GET'){
  // Only attachments referenced by an imported message can be accessed.
  // Bytes are fetched through the authorised Gmail connection on demand,
  // never from arbitrary external URLs.
  const st=await load(),messageId=u.searchParams.get('messageId')||'',
    attachmentId=u.searchParams.get('attachmentId')||'';
  const rec=(st.gmailReplies||[]).find(x=>x.messageId===messageId);
  const att=rec&&(rec.attachments||[]).find(x=>x.attachmentId===attachmentId);
  if(!rec||!att)return json(res,404,{error:'attachment_not_found'});
  if(Number(att.size)>15*1024*1024)return json(res,413,{error:'attachment_exceeds_preview_limit'});
  const a=await gmail('messages/'+encodeURIComponent(messageId)+'/attachments/'+encodeURIComponent(attachmentId));
  const buf=Buffer.from(String(a.data||'').replace(/-/g,'+').replace(/_/g,'/'),'base64');
  if(buf.length>15*1024*1024)return json(res,413,{error:'attachment_exceeds_preview_limit'});
  const filename=String(att.filename||'attachment').replace(/[\\\/\r\n\x00-\x1f]/g,'_').slice(0,180);
  const MIME=['application/pdf','image/jpeg','image/png','image/webp'];
  const t=MIME.includes(att.mimeType)?att.mimeType:'application/octet-stream';
  const inline=MIME.includes(t);
  res.writeHead(200,{'Content-Type':t,
    'Content-Disposition':(inline?'inline':'attachment')+'; filename*=UTF-8\'\''+encodeURIComponent(filename),
    'Content-Length':buf.length,'Cache-Control':'private, no-store',
    'Content-Security-Policy':"default-src 'none'; sandbox; style-src 'unsafe-inline'",
    'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
  return res.end(buf);
}
if(/^\/api\/requests\/[^/]+\/correspondence$/.test(u.pathname)&&req.method==='GET'){
 const requestId=decodeURIComponent(u.pathname.split('/')[3]),st=await load();
 if(!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
 const records=(st.gmailReplies||[]).filter(x=>x.requestId===requestId).map(x=>({
  messageId:x.messageId,threadId:x.threadId,requestId:x.requestId,
  supplierId:x.supplierId,supplierName:x.supplierName,from:x.from,
  subject:x.subject,snippet:x.snippet,body:x.body,receivedAt:x.receivedAt,
  replyType:x.replyType,attachments:x.attachments||[],requestMatchMethod:x.requestMatchMethod
 })).sort((a,b)=>new Date(b.receivedAt||0)-new Date(a.receivedAt||0));
 return json(res,200,{requestId,records,count:records.length,
  unassigned:(st.gmailReplies||[]).filter(x=>!x.requestId).length,
  integrationAvailable:!HOSTED_DEMO,
  notice:HOSTED_DEMO?'المرفقات مخزنة كبيانات وصفية تجريبية، وفتح الملفات عبر Gmail معطل في التجربة.':'فتح المرفقات يتطلب بقاء اتصال Gmail ساريًا.'});
}
if(u.pathname==='/api/requests'&&req.method==='POST'){
 const st=await load(),b=await body(req);
 const plain=(v,max)=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
 const title=plain(b.title,180),product=plain(b.product,180),quantity=plain(b.quantity,90);
 const specs=plain(b.specifications,2000),terms=plain(b.incoterm||'FOB',8).toUpperCase();
 const currency=plain(b.currency||'USD',3).toUpperCase();
 if(title.length<3||product.length<3||!quantity||specs.length<8)
   return json(res,422,{error:'request_fields_required',message:'أكمل عنوان الطلب والمنتج والكمية والمواصفات الفنية.'});
 if(terms!=='FOB'||!['USD','CNY','EUR','YER'].includes(currency))
   return json(res,422,{error:'invalid_commercial_terms'});
 if(b.neededBy&&!/^\d{4}-\d{2}-\d{2}$/.test(String(b.neededBy)))
   return json(res,422,{error:'invalid_needed_by_date'});
 const key=plain(b.clientRequestKey,80);
 if(key&&Array.isArray(st.requests)){
   const previous=st.requests.find(r=>r.clientRequestKey===key);
   if(previous)return json(res,200,{...previous,alreadyExists:true});
 }
 const x={id:'REQ-'+crypto.randomBytes(6).toString('hex').toUpperCase(),
   title,product,quantity,specifications:specs,
   targetMarkets:plain(b.targetMarkets,180),currency,incoterm:terms,
   neededBy:plain(b.neededBy,10),notes:plain(b.notes,1000),
   category:['goods','machinery','service'].includes(b.category)?b.category:'goods',
   status:'جديد',createdAt:new Date().toISOString(),
   ...(key?{clientRequestKey:key}:{})};
 st.requests=Array.isArray(st.requests)?st.requests:[];
 st.marketScans=Array.isArray(st.marketScans)?st.marketScans:[];
 st.activity=Array.isArray(st.activity)?st.activity:[];
 st.requests.unshift(x);
 st.activity.unshift({time:x.createdAt,type:'request',requestId:x.id,text:'إنشاء '+x.id});
 await save(st);return json(res,201,x);
}
// Read-only, source-grounded request analysis; no LLM claims, emails or state changes.
let analysisRoute=u.pathname.match(/^\/api\/requests\/([^/]+)\/analysis$/);
if(analysisRoute&&req.method==='GET'){
 const st=await load(),record=(st.requests||[]).find(x=>x.id===analysisRoute[1]);
 if(!record)return json(res,404,{error:'request_not_found'});
 const analysis=analyzeRequest(record),provider=configuredProvider();
 return json(res,200,{...analysis,liveSearch:{configured:provider!=='none',provider},
   requiresHumanVerification:true});
}
let mm=u.pathname.match(new RegExp('^/api/requests/([^/]+)/market-scanif(mm&&req.method==='POST'){let st=await load(),b=await body(req),x=(st.requests||[]).find(x=>x.id===mm[1]);if(!x)return json(res,404,{error:'request_not_found'});let scan=await marketScan(st,{...x,sourceObservations:b.sourceObservations||[]});st.marketScans=st.marketScans||[];st.marketScans.unshift(scan);x.marketScanId=scan.id;x.marketStatus=scan.resultStatus;st.activity.unshift({time:new Date().toISOString(),type:'market_scan',text:'Market Intelligence '+x.id+' — '+scan.sourceCount+' sources'});await save(st);return json(res,200,scan)}
if(u.pathname==='/api/market-scans'&&req.method==='GET'){let st=await load();return json(res,200,st.marketScans||[])}

if(u.pathname==='/api/market-intelligence/search'&&req.method==='POST'){
  const input=await body(req);
  if(!validateSearchInput(input?.query))
    return json(res,422,{error:'invalid_product_query',message:'اسم المنتج يجب أن يكون من 2 إلى 160 حرفًا.'});
  if(rateLimitUnifiedSearch(res))return;
  const result=await unifiedMarketSearch(input);
  // Keep result pointers ephemeral for intentional supplier shortlisting; no supplier auto-import.
  if(result.ok){
    const snapshot=registerSearch(result.results,result.query);
    result.searchId=snapshot.searchId;
    result.results=snapshot.results.map(x=>{
      const original=result.results.find(z=>z.url===x.url);
      return {...original,index:x.index};
    });
  }
  return json(res,result.status,result);
}



if(u.pathname==='/api/market-intelligence/manual-leads'&&req.method==='POST'){
  const input=await body(req),query=validateSearchInput(input?.query);
  if(!query)return json(res,422,{error:'invalid_product_query'});
  const urls=Array.isArray(input?.urls)?input.urls:[];
  if(urls.length<1||urls.length>12)return json(res,422,{error:'one_to_twelve_source_urls_required'});
  const items=[];
  for(const raw of urls){
    const url=publicUrl(raw);
    if(!url)return json(res,422,{error:'invalid_public_source_url'});
    const host=new URL(url).hostname;
    if(!items.some(x=>x.url===url))
      items.push({source:'Operator-supplied public link',title:'مصدر أدخله الموظف — '+host,
        snippet:'لم يتحقق النظام من هوية الشركة أو السعر أو البريد.',url});
  }
  const snapshot=registerSearch(items,query);
  return json(res,200,{ok:true,query,searchId:snapshot.searchId,
    count:snapshot.results.length,results:snapshot.results.map(x=>({...x,prices:[]})),
    searchConfigured:false,provider:'manual-reviewed-links',manual:true,
    warning:'روابط أدخلها المستخدم، غير متحقق منها آليًا، وتحتاج مراجعة بشرية قبل مراسلة الشركات.'});
}
if(u.pathname==='/api/market-intelligence/contacts'&&req.method==='POST'){
  const input=await body(req);
  if(rateLimitUnifiedSearch(res))return;
  const result=await researchContact(input);
  return json(res,result.status,result);
}
if(u.pathname==='/api/market-intelligence/convert'&&req.method==='POST'){
  const input=await body(req),draft=prepareConversion(input);
  if(!draft.ok)return json(res,draft.status,{error:draft.error,message:draft.message||draft.error});
  const st=await load();
  st.requests=Array.isArray(st.requests)?st.requests:[];
  st.suppliers=Array.isArray(st.suppliers)?st.suppliers:[];
  st.activity=Array.isArray(st.activity)?st.activity:[];
  const targetId=typeof input.targetRequestId==='string'?input.targetRequestId.trim():'';
  let request=draft.request,attachedToExistingRequest=false;
  if(targetId){
    const existing=st.requests.find(x=>x.id===targetId);
    if(!existing)return json(res,404,{error:'target_request_not_found'});
    if(existing.incoterm!=='FOB')return json(res,422,{error:'target_request_requires_FOB'});
    if([existing.product,existing.quantity,existing.specifications].some((v,i)=>
      String(v||'').trim()!==String([draft.request.product,draft.request.quantity,draft.request.specifications][i]||'').trim()))
      return json(res,409,{error:'request_details_changed',
        message:'بيانات الطلب لا تطابق البحث الحالي. حدث الصفحة وأعد اختيار طلب الشراء الصحيح.'});
    const attached=new Set(existing.selectedSupplierIds||[]);
    const duplicates=draft.suppliers.filter(s=>st.suppliers.some(prev=>
      attached.has(prev.id)&&prev.name?.trim().toLowerCase()===s.name.trim().toLowerCase()));
    if(duplicates.length)return json(res,409,{error:'supplier_already_selected',
      message:'يوجد مورد مختار مسبقًا بالاسم نفسه داخل هذا الطلب. راجع الموردين قبل إعادة الإضافة.'});
    for(const supplier of draft.suppliers){supplier.associatedRequestId=targetId;attached.add(supplier.id)}
    existing.selectedSupplierIds=[...attached];
    existing.outreachStatus='draft_review_required';
    request=existing;attachedToExistingRequest=true;
  }else{
    st.requests.unshift(draft.request);
  }
  st.suppliers.push(...draft.suppliers);
  st.activity.unshift({time:new Date().toISOString(),type:'rfq_draft_created',requestId:request.id,
    text:(attachedToExistingRequest?'أضيفت شركات مستهدفة إلى ':'أنشئت مسودة ')+request.id+
      ' مع '+draft.suppliers.length+' مورّدين مختارين — لم تُرسل أي رسائل'});
  await save(st);
  return json(res,attachedToExistingRequest?200:201,{request,suppliers:draft.suppliers,
    attachedToExistingRequest,drafts:outreachDrafts(request,draft.suppliers),
    sentCount:0,persistence:HOSTED_DEMO?'temporary-demo':store.durable?'postgres':'local-file'});
}

let attachMarketRoute=u.pathname.match(/^\/api\/requests\/([^/]+)\/market-suppliers$/);
if(attachMarketRoute&&req.method==='POST'){
 const st=await load(),request=(st.requests||[]).find(r=>r.id===attachMarketRoute[1]);
 if(!request)return json(res,404,{error:'request_not_found'});
 if(String(request.incoterm||'FOB').toUpperCase()!=='FOB')
  return json(res,422,{error:'request_requires_FOB',message:'لا يمكن إضافة عروض FOB إلى طلب أساسه التجاري مختلف دون مراجعة الطلب.'});
 const input=await body(req);
 const draft=prepareConversion({...input,details:{
  product:request.product||request.title,quantity:request.quantity,
  specifications:request.specifications,incoterm:'FOB'
 }});
 if(!draft.ok)return json(res,draft.status,{error:draft.error,message:draft.message||draft.error});
 st.suppliers=Array.isArray(st.suppliers)?st.suppliers:[];
 st.activity=Array.isArray(st.activity)?st.activity:[];
 request.selectedSupplierIds=Array.isArray(request.selectedSupplierIds)?request.selectedSupplierIds:[];
 const added=[],already=[];
 for(const incoming of draft.suppliers){
  const found=st.suppliers.find(s=>s.associatedRequestId===request.id&&
   String(s.name||'').trim().toLowerCase()===incoming.name.toLowerCase()&&
   s.sourceUrl===incoming.sourceUrl);
  if(found){already.push(found.id);continue}
  incoming.associatedRequestId=request.id;
  incoming.status='مرشح لهذا الطلب — يحتاج التحقق من الشركة والبريد';
  st.suppliers.push(incoming);
  request.selectedSupplierIds.push(incoming.id);
  added.push(incoming);
 }
 if(added.length)st.activity.unshift({time:new Date().toISOString(),type:'rfq_supplier_shortlist',
  requestId:request.id,text:'أضيف '+added.length+' موردًا مرشحًا إلى '+request.id+' دون إرسال مراسلات'});
 await save(st);
 return json(res,200,{ok:true,requestId:request.id,request,suppliers:added,added,alreadyExists:already,
  linkedSuppliers:request.selectedSupplierIds.length,sentCount:0,
  drafts:outreachDrafts(request,added),persistence:HOSTED_DEMO?'temporary-demo':store.durable?'postgres':'local-file',
  warning:'هذه ترشيحات بحث ولم تُتحقق هويات الشركات أو عناوين البريد آليًا.'});
}
let outreachRoute=u.pathname.match(/^\/api\/requests\/([^/]+)\/outreach-drafts$/);
if(outreachRoute&&req.method==='GET'){
  const st=await load(),request=(st.requests||[]).find(x=>x.id===outreachRoute[1]);
  if(!request)return json(res,404,{error:'request_not_found'});
  const chosen=(st.suppliers||[]).filter(x=>(request.selectedSupplierIds||[]).includes(x.id));
  return json(res,200,{requestId:request.id,status:request.outreachStatus||'unknown',
    drafts:outreachDrafts(request,chosen),sentCount:0});
}

if(u.pathname==='/api/market-search'&&req.method==='POST'){
  let b=await body(req);
  let r=await fetch('http://localhost:8790/api/market-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});
  let x=await r.json().catch(()=>({error:'invalid_alibaba_api_response'}));
  return json(res,r.status,x)
}
let msearch=u.pathname.match(/^\/api\/market-search\/([^/]+)$/);
if(msearch&&req.method==='GET'){
  let r=await fetch('http://localhost:8790/api/market-search/'+encodeURIComponent(msearch[1]));
  let x=await r.json().catch(()=>({error:'invalid_alibaba_api_response'}));
  return json(res,r.status,x)
}
if(u.pathname==='/api/made-in-china-search'&&req.method==='POST'){
  let b=await body(req);
  let r=await fetch('http://localhost:8791/api/market-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});
  let x=await r.json().catch(()=>({error:'invalid_made_in_china_api_response'}));
  return json(res,r.status,x)
}
let micsearch=u.pathname.match(/^\/api\/made-in-china-search\/([^/]+)$/);
if(micsearch&&req.method==='GET'){
  let r=await fetch('http://localhost:8791/api/market-search/'+encodeURIComponent(micsearch[1]));
  let x=await r.json().catch(()=>({error:'invalid_made_in_china_api_response'}));
  return json(res,r.status,x)
}
let wm=u.pathname.match(/^\/api\/requests\/([^/]+)\/workspace$/);
if(wm&&req.method==='GET'){let st=await load(),x=(st.requests||[]).find(x=>x.id===wm[1]);if(!x)return json(res,404,{error:'request_not_found'});return json(res,200,{request:x,workspace:ensureWorkspace(x)})}
if(wm&&req.method==='PATCH'){let st=await load(),b=await body(req),x=(st.requests||[]).find(x=>x.id===wm[1]);if(!x)return json(res,404,{error:'request_not_found'});let w=ensureWorkspace(x),allowed=['specifications','analysisRules','commercialTerms','supplierStrategy','scenarios','facts','aiInstructions'];if(!allowed.includes(b.section))return json(res,400,{error:'invalid_workspace_section'});let item=addWorkspaceItem(x,b.section,b.value,b.status||'Confirmed Decision',b.source||'Manual UI');await save(st);return json(res,200,{item,workspace:w})}
let cm=u.pathname.match(/^\/api\/requests\/([^/]+)\/copilot$/);
if(cm&&req.method==='POST'){let st=await load(),b=await body(req),base=(st.requests||[]).find(x=>x.id===cm[1]);if(!base)return json(res,404,{error:'request_not_found'});let message=String(b.message||'').trim();if(!message)return json(res,400,{error:'message_required'});let x=requestRef(st,message,cm[1])||base,w=ensureWorkspace(x);w.chat.push({role:'user',text:message,time:new Date().toISOString()});let actions=copilotPlan(message),executed=[];for(const a of actions){if(a.type==='add_context')executed.push(addWorkspaceItem(x,a.section,a.value,'Confirmed Decision','AI Copilot from user instruction'))}let read=copilotRead(st,x,message),reply;if(executed.length){reply='تم تنفيذ '+executed.length+' تحديث على '+x.id+'.\n'+executed.map(z=>'✓ '+z.value).join('\n');let after=copilotRead(st,x,message);if(after&&after.answer)reply+='\n\n'+after.answer}else if(read){reply=read.answer+'\n\nالمصدر: '+read.source}else{reply='أستطيع الاستعلام من بيانات الطلبات والموردين والعروض والمواصفات والشروط وسجل البريد، أو تنفيذ تحديثات على Workspace. لم أجد بعد استعلامًا مدعومًا بشكل موثوق في هذه الصياغة، لذلك لم أغيّر أي بيانات.'}w.chat.push({role:'assistant',text:reply,time:new Date().toISOString(),requestId:x.id,executed:executed.map(z=>z.id)});auditWorkspace(x,executed.length?'copilot_action':'copilot_query',message,'AI Copilot',null,{requestId:x.id,executed:executed.map(z=>z.id)});await save(st);return json(res,200,{reply,requestId:x.id,intent:executed.length?'act':read?'ask':'unknown',executed,workspace:w})}
let sm=u.pathname.match(/^\/api\/suppliers\/([^/]+)$/);if(sm&&req.method==='PATCH'){let st=await load(),b=await body(req),x=st.suppliers.find(x=>x.id===sm[1]);if(!x)return json(res,404,{error:'not_found'});Object.assign(x,b);await save(st);return json(res,200,x)}
let am=u.pathname.match(/^\/api\/approvals\/([^/]+)$/);if(am&&req.method==='PATCH'){let st=await load(),b=await body(req),x=st.approvals.find(x=>x.id===am[1]);if(!x)return json(res,404,{error:'not_found'});x.status=b.status||x.status;x.updatedAt=new Date().toISOString();await save(st);return json(res,200,x)}
if(u.pathname==='/api/settings'&&req.method==='PATCH'){let st=await load(),b=await body(req);st.settings={...st.settings,...b};await save(st);return json(res,200,st.settings)}


if(u.pathname==='/api/system-status'&&req.method==='GET'){
 const provider=configuredProvider();
 const availableMail=!!(GCLIENT&&GSECRET)&&!!(await oauth()).refresh_token;
 const serviceList=[
  {id:'private-access',name:'الدخول المحمي',status:'available',detail:HOSTED_DEMO?'دخول إداري واحد للتجربة؛ ليست صلاحيات فردية':'بوابة محمية'},
  {id:'market-page',name:'صفحة بحث المنتج والموردين',status:'available',detail:'تشغيل الواجهة وإنشاء قائمة مرشحين'},
  {id:'live-search',name:'بحث السوق الحي',status:provider==='none'?'not-configured':'configured',detail:provider==='none'?'لا يوجد محرك بحث مفعل على الخادم':provider},
  {id:'manual-leads',name:'إضافة روابط الموردين يدويًا',status:'available',detail:'مع التحقق اليدوي من الهوية'},
  {id:'rfq-drafts',name:'إنشاء مسودات RFQ',status:'available',detail:'لا إرسال تلقائي'},
  {id:'quote-analysis',name:'التحليل المالي للعروض',status:'available',detail:'مقارنة مقيدة بالأدلة والمواصفات والعملة وFOB'},
  {id:'daily-report',name:'لوحة وتقارير الإدارة والمشتري',status:'available',detail:'تحميل HTML، طباعة/PDF، مشاركة يدوية'},
  {id:'email',name:'ربط ومزامنة Gmail',status:HOSTED_DEMO?'disabled-in-demo':availableMail?'configured':'not-configured',detail:HOSTED_DEMO?'غير متاح في النسخة التجريبية':'يتطلب إعداد OAuth وربط حساب'},
  {id:'wechat',name:'إرسال تلقائي إلى WeChat',status:'not-integrated',detail:'المتاح مشاركة الملف يدويًا عبر الجهاز'},
  {id:'storage',name:'تخزين مستمر للبيانات',status:HOSTED_DEMO?'temporary-demo':'local-file',detail:HOSTED_DEMO?'بيانات وهمية تزول عند إعادة تشغيل الخدمة':'ملف محلي، ليس قاعدة بيانات مؤسسية'},
  {id:'quote-ingestion',name:'استخراج تلقائي لعروض PDF والبريد',status:'not-integrated',detail:'الإدخال المنظم متاح والمرفقات تحتاج مراجعة'}
 ];
 return json(res,200,{checkedAt:new Date().toISOString(),staging:HOSTED_DEMO,services:serviceList});
}
if(u.pathname==='/api/price-comparison'&&req.method==='GET'){
  const st=await load(),requestId=u.searchParams.get('requestId')||null;
  if(requestId&&!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
  return json(res,200,priceAnalysis(st,{requestId}));
}
if(u.pathname==='/api/monthly-report'&&req.method==='GET'){
  const st=await load(),requestId=u.searchParams.get('requestId')||null,
    audience=u.searchParams.get('audience')||'management',rawMonth=u.searchParams.get('month');
  if(requestId&&!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
  if(!['buyer','management'].includes(audience))return json(res,422,{error:'audience_not_supported'});
  if(rawMonth&&!validateMonth(rawMonth))return json(res,422,{error:'invalid_month'});
  return json(res,200,monthlyReport(st,{month:rawMonth,requestId,audience}));
}
if(u.pathname==='/api/daily-report'&&req.method==='GET'){
  const st=await load(),requestId=u.searchParams.get('requestId')||null,
    audience=u.searchParams.get('audience')||'management',
    requestedDay=u.searchParams.get('date')||null;
  if(requestId&&!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
  if(!['buyer','management'].includes(audience))return json(res,422,{error:'audience_not_supported'});
  if(requestedDay&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDay))
    return json(res,422,{error:'date_invalid'});
  return json(res,200,dailyReport(st,{requestId,date:requestedDay,audience}));
}
// Quote registration is deliberately "received/unverified". Staff must review real evidence
// and explicitly verify each line before it can affect the benchmark.
if(u.pathname==='/api/quotes/structured'&&req.method==='POST'){
  const b=await body(req),st=await load(),supplier=(st.suppliers||[]).find(x=>x.id===b.supplierId),
    request=(st.requests||[]).find(x=>x.id===b.requestId);
  if(!supplier||!request)return json(res,422,{error:'known_request_and_supplier_required'});
  if(supplier.associatedRequestId&&supplier.associatedRequestId!==b.requestId)
    return json(res,422,{error:'supplier_not_assigned_to_request'});
  if(!['USD','CNY','EUR','YER'].includes(String(b.currency||'')))
    return json(res,422,{error:'unsupported_currency'});
  if(typeof b.basis!=='string'||b.basis.trim().length<3||b.basis.length>160)
    return json(res,422,{error:'quote_basis_required'});
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)
    return json(res,422,{error:'quote_items_required'});
  const items=[];
  for(const item of b.items){
    if(typeof item.description!=='string'||item.description.trim().length<3||item.description.length>260||
      !['m²','sqm','piece','set','kg','unit'].includes(item.unit)||
      !Number.isFinite(Number(item.unitPrice))||Number(item.unitPrice)<=0||
      !Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0)
      return json(res,422,{error:'invalid_quotation_line'});
    items.push({description:item.description.trim(),unit:item.unit,unitPrice:Number(item.unitPrice),
      quantity:Number(item.quantity),comparisonKey:String(item.comparisonKey||'').trim().slice(0,140),
      specifications:String(item.specifications||'').trim().slice(0,400)});
  }
  const evidenceRef=String(b.evidenceRef||'').trim().slice(0,500);
  if(evidenceRef.length<6)return json(res,422,{error:'evidence_reference_required'});
  const quote={id:'Q-'+crypto.randomBytes(8).toString('hex'),supplierId:supplier.id,requestId:request.id,
    category:supplier.category||'unclassified',evidenceClass:'Received Quote — Pending Review',status:'awaiting_review',
    basis:b.basis.trim(),currency:b.currency,items,evidenceRef,
    technical:typeof b.technical==='object'&&b.technical&&!Array.isArray(b.technical)?b.technical:{},
    commercial:typeof b.commercial==='object'&&b.commercial&&!Array.isArray(b.commercial)?b.commercial:{},
    missing:Array.isArray(b.missing)?b.missing.map(x=>String(x).slice(0,130)).slice(0,30):[],
    receivedAt:new Date().toISOString()};
  st.quotes=st.quotes||[];st.quotes.unshift(quote);
  st.activity=st.activity||[];st.activity.unshift({type:'quote_received',time:quote.receivedAt,
    requestId:quote.requestId,text:'عرض جديد '+quote.id+' — يحتاج فحص المستند والتحقق'});
  await save(st);return json(res,201,quote);
}
let verifyQuote=u.pathname.match(/^\/api\/quotes\/([^/]+)\/verify$/);
if(verifyQuote&&req.method==='POST'){
  const st=await load(),q=(st.quotes||[]).find(x=>x.id===verifyQuote[1]),
    b=await body(req);
  if(!q)return json(res,404,{error:'quote_not_found'});
  if(q.evidenceClass==='Verified Quote')return json(res,409,{error:'already_verified'});
  if(String(q.evidenceRef||'').trim().length<6||
    !Array.isArray(q.items)||q.items.some(i=>!(i.unitPrice>0&&i.quantity>0)))
    return json(res,422,{error:'complete_document_and_line_check_required'});
  if(b.confirmVerified!==true||String(b.reviewNote||'').trim().length<12)
    return json(res,422,{error:'explicit_review_confirmation_and_note_required'});
  // The hosted shared-admin demo is not an employee-scoped signature.
  q.evidenceClass='Verified Quote';q.status='reviewed';q.reviewNote=b.reviewNote.trim().slice(0,500);
  q.verifiedAt=new Date().toISOString();q.verifiedBy=HOSTED_DEMO?'demo-admin-review':'authorized-operator';
  st.activity=st.activity||[];st.activity.unshift({type:'quote_verified',time:q.verifiedAt,
    requestId:q.requestId,text:'تم توثيق '+q.id+' بعد مراجعة بشرية: '+q.reviewNote});
  await save(st);return json(res,200,{id:q.id,evidenceClass:q.evidenceClass,
    comparison:priceAnalysis(st,{requestId:q.requestId})});
}

if(u.pathname==='/api/quotes'&&req.method==='POST')return json(res,410,{error:'legacy_unverified_quote_write_disabled',message:'استخدم الإدخال المنظم /api/quotes/structured حتى لا تدخل أسعار دون إثبات.'});
if(u.pathname==='/api/agent/run'&&req.method==='POST'){let st=await load(),b=await body(req);if(b.action==='followup'&&st.settings?.dryRun)return json(res,409,{error:'dry_run_enabled',message:'وضع الحماية مفعل: لا يسمح بإرسال متابعة جماعية فعلية.'});if(b.action==='followup'&&st.settings?.requirePerMessageApproval)return json(res,409,{error:'per_message_approval_required',message:'يلزم اعتماد كل رسالة ومستلم بشكل منفصل قبل الإرسال.'});if(b.action==='followup'&&!gate(st,'followup'))return json(res,409,{error:'approval_required',message:'تحتاج موافقة قبل الإرسال'});if(b.action==='followup'){let targets=st.suppliers.filter(s=>!['رد','تم الرد — ننتظر العرض'].includes(s.status)&&!s.excluded&&s.email);let sent=[];for(let s of targets){await sendMail(s.email,'Follow-up: RFQ-001 – Cold Storage Project, Sana’a','Dear '+s.name+',\n\nThis is a follow-up regarding RFQ-001 for our cold storage project in Sana’a, Yemen. Please send your technical and commercial quotation, including cooling load, equipment brands/models, daily pull-down capacity, 24h power consumption, panel specifications, FOB price/port, CBM/gross weight, lead time, warranty and payment terms.\n\nBest regards,\nAlharir shipping and export');sent.push(s.name)}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تم إرسال متابعة إلى '+sent.length+' مورد'});await save(st);return json(res,200,{ok:true,sent})}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تشغيل الوكيل: '+(b.action||'analyze')});await save(st);return json(res,200,{ok:true,action:b.action||'analyze'})}
let rw=u.pathname.match(/^\/requests\/([^/]+)$/);if(rw&&req.method==='GET'){res.writeHead(302,{Location:'/workspace.html?id='+encodeURIComponent(rw[1])});return res.end()}
let file=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');
if(file.includes('..')||file.includes('\\')||path.isAbsolute(file))return json(res,400,{error:'invalid_path'});let fp=path.join(PUB,file);if(fp.startsWith(PUB)&&fs.existsSync(fp)){let ext=path.extname(fp);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'}[ext]||'application/octet-stream'),'X-Content-Type-Options':'nosniff','Cache-Control':HOSTED_DEMO?'private, no-store':'no-cache','Vary':'Authorization'});return fs.createReadStream(fp).pipe(res)}res.writeHead(404);res.end('Not found')
}catch(e){
  if(e&&e.message==='gmail_token_expired_or_revoked')return json(res,401,{error:'gmail_token_expired_or_revoked',message:'انتهت أو أُلغيت صلاحية Gmail. أعد ربط Gmail من صفحة الوكيل مرة واحدة لإنشاء Refresh Token جديد.'});
  if(e&&e.message==='gmail_not_connected')return json(res,401,{error:'gmail_not_connected',message:'Gmail غير مرتبط حاليًا. استخدم زر ربط Gmail ثم أعد المحاولة.'});
  if(e&&e.code==='STATE_CONFLICT')return json(res,409,{error:'state_revision_conflict',message:'تم تحديث البيانات بالتزامن. حدّث الصفحة وأعد المحاولة.'});
   if(process.env.PROCUREMENT_PRODUCTION==='true'){
     console.error('Production request failed',e.message);
     return json(res,500,{error:'internal_error',message:'تعذر إكمال العملية، راجع سجلات النظام.'});
   }
   json(res,500,{error:e.message})
}});store.ready().then(()=>{
 server.listen(process.env.PORT||8787,()=>console.log('Procurement V2 listening on port '+(process.env.PORT||8787)));
  // Operational diagnostics only. Never log tokens, email addresses or OAuth secrets.
  oauth().then(tokens=>console.log('Gmail readiness (no secrets): clientConfigured='+Boolean(GCLIENT&&GSECRET)+
    ',expectedMailboxConfigured='+Boolean(process.env.GMAIL_EXPECTED_EMAIL)+
    ',tokenStored='+Boolean(tokens.refresh_token)+
    ',autoSyncEnabled='+(LIVE&&process.env.GMAIL_AUTO_SYNC==='true')))
    .catch(e=>console.error('Gmail readiness check failed: '+(e.code||'oauth_store_unavailable')));

 if(LIVE&&process.env.GMAIL_AUTO_SYNC==='true'){
  const timer=setInterval(async()=>{
   if(syncInProgress)return;
   syncInProgress=true;
   try{
    if(!oauthConfig().ok||!(await oauth()).refresh_token)return;
    await verifyCompanyMailbox();
    const report=await syncGmail();
    console.log('Gmail read-only sync: queries='+report.queries+', added='+report.added);
   }catch(e){console.error('Gmail read-only sync failed:',e.code||e.message)}
   finally{syncInProgress=false}
  },30*60*1000);
  timer.unref();
 }
}).catch(e=>{console.error('Persistent state startup failed:',e.message);process.exitCode=1;});));if(mm&&req.method==='POST'){let st=await load(),b=await body(req),x=(st.requests||[]).find(x=>x.id===mm[1]);if(!x)return json(res,404,{error:'request_not_found'});let scan=await marketScan(st,{...x,sourceObservations:b.sourceObservations||[]});st.marketScans=st.marketScans||[];st.marketScans.unshift(scan);x.marketScanId=scan.id;x.marketStatus=scan.resultStatus;st.activity.unshift({time:new Date().toISOString(),type:'market_scan',text:'Market Intelligence '+x.id+' — '+scan.sourceCount+' sources'});await save(st);return json(res,200,scan)}
if(u.pathname==='/api/market-scans'&&req.method==='GET'){let st=await load();return json(res,200,st.marketScans||[])}

if(u.pathname==='/api/market-intelligence/search'&&req.method==='POST'){
  const input=await body(req);
  if(!validateSearchInput(input?.query))
    return json(res,422,{error:'invalid_product_query',message:'اسم المنتج يجب أن يكون من 2 إلى 160 حرفًا.'});
  if(rateLimitUnifiedSearch(res))return;
  const result=await unifiedMarketSearch(input);
  // Keep result pointers ephemeral for intentional supplier shortlisting; no supplier auto-import.
  if(result.ok){
    const snapshot=registerSearch(result.results,result.query);
    result.searchId=snapshot.searchId;
    result.results=snapshot.results.map(x=>{
      const original=result.results.find(z=>z.url===x.url);
      return {...original,index:x.index};
    });
  }
  return json(res,result.status,result);
}



if(u.pathname==='/api/market-intelligence/manual-leads'&&req.method==='POST'){
  const input=await body(req),query=validateSearchInput(input?.query);
  if(!query)return json(res,422,{error:'invalid_product_query'});
  const urls=Array.isArray(input?.urls)?input.urls:[];
  if(urls.length<1||urls.length>12)return json(res,422,{error:'one_to_twelve_source_urls_required'});
  const items=[];
  for(const raw of urls){
    const url=publicUrl(raw);
    if(!url)return json(res,422,{error:'invalid_public_source_url'});
    const host=new URL(url).hostname;
    if(!items.some(x=>x.url===url))
      items.push({source:'Operator-supplied public link',title:'مصدر أدخله الموظف — '+host,
        snippet:'لم يتحقق النظام من هوية الشركة أو السعر أو البريد.',url});
  }
  const snapshot=registerSearch(items,query);
  return json(res,200,{ok:true,query,searchId:snapshot.searchId,
    count:snapshot.results.length,results:snapshot.results.map(x=>({...x,prices:[]})),
    searchConfigured:false,provider:'manual-reviewed-links',manual:true,
    warning:'روابط أدخلها المستخدم، غير متحقق منها آليًا، وتحتاج مراجعة بشرية قبل مراسلة الشركات.'});
}
if(u.pathname==='/api/market-intelligence/contacts'&&req.method==='POST'){
  const input=await body(req);
  if(rateLimitUnifiedSearch(res))return;
  const result=await researchContact(input);
  return json(res,result.status,result);
}
if(u.pathname==='/api/market-intelligence/convert'&&req.method==='POST'){
  const input=await body(req),draft=prepareConversion(input);
  if(!draft.ok)return json(res,draft.status,{error:draft.error,message:draft.message||draft.error});
  const st=await load();
  st.requests=Array.isArray(st.requests)?st.requests:[];
  st.suppliers=Array.isArray(st.suppliers)?st.suppliers:[];
  st.activity=Array.isArray(st.activity)?st.activity:[];
  const targetId=typeof input.targetRequestId==='string'?input.targetRequestId.trim():'';
  let request=draft.request,attachedToExistingRequest=false;
  if(targetId){
    const existing=st.requests.find(x=>x.id===targetId);
    if(!existing)return json(res,404,{error:'target_request_not_found'});
    if(existing.incoterm!=='FOB')return json(res,422,{error:'target_request_requires_FOB'});
    if([existing.product,existing.quantity,existing.specifications].some((v,i)=>
      String(v||'').trim()!==String([draft.request.product,draft.request.quantity,draft.request.specifications][i]||'').trim()))
      return json(res,409,{error:'request_details_changed',
        message:'بيانات الطلب لا تطابق البحث الحالي. حدث الصفحة وأعد اختيار طلب الشراء الصحيح.'});
    const attached=new Set(existing.selectedSupplierIds||[]);
    const duplicates=draft.suppliers.filter(s=>st.suppliers.some(prev=>
      attached.has(prev.id)&&prev.name?.trim().toLowerCase()===s.name.trim().toLowerCase()));
    if(duplicates.length)return json(res,409,{error:'supplier_already_selected',
      message:'يوجد مورد مختار مسبقًا بالاسم نفسه داخل هذا الطلب. راجع الموردين قبل إعادة الإضافة.'});
    for(const supplier of draft.suppliers){supplier.associatedRequestId=targetId;attached.add(supplier.id)}
    existing.selectedSupplierIds=[...attached];
    existing.outreachStatus='draft_review_required';
    request=existing;attachedToExistingRequest=true;
  }else{
    st.requests.unshift(draft.request);
  }
  st.suppliers.push(...draft.suppliers);
  st.activity.unshift({time:new Date().toISOString(),type:'rfq_draft_created',requestId:request.id,
    text:(attachedToExistingRequest?'أضيفت شركات مستهدفة إلى ':'أنشئت مسودة ')+request.id+
      ' مع '+draft.suppliers.length+' مورّدين مختارين — لم تُرسل أي رسائل'});
  await save(st);
  return json(res,attachedToExistingRequest?200:201,{request,suppliers:draft.suppliers,
    attachedToExistingRequest,drafts:outreachDrafts(request,draft.suppliers),
    sentCount:0,persistence:HOSTED_DEMO?'temporary-demo':store.durable?'postgres':'local-file'});
}

let attachMarketRoute=u.pathname.match(/^\/api\/requests\/([^/]+)\/market-suppliers$/);
if(attachMarketRoute&&req.method==='POST'){
 const st=await load(),request=(st.requests||[]).find(r=>r.id===attachMarketRoute[1]);
 if(!request)return json(res,404,{error:'request_not_found'});
 if(String(request.incoterm||'FOB').toUpperCase()!=='FOB')
  return json(res,422,{error:'request_requires_FOB',message:'لا يمكن إضافة عروض FOB إلى طلب أساسه التجاري مختلف دون مراجعة الطلب.'});
 const input=await body(req);
 const draft=prepareConversion({...input,details:{
  product:request.product||request.title,quantity:request.quantity,
  specifications:request.specifications,incoterm:'FOB'
 }});
 if(!draft.ok)return json(res,draft.status,{error:draft.error,message:draft.message||draft.error});
 st.suppliers=Array.isArray(st.suppliers)?st.suppliers:[];
 st.activity=Array.isArray(st.activity)?st.activity:[];
 request.selectedSupplierIds=Array.isArray(request.selectedSupplierIds)?request.selectedSupplierIds:[];
 const added=[],already=[];
 for(const incoming of draft.suppliers){
  const found=st.suppliers.find(s=>s.associatedRequestId===request.id&&
   String(s.name||'').trim().toLowerCase()===incoming.name.toLowerCase()&&
   s.sourceUrl===incoming.sourceUrl);
  if(found){already.push(found.id);continue}
  incoming.associatedRequestId=request.id;
  incoming.status='مرشح لهذا الطلب — يحتاج التحقق من الشركة والبريد';
  st.suppliers.push(incoming);
  request.selectedSupplierIds.push(incoming.id);
  added.push(incoming);
 }
 if(added.length)st.activity.unshift({time:new Date().toISOString(),type:'rfq_supplier_shortlist',
  requestId:request.id,text:'أضيف '+added.length+' موردًا مرشحًا إلى '+request.id+' دون إرسال مراسلات'});
 await save(st);
 return json(res,200,{ok:true,requestId:request.id,request,suppliers:added,added,alreadyExists:already,
  linkedSuppliers:request.selectedSupplierIds.length,sentCount:0,
  drafts:outreachDrafts(request,added),persistence:HOSTED_DEMO?'temporary-demo':store.durable?'postgres':'local-file',
  warning:'هذه ترشيحات بحث ولم تُتحقق هويات الشركات أو عناوين البريد آليًا.'});
}
let outreachRoute=u.pathname.match(/^\/api\/requests\/([^/]+)\/outreach-drafts$/);
if(outreachRoute&&req.method==='GET'){
  const st=await load(),request=(st.requests||[]).find(x=>x.id===outreachRoute[1]);
  if(!request)return json(res,404,{error:'request_not_found'});
  const chosen=(st.suppliers||[]).filter(x=>(request.selectedSupplierIds||[]).includes(x.id));
  return json(res,200,{requestId:request.id,status:request.outreachStatus||'unknown',
    drafts:outreachDrafts(request,chosen),sentCount:0});
}

if(u.pathname==='/api/market-search'&&req.method==='POST'){
  let b=await body(req);
  let r=await fetch('http://localhost:8790/api/market-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});
  let x=await r.json().catch(()=>({error:'invalid_alibaba_api_response'}));
  return json(res,r.status,x)
}
let msearch=u.pathname.match(/^\/api\/market-search\/([^/]+)$/);
if(msearch&&req.method==='GET'){
  let r=await fetch('http://localhost:8790/api/market-search/'+encodeURIComponent(msearch[1]));
  let x=await r.json().catch(()=>({error:'invalid_alibaba_api_response'}));
  return json(res,r.status,x)
}
if(u.pathname==='/api/made-in-china-search'&&req.method==='POST'){
  let b=await body(req);
  let r=await fetch('http://localhost:8791/api/market-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});
  let x=await r.json().catch(()=>({error:'invalid_made_in_china_api_response'}));
  return json(res,r.status,x)
}
let micsearch=u.pathname.match(/^\/api\/made-in-china-search\/([^/]+)$/);
if(micsearch&&req.method==='GET'){
  let r=await fetch('http://localhost:8791/api/market-search/'+encodeURIComponent(micsearch[1]));
  let x=await r.json().catch(()=>({error:'invalid_made_in_china_api_response'}));
  return json(res,r.status,x)
}
let wm=u.pathname.match(/^\/api\/requests\/([^/]+)\/workspace$/);
if(wm&&req.method==='GET'){let st=await load(),x=(st.requests||[]).find(x=>x.id===wm[1]);if(!x)return json(res,404,{error:'request_not_found'});return json(res,200,{request:x,workspace:ensureWorkspace(x)})}
if(wm&&req.method==='PATCH'){let st=await load(),b=await body(req),x=(st.requests||[]).find(x=>x.id===wm[1]);if(!x)return json(res,404,{error:'request_not_found'});let w=ensureWorkspace(x),allowed=['specifications','analysisRules','commercialTerms','supplierStrategy','scenarios','facts','aiInstructions'];if(!allowed.includes(b.section))return json(res,400,{error:'invalid_workspace_section'});let item=addWorkspaceItem(x,b.section,b.value,b.status||'Confirmed Decision',b.source||'Manual UI');await save(st);return json(res,200,{item,workspace:w})}
let cm=u.pathname.match(/^\/api\/requests\/([^/]+)\/copilot$/);
if(cm&&req.method==='POST'){let st=await load(),b=await body(req),base=(st.requests||[]).find(x=>x.id===cm[1]);if(!base)return json(res,404,{error:'request_not_found'});let message=String(b.message||'').trim();if(!message)return json(res,400,{error:'message_required'});let x=requestRef(st,message,cm[1])||base,w=ensureWorkspace(x);w.chat.push({role:'user',text:message,time:new Date().toISOString()});let actions=copilotPlan(message),executed=[];for(const a of actions){if(a.type==='add_context')executed.push(addWorkspaceItem(x,a.section,a.value,'Confirmed Decision','AI Copilot from user instruction'))}let read=copilotRead(st,x,message),reply;if(executed.length){reply='تم تنفيذ '+executed.length+' تحديث على '+x.id+'.\n'+executed.map(z=>'✓ '+z.value).join('\n');let after=copilotRead(st,x,message);if(after&&after.answer)reply+='\n\n'+after.answer}else if(read){reply=read.answer+'\n\nالمصدر: '+read.source}else{reply='أستطيع الاستعلام من بيانات الطلبات والموردين والعروض والمواصفات والشروط وسجل البريد، أو تنفيذ تحديثات على Workspace. لم أجد بعد استعلامًا مدعومًا بشكل موثوق في هذه الصياغة، لذلك لم أغيّر أي بيانات.'}w.chat.push({role:'assistant',text:reply,time:new Date().toISOString(),requestId:x.id,executed:executed.map(z=>z.id)});auditWorkspace(x,executed.length?'copilot_action':'copilot_query',message,'AI Copilot',null,{requestId:x.id,executed:executed.map(z=>z.id)});await save(st);return json(res,200,{reply,requestId:x.id,intent:executed.length?'act':read?'ask':'unknown',executed,workspace:w})}
let sm=u.pathname.match(/^\/api\/suppliers\/([^/]+)$/);if(sm&&req.method==='PATCH'){let st=await load(),b=await body(req),x=st.suppliers.find(x=>x.id===sm[1]);if(!x)return json(res,404,{error:'not_found'});Object.assign(x,b);await save(st);return json(res,200,x)}
let am=u.pathname.match(/^\/api\/approvals\/([^/]+)$/);if(am&&req.method==='PATCH'){let st=await load(),b=await body(req),x=st.approvals.find(x=>x.id===am[1]);if(!x)return json(res,404,{error:'not_found'});x.status=b.status||x.status;x.updatedAt=new Date().toISOString();await save(st);return json(res,200,x)}
if(u.pathname==='/api/settings'&&req.method==='PATCH'){let st=await load(),b=await body(req);st.settings={...st.settings,...b};await save(st);return json(res,200,st.settings)}


if(u.pathname==='/api/system-status'&&req.method==='GET'){
 const provider=configuredProvider();
 const availableMail=!!(GCLIENT&&GSECRET)&&!!(await oauth()).refresh_token;
 const serviceList=[
  {id:'private-access',name:'الدخول المحمي',status:'available',detail:HOSTED_DEMO?'دخول إداري واحد للتجربة؛ ليست صلاحيات فردية':'بوابة محمية'},
  {id:'market-page',name:'صفحة بحث المنتج والموردين',status:'available',detail:'تشغيل الواجهة وإنشاء قائمة مرشحين'},
  {id:'live-search',name:'بحث السوق الحي',status:provider==='none'?'not-configured':'configured',detail:provider==='none'?'لا يوجد محرك بحث مفعل على الخادم':provider},
  {id:'manual-leads',name:'إضافة روابط الموردين يدويًا',status:'available',detail:'مع التحقق اليدوي من الهوية'},
  {id:'rfq-drafts',name:'إنشاء مسودات RFQ',status:'available',detail:'لا إرسال تلقائي'},
  {id:'quote-analysis',name:'التحليل المالي للعروض',status:'available',detail:'مقارنة مقيدة بالأدلة والمواصفات والعملة وFOB'},
  {id:'daily-report',name:'لوحة وتقارير الإدارة والمشتري',status:'available',detail:'تحميل HTML، طباعة/PDF، مشاركة يدوية'},
  {id:'email',name:'ربط ومزامنة Gmail',status:HOSTED_DEMO?'disabled-in-demo':availableMail?'configured':'not-configured',detail:HOSTED_DEMO?'غير متاح في النسخة التجريبية':'يتطلب إعداد OAuth وربط حساب'},
  {id:'wechat',name:'إرسال تلقائي إلى WeChat',status:'not-integrated',detail:'المتاح مشاركة الملف يدويًا عبر الجهاز'},
  {id:'storage',name:'تخزين مستمر للبيانات',status:HOSTED_DEMO?'temporary-demo':'local-file',detail:HOSTED_DEMO?'بيانات وهمية تزول عند إعادة تشغيل الخدمة':'ملف محلي، ليس قاعدة بيانات مؤسسية'},
  {id:'quote-ingestion',name:'استخراج تلقائي لعروض PDF والبريد',status:'not-integrated',detail:'الإدخال المنظم متاح والمرفقات تحتاج مراجعة'}
 ];
 return json(res,200,{checkedAt:new Date().toISOString(),staging:HOSTED_DEMO,services:serviceList});
}
if(u.pathname==='/api/price-comparison'&&req.method==='GET'){
  const st=await load(),requestId=u.searchParams.get('requestId')||null;
  if(requestId&&!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
  return json(res,200,priceAnalysis(st,{requestId}));
}
if(u.pathname==='/api/monthly-report'&&req.method==='GET'){
  const st=await load(),requestId=u.searchParams.get('requestId')||null,
    audience=u.searchParams.get('audience')||'management',rawMonth=u.searchParams.get('month');
  if(requestId&&!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
  if(!['buyer','management'].includes(audience))return json(res,422,{error:'audience_not_supported'});
  if(rawMonth&&!validateMonth(rawMonth))return json(res,422,{error:'invalid_month'});
  return json(res,200,monthlyReport(st,{month:rawMonth,requestId,audience}));
}
if(u.pathname==='/api/daily-report'&&req.method==='GET'){
  const st=await load(),requestId=u.searchParams.get('requestId')||null,
    audience=u.searchParams.get('audience')||'management',
    requestedDay=u.searchParams.get('date')||null;
  if(requestId&&!(st.requests||[]).some(x=>x.id===requestId))return json(res,404,{error:'request_not_found'});
  if(!['buyer','management'].includes(audience))return json(res,422,{error:'audience_not_supported'});
  if(requestedDay&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDay))
    return json(res,422,{error:'date_invalid'});
  return json(res,200,dailyReport(st,{requestId,date:requestedDay,audience}));
}
// Quote registration is deliberately "received/unverified". Staff must review real evidence
// and explicitly verify each line before it can affect the benchmark.
if(u.pathname==='/api/quotes/structured'&&req.method==='POST'){
  const b=await body(req),st=await load(),supplier=(st.suppliers||[]).find(x=>x.id===b.supplierId),
    request=(st.requests||[]).find(x=>x.id===b.requestId);
  if(!supplier||!request)return json(res,422,{error:'known_request_and_supplier_required'});
  if(supplier.associatedRequestId&&supplier.associatedRequestId!==b.requestId)
    return json(res,422,{error:'supplier_not_assigned_to_request'});
  if(!['USD','CNY','EUR','YER'].includes(String(b.currency||'')))
    return json(res,422,{error:'unsupported_currency'});
  if(typeof b.basis!=='string'||b.basis.trim().length<3||b.basis.length>160)
    return json(res,422,{error:'quote_basis_required'});
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)
    return json(res,422,{error:'quote_items_required'});
  const items=[];
  for(const item of b.items){
    if(typeof item.description!=='string'||item.description.trim().length<3||item.description.length>260||
      !['m²','sqm','piece','set','kg','unit'].includes(item.unit)||
      !Number.isFinite(Number(item.unitPrice))||Number(item.unitPrice)<=0||
      !Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0)
      return json(res,422,{error:'invalid_quotation_line'});
    items.push({description:item.description.trim(),unit:item.unit,unitPrice:Number(item.unitPrice),
      quantity:Number(item.quantity),comparisonKey:String(item.comparisonKey||'').trim().slice(0,140),
      specifications:String(item.specifications||'').trim().slice(0,400)});
  }
  const evidenceRef=String(b.evidenceRef||'').trim().slice(0,500);
  if(evidenceRef.length<6)return json(res,422,{error:'evidence_reference_required'});
  const quote={id:'Q-'+crypto.randomBytes(8).toString('hex'),supplierId:supplier.id,requestId:request.id,
    category:supplier.category||'unclassified',evidenceClass:'Received Quote — Pending Review',status:'awaiting_review',
    basis:b.basis.trim(),currency:b.currency,items,evidenceRef,
    technical:typeof b.technical==='object'&&b.technical&&!Array.isArray(b.technical)?b.technical:{},
    commercial:typeof b.commercial==='object'&&b.commercial&&!Array.isArray(b.commercial)?b.commercial:{},
    missing:Array.isArray(b.missing)?b.missing.map(x=>String(x).slice(0,130)).slice(0,30):[],
    receivedAt:new Date().toISOString()};
  st.quotes=st.quotes||[];st.quotes.unshift(quote);
  st.activity=st.activity||[];st.activity.unshift({type:'quote_received',time:quote.receivedAt,
    requestId:quote.requestId,text:'عرض جديد '+quote.id+' — يحتاج فحص المستند والتحقق'});
  await save(st);return json(res,201,quote);
}
let verifyQuote=u.pathname.match(/^\/api\/quotes\/([^/]+)\/verify$/);
if(verifyQuote&&req.method==='POST'){
  const st=await load(),q=(st.quotes||[]).find(x=>x.id===verifyQuote[1]),
    b=await body(req);
  if(!q)return json(res,404,{error:'quote_not_found'});
  if(q.evidenceClass==='Verified Quote')return json(res,409,{error:'already_verified'});
  if(String(q.evidenceRef||'').trim().length<6||
    !Array.isArray(q.items)||q.items.some(i=>!(i.unitPrice>0&&i.quantity>0)))
    return json(res,422,{error:'complete_document_and_line_check_required'});
  if(b.confirmVerified!==true||String(b.reviewNote||'').trim().length<12)
    return json(res,422,{error:'explicit_review_confirmation_and_note_required'});
  // The hosted shared-admin demo is not an employee-scoped signature.
  q.evidenceClass='Verified Quote';q.status='reviewed';q.reviewNote=b.reviewNote.trim().slice(0,500);
  q.verifiedAt=new Date().toISOString();q.verifiedBy=HOSTED_DEMO?'demo-admin-review':'authorized-operator';
  st.activity=st.activity||[];st.activity.unshift({type:'quote_verified',time:q.verifiedAt,
    requestId:q.requestId,text:'تم توثيق '+q.id+' بعد مراجعة بشرية: '+q.reviewNote});
  await save(st);return json(res,200,{id:q.id,evidenceClass:q.evidenceClass,
    comparison:priceAnalysis(st,{requestId:q.requestId})});
}

if(u.pathname==='/api/quotes'&&req.method==='POST')return json(res,410,{error:'legacy_unverified_quote_write_disabled',message:'استخدم الإدخال المنظم /api/quotes/structured حتى لا تدخل أسعار دون إثبات.'});
if(u.pathname==='/api/agent/run'&&req.method==='POST'){let st=await load(),b=await body(req);if(b.action==='followup'&&st.settings?.dryRun)return json(res,409,{error:'dry_run_enabled',message:'وضع الحماية مفعل: لا يسمح بإرسال متابعة جماعية فعلية.'});if(b.action==='followup'&&st.settings?.requirePerMessageApproval)return json(res,409,{error:'per_message_approval_required',message:'يلزم اعتماد كل رسالة ومستلم بشكل منفصل قبل الإرسال.'});if(b.action==='followup'&&!gate(st,'followup'))return json(res,409,{error:'approval_required',message:'تحتاج موافقة قبل الإرسال'});if(b.action==='followup'){let targets=st.suppliers.filter(s=>!['رد','تم الرد — ننتظر العرض'].includes(s.status)&&!s.excluded&&s.email);let sent=[];for(let s of targets){await sendMail(s.email,'Follow-up: RFQ-001 – Cold Storage Project, Sana’a','Dear '+s.name+',\n\nThis is a follow-up regarding RFQ-001 for our cold storage project in Sana’a, Yemen. Please send your technical and commercial quotation, including cooling load, equipment brands/models, daily pull-down capacity, 24h power consumption, panel specifications, FOB price/port, CBM/gross weight, lead time, warranty and payment terms.\n\nBest regards,\nAlharir shipping and export');sent.push(s.name)}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تم إرسال متابعة إلى '+sent.length+' مورد'});await save(st);return json(res,200,{ok:true,sent})}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تشغيل الوكيل: '+(b.action||'analyze')});await save(st);return json(res,200,{ok:true,action:b.action||'analyze'})}
let rw=u.pathname.match(/^\/requests\/([^/]+)$/);if(rw&&req.method==='GET'){res.writeHead(302,{Location:'/workspace.html?id='+encodeURIComponent(rw[1])});return res.end()}
let file=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');
if(file.includes('..')||file.includes('\\')||path.isAbsolute(file))return json(res,400,{error:'invalid_path'});let fp=path.join(PUB,file);if(fp.startsWith(PUB)&&fs.existsSync(fp)){let ext=path.extname(fp);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'}[ext]||'application/octet-stream'),'X-Content-Type-Options':'nosniff','Cache-Control':HOSTED_DEMO?'private, no-store':'no-cache','Vary':'Authorization'});return fs.createReadStream(fp).pipe(res)}res.writeHead(404);res.end('Not found')
}catch(e){
  if(e&&e.message==='gmail_token_expired_or_revoked')return json(res,401,{error:'gmail_token_expired_or_revoked',message:'انتهت أو أُلغيت صلاحية Gmail. أعد ربط Gmail من صفحة الوكيل مرة واحدة لإنشاء Refresh Token جديد.'});
  if(e&&e.message==='gmail_not_connected')return json(res,401,{error:'gmail_not_connected',message:'Gmail غير مرتبط حاليًا. استخدم زر ربط Gmail ثم أعد المحاولة.'});
  if(e&&e.code==='STATE_CONFLICT')return json(res,409,{error:'state_revision_conflict',message:'تم تحديث البيانات بالتزامن. حدّث الصفحة وأعد المحاولة.'});
   if(process.env.PROCUREMENT_PRODUCTION==='true'){
     console.error('Production request failed',e.message);
     return json(res,500,{error:'internal_error',message:'تعذر إكمال العملية، راجع سجلات النظام.'});
   }
   json(res,500,{error:e.message})
}});store.ready().then(()=>{
 server.listen(process.env.PORT||8787,()=>console.log('Procurement V2 listening on port '+(process.env.PORT||8787)));
  // Operational diagnostics only. Never log tokens, email addresses or OAuth secrets.
  oauth().then(tokens=>console.log('Gmail readiness (no secrets): clientConfigured='+Boolean(GCLIENT&&GSECRET)+
    ',expectedMailboxConfigured='+Boolean(process.env.GMAIL_EXPECTED_EMAIL)+
    ',tokenStored='+Boolean(tokens.refresh_token)+
    ',autoSyncEnabled='+(LIVE&&process.env.GMAIL_AUTO_SYNC==='true')))
    .catch(e=>console.error('Gmail readiness check failed: '+(e.code||'oauth_store_unavailable')));

 if(LIVE&&process.env.GMAIL_AUTO_SYNC==='true'){
  const timer=setInterval(async()=>{
   if(syncInProgress)return;
   syncInProgress=true;
   try{
    if(!oauthConfig().ok||!(await oauth()).refresh_token)return;
    await verifyCompanyMailbox();
    const report=await syncGmail();
    console.log('Gmail read-only sync: queries='+report.queries+', added='+report.added);
   }catch(e){console.error('Gmail read-only sync failed:',e.code||e.message)}
   finally{syncInProgress=false}
  },30*60*1000);
  timer.unref();
 }
}).catch(e=>{console.error('Persistent state startup failed:',e.message);process.exitCode=1;});