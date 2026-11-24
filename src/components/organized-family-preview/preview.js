import { sampleWeek } from './sample-calendar';
// Only sample data belongs in this route. Each tab keeps its own meeting rehearsal.
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const zones = ['Living Room', 'Bedrooms', 'Entry/Bathroom', 'Kitchen Reset', 'Deep Cleaning', 'Home Project', 'Catch-Up / Reset'];
const examples = [
  { id:'soccer', title:'Soccer practice', attendee:'Philip', event:3, time:'4 PM', day:2, person:'Philip', job:'Pack the soccer bag', done:'Cleats, water and shin guards are by the door.' },
  { id:'entry', title:'Entry/Bathroom', day:2, person:'Andrew', job:'Put shoes and bags away', done:'All shoes on the rack and bags hung by dinner.' },
  { id:'trip', title:'Class field trip', attendee:'Andrew', event:4, time:'9 AM', day:3, person:'Andrew', job:'Pack a field trip lunch', done:'Lunch and a filled bottle are in the fridge.' },
];
const key = 'omc.experimental.family-week.v1';
const fresh = () => ({ week:1, agreements:[], moved:false, checked:false, calendar:'weekly', reviewed:false, draft:null, skipped:[] });
let state = fresh();
try {
  const saved = JSON.parse(sessionStorage.getItem(key));
  if (saved && [1,2,4].includes(saved.week) && Array.isArray(saved.agreements) && Array.isArray(saved.skipped)) state = saved;
} catch { /* This rehearsal also works in memory. */ }
const root = document.querySelector('.of-preview');
const main = root.querySelector('main');
const status = root.querySelector('[role=status]');
let view = 'today';
let calendarOpen = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (action, label, style='secondary') => '<button type="button" class="'+style+'" data-action="'+esc(action)+'">'+esc(label)+'</button>';
const link = (url,label) => '<a class="link" href="'+url+'">'+label+'</a>';
const heading = (over,title) => '<p class="kicker">'+esc(over)+'</p><h1>'+esc(title)+'</h1>';
const feature = html => '<section class="feature">'+html+'</section>';
const weekLabel = () => state.week === 1 ? 'November 23–29' : state.week===2?'November 30–December 6':'December 14–20';
const events = () => state.week===1 ? sampleWeek.days.flatMap((d,event)=>d.items.map(item=>({id:item.id,title:item.title,event,time:item.time}))) : [examples[0], ...(state.week === 4 ? [examples[2]] : []), {id:'library', title:'Library visit',event:5,time:'11 AM'}];
const libraryVisit = { id:'library', title:'Library visit', attendee:'Family', event:5, time:'11 AM', day:4, person:'', job:'Gather library books', done:'Books to return are in the tote by the door.' };
const dayFor = item => item.id === 'entry' && state.moved ? 5 : item.day;
const detail = item => '<li><strong>'+esc(item.person)+'</strong> · '+esc(item.job)+'<br><small>'+days[dayFor(item)]+' · '+esc(item.done)+'</small></li>';
const row = (title,html) => '<div class="row"><h3>'+esc(title)+'</h3>'+html+'</div>';
const select = (name, label, items, value) => '<label>'+label+'<select name="'+name+'">'+items.map(([v,l])=>'<option value="'+esc(v)+'" '+(String(value)===String(v)?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
const field = (name,label,value) => '<label class="wide">'+label+'<input required maxlength="160" name="'+name+'" value="'+esc(value)+'"></label>';
function save() {
  try { sessionStorage.setItem(key,JSON.stringify(state)); } catch { /* Storage is optional. */ }
}
function today() {
  const priorities = state.agreements.filter(a=>a.id!=='entry');
  const cleaning = state.agreements.find(a=>a.id==='entry');
  return heading(weekLabel()+' · Sample week','Today') + feature('<h2>Our family focus</h2>'+
    (priorities.length ? priorities.map(item=>row(item.title,(item.event!=null?'<small>'+days[item.event]+' · '+esc(item.time)+'</small>':'')+'<ul>'+detail(item)+'</ul>')).join('') : '<p>Choose what deserves a little preparation this week.</p>')+
    button(state.draft||state.agreements.length?'meeting':'start', state.draft?'Resume family meeting':state.agreements.length?'Review our plan':'Start family meeting','primary'))+
    '<section><h2>Our week together</h2>'+events().map(e=>row(e.title,'<small>'+days[e.event]+' · '+e.time+'</small>')).join('')+
    (cleaning?row(cleaning.title,'<ul>'+detail(cleaning)+'</ul><small>'+ (state.checked?'Finished':'Planned')+'</small>'):'')+'</section>'+
    '<div class="links">'+button('plans','Plans')+button('cleaning','Cleaning')+button('wall','Wall calendar')+'</div>'+
    (state.reviewed && state.week===1 ? button('advance','Try Week Four','text'):'');
}
function landing() {
  return heading((state.week!==1?'Next week':'First meeting')+' · '+weekLabel(),'Family Meeting')+(state.exampleHistory?'<p class="detail">Example from last meeting: Philip chose soccer prep and Andrew chose the entryway.</p>':'')+
    feature('<h2>'+(state.reviewed?'Your family plan':state.agreements.length?'How is the plan working?':'What matters this week?')+'</h2>'+
    (state.agreements.length?'<ul>'+state.agreements.map(detail).join('')+'</ul>':'<p>Look ahead together and choose one thing that would make the week easier.</p>')+
    '<div class="actions">'+(state.draft?button('resume','Resume meeting','primary'):state.agreements.length?
      button('quick','Everything still works','primary')+button('start','Something changed'):button('start','Start meeting','primary'))+'</div>')+
    (state.reviewed&&state.week===1?button('advance','Try Week Four','text'):'')+
    '<div class="links">'+link('/experimental/organized-family/','First meeting')+link('/app/club/','Family Meeting Club')+'</div>';
}
function start() {
  const available = [...state.agreements, ...[...examples,libraryVisit].filter(x=>(x.id!=='trip'||state.week!==1)&&!state.skipped.includes(x.id)&&!state.agreements.some(a=>a.id===x.id))];
  state.draft={step:0,items:structuredClone(available),selected:available.filter(a=>a.id!=='library'||state.agreements.some(old=>old.id==='library')).map(a=>a.id),index:0,
    agreed:state.agreements.map(a=>a.id),changed:[],review:[],custom:false};
}
function discussion(d) {
  return d.items.filter(a=>d.selected.includes(a.id) && (!state.agreements.some(old=>old.id===a.id) || d.review.includes(a.id)));
}
function editor(item) {
  return '<form id="agreement" class="stack"><div class="fields">'+field('person','Whose part?',item.person)+field('job','What will they do?',item.job)+field('done','What does finished look like?',item.done)+
    (item.id==='entry'?'<p class="detail">During the '+days[dayFor(item)]+' Entry/Bathroom routine</p>':select('day','Preparation day',days.map((v,i)=>[i,v]),item.day))+'</div>'+
    '<div class="actions"><button class="primary">We agree</button>'+button('skip','Leave this out','text')+'</div></form>';
}
function meeting() {
  const d=state.draft;
  if(!d) return landing();
  const titles=['Our Focus','Let’s Talk','Everyone’s Part','Let’s Practice'];
  const items=d.step===2?discussion(d):d.items.filter(a=>d.selected.includes(a.id));
  let body='';
  if(d.step===0) {
    body='<h2>What needs our attention?</h2>'+d.items.map(a=>'<label class="check"><input type="checkbox" data-select="'+esc(a.id)+'" '+(d.selected.includes(a.id)?'checked':'')+'>'+esc(a.title)+'</label>').join('')+
      (state.agreements.length?'<details><summary>Edit a standing agreement</summary>'+state.agreements.filter(a=>d.selected.includes(a.id)).map(a=>'<label class="check"><input type="checkbox" data-review="'+esc(a.id)+'" '+(d.review.includes(a.id)?'checked':'')+'>'+esc(a.job)+'</label>').join('')+'</details>':'')+
      (d.custom?'<form id="idea" class="stack">'+field('title','What would you like to bring up?','')+'<button class="secondary">Add idea</button></form>':button('idea','Add a family idea','text'))+
      '<div>'+button('next','Let’s talk','primary')+'</div>';
  } else if(d.step===1) {
    body='<h2>What would help this week?</h2><p>Give everyone a turn. What could you do yourself? Where would you like a hand?</p>'+
    (items.length?'<ul>'+items.map(a=>'<li><strong>'+esc(a.title)+'</strong>'+(a.question?'<p>'+esc(a.question)+'</p>':'')+'</li>').join('')+'</ul>':'')+
    '<details><summary>Bring in this month’s Club conversation</summary>'+link('/app/club/','Open Family Meeting Club')+'</details>'+button('next','Choose our parts','primary');
  } else if(d.step===2 && items[d.index]) {
    const a=items[d.index];
    body='<p class="kicker">'+(d.agreed.includes(a.id)?'Standing agreement':'For discussion')+'</p><h2>'+esc(a.title)+'</h2>'+
      (a.event!=null?'<p>'+days[a.event]+' · '+esc(a.time)+'</p>':'')+editor(a);
  } else {
    const choices=items.filter(a=>d.changed.includes(a.id)&&d.agreed.includes(a.id));
    const active=choices.find(a=>a.id===d.practice)||choices[0];
    body=active?'<h2>Try one part together.</h2>'+(choices.length>1?select('practice','Choose a part',choices.map(a=>[a.id,a.job]),active.id):'')+
      '<p><strong>'+esc(active.person)+'</strong> · '+esc(active.job)+'</p><p>Show each other what finished looks like. '+esc(active.done)+'</p><p class="detail">Would it help to watch once, try together, or have someone nearby?</p>':'<h2>Anything to practice together?</h2><p>You can finish here if the familiar parts still feel right.</p>';
    body+=button('handoff','See our calendar','secondary')+' '+button('finish','Finish meeting','primary');
  }
  return heading('Family Meeting · '+(d.step+1)+' of 4',titles[d.step])+feature(body)+(d.step>0?button('back','Back','text'):'')+button('pause','Pause meeting','text')+(d.step===2 && d.changed.some(id=>d.agreed.includes(id))?button('finish','Finish with what we agreed','secondary'):'');
}
function cleaning() {
  const a=state.agreements.find(x=>x.id==='entry');
  return heading(weekLabel(),'Cleaning')+feature('<p class="kicker">'+(state.moved?'Saturday · This week only':'Wednesday')+'</p><h2>Entry/Bathroom</h2>'+
    '<label class="check"><input type="checkbox" id="shoes" '+(state.checked?'checked':'')+'>'+esc(a?.job||'Put shoes and bags away')+'</label>'+
    (a?'<small>'+esc(a.person)+' · '+esc(a.done)+'</small>':'')+'<div>'+button('move',state.moved?'Restore Wednesday':'Move to Saturday this week','text')+'</div>')+
    '<section><h2>Regular rhythm</h2>'+days.map((d,i)=>row(d,'<small>'+zones[i]+'</small>')).join('')+'</section><div class="links">'+link('/app/cleaning','Open full Cleaning')+'</div>';
}
function wall() {
  const draft=state.draft;
  const entries=calendarOpen&&draft?draft.items.filter(a=>draft.selected.includes(a.id)&&draft.agreed.includes(a.id)):state.agreements;
  const monthly=state.calendar==='monthly';
  const notes=days.map(()=>[]);
  for(const a of entries) {
    if(a.event!=null) notes[a.event].push((monthly?(a.attendee||'Family')+' · ':'')+a.title+' · '+a.time);
    notes[dayFor(a)].push(a.person+' · '+a.job);
  }
  return heading(weekLabel(),'Wall calendar')+select('calendar','Your calendar',[['weekly','Family Life Planner'],['monthly','Family Schedule Calendar'],['other','Our own calendar']],state.calendar)+
    '<p class="detail">'+(monthly?'Placement guide · Use the person’s row and the date.':state.calendar==='weekly'?'The cleaning prompts are already printed. Add only what helps.':'Choose the entries your family wants to see.')+'</p>'+
    '<div class="days">'+days.map((d,i)=>'<div class="day"><strong>'+d+' '+((state.week===1?23:state.week===2?(i===0?30:0):14)+i)+'</strong>'+
    (state.calendar==='weekly'?'<p><small>Printed · '+zones[i]+'</small></p>':'')+notes[i].map(n=>'<p>'+esc(n)+'</p>').join('')+'</div>').join('')+'</div>'+
    '<p>Who wants to write, draw, or point to where their part goes?</p>'+button(calendarOpen?'finish':'today',calendarOpen?'Finish meeting':'Back to Today','primary');
}
function render(focus=true) {
  const screens={today,meeting,cleaning,wall,plans:()=>heading(weekLabel(),'Plans')+events().map(e=>row(e.title,'<small>'+days[e.event]+' · '+e.time+'</small>')).join('')+'<div class="links">'+link('/app/family-calendar','Open full calendar')+'</div>'};
  main.innerHTML=screens[view]();
  root.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===(view==='meeting'||calendarOpen?'meeting':'today'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(focus){main.focus({preventScroll:true});window.scrollTo(0,0);}
}
function go(next) {view=next;calendarOpen=false;}
function forward(d) {
  d.step++;
  if(d.step===2){d.index=0;if(!discussion(d).length)d.step=3;}
}
function nextItem(d) {if(++d.index>=discussion(d).length)d.step=3;}
root.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.review){const d=state.draft;d.review=el.checked?[...d.review,el.dataset.review]:d.review.filter(id=>id!==el.dataset.review);}
  else if(el.dataset.select){
    const d=state.draft;
    if(el.checked && el.dataset.select!=='entry' && d.selected.filter(id=>id!=='entry').length>=5){el.checked=false;status.textContent='Choose up to five weekly priorities.';return;}
    d.selected=el.checked?[...d.selected,el.dataset.select]:d.selected.filter(id=>id!==el.dataset.select);
  } else if(el.name==='calendar'){state.calendar=el.value;render(false);}
  else if(el.name==='practice'){state.draft.practice=el.value;render(false);}
  else if(el.id==='shoes'){state.checked=el.checked;}
  save();
});
root.addEventListener('input',e=>{
  const form=e.target.closest('#agreement');
  if(!form)return;
  const d=state.draft;
  const item=discussion(d)[d.index];
  const name=e.target.name;
  if(!['person','job','done','day'].includes(name))return;
  item[name]=name==='day'?Number(e.target.value):e.target.value;
  d.agreed=d.agreed.filter(id=>id!==item.id);
  const label=main.querySelector('.feature .kicker');
  if(label)label.textContent='For discussion';
  save();
});
root.addEventListener('submit',e=>{
  e.preventDefault();
  const d=state.draft, values=new FormData(e.target);
  for(const [name,v] of values)if(!String(v).trim()){const input=e.target.elements.namedItem(name);input.setCustomValidity('Enter a few words.');input.reportValidity();input.setCustomValidity('');return;}
  if(e.target.id==='idea'){
    if(d.selected.filter(id=>id!=='entry').length>=5){status.textContent='Choose up to five weekly priorities.';return;}
    const item={id:crypto.randomUUID(),title:values.get('title').trim(),person:'',job:'',done:'',day:0};
    d.items.push(item);d.selected.push(item.id);d.custom=false;
  } else if(e.target.id==='agreement'){
    const item=discussion(d)[d.index];
    const updated={...item,person:values.get('person').trim(),job:values.get('job').trim(),done:values.get('done').trim(),day:values.has('day')?Number(values.get('day')):item.day};
    if(!d.agreed.includes(item.id)||JSON.stringify(updated)!==JSON.stringify(item))d.changed.push(item.id);
    Object.assign(item,updated);
    if(!d.agreed.includes(item.id))d.agreed.push(item.id);
    nextItem(d);
  }
  save();render();
});
root.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;
  const action=target.dataset.action||target.dataset.view;if(!action)return;
  const d=state.draft;
  if(['today','meeting','cleaning','plans','wall'].includes(action))go(action);
  else if(action==='start'){start();go('meeting');}
  else if(action==='resume')go('meeting');
  else if(action==='pause')go('today');
  else if(action==='idea')d.custom=true;
  else if(action==='next')forward(d);
  else if(action==='back'){if(d.step===2&&d.index>0)d.index--;else if(d.step===3&&discussion(d).length){d.step=2;d.index=discussion(d).length-1;}else d.step=d.step===3?1:d.step-1;}
  else if(action==='skip'){const id=discussion(d)[d.index].id;d.agreed=d.agreed.filter(x=>x!==id);nextItem(d);}
  else if(action==='move')state.moved=!state.moved;
  else if(action==='handoff'){go('wall');calendarOpen=true;}
  else if(action==='quick'||action==='finish'){
    if(action==='finish'){
      state.agreements=d.items.filter(a=>d.selected.includes(a.id)&&d.agreed.includes(a.id));
      state.skipped=[...new Set([...state.skipped,...d.items.filter(a=>a.id!=='library'&&!state.agreements.some(x=>x.id===a.id)).map(a=>a.id)])];
    }
    state.draft=null;state.reviewed=true;go('today');status.textContent='Meeting finished.';
  } else if(action==='advance'){state.week=4;state.reviewed=false;state.moved=false;state.checked=false;state.draft=null;go('meeting');}
  save();render();
});
// A new rehearsal starts only when the family explicitly continues from the sample agenda.
const incoming = new URLSearchParams(location.hash.slice(1)).get('agenda');
if (incoming) {
  try {
    const entries = JSON.parse(incoming);
    if (Array.isArray(entries) && entries.length <= 5 && entries.every(e =>
      e && typeof e.id === 'string' && typeof e.title === 'string' && e.title.trim() &&
      (e.event == null || (Number.isInteger(e.event) && e.event >= 0 && e.event < 7 && typeof e.time === 'string')))) {
      state = fresh();
      start();
      const agenda = entries.map(e => ({
        person:'', job:'', done:'', day:e.event ?? 0,
        ...([...examples,libraryVisit].find(sample => sample.id === e.id) || {}),
        id:e.id, title:e.title, question:typeof e.question==='string'?e.question:'', ...(e.event == null ? {} : {event:e.event,time:e.time}),
      }));
      state.draft.items = agenda;
      state.draft.selected = agenda.map(item => item.id);
      state.draft.step = 1;
      go('meeting');
      save();
    }
  } catch { /* An invalid link opens the regular sample. */ }
  history.replaceState(null,'',location.pathname + location.search);
}
if (new URLSearchParams(location.search).get('scenario')==='next') {
  const hasHistory=state.reviewed||state.agreements.length>0;
  if(!hasHistory){state=fresh();state.agreements=structuredClone([examples[0],examples[1]]);state.exampleHistory=true;}
  state.week=2;state.moved=false;state.checked=false;state.draft=null;go('meeting');save();
  history.replaceState(null,'',location.pathname);
}
render(false);
