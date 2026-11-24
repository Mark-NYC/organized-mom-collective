import { useState, useRef } from 'react';
import { useCalendar } from '../../lib/calendar/client';
import { useExternalCalendars } from '../../lib/calendar/feeds';
import { localToday, type CalendarEvent } from '../../lib/calendar/recurrence';
import { useToday } from '../../lib/hooks';
import { weekAhead, type WeekAhead, type WeekItem } from '../../lib/family-meeting-support';
import { resolve, MAX_NOTE, MAX_PER_WEEK, sameRef, usePriorities, weekOf } from '../../lib/app/priorities';
import { eventKey, suggestions } from './agenda';

import WeeklyMeeting from '../ourweek/WeeklyMeeting';
import { sampleWeek } from './sample-calendar';
const displayDate = (date:string) => new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'});
type Pick = {id:string;title:string;item?:WeekItem};
interface Props {
  week:WeekAhead; sample:boolean; chosen:Pick[]; count:number; writable:boolean; info?:string;
  add:(item:WeekItem|string)=>Promise<string|null>; remove:(id:string)=>Promise<string|null>; proceed:(questions:Record<string,string>, extra?:WeekItem)=>void;
}
function Planner({week,sample,chosen,count,writable,info,add,remove,proceed}:Props) {
  const [all,setAll]=useState(false);
  const [writing,setWriting]=useState(false);
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  const [message,setMessage]=useState('');
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [editing,setEditing]=useState(false);
  const [questions,setQuestions]=useState<Record<string,string>>({});
  const picked=new Set(chosen.flatMap(p=>p.item?[eventKey(p.item)]:[]));
  const recommended=suggestions(week,new Set([...picked,...dismissed]));
  const soccer = sample ? week.days.flatMap(day=>day.items).find(i=>i.id==='soccer' && !picked.has(eventKey(i)) && !dismissed.includes(eventKey(i))) : undefined;
  const active = soccer ? {item:soccer,reason:'What could we get ready on Wednesday so Thursday feels easier?'} : recommended[0];
  const question=active ? questions[eventKey(active.item)] ?? active.reason : '';
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
    <main><p className="kicker">{displayDate(week.from)} to {displayDate(week.to)}</p>
      <h1>Family Meeting</h1>
      {sample && <div className="scenario"><strong>First meeting</strong><a href="/experimental/sample-meeting/?scenario=next">Next week</a></div>}
      <section className="conversation"><div className="meeting-rule"><span>Our Focus</span><small>1 of 4</small></div>
      {active ? <article key={eventKey(active.item)}>
        <small>{displayDate(active.item.date)} · {active.item.time} · {active.item.source||'Family calendar'}</small>
        <h2>{active.item.title}</h2>
        {editing?<label>What would you like to talk through?<input autoFocus maxLength={MAX_NOTE} value={question} onChange={e=>setQuestions({...questions,[eventKey(active.item)]:e.target.value})}/></label>:<p>{question}</p>}
        {sample && active.item.id==='soccer' && <div className="prep"><b>Wednesday</b><span>Try packing the soccer bag together after dinner.</span></div>}
        <div className="actions"><button className="primary" disabled={busy||!writable||!question.trim()||count>=MAX_PER_WEEK} onClick={()=>void run(async()=>{
          const err=await add(active.item);
          if(!err)proceed({...questions,[eventKey(active.item)]:question.trim()},active.item);
          return err;
        })}>Keep and talk</button>
        <button className="secondary" onClick={()=>setEditing(!editing)}>{editing?'Done editing':'Change'}</button>
        <button className="text" onClick={()=>{setDismissed(v=>[...v,eventKey(active.item)]);setEditing(false);}}>Skip</button></div></article>:
        <p>What else would make this week easier?</p>}</section>
      <section className="agenda-options"><button type="button" className="secondary" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'Hide full week':'See full week'} · {week.count}</button>
        {all && <div>{week.days.map(day=><div className="row" key={day.date}><h3>{displayDate(day.date)}</h3>
          {day.items.length?day.items.map(item=><div className="agenda-line" key={item.id+item.date}><div><strong>{item.title}</strong><small>{item.time} · {item.source||'Family calendar'}</small></div>{choose(item)}</div>):<small>No events</small>}</div>)}
        <a className="link" href="/app/family-calendar">Open full calendar or create an event</a></div>}
      </section>
      <section className="meeting-options">{chosen.length>0 && <h2>Also on our minds</h2>}
        {chosen.length?<ul>{chosen.map(p=><li key={p.id}><div className="agenda-line"><span>{p.title}{p.item&&<small>{displayDate(p.item.date)} · {p.item.time}</small>}</span><button className="text" disabled={busy||!writable} aria-label={'Remove '+p.title+' from agenda'} onClick={()=>void run(()=>remove(p.id))}>Remove</button></div></li>)}</ul>:null}
        {count>=MAX_PER_WEEK&&<p>Five priorities chosen. Remove one to make room.</p>}
        {!sample && <p className="detail">Adding an item saves it to your household’s priorities for this week.</p>}
        {info && <p role="status">{info}</p>}
        {writing?<form className="stack" onSubmit={e=>{e.preventDefault();if(!note.trim())return;void run(async()=>{const err=await add(note.trim());if(!err){setNote('');setWriting(false);}return err;});}}>
          <label>What else needs a conversation?<input autoFocus maxLength={MAX_NOTE} value={note} onChange={e=>setNote(e.target.value)} placeholder="Decide who’s doing Friday pickup"/></label>
          <button className="secondary" disabled={busy||!writable||count>=MAX_PER_WEEK||!note.trim()}>Add to agenda</button></form>:
          <button className="text" disabled={!writable||count>=MAX_PER_WEEK} onClick={()=>setWriting(true)}>Add your own item</button>}
        <p role="status">{message}</p><button className="primary" disabled={busy} onClick={()=>proceed(questions)}>Continue with our choices</button>
      </section>
      <footer>{sample?<><p>This sample uses example events. Sign in on this preview to use calendars shared with your household.</p><div className="links"><a className="link" href="/app/account">Open account</a><a className="link" href="/experimental/sample-meeting/">Open sample Today</a></div></>:<a className="link" href="/app/family-calendar">Manage calendars and Google connection</a>}</footer>
    </main></div>;
}
function SampleAgenda() {
  const [chosen,setChosen]=useState<Pick[]>([]);
  function proceed(questions:Record<string,string>, extra?:WeekItem) {
    const items=extra?[...chosen,{id:eventKey(extra),title:extra.title,item:extra}]:chosen;
    const entries=items.map(p=>({id:p.item?.id||p.id,title:p.title,question:p.item ? questions[eventKey(p.item)] || suggestions(sampleWeek,new Set()).find(x=>eventKey(x.item)===eventKey(p.item!))?.reason : undefined,...(p.item?{event:Number(p.item.date.slice(-2))-23,time:p.item.time}:{} )}));
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
  const [discussion,setDiscussion]=useState<string[]|null>(null);
  const shared=useExternalCalendars(scope,'household');
  const date=localToday(today), start=weekOf(date);
  const priorities=usePriorities(scope,date);
  const events=[...own,...shared.events.filter(e=>e.external?.visibility==='household')];
  const week=weekAhead(events,date,today);
  const items=priorities.items.filter(p=>p.week_of===start);
  const current=items.map(p=>resolve(p,events)).filter(r=>!(r.gone && r.priority.source==='imported' && !r.priority.mine));
  const entries=week.days.flatMap(d=>d.items);
  const chosen=current.map(r=>({id:r.priority.id,title:r.title,item:entries.find(i=>sameRef(r.priority,i.ref))}));
  if(discussion) return <div className="of-preview"><main><WeeklyMeeting discussionQuestions={discussion}/></main></div>;
  return <Planner week={week} sample={false} chosen={chosen} count={items.length} writable={priorities.available}
    info={!priorities.available?'Shared priorities are unavailable right now. You can still review the week.':shared.loading?'Refreshing shared calendars…':undefined}
    add={v=>typeof v==='string'?priorities.addNote(v,start):priorities.highlight(v.ref,start)}
    remove={priorities.remove} proceed={(questions,extra)=>{const selected=chosen.flatMap(p=>p.item?[p.item]:[]);if(extra)selected.push(extra);setDiscussion([...new Set(selected.map(i=>questions[eventKey(i)]||suggestions(week,new Set()).find(s=>eventKey(s.item)===eventKey(i))?.reason||i.title))]);}}/>;
}
export default function CalendarAgenda() {
  const cal=useCalendar(), today=useToday();
  return cal.signedIn && cal.state.scope!=='local'?<HouseholdAgenda key={cal.state.scope} scope={cal.state.scope} today={today} own={Object.values(cal.state.events).filter(e=>!e.external)}/>:<SampleAgenda/>;
}
