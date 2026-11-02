/** Admin-only Gelato product details. Dashboard-deployable: no imports. */
// Self-contained for deployment through Supabase Dashboard (no local imports).
const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey;
const allowed = new Set(['https://organizedmomcollective.com', 'https://www.organizedmomcollective.com', ...(Deno.env.get('SHOP_ALLOWED_ORIGINS') || '').split(',').map(x => x.trim()).filter(Boolean)]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function cors(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://organizedmomcollective.com',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin' };
}
function json(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {status,headers:{...cors(req),'Content-Type':'application/json'}});
}
const dbHeaders: Record<string,string> = {apikey:serviceKey,'Content-Type':'application/json'};
if (serviceKey.startsWith('eyJ')) dbHeaders.Authorization = 'Bearer '+serviceKey;
async function query<T>(table: string, params: string): Promise<T[]> {
  const response = await fetch(supabaseUrl+'/rest/v1/'+table+'?'+params,{headers:dbHeaders});
  if (!response.ok) throw new Error('database_query_'+response.status);
  return await response.json() as T[];
}
async function rpc<T>(name:string, body:Record<string,unknown>): Promise<T> {
  const response = await fetch(supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:dbHeaders,body:JSON.stringify(body)});
  if (!response.ok) throw new Error('database_rpc_'+name+'_'+response.status);
  return await response.json() as T;
}
async function authorized(req:Request):Promise<boolean> {
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || !supabaseUrl || !serviceKey) return false;
  const r=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:'Bearer '+bearer}});
  if (!r.ok) return false;
  const user=await r.json();
  return !!user.id && UUID.test(user.id) && await rpc<boolean>('shop_is_admin_user',{p_user:user.id});
}

const STORE_ID='fc4a8fec-06f5-4823-815f-cec8937b4df4';
const PRODUCT_ID='a3755bc5-1a7e-4690-89df-6913d6bb6074';
Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=='POST') return json(req,{error:'method_not_allowed'},405);
  try {
    if(!await authorized(req)) return json(req,{error:'unauthorized_or_forbidden'},403);
    const key=Deno.env.get('GELATO_API_KEY');
    if(!key) return json(req,{error:'gelato_not_configured'},503);
    const response=await fetch('https://ecommerce.gelatoapis.com/v1/stores/'+STORE_ID+'/products/'+PRODUCT_ID,
      {headers:{'X-API-KEY':key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    if(!response.ok) return json(req,{error:'gelato_lookup_failed',upstream_status:response.status},502);
    const product=await response.json();
    // Return the actual variant payload so its nested product UID can be identified without guessing schema.
    return json(req,{store_id:STORE_ID,product_id:PRODUCT_ID,product});
  } catch(e) {
    console.error('gelato lookup failed',e);
    return json(req,{error:'server_error'},500);
  }
});
