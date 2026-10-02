function isCompanyInfoRequest(text=''){
 const t=String(text);
 return /(?:公司信息|公司资料|贵公司信息|联系方式|联系电话|contact\s*(?:details|information|phone)|company\s*(?:information|details|profile))/i.test(t);
}
function buildCompanyInfoReply({supplierName='Sales Team'}={}){
 return {
  subjectPrefix:'Re: ',
  body:`${supplierName} 您好：

感谢您的回复。以下是我司的公司及联系方式：

公司名称：
Alharir shipping and export

中国办公室：
Office D99, 5th Floor, No. 604-2, Renmin North Road,
Yuexiu District, Guangzhou City, China

也门办公室：
304 A, 4th Floor, Algeria Street,
Sana'a City, Yemen

电子邮箱：
Alharirexport@gmail.com

WhatsApp：
+86 134 3431 0394

WeChat：
+86 134 3431 0394

我们目前正在也门开展冷库及制冷设备项目，并希望与可靠的中国制造商建立长期采购合作关系。

关于 RFQ-001，请继续按照询价要求提供技术方案和商业报价，包括：
• 制冷负荷及所需制冷量
• 压缩机及蒸发器品牌和型号
• 每日产品入库及降温能力
• 24小时耗电量
• 保温板类型、密度及厚度
• FOB价格及装运港
• CBM及毛重
• 生产周期
• 保修期
• 付款条件
• 备件及长期供货能力

如贵司还需要其他特定公司资料，请告知具体文件名称，我们会进一步提供。

谢谢！

此致
敬礼

Alharir shipping and export
Alharirexport@gmail.com
WhatsApp / WeChat: +86 134 3431 0394`
 };
}
module.exports={isCompanyInfoRequest,buildCompanyInfoReply};
