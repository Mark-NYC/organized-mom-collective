/**
 * June 2027: My Family's Snack Station.
 * Retain original slug so saved Club links do not break.
 * Flagship prototype: src/components/club/JuneSnackStation.astro.
 * Existing free tool remains unchanged; only the Club month has been redesigned.
 */
import type {KitConfig} from '../types';
const SLUG='2027-06-summer-with-a-plan';
export const kit:KitConfig={
 slug:SLUG,
 month:'2027-06',
 theme:"My Family's Snack Station",
 subtitle:'Kids choose. Kids tidy. Mom gets fewer interruptions.',
 shift:'Children use a prepared picture-led snack station to choose an approved snack and take care of cleanup, without Mom making each decision.',
 engine:'planning',
 engineVersion:1,
 items:[],
 action:{
  kind:'checklist',
  title:"Our Family's Snack Station",
  intro:'One simple snack rule, approved food choices and a cleanup step. The printed illustrated poster is the product.',
  note:'The family reviews food safety and which foods kids may access. No daily checklist or shopping homework.',
  items:[
   {text:'Choose a snack from our approved fridge and pantry options.'},
   {text:'Get it safely. Ask a grown-up for anything that needs help.'},
   {text:'Put food away and clean up afterward.'}
  ],
 },
 printables:[{id:'snack-station',title:"Our Family's Snack Station",page:'letter-portrait',kind:'flagship',component:'Action'}],
 mailer:{
  letter:{
   draft:true,
   title:'One More Thing They Can Do Themselves',
   greeting:'Hi friend,',
   namedGreeting:'Hi {name},',
   body:[
    'Summer brings extra freedom—and a surprising number of snack requests. What if the kids could handle more of those moments themselves?',
    'This month we prepared a visual snack station with simple choices and one important ending: clean up after yourself.',
    'Check the foods first. Make sure each choice fits your child’s age, allergies, and ability to access and prepare it safely. Then put the poster where the kids can see it and the approved foods where they can reach them.',
    'The goal isn’t a perfectly stocked snack drawer. It’s a little more independence for the kids and fewer decisions for you.'
   ].join('\n\n'),
   signoff:'Megan'
  },
  fieldGuide:{
   title:'Set It Up Once, Then Let Kids Lead',
   sections:[
    {heading:'Choose safe, familiar foods.',body:'Review foods for allergies, choking hazards, dietary needs, and any adult help required. Younger children need supervision when eating.'},
    {heading:'Keep approved choices reachable.',body:'Use the fridge and pantry spaces you already have. No new bins or special purchases are required.'},
    {heading:'Teach the whole job.',body:'Show children how to choose, put foods away, and clear their space. Practise once together.'}
   ]
  },
  tip:{title:'A small setup, not another project',body:'Keep food options limited to items you regularly buy and are comfortable letting your kids choose.'},
  invite:{title:'Adjust Your Family’s Snack Station',body:'Review the illustrated poster online if you want to change food choices, the snack rule, or the cleanup reminder.'},
  calendarNote:'May helps kids know what comes next. June helps them independently handle one recurring part of the day.',
  screenNote:'The mailed poster is ready to use after an adult checks the food options. The online version is for optional changes or reprinting.',
  letterLinkTop:true,
  accent:'summer',
  qrPath:'/club/kits/'+SLUG+'?source=mailer'
 }
};
