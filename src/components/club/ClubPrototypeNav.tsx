/**
 * Shared prototype navigation for the November, December and January Club proofs.
 * Uses the existing FamilyForm and Club sample store, not a second profile model.
 * Previews remain explicitly demos: family changes stay in this tab.
 */
import {useEffect,useState} from 'react';
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
 {slug:'april',label:'April',url:'/club/april-preview/'}
] as const;
const SAMPLE_SESSION='omc:club:active-preview-sample';
const isKnown=(id:string)=>sampleHouseholds.some(x=>x.id===id&&x.id!=='new');
const selected=()=>{try{const q=new URLSearchParams(location.search).get('sample');if(q&&isKnown(q))return q;const saved=sessionStorage.getItem(SAMPLE_SESSION);return saved&&isKnown(saved)?saved:'rivera'}catch{return 'rivera'}};

export default function ClubPrototypeNav({month}:{month:'november'|'december'|'january'|'february'|'march'|'april'}){
 const [sample,setSample]=useState(selected);
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
 const href=(url:string)=>url+'?sample='+encodeURIComponent(sample);
 return <div className="cproto-shell" data-club-chrome>
  <header className="cproto-top">
   <div className="cproto-inner">
    <a className="cproto-brand" href="/club">Organized Family Club</a>
    <nav aria-label="Club">
     <button type="button" className={tab==='kits'?'cproto-active':''} onClick={()=>setTab('kits')}>Kits</button>
     <button type="button" className={tab==='family'?'cproto-active':''} onClick={()=>setTab('family')}>Family</button>
    </nav>
   </div>
  </header>
  <div className="cproto-inner cproto-sample">
   <label>Preview family <select value={sample} onChange={e=>{setTab('kits');setSample(e.target.value)}}>
    {sampleHouseholds.filter(s=>s.id!=='new').map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
   </select></label>
   <span>Sample preview · family changes save in this browser tab only</span>
  </div>
  {tab==='kits'?<nav aria-label="Preview months" className="cproto-months cproto-inner">{months.map(m=>
   <a key={m.slug} aria-current={month===m.slug?'page':undefined} href={href(m.url)}>{m.label}</a>)}</nav>
   :<section className="cproto-inner cproto-family">
    <p className="cproto-overline">ORGANIZED FAMILY CLUB / FAMILY SETTINGS</p>
    <p>These are the same family settings used in the Club member pages. Save your edits and return to any month to see the updated sample profile.</p>
    {household?<FamilyForm key={sample+'-'+household.profileVersion} household={household} mode="edit" submitLabel="Save our family" onSave={async input=>{
      const updated=await sampleStore(sample)!.saveHousehold(input);
      setHousehold(updated);setStatus('Saved for all six monthly previews in this browser tab.');
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
   .cproto-sample{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;background:#f6f6f5;font-size:12px}
   .cproto-sample label{display:flex;align-items:center;gap:12px;font-weight:600}
   .cproto-sample select{font-size:12px;padding:8px;border:1px solid #b8b8b8;background:#fff;color:#454545;max-width:275px}
   .cproto-sample span{color:#686868}
   .cproto-months{display:flex;gap:20px;padding-top:14px;padding-bottom:14px;border-bottom:1px solid #e3e3e3}
   .cproto-months a{font-size:13px;color:#454545;text-decoration:none;padding:6px 0}
   .cproto-months a[aria-current=page]{font-weight:700;border-bottom:2px solid #454545}
   .cproto-family{padding-top:35px;padding-bottom:40px;max-width:850px}
   .cproto-family>p{font-size:14px;line-height:1.6;margin:0 0 15px}
   .cproto-overline{font-weight:600;letter-spacing:.14em;font-size:10px!important}
   .cproto-return{border:0;background:none;text-decoration:underline;min-height:45px;cursor:pointer;color:#454545;margin:18px 0}
   .cproto-status{color:#376c50;font-weight:600}
  `}</style>
 </div>
}
