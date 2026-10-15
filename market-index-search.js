'use strict';
// Indexed search only. Does not scrape or bypass marketplace access controls.
// Financial safety: an API key by itself NEVER enables network calls.
function configuredProvider(env=process.env){
  if(env.MARKET_ENABLE_LIVE_SEARCH!=='true')return 'none';
  if(env.TAVILY_API_KEY)return 'tavily';
  if(env.SERPER_API_KEY)return 'serper';
  if(env.BRAVE_SEARCH_API_KEY)return 'brave';
  if(env.GOOGLE_CSE_API_KEY&&env.GOOGLE_CSE_ID)return 'google-legacy';
  return 'none';
}
async function searchIndexedWeb(query,{env=process.env,fetcher=fetch,limit=8}={}){
  const provider=configuredProvider(env);
  if(!query||provider==='none')return {configured:provider!=='none',provider,items:[]};
  const count=Math.max(1,Math.min(10,Number(limit)||8));
  let endpoint,options={headers:{Accept:'application/json'}};
  if(provider==='tavily'){
    endpoint='https://api.tavily.com/search';
    options={method:'POST',headers:{
      'Authorization':'Bearer '+env.TAVILY_API_KEY,
      'Content-Type':'application/json','Accept':'application/json'
    },body:JSON.stringify({
      query,topic:'general',search_depth:'basic',max_results:count,
      include_answer:false,include_images:false,include_raw_content:false
    })};
  }else if(provider==='serper'){
    endpoint='https://google.serper.dev/search';
    options={method:'POST',headers:{
      'X-API-KEY':env.SERPER_API_KEY,
      'Content-Type':'application/json','Accept':'application/json'
    },body:JSON.stringify({q:query,num:count})};
  }else if(provider==='brave'){
    const u=new URL('https://api.search.brave.com/res/v1/web/search');
    u.searchParams.set('q',query);u.searchParams.set('count',String(count));
    u.searchParams.set('result_filter','web');u.searchParams.set('text_decorations','false');
    endpoint=u.toString();
    options.headers['X-Subscription-Token']=env.BRAVE_SEARCH_API_KEY;
  }else{
    const u=new URL('https://www.googleapis.com/customsearch/v1');
    u.searchParams.set('q',query);u.searchParams.set('num',String(count));
    u.searchParams.set('key',env.GOOGLE_CSE_API_KEY);u.searchParams.set('cx',env.GOOGLE_CSE_ID);
    endpoint=u.toString();
  }
  const response=await fetcher(endpoint,options);
  if(!response.ok)throw Error(provider+' search HTTP '+response.status);
  const data=await response.json();
  const entries=provider==='brave'?(data.web?.results||[]):
    provider==='tavily'?(data.results||[]):provider==='serper'?(data.organic||[]):(data.items||[]);
  return {configured:true,provider,items:entries.map(x=>({
    title:x.title||'',url:x.url||x.link||'',snippet:x.content||x.description||x.snippet||''
  }))};
}
module.exports={configuredProvider,searchIndexedWeb};
