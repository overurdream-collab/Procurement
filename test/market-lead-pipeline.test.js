'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {registerSearch,lookup,researchContact,prepareConversion,outreachDrafts,publicUrl,validEmail}=require('../market-leads');

function sample(){
 return registerSearch([
 {source:'Alibaba',title:'100mm PIR cold room panel',snippet:'USD 19.50/sqm',url:'https://www.alibaba.com/product-detail/panel-1'},
 {source:'Made-in-China',title:'100mm PIR cold room panel 2',snippet:'USD 21 /sqm',url:'https://shop.made-in-china.com/panel-2'},
 {source:'1688',title:'冷库板',url:'https://detail.1688.com/offer/123'}
 ],'100mm PIR cold room panel');
}
test('only genuine public listing URLs are eligible for the shortlist',()=>{
 const r=registerSearch([
 {source:'Bad',url:'file:///etc/passwd',title:'bad'},
 {source:'Bad',url:'http://127.0.0.1/internal',title:'bad'},
 {source:'Alibaba',url:'https://www.alibaba.com/item1',title:'Sample'}
 ],'panel');
 assert.equal(r.results.length,1);
 assert.equal(r.results[0].index,0);
 assert.equal(lookup(r.searchId).entries[0].url,'https://www.alibaba.com/item1');
});
test('uses indexed public company contact pages without inventing emails or verifying companies',async()=>{
 const r=sample();
 let calls=0;
 const result=await researchContact({searchId:r.searchId,index:0,companyName:'Jialiang Refrigeration'},{
  env:{MARKET_ENABLE_LIVE_SEARCH:'true',TAVILY_API_KEY:'MOCK'},
  searchIndexedWeb:async()=>{calls++;return {items:[
   {title:'Jialiang Refrigeration Contact',url:'https://jialiang-example.com/contact',
    snippet:'Jialiang Refrigeration sales@example.com'},
   {title:'Alibaba listing',url:'https://www.alibaba.com/supplier',snippet:'Jialiang Refrigeration sales@something.com'},
   {title:'Completely unrelated',url:'https://unrelated.example/contact',snippet:'hello@unrelated.example'}
  ]}}
 });
 assert.equal(calls,1);
 assert.equal(result.ok,true);
 assert.equal(result.officialVerified,false);
 assert.equal(result.contacts.length,1);
 assert.equal(result.contacts[0].verified,false);
 assert.equal(result.contacts[0].emails[0],'sales@example.com');
});
test('without active provider, contact research exposes manual verification links',async()=>{
 const r=sample();
 const result=await researchContact({searchId:r.searchId,index:0,companyName:'Sample Factory'},{
  env:{MARKET_ENABLE_LIVE_SEARCH:'false'},
  searchIndexedWeb:()=>{throw Error('should not search')}
 });
 assert.equal(result.provider,'none');
 assert.equal(result.contacts.length,0);
 assert.equal(result.manualLinks.length,2);
});
test('converts exactly selected companies into a separate unsent FOB draft',()=>{
 const r=sample();
 const conversion=prepareConversion({searchId:r.searchId,
   details:{quantity:'50 sqm',specifications:'100 mm PIR; steel 0.5mm; density 40kg/m3',incoterm:'FOB'},
   selected:[{index:0,companyName:'Supplier A Co Ltd',email:'sales@suppliera.test',
    websiteUrl:'https://suppliera.test/',contactEvidenceUrl:'https://suppliera.test/contact'}]
 });
 assert.equal(conversion.ok,true);
 assert.equal(conversion.request.status,'مسودة RFQ — لم تُرسل');
 assert.equal(conversion.request.selectedSupplierIds.length,1);
 assert.equal(conversion.suppliers.length,1);
 assert.equal(conversion.suppliers[0].sourcePlatform,'Alibaba');
 assert.equal(conversion.suppliers[0].email,'sales@suppliera.test');
 const drafts=outreachDrafts(conversion.request,conversion.suppliers);
 assert.equal(drafts.length,1);
 assert.match(drafts[0].body,/50 sqm/);
 assert.match(drafts[0].body,/FOB only/);
 assert.equal(drafts[0].requiresReview,true);
});
test('will not send a candidate without an address, and does not guess an email',()=>{
 const r=sample();
 const x=prepareConversion({searchId:r.searchId,
  details:{quantity:'1 set',specifications:'Model ABC'},
  selected:[{index:2,companyName:'Chinese Sample Factory'}]});
 assert.equal(x.ok,true);
 assert.equal(x.suppliers[0].email,null);
 assert.equal(x.suppliers[0].contactStatus,'missing_email');
 assert.equal(outreachDrafts(x.request,x.suppliers)[0].canOpenEmail,false);
});
test('invalid selections, invalid emails, and non-FOB conversion fail closed',()=>{
 const r=sample(),base={searchId:r.searchId,details:{quantity:'1 unit',specifications:'ABC'},
  selected:[{index:999,companyName:'Factory Sample'}]};
 assert.equal(prepareConversion(base).ok,false);
 assert.equal(prepareConversion({...base,selected:[{index:0,companyName:'Factory Sample',email:'bad\nBcc:malicious'}]}).ok,false);
 assert.equal(prepareConversion({...base,details:{...base.details,incoterm:'CIF'},selected:[{index:0,companyName:'Factory Sample'}]}).ok,false);
 assert.equal(validEmail('admin@example.com'),'admin@example.com');
 assert.equal(publicUrl('https://username:password@somehost.example/a'),null);
});
