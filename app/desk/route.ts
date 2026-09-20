import { getChatGPTUser } from "../chatgpt-auth";
import { documentHtml } from "./document";
export async function GET(request: Request){
 if(!await getChatGPTUser()) return Response.redirect(new URL("/signin-with-chatgpt?return_to=/desk",request.url));
 return new Response(documentHtml,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
