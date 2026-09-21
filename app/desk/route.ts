import { documentHtml } from "./document";
import { premiumStyles } from "./premium";
export const dynamic = "force-dynamic";
export async function GET(){
 const brandedHtml=documentHtml
  .replace('href="/favicon.svg"','href="/niti-trader-logo.png"')
  .replace('<div class="mark">N</div>','<div class="mark"><img src="/niti-trader-logo.png" alt="Niti Trader"></div>')
  .replace('.mark{background:linear-gradient(145deg,#efcf94,#a58348);','.mark{background:#0b1217;}.mark img{width:38px;height:38px;object-fit:contain;display:block}.mark{')
  .replace('<div class="clock"><b id="clock">—</b><span id="today">เวลาไทย · UTC+7</span></div>','<div class="top-actions"><button class="btn small install-btn" id="installBtn" type="button">ติดตั้งแอป</button><div class="clock"><b id="clock">—</b><span id="today">เวลาไทย · UTC+7</span></div></div>')
  .replace('</style><link rel="icon"','</style><style>.top-actions{display:flex;align-items:center;gap:12px}.install-btn{color:var(--gold);border-color:#6b5934;background:#211d16}.install-btn[hidden]{display:none}.page#overview.active{display:flex;flex-direction:column}.page#overview.active>.toolbar{order:-1;margin-top:0;margin-bottom:20px;position:sticky;top:10px;z-index:7;background:#111e26e8;border:1px solid #40505a;border-radius:13px;padding:12px;box-shadow:0 12px 30px #0005;backdrop-filter:blur(12px)}.page#overview.active>.toolbar .primary{box-shadow:0 0 0 1px #efd18e66,0 8px 22px #b48d3a44}.auto-toggle{position:relative;flex-wrap:wrap}.auto-toggle small{width:100%;padding-left:25px;color:var(--muted);font-size:11px;line-height:1.4}@media(max-width:700px){.top-actions{align-items:flex-end;gap:8px}.install-btn{font-size:12px;padding:8px 10px}.page#overview.active>.toolbar{top:5px;padding:10px;margin-bottom:15px}.page#overview.active>.toolbar .primary{flex:1}.auto-toggle{width:100%;margin-top:3px}.auto-toggle small{padding-left:25px}}</style><link rel="icon"')
  .replace('<link rel="manifest" href="/manifest.webmanifest">','<link rel="apple-touch-icon" href="/niti-trader-icon-192.png"><link rel="manifest" href="/manifest.webmanifest"><script src="/niti-enhancements.js?v=1.6.5"></script>')
  .replace('<label class="toggle"><input id="autoToggle" type="checkbox">วิเคราะห์อัตโนมัติทุกชั่วโมง</label>','<label class="toggle auto-toggle"><input id="autoToggle" type="checkbox"><span>วิเคราะห์อัตโนมัติทุกชั่วโมง</span><small>GAS Trigger ทำงานเบื้องหลัง · ไม่ต้องเปิดหน้าเว็บค้าง</small></label>')
  .replace("toast(r.auto?'เปิดวิเคราะห์รายชั่วโมงแล้ว':'ปิด Auto แล้ว');", "toast(r.auto?'เปิดแล้ว · GAS Trigger วิเคราะห์ทุกชั่วโมง ไม่ต้องเปิดหน้านี้ค้าง':'ปิด Auto แล้ว');")
  .replace("$('resultTitle').textContent='ยังทำรายการไม่สำเร็จ';$('resultMessage').textContent=e.message;$('resultDialog').showModal();", `window.nitiShowAnalysisResult&&btn.id==='analyzeBtn'?window.nitiShowAnalysisResult({status:'ERROR',symbol:selected,reason:e.message,costStatus:'NOT_CALLED'},usd):($('resultTitle').textContent='ยังทำรายการไม่สำเร็จ',$('resultMessage').textContent=e.message,$('resultDialog').showModal());`)
  .replace("$('resultTitle').textContent=r.status==='WAIT'?'ผลวิเคราะห์: รอจังหวะ':'ผลวิเคราะห์: '+r.status;$('resultMessage').textContent=r.reason+' · ค่า AI '+usd(r);$('resultDialog').showModal();", `window.nitiShowAnalysisResult?window.nitiShowAnalysisResult(r,usd):($('resultTitle').textContent=r.status==='WAIT'?'ผลวิเคราะห์: รอจังหวะ':'ผลวิเคราะห์: '+r.status,$('resultMessage').textContent=r.reason+' · ค่า AI '+usd(r),$('resultDialog').showModal());`)
  .replace('settings:{MIN_RR:1.5,MIN_SCORE:60,EXPIRY_HOURS:6,MAX_DAILY_AI_USD:2,','settings:{PROFILE:"BALANCED",MIN_RR:1.1,MIN_SCORE:52,EXPIRY_HOURS:6,MAX_DAILY_AI_USD:2,')
  .replace('</script></body></html>',`</script><script>
(function(){
  if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}
  var deferredInstallPrompt=null;
  var installButton=null;
  function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}
  function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
  function notify(message){if(typeof window.toast==='function'){window.toast(message);}else{window.alert(message);}}
  function updateButton(){if(installButton){installButton.hidden=isStandalone();}}
  window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();deferredInstallPrompt=event;updateButton();});
  window.addEventListener('appinstalled',function(){deferredInstallPrompt=null;updateButton();});
  window.addEventListener('load',function(){
    installButton=document.getElementById('installBtn');
    if(!installButton)return;
    installButton.addEventListener('click',async function(){
      if(isStandalone())return;
      if(deferredInstallPrompt){
        var installEvent=deferredInstallPrompt;
        deferredInstallPrompt=null;
        try{
          installEvent.prompt();
          var choice=await installEvent.userChoice;
          if(choice&&choice.outcome==='accepted')notify('กำลังติดตั้ง Niti Trader');
        }catch(error){notify('กรุณาใช้เมนูของเบราว์เซอร์เพื่อเพิ่ม Niti Trader ไปยังหน้าจอหลัก');}
        updateButton();
        return;
      }
      if(isIos()){notify('iPhone/iPad: กดปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”');return;}
      notify('เปิดหน้านี้ด้วย Chrome บน Android แล้วกดปุ่มติดตั้งอีกครั้ง หรือใช้เมนู ⋮ > ติดตั้งแอป');
    });
    updateButton();
  });
}());
</script></body></html>`);
 const polishedHtml=brandedHtml.replace('</head>', '<style id="niti-premium">'+premiumStyles+'</style></head>');
 return new Response(polishedHtml,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
