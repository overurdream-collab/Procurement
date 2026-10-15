'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parsePrices,buildMarketQuery,sourceMatchesDomain,summarizePublishedPrices}=require('../market-price-core');
test('parse mixed currencies with explicit unit',()=>{
 const p=parsePrices('Panel USD 18.50/m²; US$20.80 per sqm; RMB 130/piece; ¥88/set');
 assert.deepEqual(p.map(x=>[x.currency,x.unit,x.amount]),[['USD','sqm',18.5],['USD','sqm',20.8],['CNY','piece',130],['CNY','set',88]]);
});
test('no invented unit for total',()=>assert.equal(parsePrices('Total quote USD 25000')[0].unit,null));
test('no unrelated product keywords',()=>assert.doesNotMatch(buildMarketQuery({product:'laser printer',specifications:'A4 duplex'}),/cold room|refrigeration|PIR/i));
test('host match is strict',()=>{
 assert.equal(sourceMatchesDomain('https://shop.alibaba.com/p','alibaba.com'),true);
 assert.equal(sourceMatchesDomain('https://alibaba.com.evil.test/p','alibaba.com'),false);
 assert.equal(sourceMatchesDomain('file:///tmp/a','alibaba.com'),false);
});
test('exclude mixed units and historical prices from benchmark',()=>{
 const samples=[
 {type:'Published Market Source',url:'https://a.test/a',priceEvidence:parsePrices('USD 18.50/m²; ¥100/piece')},
 {type:'Published Market Source',url:'https://b.test/b',priceEvidence:parsePrices('USD 20.80 per sqm')},
 {type:'Published Market Source',url:'https://c.test/c',priceEvidence:parsePrices('USD 11/piece')},
 {type:'Historical Price',url:'https://d.test/d',priceEvidence:parsePrices('USD 9999/m²')}
 ];
 const s=summarizePublishedPrices(samples);
 assert.deepEqual([s.low,s.median,s.high,s.count,s.unit],[18.5,19.65,20.8,2,'sqm']);
});
test('empty benchmark when all unit prices unspecified',()=>assert.equal(summarizePublishedPrices([{type:'Published Market Source',url:'https://a.test',priceEvidence:parsePrices('USD 20000')}]),null));


test('accepts publicly indexed US $ prices and whitespace in unit',()=>{
 const a=parsePrices('FOB Price: US $19.5 / Square Meter');
 assert.equal(a[0].amount,19.5);
 assert.equal(a[0].currency,'USD');
 assert.equal(a[0].unit,'sqm');
});
test('keeps ranges as uncertain bounds, not precise benchmark data',()=>{
 const a=parsePrices('Price US$20.00-50.00 / sqm');
 assert.equal(a[0].amount,20);
 assert.equal(a[0].rangeMax,50);
 assert.equal(a[0].unit,'sqm');
 const s=summarizePublishedPrices([{type:'Published Market Source',url:'https://a.test/range',priceEvidence:a}]);
 assert.equal(s,null);
});
test('does not benchmark currency values without matched units',()=>{
 const a=parsePrices('USD 19000 total including service; US $11.25 / piece');
 const s=summarizePublishedPrices([{type:'Published Market Source',url:'https://a.test/x',priceEvidence:a}]);
 assert.equal(s,null);
});


test('reads Chinese indexed prices and dimensions without currency conversion',()=>{
 const p=parsePrices('￥100.00/平方米; ¥98/件; 200元/套; RMB 45/米');
 assert.deepEqual(p.map(x=>[x.currency,x.unit,x.amount]),
   [['CNY','sqm',100],['CNY','piece',98],['CNY','set',200],['CNY','meter',45]]);
 assert.equal(summarizePublishedPrices([{type:'Published Market Source',url:'https://1688.example/item',priceEvidence:p}]),null);
});
test('single indexed listing cannot establish a reliable market range',()=>{
 const p=parsePrices('US $19.50 / Square Meter');
 assert.equal(summarizePublishedPrices([{type:'Published Market Source',url:'https://example.com/p',priceEvidence:p}]),null);
});
