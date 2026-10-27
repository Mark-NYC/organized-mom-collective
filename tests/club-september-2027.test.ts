import {describe,it,expect} from 'vitest';
import {calendarMembers,occursOn,weeksOf,validateActivity,type CalendarActivity} from '../src/lib/family-calendar/core';

const weekly=(days:number[],memberId='adult-1'):CalendarActivity=>({
 id:'soccer',memberId,name:'Soccer practice',kind:'weekly',days
});
const family=(adults:number,children:number,names?:string[])=>({
 members:Array.from({length:adults+children},(_,i)=>({
   id:'person-'+i,firstName:names?.[i]??(i<adults?'Parent '+(i+1):'Child '+(i-adults+1))
 }))
});

describe('September 2027 family calendar',()=>{
 it('supports two adults and twin eight-year-olds',()=>{
  const people=calendarMembers(family(2,2,['Mom','Dad','Andrew','Philip']));
  expect(people.map(p=>p.name)).toEqual(['Mom','Dad','Andrew','Philip']);
  expect(new Set(people.map(p=>p.id)).size).toBe(4);
 });
 it('supports one parent and one preschooler',()=>{
  expect(calendarMembers(family(1,1)).map(p=>p.id)).toEqual(['person-0','person-1']);
 });
 it('does not drop children from large households',()=>{
  expect(calendarMembers(family(2,5))).toHaveLength(7);
  expect(calendarMembers(family(2,15))).toHaveLength(17);
 });
 it('preserves long names without truncation in the data model',()=>{
  const name='Alexandria Montgomery-Vanderbilt-Castellanos';
  expect(calendarMembers(family(1,1,[name,'Josephine-Mariella']))[0].name).toBe(name);
 });
 it('places recurring Monday/Thursday activities on all matching days',()=>{
  const activity=weekly([1,4]);
  expect(occursOn(activity,new Date(2027,8,6))).toBe(true);
  expect(occursOn(activity,new Date(2027,8,9))).toBe(true);
  expect(occursOn(activity,new Date(2027,8,7))).toBe(false);
  expect(occursOn(activity,new Date(2027,8,13))).toBe(true);
 });
 it('can display multiple activities for one day and one child',()=>{
  const events=[weekly([1,4],'child'),{...weekly([1],'child'),id:'music',name:'Piano'}];
  expect(events.filter(a=>a.memberId==='child'&&occursOn(a,new Date(2027,8,6)))).toHaveLength(2);
 });
 it('has a Monday-first monthly view including month-boundary days',()=>{
  const weeks=weeksOf(new Date(2027,8,1));
  expect(weeks[0][0].getDay()).toBe(1);
  expect(weeks[0][0].getMonth()).toBe(7);
  expect(weeks.flat().some(date=>date.getMonth()===8&&date.getDate()===30)).toBe(true);
 });
 it('rejects malformed activities rather than accepting corrupt stored data',()=>{
  expect(validateActivity(weekly([1,4]))).toBe(true);
  expect(validateActivity({...weekly([1]),days:[9]})).toBe(false);
  expect(validateActivity({...weekly([1]),name:'x'.repeat(61)})).toBe(false);
 });
});
