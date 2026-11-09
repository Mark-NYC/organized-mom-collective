/**
 * Admin-only One Small Win scheduling.
 * Coordinates Supabase's broadcast date reservation with Resend's schedule API.
 * Requires service-role bearer auth and BROADCAST_SCHEDULING_ENABLED=true.
 * No draft is sent until an admin deliberately submits its ID and future ISO date.
 */
const json = (data: unknown, status=200) =>
 new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json"}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENT="98ec76b1-fe2e-42d4-898d-b235b9c9df8b";
const allowed=new Set([
 "36761fdf-d316-4921-9c20-bdf44bce02fd",
 "71b315ae-e4b4-41d5-b2c1-f67769eb310b",
 "f754f259-ad49-450e-95fc-c490b5f38298",
 "cb6b9c36-696c-4006-a039-93519616db73",
 "5745766c-36c5-4ab1-a3c1-0becd37ba0a5",
 "f821718f-f926-4b09-b3bf-baf17d5d89e6",
 "ce4ae542-4759-438d-a422-077c35c582a8",
 "fa2fb8e7-1305-449e-a0e6-816e99f259f3",
 "a042b85c-d216-4fc1-9a19-9caf8660ee4a",
 "9a9acbdc-8150-4f0b-9ce3-bc3e9b7b4a37",
 "cb0061d6-7faf-49fe-b823-ce338b9d5960",
 "c0570537-539b-4976-80fe-ebd30949b205",
]);
Deno.serve(async(req: Request)=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const base=Deno.env.get("SUPABASE_URL");
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const key=Deno.env.get("RESEND_MARKETING_API_KEY");
 if(!base||!service)return json({error:"not_configured"},503);
 if(req.headers.get("authorization")!==`Bearer ${service}`)
   return json({error:"unauthorized"},401);
 let data:Record<string,unknown>;
 try {data=await req.json();}catch{return json({error:"invalid_json"},400);}
 const id=data.broadcast_id;
 const requested=data.scheduled_at;
 const dryRun=data.dry_run!==false;
 if(typeof id!=="string"||!UUID.test(id)||!allowed.has(id))
   return json({error:"unapproved_broadcast"},400);
 if(typeof requested!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(requested))
   return json({error:"invalid_scheduled_at"},400);
 const when=Date.parse(requested);
 if(!Number.isFinite(when)||when<Date.now()+10*60_000||when>Date.now()+28*86400_000)
   return json({error:"scheduled_at_out_of_range"},400);
 const sendDay=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(when));
 const resendHeaders={Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
 if(!key)return json({error:"resend_key_unset"},503);
 const current=await fetch(`https://api.resend.com/broadcasts/${id}`,{headers:resendHeaders});
 if(!current.ok)return json({error:"broadcast_lookup_failed"},503);
 const broadcast=await current.json() as {status?:string,segment_id?:string,segmentId?:string,name?:string,html?:string|null,text?:string|null};
 if((broadcast.segment_id??broadcast.segmentId)!==SEGMENT)
   return json({error:"wrong_segment"},400);
 if(broadcast.status!=="draft")
   return json({error:"broadcast_not_draft"},409);
 // Do not schedule an empty or non-compliant campaign, even when TipTap editor data exists.
 const renderedBody=[broadcast.html??"",broadcast.text??""].join("\n");
 if(!broadcast.html || broadcast.html.length<400 || !broadcast.text || broadcast.text.length<120)
   return json({error:"broadcast_render_missing"},409);
 if(!renderedBody.includes("14839 61st Road") || !renderedBody.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"))
   return json({error:"broadcast_footer_unverified"},409);
 if(dryRun)return json({status:"dry_run",broadcast_id:id,scheduled_at:new Date(when).toISOString(),local_day:sendDay,recipient_group:"opted_in_segment",would_send:false});

 if(Deno.env.get("BROADCAST_SCHEDULING_ENABLED")!=="true")
   return json({status:"disabled"},409);

 const rpcHeaders={"Content-Type":"application/json",apikey:service,Authorization:`Bearer ${service}`};
 const rpc=async(name:string,body:Record<string,unknown>)=>{
  const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:"POST",headers:rpcHeaders,body:JSON.stringify(body)});
  if(!r.ok)throw Error(`rpc_${name}_${r.status}`);
  return r.json() as Promise<{status:string}>;
 };
 let reserved;
 try {reserved=await rpc("marketing_reserve_broadcast",{p_broadcast_id:id,p_title:broadcast.name??"One Small Win",p_scheduled_at:new Date(when).toISOString()});}
 catch {return json({error:"reservation_unavailable"},503);}
 if(reserved.status!=="reserved")return json({status:reserved.status},409);
 try {
  const response=await fetch(`https://api.resend.com/broadcasts/${id}/send`,{
    method:"POST",headers:resendHeaders,body:JSON.stringify({scheduled_at:new Date(when).toISOString()})
  });
  if(!response.ok){
    // Conservative reservation stays in place until manually reconciled.
    await rpc("marketing_record_broadcast_schedule",{p_broadcast_id:id,p_status:"failed",p_error:`resend_http_${response.status}`});
    return json({status:"reservation_held",error:"resend_schedule_failed"},503);
  }
  const recorded=await rpc("marketing_record_broadcast_schedule",{p_broadcast_id:id,p_status:"scheduled"});
  return json({status:recorded.status==="recorded"?"scheduled":"reconciliation_needed",broadcast_id:id,scheduled_at:new Date(when).toISOString()});
 } catch(e){
  try {await rpc("marketing_record_broadcast_schedule",{p_broadcast_id:id,p_status:"uncertain",p_error:"schedule_response_uncertain"});}catch{}
  return json({status:"reservation_held",error:"reconciliation_needed"},503);
 }
});
