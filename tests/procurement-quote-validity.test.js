const assert=require('assert');
const {hasMeaningfulQuoteData,quoteCoverage}=require('../agents/procurement/quote-validity');

assert.equal(hasMeaningfulQuoteData({supplier:'A'}),false);
assert.equal(hasMeaningfulQuoteData({supplier:'A',fob_price:12000}),true);
const c=quoteCoverage({fob_price:12000,warranty:'12 months'});
assert(c.filled>=2);
assert(c.percent>0);
console.log('Procurement quote validity tests passed');
