/** Small, practical chore suggestions, separate from personal routine steps. */
export type ChoreArea = 'space' | 'kitchen' | 'home' | 'laundry' | 'pets' | 'outdoors';
export type Frequency = 'daily' | 'weekly';
export interface ChoreChoice { id: string; label: string; area: ChoreArea; frequency: Frequency; minAge: number; experienced?: boolean; safety?: string }
export const choreAreas: Record<ChoreArea, string> = {
  space: 'Bedrooms & personal spaces',
  kitchen: 'Kitchen & dishes',
  home: 'Shared spaces',
  laundry: 'Laundry',
  pets: 'Pet care',
  outdoors: 'Outdoor jobs',
};
export const choreChoices: ChoreChoice[] = [
  {id:'toys',label:'Put toys away',area:'space',frequency:'daily',minAge:2},
  {id:'hamper',label:'Put dirty clothes in hamper',area:'laundry',frequency:'daily',minAge:2},
  {id:'bed-help',label:'Make bed with help',area:'space',frequency:'daily',minAge:4},
  {id:'bed',label:'Make my bed',area:'space',frequency:'daily',minAge:6},
  {id:'floor',label:'Tidy my bedroom floor',area:'space',frequency:'daily',minAge:6},
  {id:'room',label:'Reset my bedroom',area:'space',frequency:'daily',minAge:11},
  {id:'table',label:'Set the table',area:'kitchen',frequency:'daily',minAge:4},
  {id:'dishes',label:'Clear my dishes',area:'kitchen',frequency:'daily',minAge:4},
  {id:'counters',label:'Wipe kitchen counters',area:'kitchen',frequency:'daily',minAge:7},
  {id:'dishwasher',label:'Unload safe dishwasher items',area:'kitchen',frequency:'daily',minAge:8},
  {id:'kitchen',label:'Own the kitchen reset after dinner',area:'kitchen',frequency:'daily',minAge:14},
  {id:'pet',label:'Feed pets',area:'pets',frequency:'daily',minAge:5,safety:'Adult checks portions and pet safety'},
  {id:'pet-care',label:'Handle daily pet care',area:'pets',frequency:'daily',minAge:12,safety:'Adult oversees animal care'},
  {id:'shared',label:'Put away items in living room',area:'home',frequency:'daily',minAge:5},
  {id:'sort',label:'Help sort clean laundry',area:'laundry',frequency:'weekly',minAge:3},
  {id:'fold',label:'Fold and put away my clothes',area:'laundry',frequency:'weekly',minAge:7},
  {id:'load',label:'Do a laundry load',area:'laundry',frequency:'weekly',minAge:11,safety:'Review appliance use with an adult'},
  {id:'own-laundry',label:'Own my laundry start to finish',area:'laundry',frequency:'weekly',minAge:14},
  {id:'dust',label:'Dust bedroom furniture',area:'space',frequency:'weekly',minAge:6},
  {id:'vacuum',label:'Vacuum my bedroom',area:'space',frequency:'weekly',minAge:8},
  {id:'trash-small',label:'Empty small trash bins',area:'home',frequency:'weekly',minAge:6},
  {id:'trash',label:'Take out household trash',area:'home',frequency:'weekly',minAge:10},
  {id:'bath-sink',label:'Wipe bathroom sink',area:'home',frequency:'weekly',minAge:7,safety:'Use child-safe supplies'},
  {id:'bath',label:'Clean assigned bathroom',area:'home',frequency:'weekly',minAge:11,safety:'Use age-safe supplies'},
  {id:'sweep',label:'Sweep kitchen floor',area:'kitchen',frequency:'weekly',minAge:7},
  {id:'dinner-help',label:'Help prepare family dinner',area:'kitchen',frequency:'weekly',minAge:7,safety:'Adult supervises heat and sharp tools'},
  {id:'dinner',label:'Prepare one family meal',area:'kitchen',frequency:'weekly',minAge:14,safety:'Review kitchen safety'},
  {id:'plants',label:'Water plants',area:'outdoors',frequency:'weekly',minAge:4},
  {id:'outdoor',label:'Tidy outdoor toys and supplies',area:'outdoors',frequency:'weekly',minAge:5},
  {id:'yard',label:'Tidy assigned outdoor area',area:'outdoors',frequency:'weekly',minAge:12},
];
export function recommendedChores(age: number, experienced: boolean, areas: ChoreArea[]): { daily: ChoreChoice[]; weekly: ChoreChoice[] } {
  const eligible = choreChoices.filter(c=>c.minAge<=age && areas.includes(c.area) && (experienced || !c.experienced));
  const dailyCount = age<4?1:age<6?2:age<8?2:3;
  const weeklyCount = age<6?1:age<11?2:3;
  const preferredDaily = ['bed','bed-help','toys','dishes','table','floor','dishwasher','kitchen','hamper','shared','pet','room','counters','pet-care'];
  const preferredWeekly = ['sort','dust','fold','vacuum','trash-small','sweep','load','bath','own-laundry','dinner','plants','outdoor','trash','bath-sink','dinner-help','yard'];
  function pick(frequency: Frequency, count: number, priority: string[]) {
    const ranked=eligible.filter(c=>c.frequency===frequency).sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id));
    const chosen: ChoreChoice[]=[]; const used=new Set<ChoreArea>();
    for (const c of ranked) if (!used.has(c.area) && chosen.length<count) {chosen.push(c);used.add(c.area);}
    for (const c of ranked) if (!chosen.includes(c) && chosen.length<count) chosen.push(c);
    return chosen;
  }
  return {daily:pick('daily',experienced?Math.min(4,dailyCount+1):dailyCount,preferredDaily),weekly:pick('weekly',experienced?Math.min(4,weeklyCount+1):weeklyCount,preferredWeekly)};
}
