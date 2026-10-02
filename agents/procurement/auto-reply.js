function isCompanyInfoRequest(text=''){
 const t=String(text);
 return /(?:公司信息|公司资料|贵公司信息|联系方式|联系电话|contact\s*(?:details|information|phone)|company\s*(?:information|details|profile))/i.test(t);
}
function buildCompanyInfoReply({supplierName='Sales Team'}={}){
 return {
  subjectPrefix:'Re: ',
  body:`${supplierName} 您好：

感谢您的回复。以下是我司目前可提供的基本信息：

公司名称：Alharir shipping and export
业务地点：Guangzhou, People's Republic of China / Sana'a, Republic of Yemen
联系邮箱：Alharirexport@gmail.com

我们目前正在也门开展冷库及制冷设备项目，并希望与可靠的中国制造商建立长期采购合作关系。

关于 RFQ-001，请继续按照询价要求提供技术方案和商业报价，包括制冷负荷、压缩机/蒸发器品牌型号、24小时耗电量、保温板规格、FOB价格及港口、CBM/毛重、生产周期、保修和付款条件。

如贵司需要其他特定公司资料，请告知具体项目或文件名称，我们会进一步提供。

谢谢！

此致
敬礼
Alharir shipping and export
Alharirexport@gmail.com`
 };
}
module.exports={isCompanyInfoRequest,buildCompanyInfoReply};
