/* Telegram presentation helpers. HTML is escaped before using Telegram parse_mode. */
function telegramEsc_(value){return String(value===undefined||value===null?'':value).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));}
function priceDecimals_(symbol,c){const tick=Number(c.SYMBOLS[symbol].tick),text=String(tick);return text.indexOf('.')<0?0:text.length-text.indexOf('.')-1;}
function formatNumber_(value,decimals){
  const parts=Number(value).toFixed(decimals).split('.');
  parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return parts.join('.');
}
function telegramPrice_(symbol,value,c){return formatNumber_(value,priceDecimals_(symbol,c));}
function telegramTrend_(indicator){
  if(!indicator||!indicator.trend)return '—';
  return indicator.trend==='UP'?'▲ ขึ้น':'▼ ลง';
}
function telegramTime_(ms){return Utilities.formatDate(new Date(Number(ms)),NITI.TIMEZONE,'dd/MM/yyyy HH:mm');}
function telegramPlanMessage_(plan,context,ai,c){
  const side=plan.side==='BUY_LIMIT'?'🟢 BUY LIMIT':'🔴 SELL LIMIT';
  const cost=ai.cost===null?'รอยืนยัน':'$'+Number(ai.cost).toFixed(6);
  const reason=telegramEsc_(String(ai.decision.reason||'').slice(0,700));
  const risks=(ai.decision.risks||[]).slice(0,3).map(x=>'• '+telegramEsc_(String(x).slice(0,220))).join('\n');
  const quote=context&&NitiCore.number(context.quote)?' · ราคาอ้างอิง <code>'+telegramPrice_(plan.symbol,context.quote,c)+'</code>':'';
  return [
    '✨ <b>NITI TRADER · PAPER PLAN</b>',
    '<b>'+telegramEsc_(plan.symbol)+'</b>  |  '+side,
    '',
    '🎯 Entry  <code>'+telegramPrice_(plan.symbol,plan.entry,c)+'</code>',
    '✅ TP       <code>'+telegramPrice_(plan.symbol,plan.tp,c)+'</code>',
    '🛡 SL       <code>'+telegramPrice_(plan.symbol,plan.sl,c)+'</code>',
    '📐 Net R:R  <b>'+Number(plan.rr).toFixed(2)+'</b>',
    '',
    '📊 <b>แนวโน้ม</b>',
    'M15 '+telegramTrend_(context&&context.indicators)+'  ·  H1 '+telegramTrend_(context&&context.h1)+'  ·  H4 '+telegramTrend_(context&&context.h4),
    '',
    '🧠 <b>มุมมอง AI</b>',
    '<blockquote>'+reason+'</blockquote>',
    risks?'⚠️ <b>ความเสี่ยง</b>\n'+risks:'',
    '',
    '⏳ หมดอายุ <b>'+telegramTime_(plan.expiresAt)+'</b> น. ไทย'+quote,
    '💳 ค่า AI <b>'+cost+'</b>',
    '',
    '📝 <i>Paper Trading · ยังไม่มีการส่งคำสั่งซื้อขายจริง</i>'
  ].filter(x=>x!=='').join('\n');
}
function telegramEventMessage_(plan,event,c){
  const labels={FILLED:'🟡 ราคาเข้าโซนแล้ว',TP:'✅ ปิดกำไรตาม TP',SL:'🛑 แตะ Stop Loss',EXPIRED:'⌛ แผนหมดอายุ',AMBIGUOUS:'⚠️ ผลจำลองกำกวม'};
  return [
    '<b>NITI TRADER · PAPER UPDATE</b>',
    '<b>'+telegramEsc_(plan.symbol)+'</b>  |  '+telegramEsc_(plan.side.replace('_',' ')),
    '',
    '<b>'+telegramEsc_(labels[event.status]||event.status)+'</b>',
    'Entry <code>'+telegramPrice_(plan.symbol,plan.entry,c)+'</code>  ·  TP <code>'+telegramPrice_(plan.symbol,plan.tp,c)+'</code>  ·  SL <code>'+telegramPrice_(plan.symbol,plan.sl,c)+'</code>',
    '🕒 '+telegramTime_(event.time)+' น. ไทย',
    '<blockquote>'+telegramEsc_(String(event.note||'').slice(0,700))+'</blockquote>',
    '<i>Paper Trading · ไม่มีการส่งคำสั่งซื้อขายจริง</i>'
  ].join('\n');
}
function telegramTestMessage_(){return [
  '✨ <b>NITI TRADER · TELEGRAM READY</b>',
  '',
  '✅ เชื่อมต่อการแจ้งเตือนสำเร็จ',
  '🕒 '+telegramTime_(Date.now())+' น. ไทย',
  '',
  '<blockquote>ข้อความแผนใหม่จะแสดง Entry, TP, SL, R:R, แนวโน้ม M15/H1/H4 และเหตุผลจาก AI ในรูปแบบอ่านง่าย</blockquote>',
  '<i>ข้อความทดสอบ · ไม่ใช่สัญญาณเทรด</i>'
].join('\n');}
function notify_(html,c){
  if(!c.TELEGRAM_BOT_TOKEN||!c.TELEGRAM_CHAT_ID)return false;
  try{
    const payload={chat_id:c.TELEGRAM_CHAT_ID,text:html,parse_mode:'HTML',link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'เปิด Niti Trader',url:'https://niti-trader.ebasswave.chatgpt.site/desk'}]]}};
    const d=fetchJson_('https://api.telegram.org/bot'+c.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'post',contentType:'application/json',payload:JSON.stringify(payload)},'Telegram');
    if(!d.ok)throw new Error('Telegram refused');return true;
  }catch(e){health_('NOTIFICATION_ERROR',e.message);return false;}
}
