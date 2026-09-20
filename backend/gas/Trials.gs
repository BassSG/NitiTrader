/* Paired forward paper trial. Both arms use deterministic rank #1, never AI.
 * Separate sheet and no Telegram alerts; never changes the main plan pool.
 */
function trialPlans_(){
  const sh=SpreadsheetApp.openById(NITI.SHEET_ID).getSheetByName('NT_BalancedTrials');
  if(!sh||sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,18).getValues().map(r=>{
    try{return JSON.parse(r[17]);}catch(e){throw new Error('ข้อมูล Paper ทดลองเสียหาย');}
  });
}
function saveTrial_(p,isNew){
  const ss=SpreadsheetApp.openById(NITI.SHEET_ID);
  let sh=ss.getSheetByName('NT_BalancedTrials');
  if(!sh){
    sh=ss.insertSheet('NT_BalancedTrials');
    const headers=NITI_HEADERS.NT_Plans.slice();headers[15]='เหตุผลทดลอง (ไม่ใช้ AI)';
    sh.getRange(1,1,1,18).setValues([headers]).setBackground('#12242b').setFontColor('#dfbf76');
    sh.setFrozenRows(1);[2,10,11,12].forEach(col=>sh.getRange(2,col,sh.getMaxRows()-1,1).setNumberFormat('yyyy-mm-dd hh:mm:ss'));
    sh.hideColumns(18);
  }
  function rowFor(plan){const row=planRow_(plan).map(safe_);row[16]=plan.trialVersion+' / '+plan.trialArm;return row;}
  if(isNew){const rows=(Array.isArray(p)?p:[p]).map(rowFor);sh.getRange(sh.getLastRow()+1,1,rows.length,18).setValues(rows);return;}
  const row=rowFor(p);
  const hit=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),1).createTextFinder(p.id).matchEntireCell(true).findNext();
  if(!hit)throw new Error('ไม่พบ Paper ทดลอง');
  sh.getRange(hit.getRow(),1,1,18).setValues([row]);
}
function recordTrialCohort_(market,baseline,revised,c,now,runId,marketState){
  if(marketState.closed)return {status:'MARKET_CLOSED',reason:'ทดลองติดตามเฉพาะตลาดเปิดและราคาสด'};
  const key=market.symbol+':'+market.bars15[market.bars15.length-1].t+':'+c.TRIAL_VERSION;
  const previous=trialPlans_().filter(p=>p.symbol===market.symbol);
  if(previous.some(p=>p.cohort===key))return {status:'SAME_BAR',reason:'แท่งปิดชุดนี้บันทึกทดลองแล้ว'};
  if(previous.some(p=>['PENDING','FILLED'].indexOf(p.status)>=0))return {status:'TRACKING',reason:'รอให้คู่ทดลองก่อนหน้าจบก่อนเริ่มคู่ใหม่'};
  // Prepare and validate BOTH arms before persisting either one.
  const pending=[['BASELINE',baseline],['REVISED',revised]].map(pair=>{
    if(!pair[1].candidates.length)return null;
    const p=JSON.parse(JSON.stringify(pair[1].candidates[0]));
    NitiCore.validatePlan(p,market.price,symbolCfg_(market.symbol,c));
    return Object.assign(p,{id:'TRIAL:'+key+':'+pair[0],cohort:key,trialArm:pair[0],trialVersion:c.TRIAL_VERSION,
      symbol:market.symbol,status:'PENDING',createdAt:now,activationAt:now,expiresAt:now+c.EXPIRY_HOURS*3600000,
      spread:c.SYMBOLS[market.symbol].spread,slippage:c.SYMBOLS[market.symbol].slippage,
      sourceTimezone:market.sourceTimezone,quoteAt:market.quoteAt,quoteAtCreation:market.price,session:session_(now),
      engine:NITI.ENGINE,version:NITI.VERSION,runId:runId,aiCost:0,aiCostStatus:'NOT_CALLED',lastChecked:0,
      trialSettings:symbolCfg_(market.symbol,c),reason:'ทดลอง '+pair[0]+' · อันดับ 1 ตามคะแนน/R:R · '+p.targetSource+' · ไม่ใช่แผนที่ AI เลือก'});
  }).filter(Boolean);
  if(pending.length)saveTrial_(pending,true);
  return {status:pending.length?'RECORDED':'NO_CANDIDATES',cohort:key,arms:pending.map(p=>p.trialArm),reason:'ทั้งสองฝั่งเลือกอันดับ 1 โดยไม่ใช้ AI; แผนและสถิติแยกจากระบบหลัก'};
}
function trialDashboard_(){
  const all=trialPlans_(),symbols={};
  Object.keys(NITI.SYMBOLS).forEach(s=>{
    const plans=all.filter(p=>p.symbol===s&&p.trialVersion===NITI.TRIAL_VERSION);
    const paired={};plans.forEach(p=>{(paired[p.cohort]||(paired[p.cohort]={}))[p.trialArm]=p;});
    const cohorts=Object.keys(paired).map(k=>paired[k]);
    symbols[s]={baseline:NitiCore.stats(plans.filter(p=>p.trialArm==='BASELINE')),revised:NitiCore.stats(plans.filter(p=>p.trialArm==='REVISED')),
      cohorts:cohorts.length,pairedResolved:cohorts.filter(x=>x.BASELINE&&x.REVISED&&['TP','SL'].indexOf(x.BASELINE.status)>=0&&['TP','SL'].indexOf(x.REVISED.status)>=0).length,
      baselineOnly:cohorts.filter(x=>x.BASELINE&&!x.REVISED).length,revisedOnly:cohorts.filter(x=>x.REVISED&&!x.BASELINE).length,
      active:plans.filter(p=>['PENDING','FILLED'].indexOf(p.status)>=0).length};
  });
  return {version:NITI.TRIAL_VERSION,mode:'SHADOW',selection:'RANK_1_NO_AI',symbols:symbols};
}
