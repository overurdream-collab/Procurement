// ALHARIR procurement sandbox — SYNTHETIC DATA ONLY. No network or mail sending.
export const rfq = Object.freeze({
 id:"RFQ-POC-001",currency:"USD",incoterm:"FOB",
 lines:[{sku:"PIR100",qty:200,spec:"PIR100"},{sku:"DOOR",qty:2,spec:"CHILLER"},{sku:"COND",qty:1,spec:"5KW"}]
});
export const quotes = Object.freeze([
 {id:"A",vendor:"Synthetic supplier A",email:"a@supplier.example",incoterm:"FOB",currency:"USD",lines:[{sku:"PIR100",qty:200,spec:"PIR100",unitCents:2850},{sku:"DOOR",qty:2,spec:"CHILLER",unitCents:82000},{sku:"COND",qty:1,spec:"5KW",unitCents:390000}]},
 {id:"B",vendor:"Synthetic supplier B",email:"b@supplier.example",incoterm:"FOB",currency:"USD",lines:[{sku:"PIR100",qty:200,spec:"PIR100",unitCents:2780},{sku:"DOOR",qty:2,spec:"CHILLER",unitCents:86000},{sku:"COND",qty:1,spec:"5KW",unitCents:410000}]},
 {id:"C",vendor:"Synthetic supplier C",email:"c@supplier.example",incoterm:"EXW",currency:"USD",lines:[{sku:"PIR100",qty:200,spec:"PIR100",unitCents:2550},{sku:"DOOR",qty:2,spec:"CHILLER",unitCents:70000},{sku:"COND",qty:1,spec:"5KW",unitCents:380000}]},
 {id:"D",vendor:"Synthetic supplier D",email:"d@supplier.example",incoterm:"FOB",currency:"USD",lines:[{sku:"PIR100",qty:200,spec:"PIR100",unitCents:2700},{sku:"DOOR",qty:2,spec:"CHILLER",unitCents:83000}]}
]);
export function cents(n){if(!Number.isSafeInteger(n)||n<0)throw Error("INVALID_CENTS");return n;}
export function emailKey(s){if(typeof s!=="string")throw Error("INVALID_EMAIL");const e=s.trim().toLowerCase(),p=e.split("@");if(p.length!==2||!p[0]||!p[1]||!p[1].includes(".")||e.includes(" ")||e.includes("\n"))throw Error("INVALID_EMAIL");return e;}
export function dedupeVendors(xs){const seen=new Set();return xs.filter(x=>{const key=emailKey(x.email);if(seen.has(key))return false;seen.add(key);return true;});}
export function evaluate(q,spec=rfq){
 const issues=[],totals=[];
 if(q.incoterm!==spec.incoterm)issues.push("NOT_FOB");
 if(q.currency!==spec.currency)issues.push("CURRENCY_MISMATCH");
 const lines=Array.isArray(q.lines)?q.lines:[];
 if(!Array.isArray(q.lines))issues.push("INVALID_LINES");
 const ids=new Set();
 for(const l of lines){if(ids.has(l.sku))issues.push("DUPLICATE:"+l.sku);ids.add(l.sku);if(!spec.lines.some(x=>x.sku===l.sku))issues.push("UNEXPECTED:"+l.sku);}
 for(const expected of spec.lines){
   const l=lines.find(x=>x.sku===expected.sku);
   if(!l){issues.push("MISSING:"+expected.sku);continue;}
   if(l.qty!==expected.qty)issues.push("QUANTITY:"+expected.sku);
   if(l.spec!==expected.spec)issues.push("SPEC:"+expected.sku);
   try{const total=cents(l.unitCents)*expected.qty;if(!Number.isSafeInteger(total))throw Error();totals.push(total);}
   catch{issues.push("PRICE:"+expected.sku);}
 }
 const sum=totals.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(sum))issues.push("OVERFLOW");
 return {id:q.id,vendor:q.vendor,eligible:issues.length===0,issues,totalCents:issues.length?null:sum};
}
export function compare(input=quotes,spec=rfq){
 const offers=input.map(q=>evaluate(q,spec));
 const eligible=offers.filter(x=>x.eligible).sort((a,b)=>a.totalCents-b.totalCents||a.id.localeCompare(b.id));
 return {synthetic:true,rfqId:spec.id,offers,winner:eligible[0]??null,eligibleCount:eligible.length,savingsCents:eligible.length>1?eligible.at(-1).totalCents-eligible[0].totalCents:0};
}
export function report(){const c=compare();return {synthetic:true,date:"2026-10-16",rfqId:rfq.id,suppliers:quotes.length,eligible:c.eligibleCount,rejected:quotes.length-c.eligibleCount,winner:c.winner,savingsCents:c.savingsCents,exclusions:c.offers.filter(x=>!x.eligible)};}
export function newWorkflow(){return {status:"draft",events:[],outbox:[]};}
export function requestApproval(s,user){if(s.status!=="draft")throw Error("BAD_STATE");if(!user?.permissions?.includes("rfq.submit"))throw Error("DENIED");s.status="pending";s.requestedBy=user.id;s.events.push({type:"requested",user:user.id});}
export function approve(s,user){if(s.status!=="pending")throw Error("BAD_STATE");if(!user?.permissions?.includes("rfq.approve"))throw Error("DENIED");if(user.id===s.requestedBy)throw Error("DUAL_CONTROL");s.status="approved";s.events.push({type:"approved",user:user.id});}
export function simulateSend(s,user,key){
 if(s.status!=="approved")throw Error("NOT_APPROVED");
 if(!user?.permissions?.includes("rfq.send"))throw Error("DENIED");
 if(typeof key!=="string"||!key.trim())throw Error("KEY_REQUIRED");
 const prior=s.outbox.find(x=>x.key===key);if(prior)return {simulated:true,deduplicated:true,reference:prior.reference};
 const reference="SIM-"+String(s.outbox.length+1).padStart(3,"0");s.outbox.push({key,reference});
 s.events.push({type:"mock_send",user:user.id,reference});return {simulated:true,deduplicated:false,reference};
}
