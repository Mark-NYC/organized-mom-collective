/**
 * Individually scheduled Day 2/6 marketing welcome emails.
 * TWO independent launch locks: WELCOME_DELIVERY_ENABLED=true AND
 * marketing_delivery_settings enabled+postal_address_verified+
 * broadcasts_coordinated. Defaults fail closed. Never use for broadcasts.
 *
 * Postgres dispatch only sends a 64-hex opaque token. The service-role RPC
 * atomically claims one job and reserves the recipient's NYC calendar day.
 */
const DAY_2_TEMPLATE = "a70163c4-3c72-4cd8-9b89-17e089282af1";
const DAY_6_TEMPLATE = "105ee0e7-9078-4372-8ef3-4aa2cd3dedc2";
const SENDER = "Organized Mom Collective <hello@organizedmomcollective.com>";

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {status, headers: {"Content-Type":"application/json"}});
function errorCode(s: unknown): string {
  return String(s).slice(0, 100).replace(/[^a-zA-Z0-9_:-]/g, "_");
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({error:"method_not_allowed"},405);
  // This lock is intentionally separate from the database setting.
  if (Deno.env.get("WELCOME_DELIVERY_ENABLED") !== "true")
    return reply({status:"disabled"});
  const dbUrl = Deno.env.get("SUPABASE_URL");
  const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_MARKETING_API_KEY");
  if (!dbUrl || !dbKey || !resendKey) return reply({status:"not_configured"},503);
  let token: unknown;
  try { token = (await req.json()).token; }
  catch { return reply({error:"invalid_json"},400); }
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token))
    return reply({error:"invalid_token"},400);

  const dbHeaders = {
    "Content-Type":"application/json",
    apikey: dbKey,
    Authorization: `Bearer ${dbKey}`,
  };
  const rpc = async (name: string, payload: Record<string, unknown>) => {
    const res = await fetch(`${dbUrl}/rest/v1/rpc/${name}`, {
      method:"POST",headers:dbHeaders,body:JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`database_${name}_${res.status}`);
    return res.json();
  };
  let claim: {status:string,email?:string,step?:number};
  try {
    claim = await rpc("marketing_claim_welcome",{p_token:token});
  } catch {
    return reply({error:"claim_failed"},503);
  }
  if (claim.status !== "claimed" || !claim.email || ![2,6].includes(claim.step ?? 0))
    return reply({status:claim.status});

  const finish = async (status:"sent"|"blocked"|"uncertain", id?:string, err?:string) =>
    rpc("marketing_finish_welcome", {
      p_token:token,p_status:status,p_message_id:id??null,p_error:err??null,
    });
  const resendHeaders={Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"};
  try {
    // Secondary live checks immediately before send. A Resend opt-out always wins.
    const contactUrl = new URL(`${dbUrl}/rest/v1/tool_email_contacts`);
    contactUrl.searchParams.set("select","email,marketing_opt_in");
    contactUrl.searchParams.set("email",`eq.${claim.email}`);
    const suppressedUrl=new URL(`${dbUrl}/rest/v1/marketing_suppressions`);
    suppressedUrl.searchParams.set("select","email");
    suppressedUrl.searchParams.set("email",`eq.${claim.email}`);
    const [contactDb,suppressedDb,resendContact] = await Promise.all([
      fetch(contactUrl,{headers:dbHeaders}),fetch(suppressedUrl,{headers:dbHeaders}),
      fetch(`https://api.resend.com/contacts/${encodeURIComponent(claim.email)}`,{headers:resendHeaders}),
    ]);
    if (!contactDb.ok || !suppressedDb.ok || (!resendContact.ok && resendContact.status !== 404))
      throw Error("eligibility_lookup_unavailable");
    const rows=await contactDb.json() as {email:string,marketing_opt_in:boolean}[];
    const suppressed=await suppressedDb.json() as {email:string}[];
    if (!rows[0]?.marketing_opt_in || suppressed.length || resendContact.status === 404) {
      await finish("blocked",undefined,"not_eligible");
      return reply({status:"blocked"});
    }
    const contact=await resendContact.json() as {unsubscribed?:boolean};
    if (contact.unsubscribed === true) {
      await finish("blocked",undefined,"provider_unsubscribed");
      return reply({status:"blocked"});
    }
    // A draft cannot be sent. This also prevents late template changes from
    // silently becoming a production email before owner publication.
    const templateId=claim.step===2?DAY_2_TEMPLATE:DAY_6_TEMPLATE;
    const templateResponse=await fetch(`https://api.resend.com/templates/${templateId}`,{headers:resendHeaders});
    if (!templateResponse.ok) throw Error(`template_lookup_${templateResponse.status}`);
    const template=await templateResponse.json() as {status?:string};
    if (template.status!=="published") throw Error("template_not_published");

    // Resend retains idempotency keys for 24h; our permanent SQL ledger
    // prevents a later duplicate even after that window expires.
    const idempotencyKey=`omc-welcome-${claim.step}-${token}`;
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{...resendHeaders,"Idempotency-Key":idempotencyKey},
      body:JSON.stringify({
        from:SENDER,to:[claim.email],
        template:{id:templateId,variables:{}},
      }),
    });
    if (!response.ok) throw Error(`resend_send_${response.status}`);
    const sent=await response.json() as {id?:string};
    if (!sent.id) throw Error("resend_missing_message_id");
    await finish("sent",sent.id);
    return reply({status:"sent",step:claim.step});
  } catch (e) {
    const code=errorCode(e instanceof Error?e.message:"unknown");
    // After a claim, do not automatically retry: a network timeout could
    // mean Resend accepted the email. Mark as uncertain for manual review.
    try { await finish("uncertain",undefined,code); } catch { console.error("Welcome send reconciliation failed"); }
    console.error("Welcome send requires investigation",code);
    return reply({status:"uncertain",error:code},503);
  }
});
