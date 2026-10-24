/** December 2026 Club proof: the Christmas kindness mission and two cut-and-fold cards.
 * A planned physical month, not scheduled for sale or mailing. The actual production
 * layout is src/components/club/DecemberMissionPrototype.astro.
 */
import type {KitConfig} from '../types';
const SLUG='2026-12-christmas-mission';
export const kit:KitConfig={
 slug:SLUG,
 month:'2026-12',
 theme:'Your Christmas Mission Has Arrived!',
 subtitle:'One kindness mission. Two Christmas cards. A family surprise.',
 shift:'Give the children a ready-to-go act of kindness they can own, instead of another holiday project Mom must plan.',
 engine:'planning',
 engineVersion:1,
 items:[],
 action:{
  kind:'checklist',
  title:'Our Christmas Kindness Mission',
  intro:'The children lead. Grown-ups help with delivery when needed.',
  items:[
   {text:'Choose someone to surprise.',detail:'Pick a neighbor, teacher, friend or someone who could use encouragement.'},
   {text:'Make a Christmas card.',detail:'Use one of the prepared cards and write or draw a kind message.'},
   {text:'Deliver your kindness.',detail:'Ask a grown-up to help get the card to the person you chose.'}
  ]
 },
 printables:[
  {id:'christmas-mission',title:'Our Christmas Kindness Mission and Cards',page:'letter-portrait',kind:'flagship',component:'Action'}
 ],
 mailer:{
  letter:null,
  fieldGuide:{title:'One Family Christmas Mission',sections:[
   {heading:'Kids lead.',body:'Give the mission to the children and let them choose whom to encourage.'},
   {heading:'Already prepared.',body:'The two Christmas cards are included on the printable second sheet.'},
   {heading:'Grown-ups deliver.',body:'Offer help with supplies and safe delivery, without taking over the project.'}
  ]},
  invite:{title:'Our Christmas Kindness Mission',body:'Open the personalized mission and print the two prepared Christmas cards.'},
  calendarNote:'Choose a relaxed time to make and deliver your cards. The mission does not require a separate activity calendar.',
  qrPath:`/club/kits/${SLUG}?source=mailer`
 }
};
