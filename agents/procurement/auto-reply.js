const assets=require('./signature-assets');

function isCompanyInfoRequest(text=''){
 const t=String(text);
 return /(?:公司信息|公司资料|贵公司信息|联系方式|联系电话|contact\s*(?:details|information|phone)|company\s*(?:information|details|profile))/i.test(t);
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function buildCompanyInfoReply({supplierName='Sales Team'}={}){
 const html=`<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
 <div style="max-width:760px;margin:0 auto;padding:20px 18px">
  <p style="font-size:15px;line-height:1.8;margin:0 0 14px">${esc(supplierName)} 您好：</p>
  <p style="font-size:15px;line-height:1.8;margin:0 0 16px">感谢您的回复。以下是我司的公司信息及联系方式。我们目前正在也门开展冷库及制冷设备项目，并希望与可靠的中国制造商建立长期采购合作关系。</p>

  <div style="border-left:4px solid #1f5fae;padding:14px 16px;background:#f7faff;margin:18px 0">
   <div style="font-weight:700;color:#173f7a;margin-bottom:8px">关于 RFQ-001，请继续提供：</div>
   <div style="line-height:1.8;font-size:14px">
    • 制冷负荷及所需制冷量<br>
    • 压缩机及蒸发器品牌和型号<br>
    • 每日产品入库及降温能力<br>
    • 24小时耗电量<br>
    • 保温板类型、密度及厚度<br>
    • FOB价格及装运港<br>
    • CBM及毛重<br>
    • 生产周期、保修期及付款条件<br>
    • 备件及长期供货能力
   </div>
  </div>

  <p style="font-size:15px;line-height:1.8">如贵司还需要其他特定公司资料，请告知具体文件名称，我们会进一步提供。谢谢！</p>

  <div style="border-top:2px solid #d7e3f4;margin-top:24px;padding-top:18px">
   <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
    <tr>
     <td style="width:92px;vertical-align:top;padding-right:16px"><img src="cid:${assets.logo.cid}" width="72" style="display:block;border:0;max-width:72px"></td>
     <td style="vertical-align:top">
      <div style="font-size:21px;font-weight:700;color:#173f7a;margin-bottom:8px">Alharir shipping and export</div>
      <div style="font-size:13px;line-height:1.6"><strong style="color:#173f7a">Email:</strong> Alharirexport@gmail.com</div>
      <div style="font-size:13px;line-height:1.6;margin-top:6px"><strong style="color:#173f7a">China Office:</strong><br>Office D99, 5th Floor, No. 604-2, Renmin North Road, Yuexiu District, Guangzhou City, China</div>
      <div style="font-size:13px;line-height:1.6;margin-top:6px"><strong style="color:#173f7a">Yemen Office:</strong><br>304 A, 4th Floor, Algeria Street, Sana'a City, Yemen</div>
     </td>
    </tr>
   </table>

   <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
    <tr>
     <td style="text-align:center;padding-right:22px">
      <div style="font-size:12px;font-weight:700;color:#173f7a;margin-bottom:5px">WeChat</div>
      <img src="cid:${assets.wechat.cid}" width="92" style="display:block;border:0">
     </td>
     <td style="text-align:center">
      <div style="font-size:12px;font-weight:700;color:#173f7a;margin-bottom:5px">WhatsApp</div>
      <img src="cid:${assets.whatsapp.cid}" width="92" style="display:block;border:0">
     </td>
    </tr>
   </table>
  </div>
 </div>
 </body></html>`;

 return {
  subjectPrefix:'Re: ',
  html,
  text:`${supplierName} 您好：

感谢您的回复。以下是我司的公司信息：

Alharir shipping and export
China Office: Office D99, 5th Floor, No. 604-2, Renmin North Road, Yuexiu District, Guangzhou City, China
Yemen Office: 304 A, 4th Floor, Algeria Street, Sana'a City, Yemen
Email: Alharirexport@gmail.com

请继续按照 RFQ-001 要求提供完整技术方案和商业报价。谢谢！`,
  inlineImages:[assets.logo,assets.wechat,assets.whatsapp]
 };
}
module.exports={isCompanyInfoRequest,buildCompanyInfoReply};
