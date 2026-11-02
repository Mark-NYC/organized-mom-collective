import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminGate, { type AdminContext } from './AdminGate';
import { adminSelect, auditLog } from '../../lib/admin/session';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/supabase-config';

type Status = 'ready' | 'exported' | 'uploaded' | 'confirmed';
type Pin = { id:string; created_at:string; title:string; description:string; image_url:string; destination_url:string; board:string; category:string; keywords:string; status:Status; publish_at:string|null; export_batch:string|null };
const q = 'select=id,created_at,title,description,image_url,destination_url,board,category,keywords,status,publish_at,export_batch&order=created_at.asc,id.asc&limit=1000';
const escapeCsv = (s: string) => '"' + s.replace(/"/g, '""') + '"';
const isHttp = (s:string) => { try {const u=new URL(s); return u.protocol==='https:' || u.protocol==='http:';} catch {return false;} };
function easternDate(d:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function utcForEastern(day:string,hour:number){ // Determine correct EST/EDT offset for the selected date, including DST.
  const local = new Date(day+'T12:00:00Z');
  const tzName = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(local).find(p=>p.type==='timeZoneName')?.value ?? 'GMT-5';
  const match=tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offset=match?(match[1]==='+'?1:-1)*(Number(match[2])*60+Number(match[3]||0)):-300;
  const ms=Date.parse(day+'T00:00:00Z')+(hour*60-offset)*60_000;
  return new Date(ms).toISOString();
}
function dates(start:string, days:number, weekends:boolean){const out:string[]=[];const d=new Date(start+'T12:00:00Z');for(let i=0;out.length<days&&i<90;i++){const wd=d.getUTCDay();if(weekends||(wd!==0&&wd!==6))out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}return out;}
export default function PinterestQueue(){return <AdminGate>{ctx=><Queue ctx={ctx}/>}</AdminGate>}
function Queue({ctx}:{ctx:AdminContext}){
 const [pins,setPins]=useState<Pin[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [title,setTitle]=useState(''),[image,setImage]=useState(''),[url,setUrl]=useState(''),[board,setBoard]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('Editorial');
 const [exclude,setExclude]=useState<string[]>([]),[include,setInclude]=useState<string[]>([]),[filter,setFilter]=useState('all');
 const [perDay,setPerDay]=useState(5),[days,setDays]=useState(7),[start,setStart]=useState(()=>easternDate(new Date(Date.now()+86400000))),[weekends,setWeekends]=useState(true),[hour,setHour]=useState(10);
 const load=useCallback(async()=>{try{setError('');setPins(await adminSelect<Pin>(ctx.session,'pinterest_pins',q));}catch(e){setError((e as Error).message+' Apply supabase/migrations/20261102_pinterest_queue.sql if this table is missing.');}},[ctx.session]);
 useEffect(()=>{void load()},[load]);
 const request=async(method:string,id:string|null,body:object)=>{
   const res=await fetch(SUPABASE_URL+'/rest/v1/pinterest_pins'+(id?'?id=eq.'+encodeURIComponent(id):''),{method,headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+ctx.session.access_token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
   if(!res.ok)throw new Error((await res.json().catch(()=>({message:'Database error'}))).message||'Save failed');
   return res.json();
 };
 const add=async(e:React.FormEvent)=>{e.preventDefault();if(!isHttp(image)||!isHttp(url)){setError('Image and destination must be complete http(s) URLs.');return;}setBusy(true);try{await request('POST',null,{title,image_url:image,destination_url:url,board,description,category});setTitle('');setImage('');setUrl('');setDescription('');await load();}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const ready=pins.filter(p=>p.status==='ready');
 const wanted=perDay*days;
 const choices=useMemo(()=>{const selected=ready.filter(p=>!exclude.includes(p.id)).slice(0,wanted);for(const p of ready){if(include.includes(p.id)&&!selected.some(x=>x.id===p.id)){if(selected.length>=wanted)selected.pop();selected.push(p)}}return selected.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));},[ready,exclude,include,wanted]);
 const schedule=useMemo(()=>{const ds=dates(start,days,weekends);return choices.map((p,i)=>({...p,date:ds[Math.floor(i/perDay)]||start,time:hour+(i%perDay)*Math.floor(10/perDay)}));},[choices,start,days,weekends,perDay,hour]);
 const download=async()=>{
  if(!schedule.length)return;
  if(schedule.some(p=>!isHttp(p.image_url)||!isHttp(p.destination_url)||!p.board.trim()||!p.title.trim()||p.description.length>500)){setError('One or more pins lack a valid image URL, destination URL, board, or title.');return;}
  if(schedule.length>200){setError('Pinterest allows at most 200 pins per upload. Reduce this batch.');return;}
  if(schedule.some(p=>Date.parse(p.date+'T12:00:00Z')>Date.now()+30*86400000)){setError('Pinterest scheduling is limited to the next 30 days. Shorten this batch.');return;}
  setBusy(true);setError('');
  const batch=crypto.randomUUID();
  const header=['Title','Media URL','Pinterest board','Thumbnail','Description','Link','Publish date','Keywords'];
  const rows=schedule.map(p=>[p.title,p.image_url,p.board,'',p.description,p.destination_url,utcForEastern(p.date,p.time).slice(0,19),p.keywords]);
  const csv=[header,...rows].map(row=>row.map(escapeCsv).join(',')).join('\r\n');
  try{
   for(const p of schedule){await request('PATCH',p.id,{status:'exported',export_batch:batch,publish_at:utcForEastern(p.date,p.time)});}
   const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='pinterest-'+start+'-'+batch.slice(0,8)+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),5000);
   void auditLog(ctx.session,'pinterest.export',batch,{pins:schedule.length});setExclude([]);setInclude([]);await load();
  }catch(e){setError('Export interrupted. Some pins may be marked exported. Review the queue before retrying: '+(e as Error).message)}
  finally{setBusy(false)}
 };
 const change=async(p:Pin,status:Status)=>{setBusy(true);try{await request('PATCH',p.id,{status,...(status==='ready'?{export_batch:null,publish_at:null}:{})});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const visible=pins.filter(p=>filter==='all'||p.status===filter);
 return <div className="mt-6 space-y-8">
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['All pins',pins.length],['Ready',ready.length],['Exported',pins.filter(x=>x.status==='exported').length],['Confirmed',pins.filter(x=>x.status==='confirmed').length]].map(([a,b])=><div key={a} className="rounded border border-rule p-4"><div className="text-sm text-muted">{a}</div><div className="text-3xl font-bold">{b}</div></div>)}</div>
  {error&&<p role="alert" className="rounded border border-red-500 p-3 text-sm">{error}</p>}
  <section className="rounded border border-rule p-4"><h2 className="text-xl font-bold">Next publishing batch</h2><p className="mt-1 text-sm text-muted">Oldest ready pins first. Skip or manually include pins below to override.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-5">
    <label className="text-sm">Start date<input className="mt-1 block w-full border p-2" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label className="text-sm">Pins/day<select className="mt-1 block w-full border p-2" value={perDay} onChange={e=>setPerDay(Number(e.target.value))}>{[3,5,10,20].map(n=><option key={n}>{n}</option>)}</select></label>
    <label className="text-sm">Days<select className="mt-1 block w-full border p-2" value={days} onChange={e=>setDays(Number(e.target.value))}>{[3,7,14,30].map(n=><option key={n}>{n}</option>)}</select></label>
    <label className="text-sm">First hour (ET)<select className="mt-1 block w-full border p-2" value={hour} onChange={e=>setHour(Number(e.target.value))}>{[6,8,10,12].map(n=><option key={n} value={n}>{n}:00</option>)}</select></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={weekends} onChange={e=>setWeekends(e.target.checked)}/>Include weekends</label>
   </div>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm"><strong>{schedule.length}</strong> pins selected for {days} publishing days. {ready.length<perDay*days?'Not enough ready pins for a full batch.':''}</p><button className="btn-primary" disabled={busy||!schedule.length} onClick={()=>void download()}>{busy?'Working…':'Export Pinterest CSV'}</button></div>
   <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Preview dates and pins</summary><ol className="mt-2 max-h-64 overflow-auto text-sm">{schedule.map(p=><li key={p.id} className="border-b py-1">{p.date} · {p.title}</li>)}</ol></details>
  </section>
  <section><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Visual pin queue</h2><select aria-label="Filter pins" value={filter} onChange={e=>setFilter(e.target.value)} className="border p-2">{['all','ready','exported','uploaded','confirmed'].map(x=><option key={x} value={x}>{x}</option>)}</select></div><p className="mt-1 text-sm text-muted">Ordered by creation date, oldest at the top. Exported pins stay in history until confirmed.</p>
   <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{visible.map(p=><article key={p.id} className="overflow-hidden rounded border border-rule"><img loading="lazy" src={p.image_url} alt={p.title} className="aspect-[2/3] w-full bg-band object-cover"/><div className="space-y-2 p-3"><h3 className="text-sm font-semibold">{p.title}</h3><p className="text-xs text-muted">{new Date(p.created_at).toLocaleDateString()} · {p.category} · {p.status}</p><p className="truncate text-xs">{p.board}</p>{p.status==='ready'?<div className="flex flex-wrap gap-2 text-xs"><button className="underline" onClick={()=>setExclude(x=>x.includes(p.id)?x.filter(a=>a!==p.id):[...x,p.id])}>{exclude.includes(p.id)?'Unskip':'Skip'}</button><button className="underline" onClick={()=>setInclude(x=>x.includes(p.id)?x.filter(a=>a!==p.id):[...x,p.id])}>{include.includes(p.id)?'Remove override':'Include in next batch'}</button></div>:<div className="flex flex-wrap gap-2 text-xs">{p.publish_at&&<span>{new Date(p.publish_at).toLocaleDateString()}</span>}{p.status==='exported'&&<button className="underline" disabled={busy} onClick={()=>void change(p,'uploaded')}>Mark uploaded</button>}{p.status==='uploaded'&&<button className="underline" disabled={busy} onClick={()=>void change(p,'confirmed')}>Confirm</button>}<button className="underline" disabled={busy} onClick={()=>void change(p,'ready')}>Return to queue</button></div>}</div></article>)}</div>
  </section>
  <section className="rounded border border-rule p-4"><h2 className="text-xl font-bold">Add a pin</h2><p className="mt-1 text-sm text-muted">Use a publicly accessible image URL. Pin order uses the time added here.</p><form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-2">{[[title,setTitle,'Title'],[image,setImage,'Public image URL'],[url,setUrl,'Destination URL'],[board,setBoard,'Pinterest board']].map(([value,set,label])=><label key={label as string} className="text-sm">{label as string}<input required className="mt-1 w-full border p-2" value={value as string} onChange={e=>(set as (s:string)=>void)(e.target.value)} /></label>)}<label className="text-sm">Category<select className="mt-1 w-full border p-2" value={category} onChange={e=>setCategory(e.target.value)}>{['Editorial','Lifestyle','Infographic','Process','Generator','Product'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm sm:col-span-2">Description<textarea className="mt-1 w-full border p-2" value={description} onChange={e=>setDescription(e.target.value)}/></label><button disabled={busy} className="btn-primary sm:col-span-2">Add to queue</button></form></section>
 </div>;
}
