'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CATALOG,PLANS,previewWorkflow,callTool,contextFor}=require('../procurement-agent-tools');
const demo=require('../staging-demo-data.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const requestId=demo.requests[0].id;
test('registry contains only seven read/preview tools',()=>{
 assert.equal(CATALOG.length,7);
 assert.ok(CATALOG.every(t=>['read','preview'].includes(t.risk)));
 assert.ok(CATALOG.every(t=>!/(send|delete|award|approve|persist)/.test(t.name)));
});
test('unknown tool and plan fail closed',()=>{
 assert.throws(()=>previewWorkflow(demo,{requestId,task:'email_send'}),/invalid_preview_plan/);
 assert.throws(()=>previewWorkflow(demo,{requestId:'INVALID-ID'}),/request_not_found/);
 assert.throws(()=>callTool('send_email',contextFor(demo,requestId)),/tool_not_allowed/);
 assert.equal(Object.hasOwn(PLANS,'constructor'),false);
});
test('full seven-tool preview uses existing engines without changing business records',()=>{
 const state=clone(demo),snapshot=JSON.stringify(state);
 const result=previewWorkflow(state,{requestId,task:'full_review'});
 assert.equal(result.toolsRun,7);
 assert.equal(result.outputs.analyze_specifications.analysisMode,'deterministic-rules-no-llm');
 assert.equal(result.outputs.prepare_rfq_drafts.sent,0);
 assert.equal(result.effects.mailSent,0);
 assert.equal(result.effects.databaseWrites,0);
 assert.equal(result.effects.externalSearchCalls,0);
 assert.equal(result.modelConnected,false);
 assert.equal(JSON.stringify(state),snapshot);
});
test('request-bound supplier data cannot cross into another RFQ',()=>{
 const state={requests:[{id:'R1',product:'PIR panel',quantity:'100 sqm',specifications:'PIR 100mm panel',
  incoterm:'FOB',currency:'USD',selectedSupplierIds:['S1']},{id:'R2',selectedSupplierIds:['S2']}],
  suppliers:[{id:'S1',name:'Same Name',associatedRequestId:'R1',email:'s1@example.com'},
   {id:'S2',name:'Same Name',associatedRequestId:'R2',email:'s2@example.com'}],quotes:[],approvals:[],activity:[],gmailReplies:[]};
 const x=previewWorkflow(state,{requestId:'R1',task:'sourcing'});
 assert.equal(x.outputs.list_request_suppliers.count,1);
 assert.equal(x.outputs.prepare_rfq_drafts.count,1);
 assert.equal(x.outputs.prepare_rfq_drafts.drafts[0].to,'s1@example.com');
 assert.equal(x.outputs.prepare_rfq_drafts.drafts[0].canOpenEmail,false);
 assert.equal(x.outputs.list_request_suppliers.entries[0].verifiedFactory,false);
});
test('no quotes does not produce invented FOB comparisons',()=>{
 const data=clone(demo);data.quotes=[];
 const x=previewWorkflow(data,{requestId,task:'quotations'});
 assert.equal(x.outputs.compare_verified_quotes.comparableGroups,0);
 assert.deepEqual(x.outputs.compare_verified_quotes.comparisons,[]);
});
test('incomplete request cannot result in provider calls or suggested searches',()=>{
 const data={requests:[{id:'R0',product:'',quantity:'',specifications:''}],suppliers:[],quotes:[],activity:[],approvals:[],gmailReplies:[]};
 const x=previewWorkflow(data,{requestId:'R0',task:'sourcing'});
 assert.equal(x.outputs.plan_supplier_search.canSearch,false);
 assert.deepEqual(x.outputs.plan_supplier_search.manualLinks,[]);
});
test('tool trace and request scope consistent',()=>{
 const p=previewWorkflow(demo,{requestId,task:'overview'});
 assert.equal(p.outputs.read_request.id,requestId);
 assert.equal(p.outputs.analyze_specifications.requestId,requestId);
 assert.ok(p.trace.every(x=>x.status==='completed'&&x.effect==='read_only'));
 assert.equal(p.approvals.sendAllowed,false);
});
