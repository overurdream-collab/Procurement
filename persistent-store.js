'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const INITIAL_STATE=()=>({
 project:{name:'ALHARIR Procurement'},
 requests:[],suppliers:[],quotes:[],approvals:[],activity:[],gmailReplies:[],
 correspondence:[],marketScans:[],settings:{dryRun:true,requirePerMessageApproval:true},
 workspace:{}
});
const keyFromEnv=(env)=>{const k=String(env.OAUTH_ENCRYPTION_KEY||'');if(!/^[0-9a-f]{64}$/i.test(k))
 throw Error('OAUTH_ENCRYPTION_KEY must be 32 random bytes, encoded as 64 hex characters');
 return Buffer.from(k,'hex')};
function encryptOauth(input,env){
 const key=keyFromEnv(env),iv=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('alharir.gmail.oauth.v1'));
 const text=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(input))),cipher.final()]);
 return {v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),
  ciphertext:text.toString('base64')};
}
function decryptOauth(payload,env){
 if(!payload||payload.v!==1)throw Error('unsupported_oauth_cipher_version');
 const decipher=crypto.createDecipheriv('aes-256-gcm',keyFromEnv(env),Buffer.from(payload.iv,'base64'));
 decipher.setAAD(Buffer.from('alharir.gmail.oauth.v1'));
 decipher.setAuthTag(Buffer.from(payload.tag,'base64'));
 return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext,'base64')),decipher.final()]).toString('utf8'));
}
function createStateStore({env=process.env,localFile,oauthFile,pgFactory}={}){
 const demo=env.STAGING_HOSTED==='true',postgres=!!env.DATABASE_URL&&!demo;
 if(env.PROCUREMENT_PRODUCTION==='true'&&!postgres)
   throw Error('Production requires DATABASE_URL and must not use demo storage');
 if(postgres)keyFromEnv(env);
 let pool,setup,closed=false;const revision=new WeakMap();
 const getPool=()=>{
  if(!pool){const Pool=pgFactory||require('pg').Pool;
   pool=new Pool({connectionString:env.DATABASE_URL,max:3,idleTimeoutMillis:30000,
    connectionTimeoutMillis:12000,ssl:{rejectUnauthorized:true}});
  }return pool;
 };
 async function ready(){
  if(!postgres)return;
  if(!setup)setup=(async()=>{
   const db=getPool();
   await db.query('CREATE TABLE IF NOT EXISTS alharir_state (id SMALLINT PRIMARY KEY CHECK(id=1), revision BIGINT NOT NULL DEFAULT 0, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
   await db.query('CREATE TABLE IF NOT EXISTS alharir_secrets (key TEXT PRIMARY KEY, encrypted JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
   await db.query('INSERT INTO alharir_state(id,revision,payload) VALUES (1,0,$1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(INITIAL_STATE())]);
  })().catch(e=>{setup=null;throw e});
  return setup;
 }
 async function load(){
  if(!postgres)return JSON.parse(fs.readFileSync(localFile,'utf8'));
  await ready();const res=await getPool().query('SELECT revision,payload FROM alharir_state WHERE id=1');
  if(!res.rows.length)throw Error('persistent_state_missing');
  const row=res.rows[0],data=row.payload;
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid_persistent_state_payload');
  revision.set(data,BigInt(row.revision));return data;
 }
 async function save(data){
  if(!postgres){
   const tmp=localFile+'.'+process.pid+'.tmp';
   fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});
   fs.renameSync(tmp,localFile);return;
  }
  await ready();
  if(!revision.has(data))throw Error('state_save_requires_previously_loaded_object');
  const expected=revision.get(data);
  const out=await getPool().query('UPDATE alharir_state SET payload=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision',
   [JSON.stringify(data),expected.toString()]);
  if(out.rowCount!==1){const err=Error('state_revision_conflict');err.code='STATE_CONFLICT';throw err}
  revision.set(data,BigInt(out.rows[0].revision));
 }
 async function oauth(){
  if(!postgres)return fs.existsSync(oauthFile)?JSON.parse(fs.readFileSync(oauthFile,'utf8')):{};
  await ready();
  const r=await getPool().query("SELECT encrypted FROM alharir_secrets WHERE key='gmail_oauth'");
  if(!r.rows.length)return {};
  return decryptOauth(r.rows[0].encrypted,env);
 }
 async function saveOauth(obj){
  if(!postgres){fs.writeFileSync(oauthFile,JSON.stringify(obj,null,2),{mode:0o600});return}
  await ready();const encrypted=encryptOauth(obj,env);
  await getPool().query("INSERT INTO alharir_secrets(key,encrypted) VALUES ('gmail_oauth',$1::jsonb) ON CONFLICT (key) DO UPDATE SET encrypted=EXCLUDED.encrypted,updated_at=now()",
   [JSON.stringify(encrypted)]);
 }
 async function clearOauth(){
  if(!postgres){if(fs.existsSync(oauthFile))fs.unlinkSync(oauthFile);return}
  await ready();await getPool().query("DELETE FROM alharir_secrets WHERE key='gmail_oauth'");
 }
 async function diagnostics(){
  if(!postgres)return {type:demo?'temporary-synthetic-demo':'local-development',durable:false};
  await ready();const r=await getPool().query("SELECT revision,updated_at FROM alharir_state WHERE id=1");
  return {type:'postgres',durable:true,revision:String(r.rows[0].revision),updatedAt:r.rows[0].updated_at};
 }
 async function close(){if(closed)return;closed=true;if(pool)await pool.end()}
 return {durable:postgres,ready,load,save,oauth,saveOauth,clearOauth,diagnostics,close};
}
module.exports={createStateStore,encryptOauth,decryptOauth,INITIAL_STATE};
