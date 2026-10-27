/** Calendar semantics shared by Club and the public monthly calendar. No browser state. */
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export interface CalendarMember { id:string; name:string; color:string }
export interface CalendarActivity { id:string; memberId:string; name:string; kind:'weekly'|'dated'; days?:number[]; date?:string; repeat?:Repeat }
export const MEMBER_COLORS=['#f4f4f4','#e3efee','#f4e9e4','#f9e5e1','#fef6f5','#e8eee6','#e9e7f1','#f2eddc','#e7eaf0','#f1e7df','#e8efe9','#f7f0e6'] as const;
export const DAY_NAMES=['MON','TUE','WED','THU','FRI','SAT','SUN'];
export const ymd=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export function dateFromYmd(value:string){const [year,month,day]=value.split('-').map(Number);return new Date(year,month-1,day)}
export function occursOn(activity:CalendarActivity,date:Date):boolean{
 if(activity.kind==='weekly')return (activity.days??[]).includes(date.getDay());
 if(!activity.date)return false;
 const start=dateFromYmd(activity.date);
 if(date<start)return false;
 switch(activity.repeat??'none'){
  case 'none':return ymd(date)===activity.date;
  case 'daily':return true;
  case 'weekly':return date.getDay()===start.getDay();
  case 'monthly':return date.getDate()===start.getDate();
 }
}
export function weeksOf(first:Date):Date[][]{
 const offset=(first.getDay()+6)%7;
 const start=new Date(first.getFullYear(),first.getMonth(),1-offset);
 const weeks:Date[][]=[];
 for(let d=new Date(start);weeks.length===0||d.getMonth()===first.getMonth();){
  const week:Date[]=[];
  for(let i=0;i<7;i++){week.push(new Date(d));d.setDate(d.getDate()+1)}
  weeks.push(week);
 }
 return weeks;
}
export function calendarMembers(household:{members:{id:string;firstName:string;archived?:boolean}[]}):CalendarMember[]{
 return household.members.filter(m=>!m.archived).map((m,i)=>({id:m.id,name:m.firstName,color:MEMBER_COLORS[i%MEMBER_COLORS.length]}));
}
export function validateActivity(x:unknown):x is CalendarActivity{
 if(!x||typeof x!=='object')return false;
 const a=x as Partial<CalendarActivity>;
 return typeof a.id==='string'&&typeof a.memberId==='string'&&typeof a.name==='string'&&a.name.length<=60&&
 ((a.kind==='weekly'&&Array.isArray(a.days)&&a.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6))||
 (a.kind==='dated'&&typeof a.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&['none','daily','weekly','monthly'].includes(a.repeat??'none')));
}
