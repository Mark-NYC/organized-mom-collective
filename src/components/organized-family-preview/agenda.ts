import type { WeekAhead, WeekItem } from '../../lib/family-meeting-support';

export const eventKey = (item: WeekItem) => JSON.stringify([item.ref.source, item.ref.event_uid, item.ref.instance_key]);

/** Reasons describe the calendar signal. They never imply assignment or consent. */
export function suggestions(week: WeekAhead, omitted: Set<string>) {
  const seen = new Set<string>();
  const conflicts = new Set<string>();
  const ranked: {item: WeekItem; reason: string; score: number}[] = [];
  for (const day of week.days) {
    for (const item of day.items) {
      const series = JSON.stringify([item.ref.source, item.ref.event_uid]);
      if (seen.has(series) || omitted.has(eventKey(item)) || item.time === 'Continues') continue;
      let reason = '';
      let score = 0;
      const other = day.items.find(event => event.id !== item.id && event.time === item.time);
      const slot = day.date + item.time;
      if (item.change === 'changed') {
        score = 5; reason = 'The details changed this week. Does your plan need to change too?';
      } else if (item.time !== 'All day' && other && !conflicts.has(slot)) {
        conflicts.add(slot); score = 4; reason = other.title + ' starts at the same time. Who can cover each one?';
      } else if (/field trip|tournament|performance|recital|travel|flight|appointment/i.test(item.title)) {
        score = 3; reason = 'Worth checking together. Do you need to bring anything or arrange a ride?';
      } else if (/practice|lesson|game|rehearsal/i.test(item.title)) {
        score = 2; reason = 'Who has the gear and who’s handling pickup?';
      } else if (item.change === 'new') {
        score = 1; reason = 'New on the calendar. Does anyone need a heads-up?';
      }
      if (score) { ranked.push({item, reason, score}); seen.add(series); }
    }
  }
  return ranked.sort((a,b)=>b.score-a.score).slice(0,3);
}
