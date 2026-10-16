/* Adapted from BuilderIO/agent-native packages/toolkit/src/dashboard/dashboard-layout.ts
 * MIT-licensed presentation-only layout; no Agent-Native runtime, DB or auth installed.
 * https://github.com/BuilderIO/agent-native */
(function(root,factory){const v=factory();if(typeof module==='object'&&module.exports)module.exports=v;else root.ALHARIRAgentNativeLayout=v;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const clampDashboardColumns=n=>typeof n==='number'&&Number.isFinite(n)?Math.min(6,Math.max(1,Math.floor(n))):2;
 const clampPanelWidth=(n,cols)=>typeof n==='number'&&Number.isFinite(n)?Math.min(clampDashboardColumns(cols),Math.max(1,Math.floor(n))):1;
 function buildDashboardRows(panels,columns){
  const max=clampDashboardColumns(columns),rows=[];let cur=[],width=0;
  const push=()=>{if(cur.length)rows.push({key:cur.map(x=>x.id).join(':'),panels:cur});cur=[];width=0};
  for(const p of panels){
   const w=clampPanelWidth(p.width,max);
   if(cur.length&&(width+w>max||cur.length>=max))push();
   cur.push({...p,width:w});width+=w;
   if(width>=max||cur.length>=max)push();
  }
  push();return rows;
 }
 return {clampDashboardColumns,clampPanelWidth,buildDashboardRows};
});