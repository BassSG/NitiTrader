import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let request;
const context={
  NITI:{TIMEZONE:'Asia/Bangkok'},
  NitiCore:{number:value=>value!==null&&value!==''&&Number.isFinite(Number(value))},
  Utilities:{formatDate:()=> '21/09/2026 05:48'},
  fetchJson_:(url,options)=>{request={url,body:JSON.parse(options.payload)};return {ok:true};},
  health_:()=>{},Date,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../backend/gas/Telegram.gs',import.meta.url),'utf8'),context);
const c={TELEGRAM_BOT_TOKEN:'secret',TELEGRAM_CHAT_ID:'123',SYMBOLS:{BTCUSD:{tick:.01}}};
const plan={symbol:'BTCUSD',side:'BUY_LIMIT',entry:81103.90000000001,tp:81346.11,sl:80962.74,rr:1.31,expiresAt:1};
const market={quote:81200,indicators:{trend:'UP'},h1:{trend:'UP'},h4:{trend:'DOWN'}};
const ai={cost:.00904,decision:{reason:'โครงสร้าง <ขาขึ้น> & ปลอดภัย',risks:['ข่าว & ความผันผวน']}};
const html=context.telegramPlanMessage_(plan,market,ai,c);
assert(html.includes('<code>81,103.90</code>'));assert(!html.includes('81103.90000000001'));
assert(html.includes('M15 ▲ ขึ้น'));assert(html.includes('H4 ▼ ลง'));
assert(html.includes('&lt;ขาขึ้น&gt; &amp; ปลอดภัย'));assert(!html.includes('<ขาขึ้น>'));
assert(context.notify_(html,c));assert.equal(request.body.parse_mode,'HTML');assert.equal(request.body.text,html);
assert.equal(request.body.reply_markup.inline_keyboard[0][0].url,'https://niti-trader.ebasswave.chatgpt.site/desk');
assert(context.telegramEventMessage_(plan,{status:'TP',time:1,note:'done & safe'},c).includes('ปิดกำไรตาม TP'));
console.log('Telegram presentation tests passed');
