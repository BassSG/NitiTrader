/* Pure analysis / time / paper engine. Tested with Node and Apps Script V8. */
var NitiCore = (function () {
  'use strict';
  var formatters={};
  function fail(message) { throw new Error(message); }
  function number(v) { return v !== null && v !== '' && Number.isFinite(Number(v)); }
  function round(v, tick) { return Math.round(v / tick) * tick; }
  function thai(ms) {
    if (!number(ms)) return '';
    if(!formatters.thai)formatters.thai=new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Bangkok', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    return formatters.thai.format(new Date(Number(ms)));
  }
  function parts(ms, zone) {
    var o = {};
    if(!formatters[zone])formatters[zone]=new Intl.DateTimeFormat('en-GB', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    formatters[zone].formatToParts(new Date(ms)).forEach(function(p){o[p.type]=p.value;});
    return o;
  }
  function timestamp(raw, zone) {
    if (number(raw) && /^\d+(\.\d+)?$/.test(String(raw))) return Number(raw) < 1e11 ? Number(raw)*1000 : Number(raw);
    if (typeof raw !== 'string') return fail('ไม่พบเวลาในข้อมูลราคา');
    if (/(Z|[+-]\d\d:\d\d)$/.test(raw)) { var explicit=Date.parse(raw); if (!Number.isFinite(explicit)) fail('รูปแบบเวลาไม่ถูกต้อง'); return explicit; }
    var m=raw.match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)(?::(\d\d))?$/);
    if (!m || !zone) return fail('เวลาต้นทางไม่มีเขตเวลา: ตั้งค่า FMP_TIMEZONE ก่อน');
    var wall=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
    if (zone==='UTC') return wall;
    if (zone==='EST_FIXED') return wall+5*3600000;
    var instant=wall;
    for(var i=0;i<3;i++) {var p=parts(instant,zone); var rendered=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second); instant+=wall-rendered;}
    // DST gaps and repeated local hours cannot be resolved safely without an offset.
    var actual=parts(instant,zone);
    if (+actual.hour!==+m[4] || +actual.day!==+m[3]) fail('เวลาอยู่ในช่องว่าง DST ต้องใช้ timestamp ที่มี offset');
    var alt=parts(instant-3600000,zone), alt2=parts(instant+3600000,zone);
    if ((alt.hour===actual.hour&&alt.day===actual.day)||(alt2.hour===actual.hour&&alt2.day===actual.day)) fail('เวลาซ้ำช่วง DST ต้องใช้ timestamp ที่มี offset');
    return instant;
  }
  function normalize(rows, zone, intervalMs, now) {
    if (!Array.isArray(rows) || !rows.length) fail('API ไม่ส่งแท่งเทียน หรือแพ็กเกจไม่ครอบคลุม endpoint นี้');
    var seen={}, bars=[], naive=false;
    rows.forEach(function(r){
      var raw=r.timestamp!==undefined ? r.timestamp : r.date;
      if (typeof raw==='string'&&!/(Z|[+-]\d\d:\d\d)$/.test(raw)&&!/^\d+$/.test(raw)) naive=true;
      var t=timestamp(raw,zone), b={t:t,o:Number(r.open),h:Number(r.high),l:Number(r.low),c:Number(r.close)};
      if (![b.t,b.o,b.h,b.l,b.c].every(Number.isFinite) || b.l<=0 || b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c)) fail('OHLC ผิดรูปแบบ');
      if (seen[t]) {if (JSON.stringify(seen[t])!==JSON.stringify(b)) fail('แท่งเวลาซ้ำแต่ราคาขัดแย้ง'); return;}
      seen[t]=b; bars.push(b);
    });
    bars.sort(function(a,b){return a.t-b.t;});
    if (bars[bars.length-1].t>now+intervalMs) fail('เวลาต้นทางอยู่ในอนาคต ตรวจ timezone');
    return {bars:bars.filter(function(b){return b.t+intervalMs<=now;}),naive:naive,latest:bars[bars.length-1].t};
  }
  function aggregate(bars, n, intervalMs) {
    var groups={}, out=[];
    bars.forEach(function(b){var key=Math.floor(b.t/(intervalMs*n))*(intervalMs*n);(groups[key]||(groups[key]=[])).push(b);});
    Object.keys(groups).sort(function(a,b){return +a-+b;}).forEach(function(key){var a=groups[key];if(a.length!==n||a[0].t!==+key) return;for(var j=1;j<n;j++)if(a[j].t-a[j-1].t!==intervalMs)return;out.push({t:+key,o:a[0].o,h:Math.max.apply(null,a.map(function(b){return b.h;})),l:Math.min.apply(null,a.map(function(b){return b.l;})),c:a[n-1].c});});
    return out;
  }
  function ema(values,len) {var v=values[0],k=2/(len+1);return values.map(function(x,i){v=i ? x*k+v*(1-k):x;return v;});}
  function rma(values,len) {var out=[],v=0;values.forEach(function(x,i){if(i<len){v+=x;out.push(i===len-1?v/len:null);if(i===len-1)v/=len;}else{v=(v*(len-1)+x)/len;out.push(v);}});return out;}
  function sma(values,len) {return values.map(function(_,i){if(i<len-1)return null;var a=values.slice(i-len+1,i+1);return a.some(function(x){return x===null;})?null:a.reduce(function(s,x){return s+x;},0)/len;});}
  function indicators(bars) {
    if(bars.length<60)fail('ต้องมีอย่างน้อย 60 แท่งปิดเพื่ออุ่นสูตร');
    var c=bars.map(function(b){return b.c;}),tr=bars.map(function(b,i){return i?Math.max(b.h-b.l,Math.abs(b.h-c[i-1]),Math.abs(b.l-c[i-1])):b.h-b.l;});
    var changes=c.slice(1).map(function(v,i){return v-c[i];});
    var up=rma(changes.map(function(x){return Math.max(x,0);}),14).pop(),dn=rma(changes.map(function(x){return Math.max(-x,0);}),14).pop();
    var raw=bars.map(function(b,i){if(i<13)return null;var a=bars.slice(i-13,i+1),lo=Math.min.apply(null,a.map(function(x){return x.l;})),hi=Math.max.apply(null,a.map(function(x){return x.h;}));return hi===lo?50:(b.c-lo)/(hi-lo)*100;});
    var k=sma(raw,3), d=sma(k,3),fast=ema(c,20).pop(),slow=ema(c,50).pop();
    return {atr:rma(tr,14).pop(),rsi:dn===0?(up===0?50:100):100-100/(1+up/dn),k:k.pop(),d:d.pop(),ema20:fast,ema50:slow,trend:fast>slow?'UP':'DOWN'};
  }
  function zones(bars,atr) {
    var out=[],len=3,start=Math.max(len,bars.length-240);
    // Canonical EBW V10.4.4 one-base Supply/Demand: RBR, DBR, RBD, DBD.
    for(var q=Math.max(2,start);q<bars.length;q++){
      var depart=bars[q],base=bars[q-1],approach=bars[q-2];
      var br=Math.max(base.h-base.l,Number.EPSILON),dr=Math.max(depart.h-depart.l,Number.EPSILON);
      var compact=Math.abs(base.c-base.o)/br<=.35,strong=Math.abs(depart.c-depart.o)/dr>=.52;
      var bull=compact&&strong&&depart.c>depart.o&&depart.c>base.h;
      var bear=compact&&strong&&depart.c<depart.o&&depart.c<base.l;
      if(!bull&&!bear)continue;
      var side=bull?1:-1,lo=bull?base.l:Math.min(base.o,base.c),hi=bull?Math.max(base.o,base.c):base.h;
      if(hi-lo<atr*.08){if(side===1)hi=lo+atr*.08;else lo=hi-atr*.08;}
      if(hi-lo>atr*1.6)continue;
      var later=bars.slice(q+1),broken=later.some(function(x){return side===1?x.c<lo-atr*.08:x.c>hi+atr*.08;});
      if(broken)continue;
      var tests=0,touch=false;later.forEach(function(x){var hit=x.l<=hi&&x.h>=lo;if(hit&&!touch)tests++;touch=hit;});
      if(tests>2)continue;
      var pattern=side===1?(approach.c>approach.o?'RBR':'DBR'):(approach.c>approach.o?'RBD':'DBD');
      var departure=side===1?Math.max(0,depart.h-hi)/atr:Math.max(0,lo-depart.l)/atr;
      var quality=Math.max(0,Math.min(1,.38+(1-Math.abs(base.c-base.o)/br)*.38+(departure>=.9?.16:departure>=.6?.10:.04)+(tests===0?.08:0)));
      out.push({id:'ZSD'+base.t+'_'+side,side:side,lo:lo,hi:hi,tests:tests,t:base.t,knownAt:depart.t+900000,type:side===1?'DEMAND':'SUPPLY',family:pattern,quality:quality,departureATR:departure});
    }
    for(var i=start;i<bars.length-len;i++) {
      var b=bars[i], a=bars.slice(i-len,i+len+1), high=a.every(function(x){return b.h>=x.h;}),low=a.every(function(x){return b.l<=x.l;});
      [low?1:0,high?-1:0].forEach(function(side){if(!side)return;
        var lo=side===1?b.l:Math.max(b.o,b.c),hi=side===1?Math.min(b.o,b.c):b.h;
        if(hi-lo<atr*.08){if(side===1)hi=lo+atr*.08;else lo=hi-atr*.08;}
        if(hi-lo>atr*1.6)return;
        var later=bars.slice(i+len+1),broken=later.some(function(x){return side===1?x.c<lo-atr*.08:x.c>hi+atr*.08;});
        if(broken)return;
        var tests=0,touch=false;later.forEach(function(x){var now=x.l<=hi&&x.h>=lo;if(now&&!touch)tests++;touch=now;});
        if(tests>2)return;
        out.push({id:'ZP'+b.t+'_'+side,side:side,lo:lo,hi:hi,tests:tests,t:b.t,knownAt:bars[i+len].t+900000,type:side===1?'DEMAND':'SUPPLY',family:'PIVOT',quality:.58,departureATR:0});
      });
    }return out;
  }
  function confirmedSwings(bars) {
    var out=[],n=3;
    for(var i=Math.max(n,bars.length-240);i<bars.length-n;i++){
      var b=bars[i],window=bars.slice(i-n,i+n+1),later=bars.slice(i+n+1);
      if(window.every(function(x){return x.h<=b.h;})&&window.some(function(x){return x.h<b.h;})&&!later.some(function(x){return x.h>b.h;}))out.push({price:b.h,side:1,knownAt:bars[i+n].t+900000});
      if(window.every(function(x){return x.l>=b.l;})&&window.some(function(x){return x.l>b.l;})&&!later.some(function(x){return x.l<b.l;}))out.push({price:b.l,side:-1,knownAt:bars[i+n].t+900000});
    }
    return out;
  }
  function directionEvidence(side,z,bars,ind,h1,h4){
    var same=side===1?'UP':'DOWN',higher=[h1,h4].filter(Boolean);
    var regime=!higher.length?'UNKNOWN':higher.every(function(x){return x.trend===same;})?'WITH_TREND':higher.every(function(x){return x.trend!==same;})?'COUNTER_TREND':'MIXED';
    var last=bars[bars.length-1],prev=bars[bars.length-2];
    var reclaim=bars.slice(-3).some(function(b){return side===1?b.l<z.lo&&b.c>z.hi:b.h>z.hi&&b.c<z.lo;});
    var breakClose=side===1?last.c>prev.h&&last.c>last.o:last.c<prev.l&&last.c<last.o;
    var momentum=number(ind.k)&&number(ind.d)&&(side===1?ind.k>ind.d:ind.k<ind.d);
    return {regime:regime,reversalConfirmed:reclaim&&breakClose&&momentum,sweepAndReclaim:reclaim,closeBreak:breakClose,stochDirection:momentum};
  }
  function candidates(bars,quote,cfg,now) {
    var ind=indicators(bars),hour=aggregate(bars,4,900000),four=Array.isArray(cfg.h4Bars)&&cfg.h4Bars.length?cfg.h4Bars:aggregate(bars,16,900000);
    var h1=hour.length>=60?indicators(hour):null,h4=four.length>=60?indicators(four):null;
    var zs=zones(bars,ind.atr),plans=[],rejectedCounts={},rejectedSamples=[];
    var funnel={zones:zs.length,entry:0,risk:0,target:0,rr:0,score:0,direction:0,selected:0};
    var swings=cfg.experimental?confirmedSwings(bars):[];
    function reject(reason,z){rejectedCounts[reason]=(rejectedCounts[reason]||0)+1;if(rejectedSamples.length<12)rejectedSamples.push({candidateId:z.id,type:z.type,family:z.family,reason:reason});}
    zs.forEach(function(z){
      var side=z.side,depth=z.family==='PIVOT'?.25:z.tests===0?(z.quality>=.78?.33:.45):.52;
      var entry=round(side===1?z.hi-(z.hi-z.lo)*depth:z.lo+(z.hi-z.lo)*depth,cfg.tick);
      var dist=(quote-entry)*side;
      if(dist<Math.max(cfg.tick*2,cfg.spread)){reject('Entry อยู่ใกล้ราคาเกินไปหรืออยู่ผิดฝั่ง',z);return;}
      if(dist>ind.atr*(number(cfg.maxEntryATR)?Number(cfg.maxEntryATR):3)){reject('โซนอยู่ไกลเกิน ATR '+(number(cfg.maxEntryATR)?Number(cfg.maxEntryATR):3),z);return;}
      funnel.entry++;
      var stop=round(side===1?z.lo-ind.atr*.25:z.hi+ind.atr*.25,cfg.tick),risk=Math.abs(entry-stop);
      if(risk<ind.atr*(number(cfg.minRiskATR)?Number(cfg.minRiskATR):.35)){reject('ระยะ SL สั้นกว่า ATR ขั้นต่ำ',z);return;}
      if(risk>ind.atr*(number(cfg.maxRiskATR)?Number(cfg.maxRiskATR):2.5)){reject('ระยะ SL กว้างกว่า ATR สูงสุด',z);return;}
      funnel.risk++;
      var obstacles=zs.filter(function(x){return x.side===-side;}).map(function(x){return side===1?x.lo:x.hi;}).filter(function(x){return (x-entry)*side>0;}).sort(function(a,b){return side*(a-b);});
      var targetSource='OPPOSING_ZONE';
      if(!obstacles.length&&cfg.experimental){
        obstacles=swings.filter(function(x){return x.side===side&&x.knownAt<=now&&(x.price-entry)*side>0;}).map(function(x){return x.price;}).sort(function(a,b){return side*(a-b);});
        targetSource='CONFIRMED_SWING';
      }
      if(!obstacles.length){reject('ไม่มีโซนฝั่งตรงข้ามสำหรับวาง TP',z);return;}
      funnel.target++;
      var tp=round(entry+side*Math.min(risk*2.2,Math.abs(obstacles[0]-entry)-ind.atr*(number(cfg.tpBufferATR)?Number(cfg.tpBufferATR):.10)),cfg.tick);
      var rr=(Math.abs(tp-entry)-cfg.spread-cfg.slippage)/(risk+cfg.spread+cfg.slippage);
      if((tp-entry)*side<=0){reject('พื้นที่ถึง TP ไม่พอหลังหักระยะกันชน',z);return;}
      if(rr<cfg.minRR){reject('Net R:R ต่ำกว่า '+cfg.minRR,z);return;}
      funnel.rr++;
      var same=side===1?'UP':'DOWN',score;
      // Evidence score is deterministic ranking, never a win probability.
      score=35+Math.round((z.quality||.5)*15)+(ind.trend===same?10:0)+(h1&&h1.trend===same?15:0)+(h4&&h4.trend===same?10:0)+(z.tests===0?10:0)+((side===1?ind.rsi<65:ind.rsi>35)?5:0);
      if(score<cfg.minScore){reject('คะแนนหลักฐานต่ำกว่า '+cfg.minScore,z);return;}
      funnel.score++;
      var evidence=directionEvidence(side,z,bars,ind,h1,h4);
      if(cfg.experimental&&evidence.regime==='COUNTER_TREND'&&!evidence.reversalConfirmed){reject('สวนเทรนด์: ยังไม่ครบ sweep/reclaim + ปิดทะลุแท่งก่อน + Stoch สนับสนุน',z);return;}
      funnel.direction++;
      plans.push({candidateId:z.id,side:side===1?'BUY_LIMIT':'SELL_LIMIT',entry:entry,sl:stop,tp:tp,rr:rr,score:score,zone:z,targetSource:targetSource,targetReference:obstacles[0],directionEvidence:evidence,setup:z.family==='PIVOT'?'PIVOT_ZONE_PULLBACK':'EBW_SD_'+z.family,createdAt:now,expiresAt:now+cfg.expiryHours*3600000});
    });
    plans.sort(function(a,b){return b.score-a.score||b.rr-a.rr;});
    var selected=plans.slice(0,6);
    funnel.selected=selected.length;
    return {indicators:ind,h1:h1,h4:h4,zones:zs,candidates:selected,coverage:{m15:bars.length,h1:hour.length,h4:four.length,h4Source:Array.isArray(cfg.h4Bars)&&cfg.h4Bars.length?(cfg.h4Source||'EXTERNAL'):'M15_AGGREGATED'},candidateAudit:{zonesFound:zs.length,candidatesBeforeLimit:plans.length,candidatesReturned:selected.length,funnel:funnel,rejectedCounts:rejectedCounts,rejectedSamples:rejectedSamples}};
  }
  function validatePlan(p,quote,cfg) {
    if(!p||![p.entry,p.sl,p.tp,p.expiresAt].every(number))fail('แผนมีตัวเลขไม่ครบ');
    if(p.side==='BUY_LIMIT'&&!(p.sl<p.entry&&p.entry<p.tp&&p.entry<quote))fail('ลำดับราคา BUY LIMIT ไม่ถูกต้อง');
    if(p.side==='SELL_LIMIT'&&!(p.tp<p.entry&&p.entry<p.sl&&p.entry>quote))fail('ลำดับราคา SELL LIMIT ไม่ถูกต้อง');
    if(['BUY_LIMIT','SELL_LIMIT'].indexOf(p.side)<0)fail('รองรับเฉพาะ Limit');
    var rr=(Math.abs(p.tp-p.entry)-cfg.spread-cfg.slippage)/(Math.abs(p.entry-p.sl)+cfg.spread+cfg.slippage);
    if(rr<cfg.minRR)fail('R:R สุทธิไม่ผ่าน');return true;
  }
  function paper(plan,bars,intervalMs,now,options) {
    var p=JSON.parse(JSON.stringify(plan)),events=[],opts=options||{},startAt=p.activationAt||p.createdAt;
    if(['PENDING','FILLED'].indexOf(p.status)<0)return {plan:p,events:events};
    var side=p.side==='BUY_LIMIT'?1:-1;
    function closedAt(t){return typeof opts.isMarketClosedAt==='function'&&opts.isMarketClosedAt(t);}
    function gapClosed(start,end){
      if(typeof opts.isMarketClosedAt!=='function')return false;
      for(var t=start;t<end;t+=intervalMs)if(!closedAt(t))return false;
      return true;
    }
    function event(status,t,note){p.status=status;events.push({status:status,time:t,note:note});if(['TP','SL','AMBIGUOUS','EXPIRED'].indexOf(status)>=0)p.closedAt=t;}
    if(p.status==='PENDING'&&p.expiresAt&&now>=p.expiresAt&&((p.lastChecked||0)>=p.expiresAt||closedAt(p.expiresAt))){event('EXPIRED',p.expiresAt,'หมดอายุระหว่างช่วงตลาดปิดหรือไม่มีแท่งใหม่ที่ต้องตรวจ');return {plan:p,events:events};}
    for(var i=0;i<bars.length;i++) {
      var b=bars[i];if(b.t+intervalMs<=startAt||b.t<=(p.lastChecked||0)||b.t+intervalMs>now)continue;
      var expected=p.lastChecked?p.lastChecked+intervalMs:Math.floor(startAt/intervalMs)*intervalMs;
      if(b.t>expected){
        if(p.status==='PENDING'&&b.t>=p.expiresAt&&gapClosed(expected,b.t)){event('EXPIRED',p.expiresAt,'หมดอายุระหว่างช่วงตลาดปิด');break;}
        if(gapClosed(expected,b.t)){expected=b.t;}
        else if(p.marketClosedAtCreation&&!p.marketGapConsumed){p.marketGapConsumed=true;expected=b.t;}
        else{event('AMBIGUOUS',b.t+intervalMs,'DATA GAP: ขาดแท่งระหว่างติดตาม ไม่อนุมานว่าไม่แตะ Entry/SL/TP');break;}
      }
      if(b.t<startAt){
        if(side===1?b.l<=p.entry:b.h>=p.entry){event('AMBIGUOUS',b.t+intervalMs,'แท่งคร่อมเวลาเริ่มติดตาม ไม่ทราบว่าแตะ Entry ก่อนหรือหลังเริ่มแผน');break;}
        p.lastChecked=b.t;continue;
      }
      if(p.status==='PENDING'&&b.t>=p.expiresAt){event('EXPIRED',p.expiresAt,'หมดอายุก่อนเข้า');break;}
      if(p.status==='PENDING'&&b.t+intervalMs>p.expiresAt){event('AMBIGUOUS',p.expiresAt,'แท่งคร่อมเวลาหมดอายุ ระบุลำดับไม่ได้');break;}
      var fresh=false,atOpen=false;
      // Reference OHLC, not broker bid/ask. Deduct stored round-trip cost ONCE in resultR.
      if(p.status==='PENDING') {
        var entryTouch=side===1?b.l<=p.entry:b.h>=p.entry;
        if(entryTouch){
          if(side===1?b.h<p.entry:b.l>p.entry){event('AMBIGUOUS',b.t+intervalMs,'ราคา gap เลย Entry ทั้งแท่ง ไม่ทราบราคา fill');break;}
          atOpen=side===1?b.o<=p.entry:b.o>=p.entry;event('FILLED',b.t+intervalMs,'จำลองจาก reference OHLC; เวลาเป็นเวลาปิดแท่งตรวจพบ');p.filledAt=b.t+intervalMs;fresh=true;
        }
      }
      if(p.status==='FILLED') {
        var stop=side===1?b.l<=p.sl:b.h>=p.sl;
        var target=side===1?b.h>=p.tp:b.l<=p.tp;
        if(stop&&target || fresh&&!atOpen&&(stop||target)){event('AMBIGUOUS',b.t+intervalMs,'ไม่ทราบลำดับ Entry/SL/TP ในแท่งเดียว');break;}
        if(stop||target){
          var exit=stop?(side===1?Math.min(p.sl,b.o):Math.max(p.sl,b.o)):p.tp;
          var risk=Math.abs(p.entry-p.sl)+(p.spread||0)+(p.slippage||0);
          p.resultR=(side*(exit-p.entry)-(p.spread||0)-(p.slippage||0))/risk;
          event(stop?'SL':'TP',b.t+intervalMs,'Paper reference OHLC หัก spread/slippage allowance หนึ่งครั้ง ไม่ใช่ผลโบรกเกอร์');break;
        }
      }p.lastChecked=b.t;
    }
    return {plan:p,events:events};
  }
  function stats(plans) {
    var resolved=plans.filter(function(p){return ['TP','SL'].indexOf(p.status)>=0&&number(p.resultR);}).sort(function(a,b){return a.closedAt-b.closedAt;});
    var wins=resolved.filter(function(p){return p.resultR>0;}).length,net=0,peak=0,dd=0,gain=0,loss=0;
    resolved.forEach(function(p){var r=Number(p.resultR);net+=r;peak=Math.max(peak,net);dd=Math.max(dd,peak-net);if(r>0)gain+=r;else loss-=r;});
    var groups={};resolved.forEach(function(p){var key=p.symbol+' | '+p.setup+' | '+p.session;var g=groups[key]||(groups[key]={key:key,n:0,wins:0,r:0});g.n++;g.wins+=p.resultR>0?1:0;g.r+=Number(p.resultR);});
    return {total:plans.length,resolved:resolved.length,wins:wins,losses:resolved.length-wins,winRate:resolved.length?wins/resolved.length:null,netR:net,avgR:resolved.length?net/resolved.length:null,maxDrawdownR:dd,profitFactor:loss?gain/loss:null,ambiguous:plans.filter(function(p){return p.status==='AMBIGUOUS';}).length,filled:plans.filter(function(p){return !!p.filledAt;}).length,groups:Object.keys(groups).map(function(k){return groups[k];})};
  }
  return {timestamp:timestamp,thai:thai,normalize:normalize,aggregate:aggregate,indicators:indicators,zones:zones,confirmedSwings:confirmedSwings,candidates:candidates,validatePlan:validatePlan,paper:paper,stats:stats,number:number};
})();
