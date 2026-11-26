/**
 * V20 preview scenarios: V19's 21 plus five that show notifications. SIMULATED facts on the Rivera household, chosen
 * outside the product; what each phone receives is computed by the real rules (notify.ts) from the shared state.
 */
import { addDays } from '../calendar/recurrence';
import { ANA, LUIS, signature, type Part, type V16State } from '../v16/model';
import { SCENARIOS_V19, seedV19, demoToday, type ScenarioV19 } from '../v19/scenarios';

export { demoToday };

export const SCENARIOS_V20 = [
  ...SCENARIOS_V19,
  ['n-help', 'Push: Ana asks Luis for a hand'],
  ['n-conflict', 'Push: a conflict in Luis’s plan'],
  ['n-changed', 'Push: Luis updated a shared plan'],
  ['n-quiet', 'Push: a request during quiet hours'],
  ['n-meeting', 'Push: Family Meeting reminder (opted in)'],
] as const;
export type ScenarioV20 = (typeof SCENARIOS_V20)[number][0];

export function seedV20(id: ScenarioV20, opts: { club: boolean; monday: string }): V16State {
  const { monday } = opts;
  const today = demoToday(monday);
  const v19 = (x: ScenarioV19) => seedV19(x, opts);
  let s: V16State;
  const ask = (p: Partial<Part>): Part => ({ id: `p-v19-backup-p-dinner-thu-${today}`, origin: 'prepared', title: 'Make dinner tonight', ownerId: LUIS, finishLine: 'Dinner on the table by 6:30',
    onDate: today, need: 'dinner', cue: 'Start at 5:30 PM', askedBy: ANA, status: 'suggested', why: 'Ana asked for backup tonight.', ...p });
  switch (id) {
    case 'n-help':
      s = v19('backup');
      // Ana chose "Ask Luis" from her heads-up card: her card is resolved; Luis's phone has the request.
      s = { ...s, parts: [...s.parts, ask({})], intel: { ...s.intel!, feedback: [{ key: `backup:p-dinner-thu:${today}`, fingerprint: '', pattern: 'backup:dinner', kind: 'handled', on: today }] } };
      break;
    case 'n-conflict': s = v19('change'); break;
    case 'n-changed': {
      s = v19('quiet');
      s = { ...s, parts: s.parts.map((p) => {
        if (p.id !== 'p-drive-soccer') return p;
        const next = { ...p, cue: 'Leave at 3:30 PM' };
        return { ...next, agreedOn: today, agreedSignature: signature(next), lastChangedBy: LUIS, lastChangedOn: today };
      }) };
      break;
    }
    case 'n-quiet':
      s = v19('quiet');
      s = { ...s, parts: [...s.parts, ask({ id: 'p-v20-trip-pickup', title: 'Pick up Sofia after the field trip', onDate: addDays(today, 1), need: 'pickup', cue: 'At 2:00 PM', finishLine: 'At school when the bus gets back' })] };
      break;
    case 'n-meeting':
      s = v19('quiet');
      s = { ...s, intel: { ...s.intel!, notifyPrefs: { [ANA]: { meeting: true }, [LUIS]: { meeting: true } } } };
      break;
    default: s = v19(id as ScenarioV19);
  }
  const clock = id === 'n-quiet' ? '21:45' : id === 'n-conflict' ? '13:30' : '14:30';
  return { ...s, intel: { ...s.intel!, scenario: id, clock, sent: {}, claims: {}, notifyPrefs: s.intel!.notifyPrefs ?? {} } };
}
