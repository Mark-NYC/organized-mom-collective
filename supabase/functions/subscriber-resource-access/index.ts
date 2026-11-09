/**
 * Read-only subscriber resource-pass verifier.
 * Tokens are transmitted in POST bodies, never in URL query strings.
 * Access is to public/free downloads only, never Club or paid content.
 */
const allowed=new Set(["https://organizedmomcollective.com","https://www.organizedmomcollective.com"]);
const headers=(origin:string|null)=>({
 "Content-Type":"application/json","Cache-Control":"no-store",
 "Vary":"Origin",...(origin&&allowed.has(origin)?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type"}:{})
});
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin");
 const reply=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:headers(origin)});
 if(origin&&!allowed.has(origin))return reply({ok:false},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=="POST")return reply({ok:false},405);
 let token:unknown;
 try{token=(await req.json()).token;}catch{return reply({ok:false},400)}
 if(typeof token!=="string"||!/^[0-9a-f]{64}$/.test(token))return reply({ok:false},400);
 const dbUrl=Deno.env.get("SUPABASE_URL"),dbKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!dbUrl||!dbKey)return reply({ok:false},503);
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 const hex=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 const url=new URL(`${dbUrl}/rest/v1/subscriber_resource_passes`);
 url.searchParams.set("select","expires_at");
 url.searchParams.set("token_hash",`eq.${hex}`);
 url.searchParams.set("limit","1");
 try{
  const resp=await fetch(url,{headers:{apikey:dbKey,Authorization:`Bearer ${dbKey}`}});
  if(!resp.ok)return reply({ok:false},503);
  const data=await resp.json() as {expires_at:string}[];
  return reply({ok:!!data[0]&&new Date(data[0].expires_at).getTime()>Date.now()});
 }catch{return reply({ok:false},503)}
});