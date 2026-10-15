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
