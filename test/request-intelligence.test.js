'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {analyzeRequest}=require('../request-intelligence');
const base={id:'REQ-T1',title:'100mm PIR cold room panels',product:'PIR cold room panel',quantity:'1000 m²',specifications:'PIR 100mm, core density 40 kg/m3, steel skin 0.5 mm',incoterm:'FOB',currency:'USD',targetMarkets:'China'};
test('extracts panel technical fields and does not invent unprovided values',()=>{
 const a=analyzeRequest(base);assert.equal(a.productType,'insulated_panels');
 assert.equal(a.normalized.panelThicknessMm,100);assert.equal(a.normalized.coreDensityKgM3,40);assert.equal(a.normalized.steelSkinMm,0.5);
 assert.equal(a.searchQuery.includes('100mm'),true);assert.equal(a.searchQuery.includes('manufacturer'),true);
 assert.ok(a.missingCommercial.some(x=>x.includes('ميناء FOB')));
 assert.equal(a.canSearch,true);assert.equal(a.analysisMode,'deterministic-rules-no-llm');
});
test('missing insulation technical fields are reported, never assumed',()=>{
 const a=analyzeRequest({...base,specifications:'PIR panels for roof, 100mm'});
 assert.equal(a.normalized.coreDensityKgM3,null);assert.equal(a.normalized.steelSkinMm,null);
 assert.ok(a.missingTechnical.some(x=>x.includes('كثافة')));
});
test('different supplier industries are not mixed',()=>{
 const p=analyzeRequest(base);
 const c=analyzeRequest({...base,product:'Cold storage room',specifications:'Cold storage room temperature +2°C, dimensions 4x5x3 m, 10 ton load'});
 assert.equal(p.supplierCategories[0],'panel_door_manufacturer');
 assert.equal(c.supplierCategories[0],'cold_room_manufacturer');
 assert.notEqual(p.supplierCategories[0],c.supplierCategories[0]);
});
test('empty request is marked incomplete and cannot start search',()=>{
 const a=analyzeRequest({id:'empty'});assert.equal(a.canSearch,false);assert.ok(a.missingCritical.length>=2);
});
test('rule-based analysis never mutates input, searches, or produces supplier/price claims',()=>{
 const b=structuredClone(base),before=JSON.stringify(b),a=analyzeRequest(b);
 assert.equal(JSON.stringify(b),before);assert.equal('suppliers' in a,false);assert.equal('price' in a,false);
 assert.equal(a.analysedAt,null);
});
test('FOB must not be confused with EXW',()=>{
 const a=analyzeRequest({...base,incoterm:'EXW'});assert.ok(a.missingCommercial.some(x=>x.includes('FOB')));
});
test('source keeps analysis inside original app and does not spoof LLM results',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(server,/\/analysis\$\/\)/);assert.match(ui,/requestIntelligence/);
 assert.match(ui,/runUnifiedMarketSearch/);assert.match(ui,/تحليل أولي بقواعد صريحة/);
});
