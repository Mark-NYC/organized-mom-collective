import { useState, useRef } from 'react';
import { useCalendar } from '../../lib/calendar/client';
import { useExternalCalendars } from '../../lib/calendar/feeds';
import { localToday, type CalendarEvent } from '../../lib/calendar/recurrence';
import { useToday } from '../../lib/hooks';
import { weekAhead, type WeekAhead, type WeekItem } from '../../lib/family-meeting-support';
import { resolve, MAX_NOTE, MAX_PER_WEEK, sameRef, usePriorities, weekOf } from '../../lib/app/priorities';
import { eventKey, suggestions } from './agenda';

import { sampleWeek } from './sample-calendar';
const displayDate = (date:string) => new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'});
type Pick = {id:string;title:string;item?:WeekItem};
interface Props {
  week:WeekAhead; sample:boolean; chosen:Pick[]; count:number; writable:boolean; info?:string;
  add:(item:WeekItem|string)=>Promise<string|null>; remove:(id:string)=>Promise<string|null>; proceed:()=>void;
}
function Planner({week,sample,chosen,count,writable,info,add,remove,proceed}:Props) {
  const [all,setAll]=useState(false);
  const [writing,setWriting]=useState(false);
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  const [message,setMessage]=useState('');
  const [dismissed,setDismissed]=useState<string[]>([]);
  const picked=new Set(chosen.flatMap(p=>p.item?[eventKey(p.item)]:[]));
  const recommended=suggestions(week,new Set([...picked,...dismissed]));
  async function run(action:()=>Promise<string|null>) {
    if(pending.current)return;
    pending.current=true;setBusy(true);setMessage('');
    try {const err=await action(); if(err)setMessage(err);}
    catch {setMessage('Couldn’t save that change. Try again.');}
    finally {pending.current=false;setBusy(false);}
  }
  function choose(item:WeekItem) {
    const pickedItem=chosen.find(p=>p.item && eventKey(p.item)===eventKey(item));
    return <button type="button" className="secondary" disabled={!writable||busy||(!pickedItem&&count>=MAX_PER_WEEK)}
      aria-label={(pickedItem?'Remove ':'Add ')+item.title} onClick={()=>void run(()=>pickedItem?remove(pickedItem.id):add(item))}>{pickedItem?'Remove':'Add'}</button>;
  }
  return <div className="of-preview agenda">
    <header className="mast"><span>Organized Family</span><small>{sample?'Sample household':'Household calendar'}</small></header>
    <main><p className="kicker">Family Meeting · {displayDate(week.from)} to {displayDate(week.to)}</p>
      <h1>Our week together</h1>
      <section><h2>Worth talking through</h2>
        {recommended.map(({item,reason})=><article className="agenda-card" key={eventKey(item)}>
          <small>{displayDate(item.date)} · {item.time} · {item.source||'Family calendar'}</small>
          <h3>{item.title}</h3><p>{reason}</p><div className="actions">{choose(item)}
          <button type="button" className="text" onClick={()=>setDismissed(v=>[...v,eventKey(item)])}>Pass</button></div></article>)}
        {!recommended.length && <p>{week.count?'Nothing else stands out. Pick anything from the full week.':'No shared events in the coming week. You can still bring a family idea.'}</p>}
      </section>
      <section className="agenda-options"><button type="button" className="secondary" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'Hide full week':'See full week'} · {week.count}</button>
        {all && <div>{week.days.map(day=><div className="row" key={day.date}><h3>{displayDate(day.date)}</h3>
          {day.items.length?day.items.map(item=><div className="agenda-line" key={item.id+item.date}><div><strong>{item.title}</strong><small>{item.time} · {item.source||'Family calendar'}</small></div>{choose(item)}</div>):<small>No events</small>}</div>)}
        <a className="link" href="/app/family-calendar">Open full calendar or create an event</a></div>}
      </section>
      <section className="feature"><h2>Our meeting agenda</h2>
        {chosen.length?<ul>{chosen.map(p=><li key={p.id}><div className="agenda-line"><span>{p.title}{p.item&&<small>{displayDate(p.item.date)} · {p.item.time}</small>}</span><button className="text" disabled={busy||!writable} aria-label={'Remove '+p.title+' from agenda'} onClick={()=>void run(()=>remove(p.id))}>Remove</button></div></li>)}</ul>:<p>Choose what you want to talk about together.</p>}
        {count>=MAX_PER_WEEK&&<p>Five priorities chosen. Remove one to make room.</p>}
        {!sample && <p className="detail">Adding an item saves it to your household’s priorities for this week.</p>}
        {info && <p role="status">{info}</p>}
        {writing?<form className="stack" onSubmit={e=>{e.preventDefault();if(!note.trim())return;void run(async()=>{const err=await add(note.trim());if(!err){setNote('');setWriting(false);}return err;});}}>
          <label>What else needs a conversation?<input autoFocus maxLength={MAX_NOTE} value={note} onChange={e=>setNote(e.target.value)} placeholder="Decide who’s doing Friday pickup"/></label>
          <button className="secondary" disabled={busy||!writable||count>=MAX_PER_WEEK||!note.trim()}>Add to agenda</button></form>:
          <button className="text" disabled={!writable||count>=MAX_PER_WEEK} onClick={()=>setWriting(true)}>Add your own item</button>}
        <p role="status">{message}</p><button className="primary" disabled={busy} onClick={proceed}>Continue to family meeting</button>
      </section>
      <footer>{sample?<><p>This sample uses example events. Sign in on this preview to use calendars shared with your household.</p><div className="links"><a className="link" href="/app/account">Open account</a><a className="link" href="/experimental/sample-meeting/">Open sample Today</a></div></>:<a className="link" href="/app/family-calendar">Manage calendars and Google connection</a>}</footer>
    </main></div>;
}
function SampleAgenda() {
  const [chosen,setChosen]=useState<Pick[]>([]);
  function proceed() {
    const entries=chosen.map(p=>({id:p.item?.id||p.id,title:p.title,...(p.item?{event:Number(p.item.date.slice(-2))-23,time:p.item.time}:{} )}));
    const url=new URL('/experimental/sample-meeting/',location.origin);
    // The fragment carries only deliberately chosen sample items and stays on the device.
    url.hash=new URLSearchParams({agenda:JSON.stringify(entries)}).toString();
    location.assign(url.href);
  }
  return <Planner sample week={sampleWeek} chosen={chosen} count={chosen.length} writable
    add={async value=>{setChosen(old=>[...old,typeof value==='string'?{id:crypto.randomUUID(),title:value}:{id:eventKey(value),title:value.title,item:value}]);return null;}}
    remove={async id=>{setChosen(old=>old.filter(x=>x.id!==id));return null;}} proceed={proceed}/>;
}
function HouseholdAgenda({scope,own,today}:{scope:string;own:CalendarEvent[];today:Date}) {
  const shared=useExternalCalendars(scope,'household');
  const date=localToday(today), start=weekOf(date);
  const priorities=usePriorities(scope,date);
  const events=[...own,...shared.events.filter(e=>e.external?.visibility==='household')];
  const week=weekAhead(events,date,today);
  const items=priorities.items.filter(p=>p.week_of===start);
  const current=items.map(p=>resolve(p,events)).filter(r=>!(r.gone && r.priority.source==='imported' && !r.priority.mine));
  const entries=week.days.flatMap(d=>d.items);
  const chosen=current.map(r=>({id:r.priority.id,title:r.title,item:entries.find(i=>sameRef(r.priority,i.ref))}));
  return <Planner week={week} sample={false} chosen={chosen} count={items.length} writable={priorities.available}
    info={!priorities.available?'Shared priorities are unavailable right now. You can still review the week.':shared.loading?'Refreshing shared calendars…':undefined}
    add={v=>typeof v==='string'?priorities.addNote(v,start):priorities.highlight(v.ref,start)}
    remove={priorities.remove} proceed={()=>location.assign('/app/family/meeting')}/>;
}
export default function CalendarAgenda() {
  const cal=useCalendar(), today=useToday();
  return cal.signedIn && cal.state.scope!=='local'?<HouseholdAgenda key={cal.state.scope} scope={cal.state.scope} today={today} own={Object.values(cal.state.events).filter(e=>!e.external)}/>:<SampleAgenda/>;
}
