import { documentHtml } from "./document";
export const dynamic = "force-dynamic";
export async function GET(){
 const brandedHtml=documentHtml
  .replace('href="/favicon.svg"','href="/niti-trader-logo.png"')
  .replace('<div class="mark">N</div>','<div class="mark"><img src="/niti-trader-logo.png" alt="Niti Trader"></div>')
  .replace('.mark{background:linear-gradient(145deg,#efcf94,#a58348);','.mark{background:#0b1217;}.mark img{width:38px;height:38px;object-fit:contain;display:block}.mark{');
 return new Response(brandedHtml,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
