/** Shared content for OMC's short kids' responsibility resources. Existing responsibility icons only. */
export const miniGuides = [
{
 slug:'chores-for-4-5-year-olds', title:'Chores for 4–5-Year-Olds', short:'Ages 4–5', kicker:'FIRST RESPONSIBILITIES', lead:'Small jobs, practiced together, help young children begin contributing.', intro:'At four and five, responsibility starts with joining in. Show each task, keep it short, and celebrate the effort. The goal is confidence, not perfection.', accent:'#F1D8A8',
 sections:[
 {title:'My things',icon:'backpack',jobs:['Put shoes in their spot','Hang coat on a low hook','Put toys in a basket','Place pajamas in hamper','Put books back on shelf','Bring plate to counter']},
 {title:'Helping at home',icon:'basket',jobs:['Match clean socks','Fold washcloths together','Put napkins on table','Water a plant with help','Help tidy sofa cushions','Carry lightweight items away']},
 {title:'With a grown-up',icon:'hands',jobs:['Sort laundry by color','Put unbreakable dishes away','Feed a pet together','Wipe a safe surface','Help put groceries away','Choose tomorrow’s outfit']}],
 steps:[['Choose one tiny job','Pick a task your child can finish in a minute or two.','clipboard'],['Do it together','Show, name the steps, and practice side by side.','hands'],['Use one cue','For example: after snack, put the plate away.','clock'],['Notice progress','Talk about how their contribution helps the family.','star']],
 safety:'Adult support is expected. Avoid hot surfaces, cleaning chemicals, sharp tools, heavy items and unsupervised pet care.', printableTitle:'My First Responsibilities',printableNote:'Choose two little jobs and practice with a grown-up.',trackerLabels:['My first job','My helping job'],starterNote:'Keep it playful and brief. Practice together, then try again tomorrow.',teaser:'18 easy first chores and a picture-friendly one-page starter chart for ages 4–5.'
},
{
 slug:'chores-for-6-7-year-olds',title:'Chores for 6–7-Year-Olds',short:'Ages 6–7',kicker:'DAILY RHYTHMS',lead:'Build predictable routines before adding a longer list of chores.',intro:'Six- and seven-year-olds can begin remembering familiar jobs with visual cues. Start with one personal task and one useful contribution to the family.',accent:'#D4DFC4',
 sections:[
 {title:'Morning and evening',icon:'clock',jobs:['Put pajamas in hamper','Make bed with help as needed','Brush teeth using a checklist','Get dressed from clothes set out','Put school bag at its spot','Choose outfit for tomorrow']},
 {title:'After-school reset',icon:'backpack',jobs:['Hang coat and backpack','Put lunchbox in kitchen','Put shoes in their spot','Put papers in family tray','Return books to shelf','Tidy play area for five minutes']},
 {title:'Family contributions',icon:'dish',jobs:['Set napkins and utensils','Clear unbreakable dishes','Match and fold towels','Wipe dining table with water','Refill pet water with approval','Water an assigned plant']}],
 steps:[['Pick two jobs','One personal job and one shared contribution are enough.','clipboard'],['Show the finish line','For example: backpack hung up and lunchbox emptied.','check'],['Anchor it to a time','Use a predictable moment rather than repeated reminders.','clock'],['Review at family meeting','Ask what felt easy and what still needs help.','family']],
 safety:'Readiness varies. Adults handle knives, chemicals, hot items, heavy loads and other unsafe chores.',printableTitle:'My Daily Responsibilities',printableNote:'Two jobs, clear cues, one week of practice.',trackerLabels:['My daily routine','My family job'],starterNote:'Keep the cue visible: after breakfast, after school, or before bed.',teaser:'18 practical chores for ages 6–7, with routines and a one-page daily checklist.'
},
{
 slug:'chores-for-10-12-year-olds',title:'Chores for 10–12-Year-Olds',short:'Ages 10–12',kicker:'GROWING INDEPENDENCE',lead:'Move from doing a step to owning the whole household contribution.',intro:'Preteens can take on more complete responsibilities as skills develop. Teach the whole task, agree on the finish line, and let them practice without micromanagement.',accent:'#E8D2D6',
 sections:[
 {title:'Personal ownership',icon:'backpack',jobs:['Plan and pack school supplies','Manage own laundry with teaching','Keep bedroom floor clear','Put clothes away after washing','Prepare tomorrow’s belongings','Reset study area after homework']},
 {title:'Shared household care',icon:'basket',jobs:['Vacuum a safe assigned room','Clean bathroom sink safely','Sort recycling by local rules','Empty small trash bins','Fold family towels','Restock paper supplies']},
 {title:'Meal and family team',icon:'dish',jobs:['Prepare a simple cold breakfast','Help prep ingredients with supervision','Set and clear dinner table','Load safe dishwasher items','Plan one family snack option','Care for pet with agreed routine']}],
 steps:[['Agree on the whole job','Define the owner, cue, steps, and what done looks like.','clipboard'],['Teach safe skills','Demonstrate and supervise until the child is ready.','hands'],['Give room to own it','Use agreed check-ins, not constant monitoring.','clock'],['Review together','Discuss workload, quality, and what needs changing.','family']],
 safety:'Adults decide when supervision is needed. Never assign unsupervised chemicals, hot appliances, sharp tools, heavy lifts or risky pet care.',printableTitle:'My Responsibility Planner',printableNote:'Own two clear responsibilities and review the finish line.',trackerLabels:['My own responsibility','My household contribution'],starterNote:'Ownership includes noticing, starting, finishing, and checking.',teaser:'18 age-appropriate responsibilities for preteens, plus a one-page ownership planner.'
},
{
 slug:'kids-chores-without-reminders',title:'How to Get Kids to Do Chores Without Constant Reminders',short:'Without reminders',kicker:'LESS NAGGING · MORE OWNERSHIP',lead:'Stop being everyone’s reminder system. Hand over one whole responsibility.',intro:'A chart alone does not transfer responsibility. Children need a clear job, a predictable cue, practice, and a realistic family check-in. This is a starting system, not a promise of zero reminders.',accent:'#BBCBC4',
 sections:[
 {title:'Name the job',icon:'clipboard',jobs:['Choose one useful responsibility','Say who owns it','Name the exact starting cue','Agree what finished looks like','Put supplies in reach','Keep the task age-appropriate']},
 {title:'Teach the handoff',icon:'hands',jobs:['Model the whole task','Practice together once or twice','Let the child try','Use a visible reminder','Step back gradually','Give help when truly stuck']},
 {title:'Review, don’t nag',icon:'family',jobs:['Ask what worked this week','Notice unclear directions','Adjust the cue if forgotten','Reduce the job if too large','Make a new plan together','Check in at family meeting']}],
 steps:[['Choose one ownership move','Do not replace every reminder at once.','clipboard'],['Find a natural cue','Use after breakfast, after school or after dinner.','clock'],['Define done','Agree on an observable finish line.','check'],['Review next week','Troubleshoot the system instead of repeating commands.','family']],
 safety:'Children still need developmentally appropriate teaching and adult supervision. Some reminders and help are normal.',printableTitle:'The Responsibility Handoff',printableNote:'One job. One owner. One cue. One clear finish line.',trackerLabels:['Job / owner','When / finished means'],starterNote:'Ask at the next family meeting: What worked, and what needs changing?',teaser:'A practical handoff process and one-page worksheet for building responsibility without endless reminders.'
}
];
export const findMiniGuide = slug => miniGuides.find(g=>g.slug===slug);
