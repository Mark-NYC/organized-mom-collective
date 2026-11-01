import { choreAreas, choreChoices, recommendedChores, type ChoreArea, type Frequency } from '../../data/chore-recommendations';
import { choreLineIconForText } from '../../data/chore-line-icons';
import { downloadPng } from '../../lib/printable';
import { readToolHandoff } from '../../lib/tool-handoff';

interface Job { id: string; title: string; frequency: Frequency; day: string }
interface State { name: string; age: number; experienced: boolean; areas: ChoreArea[]; jobs: Job[]; style?: 'color' | 'bw'; weeklyDay?: string }
const storageSuffix = ':v2';
const dayNames = ['Any day','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function initChoreBuilder(host: HTMLElement) {
  const $=<T extends HTMLElement>(selector:string)=>host.querySelector<T>(selector)!;
  const name=$<HTMLInputElement>('[data-cb-name]');
  const age=$<HTMLSelectElement>('[data-cb-age]');
  const results=$<HTMLElement>('[data-cb-results]');
  const daily=$<HTMLElement>('[data-cb-daily]');
  const weekly=$<HTMLElement>('[data-cb-weekly]');
  const picker=$<HTMLElement>('[data-cb-picker]');
  const status=$<HTMLElement>('[data-cb-status]');
  const handoff=host.hasAttribute('data-handoff')?readToolHandoff('chore-chart'):null;
  const key=(host.dataset.storageKey||'omc:chore-chart')+(handoff?.key?':'+handoff.key:'')+storageSuffix;
  let state:State={name:'',age:8,experienced:false,areas:['space','kitchen','home','laundry'],jobs:[],style:'color',weeklyDay:'Saturday'};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
  const node=(tag:string,className:string)=>{const e=document.createElement(tag);e.className=className;return e};
  function renderRow(job:Job) {
    const row=node('div',job.frequency==='daily'?'cb-daily-row':'cb-weekly-row');
    const left=node('div','cb-job');
    const src=choreLineIconForText(job.title);
    if(src){const tile=node('span','cb-icon-tile');const category=choreChoices.find(choice=>job.id===choice.id||job.id.startsWith(choice.id+'-'))?.area;tile.dataset.tone=category==='space'?'frost':category==='kitchen'?'apricot':category==='laundry'?'blush':category==='pets'?'evergreen':category==='outdoors'?'mushroom':'leaf';const img=document.createElement('img');img.src=src;img.alt='';tile.append(img);left.append(tile);}
    const input=document.createElement('input');input.value=job.title;input.maxLength=65;input.setAttribute('aria-label','Chore name');
    input.addEventListener('change',()=>{job.title=input.value.trim();save();render()});
    left.append(input);
    const remove=document.createElement('button');remove.className='cb-remove';remove.textContent='×';remove.type='button';remove.title='Remove chore';remove.addEventListener('click',()=>{state.jobs=state.jobs.filter(j=>j.id!==job.id);save();render()});left.append(remove);
    row.append(left);
    if(job.frequency==='daily')for(let i=0;i<7;i++){const check=node('span','cb-day-check');row.append(check);}
    else row.append(node('span','cb-day-check'));
    return row;
  }
  function render() {
    results.dataset.style=state.style==='bw'?'bw':'color';
    host.querySelector<HTMLInputElement>(`input[name="cb-style"][value="${results.dataset.style}"]`)!.checked=true;
    daily.replaceChildren(...state.jobs.filter(j=>j.frequency==='daily').map(renderRow));
    weekly.replaceChildren(...state.jobs.filter(j=>j.frequency==='weekly').map(renderRow));
    const day=state.weeklyDay||'Saturday';
    $<HTMLElement>('[data-cb-weekly-day-label]').textContent=day;
    $<HTMLSelectElement>('[data-cb-weekly-day]').value=day;
    $<HTMLElement>('[data-cb-sheet-name]').textContent=(state.name||'My')+(state.name?'\u2019s':'');
    status.textContent=`${state.jobs.filter(j=>j.frequency==='daily').length} daily and ${state.jobs.filter(j=>j.frequency==='weekly').length} weekly jobs. Edit any job or add another.`;
    $<HTMLElement>('.cb-daily-section').hidden=!daily.children.length;
    $<HTMLElement>('.cb-weekly-section').hidden=!weekly.children.length;
  }
  function showResults(){results.hidden=false;render();results.scrollIntoView({behavior:'smooth',block:'start'})}
  function generate() {
    if(!age.value){age.focus();return;}
    const ageValue=Number(age.value);
    const areas=Array.from(host.querySelectorAll<HTMLInputElement>('[data-cb-area]:checked')).map(x=>x.value as ChoreArea);
    if(!areas.length){alert('Choose at least one household area.');host.querySelector<HTMLInputElement>('[data-cb-area]')?.focus();return;}
    const experienced=host.querySelector<HTMLInputElement>('input[name="cb-level"]:checked')?.value==='experienced';
    const suggested=recommendedChores(ageValue,experienced,areas);
    state={name:name.value.trim(),age:ageValue,experienced,areas,style:state.style||'color',weeklyDay:state.weeklyDay||'Saturday',jobs:[...suggested.daily,...suggested.weekly].map(c=>({id:c.id,title:c.label,frequency:c.frequency,day:'Any day'}))};
    if(!state.jobs.length){status.textContent='Choose another household area for a starter chore';return;}
    save();showResults();
  }
  $<HTMLButtonElement>('[data-cb-generate]').addEventListener('click',()=>{
    if(state.jobs.length&&!confirm('Replace your current chart with new suggested chores?'))return;
    generate();
  });
  host.querySelectorAll<HTMLInputElement>('input[name="cb-style"]').forEach(input=>input.addEventListener('change',()=>{state.style=input.value==='bw'?'bw':'color';results.dataset.style=state.style;save();}));
  $<HTMLSelectElement>('[data-cb-weekly-day]').addEventListener('change',e=>{state.weeklyDay=(e.currentTarget as HTMLSelectElement).value;save();render();});
  $<HTMLButtonElement>('[data-cb-back]').addEventListener('click',()=>host.querySelector('.cb-setup')?.scrollIntoView({behavior:'smooth',block:'start'}));
  $<HTMLButtonElement>('[data-cb-add]').addEventListener('click',()=>{picker.hidden=false;picker.scrollIntoView({behavior:'smooth',block:'nearest'});filterChoices()});
  $<HTMLButtonElement>('[data-cb-picker-close]').addEventListener('click',()=>picker.hidden=true);
  const frequency=$<HTMLSelectElement>('[data-cb-frequency]');
  const filter=$<HTMLSelectElement>('[data-cb-filter]');
  function filterChoices(){host.querySelectorAll<HTMLButtonElement>('[data-cb-choice]').forEach(b=>{b.hidden=b.dataset.frequency!==frequency.value||!!filter.value&&b.dataset.area!==filter.value||Number(b.dataset.age)>state.age;})}
  frequency.addEventListener('change',filterChoices);filter.addEventListener('change',filterChoices);
  function addJob(title:string,freq:Frequency,id?:string){if(!title.trim())return;const count=state.jobs.filter(j=>j.frequency===freq).length;if(count>=4){status.textContent='Four '+freq+' jobs is the limit. Remove one first.';return;}
    state.jobs.push({id:(id||'custom')+'-'+Date.now(),title:title.trim(),frequency:freq,day:'Any day'});save();render();picker.hidden=true;
  }
  host.querySelectorAll<HTMLButtonElement>('[data-cb-choice]').forEach(b=>b.addEventListener('click',()=>{const c=choreChoices.find(x=>x.id===b.dataset.cbChoice);if(c)addJob(c.label,frequency.value as Frequency,c.id)}));
  $<HTMLButtonElement>('[data-cb-custom-add]').addEventListener('click',()=>{const custom=$<HTMLInputElement>('[data-cb-custom]');addJob(custom.value,frequency.value as Frequency);custom.value=''});
  $<HTMLButtonElement>('[data-cb-download]').addEventListener('click',async()=>{
    const sheet=$<HTMLElement>('[data-cb-sheet]');
    const button=$<HTMLButtonElement>('[data-cb-download]');
    await downloadPng(sheet,{filename:(state.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'my')+'-chore-chart.png',width:1056,height:816,layoutHost:results,exportClass:'cb-exporting',button});
  });
  let saved:State|null=null;try{saved=JSON.parse(localStorage.getItem(key)||'null') as State|null;}catch{}
  if(handoff?.name)name.value=handoff.name;
  if(handoff?.age!==undefined)age.value=String(Math.min(18,Math.max(2,handoff.age)));
  if(saved&&Array.isArray(saved.jobs)&&saved.jobs.length){state=saved;name.value=saved.name;age.value=String(saved.age);host.querySelector<HTMLInputElement>(`input[name="cb-level"][value="${saved.experienced?'experienced':'beginner'}"]`)!.checked=true;host.querySelectorAll<HTMLInputElement>('[data-cb-area]').forEach(el=>el.checked=saved!.areas.includes(el.value as ChoreArea));results.hidden=false;render();}
  else if(handoff?.age!==undefined){generate();}
}
