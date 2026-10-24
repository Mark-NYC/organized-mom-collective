/** Curated December proof: one self-contained tradition, not a Christmas planning checklist. */
export type TraditionId = 'kindness'|'cocoa'|'ornaments';
export type FamilyId = 'goering'|'rivera'|'bennett';
export interface Family { id:FamilyId; label:string; family:string; members:string[]; ages:number[]; recommended:TraditionId }
export interface Tradition { id:TraditionId; name:string; summary:string; duration:string; supplies:string[]; steps:string[]; roles:{adult:string;young:string;older:string}; closing:string }
export const families:Family[]=[
 {id:'goering',label:'Goering · two school-age children',family:'The Goering Family',members:['Megan','Mark','Andrew','Philip'],ages:[42,42,8,8],recommended:'kindness'},
 {id:'rivera',label:'Rivera · preschool and early elementary',family:'The Rivera Family',members:['Casey','Jordan','Sofia','Leo'],ages:[34,35,4,7],recommended:'ornaments'},
 {id:'bennett',label:'Bennett · teenagers',family:'The Bennett Family',members:['Taylor','Alex','Maya','Ethan'],ages:[43,44,15,13],recommended:'cocoa'}
];
export const traditions:Tradition[]=[
 {id:'kindness',name:'Our Christmas Kindness Night',summary:'Make a card and a small gift for someone who could use encouragement, then give it together.',duration:'About 45 minutes, plus delivery',supplies:['Blank cards or folded paper','Pens or colored pencils','A simple treat or small gift'],steps:['As a family, choose someone to encourage.','Make a card and put together a simple gift.','Deliver it together, or arrange to leave it safely.'],roles:{adult:'Gather materials and handle delivery.',young:'Draw or decorate the card.',older:'Write a message and help prepare the gift.'},closing:'One simple way to make someone feel remembered.'},
 {id:'cocoa',name:'Our Christmas Cocoa Night',summary:'Set aside one cozy evening for cocoa, a family story, and time together.',duration:'About 45 minutes',supplies:['Cocoa or another warm drink','Mugs and a snack, if you like','A favorite Christmas story or music'],steps:['Choose an evening and put the phones away.','Make drinks and settle in together.','Share a favorite Christmas memory or read a story.'],roles:{adult:'Prepare the drinks and leave the evening unscheduled.',young:'Set out napkins and mugs with help.',older:'Choose the music or story and serve the drinks.'},closing:'Keep the evening small enough to enjoy.'},
 {id:'ornaments',name:'Our Family Ornament Night',summary:'Create one simple ornament each and remember this Christmas together.',duration:'About 45–60 minutes',supplies:['Paper or card stock','String or ribbon','Crayons, pencils, or markers','Scissors and tape or a hole punch'],steps:['Set the supplies on the table.','Each person makes one ornament and adds their name and year.','Hang the ornaments together and pack away what is left.'],roles:{adult:'Put out safe supplies and help with cutting.',young:'Color a simple paper shape.',older:'Cut shapes, tie ribbons, and help clean up.'},closing:'One small keepsake for this year.'}
];
export interface Plan { family:string; tradition:Tradition; names:string[]; roles:string[]; note:string }
export function prepare(f:Family,t:Tradition):Plan {
 const roles=f.members.map((_,i)=>i===0?'Join the activity; no coordinating required.':i===1?t.roles.adult:f.ages[i]<7?t.roles.young:t.roles.older);
 return {family:f.family,tradition:t,names:[...f.members],roles,note:'The second adult prepares the supplies. Everyone helps make the memory.'};
}
