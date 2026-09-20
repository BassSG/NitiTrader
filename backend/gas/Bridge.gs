/* Signed server-to-server bridge for the private Niti Trader Site. */
let bridgeAuthorized_ = false;
function doPost(e){
  const reply=(v)=>ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
  try {
    const raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>20000)throw new Error('Invalid request');
    const envelope=JSON.parse(raw),secret=props_().getProperty('GAS_BRIDGE_SECRET');
    if(!secret||typeof envelope.payload!=='string'||!/^[a-f0-9]{64}$/.test(envelope.signature||''))throw new Error('Unauthorized');
    const expected=Utilities.computeHmacSha256Signature(envelope.payload,secret,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
    let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^envelope.signature.charCodeAt(i);
    if(diff)throw new Error('Unauthorized');
    const data=JSON.parse(envelope.payload);
    if(!Number.isFinite(data.time)||Math.abs(Date.now()-data.time)>60000||!/^[-a-z0-9]{36}$/.test(data.nonce||''))throw new Error('Expired request');
    const methods={getDashboard,runAnalysis,saveSettings,setAuto,cancelPlan,diagnostics,testNotification,installNitiTriggers};
    if(!Object.prototype.hasOwnProperty.call(methods,data.fn)||!Array.isArray(data.args))throw new Error('Invalid method');
    const lock=LockService.getScriptLock();lock.waitLock(10000);
    try{const cache=CacheService.getScriptCache();if(cache.get('bridge:'+data.nonce))throw new Error('Duplicate request');cache.put('bridge:'+data.nonce,'1',180);}finally{lock.releaseLock();}
    bridgeAuthorized_=true;
    return reply({ok:true,data:methods[data.fn].apply(null,data.args)});
  }catch(error){return reply({ok:false,error:String(error.message||error)});}
  finally{bridgeAuthorized_=false;}
}
