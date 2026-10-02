const assert=require('assert');
const {isCompanyInfoRequest,buildCompanyInfoReply}=require('../agents/procurement/auto-reply');

assert.equal(isCompanyInfoRequest('请提供下贵公司信息以及联系电话。'),true);
assert.equal(isCompanyInfoRequest('Please send your company information and contact details.'),true);
assert.equal(isCompanyInfoRequest('We will prepare the quotation tomorrow.'),false);

const r=buildCompanyInfoReply({supplierName:'Hengliang/Cryobuilt'});
assert(r.text.includes('Alharir shipping and export'));
assert(r.text.includes('Alharirexport@gmail.com'));
assert(r.html.includes('China Office'));
assert(r.html.includes('Yemen Office'));
assert(r.html.includes('cid:alharir-wechat'));
assert(r.html.includes('cid:alharir-whatsapp'));
assert.equal(r.inlineImages.length,3);
assert(!r.html.includes('+86 134 3431 0394'));
console.log('Procurement auto reply tests passed');
