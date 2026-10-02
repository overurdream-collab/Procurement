const assert=require('assert');
const {analyzeQuotation,compareQuotations}=require('../agents/procurement/agent');

const a=analyzeQuotation({supplier:'Factory A',fob_price:18000,currency:'USD',cooling_load_kw:20,power_kwh_24h:95,payment_terms:'30/70',warranty:'12 months',fob_port:'Guangzhou'});
assert.equal(a.quote.supplier,'Factory A');
assert(!a.quote.missing_fields.includes('cooling_load_kw'));
assert(a.risks.some(r=>r.risk==='Compressor identification incomplete'));
assert(a.followup.missing_fields.includes('compressor_model'));

const c=compareQuotations([
 {supplier:'A',fob_price:10000,fob_port:'Guangzhou'},
 {supplier:'B',fob_price:20000,fob_port:'Shanghai'}
]);
assert.equal(c.length,2);
assert(c[0].price_intelligence.findings.includes('price_below_peer_range'));
assert(c[1].price_intelligence.findings.includes('price_above_peer_range'));
console.log('Procurement Agent V1 smoke tests passed');
