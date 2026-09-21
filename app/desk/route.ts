import { documentHtml } from "./document";
export const dynamic = "force-dynamic";
export async function GET(){
 const brandedHtml=documentHtml
  .replace('href="/favicon.svg"','href="/niti-trader-logo.png"')
  .replace('<div class="mark">N</div>','<div class="mark"><img src="/niti-trader-logo.png" alt="Niti Trader"></div>')
  .replace('.mark{background:linear-gradient(145deg,#efcf94,#a58348);','.mark{background:#0b1217;}.mark img{width:38px;height:38px;object-fit:contain;display:block}.mark{')
  .replace('<div class="clock"><b id="clock">—</b><span id="today">เวลาไทย · UTC+7</span></div>','<div class="top-actions"><button class="btn small install-btn" id="installBtn" type="button">ติดตั้งแอป</button><div class="clock"><b id="clock">—</b><span id="today">เวลาไทย · UTC+7</span></div></div>')
  .replace('</style><link rel="icon"','</style><style>.top-actions{display:flex;align-items:center;gap:12px}.install-btn{color:var(--gold);border-color:#6b5934;background:#211d16}.install-btn[hidden]{display:none}@media(max-width:700px){.top-actions{align-items:flex-end;gap:8px}.install-btn{font-size:12px;padding:8px 10px}}</style><link rel="icon"')
  .replace('<link rel="manifest" href="/manifest.webmanifest">','<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/niti-trader-icon-192.png"><script src="/niti-enhancements.js?v=1.6.2"></script>')
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
 return new Response(brandedHtml,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
