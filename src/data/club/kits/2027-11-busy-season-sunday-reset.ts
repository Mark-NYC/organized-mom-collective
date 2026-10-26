import type { KitConfig } from '../types';
const SLUG='2027-11-busy-season-sunday-reset';
export const kit:KitConfig={
 slug:SLUG,month:'2027-11',theme:'The Busy Season Sunday Reset',
 subtitle:'One familiar family rhythm, ready for the busy season.',
 shift:'The whole family anticipates gatherings, school breaks, transportation, and shared preparation instead of leaving coordination to Mom.',
 engine:'planning',engineVersion:1,items:[],
 action:{kind:'checklist',title:'Our Busy Season Plan',
  intro:'Bring this prepared plan to your existing Sunday Reset. Everyone contributes and owns their part.',
  items:[
   {text:'Gatherings and hosting',detail:'Check plans, confirm what is needed, and assign preparation.'},
   {text:'School breaks and schedule changes',detail:'See changed days ahead and decide what happens next.'},
   {text:'Travel and transportation',detail:'Coordinate rides, timing, packing, and pickup owners.'},
   {text:'Shared preparation',detail:'Decide who owns supplies, meals, cleanup, and readiness.'},
   {text:'Protect our family margin',detail:'Leave some time open and choose what can wait.'}
  ],helperLabel:'Owner',editable:true
 },
 printables:[
  {id:'busy-season-plan',title:'Our Busy Season Plan',page:'letter-portrait',kind:'flagship',component:'Action'},
  {id:'letter',title:'November letter',page:'letter-portrait',kind:'worksheet',component:'Letter'}
 ],
 mailer:{
  letter:{draft:true,title:'Before the busy season fills up',greeting:'Hi friend,',namedGreeting:'Hi {name},',
   body:['This season brings a lot of moving parts: school breaks, gatherings, activities, and travel. The family does not need a new system to handle them.','Bring your calendar to the same family Sunday Reset. Let everyone see what is coming, share what they know, and take responsibility for the preparation.','Leave a little time open, too. A family plan should protect space together, not just fill it.'].join('\n\n'),signoff:'Megan'},
  fieldGuide:{title:'The same Sunday Reset, a busier season',sections:[
   {heading:'Look ahead',body:'See school breaks, gatherings, rides, travel, and changes before they surprise anyone.'},
   {heading:'Share preparation',body:'Assign whole jobs. Adults coordinate adult logistics; children own age-appropriate readiness.'},
   {heading:'Protect margin',body:'Choose what can wait and leave some time uncommitted.'}
  ]},
  conversation:{label:'Ask at your Sunday Reset',question:'What is coming this week that we need to prepare for together?',placement:'after-example'},
  invite:{title:'Use your Sunday Reset',body:'Bring this plan to your family calendar. Keep the same familiar five-step conversation.'},
  calendarNote:'Look ahead at your family calendar during the Sunday Reset. Assign preparation and protect breathing room.',
  screenNote:'This is a preview concept. Printed fulfillment requires a separate approved mailing process.',
  qrPath:`/club/kits/${SLUG}?source=mailer`
 }
};
