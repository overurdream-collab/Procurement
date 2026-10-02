const fs=require('fs'),path=require('path');
const {Pool}=require('pg');

const DATA_FILE=path.join(__dirname,'..','data.json');
const OAUTH_FILE=path.join(__dirname,'..','.gmail-oauth.json');

let stateCache=fs.existsSync(DATA_FILE)?JSON.parse(fs.readFileSync(DATA_FILE,'utf8')):{};
let oauthCache=fs.existsSync(OAUTH_FILE)?JSON.parse(fs.readFileSync(OAUTH_FILE,'utf8')):{};
let pool=null;
let writeQueue=Promise.resolve();

function usingDatabase(){return Boolean(process.env.DATABASE_URL)}
function queueWrite(fn){
 writeQueue=writeQueue.then(fn).catch(err=>console.error('Persistence write failed:',err.message));
 return writeQueue;
}
async function initPersistence(){
 if(!usingDatabase())return {mode:'local-json'};
 pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false},
  max:3
 });
 await pool.query(`CREATE TABLE IF NOT EXISTS app_kv (
   key TEXT PRIMARY KEY,
   value JSONB NOT NULL,
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 )`);
 const r=await pool.query("SELECT key,value FROM app_kv WHERE key IN ('state','gmail_oauth')");
 const map=Object.fromEntries(r.rows.map(x=>[x.key,x.value]));
 if(map.state)stateCache=map.state;
 else await pool.query("INSERT INTO app_kv(key,value) VALUES('state',$1::jsonb) ON CONFLICT(key) DO NOTHING",[JSON.stringify(stateCache)]);
 if(map.gmail_oauth)oauthCache=map.gmail_oauth;
 return {mode:'postgres'};
}
function loadState(){return stateCache}
function saveState(value){
 stateCache=value;
 if(!usingDatabase()){fs.writeFileSync(DATA_FILE,JSON.stringify(value,null,2));return}
 queueWrite(()=>pool.query("INSERT INTO app_kv(key,value,updated_at) VALUES('state',$1::jsonb,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(value)]));
}
function loadOAuth(){return oauthCache}
function saveOAuth(value){
 oauthCache=value;
 if(!usingDatabase()){fs.writeFileSync(OAUTH_FILE,JSON.stringify(value,null,2),{mode:0o600});return}
 queueWrite(()=>pool.query("INSERT INTO app_kv(key,value,updated_at) VALUES('gmail_oauth',$1::jsonb,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(value)]));
}
function clearOAuth(){
 oauthCache={};
 if(!usingDatabase()){if(fs.existsSync(OAUTH_FILE))fs.unlinkSync(OAUTH_FILE);return}
 queueWrite(()=>pool.query("DELETE FROM app_kv WHERE key='gmail_oauth'"));
}
async function flushPersistence(){await writeQueue}
module.exports={initPersistence,loadState,saveState,loadOAuth,saveOAuth,clearOAuth,flushPersistence,usingDatabase};
