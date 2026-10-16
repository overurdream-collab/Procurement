'use strict';
const crypto=require('node:crypto');

function requireHostedAccessConfig(env=process.env){
  if(env.STAGING_HOSTED!=='true')return;
  if(env.STAGING_DEMO!=='true')throw Error('Hosted version must run in synthetic-data demo mode');
  if(!env.HOSTED_ACCESS_USER||!env.HOSTED_ACCESS_PASSWORD||env.HOSTED_ACCESS_PASSWORD.length<16)
    throw Error('Hosted test requires HOSTED_ACCESS_USER and strong HOSTED_ACCESS_PASSWORD in private environment variables');
}
function eq(a,b){
 const x=crypto.createHash('sha256').update(String(a)).digest();
 const y=crypto.createHash('sha256').update(String(b)).digest();
 return crypto.timingSafeEqual(x,y);
}
const recentFailures=new Map();
function guardHostedRequest(req,res,env=process.env){
 if(env.STAGING_HOSTED!=='true')return true;
 let pathname='';
 try{pathname=new URL(req.url||'/', 'http://localhost').pathname}catch{}
 if(pathname==='/health/live'&&req.method==='GET'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({ok:true,mode:'protected-demo'}));return false;
 }
 const ip=String(req.socket?.remoteAddress||'unknown');
 const now=Date.now();
 const record=recentFailures.get(ip)||{failures:0,until:0};
 // Decode credentials before checking lockout so a legitimate user can recover.
 // Render's reverse proxy may share req.socket.remoteAddress across browsers.
 let username='',password='';
 try{
   const h=String(req.headers.authorization||'');
   if(h.length<8192&&/^Basic\s+/i.test(h)){
     const decoded=Buffer.from(h.replace(/^Basic\s+/i,''),'base64').toString('utf8');
     const split=decoded.indexOf(':');if(split>=0){username=decoded.slice(0,split);password=decoded.slice(split+1);}
   }
 }catch{}
 if(eq(username,env.HOSTED_ACCESS_USER)&&eq(password,env.HOSTED_ACCESS_PASSWORD)){
   recentFailures.delete(ip);
   // The initial deployment intentionally has one administrative demo login.
   // Per-employee accounts and role permissions are a separate acceptance gate.
   if(pathname.startsWith('/api/gmail/')||pathname==='/api/agent/run'){
     res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
     res.end(JSON.stringify({error:'demo_integrations_disabled'}));return false;
   }
   return true;
 }
 // Rate-limit bad credentials only. A correct password must never be rejected
 // because another browser/IP behind the same reverse proxy failed earlier.
 if(record.until>now){
   res.writeHead(429,{
     'Content-Type':'text/plain; charset=utf-8',
     'Cache-Control':'no-store','Retry-After':String(Math.max(1,Math.ceil((record.until-now)/1000))),
     'X-Content-Type-Options':'nosniff'
   });
   res.end('Too many failed sign-in attempts. Wait briefly and retry.');return false;
 }
 record.failures=(now-(record.last||0)>15*60e3)?1:record.failures+1;
 record.last=now;
 if(record.failures>=10)record.until=now+60000;
 recentFailures.set(ip,record);
 res.writeHead(401,{
   'WWW-Authenticate':'Basic realm="ALHARIR Private Demonstration", charset="UTF-8"',
   'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'
 });
 res.end('Private ALHARIR application. Login required.');
 return false;
}
module.exports={guardHostedRequest,requireHostedAccessConfig};
