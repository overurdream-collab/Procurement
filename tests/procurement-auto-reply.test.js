const assert=require('assert');
const {isCompanyInfoRequest,buildCompanyInfoReply}=require('../agents/procurement/auto-reply');

assert.equal(isCompanyInfoRequest('请提供下贵公司信息以及联系电话。'),true);
assert.equal(isCompanyInfoRequest('Please send your company information and contact details.'),true);
assert.equal(isCompanyInfoRequest('We will prepare the quotation tomorrow.'),false);
const r=buildCompanyInfoReply({supplierName:'Hengliang/Cryobuilt'});
assert(r.body.includes('Alharir shipping and export'));
assert(r.body.includes('Alharirexport@gmail.com'));
assert(!r.body.includes('150,000'));
console.log('Procurement auto reply tests passed');
