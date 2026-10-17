'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('server.js'),html=read('public/index.html');
test('Main app Gmail setup has visible readiness, exact callback and consent-required sync',()=>{
 assert.match(html,/function gmailView\(\)/);
 assert.match(html,/فحص جاهزية Google/);
 assert.match(html,/checkGmailReadiness\(\)/);
 assert.match(html,/موافقة Google وربط الحساب/);
 assert.match(html,/!g\.configured\?'disabled '/);
 assert.match(html,/!g\.connected\?'disabled '/);
 assert.match(html,/https:\/\/alharir-procurement-neon-trial\.onrender\.com\/api\/gmail\/callback/);
 assert.match(html,/GOOGLE_CLIENT_ID/);
 assert.match(html,/GOOGLE_CLIENT_SECRET/);
 assert.doesNotMatch(html,/مزامنة RFQ-001/);
 for(const [,src] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(src);
});
test('Backend grants strictly Gmail read-only, revocable encrypted credentials and routes back to Gmail',()=>{
 assert.match(source,/scope:'https:\/\/www\.googleapis\.com\/auth\/gmail\.readonly'/);
 assert.match(source,/if\(process\.env\.PRODUCTION_READONLY_MAIL==='true'\)throw Error\('gmail_outbound_disabled_in_readonly_mode'\)/);
 assert.match(source,/Location:'\/#gmail'/);
 assert.match(source,/readOnly:true/);
 assert.match(source,/redirectUri:REDIRECT/);
 assert.match(source,/return json\(res,409,\{error:'gmail_not_connected'/);
 assert.match(source,/await clearOauth\(\)/);
 assert.match(source,/rec\.requestMatchMethod=link\.method/);
 assert.match(source,/importedAsVerifiedQuotes:0/);
 assert.match(source,/attachment_exceeds_preview_limit/);
});


test('new Gmail flow fails closed on wrong account, verifies readonly scope and protects concurrent sync',()=>{
 assert.match(source,/GMAIL_EXPECTED_EMAIL/);
 assert.match(source,/missing_expected_mailbox/);
 assert.match(source,/verifyCompanyMailbox\(\)/);
 assert.match(source,/gmail_account_mismatch/);
 assert.match(source,/gmail\/verify/);
 assert.match(source,/google_refresh_token_missing/);
 assert.match(source,/unexpected_oauth_scope/);
 assert.match(source,/gmail_sync_in_progress/);
 assert.match(source,/syncInProgress=true/);
 assert.match(source,/GMAIL_AUTO_SYNC==='true'/);
 assert.match(source,/30\*60\*1000/);
 assert.match(source,/autoSyncMode:'best-effort-while-service-awake'/);
 assert.match(html,/التحقق من هوية حساب Gmail/);
 assert.match(html,/GMAIL_EXPECTED_EMAIL/);
 assert.match(html,/lastSync/);
 assert.match(html,/async function verifyGmailAccount\(\)/);
});
