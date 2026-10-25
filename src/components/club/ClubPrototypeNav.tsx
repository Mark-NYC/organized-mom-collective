/**
 * Shared prototype navigation for the November, December and January Club proofs.
 * Uses the existing FamilyForm and Club sample store, not a second profile model.
 * Previews remain explicitly demos: family changes stay in this tab.
 */
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import FamilyForm from './FamilyForm';
import {sampleHouseholds} from '../../data/club/samples';
import {sampleStore} from '../../lib/club/store';
import type {Household} from '../../lib/club/profile';

const months=[
 {slug:'november',label:'November',url:'/club/worksheet-generator/'},
 {slug:'december',label:'December',url:'/club/december-preview/'},
 {slug:'january',label:'January',url:'/preview/january-habit-cards'},
 {slug:'february',label:'February',url:'/club/february-preview/'},
 {slug:'march',label:'March',url:'/club/march-preview/'},
 {slug:'april',label:'April',url:'/club/april-preview/'},
 {slug:'may',label:'May',url:'/club/may-preview/'},
 {slug:'june',label:'June',url:'/club/june-preview/'},
 {slug:'july',label:'July',url:'/club/july-preview/'},
 {slug:'august',label:'August',url:'/club/august-preview/'},
 {slug:'september',label:'September',url:'/club/september-preview/'},
 {slug:'october',label:'October',url:'/club/october-preview/'}
] as const;
const SAMPLE_SESSION='omc:club:active-preview-sample';
const isKnown=(id:string)=>sampleHouseholds.some(x=>x.id===id&&x.id!=='new');
const selected=()=>{try{const q=new URLSearchParams(location.search).get('sample');if(q&&isKnown(q))return q;const saved=sessionStorage.getItem(SAMPLE_SESSION);return saved&&isKnown(saved)?saved:'rivera'}catch{return 'rivera'}};

export default function ClubPrototypeNav({month}:{month:'november'|'december'|'january'|'february'|'march'|'april'|'may'|'june'|'july'|'august'|'september'|'october'}){
 const [sample,setSample]=useState(selected);
 const shellRef=useRef<HTMLDivElement>(null);
 const [tab,setTab]=useState<'kits'|'family'>('kits');
 const [household,setHousehold]=useState<Household|null>(null);
 const [status,setStatus]=useState('');
 useEffect(()=>{
  const main=document.getElementById('club-month-content');
  if(main) main.hidden=tab==='family';
  return ()=>{if(main)main.hidden=false};
 },[tab]);
 useEffect(()=>{
  try{sessionStorage.setItem(SAMPLE_SESSION,sample)}catch{}
  const store=sampleStore(sample);
  store?.household().then(h=>{setHousehold(h);window.dispatchEvent(new CustomEvent('omc:club-preview-household',{detail:{household:h,sample}}))})
   .catch(()=>setStatus('Unable to load the sample family.'));
 },[sample]);
 // Keep both fixed preview panels aligned with the live navigation height.
 useLayoutEffect(()=>{
  const shell=shellRef.current;
  if(!shell)return;
  const sync=()=>{
   const bottom=Math.ceil(shell.getBoundingClientRect().bottom)+'px';
   document.documentElement.style.setProperty('--msc-nav-height',bottom);
   document.documentElement.style.setProperty('--adc-nav-height',bottom);
  };
  sync();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(sync):null;
  observer?.observe(shell);
  window.addEventListener('resize',sync);
  return ()=>{observer?.disconnect();window.removeEventListener('resize',sync)};
 },[tab]);
 const href=(url:string)=>url+'?sample='+encodeURIComponent(sample);
 return <div ref={shellRef} className="cproto-shell" data-club-chrome>
  <header className="cproto-top">
   <div className="cproto-inner">
    <a className="cproto-brand" href="/club">Organized Family Club</a>
    <nav aria-label="Club">
     <button type="button" className={tab==='kits'?'cproto-active':''} onClick={()=>setTab('kits')}>Kits</button>
     <button type="button" className={tab==='family'?'cproto-active':''} onClick={()=>setTab('family')}>Family</button>
     <label className="cproto-header-sample"><span className="cproto-picker-label">Preview family</span><select aria-label="Preview family" value={sample} onChange={e=>{setTab('kits');setSample(e.target.value)}}>
      {sampleHouseholds.filter(s=>s.id!=='new').map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
     </select></label>
    </nav>
   </div>
  </header>
  {tab==='kits'?<>
   <nav aria-label="Preview months" className="cproto-months cproto-inner">{months.map(m=>
    <a key={m.slug} aria-current={month===m.slug?'page':undefined} href={href(m.url)}>{m.label}</a>)}</nav>
   <div className="cproto-month-mobile cproto-inner">
    <label htmlFor="cproto-month-picker">Preview month</label>
    <select id="cproto-month-picker" value={month} onChange={e=>{const next=months.find(m=>m.slug===e.target.value);if(next)window.location.assign(href(next.url))}}>
     {months.map(m=><option key={m.slug} value={m.slug}>{m.label}</option>)}
    </select>
   </div>
  </>
   :<section className="cproto-inner cproto-family">
    <p className="cproto-overline">ORGANIZED FAMILY CLUB / FAMILY SETTINGS</p>
    <p>These are the same family settings used in the Club member pages. Save your edits and return to any month to see the updated sample profile.</p>
    {household?<FamilyForm key={sample+'-'+household.profileVersion} household={household} mode="edit" submitLabel="Save our family" onSave={async input=>{
      const updated=await sampleStore(sample)!.saveHousehold(input);
      setHousehold(updated);setStatus('Saved for all monthly previews in this browser tab.');
      window.dispatchEvent(new CustomEvent('omc:club-preview-household',{detail:{household:updated,sample}}));
     }}/>:<p>Loading family settings…</p>}
    {status&&<p role="status" className="cproto-status">{status}</p>}
    <button type="button" className="cproto-return" onClick={()=>setTab('kits')}>← Back to {month[0].toUpperCase()+month.slice(1)} kit</button>
   </section>}
  <style>{`
   .cproto-shell{font-family:Montserrat,Arial,sans-serif;color:#454545;background:#fff}
   .cproto-top{border-bottom:1px solid #dcdcdc;background:#fafaf8}
   .cproto-inner{max-width:1440px;padding:12px clamp(18px,3.5vw,54px);margin:auto}
   .cproto-top .cproto-inner{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
   .cproto-brand{font-family:Georgia,serif;font-size:18px;text-decoration:none;color:#3d3d3d}
   .cproto-top nav{display:flex;gap:9px}
   .cproto-top nav button{border:0;background:none;min-height:44px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;color:#454545}
   .cproto-top nav button.cproto-active{border-bottom:2px solid #454545}
   .cproto-header-sample{display:flex;align-items:center;gap:9px;margin-left:8px;font-size:11px;font-weight:600;white-space:nowrap}
   .cproto-header-sample select{max-width:220px;min-width:135px;min-height:36px;padding:6px 26px 6px 9px;border:1px solid #b8b8b8;border-radius:4px;background:#fff;color:#454545;font:600 12px Montserrat,Arial,sans-serif;cursor:pointer}
   .cproto-months{display:flex;gap:20px;padding-top:14px;padding-bottom:14px;border-bottom:1px solid #e3e3e3}
   .cproto-months a{font-size:13px;color:#454545;text-decoration:none;padding:6px 0}
   .cproto-months a[aria-current=page]{font-weight:700;border-bottom:2px solid #454545}
   .cproto-month-mobile{display:none}
   @media(max-width:700px){
    .cproto-top .cproto-inner{flex-wrap:nowrap;gap:6px;padding-top:7px;padding-bottom:7px}
    .cproto-brand{font-size:16px;line-height:1.2}
    .cproto-top nav{gap:2px;flex-shrink:0}
    .cproto-top nav button{padding:7px 9px;font-size:12px}
    .cproto-top .cproto-inner{flex-wrap:wrap;justify-content:space-between;gap:5px;padding-top:8px;padding-bottom:8px}
    .cproto-brand{font-size:15px}
    .cproto-top nav{flex:1 1 auto;justify-content:flex-end;min-width:0;gap:0}
    .cproto-top nav button{padding:6px 7px;font-size:12px;min-height:38px}
    .cproto-header-sample{gap:0;margin-left:5px;min-width:0}
    .cproto-picker-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .cproto-header-sample select{min-width:0;max-width:clamp(105px,29vw,160px);width:29vw;min-height:36px;padding:5px 18px 5px 6px;font-size:11px}
    .cproto-months{display:none}
    .cproto-month-mobile{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:9px;padding-bottom:9px;border-bottom:1px solid #e3e3e3}
    .cproto-month-mobile label{font-size:12px;font-weight:700;white-space:nowrap}
    .cproto-month-mobile select{flex:1;min-width:0;max-width:230px;min-height:42px;border:1px solid #b8b8b8;border-radius:4px;background:#fff;color:#454545;padding:8px 12px;font:600 13px Montserrat,Arial,sans-serif}
   }
   .cproto-family{padding-top:35px;padding-bottom:40px;max-width:850px}
   .cproto-family>p{font-size:14px;line-height:1.6;margin:0 0 15px}
   .cproto-overline{font-weight:600;letter-spacing:.14em;font-size:10px!important}
   .cproto-return{border:0;background:none;text-decoration:underline;min-height:45px;cursor:pointer;color:#454545;margin:18px 0}
   .cproto-status{color:#376c50;font-weight:600}
  `}</style>
 </div>
}
