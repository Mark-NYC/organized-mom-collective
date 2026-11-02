/** Admin-only Gelato draft orders. Dashboard-deployable: no imports. */
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


type Item={id:string;product_id:string;product_slug:string;quantity:number};
type Order={id:string;payment_status:string;digital?:boolean;fulfillment_status:string;email:string|null;shipping_address:Record<string,string|null>|null;shipping_name:string|null;customer_name:string|null;shop_order_items:Item[]};
type Mapping={product_id:string;product_uid:string;print_file_url:string;page_count:number|null};
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=='POST') return json(req,{error:'method_not_allowed'},405);
  try {
    if(!await authorized(req)) return json(req,{error:'unauthorized_or_forbidden'},403);
    const body=await req.json().catch(()=>null);
    const id=body?.order_id;
    if(typeof id!=='string'||!UUID.test(id)) return json(req,{error:'invalid_order_id'},400);
    const [order]=await query<Order>('shop_orders','id=eq.'+id+'&select=*,shop_order_items(*)');
    if(!order) return json(req,{error:'not_found'},404);
    if(order.payment_status!=='paid'||order.digital||order.fulfillment_status!=='unfulfilled')
      return json(req,{error:'order_not_eligible'},409);
    if(!order.email||!order.shipping_address||!order.shop_order_items.length)
      return json(req,{error:'missing_order_details'},422);
    const key=Deno.env.get('GELATO_API_KEY');
    if(!key) return json(req,{error:'gelato_not_configured'},503);
    const mappings=await query<Mapping>('shop_gelato_products','select=product_id,product_uid,print_file_url,page_count&enabled=eq.true');
    const byId=new Map(mappings.map(m=>[m.product_id,m]));
    const missing=order.shop_order_items.filter(item=>!byId.has(item.product_id));
    if(missing.length) return json(req,{error:'unmapped_products',product_slugs:missing.map(x=>x.product_slug)},422);
    const a=order.shipping_address;
    const parts=(order.shipping_name||order.customer_name||'').trim().split(/\s+/);
    const firstName=parts.shift()||'';
    const lastName=parts.join(' ')||firstName;
    if(!firstName||!a.line1||!a.city||!a.postal_code||!a.country)
      return json(req,{error:'incomplete_shipping_address'},422);
    if(['US','CA','AU'].includes(a.country.toUpperCase())&&!a.state)
      return json(req,{error:'missing_shipping_state'},422);
    const claimed=await rpc<boolean>('shop_gelato_claim',{p_order:id});
    if(!claimed) return json(req,{error:'already_claimed_or_not_paid'},409);
    const payload={
      orderType:'draft',orderReferenceId:order.id,customerReferenceId:order.id,currency:'USD',
      items:order.shop_order_items.map(item=>{
        const m=byId.get(item.product_id)!;
        return {itemReferenceId:item.id,productUid:m.product_uid,quantity:item.quantity,
          files:[{type:'default',url:m.print_file_url}],...(m.page_count?{pageCount:m.page_count}:{})};
      }),
      shippingAddress:{firstName,lastName,addressLine1:a.line1,addressLine2:a.line2||undefined,
        city:a.city,state:a.state||undefined,postCode:a.postal_code,
        country:a.country.toUpperCase(),email:order.email}
    };
    let response:Response;
    try {
      response=await fetch('https://order.gelatoapis.com/v4/orders',
        {method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':key},
          body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
    } catch {
      await rpc('shop_gelato_record',{p_order:id,p_status:'needs_review',p_error:'network_uncertain'});
      return json(req,{error:'gelato_response_uncertain',detail:'Check Gelato before any retry'},502);
    }
    if(!response.ok) {
      await rpc('shop_gelato_record',{p_order:id,p_status:'needs_review',p_error:'http_'+response.status});
      return json(req,{error:'gelato_rejected',upstream_status:response.status},502);
    }
    const result=await response.json().catch(()=>null);
    if(!result?.id) {
      await rpc('shop_gelato_record',{p_order:id,p_status:'needs_review',p_error:'missing_order_id'});
      return json(req,{error:'gelato_response_uncertain'},502);
    }
    await rpc('shop_gelato_record',{p_order:id,p_status:'draft',p_gelato_id:result.id});
    return json(req,{ok:true,status:'draft',gelato_order_id:result.id});
  } catch(e) {
    console.error('Gelato draft failed',e);
    return json(req,{error:'server_error'},500);
  }
});
