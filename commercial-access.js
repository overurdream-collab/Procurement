'use strict';
const crypto=require('node:crypto');
function productionConfig(env=process.env){
 if(env.PROCUREMENT_PRODUCTION!=='true')return;
 if(env.STAGING_HOSTED==='true'||env.STAGING_DEMO==='true')throw Error('Production must never run in synthetic demo');
 if(!env.DATABASE_URL)throw Error('DATABASE_URL is required for production');
 if(!/^[a-zA-Z0-9._-]{3,80}$/.test(env.PRODUCTION_ACCESS_USER||'')||
  String(env.PRODUCTION_ACCESS_PASSWORD||'').length<24)throw Error('Production access requires separate strong credentials');
 if(!/^https:\/\//i.test(env.APP_BASE_URL||''))throw Error('Production must use https APP_BASE_URL');
 if(env.PRODUCTION_READONLY_MAIL!=='true')throw Error('Production Gmail mode must be explicitly read-only');
 if(!/^[0-9a-f]{64}$/i.test(env.OAUTH_ENCRYPTION_KEY||''))throw Error('OAUTH_ENCRYPTION_KEY is missing or invalid');
}
function safeEq(left,right){
 const a=crypto.createHash('sha256').update(left).digest(),b=crypto.createHash('sha256').update(right).digest();
 return crypto.timingSafeEqual(a,b);
}
const failures=new Map();
function guardProduction(req,res,env=process.env){
 if(env.PROCUREMENT_PRODUCTION!=='true')return true;
 const u=new URL(req.url||'/', 'http://localhost');
 if(u.pathname==='/health/live'&&req.method==='GET'){
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:true,mode:'protected-production'}));return false;
 }
 const addr=req.socket?.remoteAddress||'unknown',now=Date.now();
 let user='',pass='';
 try{
  const h=String(req.headers.authorization||'');
  if(h.length<4096&&/^Basic\s+/i.test(h)){
   const decoded=Buffer.from(h.replace(/^Basic\s+/i,''),'base64').toString('utf8');
   const index=decoded.indexOf(':');if(index>=0){user=decoded.slice(0,index);pass=decoded.slice(index+1)}
  }
 }catch{}
 if(safeEq(user,env.PRODUCTION_ACCESS_USER)&&safeEq(pass,env.PRODUCTION_ACCESS_PASSWORD)){
  failures.delete(addr);
  if(u.pathname==='/api/agent/run'){
   res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({error:'automatic_actions_disabled_in_readonly_mail_mode'}));return false;
  }
  return true;
 }
 const prior=failures.get(addr)||{since:now,count:0,until:0};
 if(prior.until>now){
  res.writeHead(429,{'Retry-After':String(Math.ceil((prior.until-now)/1000)),'Cache-Control':'no-store'});
  res.end('Too many attempts');return false;
 }
 if(now-prior.since>15*60e3){prior.count=0;prior.since=now}
 prior.count++;if(prior.count>=10)prior.until=now+60e3;
 failures.set(addr,prior);
 res.writeHead(401,{'WWW-Authenticate':'Basic realm="ALHARIR Restricted Procurement"',
  'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8',
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
 res.end('Sign in required');return false;
}
module.exports={productionConfig,guardProduction};
