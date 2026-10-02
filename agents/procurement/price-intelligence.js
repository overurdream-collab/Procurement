function num(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
function analyzePrices(quotes=[]){
  const priced=quotes.map(q=>({...q,_p:num(q.fob_price ?? q.price)})).filter(q=>q._p!==null);
  if(!priced.length) return quotes.map(q=>({supplier:q.supplier,findings:['price_missing']}));
  const avg=priced.reduce((s,q)=>s+q._p,0)/priced.length;
  return quotes.map(q=>{
    const p=num(q.fob_price ?? q.price), findings=[];
    if(p===null) findings.push('price_missing');
    else if(priced.length>1 && Math.abs(p-avg)/avg>=0.20) findings.push(p<avg?'price_below_peer_range':'price_above_peer_range');
    if(!q.fob_port) findings.push('fob_port_missing');
    if(!q.cbm || !q.gross_weight) findings.push('logistics_cost_inputs_missing');
    if(q.missing_fields?.length) findings.push('scope_normalization_required');
    return {supplier:q.supplier,quoted_price:p,peer_average:avg,variance_pct:p===null?null:Number((((p-avg)/avg)*100).toFixed(1)),findings};
  });
}
module.exports={analyzePrices};
