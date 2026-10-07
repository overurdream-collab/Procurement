const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const DATA=path.join(__dirname,'data.json'),OAUTH=path.join(__dirname,'.gmail-oauth.json'),PUB=path.join(__dirname,'public');

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
const GCLIENT=(process.env.GOOGLE_CLIENT_ID||'').trim(),GSECRET=(process.env.GOOGLE_CLIENT_SECRET||'').trim(),BASE=(process.env.APP_BASE_URL||'http://localhost:'+(process.env.PORT||8787)).replace(/\/$/,''),REDIRECT=BASE+'/api/gmail/callback';
const oauthConfig=()=>{
  if(!GCLIENT||!GSECRET)return {ok:false,error:'missing_google_oauth_config',message:'إعداد Gmail غير مكتمل. أضف GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في ملف .env ثم أعد تشغيل الخادم.'};
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
const load=()=>{let st=JSON.parse(fs.readFileSync(DATA,'utf8'));if(ensureRecentSuppliers(st))fs.writeFileSync(DATA,JSON.stringify(st,null,2));return st},save=x=>fs.writeFileSync(DATA,JSON.stringify(x,null,2));
const oauth=()=>fs.existsSync(OAUTH)?JSON.parse(fs.readFileSync(OAUTH,'utf8')):{},saveOauth=x=>fs.writeFileSync(OAUTH,JSON.stringify(x,null,2),{mode:0o600});
const json=(r,s,x)=>{r.writeHead(s,{'Content-Type':'application/json; charset=utf-8'});r.end(JSON.stringify(x))},body=req=>new Promise((ok,no)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch(e){no(e)}})});
async function formPost(url,obj){let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(obj)}),t=await r.json();if(!r.ok)throw Error(t.error_description||t.error||'oauth_error');return t}
async function accessToken(){let o=oauth();if(o.access_token&&o.expires_at>Date.now()+60000)return o.access_token;if(!o.refresh_token)throw Error('gmail_not_connected');let t=await formPost('https://oauth2.googleapis.com/token',{client_id:GCLIENT,client_secret:GSECRET,refresh_token:o.refresh_token,grant_type:'refresh_token'});o={...o,...t,expires_at:Date.now()+t.expires_in*1000};saveOauth(o);return o.access_token}
async function gmail(endpoint,opt={}){let token=await accessToken(),r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+endpoint,{...opt,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opt.headers||{})}}),t=await r.json();if(!r.ok)throw Error(t.error?.message||'gmail_error');return t}
const b64url=s=>Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function sendMail(to,subject,text){let raw=['To: '+to,'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',''+text].join('\r\n');return gmail('messages/send',{method:'POST',body:JSON.stringify({raw:b64url(raw)})})}
function headers(m){return Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]))}
function decodePart(p){if(p?.body?.data)return Buffer.from(p.body.data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');for(let x of p?.parts||[]){let v=decodePart(x);if(v)return v}return ''}
function emailDomain(v){let m=String(v||'').toLowerCase().match(/@([a-z0-9.-]+)/);return m?m[1]:''}
function supplierForFrom(st,from){
  let f=String(from||'').toLowerCase(),free=new Set(['gmail.com','outlook.com','hotmail.com','yahoo.com','qq.com','163.com']);
  return (st.suppliers||[]).find(s=>{
    let emails=[s.email,...(s.alternateEmails||[])].filter(Boolean).map(x=>String(x).toLowerCase());
    if(emails.some(e=>f.includes(e)))return true;
    let domains=[...new Set(emails.map(emailDomain).filter(d=>d&&!free.has(d)))];
    return domains.some(d=>f.includes('@'+d));
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
async function projectMessageCandidates(){
  let queries=[
    'RFQ-001 newer_than:90d -from:me',
    '{\"cold room\" \"cold rooms\" \"cold storage\" refrigeration 冷库 报价 询价 solar hybrid} newer_than:90d -from:me'
  ],map=new Map();
  for(let q of queries){
    let r=await gmail('messages?q='+encodeURIComponent(q)+'&maxResults=100');
    for(let m of r.messages||[])map.set(m.id,m)
  }
  return [...map.values()]
}
async function syncGmail(){let st=load(),known=new Set(st.gmailMessages||[]),records=st.correspondence||[],supplierEmails=new Map();for(const sup of st.suppliers||[]){for(const e of [sup.email,...(sup.alternateEmails||[])].filter(Boolean))supplierEmails.set(String(e).toLowerCase(),sup)}let queries=['newer_than:90d RFQ-001','newer_than:90d "Cold Room"','newer_than:90d "Cold Storage"'];for(const e of supplierEmails.keys())queries.push('newer_than:90d from:'+e);let ids=new Set();for(const q of queries){let list=await gmail('messages?q='+encodeURIComponent(q)+'&maxResults=100');for(const it of list.messages||[])ids.add(it.id)}let added=0,matched=0,unmatched=0;for(const id of ids){if(known.has(id))continue;let m=await gmail('messages/'+id+'?format=full'),h=headers(m),from=h.from||'',sub=h.subject||'',txt=decodePart(m.payload)||m.snippet||'',fromLower=from.toLowerCase(),sup=[...supplierEmails.entries()].find(([email])=>fromLower.includes(email))?.[1];let relevant=!!sup||/RFQ-001|cold\s*(room|storage)|fresh\s*produce/i.test(sub+' '+txt);if(!relevant){unmatched++;continue}let attachments=[];function collect(p){if(p?.filename)attachments.push({filename:p.filename,mimeType:p.mimeType||'',attachmentId:p.body?.attachmentId||null,size:p.body?.size||0});for(const c of p?.parts||[])collect(c)}collect(m.payload);records.push({id,messageId:id,threadId:m.threadId||null,supplierId:sup?.id||null,supplierName:sup?.name||null,from,subject:sub,body:txt,snippet:m.snippet||'',attachments,receivedAt:m.internalDate?new Date(Number(m.internalDate)).toISOString():new Date().toISOString(),requestId:'RFQ-001',extractionStatus:attachments.length?'needs_extraction':'received'});if(sup){sup.status=attachments.length?'رد — يحتاج استخراج':'رد';sup.lastReply=new Date().toISOString();sup.lastSubject=sub}st.activity.unshift({id:'MAIL-'+id,time:new Date().toISOString(),type:'gmail_reply',text:'رد جديد: '+(sup?.name||from),messageId:id,subject:sub,supplierId:sup?.id||null});known.add(id);added++;matched++}st.gmailMessages=[...known];st.correspondence=records;save(st);return {added,matched,unmatched,scanned:ids.size}}
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

function marketNums(v){return (String(v||'').match(/(?:USD|US\\$|[$])\\s*[0-9,.]+|[0-9,.]+\\s*(?:USD|US\\$)/gi)||[]).map(x=>Number(x.replace(/[^0-9.]/g,'').replace(/,(?=[0-9]{3}\\b)/g,''))).filter(x=>Number.isFinite(x)&&x>0)}
function marketPriceMentions(v){return (String(v||'').match(/(?:USD|US\\$|[$]|RMB|CNY|CN¥|¥)\\s*[0-9,.]+|[0-9,.]+\\s*(?:USD|US\\$|RMB|CNY|CN¥|¥)/gi)||[]).slice(0,8)}
function marketStats(a){a=[...a].sort((x,y)=>x-y);if(!a.length)return null;let q=p=>a[Math.min(a.length-1,Math.floor((a.length-1)*p))];return {low:a[0],median:q(.5),high:a[a.length-1],targetLow:q(.2),targetHigh:q(.45),count:a.length,currency:'USD'}}
const MARKET_TARGETS=[
  {platform:'Alibaba',domain:'alibaba.com',region:'China / International',query:'site:alibaba.com'},
  {platform:'1688',domain:'1688.com',region:'China',query:'site:1688.com'},
  {platform:'Made-in-China',domain:'made-in-china.com',region:'China / International',query:'site:made-in-china.com'},
  {platform:'Taobao',domain:'taobao.com',region:'China',query:'site:taobao.com'},
  {platform:'Global Sources',domain:'globalsources.com',region:'Asia / International',query:'site:globalsources.com'},
  {platform:'Company websites',domain:null,region:'International',query:'manufacturer supplier factory official website'}
];
function marketBaseQuery(req){return [req.product||'cold room',req.title,req.specifications,(req.designBasis?.temperature||''),(req.designBasis?.roomSizes||[]).join(' '),'cold storage refrigeration panel PIR PU compressor evaporator price'].filter(Boolean).join(' ')}
async function googleCse(q,num=10){
  if(!process.env.GOOGLE_CSE_API_KEY||!process.env.GOOGLE_CSE_ID)return {configured:false,items:[]};
  let u='https://www.googleapis.com/customsearch/v1?key='+encodeURIComponent(process.env.GOOGLE_CSE_API_KEY)+'&cx='+encodeURIComponent(process.env.GOOGLE_CSE_ID)+'&num='+Math.min(10,num)+'&q='+encodeURIComponent(q);
  let r=await fetch(u),j=await r.json();if(!r.ok)throw Error(j.error?.message||'market_search_error');return {configured:true,items:j.items||[]}
}
async function googleMarketSources(req){
  let base=marketBaseQuery(req),out=[],configured=!!(process.env.GOOGLE_CSE_API_KEY&&process.env.GOOGLE_CSE_ID),errors=[];
  for(const target of MARKET_TARGETS){
    try{
      let r=await googleCse(base+' '+target.query,8);configured=r.configured;
      for(const x of r.items||[]){
        let domain='';try{domain=new URL(x.link).hostname.replace(/^www\./,'')}catch{}
        let txt=(x.title||'')+' '+(x.snippet||'');
        out.push({type:'Published Market Source',platform:target.platform,region:target.region,domain:domain||target.domain,title:x.title,url:x.link,snippet:x.snippet||'',priceMentions:marketPriceMentions(txt),prices:marketNums(txt),searchQuery:base+' '+target.query})
      }
    }catch(e){errors.push(target.platform+': '+e.message)}
  }
  let seen=new Set();out=out.filter(x=>{let k=x.url||x.title;if(seen.has(k))return false;seen.add(k);return true});
  return {configured,sources:out,errors}
}
function historicalMarketSources(st,req){return (st.quotes||[]).filter(x=>!x.requestId||x.requestId===req.id).map(x=>({type:'Historical Price',platform:'Internal',region:'Internal',domain:null,title:'Internal quote '+x.id,url:null,snippet:x.basis||'',priceMentions:[],prices:[x.totalPrice,x.price,x.unitPrice].map(Number).filter(n=>Number.isFinite(n)&&n>0)})).filter(x=>x.prices.length)}
async function marketScan(st,req){
  let query=marketBaseQuery(req),sources=historicalMarketSources(st,req),mode='historical',searchStatus={configured:false,targets:MARKET_TARGETS.map(x=>x.platform),errors:[]};
  try{
    let live=await googleMarketSources(req);searchStatus={configured:live.configured,targets:MARKET_TARGETS.map(x=>x.platform),errors:live.errors||[]};
    if(live.sources.length){sources.push(...live.sources);mode='live-internet+historical'}
    else if(!live.configured)mode='internet-not-configured';
    else mode='live-no-results'
  }catch(e){mode='internet-search-error';searchStatus.errors=[e.message]}
  for(let x of req.sourceObservations||[]){
    let txt=(x.price||'')+' '+(x.note||''),p=marketNums(txt);
    sources.push({type:x.type||'User supplied source',platform:x.platform||'Manual',region:x.region||'',domain:x.domain||'',title:x.title||'User supplied source',url:x.url||null,snippet:x.note||'',priceMentions:marketPriceMentions(txt),prices:p})
  }
  let usdValues=sources.flatMap(x=>x.prices||[]),s=marketStats(usdValues),published=sources.filter(x=>x.type==='Published Market Source'),platforms=[...new Set(published.map(x=>x.platform).filter(Boolean))],domains=[...new Set(published.map(x=>x.domain).filter(Boolean))];
  let confidence=Math.min(95,Math.round((published.length>=12?50:published.length*4)+(platforms.length>=4?20:platforms.length*5)+(usdValues.length>=6?15:usdValues.length*2)+(mode.startsWith('live')?10:0)));
  return {id:'MS-'+Date.now(),requestId:req.id,createdAt:new Date().toISOString(),query,mode,sourceCount:sources.length,confidence,benchmark:s,searchStatus,coverage:{platforms,domains,platformCount:platforms.length,domainCount:domains.length},classification:{verifiedQuotes:sources.filter(x=>x.type==='Verified Quote').length,publishedPrices:published.length,historicalPrices:sources.filter(x=>x.type==='Historical Price').length,aiEstimates:0},sources:sources.slice(0,80),disclaimer:'Internet marketplace prices are market intelligence only, not verified supplier quotations. USD benchmark uses only explicit USD prices; RMB/CNY mentions are retained as source evidence and are not mixed into the USD benchmark.'}
}

const server=http.createServer(async(req,res)=>{try{
res.setHeader('X-Content-Type-Options','nosniff');
res.setHeader('X-Frame-Options','DENY');
res.setHeader('Referrer-Policy','no-referrer');
res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
let u=new URL(req.url,'http://localhost');if(u.pathname==='/api/state'&&req.method==='GET'){let st=load();st.gmail={connected:!!oauth().refresh_token,configured:!!(GCLIENT&&GSECRET)};return json(res,200,st)}
if(u.pathname==='/api/gmail/status'&&req.method==='GET'){let cfg=oauthConfig();return json(res,200,{connected:!!oauth().refresh_token,configured:cfg.ok,redirectUri:REDIRECT,error:cfg.ok?null:cfg.error,message:cfg.ok?null:cfg.message});}
if(u.pathname==='/api/gmail/connect'&&req.method==='GET'){let cfg=oauthConfig();if(!cfg.ok)return json(res,400,cfg);let state=crypto.randomBytes(18).toString('hex');saveOauth({...oauth(),state});let q=new URLSearchParams({client_id:GCLIENT,redirect_uri:REDIRECT,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state});res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+q});return res.end()}
if(u.pathname==='/api/gmail/callback'&&req.method==='GET'){let o=oauth();if(!u.searchParams.get('code')||u.searchParams.get('state')!==o.state)return json(res,400,{error:'invalid_oauth_state'});let t=await formPost('https://oauth2.googleapis.com/token',{code:u.searchParams.get('code'),client_id:GCLIENT,client_secret:GSECRET,redirect_uri:REDIRECT,grant_type:'authorization_code'});saveOauth({...t,expires_at:Date.now()+t.expires_in*1000});res.writeHead(302,{Location:'/#agent'});return res.end()}
if(u.pathname==='/api/gmail/disconnect'&&req.method==='POST'){if(fs.existsSync(OAUTH))fs.unlinkSync(OAUTH);return json(res,200,{ok:true})}
if(u.pathname==='/api/gmail/sync'&&req.method==='POST'){let cfg=oauthConfig();if(!cfg.ok)return json(res,400,cfg);if(!oauth().refresh_token)return json(res,409,{error:'gmail_not_connected',message:'اربط Gmail أولاً ثم أعد المزامنة.'});return json(res,200,await syncGmail());}
if(u.pathname==='/api/gmail/attachment'&&req.method==='GET'){
  let st=load(),messageId=u.searchParams.get('messageId')||'',attachmentId=u.searchParams.get('attachmentId')||'';
  let rec=(st.gmailReplies||[]).find(x=>x.messageId===messageId),att=rec&&(rec.attachments||[]).find(x=>x.attachmentId===attachmentId);
  if(!rec||!att)return json(res,404,{error:'attachment_not_found'});
  let a=await gmail('messages/'+encodeURIComponent(messageId)+'/attachments/'+encodeURIComponent(attachmentId)),buf=Buffer.from(String(a.data||'').replace(/-/g,'+').replace(/_/g,'/'),'base64');
  res.writeHead(200,{'Content-Type':att.mimeType||'application/octet-stream','Content-Disposition':'inline; filename*=UTF-8\'\''+encodeURIComponent(att.filename||'attachment'),'Content-Length':buf.length});return res.end(buf)
}
if(u.pathname==='/api/requests'&&req.method==='POST'){let st=load(),b=await body(req),x={id:'REQ-'+String(Date.now()).slice(-6),title:b.title||'طلب مشتريات جديد',product:b.product||'',specifications:b.specifications||'',quantity:b.quantity||'',deliveryCountry:b.deliveryCountry||'',targetMarkets:b.targetMarkets||'',currency:b.currency||'USD',incoterm:b.incoterm||'FOB',neededBy:b.neededBy||'',notes:b.notes||'',status:'جديد',createdAt:new Date().toISOString()};st.requests=st.requests||[];st.marketScans=st.marketScans||[];st.requests.unshift(x);st.activity.unshift({time:new Date().toISOString(),type:'request',text:'إنشاء '+x.id});save(st);return json(res,201,x)}
let mm=u.pathname.match(new RegExp('^/api/requests/([^/]+)/market-scan$'));if(mm&&req.method==='POST'){let st=load(),b=await body(req),x=(st.requests||[]).find(x=>x.id===mm[1]);if(!x)return json(res,404,{error:'request_not_found'});let scan=await marketScan(st,{...x,sourceObservations:b.sourceObservations||[]});st.marketScans=st.marketScans||[];st.marketScans.unshift(scan);x.marketScanId=scan.id;x.marketStatus='completed';st.activity.unshift({time:new Date().toISOString(),type:'market_scan',text:'Market Intelligence '+x.id+' — '+scan.sourceCount+' sources'});save(st);return json(res,200,scan)}
if(u.pathname==='/api/market-scans'&&req.method==='GET'){let st=load();return json(res,200,st.marketScans||[])}
let wm=u.pathname.match(/^\/api\/requests\/([^/]+)\/workspace$/);
if(wm&&req.method==='GET'){let st=load(),x=(st.requests||[]).find(x=>x.id===wm[1]);if(!x)return json(res,404,{error:'request_not_found'});return json(res,200,{request:x,workspace:ensureWorkspace(x)})}
if(wm&&req.method==='PATCH'){let st=load(),b=await body(req),x=(st.requests||[]).find(x=>x.id===wm[1]);if(!x)return json(res,404,{error:'request_not_found'});let w=ensureWorkspace(x),allowed=['specifications','analysisRules','commercialTerms','supplierStrategy','scenarios','facts','aiInstructions'];if(!allowed.includes(b.section))return json(res,400,{error:'invalid_workspace_section'});let item=addWorkspaceItem(x,b.section,b.value,b.status||'Confirmed Decision',b.source||'Manual UI');save(st);return json(res,200,{item,workspace:w})}
let cm=u.pathname.match(/^\/api\/requests\/([^/]+)\/copilot$/);
if(cm&&req.method==='POST'){let st=load(),b=await body(req),base=(st.requests||[]).find(x=>x.id===cm[1]);if(!base)return json(res,404,{error:'request_not_found'});let message=String(b.message||'').trim();if(!message)return json(res,400,{error:'message_required'});let x=requestRef(st,message,cm[1])||base,w=ensureWorkspace(x);w.chat.push({role:'user',text:message,time:new Date().toISOString()});let actions=copilotPlan(message),executed=[];for(const a of actions){if(a.type==='add_context')executed.push(addWorkspaceItem(x,a.section,a.value,'Confirmed Decision','AI Copilot from user instruction'))}let read=copilotRead(st,x,message),reply;if(executed.length){reply='تم تنفيذ '+executed.length+' تحديث على '+x.id+'.\n'+executed.map(z=>'✓ '+z.value).join('\n');let after=copilotRead(st,x,message);if(after&&after.answer)reply+='\n\n'+after.answer}else if(read){reply=read.answer+'\n\nالمصدر: '+read.source}else{reply='أستطيع الاستعلام من بيانات الطلبات والموردين والعروض والمواصفات والشروط وسجل البريد، أو تنفيذ تحديثات على Workspace. لم أجد بعد استعلامًا مدعومًا بشكل موثوق في هذه الصياغة، لذلك لم أغيّر أي بيانات.'}w.chat.push({role:'assistant',text:reply,time:new Date().toISOString(),requestId:x.id,executed:executed.map(z=>z.id)});auditWorkspace(x,executed.length?'copilot_action':'copilot_query',message,'AI Copilot',null,{requestId:x.id,executed:executed.map(z=>z.id)});save(st);return json(res,200,{reply,requestId:x.id,intent:executed.length?'act':read?'ask':'unknown',executed,workspace:w})}
let sm=u.pathname.match(/^\/api\/suppliers\/([^/]+)$/);if(sm&&req.method==='PATCH'){let st=load(),b=await body(req),x=st.suppliers.find(x=>x.id===sm[1]);if(!x)return json(res,404,{error:'not_found'});Object.assign(x,b);save(st);return json(res,200,x)}
let am=u.pathname.match(/^\/api\/approvals\/([^/]+)$/);if(am&&req.method==='PATCH'){let st=load(),b=await body(req),x=st.approvals.find(x=>x.id===am[1]);if(!x)return json(res,404,{error:'not_found'});x.status=b.status||x.status;x.updatedAt=new Date().toISOString();save(st);return json(res,200,x)}
if(u.pathname==='/api/settings'&&req.method==='PATCH'){let st=load(),b=await body(req);st.settings={...st.settings,...b};save(st);return json(res,200,st.settings)}
if(u.pathname==='/api/quotes'&&req.method==='POST'){let st=load(),b=await body(req),x={id:'Q-'+Date.now(),...b,createdAt:new Date().toISOString()};st.quotes.unshift(x);save(st);return json(res,201,x)}
if(u.pathname==='/api/agent/run'&&req.method==='POST'){let st=load(),b=await body(req);if(b.action==='followup'&&st.settings?.dryRun)return json(res,409,{error:'dry_run_enabled',message:'وضع الحماية مفعل: لا يسمح بإرسال متابعة جماعية فعلية.'});if(b.action==='followup'&&st.settings?.requirePerMessageApproval)return json(res,409,{error:'per_message_approval_required',message:'يلزم اعتماد كل رسالة ومستلم بشكل منفصل قبل الإرسال.'});if(b.action==='followup'&&!gate(st,'followup'))return json(res,409,{error:'approval_required',message:'تحتاج موافقة قبل الإرسال'});if(b.action==='followup'){let targets=st.suppliers.filter(s=>!['رد','تم الرد — ننتظر العرض'].includes(s.status)&&!s.excluded&&s.email);let sent=[];for(let s of targets){await sendMail(s.email,'Follow-up: RFQ-001 – Cold Storage Project, Sana’a','Dear '+s.name+',\n\nThis is a follow-up regarding RFQ-001 for our cold storage project in Sana’a, Yemen. Please send your technical and commercial quotation, including cooling load, equipment brands/models, daily pull-down capacity, 24h power consumption, panel specifications, FOB price/port, CBM/gross weight, lead time, warranty and payment terms.\n\nBest regards,\nAlharir shipping and export');sent.push(s.name)}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تم إرسال متابعة إلى '+sent.length+' مورد'});save(st);return json(res,200,{ok:true,sent})}st.activity.unshift({time:new Date().toISOString(),type:'agent',text:'تشغيل الوكيل: '+(b.action||'analyze')});save(st);return json(res,200,{ok:true,action:b.action||'analyze'})}
let rw=u.pathname.match(/^\/requests\/([^/]+)$/);if(rw&&req.method==='GET'){res.writeHead(302,{Location:'/workspace.html?id='+encodeURIComponent(rw[1])});return res.end()}
let file=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');
if(file.includes('..')||file.includes('\\')||path.isAbsolute(file))return json(res,400,{error:'invalid_path'});let fp=path.join(PUB,file);if(fp.startsWith(PUB)&&fs.existsSync(fp)){let ext=path.extname(fp);res.writeHead(200,{'Content-Type':ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript':'text/plain'});return fs.createReadStream(fp).pipe(res)}res.writeHead(404);res.end('Not found')
}catch(e){json(res,500,{error:e.message})}});server.listen(process.env.PORT||8787,()=>console.log('Procurement V2: http://localhost:'+(process.env.PORT||8787)));