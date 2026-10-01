# Procurement Command Center V2 — Gmail Connected

واجهة مشتريات + Backend + تخزين محلي + Google OAuth/Gmail API.

## 1) إعداد Google OAuth مرة واحدة
في Google Cloud Console:
- أنشئ Project.
- فعّل Gmail API.
- جهّز OAuth consent screen.
- أنشئ OAuth Client من نوع Web application.
- أضف Authorized redirect URI:
  `http://localhost:8787/api/gmail/callback`
- ضع Client ID وClient Secret كمتغيرات بيئة كما في `.env.example`.

> لا تضع Client Secret داخل index.html ولا ترسله إلى المتصفح.

## 2) التشغيل
Node.js 18+ مطلوب.

macOS/Linux:
```bash
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
export APP_BASE_URL="http://localhost:8787"
node server.js
```

Windows PowerShell:
```powershell
$env:GOOGLE_CLIENT_ID="..."
$env:GOOGLE_CLIENT_SECRET="..."
$env:APP_BASE_URL="http://localhost:8787"
node server.js
```

ثم افتح `http://localhost:8787` → Agent → ربط Gmail.

## ما أصبح يعمل
- OAuth آمن بدون كلمة مرور Gmail.
- حفظ refresh token محليًا في `.gmail-oauth.json` (لا ترفعه إلى GitHub).
- مزامنة الردود التي تحمل RFQ-001 وتحديد المورد الذي رد.
- منع تكرار الرسائل المستوردة.
- تحديث حالة reply للمورد.
- إرسال Follow-up فعلي عبر Gmail بعد اجتياز بوابة الموافقة.
- Disconnect من الواجهة.

## ملاحظة إنتاجية
هذه نسخة محلية. قبل نشرها على الإنترنت يجب استخدام HTTPS، تخزين أسرار/توكنات مشفر، قاعدة بيانات حقيقية، حسابات مستخدمين وصلاحيات، وحماية CSRF/session.
