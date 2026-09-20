import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
const allowed = new Set(['getDashboard','runAnalysis','saveSettings','setAuto','cancelPlan','diagnostics','testNotification','installNitiTriggers']);
const publicAllowed = new Set(['getDashboard','runAnalysis','diagnostics']);
export async function POST(request: Request) {
  const json = (value: unknown, status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  const user = await getChatGPTUser();
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'คำขอไม่ถูกต้อง'},403);
  const settings=env as unknown as Record<string,string>;
  if(!settings.GAS_BRIDGE_URL || !settings.GAS_BRIDGE_SECRET) return json({error:'กำลังเตรียมการเชื่อมต่อ Google กรุณารอการตั้งค่าให้เสร็จก่อนวิเคราะห์'},503);
  try {
    const body=await request.text();
    if(body.length>16000) return json({error:'คำขอใหญ่เกินไป'},413);
    const data=JSON.parse(body);
    if(!allowed.has(data.fn)||!Array.isArray(data.args)) return json({error:'คำสั่งไม่รองรับ'},400);
    if(!user && !publicAllowed.has(data.fn)) return json({error:'คำสั่งผู้ดูแลต้องเข้าสู่ระบบบัญชีเจ้าของ'},401);
    const payload=JSON.stringify({fn:data.fn,args:data.args,time:Date.now(),nonce:crypto.randomUUID()});
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(settings.GAS_BRIDGE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
    const signature=Array.from(new Uint8Array(sig),v=>v.toString(16).padStart(2,'0')).join('');
    const upstream=await fetch(settings.GAS_BRIDGE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature}),signal:AbortSignal.timeout(180000)});
    if(!upstream.ok) return json({error:'ระบบ Google ไม่พร้อม กรุณาลองอัปเดตสถานะภายหลัง'},502);
    const result=await upstream.json() as {ok:boolean;data?:unknown;error?:string};
    return result.ok ? json({data:result.data}) : json({error:result.error||'ประมวลผลไม่สำเร็จ'},400);
  } catch {return json({error:'การเชื่อมต่อขัดข้อง กรุณาอัปเดตบันทึกก่อนกดวิเคราะห์ซ้ำ เพื่อป้องกันการเรียก AI ซ้ำ'},502);}
}
