import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const source=fs.readFileSync(new URL('../backend/gas/Core.js',import.meta.url),'utf8');
function engine(code=source,inject=false){
  const ctx={};vm.createContext(ctx);
  // Isolate candidate rules from zone detection for boundary cases only.
  if(inject)code=code.replace('return {timestamp:timestamp,','return {_inputs:function(i,z){indicators=function(){return i;};zones=function(){return z;};},timestamp:timestamp,');
  vm.runInContext(code,ctx);return ctx.NitiCore;
}
const cfg={tick:.01,spread:.05,slippage:.02,minRR:1.1,minScore:52,expiryHours:6,maxEntryATR:3.5,minRiskATR:.30,maxRiskATR:2.8,tpBufferATR:.07};
const bars=Array.from({length:960},(_,i)=>({t:i*900000,o:103,h:104,l:102,c:103}));
bars[900]={...bars[900],h:108};
const demand={id:'d',side:1,lo:99,hi:100,tests:0,t:0,family:'PIVOT',quality:.58};
const supply={id:'s',side:-1,lo:107,hi:108,tests:0,t:0,family:'PIVOT',quality:.58};
const now=960*900000,core=engine(source,true);
core._inputs({atr:2,trend:'DOWN',rsi:50,k:40,d:50},[demand,supply]);
assert(core.candidates(bars,103,cfg,now).candidates.some(p=>p.side==='BUY_LIMIT'));
assert(!core.candidates(bars,103,{...cfg,experimental:true},now).candidates.some(p=>p.side==='BUY_LIMIT'),'countertrend requires explicit reversal');
const reversed=bars.map(b=>({...b}));reversed[958]={...reversed[958],o:99,h:102,l:98,c:101};reversed[959]={...reversed[959],o:101,h:104,l:100,c:103};
core._inputs({atr:2,trend:'DOWN',rsi:50,k:55,d:45},[demand,supply]);
assert(core.candidates(reversed,103,{...cfg,experimental:true},now).candidates.some(p=>p.side==='BUY_LIMIT'),'closed-bar reversal evidence can admit countertrend');
core._inputs({atr:2,trend:'UP',rsi:50,k:55,d:45},[demand]);
assert.equal(core.candidates(bars,103,cfg,now).candidates.length,0,'baseline has no fallback');
const fallback=core.candidates(bars,103,{...cfg,experimental:true},now).candidates[0];
assert(fallback);assert.equal(fallback.targetSource,'CONFIRMED_SWING');assert.equal(fallback.targetReference,108);core.validatePlan(fallback,103,cfg);
const sellBars=bars.map(b=>({...b}));sellBars[900].l=98;
core._inputs({atr:2,trend:'DOWN',rsi:50,k:40,d:50},[supply]);
const sellFallback=core.candidates(sellBars,103,{...cfg,experimental:true},now).candidates[0];
assert(sellFallback);assert.equal(sellFallback.side,'SELL_LIMIT');assert.equal(sellFallback.targetReference,98);core.validatePlan(sellFallback,103,cfg);
const broken=bars.map(b=>({...b}));broken[950].h=109;
assert(!engine().confirmedSwings(broken).some(p=>p.price===108&&p.side===1),'crossed swing cannot be used');
const future=bars.map(b=>({...b}));future[959].h=120;
assert(!engine().confirmedSwings(future).some(p=>p.price===120),'unconfirmed swing cannot be used');
core._inputs({atr:2,trend:'UP',rsi:50,k:55,d:45},[demand,{...supply,lo:100.2,hi:101}]);
assert(!core.candidates(bars,103,{...cfg,experimental:true},now).candidates.some(p=>p.side==='BUY_LIMIT'),'do not bypass a nearby opposing zone using a farther swing');
const audited=core.candidates(bars,103,{...cfg,experimental:true},now).candidateAudit;
assert.equal(Object.values(audited.rejectedCounts).reduce((a,b)=>a+b,0)+audited.candidatesBeforeLimit,audited.zonesFound);
const funnel=Object.values(audited.funnel);funnel.forEach((v,i)=>{if(i)assert(v<=funnel[i-1]);});

// Production baseline must retain the exact candidate prices/rank on varied OHLC fixtures.
const original=engine(execFileSync('git',['show','6c3c01fc416c3b212af6573b043f7b281853f886:backend/gas/Core.js'],{encoding:'utf8'}));
const live=engine();let seed=98765,nonempty=0;
function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
function clean(p){const q={...p};delete q.targetSource;delete q.targetReference;delete q.directionEvidence;return q;}
for(let fixture=0;fixture<16;fixture++){
  let price=100;const data=Array.from({length:1000},(_,i)=>{const o=price,c=o+(random()-.49)*2;price=c;return {t:i*900000,o,c,h:Math.max(o,c)+random(),l:Math.min(o,c)-random()};});
  const before=original.candidates(data,price,cfg,1000*900000),after=live.candidates(data,price,cfg,1000*900000);
  nonempty+=before.candidates.length;
  assert.equal(JSON.stringify(after.candidates.map(clean)),JSON.stringify(before.candidates));
}
assert(nonempty>0,'regression fixtures must exercise passing candidates');
const externalH4=Array.from({length:60},(_,i)=>({t:i*14400000,o:100,h:102,l:99,c:101}));
const external=live.candidates(bars,103,{...cfg,h4Bars:externalH4,h4Source:'FMP 1H → H4'},now);
assert(external.h4);assert.equal(external.coverage.h4,60);assert.equal(external.coverage.h4Source,'FMP 1H → H4');

// Paired storage: same snapshot once, both arms validated before saving, no live-plan writes.
const context={NitiCore:live,NITI:{SHEET_ID:'test',SYMBOLS:{TEST:{}},TRIAL_VERSION:'trial'}};vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../backend/gas/Trials.gs',import.meta.url),'utf8'),context);
let records=[];context.trialPlans_=()=>records;context.saveTrial_=ps=>records.push(...ps);
context.symbolCfg_=()=>cfg;context.session_=()=> 'TEST';
const market={symbol:'TEST',price:103,quoteAt:now,bars15:bars,sourceTimezone:'UTC'};
const config={TRIAL_VERSION:'trial',EXPIRY_HOURS:6,SYMBOLS:{TEST:cfg}};
const a={candidates:[fallback]},b={candidates:[{...fallback,candidateId:'revised'}]};
const recorded=context.recordTrialCohort_(market,a,b,config,now,'run',{closed:false});
assert.equal(recorded.status,'RECORDED');assert.equal(records.length,2);assert.equal(records[0].cohort,records[1].cohort);
assert.equal(context.recordTrialCohort_(market,a,b,config,now,'repeat',{closed:false}).status,'SAME_BAR');assert.equal(records.length,2);
assert.equal(context.recordTrialCohort_(market,a,b,config,now,'closed',{closed:true}).status,'MARKET_CLOSED');
records=[];assert.throws(()=>context.recordTrialCohort_(market,a,{candidates:[{...fallback,tp:90}]},config,now,'bad',{closed:false}));assert.equal(records.length,0);
const report=context.trialDashboard_();assert.equal(report.symbols.TEST.baseline.total,0);

// Render diagnostics safely and keep each test arm distinct in the UI.
const card={innerHTML:''},ui={document:{readyState:'loading',addEventListener(){},getElementById:id=>id==='activePlan'?{}:id==='candidateAudit'?card:null},window:{fetch(){}}};vm.createContext(ui);
let client=fs.readFileSync(new URL('../public/niti-enhancements.js',import.meta.url),'utf8');
client=client.replace('  function start() {','  window.testAudit = renderAudit;\n  function start() {');vm.runInContext(client,ui);
ui.window.testAudit({candidateAudit:audited,outcome:{status:'WAIT',reason:'<script>bad()</script>'},comparison:{baseline:audited,revised:audited,revisedCandidates:[fallback],tracking:{reason:'ทดลอง'}}});
assert(card.innerHTML.includes('ทดลอง Balanced ใหม่'));assert(card.innerHTML.includes('เป้าจาก Swing'));
assert(!card.innerHTML.includes('<script>bad()'));assert(card.innerHTML.includes('&lt;script&gt;'));

console.log('Balanced tests passed: reversal, swing confirmation, TP obstacles, audit, H4 history, baseline equivalence, isolated paired trials');
