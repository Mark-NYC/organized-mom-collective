/** Admin-only, read-only verification of private Gelato artwork. No orders created. */
const supabaseUrl=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')||serviceKey;
const BUCKET='gelato-print-files';
const SLUG='family-schedule-calendar-2027';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed=new Set(['https://organizedmomcollective.com','https://www.organizedmomcollective.com',...(Deno.env.get('SHOP_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean)]);
const headers:Record<string,string>={apikey:serviceKey,'Content-Type':'application/json'};
if(serviceKey.startsWith('eyJ'))headers.Authorization='Bearer '+serviceKey;
function cors(req:Request):HeadersInit {
  const origin=req.headers.get('origin')||'';
  return {'Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://organizedmomcollective.com',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
}
function respond(req:Request,body:unknown,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
}
async function rest<T>(path:string):Promise<T> {
  const r=await fetch(supabaseUrl+path,{headers,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('supabase_read_'+r.status);
  return await r.json() as T;
}
async function admin(req:Request):Promise<boolean>{
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token||!serviceKey||!supabaseUrl)return false;
  const userRes=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!userRes.ok)return false;
  const user=await userRes.json();
  if(!user.id||!UUID.test(user.id))return false;
  const check=await fetch(supabaseUrl+'/rest/v1/rpc/shop_is_admin_user',
    {method:'POST',headers,body:JSON.stringify({p_user:user.id}),signal:AbortSignal.timeout(15000)});
  return check.ok && await check.json()===true;
}
function absoluteSignedUrl(raw:string,path:string):string {
  const storagePrefix='/storage/v1';
  const expected='/object/sign/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
  let parsed:URL;
  if(raw.startsWith(storagePrefix+'/'))parsed=new URL(raw,supabaseUrl);
  else if(raw.startsWith('/object/sign/'))parsed=new URL(storagePrefix+raw,supabaseUrl);
  else if(raw.startsWith('https://'))parsed=new URL(raw);
  else throw new Error('unexpected_signed_url_format');
  if(parsed.origin!==new URL(supabaseUrl).origin || parsed.pathname!==storagePrefix+expected || !parsed.searchParams.has('token'))
    throw new Error('unexpected_signed_url');
  return parsed.toString();
}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=='POST')return respond(req,{error:'method_not_allowed'},405);
  try {
    if(!await admin(req))return respond(req,{error:'unauthorized_or_forbidden'},403);
    const product=await rest<{id:string;slug:string;active:boolean;stock:number}[]>(
      '/rest/v1/shop_products?select=id,slug,active,stock&slug=eq.'+SLUG);
    if(!product[0])return respond(req,{ok:false,stage:'product',error:'product_not_found'},200);
    const p=product[0];
    const mapped=await rest<{product_uid:string;storage_object_path:string|null;page_count:number|null;enabled:boolean;print_file_url:string|null}[]>(
      '/rest/v1/shop_gelato_products?select=product_uid,storage_object_path,page_count,enabled,print_file_url&product_id=eq.'+p.id);
    if(!mapped[0])return respond(req,{ok:false,stage:'mapping',error:'mapping_not_found'},200);
    const m=mapped[0];
    const bucket=await rest<{public:boolean}>('/storage/v1/bucket/'+BUCKET);
    if(bucket.public)return respond(req,{ok:false,stage:'bucket',error:'bucket_is_public'},200);
    if(!m.storage_object_path||m.print_file_url)return respond(req,{ok:false,stage:'mapping',error:'private_file_mapping_invalid'},200);
    const path=m.storage_object_path;
    if(path.startsWith('/')||path.includes('..')||/[?#]/.test(path)||!path.toLowerCase().endsWith('.pdf'))
      return respond(req,{ok:false,stage:'mapping',error:'invalid_private_file_path'},200);
    const signResponse=await fetch(supabaseUrl+'/storage/v1/object/sign/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/'),
      {method:'POST',headers,body:JSON.stringify({expiresIn:7200}),signal:AbortSignal.timeout(15000)});
    if(!signResponse.ok)return respond(req,{ok:false,stage:'sign',error:'private_file_sign_failed',status:signResponse.status},200);
    const signed=await signResponse.json() as {signedURL?:string;signedUrl?:string};
    const signedUrl=absoluteSignedUrl(signed.signedURL||signed.signedUrl||'',path);
    // Fetch only the beginning of the private file. Even if Storage ignores Range,
    // cancel streaming after the first chunk to avoid downloading the entire PDF.
    const check=await fetch(signedUrl,{headers:{Range:'bytes=0-4'},signal:AbortSignal.timeout(15000)});
    if(!check.ok || !check.body)return respond(req,{ok:false,stage:'download',error:'private_file_not_readable',status:check.status},200);
    const reader=check.body.getReader();
    const first=await reader.read();
    await reader.cancel().catch(()=>{});
    const bytes=first.value||new Uint8Array();
    const signature=String.fromCharCode(...bytes.slice(0,5));
    if(signature!=='%PDF-')return respond(req,{ok:false,stage:'format',error:'file_is_not_pdf'},200);
    const safe={
      ok:true,product_slug:p.slug,product_active:p.active,stock:p.stock,
      private_bucket:true,object_path:path,page_count:m.page_count,
      gelato_mapping_enabled:m.enabled,signed_url_created:true,
      private_pdf_readable:true,file_signature:'PDF',
      order_submitted:false
    };
    return respond(req,safe);
  }catch(e) {
    console.error('Gelato private health check failed',e instanceof Error?e.message:'unknown');
    return respond(req,{ok:false,error:'health_check_failed'},500);
  }
});
