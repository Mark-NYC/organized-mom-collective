/**
 * Synchronize the newsletter-ready segment independently from resource opt-ins.
 * Dispatch carries only an opaque 64-hex token. Every add is gated by current
 * consent, suppression, and completed Day 6 (or legacy prelaunch opt-in).
 * This function never sends messages.
 */
const SEGMENT="98ec76b1-fe2e-42d4-898d-b235b9c9df8b";
const respond=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 const db=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),resend=Deno.env.get("RESEND_MARKETING_API_KEY");
 if(!db||!service||!resend)return respond({error:"not_configured"},503);
 let token:unknown;try{token=(await req.json()).token;}catch{return respond({error:"invalid_json"},400)}
 if(typeof token!=="string"||!/^[0-9a-f]{64}$/.test(token))return respond({error:"invalid_token"},400);
 const bh={apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"};
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  const r=await fetch(`${db}/rest/v1/rpc/${name}`,{method:"POST",headers:bh,body:JSON.stringify(args)});
  if(!r.ok)throw Error("rpc_"+name+"_"+r.status);
  return await r.json();
 };
 let state:{status:string,email?:string,desired?:boolean,known_in_segment?:boolean};
 try{state=await rpc("marketing_newsletter_sync_claim",{p_token:token})}catch{return respond({error:"claim_failed"},503)}
 if(state.status!=="ok")return respond({status:state.status});
 const email=state.email!;
 const rh={Authorization:`Bearer ${resend}`,"Content-Type":"application/json"};
 const finish=async(inSegment:boolean,error:string|null)=>{
  return rpc("marketing_newsletter_sync_finish",{p_token:token,p_in_segment:inSegment,p_error:error});
 };
 try{
  // Existing newsletter-ready records should never be given a fresh opt-in.
  if(state.desired){
   const r=await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`,{headers:rh});
   if(!r.ok)throw Error("contact_check_"+r.status);
   const contact=await r.json() as {unsubscribed?:boolean};
   if(contact.unsubscribed===true){
     // If they were in the segment, clear it. Do not silently resubscribe.
     if(state.known_in_segment){
       const del=await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${SEGMENT}`,{method:"DELETE",headers:rh});
       if(!del.ok&&del.status!==404)throw Error("remove_optout_"+del.status);
     }
     await finish(false,null);
     return respond({status:"skipped_unsubscribed"});
   }
   const add=await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${SEGMENT}`,{method:"POST",headers:rh});
   if(!add.ok&&add.status!==409)throw Error("add_"+add.status);
   await finish(true,null);
   return respond({status:"added"});
  }
  // Remove stale members. No consent or contact creation is performed.
  if(state.known_in_segment){
    const del=await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${SEGMENT}`,{method:"DELETE",headers:rh});
    if(!del.ok&&del.status!==404)throw Error("remove_"+del.status);
  }
  await finish(false,null);
  return respond({status:"excluded"});
 }catch(e){
  const err=(e instanceof Error?e.message:"sync_failure").slice(0,90);
  try{await finish(Boolean(state.known_in_segment),err)}catch{}
  return respond({status:"failed",error:err},503);
 }
});