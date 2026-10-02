const RFQ001={
 id:'RFQ-001',
 subject:'RFQ-001：也门萨那果蔬冷库项目询价（8×6×5米 / 12×6×5米，0~+5°C）',
 body:`尊敬的销售团队：

您好！

我们正在也门建立专业的冷库及制冷业务，目前正在寻找一家可靠的中国制造商建立长期合作关系，而不是只采购一个项目。随着业务发展，我们预计未来会有持续的冷库项目和采购订单。

目前我们在也门萨那有一个果蔬冷库项目，请分别提供以下两个尺寸的报价：

• 8 × 6 × 5 米
• 12 × 6 × 5 米

冷库温度：0°C 至 +5°C
最大目标储存量：约70吨，实际库存会根据市场季节需求变化。

我们需要完整的冷库系统，包括：
保温板、冷库门、冷凝机组/压缩机、蒸发器、控制系统以及安装所需的配件。

请在报价中提供以下主要信息：
• 冷负荷及所需制冷量
• 压缩机和蒸发器的品牌及型号
• 建议的每日产品入库及降温能力
• 预计24小时耗电量（kWh/24h）
• 保温板类型、密度及厚度
• FOB价格及装运港
• 总体积（CBM）及毛重
• 生产周期、保修期及付款条件

我们的项目可能采用柴油发电机或太阳能供电，因此系统的节能和用电效率对我们非常重要。

由于我们希望建立长期合作并持续采购，也请提供贵公司的经销商/长期合作伙伴优惠价格，并确认未来是否能够长期稳定供应设备、配件及备件。

请分别提供两个尺寸的报价，并提出贵公司认为最合适的技术方案。

期待您的回复，谢谢！

此致
敬礼

Alharir shipping and export
Guangzhou, People's Republic of China / Sana'a, Republic of Yemen
Alharirexport@gmail.com`
};
function nextSupplierId(suppliers=[]){let n=Math.max(0,...suppliers.map(s=>Number(String(s.id||'').replace(/\D/g,''))||0));return 'S'+(n+1)}
function ensureSupplier(st,{email,name}){let normalized=String(email||'').trim().toLowerCase();if(!normalized||!normalized.includes('@'))throw Error('invalid_supplier_email');let supplier=st.suppliers.find(s=>String(s.email||'').toLowerCase()===normalized);let created=false;if(!supplier){supplier={id:nextSupplierId(st.suppliers),name:name||normalized.split('@')[0],email:normalized,status:'جديد',excluded:false,createdAt:new Date().toISOString()};st.suppliers.push(supplier);created=true}return {supplier,created}}
async function sendRfq({st,email,name,rfqId='RFQ-001',sendMail}){if(rfqId!==RFQ001.id)throw Error('rfq_not_found');let {supplier,created}=ensureSupplier(st,{email,name});if(supplier.excluded)throw Error('supplier_excluded');let sent=await sendMail(supplier.email,RFQ001.subject,RFQ001.body);supplier.status='تم الإرسال';supplier.rfqId=rfqId;supplier.sentAt=new Date().toISOString();supplier.messageId=sent.id||null;supplier.threadId=sent.threadId||null;st.activity.unshift({id:Date.now()+Math.random(),time:new Date().toISOString(),type:'rfq_sent',text:'تم إرسال '+rfqId+' إلى '+supplier.name,supplierId:supplier.id,messageId:supplier.messageId});return {supplier,created,messageId:supplier.messageId,threadId:supplier.threadId}}
module.exports={RFQ001,ensureSupplier,sendRfq};
