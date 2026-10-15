'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {priceAnalysis,dailyReport,unitName}=require('../procurement-reports');
const actual=require('../data.json');
const mk=()=>({
 requests:[{id:'REQ-COMPARE',product:'100mm PIR panel',title:'PIR cold room panels',status:'استلام عروض'}],
 suppliers:[{id:'A',name:'Supplier A',category:'panel_door_manufacturer'},
   {id:'B',name:'Supplier B',category:'panel_door_manufacturer'},
   {id:'C',name:'Supplier C',category:'cold_room_manufacturer'}],
 quotes:[],activity:[],approvals:[{id:'P1',status:'pending'}],gmailReplies:[]
});
const quote=(id,supplierId,price,basis='FOB Guangzhou',overrides={})=>({
 id,supplierId,requestId:'REQ-COMPARE',category:'panel_door_manufacturer',
 evidenceClass:'Verified Quote',currency:'USD',basis,
 evidenceRef:'quote-mail-'+id,createdAt:'2026-10-15T11:00:00Z',
 items:[{description:'100mm PIR panel 0.5mm steel',unit:'m²',unitPrice:price,quantity:100,
  specifications:'PIR 40kg/m3 steel 0.5mm'}],
 ...overrides
});
test('real recorded EXW offer never enters FOB benchmark or creates false savings',()=>{
 const cmp=priceAnalysis(actual);
 assert.equal(cmp.comparableGroups,0);
 assert.equal(cmp.quotesReviewed,1);
 assert.equal(cmp.quotes[0].verified,true);
 assert.match(cmp.quotes[0].basis,/EXW/);
 assert.ok(cmp.excludedQuoteLines>=2);
 assert.equal(cmp.comparisons.length,0);
});
test('compares two genuinely like-for-like verified FOB quotation lines',()=>{
 const st=mk();st.quotes=[quote('QA','A',20),quote('QB','B',24)];
 const c=priceAnalysis(st);
 assert.equal(c.comparableGroups,1);
 assert.equal(c.eligibleQuoteLines,2);
 assert.equal(c.comparisons[0].lowestSupplier,'Supplier A');
 assert.equal(c.comparisons[0].spreadPerUnit,4);
 assert.equal(c.comparisons[0].spreadForQuantity,400);
 assert.equal(c.comparisons[0].quantity,100);
 assert.ok(c.comparisons[0].note.includes('ليس توفيرًا محققًا'));
});
test('excludes unverified, EXW, different quantity, currency, port or categories',()=>{
 const baseline=quote('QA','A',20);
 const cases=[
  quote('QB','B',19,'EXW warehouse'),
  quote('QB','B',19,'FOB Shanghai'),
  quote('QB','B',19,'FOB Guangzhou',{currency:'CNY'}),
  quote('QB','B',19,'FOB Guangzhou',{category:'cold_room_manufacturer'}),
  quote('QB','B',19,'FOB Guangzhou',{items:[{description:'100mm PIR panel 0.5mm steel',unit:'m²',unitPrice:19,quantity:150,specifications:'PIR 40kg/m3 steel 0.5mm'}]}),
  quote('QB','B',19,'FOB Guangzhou',{evidenceClass:'Received Quote — Pending Review'}),
  quote('QB','B',19,'FOB Guangzhou',{items:[{description:'150mm PIR panel 0.5mm steel',unit:'m²',unitPrice:19,quantity:100,specifications:'PIR 40kg/m3 steel 0.5mm'}]})
 ];
 for(const other of cases){
  const st=mk();st.quotes=[baseline,other];
  assert.equal(priceAnalysis(st).comparableGroups,0,'Should reject '+other.basis+' '+other.evidenceClass);
 }
});
test('daily executive report uses real counts and never converts gaps to best-price recommendation',()=>{
 const st=mk();
 st.quotes=[quote('QA','A',20,'EXW Samail')];
 st.activity=[{type:'quote_received',time:'2026-10-15T14:00:00Z',text:'received RFQ quote'}];
 const r=dailyReport(st,{date:'2026-10-15'});
 assert.equal(r.kpis.requests,1);
 assert.equal(r.kpis.quoteRecords,1);
 assert.equal(r.kpis.verifiedQuotes,1);
 assert.equal(r.kpis.comparableGroups,0);
 assert.equal(r.kpis.actionsToday,1);
 assert.equal(r.kpis.pendingApprovals,1);
 assert.equal(r.priceComparisons.length,0);
 assert.ok(r.risks.some(x=>x.includes('لا توجد')));
});
test('buyer view excludes management activity and approval internals',()=>{
 const st=mk();st.suppliers[0].email='private@factory.example';
 st.activity=[{type:'memo',time:'2026-10-15T01:00:00Z',text:'Internal margin 50%'}];
 const manager=dailyReport(st,{date:'2026-10-15',audience:'management'});
 const buyer=dailyReport(st,{date:'2026-10-15',audience:'buyer'});
 assert.equal(manager.activities.length,1);
 assert.deepEqual(buyer.activities,[]);
 assert.equal(buyer.kpis.pendingApprovals,null);
 assert.ok(!JSON.stringify(buyer).includes('private@factory.example'));
 assert.ok(!JSON.stringify(buyer).includes('Internal margin 50%'));
});

test('daily report converts UTC activity into Sana’a calendar date, not the UTC day',()=>{
 const st=mk();
 st.activity=[{type:'review',time:'2026-10-15T23:30:00Z',text:'Reviewed supplier documentation'}];
 const oct16=dailyReport(st,{date:'2026-10-16'});
 const oct15=dailyReport(st,{date:'2026-10-15'});
 assert.equal(oct16.kpis.actionsToday,1);
 assert.equal(oct15.kpis.actionsToday,0);
 assert.ok(oct16.achievements.some(s=>s.includes('1')));
});
