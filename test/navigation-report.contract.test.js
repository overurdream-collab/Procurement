'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {dailyReport}=require('../procurement-reports');
const sample=require('../data.json');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const ops=fs.readFileSync(path.join(root,'public/ops-dashboard.js'),'utf8');

test('nine sidebar services are unique and report functions are wired',()=>{
 const expected=['dashboard','reports','rfq','market','suppliers','responses','quotes','approvals','agent','gmail'];
 const links=[...html.matchAll(/data-view="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(links,expected);
 assert.equal(new Set(links).size,links.length);
 assert.doesNotMatch(html,/class="controls"/,'Old duplicated top service navigation must be gone');
 assert.match(html,/id="sidebarToggle"/);
 assert.match(html,/id="sidebarBackdrop"/);
 assert.match(html,/ops-dashboard\.js/);
 assert.match(ops,/function dailyView\(/);
 assert.match(ops,/id="reportPeriod"/);
 assert.match(ops,/function updateReportPeriod\(/);
 assert.match(html,/dashboard:executiveHomeView,reports:dailyView/);
 assert.match(html,/if\(view==='dashboard'\)ALHARIRDashboardPilot.init\(\)/);
 assert.match(html,/if\(view==='reports'\)loadDailyReport\(\)/);
 assert.match(ops,/function comparisonView\(/);
 assert.match(ops,/function saveStructuredQuote\(/);
 assert.match(ops,/function loadDailyReport\(/);
 assert.match(ops,/function copyWeChatDailyText\(/);
});
test('WeChat executive copy has honest statistics and marks demo only',()=>{
 const context=vm.createContext({});
 vm.runInContext(ops,context,{filename:'ops-dashboard.js'});
 const d=dailyReport(sample,{date:'2026-10-16',audience:'management'});
 const result=vm.runInContext('formatWeChatDailyText(data)',vm.createContext({data:d,...{
   formatWeChatDailyText:vm.runInContext('formatWeChatDailyText',context)
 }}));
 assert.match(result,/ALHARIR/);
 assert.match(result,/2026-10-16/);
 assert.match(result,/العروض: 1/);
 assert.match(result,/مقارنات FOB متكافئة: 0/);
 assert.match(result,/لا توجد عروض متكافئة/);
 assert.doesNotMatch(result,/توفير محقق[^ً]/);
});
test('buyer daily report hides internal IDs and procurement approvals',()=>{
 const st=JSON.parse(JSON.stringify(sample));
 st.approvals=[{id:'APP-SECRET',status:'pending',title:'Pending confidential approval'}];
 st.quotes[0].evidenceRef='internal-q-attachment';
 st.quotes[0].reviewNote='secret internal terms';
 const out=dailyReport(st,{audience:'buyer',date:'2026-10-16'});
 const raw=JSON.stringify(out);
 assert.equal(out.kpis.pendingApprovals,null);
 assert.equal(out.activities.length,0);
 assert.doesNotMatch(raw,/APP-SECRET|Pending confidential approval|internal-q-attachment|secret internal terms/);
 assert.doesNotMatch(raw,/Q-Emaar-001/);
 assert.doesNotMatch(raw,/الموافقات|اعتمادات إدارية معلقة/);
});
