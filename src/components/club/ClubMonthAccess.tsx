/**
 * Gates the new physical monthly prototypes exactly like the other member kit pages.
 * The static Astro printable starts hidden. Only a household with kit access can view it.
 * Sends the same household-change event used by the unlisted review prototypes.
 */
import {useEffect,useState} from 'react';
import ClubGate,{type ClubContext} from './ClubGate';
import type {Household} from '../../lib/club/profile';
import {routes} from '../../routes';

/**
 * `planHref`: this month's own member page (/app/club/<month>). The mailed QR code opens /club/kits/<slug>; once the
 * household's access is confirmed she is sent on to that page, so the code always lands on the month's real, current
 * resource (never an older copy of it), keeping ?source=mailer.
 */
export default function ClubMonthAccess({slug,planHref}:{slug:string;planHref?:string}){
 return <ClubGate page="kit">{ctx=><MemberMonth ctx={ctx} slug={slug} planHref={planHref}/>}</ClubGate>;
}
function MemberMonth({ctx,slug,planHref}:{ctx:ClubContext;slug:string;planHref?:string}){
 const [state,setState]=useState<'loading'|'denied'|'ready'|'failed'>('loading');
 const [household,setHousehold]=useState<Household|null>(null);
 useEffect(()=>{
  let active=true;
  const host=document.getElementById('club-month-content');
  if(host)host.hidden=true;
  Promise.all([ctx.store.me(),ctx.store.household()]).then(([me,h])=>{
   if(!active)return;
   if(!h||!me.kits.some(k=>k.slug===slug)){setState('denied');return;}
   if(planHref&&!ctx.sample){location.replace(planHref+location.search);return;}
   setHousehold(h);
   // Dispatch before revealing content, so the print view has current household names.
   window.dispatchEvent(new CustomEvent('omc:club-preview-household',{detail:{household:h,sample:ctx.sample}}));
   if(host)host.hidden=false;
   setState('ready');
  }).catch(()=>{if(active)setState('failed')});
  return ()=>{active=false;if(host)host.hidden=true};
 },[ctx.store,ctx.sample,slug]);
 if(state==='ready')return <div className="pb-2"><a className="text-sm underline underline-offset-4" href={ctx.href(routes.clubDashboard)}>← All kits</a><p className="mt-2 text-sm text-warm-soft">Prepared for {household?.displayName??'your family'}. Update names and ages in the Family tab above.</p></div>;
 if(state==='loading')return <p className="py-6 text-warm-soft">Preparing this month for your family…</p>;
 if(state==='denied')return <p role="alert" className="py-6">This month's kit is not available to your account. <a className="underline" href={ctx.href(routes.clubDashboard)}>See your kits</a></p>;
 return <p role="alert" className="py-6">We couldn't load your Club kit. Refresh and try again.</p>;
}
