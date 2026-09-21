(function () {
  'use strict';

  var dashboard = null;
  var nativeFetch = window.fetch.bind(window);
  var symbolsWithFiveDecimals = { EURUSD: true, AUDUSD: true };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function selectedSymbol() {
    var button = document.querySelector('.market.selected b');
    return button ? button.textContent.trim() : 'XAUUSD';
  }

  function contextFor(symbol) {
    return dashboard && dashboard.contexts && dashboard.contexts[symbol]
      ? dashboard.contexts[symbol]
      : dashboard && dashboard.context && dashboard.context.symbol === symbol
        ? dashboard.context
        : null;
  }

  function planFor(symbol) {
    return dashboard && Array.isArray(dashboard.plans)
      ? dashboard.plans.find(function (plan) { return plan.symbol === symbol && ['PENDING', 'FILLED'].indexOf(plan.status) >= 0; })
      : null;
  }

  function thaiMs(value) {
    if (!value) return NaN;
    var parsed = new Date(String(value).replace(' ', 'T') + '+07:00').getTime();
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function fmt(value, decimals) {
    if (value == null || value === '') return '—';
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmtThai(value) {
    if (!Number.isFinite(value)) return '—';
    return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  function analysisTone(result) {
    var status = String(result && result.status || '').toUpperCase();
    if ((status === 'PLAN' || status === 'PLAN_CLOSED') && result && result.plan) return 'success';
    if (status === 'WAIT' || status === 'EXISTING_PLAN' || status === 'MARKET_CLOSED') return 'wait';
    return 'error';
  }

  function resultLevel(label, value, digits, className) {
    return '<div class="niti-result-level ' + (className || '') + '"><span>' + esc(label) + '</span><b>' + esc(fmt(value, digits)) + '</b></div>';
  }

  function showAnalysisResult(result, usdFormatter) {
    var dialog = document.getElementById('resultDialog');
    var title = document.getElementById('resultTitle');
    var message = document.getElementById('resultMessage');
    if (!dialog || !title || !message) return;
    var tone = analysisTone(result), plan = result && result.plan, symbol = result && result.symbol || selectedSymbol();
    var digits = symbolsWithFiveDecimals[symbol] ? 5 : 2;
    var cost = typeof usdFormatter === 'function' ? usdFormatter(result) : 'ไม่ทราบค่าใช้จ่าย';
    var reason = esc(result && result.reason || 'ไม่มีรายละเอียดจากระบบ');
    var signal = document.getElementById('nitiResultSignal');
    if (!signal) {
      signal = document.createElement('div');
      signal.id = 'nitiResultSignal';
      dialog.insertBefore(signal, title);
    }
    dialog.className = 'niti-result-dialog niti-' + tone;
    signal.className = 'niti-result-signal';
    if (tone === 'success') {
      signal.innerHTML = '<span class="niti-result-icon">✓</span><span><b>LIMIT SETUP READY</b><small>เงื่อนไขผ่าน · พร้อมติดตามแบบ Paper</small></span>';
      title.textContent = result.status === 'PLAN_CLOSED' ? 'ผ่าน — วางแผนรอเปิดตลาด' : 'ผ่าน — พบแผนที่เข้าได้';
      message.innerHTML = '<div class="niti-result-symbol">' + esc(symbol) + ' · ' + esc(plan.side === 'BUY_LIMIT' ? 'BUY LIMIT' : 'SELL LIMIT') + '</div><div class="niti-result-levels">' +
        resultLevel('ENTRY', plan.entry, digits, 'entry') + resultLevel('TAKE PROFIT', plan.tp, digits, 'tp') + resultLevel('STOP LOSS', plan.sl, digits, 'sl') +
        '</div><p class="niti-result-reason">' + reason + '</p><div class="niti-result-cost">ค่า AI รอบนี้ <b>' + esc(cost) + '</b></div>';
    } else if (tone === 'wait') {
      signal.innerHTML = '<span class="niti-result-icon">⌁</span><span><b>NO TRADE YET</b><small>ระบบยังไม่อนุมัติการเข้าออเดอร์</small></span>';
      title.textContent = 'ยังไม่ผ่าน — รอจังหวะที่ชัดเจน';
      message.innerHTML = '<div class="niti-result-symbol">' + esc(symbol) + ' · WAIT</div><p class="niti-result-reason">' + reason + '</p><div class="niti-result-cost">ค่า AI รอบนี้ <b>' + esc(cost) + '</b></div>';
    } else {
      signal.innerHTML = '<span class="niti-result-icon">!</span><span><b>CHECK REQUIRED</b><small>ระบบยังออกผลเทรดไม่ได้</small></span>';
      title.textContent = 'ไม่ผ่าน — ต้องตรวจสอบก่อน';
      message.innerHTML = '<div class="niti-result-symbol">' + esc(symbol) + ' · ERROR</div><p class="niti-result-reason">' + reason + '</p><div class="niti-result-cost">ค่า AI รอบนี้ <b>' + esc(cost) + '</b></div>';
    }
    var close = document.getElementById('closeResult');
    if (close) close.textContent = tone === 'success' ? 'ดูแผนบนหน้าจอ' : 'รับทราบ';
    if (!dialog.open) dialog.showModal();
  }

  window.nitiShowAnalysisResult = showAnalysisResult;

  function renderAudit(context) {
    var active = document.getElementById('activePlan');
    if (!active) return;
    var card = document.getElementById('candidateAudit');
    if (!card) {
      card = document.createElement('div');
      card.id = 'candidateAudit';
      card.className = 'info';
      active.parentElement.appendChild(card);
    }
    var audit = context && context.candidateAudit;
    if (!audit) {
      card.innerHTML = '<span class="gold">รายละเอียดการคัดโซน</span><br><span>กดวิเคราะห์เพื่อสร้างข้อมูลตรวจสอบ</span>';
      return;
    }
    var counts = audit.rejectedCounts || {};
    var reasons = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var labels = {zones:'พบโซน',entry:'ผ่านระยะเข้า',risk:'ผ่าน SL',target:'มีเป้า TP',rr:'ผ่าน R:R',score:'ผ่านคะแนน',direction:'ผ่านทิศทาง',selected:'ส่งคัดเลือก'};
    function funnel(value) {
      if (!value || !value.funnel) return '';
      return '<ol class="niti-funnel">' + Object.keys(labels).map(function (key) {
        return '<li><span>' + labels[key] + '</span><b>' + esc(value.funnel[key]) + '</b></li>';
      }).join('') + '</ol>';
    }
    var outcome = context.outcome;
    var result = outcome ? '<p>ผลรอบนี้: <b>' + esc(outcome.status) + '</b> · ' + esc(outcome.reason) + '<br>AI: ' + (outcome.aiDecision ? esc(outcome.aiDecision) : outcome.aiCalled ? 'เรียกแล้ว' : 'ไม่ได้เลือกแผน') + '</p>' : '';
    card.innerHTML = '<span class="gold">รายละเอียดการคัดโซน</span><br>' +
      '<span>พบโซน ' + esc(audit.zonesFound || 0) + ' · เหลือ Candidate ' + esc(audit.candidatesReturned || 0) + '</span>' +
      funnel(audit) + result +
      (reasons.length ? '<details><summary>เหตุผลที่ตัดออกทั้งหมด</summary><ul>' + reasons.map(function (reason) { return '<li>' + esc(reason) + ' (' + esc(counts[reason]) + ')</li>'; }).join('') + '</ul><p>นับเหตุผลแรกที่แต่ละโซนไม่ผ่าน</p></details>' : '');
    var comparison = context.comparison;
    if (comparison) {
      var trial = dashboard && dashboard.trials;
      var stats = trial && trial.symbols && trial.symbols[context.symbol];
      var revisedReasons = comparison.revised.rejectedCounts || {};
      var body = '<details class="niti-trial" open><summary>ทดลอง Balanced ใหม่ · ยังไม่แทนระบบหลัก</summary>' +
        '<p>ข้อมูลราคาเดียวกัน · Score และ R:R เท่ากัน · ทั้งสองฝั่งทดลองเลือกอันดับ 1 โดยไม่ใช้ AI และไม่แจ้งเป็นออเดอร์</p>' +
        '<p>เดิมผ่าน ' + esc(comparison.baseline.candidatesBeforeLimit) + ' โซน · ใหม่ผ่าน ' + esc(comparison.revised.candidatesBeforeLimit) + ' โซน</p>' + funnel(comparison.revised) +
        '<p>กติกาใหม่: สวนเทรนด์ H1/H4 ต้องยืนยันกลับตัว; ใช้ Swing ยืนยันแล้วเป็นเป้าสำรองเมื่อไม่มีโซนตรงข้าม</p>' +
        '<p>' + esc(comparison.tracking && comparison.tracking.reason || 'ยังไม่ได้เริ่มติดตาม') + '</p>';
      if (Object.keys(revisedReasons).length) body += '<details><summary>เหตุผลของกติกาใหม่</summary><ul>' + Object.keys(revisedReasons).map(function (r) { return '<li>' + esc(r) + ' (' + esc(revisedReasons[r]) + ')</li>'; }).join('') + '</ul></details>';
      if (stats) {
        body += '<div class="niti-table"><table><caption>ผล Paper ทดลองสะสมของ ' + esc(context.symbol) + '</caption><thead><tr><th>กติกา</th><th>แผน</th><th>ปิดแล้ว</th><th>ชนะ / แพ้</th><th>R รวม</th><th>กำกวม</th></tr></thead><tbody>' +
          [['เดิม',stats.baseline],['ใหม่',stats.revised]].map(function (pair) { var s=pair[1];return '<tr><th>' + pair[0] + '</th><td>' + esc(s.total) + '</td><td>' + esc(s.resolved) + '</td><td>' + esc(s.wins) + ' / ' + esc(s.losses) + '</td><td>' + fmt(s.netR,2) + '</td><td>' + esc(s.ambiguous) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<p>คู่ที่ปิดครบทั้งสองฝั่ง ' + esc(stats.pairedResolved) + ' · ผ่านเฉพาะเดิม ' + esc(stats.baselineOnly) + ' · ผ่านเฉพาะใหม่ ' + esc(stats.revisedOnly) + '</p>' +
          '<p>แยกจากสถิติหลัก; ผลยังไม่ใช่ข้อสรุปว่ากติกาไหนดีกว่า เพราะจำนวนแผนและแผนที่ยังไม่จบอาจต่างกัน</p>';
      }
      var candidates = comparison.revisedCandidates || [];
      if (candidates.length) body += '<details><summary>ดูแผนที่ผ่านกติกาทดลอง (' + candidates.length + ')</summary><ul>' + candidates.map(function (p) {
        var d=symbolsWithFiveDecimals[context.symbol]?5:2;
        return '<li>' + esc(p.side) + ' · Entry ' + fmt(p.entry,d) + ' · SL ' + fmt(p.sl,d) + ' · TP ' + fmt(p.tp,d) + ' · R:R ' + fmt(p.rr,2) + ' · ' + (p.targetSource==='CONFIRMED_SWING'?'เป้าจาก Swing':'เป้าจากโซน') + '</li>';
      }).join('') + '</ul></details>';
      card.innerHTML += body + '</details>';
    }
    if (context.trialError || dashboard && dashboard.trials && dashboard.trials.error) card.innerHTML += '<p role="status">ส่วนทดลองมีปัญหา: ' + esc(context.trialError || dashboard.trials.error) + '</p>';
  }

  function drawContextChart(context, plan) {
    var canvas = document.getElementById('chart');
    if (!canvas || !context || !Array.isArray(context.closedBars) || !context.closedBars.length) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    var g = canvas.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    var width = rect.width, height = rect.height;
    var bars = context.closedBars.slice(-70).map(function (bar) {
      return { t: thaiMs(bar.timeThai), o: Number(bar.open), h: Number(bar.high), l: Number(bar.low), c: Number(bar.close) };
    }).filter(function (bar) { return Number.isFinite(bar.t) && [bar.o, bar.h, bar.l, bar.c].every(Number.isFinite); });
    if (!bars.length) return;
    var values = [];
    bars.forEach(function (bar) { values.push(bar.l, bar.h); });
    if (plan) values.push(Number(plan.entry), Number(plan.sl), Number(plan.tp));
    var low = Math.min.apply(null, values), high = Math.max.apply(null, values), range = high - low || 1;
    low -= range * .12;
    high += range * .10;
    var y = function (value) { return height - 28 - (value - low) / (high - low) * (height - 42); };
    g.clearRect(0, 0, width, height);
    g.font = '10px Manrope';
    for (var i = 0; i < 5; i += 1) {
      var value = low + (high - low) * i / 4, yy = y(value);
      g.strokeStyle = '#23353f';
      g.beginPath(); g.moveTo(8, yy); g.lineTo(width - 65, yy); g.stroke();
      g.fillStyle = '#8ba0ae'; g.fillText(fmt(value, symbolsWithFiveDecimals[context.symbol] ? 4 : 1), width - 60, yy + 3);
    }
    if (plan) [[plan.entry, '#dfbd7b', 'ENTRY'], [plan.tp, '#6cdec1', 'TP'], [plan.sl, '#ff8d8d', 'SL']].forEach(function (line) {
      g.strokeStyle = line[1]; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(8, y(line[0])); g.lineTo(width - 65, y(line[0])); g.stroke(); g.setLineDash([]); g.fillStyle = line[1]; g.fillText(line[2], 12, y(line[0]) - 5);
    });
    var dx = (width - 80) / bars.length;
    bars.forEach(function (bar, index) {
      var x = 12 + index * dx + dx / 2;
      g.strokeStyle = g.fillStyle = bar.c >= bar.o ? '#6cdec1' : '#e58187';
      g.beginPath(); g.moveTo(x, y(bar.h)); g.lineTo(x, y(bar.l)); g.stroke();
      g.fillRect(x - dx * .26, Math.min(y(bar.o), y(bar.c)), Math.max(2, dx * .52), Math.max(1, Math.abs(y(bar.o) - y(bar.c))));
      if (index % Math.ceil(bars.length / 5) === 0) {
        g.fillStyle = '#8095a4';
        g.fillText(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(new Date(bar.t)), x - 8, height - 6);
      }
    });
  }

  function renderContext() {
    if (typeof demo !== 'undefined' && demo) { var trialCard=document.getElementById('candidateAudit');if(trialCard)trialCard.remove();return; }
    var symbol = selectedSymbol(), context = contextFor(symbol);
    if (!context) { renderAudit(null);return; }
    var indicator = context.indicators || {}, indicatorHost = document.getElementById('indicators');
    if (indicatorHost) {
      var h4Label=context.h4&&context.h4.trend||'ข้อมูลไม่พอ ('+esc(context.coverage&&context.coverage.h4||0)+'/60)';
      var readings = [['RSI (14)', fmt(indicator.rsi, 1)], ['Stoch K / D', fmt(indicator.k, 0) + ' / ' + fmt(indicator.d, 0)], ['ATR (14)', fmt(indicator.atr, symbolsWithFiveDecimals[symbol] ? 5 : 2)], ['M15 TREND', indicator.trend || '—'], ['H1 TREND', context.h1 && context.h1.trend || 'ข้อมูลไม่พอ'], ['H4 TREND', h4Label]];
      indicatorHost.innerHTML = readings.map(function (item) { return '<div><span>' + esc(item[0]) + '</span><b>' + esc(item[1]) + '</b></div>'; }).join('');
    }
    var quote = document.getElementById('quotePrice'), quoteTime = document.getElementById('quoteTime');
    if (quote) quote.textContent = fmt(context.quote, symbolsWithFiveDecimals[symbol] ? 5 : 2);
    if (quoteTime) quoteTime.textContent = context.quoteThai ? 'ราคา ณ ' + fmtThai(thaiMs(context.quoteThai)) : 'ราคาอ้างอิงจากรอบวิเคราะห์';
    var badge = document.getElementById('dataBadge'), source = document.getElementById('chartSource');
    if (badge) badge.textContent = context.closedBars && context.closedBars.length ? 'SNAPSHOT' : 'รอข้อมูล';
    if (source) source.textContent = context.closedBars && context.closedBars.length ? 'FMP · ข้อมูล ณ เวลาประมวลผล' : 'FMP · รอตรวจการเชื่อมต่อ';
    var empty = document.getElementById('chartEmpty');
    if (empty && context.closedBars && context.closedBars.length) empty.classList.add('hidden');
    drawContextChart(context, planFor(symbol));
    renderAudit(context);
  }

  function readDashboard() {
    return nativeFetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: 'getDashboard', args: [] }) })
      .then(function (response) { return response.json(); })
      .then(function (payload) { if (payload && payload.data) { dashboard = payload.data; renderContext(); } })
      .catch(function () {});
  }

  window.fetch = function (input, init) {
    return nativeFetch(input, init).then(function (response) {
      var url = typeof input === 'string' ? input : input && input.url || '';
      if (url.indexOf('/api/rpc') >= 0) response.clone().json().then(function (payload) {
        if (payload && payload.data && payload.data.contexts) { dashboard = payload.data; renderContext(); }
      }).catch(function () {});
      return response;
    });
  };

  function start() {
    var style=document.createElement('style');
    style.textContent='.niti-funnel{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;padding:0;list-style:none;margin:14px 0}.niti-funnel li{background:#12242b;border:1px solid #29404b;border-radius:8px;padding:10px;display:flex;flex-direction:column;font-size:14px}.niti-funnel b{font-size:20px;color:#dfbf76}.niti-trial{margin-top:18px;border-top:1px solid #29404b;padding-top:14px}.niti-trial summary{cursor:pointer;color:#dfbf76;font-size:16px}.niti-trial p,#candidateAudit p{font-size:14px;line-height:1.7}.niti-table{overflow-x:auto}.niti-table table{width:100%;font-size:14px;border-collapse:collapse}.niti-table th,.niti-table td{padding:8px;text-align:left;border-bottom:1px solid #29404b}.niti-table caption{text-align:left;padding:8px 0}#candidateAudit details li{font-size:14px;line-height:1.8}';
    document.head.appendChild(style);
    var resultStyle=document.createElement('style');
    resultStyle.textContent='.niti-result-dialog{width:min(520px,calc(100vw - 28px));padding:25px;border-radius:20px;background:#101d25;color:#edf3f5;box-shadow:0 24px 80px #000b}.niti-result-dialog.niti-success{border:1px solid #55cdb0;background:linear-gradient(145deg,#112a2a,#111e26 62%)}.niti-result-dialog.niti-wait{border:1px solid #c39b54;background:linear-gradient(145deg,#2b2518,#111e26 62%)}.niti-result-dialog.niti-error{border:1px solid #e07880;background:linear-gradient(145deg,#321d28,#111e26 62%)}.niti-result-dialog h2{margin:14px 0 10px;font-size:23px;letter-spacing:-.3px}.niti-result-signal{display:flex;align-items:center;gap:12px;text-transform:uppercase;letter-spacing:1.4px;font-size:11px}.niti-result-signal b{display:block}.niti-result-signal small{display:block;margin-top:3px;color:#9eb1ba;text-transform:none;letter-spacing:0;font-size:13px}.niti-success .niti-result-signal{color:#72e0c2}.niti-wait .niti-result-signal{color:#e6c57c}.niti-error .niti-result-signal{color:#ff9b9f}.niti-result-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;font-size:24px;font-weight:800;background:#ffffff0d;border:1px solid currentColor}.niti-result-symbol{font-size:15px;color:#e6c57c;font-weight:700;margin-bottom:12px}.niti-result-levels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 15px}.niti-result-level{padding:10px;border:1px solid #2a424d;border-radius:10px;background:#0b171e}.niti-result-level span{display:block;color:#9eb1ba;font-size:10px;letter-spacing:.7px}.niti-result-level b{display:block;margin-top:3px;font-size:16px}.niti-result-level.entry{border-color:#a38852}.niti-result-level.entry b{color:#e6c57c}.niti-result-level.tp b{color:#72e0c2}.niti-result-level.sl b{color:#ff9b9f}.niti-result-reason{color:#c3d0d5;font-size:14px;line-height:1.75;margin:12px 0}.niti-result-cost{padding:10px 12px;border-radius:9px;background:#0b171e;color:#91a4b1;font-size:12px}.niti-result-cost b{color:#edf3f5}.niti-result-dialog .dialog-actions{margin-top:20px}.niti-result-dialog .dialog-actions .btn{min-height:42px}@media(max-width:520px){.niti-result-dialog{padding:21px}.niti-result-levels{grid-template-columns:1fr}.niti-result-level{display:flex;justify-content:space-between;align-items:center}.niti-result-level span{font-size:11px}.niti-result-level b{margin-top:0}}';
    document.head.appendChild(resultStyle);
    document.addEventListener('click', function () { window.setTimeout(renderContext, 0); }, true);
    window.addEventListener('resize', renderContext);
    readDashboard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
