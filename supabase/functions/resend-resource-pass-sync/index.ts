/**
 * Private Resend contact-property synchronization.
 * Receives only 64-hex opaque job token. No raw address in dispatch payload.
 * This endpoint does not send email and never re-subscribes opted-out contacts.
 */
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 const base=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),key=Deno.env.get("RESEND_MARKETING_API_KEY");
 if(!base||!service||!key)return respond({error:"not_configured"},503);
 let token:unknown;try{token=(await req.json()).token}catch{return respond({error:"invalid_json"},400)}
 if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))return respond({error:"invalid_token"},400);
 const hdr={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
 const endpoint=(table:string,field:string,val:string)=>{const u=new URL(`${base}/rest/v1/${table}`);u.searchParams.set("select","*");u.searchParams.set(field,`eq.${val}`);u.searchParams.set("limit","1");return u};
 const query=async(u:URL)=>{const r=await fetch(u,{headers:hdr});if(!r.ok)throw Error("db_"+r.status);return r.json()};
 let job:{email:string,status:string,attempts:number}|undefined;
 try{job=(await query(endpoint("subscriber_resource_pass_sync_jobs","dispatch_token",token)))[0]}catch{return respond({error:"job_lookup_failed"},503)}
 if(!job)return respond({status:"not_found"});
 if(job.status==="synced")return respond({status:"synced"});
 if(job.attempts>5)return respond({status:"attempt_cap"});
 const updateJob=async(status:string,code:string|null)=>{
  const u=new URL(`${base}/rest/v1/subscriber_resource_pass_sync_jobs`);u.searchParams.set("dispatch_token",`eq.${token}`);
  const r=await fetch(u,{method:"PATCH",headers:{...hdr,Prefer:"return=minimal"},body:JSON.stringify({status,error_code:code,updated_at:new Date().toISOString()})});
  if(!r.ok)throw Error("job_update_"+r.status);
 };
 try{
  const [c,p,s]=await Promise.all([
   query(endpoint("tool_email_contacts","email",job.email)),
   query(endpoint("subscriber_resource_passes","email",job.email)),
   query(endpoint("marketing_suppressions","email",job.email)),
  ]);
  const contact=c[0],pass=p[0];
  if(!contact?.marketing_opt_in||s.length||!pass||new Date(pass.expires_at).getTime()<Date.now()){
   await updateJob("blocked","not_eligible");return respond({status:"blocked"});
  }
  const rh={Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  const check=await fetch(`https://api.resend.com/contacts/${encodeURIComponent(job.email)}`,{headers:rh});
  if(!check.ok)throw Error("resend_contact_"+check.status);
  const existing=await check.json() as {unsubscribed?:boolean};
  if(existing.unsubscribed===true){await updateJob("blocked","provider_unsubscribed");return respond({status:"blocked"});}
  const update=await fetch(`https://api.resend.com/contacts/${encodeURIComponent(job.email)}`,{
   method:"PATCH",headers:rh,body:JSON.stringify({properties:{RESOURCE_PASS:pass.token}}),
  });
  if(!update.ok)throw Error("resend_property_"+update.status);
  const row=new URL(`${base}/rest/v1/subscriber_resource_passes`);row.searchParams.set("email",`eq.${job.email}`);row.searchParams.set("token",`eq.${pass.token}`);
  const marked=await fetch(row,{method:"PATCH",headers:{...hdr,Prefer:"return=minimal"},body:JSON.stringify({synced_at:new Date().toISOString(),sync_error:null,updated_at:new Date().toISOString()})});
  if(!marked.ok)throw Error("pass_mark_"+marked.status);
  await updateJob("synced",null);
  return respond({status:"synced"});
 }catch(e){
  const err=(e instanceof Error?e.message:"failed").slice(0,90).replace(/[^a-zA-Z0-9_:-]/g,"_");
  try{await updateJob("failed",err)}catch{}
  return respond({status:"failed",error:err},503);
 }
});