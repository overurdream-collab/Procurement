'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const AAD=Buffer.from('alharir.procurement.backup.v1');
function backupKey(env=process.env){
 const key=String(env.BACKUP_ENCRYPTION_KEY||'');
 if(!/^[0-9a-f]{64}$/i.test(key))throw Error('BACKUP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
 return Buffer.from(key,'hex');
}
function sealBackup(record,env=process.env){
 const key=backupKey(env),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(AAD);
 const text=Buffer.concat([cipher.update(JSON.stringify(record),'utf8'),cipher.final()]);
 return {format:'alharir-encrypted-backup',version:1,cipher:'AES-256-GCM',
  iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),payload:text.toString('base64')};
}
function openBackup(file,env=process.env){
 if(!file||file.format!=='alharir-encrypted-backup'||file.version!==1)throw Error('unsupported_backup_format');
 const decipher=crypto.createDecipheriv('aes-256-gcm',backupKey(env),Buffer.from(file.iv,'base64'));
 decipher.setAAD(AAD);decipher.setAuthTag(Buffer.from(file.tag,'base64'));
 return JSON.parse(Buffer.concat([decipher.update(Buffer.from(file.payload,'base64')),decipher.final()]).toString('utf8'));
}
async function main(){
 const mode=process.argv[2],filename=process.argv[3];
 if(!['export','verify'].includes(mode))throw Error('Usage: node tools/db-backup.js export <destination-path> | verify <encrypted-file>');
 if(!filename)throw Error('Destination/file path required');
 if(mode==='verify'){
  const saved=JSON.parse(fs.readFileSync(filename,'utf8')),record=openBackup(saved);
  if(!record?.state||!Number.isFinite(Number(record.revision)))throw Error('backup_data_invalid');
  console.log('Backup authentic and readable; revision='+record.revision+', createdAt='+record.createdAt);
  return;
 }
 if(process.env.PROCUREMENT_PRODUCTION!=='true')throw Error('Production mode required');
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL not configured');
 if(fs.existsSync(filename))throw Error('Refusing to overwrite existing backup');
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,
  connectionTimeoutMillis:12000,ssl:{rejectUnauthorized:true}});
 try{
  const r=await pool.query('SELECT revision, payload, updated_at FROM alharir_state WHERE id=1');
  if(r.rows.length!==1)throw Error('business_state_missing');
  const record={revision:String(r.rows[0].revision),state:r.rows[0].payload,
   databaseUpdatedAt:r.rows[0].updated_at,createdAt:new Date().toISOString(),
   // OAuth secret vault deliberately NOT included.
   includesOauth:false};
  const encrypted=JSON.stringify(sealBackup(record));
  fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  fs.writeFileSync(filename,encrypted,{mode:0o600,flag:'wx'});
  // Verify cryptographic integrity immediately, without printing supplier data.
  openBackup(JSON.parse(fs.readFileSync(filename,'utf8')));
  console.log('Encrypted backup written and verified; revision='+record.revision);
 }finally{await pool.end()}
}
if(require.main===module)main().catch(e=>{console.error('Backup failed:',e.message);process.exitCode=1});
module.exports={sealBackup,openBackup};
