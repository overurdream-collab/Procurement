'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),net=require('node:net');
const {setTimeout:delay}=require('node:timers/promises');
const ui=require('../public/mail-correspondence.js');
const {matchRequestForEmail}=require('../gmail-request-link');
const main=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const workspace=fs.readFileSync(path.join(__dirname,'../public/workspace.html'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
function freePort(){return new Promise((resolve,reject)=>{const n=net.createServer();n.once('error',reject);n.listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>resolve(p))})})}
test('Gmail source date displayed in Sana’a local timezone, not replaced by last sync time',()=>{
 const input={receivedAt:'2026-10-15T21:30:00.000Z',syncedAt:'2026-10-16T20:00:00.000Z'};
 const label=ui.receivedAtText(input);
 assert.match(label,/توقيت صنعاء/);
 assert.match(label,/صباحًا|ص|AM|am|12|١٢|٠٠|صباحاً|صباحا/i);
 assert.doesNotMatch(label,/2026-10-16T20:00:00/);
 assert.equal(ui.receivedAtText({}), 'تاريخ الاستلام غير متوفر من المصدر');
});
test('supplier messages preserve filenames, show original date and escape untrusted HTML',()=>{
 const m={messageId:'MAIL-001',requestId:'RFQ-001',subject:'RFQ <img src=x onerror=alert(1)>',
  receivedAt:'2026-10-14T13:45:00Z',from:'sales@factory.example',
  attachments:[{filename:'Quotation & tech.pdf',mimeType:'application/pdf',attachmentId:'A&B',size:125000}]};
 const html=ui.messageHtml(m);
 assert.match(html,/تاريخ الاستلام:/);
 assert.match(html,/توقيت صنعاء/);
 assert.match(html,/Quotation &amp; tech.pdf/);
 assert.match(html,/attachmentId=A%26B/);
 assert.doesNotMatch(html,/<img src=x onerror=/);
 const preview=ui.messageHtml(m,{disabled:true});
 assert.match(preview,/معطل في بيئة التجربة/);
 assert.doesNotMatch(preview,/<a class="btn"/);
});
test('request association remains strict even when supplier has several requests',()=>{
 const st={requests:[
  {id:'RFQ-001',selectedSupplierIds:['SUP1']},
  {id:'REQ-AB1234567890',selectedSupplierIds:['SUP1']},
  {id:'REQ-CD1234567890',selectedSupplierIds:['SUP2']}
 ],suppliers:[{id:'SUP1'},{id:'SUP2'}]};
 assert.equal(matchRequestForEmail(st,{subject:'Offer REQ-CD1234567890',supplierId:'SUP1'}).requestId,'REQ-CD1234567890');
 assert.equal(matchRequestForEmail(st,{subject:'Offer',supplierId:'SUP1'}).requestId,null);
 assert.equal(matchRequestForEmail(st,{subject:'RE: RFQ-001, REQ-CD1234567890',supplierId:'SUP1'}).requestId,null);
});
test('web UI keeps both supplier-log and per-RFQ attachment access',()=>{
 assert.match(main,/mail-correspondence\.js/);
 assert.match(main,/ALHARIRMailUI\.receivedAtText\(m\)/);
 assert.match(main,/ALHARIRMailUI\.attachmentHtml\(m/);
 assert.match(workspace,/id="requestMailCard"/);
 assert.match(workspace,/loadCorrespondence/);
 assert.match(workspace,/ALHARIRMailUI\.messageHtml/);
 assert.match(server,/api\/gmail\/attachment/);
 assert.match(server,/attachment_exceeds_preview_limit/);
 assert.match(server,/requestMatchMethod/);
 assert.match(server,/receivedAt=m\.internalDate/);
});
test('staging protected HTTP rejects Gmail attachments while still returning per-RFQ safe metadata',async()=>{
 const p=await freePort(),base='http://127.0.0.1:'+p;
 const user='email-test',password='long-synthetic-password-2026-only';
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),stdio:'ignore',
  env:{...process.env,PORT:String(p),STAGING_HOSTED:'true',STAGING_DEMO:'true',
   HOSTED_ACCESS_USER:user,HOSTED_ACCESS_PASSWORD:password,MARKET_ENABLE_LIVE_SEARCH:'false'}});
 const headers={Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')};
 try{
  let ready=false;
  for(let i=0;i<90;i++){if(child.exitCode!==null)throw Error('server exited');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ready,true);
  let r=await fetch(base+'/api/requests/RFQ-001/correspondence');
  assert.equal(r.status,401);
  r=await fetch(base+'/api/requests/RFQ-001/correspondence',{headers});
  assert.equal(r.status,200);const record=await r.json();
  assert.equal(record.requestId,'RFQ-001');
  assert.equal(record.integrationAvailable,false);
  assert.deepEqual(record.records,[]);
  assert.match(record.notice,/معطل/);
  r=await fetch(base+'/api/gmail/attachment?messageId=x&attachmentId=y',{headers});
  assert.equal(r.status,403);
  r=await fetch(base+'/mail-correspondence.js',{headers});
  assert.equal(r.status,200);
 }finally{child.kill('SIGTERM')}
});
