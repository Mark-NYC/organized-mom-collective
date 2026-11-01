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
  const mobileName=$<HTMLInputElement>('[data-cb-mobile-name]');
  const mobileAge=$<HTMLSelectElement>('[data-cb-mobile-age]');
  const mobileCreate=$<HTMLButtonElement>('[data-cb-mobile-create]');
  const customizeToggle=$<HTMLButtonElement>('[data-cb-customize-toggle]');
  const syncMobile=()=>{mobileName.value=name.value;mobileAge.value=age.value;};
  mobileName.addEventListener('input',()=>{name.value=mobileName.value;state.name=mobileName.value.trim();if(state.jobs.length){save();render();}});
  mobileAge.addEventListener('change',()=>{age.value=mobileAge.value;if(state.jobs.length){state.age=Number(age.value);save();}});
  name.addEventListener('input',syncMobile);
  age.addEventListener('change',syncMobile);
  customizeToggle.addEventListener('click',()=>{const open=host.dataset.mobileCustomize!=='true';host.dataset.mobileCustomize=String(open);customizeToggle.setAttribute('aria-expanded',String(open));});
  const results=$<HTMLElement>('[data-cb-results]');
  const daily=$<HTMLElement>('[data-cb-daily]');
  const weekly=$<HTMLElement>('[data-cb-weekly]');
  const picker=$<HTMLElement>('[data-cb-picker]');
  const sheet=$<HTMLElement>('[data-cb-sheet]');
  const frame=$<HTMLElement>('[data-cb-preview-frame]');
  const zoom=$<HTMLElement>('[data-cb-zoom-overlay]');
  const zoomStage=$<HTMLElement>('[data-cb-zoom-stage]');
  const downloadButtons=host.querySelectorAll<HTMLButtonElement>('[data-cb-download],[data-cb-mobile-download]');
  const fitPreview=()=>{if(window.innerWidth>800){sheet.style.transform='';frame.style.height='';return;}const available=frame.clientWidth;if(!available)return;const scale=available/1056;sheet.style.transform=`scale(${scale})`;frame.style.height=`${Math.ceil(Math.max(816,sheet.scrollHeight)*scale)}px`;};
  const schedulePreview=()=>requestAnimationFrame(fitPreview);
  const status=$<HTMLElement>('[data-cb-status]');
  const panel=$<HTMLElement>('[data-cb-panel]');
  const toolbar=$<HTMLElement>('[data-cb-toolbar]');
  const refreshPanel=()=>{const generated=state.jobs.length>0;panel.dataset.generated=String(generated);toolbar.hidden=!generated;mobileCreate.hidden=generated;customizeToggle.hidden=!generated;if(!generated)delete panel.dataset.editing;};
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
    const mobileButton=host.querySelector<HTMLButtonElement>('[data-cb-mobile-download]');if(mobileButton)mobileButton.disabled=!state.jobs.length;
    results.dataset.style=state.style==='bw'?'bw':'color';
    host.querySelector<HTMLInputElement>(`input[name="cb-style"][value="${results.dataset.style}"]`)!.checked=true;
    daily.replaceChildren(...state.jobs.filter(j=>j.frequency==='daily').map(renderRow));
    weekly.replaceChildren(...state.jobs.filter(j=>j.frequency==='weekly').map(renderRow));
    const day=state.weeklyDay||'Saturday';
    $<HTMLElement>('[data-cb-weekly-day-label]').textContent=day;
    $<HTMLSelectElement>('[data-cb-weekly-day]').value=day;
    $<HTMLElement>('[data-cb-sheet-name]').textContent=(state.name||'My')+(state.name?'\u2019s':'');
    $<HTMLElement>('[data-cb-ready-name]').textContent=state.name?`${state.name}’s`:'Your';
    status.textContent=`${state.jobs.filter(j=>j.frequency==='daily').length} daily · ${state.jobs.filter(j=>j.frequency==='weekly').length} weekly jobs. Tap a chore to edit it.`;
    $<HTMLElement>('.cb-daily-section').hidden=!daily.children.length;
    syncMobile();
    $<HTMLElement>('.cb-weekly-section').hidden=!weekly.children.length;
    schedulePreview();
  }
  function showResults(){results.hidden=false;render();refreshPanel();delete panel.dataset.editing;panel.scrollIntoView({behavior:'smooth',block:'start'})}
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
  const generateButton=$<HTMLButtonElement>('[data-cb-generate]');
  const applyButton=$<HTMLButtonElement>('[data-cb-apply]');
  const regenerateButton=$<HTMLButtonElement>('[data-cb-regenerate]');
  const setupHelp=$<HTMLElement>('[data-cb-setup-help]');
  const updateSetupMode=()=>{const existing=state.jobs.length>0;generateButton.hidden=existing;applyButton.hidden=!existing;regenerateButton.hidden=!existing;setupHelp.textContent=existing?'Save details without replacing your chores, or request a fresh set of suggestions.':'Start small. You can always add jobs later.';};
  mobileCreate.addEventListener('click',()=>{if(!mobileAge.value){mobileAge.focus();return;}generate();updateSetupMode();});
  generateButton.addEventListener('click',()=>{
    generate();updateSetupMode();
  });
  applyButton.addEventListener('click',()=>{
    if(!age.value){age.focus();return;}
    const areas=Array.from(host.querySelectorAll<HTMLInputElement>('[data-cb-area]:checked')).map(x=>x.value as ChoreArea);
    if(!areas.length){host.querySelector<HTMLDetailsElement>('.cb-areas-details')!.open=true;return;}
    state.name=name.value.trim();state.age=Number(age.value);state.experienced=host.querySelector<HTMLInputElement>('input[name="cb-level"]:checked')?.value==='experienced';state.areas=areas;save();render();delete panel.dataset.editing;panel.scrollIntoView({behavior:'smooth',block:'start'});
  });
  regenerateButton.addEventListener('click',()=>{if(!confirm('Replace your customized chore list with new suggestions?'))return;generate();updateSetupMode();});
  host.querySelectorAll<HTMLInputElement>('input[name="cb-style"]').forEach(input=>input.addEventListener('change',()=>{state.style=input.value==='bw'?'bw':'color';results.dataset.style=state.style;save();}));
  $<HTMLSelectElement>('[data-cb-weekly-day]').addEventListener('change',e=>{state.weeklyDay=(e.currentTarget as HTMLSelectElement).value;save();render();});
  $<HTMLButtonElement>('[data-cb-back]').addEventListener('click',()=>{updateSetupMode();panel.dataset.editing=panel.dataset.editing==='true'?'false':'true';panel.scrollIntoView({behavior:'smooth',block:'start'});});
  $<HTMLButtonElement>('[data-cb-add]').addEventListener('click',()=>{picker.hidden=false;picker.scrollIntoView({behavior:'smooth',block:'nearest'});filterChoices()});
  $<HTMLButtonElement>('[data-cb-picker-close]').addEventListener('click',()=>picker.hidden=true);
  const frequency=$<HTMLSelectElement>('[data-cb-frequency]');
  const filter=$<HTMLSelectElement>('[data-cb-filter]');
  const search=$<HTMLInputElement>('[data-cb-search]');
  function filterChoices(){const term=search.value.trim().toLowerCase();host.querySelectorAll<HTMLButtonElement>('[data-cb-choice]').forEach(b=>{b.hidden=b.dataset.frequency!==frequency.value||!!filter.value&&b.dataset.area!==filter.value||Number(b.dataset.age)>state.age||!!term&&!b.textContent?.toLowerCase().includes(term);})}
  host.querySelectorAll<HTMLButtonElement>('[data-cb-frequency-tab]').forEach(button=>button.addEventListener('click',()=>{
    frequency.value=button.dataset.cbFrequencyTab||'daily';
    host.querySelectorAll<HTMLButtonElement>('[data-cb-frequency-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));
    filterChoices();
  }));
  frequency.addEventListener('change',filterChoices);filter.addEventListener('change',filterChoices);search.addEventListener('input',filterChoices);
  function addJob(title:string,freq:Frequency,id?:string){if(!title.trim())return;const count=state.jobs.filter(j=>j.frequency===freq).length;if(count>=4){status.textContent='Four '+freq+' jobs is the limit. Remove one first.';return;}
    state.jobs.push({id:(id||'custom')+'-'+Date.now(),title:title.trim(),frequency:freq,day:'Any day'});save();render();picker.hidden=true;
  }
  host.querySelectorAll<HTMLButtonElement>('[data-cb-choice]').forEach(b=>b.addEventListener('click',()=>{const c=choreChoices.find(x=>x.id===b.dataset.cbChoice);if(c)addJob(c.label,frequency.value as Frequency,c.id)}));
  $<HTMLButtonElement>('[data-cb-custom-add]').addEventListener('click',()=>{const custom=$<HTMLInputElement>('[data-cb-custom]');addJob(custom.value,frequency.value as Frequency);custom.value=''});

  const pickDialog=$<HTMLDialogElement>('[data-cb-pick-dialog]');
  const pickGrid=$<HTMLElement>('[data-cb-pick-grid]');
  const pickCount=$<HTMLElement>('[data-cb-pick-count]');
  const pickError=$<HTMLElement>('[data-cb-pick-error]');
  const pickTitle=$<HTMLElement>('[data-cb-pick-title]');
  let pickFrequency:Frequency='daily';
  let draft:Job[]=[];
  const drawPick=()=>{
    pickTitle.textContent=pickFrequency==='daily'?'Choose daily chores':'Choose weekly chores';
    host.querySelectorAll<HTMLButtonElement>('[data-cb-pick-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cbPickTab===pickFrequency)));
    const active=draft.filter(j=>j.frequency===pickFrequency);
    pickCount.textContent=active.length+' of 4 selected';
    pickGrid.replaceChildren();
    const eligible=choreChoices.filter(choice=>choice.frequency===pickFrequency&&choice.minAge<=state.age);
    for(const choice of eligible){
      const selected=active.some(j=>j.id===choice.id||j.id.startsWith(choice.id+'-'));
      const button=document.createElement('button');button.type='button';button.className='cb-pick-card';button.setAttribute('aria-pressed',String(selected));
      const src=choreLineIconForText(choice.label);
      if(src){const img=document.createElement('img');img.src=src;img.alt='';button.append(img);}
      const label=document.createElement('span');label.textContent=choice.label;button.append(label);
      button.addEventListener('click',()=>{
        pickError.textContent='';
        if(selected)draft=draft.filter(j=>!(j.frequency===pickFrequency&&(j.id===choice.id||j.id.startsWith(choice.id+'-'))));
        else if(active.length>=4){pickError.textContent='Choose up to four. Remove one before adding another.';return;}
        else draft.push({id:choice.id+'-'+Date.now(),title:choice.label,frequency:pickFrequency,day:'Any day'});
        drawPick();
      });
      pickGrid.append(button);
    }
    for(const job of active.filter((j: Job): boolean => !eligible.some((choice): boolean => j.id===choice.id || j.id.startsWith(choice.id+'-')))){
      const button=document.createElement('button');button.type='button';button.className='cb-pick-card';button.setAttribute('aria-pressed','true');
      const src=choreLineIconForText(job.title);if(src){const img=document.createElement('img');img.src=src;img.alt='';button.append(img);}
      const label=document.createElement('span');label.textContent=job.title;button.append(label);
      button.addEventListener('click',()=>{draft=draft.filter(j=>j!==job);drawPick();});
      pickGrid.append(button);
    }
  };
  const openPick=(freq:Frequency)=>{pickFrequency=freq;draft=state.jobs.map(j=>({...j}));pickError.textContent='';drawPick();pickDialog.showModal();};
  host.querySelectorAll<HTMLButtonElement>('[data-cb-pick]').forEach(b=>b.addEventListener('click',()=>openPick(b.dataset.cbPick as Frequency)));
  host.querySelectorAll<HTMLButtonElement>('[data-cb-pick-tab]').forEach(b=>b.addEventListener('click',()=>{pickFrequency=b.dataset.cbPickTab as Frequency;pickError.textContent='';drawPick();}));
  const closePick=()=>pickDialog.close();
  $<HTMLButtonElement>('[data-cb-pick-close]').addEventListener('click',closePick);
  $<HTMLButtonElement>('[data-cb-pick-cancel]').addEventListener('click',closePick);
  $<HTMLButtonElement>('[data-cb-pick-save]').addEventListener('click',()=>{state.jobs=draft;save();render();closePick();});
  $<HTMLButtonElement>('[data-cb-pick-custom-add]').addEventListener('click',()=>{
    const input=$<HTMLInputElement>('[data-cb-pick-custom]');const title=input.value.trim();
    if(!title)return;
    if(draft.filter(j=>j.frequency===pickFrequency).length>=4){pickError.textContent='Choose up to four chores.';return;}
    draft.push({id:'custom-'+Date.now(),title,frequency:pickFrequency,day:'Any day'});input.value='';pickError.textContent='';drawPick();
  });

  const mobileDialog=$<HTMLDialogElement>('[data-cb-mobile-dialog]');
  const dialogName=$<HTMLInputElement>('[data-cb-dialog-name]');
  const dialogAge=$<HTMLSelectElement>('[data-cb-dialog-age]');
  const dialogDay=$<HTMLSelectElement>('[data-cb-dialog-weekday]');
  const dialogMessage=$<HTMLElement>('[data-cb-dialog-message]');
  const mobileDownload=$<HTMLButtonElement>('[data-cb-mobile-download]');
  const updateDialogCounts=()=>{
    $<HTMLElement>('[data-cb-dialog-daily-count]').textContent=state.jobs.filter(j=>j.frequency==='daily').length+' selected';
    $<HTMLElement>('[data-cb-dialog-weekly-count]').textContent=state.jobs.filter(j=>j.frequency==='weekly').length+' selected';
  };
  const openMobileDialog=()=>{
    dialogName.value=name.value;dialogAge.value=age.value;dialogDay.value=state.weeklyDay||'Saturday';
    host.querySelector<HTMLInputElement>('input[name="cb-dialog-style"][value="'+(state.style==='bw'?'bw':'color')+'"]')!.checked=true;
    dialogMessage.textContent='';updateDialogCounts();mobileDialog.showModal();
  };
  $<HTMLButtonElement>('[data-cb-customize-open]').addEventListener('click',openMobileDialog);
  $<HTMLButtonElement>('[data-cb-mobile-dialog-close]').addEventListener('click',()=>mobileDialog.close());
  host.querySelectorAll<HTMLButtonElement>('[data-cb-dialog-pick]').forEach(b=>b.addEventListener('click',()=>{
    if(!dialogAge.value){dialogMessage.textContent='Choose an age before selecting chores.';dialogAge.focus();return;}
    // Save the pending name and age without replacing existing chores.
    age.value=dialogAge.value;name.value=dialogName.value;state.age=Number(dialogAge.value);state.name=dialogName.value.trim();
    if(!state.jobs.length){const suggested=recommendedChores(state.age,false,state.areas);state.jobs=[...suggested.daily,...suggested.weekly].map(c=>({id:c.id,title:c.label,frequency:c.frequency,day:'Any day'}));}
    mobileDialog.close();
    openPick(b.dataset.cbDialogPick as Frequency);
  }));
  let returnToMobile=false;
  host.querySelectorAll<HTMLButtonElement>('[data-cb-dialog-pick]').forEach(b=>b.addEventListener('click',()=>{returnToMobile=true;}));
  pickDialog.addEventListener('close',()=>{
    if(returnToMobile){returnToMobile=false;updateDialogCounts();openMobileDialog();}
  });
  $<HTMLButtonElement>('[data-cb-dialog-save]').addEventListener('click',()=>{
    if(!dialogAge.value){dialogMessage.textContent='Choose your child’s age to create the chart.';dialogAge.focus();return;}
    name.value=dialogName.value;age.value=dialogAge.value;
    if(!state.jobs.length){generate();updateSetupMode();}
    else{state.name=dialogName.value.trim();state.age=Number(dialogAge.value);save();results.hidden=false;render();}
    state.weeklyDay=dialogDay.value;
    state.style=host.querySelector<HTMLInputElement>('input[name="cb-dialog-style"]:checked')?.value==='bw'?'bw':'color';
    save();results.hidden=false;render();refreshPanel();mobileDialog.close();
  });
  mobileDownload.disabled=!state.jobs.length;
  downloadButtons.forEach(button=>button.addEventListener('click',async()=>{
    // Export the original full-size sheet, never the scaled mobile presentation.
    const previous=sheet.style.transform;
    sheet.style.transform='none';
    try{await downloadPng(sheet,{filename:(state.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'my')+'-chore-chart.png',width:1056,height:816,layoutHost:results,exportClass:'cb-exporting',button});}
    finally{sheet.style.transform=previous;schedulePreview();}
  }));
  const closeZoom=()=>{zoom.hidden=true;zoomStage.replaceChildren();document.body.style.overflow='';$<HTMLButtonElement>('[data-cb-zoom-open]').focus();};
  $<HTMLButtonElement>('[data-cb-zoom-open]').addEventListener('click',()=>{
    const copy=sheet.cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-cb-sheet');copy.style.transform='';copy.querySelectorAll('input').forEach(input=>{input.readOnly=true;input.tabIndex=-1;});
    copy.querySelectorAll('button').forEach(button=>button.remove());
    zoomStage.replaceChildren(copy);zoom.hidden=false;document.body.style.overflow='hidden';
    $<HTMLButtonElement>('[data-cb-zoom-close]').focus();
  });
  $<HTMLButtonElement>('[data-cb-zoom-close]').addEventListener('click',closeZoom);
  zoom.addEventListener('keydown',event=>{if(event.key==='Escape')closeZoom();});
  window.addEventListener('resize',schedulePreview);
  if(document.fonts)document.fonts.ready.then(schedulePreview);
  let saved:State|null=null;try{saved=JSON.parse(localStorage.getItem(key)||'null') as State|null;}catch{}
  if(handoff?.name)name.value=handoff.name;
  if(handoff?.age!==undefined)age.value=String(Math.min(18,Math.max(2,handoff.age)));
  if(saved&&Array.isArray(saved.jobs)&&saved.jobs.length){state=saved;name.value=saved.name;age.value=String(saved.age);host.querySelector<HTMLInputElement>(`input[name="cb-level"][value="${saved.experienced?'experienced':'beginner'}"]`)!.checked=true;host.querySelectorAll<HTMLInputElement>('[data-cb-area]').forEach(el=>el.checked=saved!.areas.includes(el.value as ChoreArea));results.hidden=false;render();}
  else if(handoff?.age!==undefined){generate();}
  updateSetupMode();refreshPanel();syncMobile();
}
