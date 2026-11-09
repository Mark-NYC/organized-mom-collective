/**
 * Consent-only automated Resend segment sync.
 *
 * Postgres trigger issues an opaque, one-time token after a new opt-in.
 * This function never accepts an email address from the request body.
 * All eligibility is fetched from Supabase with the service role.
 * No marketing message is sent here.
 */
const SEGMENT_ID = "7bf64eae-a8f7-4fb4-a18d-3578a2e1e557";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const dbUrl = Deno.env.get("SUPABASE_URL");
  const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!dbUrl || !dbKey || !resendKey) return json({ error: "not_configured" }, 503);
  let token: unknown;
  try { token = (await req.json()).token; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return json({ error: "invalid_token" }, 400);
  const headers = { apikey: dbKey, Authorization: `Bearer ${dbKey}`, "Content-Type": "application/json" };
  const lookup = new URL(`${dbUrl}/rest/v1/marketing_sync_jobs`);
  lookup.searchParams.set("select", "email,token,status,attempts");
  lookup.searchParams.set("token", `eq.${token}`);
  lookup.searchParams.set("limit", "1");
  const jobResponse = await fetch(lookup, { headers });
  if (!jobResponse.ok) return json({ error: "job_lookup_failed" }, 503);
  const jobs = await jobResponse.json() as { email: string; token: string; status: string; attempts: number }[];
  const job = jobs[0];
  if (!job) return json({ error: "unknown_token" }, 404);
  if (job.status === "synced" || job.status === "blocked") return json({ status: job.status });
  if (job.attempts >= 5) return json({ error: "retry_limit_reached" }, 429);

  // This token is not an authorization to sync another address: eligibility
  // is independently re-checked on every call, including suppression status.
  const rowUrl = new URL(`${dbUrl}/rest/v1/tool_email_contacts`);
  rowUrl.searchParams.set("select", "email,marketing_opt_in");
  rowUrl.searchParams.set("email", `eq.${job.email}`);
  const suppressUrl = new URL(`${dbUrl}/rest/v1/marketing_suppressions`);
  suppressUrl.searchParams.set("select", "email");
  suppressUrl.searchParams.set("email", `eq.${job.email}`);
  const [rowsRes, suppressedRes] = await Promise.all([
    fetch(rowUrl, { headers }), fetch(suppressUrl, { headers }),
  ]);
  if (!rowsRes.ok || !suppressedRes.ok) return json({ error: "eligibility_check_failed" }, 503);
  const rows = await rowsRes.json() as { email: string; marketing_opt_in: boolean }[];
  const suppressed = await suppressedRes.json() as { email: string }[];

  const setStatus = async (status: string, errorCode: string | null = null) => {
    const url = new URL(`${dbUrl}/rest/v1/marketing_sync_jobs`);
    url.searchParams.set("email", `eq.${job.email}`);
    url.searchParams.set("token", `eq.${token}`);
    const result = await fetch(url, {
      method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        status,
        attempts: job.attempts + 1,
        error_code: errorCode,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!result.ok) throw Error("job_status_update_failed");
  };

  if (!rows[0]?.marketing_opt_in || suppressed.length > 0) {
    await setStatus("blocked");
    return json({ status: "blocked" });
  }
  const resendHeaders = { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" };
  try {
    const getRes = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(job.email)}`, {
      headers: resendHeaders,
    });
    if (getRes.ok) {
      const existing = await getRes.json() as { unsubscribed?: boolean };
      // Never reactivate Resend opt-outs, even when Supabase data says opted-in.
      if (existing.unsubscribed === true) {
        await setStatus("blocked", "resend_unsubscribed");
        return json({ status: "blocked" });
      }
    } else if (getRes.status === 404) {
      const createRes = await fetch("https://api.resend.com/contacts", {
        method: "POST", headers: resendHeaders,
        body: JSON.stringify({ email: job.email, unsubscribed: false }),
      });
      if (!createRes.ok && createRes.status !== 409)
        throw Error(`contact_create_${createRes.status}`);
    } else throw Error(`contact_lookup_${getRes.status}`);

    // Adding an existing global Resend contact to a segment is distinct from
    // creating the contact; both actions are needed for delivery eligibility.
    const segmentRes = await fetch(
      `https://api.resend.com/contacts/${encodeURIComponent(job.email)}/segments/${SEGMENT_ID}`,
      { method: "POST", headers: resendHeaders },
    );
    if (!segmentRes.ok && segmentRes.status !== 409)
      throw Error(`segment_add_${segmentRes.status}`);
    await setStatus("synced");
    return json({ status: "synced" });
  } catch (err) {
    const code = err instanceof Error ? err.message.slice(0, 100) : "sync_failed";
    await setStatus("failed", code);
    console.error("Marketing contact sync failed", code);
    return json({ error: "sync_failed" }, 503);
  }
});
