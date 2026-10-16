'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createStateStore,encryptOauth,decryptOauth}=require('../persistent-store');
const {productionConfig,guardProduction}=require('../commercial-access');
const fakeDb={revision:0n,state:null,secret:null};
class FakePool{
 constructor(){this.ended=false}
 async query(sql,args=[]){
  if(sql.includes('CREATE TABLE'))return {rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO alharir_state')){
   if(!fakeDb.state)fakeDb.state=JSON.parse(args[0]);return {rows:[],rowCount:1};
  }
  if(sql.startsWith('SELECT id FROM alharir_state'))return {rows:fakeDb.state?[{id:1}]:[],rowCount:fakeDb.state?1:0};
  if(sql.startsWith('SELECT key FROM alharir_secrets LIMIT 0'))return {rows:[],rowCount:0};
  if(sql.startsWith('SELECT revision,payload')){
   return {rows:[{revision:fakeDb.revision.toString(),payload:JSON.parse(JSON.stringify(fakeDb.state))}],rowCount:1};
  }
  if(sql.startsWith('UPDATE alharir_state')){
   if(args[1]!==fakeDb.revision.toString())return {rows:[],rowCount:0};
   fakeDb.state=JSON.parse(args[0]);fakeDb.revision++;return {rows:[{revision:fakeDb.revision.toString()}],rowCount:1};
  }
  if(sql.startsWith('SELECT encrypted'))return {rows:fakeDb.secret?[{encrypted:fakeDb.secret}]:[],rowCount:fakeDb.secret?1:0};
  if(sql.startsWith('INSERT INTO alharir_secrets')){
   fakeDb.secret=JSON.parse(args[0]);return {rows:[],rowCount:1};
  }
  if(sql.startsWith('DELETE FROM alharir_secrets')){fakeDb.secret=null;return {rows:[],rowCount:1}};
  if(sql.startsWith('SELECT revision,updated_at'))return {rows:[{revision:fakeDb.revision.toString(),updated_at:'2026-10-16T14:00:00Z'}],rowCount:1};
  throw Error('Unexpected SQL: '+sql);
 }
 async end(){this.ended=true}
}
const secret=crypto.randomBytes(32).toString('hex');
const env={DATABASE_URL:'postgresql://test:test@ep-synthetic.eu-central-1.aws.neon.tech/alharir?sslmode=require',OAUTH_ENCRYPTION_KEY:secret,
 PROCUREMENT_PRODUCTION:'true',PRODUCTION_ACCESS_USER:'alharir-admin',
 PRODUCTION_ACCESS_PASSWORD:'a-synthetic-test-password-greater-than-24-chars',
 APP_BASE_URL:'https://business.example',PRODUCTION_READONLY_MAIL:'true'};
test('production mode cannot accidentally store real data on demo or local files',()=>{
 for(const override of [{DATABASE_URL:''},{STAGING_HOSTED:'true'},{STAGING_DEMO:'true'},
  {PRODUCTION_READONLY_MAIL:'false'},{APP_BASE_URL:'http://business.example'},
  {OAUTH_ENCRYPTION_KEY:'invalid'},{PRODUCTION_ACCESS_PASSWORD:'weak'}]){
  assert.throws(()=>productionConfig({...env,...override}));
 }
 assert.doesNotThrow(()=>productionConfig(env));
 assert.throws(()=>createStateStore({env:{...env,DATABASE_URL:''},localFile:'data.json'}));
});
test('durable empty start, version-controlled updates and verified reload across instances',async()=>{
 fakeDb.state=JSON.parse(JSON.stringify(require('../persistent-store').INITIAL_STATE()));fakeDb.revision=0n;fakeDb.secret=null;
 const first=createStateStore({env,pgFactory:FakePool}),other=createStateStore({env,pgFactory:FakePool});
 const a=await first.load(),b=await other.load();
 assert.deepEqual(a.requests,[]);
 assert.deepEqual(a.gmailReplies,[]);
 assert.equal(a.settings.dryRun,true);
 a.requests.push({id:'TEST-1'});
 await first.save(a);
 assert.equal(fakeDb.revision,1n);
 b.requests.push({id:'UNSAFE-LOST-UPDATE'});
 await assert.rejects(()=>other.save(b),{code:'STATE_CONFLICT'});
 const fresh=await other.load();
 assert.equal(fresh.requests.length,1);
 assert.equal(fresh.requests[0].id,'TEST-1');
 assert.equal((await other.diagnostics()).durable,true);
 await first.close();await other.close();
});
test('production refuses an uninitialized database rather than silently seeding it',async()=>{
 fakeDb.state=null;
 const storage=createStateStore({env,pgFactory:FakePool});
 await assert.rejects(()=>storage.ready(),/production_database_not_initialized/);
 await storage.close();
 fakeDb.state=JSON.parse(JSON.stringify(require('../persistent-store').INITIAL_STATE()));
});
test('OAuth refresh token stored only as AES-256-GCM ciphertext with integrity protection',async()=>{
 const store=createStateStore({env,pgFactory:FakePool});
 const data={access_token:'ACCESS_TOKEN_DO_NOT_LOG',refresh_token:'REFRESH_TOKEN_DO_NOT_LOG',expires_at:2000000000000};
 await store.saveOauth(data);
 assert.ok(fakeDb.secret&&fakeDb.secret.ciphertext);
 assert.doesNotMatch(JSON.stringify(fakeDb.secret),/REFRESH_TOKEN_DO_NOT_LOG|ACCESS_TOKEN_DO_NOT_LOG/);
 assert.deepEqual(await store.oauth(),data);
 const changed={...fakeDb.secret,tag:Buffer.alloc(16,1).toString('base64')};
 assert.throws(()=>decryptOauth(changed,env));
 assert.throws(()=>decryptOauth(fakeDb.secret,{...env,OAUTH_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex')}));
 assert.deepEqual(decryptOauth(encryptOauth(data,env),env),data);
 await store.clearOauth();
 assert.deepEqual(await store.oauth(),{});
 await store.close();
});
test('production Basic Auth protects all API including mail and blocks autonomous sends',()=>{
 const build=(url,auth)=>{
  const headers={};if(auth)headers.authorization='Basic '+Buffer.from(auth).toString('base64');
  const response={status:0,writeHead(code,h){this.status=code;this.headers=h},end(body){this.body=body}};
  return {req:{url,method:'GET',headers,socket:{remoteAddress:'test-client'}},response};
 };
 let a=build('/api/requests');assert.equal(guardProduction(a.req,a.response,env),false);assert.equal(a.response.status,401);
 a=build('/api/gmail/attachment','alharir-admin:'+env.PRODUCTION_ACCESS_PASSWORD);
 assert.equal(guardProduction(a.req,a.response,env),true);
 a=build('/api/agent/run','alharir-admin:'+env.PRODUCTION_ACCESS_PASSWORD);
 assert.equal(guardProduction(a.req,a.response,env),false);assert.equal(a.response.status,403);
 a=build('/health/live');
 assert.equal(guardProduction(a.req,a.response,env),false);assert.equal(a.response.status,200);
});


test('live Gmail only stores bounded message metadata, with source message fetched on demand',()=>{
 const fs=require('node:fs');
 const code=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
 const ui=fs.readFileSync(require('node:path').join(__dirname,'../public/mail-correspondence.js'),'utf8');
 assert.match(code,/body:LIVE\?'':txt/);
 assert.match(code,/api\/gmail\/message/);
 assert.match(code,/message_not_in_procurement|email_not_in_procurement/);
 assert.match(code,/scope:'https:\/\/www\.googleapis\.com\/auth\/gmail\.readonly'/);
 assert.match(code,/await clearOauth\(\)/);
 assert.match(ui,/mail-show-original/);
 assert.match(ui,/data-mail-id/);
 assert.match(ui,/div\.textContent=d\.body/);
});
test('safe mode cannot connect an unprotected external DATABASE_URL',()=>{
 assert.throws(()=>createStateStore({env:{DATABASE_URL:env.DATABASE_URL,OAUTH_ENCRYPTION_KEY:secret}}),
  /requires protected production access/);
});


test('AES-256-GCM backups are readable only with owner key, never contain raw commercial data',()=>{
 const {sealBackup,openBackup}=require('../tools/db-backup');
 const example={revision:'7',createdAt:'2026-10-16T00:00:00Z',
  state:{requests:[{id:'SYNTHETIC-1',title:'private test'}],gmailReplies:[]}};
 const key=crypto.randomBytes(32).toString('hex'),e={BACKUP_ENCRYPTION_KEY:key};
 const encrypted=sealBackup(example,e);
 assert.equal(encrypted.cipher,'AES-256-GCM');
 assert.doesNotMatch(JSON.stringify(encrypted),/SYNTHETIC-1|private test/);
 assert.deepEqual(openBackup(encrypted,e),example);
 assert.throws(()=>openBackup(encrypted,{BACKUP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex')}));
 assert.throws(()=>openBackup({...encrypted,tag:Buffer.alloc(16).toString('base64')},e));
});
