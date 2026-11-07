export type Focus = 'routines' | 'spaces' | 'ownership' | 'connection';
export type QuizChoice = { label: string; detail?: string; icon: string; focus: Focus };
export type QuizQuestion = { prompt: string; eyebrow: string; choices: QuizChoice[] };
export const quizQuestions: QuizQuestion[] = [
  { eyebrow:'The everyday reality', prompt:'Which scene feels most familiar lately?', choices:[
    {label:'The morning scramble',detail:'Shoes, bags, and everyone running late',icon:'/assets/icons/ofc/guides/morning/backpack.png',focus:'routines'},
    {label:'The clutter comeback',detail:'The room was clean five minutes ago',icon:'/assets/icons/ofc/guides/responsibility/basket.png',focus:'spaces'},
    {label:'The reminder marathon',detail:'Nothing happens until I ask again',icon:'/assets/icons/ofc/guides/responsibility/clipboard.png',focus:'ownership'},
    {label:'The ships-passing feeling',detail:'Busy together, but rarely connecting',icon:'/assets/icons/ofc/guides/responsibility/family.png',focus:'connection'}]},
  { eyebrow:'What wears you down', prompt:'At the end of a long day, what gets to you most?',choices:[
    {label:'Always rushing',detail:'There never seems to be enough time',icon:'/assets/icons/ofc/guides/morning/clock.png',focus:'routines'},
    {label:'Always picking up',detail:'Everything ends up out of place',icon:'/assets/icons/ofc/guides/responsibility/basket.png',focus:'spaces'},
    {label:'Always remembering',detail:'I carry the family to-do list in my head',icon:'/assets/icons/ofc/guides/responsibility/eye.png',focus:'ownership'},
    {label:'Always coordinating',detail:'We don’t pause to listen or plan',icon:'/assets/icons/ofc/guides/responsibility/calendar.png',focus:'connection'}]},
  { eyebrow:'A little daydream',prompt:'If one thing could magically get easier tomorrow, which would you choose?',choices:[
    {label:'Everyone gets ready on time',icon:'/assets/icons/ofc/guides/morning/calendar.png',focus:'routines'},
    {label:'Shared spaces stay manageable',icon:'/assets/icons/ofc/guides/responsibility/check.png',focus:'spaces'},
    {label:'Kids follow through without nagging',icon:'/assets/icons/ofc/guides/responsibility/star.png',focus:'ownership'},
    {label:'We have a calm moment together',icon:'/assets/icons/ofc/guides/responsibility/family.png',focus:'connection'}]},
  { eyebrow:'A pattern is forming',prompt:'When you try a new family system, what usually happens?',choices:[
    {label:'We forget it after a few days',detail:'It never quite becomes a habit',icon:'/assets/icons/ofc/guides/morning/clock.png',focus:'routines'},
    {label:'The stuff has nowhere to go',detail:'We tidy, but the mess returns',icon:'/assets/icons/ofc/guides/responsibility/basket.png',focus:'spaces'},
    {label:'I’m still the one running it',detail:'It only works if I manage everyone',icon:'/assets/icons/ofc/guides/responsibility/clipboard.png',focus:'ownership'},
    {label:'We never make time to talk about it',detail:'Everyone has a different idea',icon:'/assets/icons/ofc/guides/responsibility/family.png',focus:'connection'}]},
  { eyebrow:'Your family rhythm',prompt:'Which sentence sounds most like your house?',choices:[
    {label:'Our mornings and evenings feel unpredictable',icon:'/assets/icons/ofc/guides/morning/calendar.png',focus:'routines'},
    {label:'Our surfaces collect everything',icon:'/assets/icons/ofc/guides/responsibility/basket.png',focus:'spaces'},
    {label:'Everyone asks me what to do next',icon:'/assets/icons/ofc/guides/responsibility/clipboard.png',focus:'ownership'},
    {label:'Our plans rarely get discussed together',icon:'/assets/icons/ofc/guides/responsibility/calendar.png',focus:'connection'}]},
  { eyebrow:'The smallest possible win',prompt:'Which small win would make this week feel lighter?',choices:[
    {label:'A five-minute before-school checklist',icon:'/assets/icons/ofc/guides/responsibility/check.png',focus:'routines'},
    {label:'One shared room reset',icon:'/assets/icons/ofc/guides/responsibility/basket.png',focus:'spaces'},
    {label:'One job somebody else fully owns',icon:'/assets/icons/ofc/guides/responsibility/hands.png',focus:'ownership'},
    {label:'One ten-minute family check-in',icon:'/assets/icons/ofc/guides/responsibility/family.png',focus:'connection'}]},
  { eyebrow:'Your starting point',prompt:'What would you most like help with first?',choices:[
    {label:'A routine our family can remember',icon:'/assets/icons/ofc/guides/morning/calendar.png',focus:'routines'},
    {label:'A reset we can actually keep up with',icon:'/assets/icons/ofc/guides/responsibility/basket.png',focus:'spaces'},
    {label:'Sharing the work without constant reminders',icon:'/assets/icons/ofc/guides/responsibility/hands.png',focus:'ownership'},
    {label:'Getting everyone on the same page',icon:'/assets/icons/ofc/guides/responsibility/family.png',focus:'connection'}]},
];
export type QuizResult = { title:string; subtitle:string; explanation:string; focus:Focus; color:string; guide:{label:string;href:string;description:string}; secondary:{label:string;href:string}; challenge:[string,string,string]; prompt:string };
export const quizResults: Record<Focus,QuizResult> = {
 routines:{focus:'routines',title:'The Routine Reset',subtitle:'Your family needs a rhythm that’s easy to remember.',explanation:'Your answers point to the transitions between activities. The goal isn’t a perfect schedule. It’s one small repeatable sequence everyone can see and practice.',color:'#CDDDE1',guide:{label:'The Family Morning Routine',href:'/guides/family-morning-routine/',description:'A free illustrated guide to build a calmer school morning.'},secondary:{label:'Build a free routine chart',href:'/routine-chart'},challenge:['Pick your hardest transition and write down three simple steps.','Practice the steps together once, without rushing.','Put the steps somewhere visible and try them again.'],prompt:'Choose one transition to practice, not the whole day.'},
 spaces:{focus:'spaces',title:'The Shared-Space Reset',subtitle:'Your home needs easier places for everyday things.',explanation:'Your answers suggest the mess keeps returning because the reset is hard to maintain. Start with one shared space and a simple routine everyone can join.',color:'#D4DFC4',guide:{label:'The Family Living Room Reset',href:'/guides/family-living-room-reset/',description:'A free five-minute reset with simple shared jobs.'},secondary:{label:'Explore all room reset guides',href:'/guides/'},challenge:['Choose one shared space and give loose items a home.','Do a five-minute reset together.','Repeat at the same time and adjust what didn’t work.'],prompt:'One room, five minutes, everyone contributes.'},
 ownership:{focus:'ownership',title:'The Ownership Gap',subtitle:'Too much of the remembering may be falling on you.',explanation:'Your answers point to a common frustration: other people may help, but you still have to notice, assign, and remind. Try handing over one whole, age-appropriate responsibility.',color:'#F1D8A8',guide:{label:'The Family Responsibility System',href:'/guides/family-responsibility-system/',description:'A free guide to moving from helping to truly owning a job.'},secondary:{label:'Create a family responsibility chart',href:'/family-responsibility-builder'},challenge:['Pick one age-appropriate job and decide who will own it.','Show what “done” looks like and practice together.','Let them try, then check in kindly about what worked.'],prompt:'Hand over one whole job, not ten tiny reminders.'},
 connection:{focus:'connection',title:'The Family Check-In',subtitle:'Your family may need a moment to get on the same page.',explanation:'Your answers suggest a little more shared conversation could ease the week. A short family check-in can help everyone be heard, see the plan, and choose how to help.',color:'#E8D2D6',guide:{label:'The Family Weekly Reset',href:'/guides/family-weekly-reset/',description:'A free 15-minute weekly check-in for schedules and shared responsibility.'},secondary:{label:'Try the family meeting agenda',href:'/family-meeting-agenda'},challenge:['Invite the family to a short check-in and pick a time.','Ask what went well and what feels hard this week.','Choose one small next step together and revisit it.'],prompt:'Start with ten minutes of listening, not a long meeting.'}
};
export function scoreQuiz(answers: Focus[]): Focus {
 const totals: Record<Focus,number>={routines:0,spaces:0,ownership:0,connection:0};
 answers.forEach((a,i)=>{totals[a]+=(i===answers.length-1?2:1);});
 const order:Focus[]=['routines','spaces','ownership','connection'];
 return order.reduce((best,key)=>totals[key]>totals[best]?key:best,order[0]);
}
