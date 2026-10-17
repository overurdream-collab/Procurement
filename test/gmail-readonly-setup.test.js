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
 assert.match(source,/readOnly:true,redirectUri:REDIRECT/);
 assert.match(source,/return json\(res,409,\{error:'gmail_not_connected'/);
 assert.match(source,/await clearOauth\(\)/);
 assert.match(source,/requestMatchMethod:link\.method/);
 assert.match(source,/importedAsVerifiedQuotes:0/);
 assert.match(source,/attachment_exceeds_preview_limit/);
});
