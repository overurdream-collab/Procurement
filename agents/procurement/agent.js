const {normalizeQuote}=require('./quote-schema');
const {analyzePrices}=require('./price-intelligence');
const {analyzeRisks}=require('./risk-intelligence');
const {buildFollowup}=require('./missing-fields');

function analyzeQuotation(raw={}){
  const quote=normalizeQuote(raw);
  return {quote,risks:analyzeRisks(quote),followup:buildFollowup(quote)};
}
function compareQuotations(rawQuotes=[]){
  const analyses=rawQuotes.map(analyzeQuotation);
  const prices=analyzePrices(analyses.map(x=>x.quote));
  return analyses.map((x,i)=>({...x,price_intelligence:prices[i]}));
}
module.exports={analyzeQuotation,compareQuotations};
