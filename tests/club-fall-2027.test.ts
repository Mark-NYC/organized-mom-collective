import {describe,it,expect} from 'vitest';
import {calendarMembers,occursOn,weeksOf,validateActivity,ymd,type CalendarActivity} from '../src/lib/family-calendar/core';
import {kitBySlug,kitProblems} from '../src/data/club/kits';
const weekly:CalendarActivity={id:'1',memberId:'child-1',name:'Soccer',kind:'weekly',days:[1,4]};
describe('September Club family calendar',()=>{
 it('keeps the public Monday-first monthly calendar model',()=>{
  const weeks=weeksOf(new Date(2027,8,1));
  expect(weeks[0][0].getDay()).toBe(1);
  expect(ymd(weeks[0][0])).toBe('2027-08-30');
  expect(weeks.flat().some(d=>ymd(d)==='2027-09-30')).toBe(true);
 });
 it('applies weekly rules to the selected weekdays',()=>{
  expect(occursOn(weekly,new Date(2027,8,6))).toBe(true);
  expect(occursOn(weekly,new Date(2027,8,10))).toBe(true);
  expect(occursOn(weekly,new Date(2027,8,7))).toBe(false);
 });
 it('supports one-time and monthly activities without timezone parsing',()=>{
  const event:CalendarActivity={id:'2',memberId:'child-1',name:'Birthday',kind:'dated',date:'2027-09-12',repeat:'monthly'};
  expect(occursOn(event,new Date(2027,9,12))).toBe(true);
  expect(occursOn(event,new Date(2027,8,11))).toBe(false);
 });
 it('assigns stable household IDs, excludes archived people and supports 12',()=>{
  const household={members:Array.from({length:12},(_,i)=>({id:'person-'+i,firstName:'Person '+i,archived:i===3}))};
  const members=calendarMembers(household);
  expect(members).toHaveLength(11);
  expect(members.map(m=>m.id)).not.toContain('person-3');
  expect(new Set(members.map(m=>m.color)).size).toBe(11);
 });
 it('rejects malformed activity data',()=>{
  expect(validateActivity(weekly)).toBe(true);
  expect(validateActivity({...weekly,days:[8]})).toBe(false);
  expect(validateActivity({...weekly,memberId:20})).toBe(false);
 });
});
describe('2027 fall Club kit registration',()=>{
 for(const slug of ['2027-09-a-week-everyone-can-see','2027-10-home-works-together','2027-11-busy-season-sunday-reset']){
  it('registers and validates '+slug,()=>{
   const kit=kitBySlug(slug);
   expect(kit).toBeDefined();
   expect(kitProblems(kit!)).toEqual([]);
   expect(kit!.printables.filter(p=>p.kind==='flagship')).toHaveLength(1);
  });
 }
});
