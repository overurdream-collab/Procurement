'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const net=require('node:net');
async function freePort(){
 return new Promise((resolve,reject)=>{
  const s=net.createServer();s.on('error',reject);
  s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))});
 });
}
test('real protected HTTP: indexed search -> company research -> select one -> RFQ + unsent email draft',async()=>{
 const searchPort=await freePort(),port=await freePort();
 const s=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname!=='/search')return res.writeHead(404).end();
  const q=u.searchParams.get('q')||'';
  let results;
  if(q.includes('site:alibaba.com'))results=[{
   title:'100mm PIR cold room panel listing',url:'https://www.alibaba.com/product-detail/pir-one',content:'US$19.50 / sqm'
  }];
  else if(q.includes('site:made-in-china.com'))results=[{
   title:'100mm PIR cold room panel listing',url:'https://www.made-in-china.com/pir-two',content:'US$20.50 / sqm'
  }];
  else if(q.includes('site:1688.com'))results=[{
   title:'冷库板 100mm PIR',url:'https://detail.1688.com/offer/987',content:'￥140/平方米'
  }];
  else results=[{
   title:'Jialiang Cooling contact',url:'https://jialiangcooling.test/contact',
   content:'Jialiang Cooling Sales: sales@jialiangcooling.test'
  }];
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({results}));
 });
 await new Promise(resolve=>s.listen(searchPort,'127.0.0.1',resolve));
 const env={...process.env,STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'rfq-tester',HOSTED_ACCESS_PASSWORD:'a-very-long-test-password-2026',
  MARKET_ENABLE_LIVE_SEARCH:'true',SEARXNG_URL:'http://127.0.0.1:'+searchPort+'/',
  MARKET_MAX_SEARCH_QUERIES:'3',PORT:String(port)};
 const child=spawn(process.execPath,['server.js'],{
  cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'
 });
 const base='http://127.0.0.1:'+port;
 const auth='Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64');
 const headers={'Content-Type':'application/json','Authorization':auth};
 const post=(path,body)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
 try{
  let ok=false;
  for(let n=0;n<100;n++){
   if(child.exitCode!==null)throw Error('Host quit before healthy');
   try{if((await fetch(base+'/health/live')).ok){ok=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ok,true);
  let r=await fetch(base+'/api/state',{headers});assert.equal(r.status,200);
  const before=await r.json();
  r=await post('/api/market-intelligence/search',{query:'100mm PIR cold room panel'});
  assert.equal(r.status,200);const results=await r.json();
  assert.equal(results.count,3);
  assert.ok(results.searchId);
  const idx=results.results.find(x=>x.source==='Alibaba').index;
  r=await post('/api/market-intelligence/contacts',{
   searchId:results.searchId,index:idx,companyName:'Jialiang Cooling'
  });
  assert.equal(r.status,200);
  const contact=await r.json();
  assert.equal(contact.officialVerified,false);
  assert.equal(contact.contacts.length,1);
  assert.equal(contact.contacts[0].emails[0],'sales@jialiangcooling.test');
  r=await post('/api/market-intelligence/convert',{
   searchId:results.searchId,
   selected:[{index:idx,companyName:'Jialiang Cooling',email:contact.contacts[0].emails[0],
     websiteUrl:'https://jialiangcooling.test/',contactEvidenceUrl:contact.contacts[0].pageUrl}],
   details:{quantity:'50 sqm',product:'100mm PIR cold room panel',
     specifications:'PIR core, 100mm, steel 0.5mm, density 40kg/m3',incoterm:'FOB'}
  });
  assert.equal(r.status,201);const created=await r.json();
  assert.equal(created.sentCount,0);
  assert.equal(created.suppliers.length,1);
  assert.equal(created.drafts.length,1);
  assert.equal(created.drafts[0].requiresReview,true);
  assert.match(created.drafts[0].body,/FOB only/);
  r=await fetch(base+'/api/requests/'+created.request.id+'/outreach-drafts',{headers});
  assert.equal(r.status,200);const draftResponse=await r.json();
  assert.equal(draftResponse.sentCount,0);
  assert.equal(draftResponse.drafts[0].to,'sales@jialiangcooling.test');
  r=await fetch(base+'/api/state',{headers});const after=await r.json();
  assert.equal(after.requests.length,before.requests.length+1);
  assert.equal(after.suppliers.length,before.suppliers.length+1);
  assert.equal(after.requests[0].selectedSupplierIds.length,1);
  r=await fetch(base+'/',{headers});assert.equal(r.status,200);
  assert.match(await r.text(),/market-outreach\.js/);
  r=await fetch(base+'/market-outreach.js',{headers});assert.equal(r.status,200);
  const client=await r.text();
  assert.match(client,/function marketLeadPanel/);
  assert.match(client,/function convertMarketLeads/);
  assert.match(client,/function downloadMarketRFQ/);

  r=await post('/api/agent/run',{action:'followup'});
  assert.equal(r.status,403);
 }finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>s.close(resolve));
 }
});



test('manual no-key route creates real demo RFQ from chosen subset without sending or inventing suppliers',async()=>{
 const port=await freePort();
 const env={...process.env,STAGING_HOSTED:'true',STAGING_DEMO:'true',
  HOSTED_ACCESS_USER:'manual-reviewer',HOSTED_ACCESS_PASSWORD:'strong-test-password-4567890',
  MARKET_ENABLE_LIVE_SEARCH:'false',PORT:String(port)};
 const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env,stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const headers={'Content-Type':'application/json',
  Authorization:'Basic '+Buffer.from(env.HOSTED_ACCESS_USER+':'+env.HOSTED_ACCESS_PASSWORD).toString('base64')};
 const post=(url,data)=>fetch(base+url,{method:'POST',headers,body:JSON.stringify(data)});
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Server unexpectedly terminated');
   try{if((await fetch(base+'/health/live')).ok){ready=true;break}}catch{}
   await delay(100);
  }
  assert.equal(ready,true);
  let r=await post('/api/market-intelligence/search',{query:'100mm PIR panels'});
  assert.equal(r.status,200);assert.equal((await r.json()).count,0);
  r=await post('/api/market-intelligence/manual-leads',{
   query:'100mm PIR panels',urls:[
     'https://www.alibaba.com/product-detail/panels-one',
     'https://www.made-in-china.com/offer/panels-two'
   ]});
  assert.equal(r.status,200);const leads=await r.json();
  assert.equal(leads.count,2);assert.equal(leads.manual,true);
  r=await post('/api/market-intelligence/convert',{
   searchId:leads.searchId,
   selected:[{index:1,companyName:'Demo Factory Selected',
     email:'sales@factory.test',websiteUrl:'https://factory.test/',contactEvidenceUrl:'https://factory.test/contact'}],
   details:{quantity:'100 sqm',specifications:'PIR 100mm, density 40kg/m3, FOB'}
  });
  assert.equal(r.status,201);const rfq=await r.json();
  assert.equal(rfq.suppliers.length,1);
  assert.equal(rfq.request.selectedSupplierIds.length,1);
  assert.equal(rfq.suppliers[0].sourcePlatform,'Operator-supplied public link');
  assert.equal(rfq.sentCount,0);
  assert.equal(rfq.drafts[0].canOpenEmail,true);
  r=await post('/api/market-intelligence/manual-leads',{
   query:'test',urls:['http://127.0.0.1/private']});
  assert.equal(r.status,422);
 }finally{child.kill('SIGTERM')}
});
