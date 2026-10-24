/**
 * May 2027: Our Summer Day. Existing slug retained for stable member URLs.
 * Physical-first single illustrated US Letter rhythm board; no school-year closeout worksheet.
 * Prototype art is still under visual review.
 */
import type { KitConfig } from '../types';
const SLUG='2027-05-finish-the-school-year';
export const kit:KitConfig={
 slug:SLUG,
 month:'2027-05',
 theme:'Our Family Summer Rhythm',
 subtitle:'A little structure. Plenty of freedom.',
 shift:'When school structure disappears, kids can look at a simple visual day rhythm instead of relying on Mom to direct every transition.',
 engine:'planning',
 engineVersion:1,
 items:[],
 action:{
  kind:'checklist',
  title:'Our Summer Day',
  intro:'A ready-to-follow day rhythm for ordinary summer days at home.',
  note:'The times are anchors, not strict appointments. Follow the blocks that fit on trips or camp days. The mailed visual board is the actual product.',
  items:[
   {text:'Morning Start — breakfast, get dressed, make beds'},
   {text:'Move & Play — go outside and get active'},
   {text:'Create & Explore — read, build, draw or make'},
   {text:'Lunch & Reset — eat, clear dishes and tidy'},
   {text:'Quiet Time — books, puzzles or a rest'},
   {text:'Free Afternoon — friends, outings or free play'},
   {text:'Evening Reset — pick up, wash up and wind down'}
  ],
 },
 tool:{
  tool:'school-wrap-up',
  title:'Adjust Our Summer Day',
  blurb:'Preview the kid-first visual rhythm board, then adjust the morning start and activity anchors only if needed.',
  cta:'See Our Summer Rhythm',
  note:'Optional. The mailed rhythm works without editing.',
 },
 printables:[{id:'summer-rhythm',title:'Our Summer Day Rhythm',page:'letter-portrait',kind:'flagship',component:'Action'}],
 mailer:{
  letter:{
   draft:true,
   title:'Their Summer Day, Without All the Reminders',
   greeting:'Hi friend,',
   namedGreeting:'Hi {name},',
   body:[
    'When school ends, so does a lot of the structure your children have been following all year. The questions start: What now? What are we doing? Can you help me decide?',
    'This month’s tool is for your kids. Put their Summer Day Rhythm where they can see it. Walk through the pictures together, then let the board do some of the reminding.',
    'It is a rhythm, not an hour-by-hour schedule. You can skip or move blocks for camp, trips, and appointments without making the board obsolete.',
    'Try one simple phrase: Check the rhythm before asking Mom. Give your children time to grow into it.'
   ].join('\n\n'),
   signoff:'Megan',
  },
  fieldGuide:{
   title:'A Simple Rhythm Kids Can Follow',
   intro:'Three ways to let the board take work off Mom’s plate.',
   sections:[
    {heading:'Put it at kid height.',body:'The fridge or another shared space works well. Children need to see it without asking.'},
    {heading:'Walk it once together.',body:'Point to the seven pictures. Explain that the times are flexible anchors.'},
    {heading:'Point back to the rhythm.',body:'When a child asks what happens next, let them check the picture and choose an activity.'}
   ],
  },
  tip:{title:'The Summer Rule',body:'Check the rhythm before asking Mom. The board shows the next part of the day; children still ask an adult for help with safety and big decisions.'},
  invite:{title:'Preview Your Family Summer Day',body:'Use the companion only when you want to adjust your usual start time or activity blocks. The printed rhythm is ready to use.'},
  calendarNote:'Keep actual camps, appointments and trips on the family wall calendar. The summer rhythm covers ordinary days at home without trying to predict changing plans.',
  screenNote:'Use the illustrated mailed rhythm as-is, or revisit the digital preview if your family’s usual anchors change.',
  letterLinkTop:true,
  accent:'school',
  qrPath:'/club/may-preview/',
 }
};
