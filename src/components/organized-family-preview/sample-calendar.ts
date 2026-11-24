import type { CalendarEvent } from '../../lib/calendar/recurrence';
import { weekAhead } from '../../lib/family-meeting-support';
const sampleDate = '2026-11-23';
function example(id:string,title:string,day:number,time:string,source:string): CalendarEvent {
  const date = '2026-11-'+(23+day);
  return {id,title,starts_on:date,start_time:time,timezone:'America/New_York',member_ids:[],revision:1,
    external:{feed_id:source,name:source,visibility:'household',mine:false,tentative:false,uid:id,instance_key:date}};
}
export const sampleWeek = weekAhead([
  example('piano','Piano lesson',1,'15:30','Music school'),
  example('conference','School conference',2,'16:00','School'),
  example('shift','Work shift',2,'16:00','Work'),
  example('soccer','Soccer practice',3,'16:00','Sports'),
  example('trip','Class field trip',4,'09:00','School'),
  example('library','Library visit',5,'11:00','Family'),
],sampleDate);
