/**
 * Calendar/Club customer lifecycle marketing email worker.
 * Fail-closed: SQL gate, held queue, no cron until explicit launch.
 * Internal opaque dispatch token; never accept an email address in the request.
 */
const SENDER = "Organized Mom Collective <hello@organizedmomcollective.com>";
const TEMPLATES: Record<string,string> = {
 "calendar:first_week":"426ab487-b9b3-4470-8ab0-cb70932a02ae",
 "calendar:week_two":"47781939-1678-432a-9fe2-48c72e6c0793",
 "club:day_three":"db9e6ea7-b8ac-4763-9d15-963193d81130",
 "club:day_ten":"e4c1661b-040a-45b9-b75c-e8de724c76c2",
};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json"}
});
const safeCode=(error:unknown)=>String(error).slice(0,110).replace(/[^a-zA-Z0-9_:-]/g,"_");

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST") return response({status:"method_not_allowed"},405);
 const base=Deno.env.get("SUPABASE_URL");
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const resend=Deno.env.get("RESEND_MARKETING_API_KEY");
 if(!base||!key||!resend) return response({status:"not_configured"},503);
 let token:unknown;
 try {token=(await req.json()).token;}catch{return response({status:"invalid_json"},400);}
 if(typeof token!=="string"||!/^[0-9a-f]{64}$/.test(token))return response({status:"invalid_token"},400);

 const dbHeaders={"Content-Type":"application/json",apikey:key,Authorization:`Bearer ${key}`};
 const resendHeaders={"Content-Type":"application/json",Authorization:`Bearer ${resend}`};
 async function rpc(name:string,data:Record<string,unknown>){
   const r=await fetch(`${base}/rest/v1/rpc/${name}`,{
     method:"POST",headers:dbHeaders,body:JSON.stringify(data)
   });
   if(!r.ok)throw new Error(`db_${name}_${r.status}`);
   return r.json();
 }
 let claim:{status:string,email?:string,journey?:string,step?:string};
 try{claim=await rpc("marketing_claim_lifecycle",{p_token:token});}
 catch{return response({status:"claim_unavailable"},503);}
 if(claim.status!=="claimed"||!claim.email||!claim.journey||!claim.step)
   return response({status:claim.status});
 const finish=(status:"sent"|"blocked"|"uncertain",id?:string,reason?:string)=>
   rpc("marketing_finish_lifecycle",{
     p_token:token,p_status:status,p_message_id:id??null,p_error:reason??null
   });
 try{
   const templateId=TEMPLATES[`${claim.journey}:${claim.step}`];
   if(!templateId)throw new Error("unknown_step");
   const contacts=new URL(`${base}/rest/v1/tool_email_contacts`);
   contacts.searchParams.set("select","marketing_opt_in");
   contacts.searchParams.set("email",`eq.${claim.email}`);
   const suppressed=new URL(`${base}/rest/v1/marketing_suppressions`);
   suppressed.searchParams.set("select","email");
   suppressed.searchParams.set("email",`eq.${claim.email}`);
   const [c,s,r,t]=await Promise.all([
     fetch(contacts,{headers:dbHeaders}),
     fetch(suppressed,{headers:dbHeaders}),
     fetch(`https://api.resend.com/contacts/${encodeURIComponent(claim.email)}`,{headers:resendHeaders}),
     fetch(`https://api.resend.com/templates/${templateId}`,{headers:resendHeaders}),
   ]);
   if(!c.ok||!s.ok||!r.ok||!t.ok)throw new Error("eligibility_or_template_unavailable");
   const contact=await c.json() as {marketing_opt_in:boolean}[];
   const suppressions=await s.json() as unknown[];
   const provider=await r.json() as {unsubscribed?:boolean};
   const template=await t.json() as {status?:string};
   if(!contact[0]?.marketing_opt_in||suppressions.length||provider.unsubscribed===true){
     await finish("blocked",undefined,"suppressed");
     return response({status:"blocked"});
   }
   if(template.status!=="published")throw new Error("template_not_published");

   // Any uncertainty after a claim must be reviewed manually; never blind-retry.
   const sent=await fetch("https://api.resend.com/emails",{
     method:"POST",
     headers:{...resendHeaders,"Idempotency-Key":`omc-lifecycle-${token}`},
     body:JSON.stringify({
       from:SENDER,to:[claim.email],
       template:{id:templateId,variables:{}},
     }),
   });
   if(!sent.ok)throw new Error(`resend_send_${sent.status}`);
   const result=await sent.json() as {id?:string};
   if(!result.id)throw new Error("resend_missing_id");
   await finish("sent",result.id);
   return response({status:"sent",journey:claim.journey,step:claim.step});
 }catch(e){
   const code=safeCode(e instanceof Error?e.message:"unknown");
   try{await finish("uncertain",undefined,code);}catch{console.error("Lifecycle reconciliation failed");}
   console.error("Lifecycle send requires review",code);
   return response({status:"uncertain",error:code},503);
 }
});
