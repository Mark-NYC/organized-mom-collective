/**
 * One routine chart for the whole site: the public page, the buyers' page and the Organized Family Club's page all
 * render the same component with the same behavior module, and the Club hands a child over without a copy of the tool.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readToolHandoff, setToolHandoff } from '../src/lib/tool-handoff';
import { clubTools } from '../src/data/club/tools';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

describe('one routine chart', () => {
  it('every page with a routine chart uses the same component', () => {
    const users = files('src/pages').filter((f) => /RoutineChart/.test(readFileSync(f, 'utf8')));
    expect(users.sort()).toEqual(['src/pages/club/tools/routine-chart.astro', 'src/pages/routine-chart/[access].astro', 'src/pages/routine-chart/index.astro']);
    for (const f of users) expect(readFileSync(f, 'utf8'), f).toMatch(/import RoutineChart from '(\.\.\/)+components\/site\/RoutineChart\.astro'/);
  });

  it('the component’s behavior lives in one module, and the Club has no routine chart of its own', () => {
    expect(readFileSync('src/components/site/RoutineChart.astro', 'utf8')).toMatch(/import \{ initRoutineChart \} from '\.\/routine-chart'/);
    const club = files('src/components/club').map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(club).not.toMatch(/RoutineChartSheet|RoutineEditor|editor === 'routine'/);
    expect(readFileSync('src/styles/club.css', 'utf8')).not.toMatch(/club-routine-chart/);
  });

  it('every page with a chore chart uses the same component, and the public page keeps its email step', () => {
    const users = files('src/pages').filter((f) => /ChoreChart/.test(readFileSync(f, 'utf8')));
    expect(users.sort()).toEqual(['src/pages/chore-chart.astro', 'src/pages/club/tools/chore-chart.astro']);
    for (const f of users) expect(readFileSync(f, 'utf8'), f).toMatch(/import ChoreChart from '(\.\.\/)+components\/site\/ChoreChart\.astro'/);
    expect(readFileSync('src/components/site/ChoreChart.astro', 'utf8')).toMatch(/import \{ initChoreChart \} from '\.\/chore-chart'/);
    // The download gate is keyed to the public path, so Club members are never asked for an email.
    expect(readFileSync('src/lib/tool-email.ts', 'utf8')).toMatch(/pathname\.replace\(\/\\\/\$\/, ''\) === '\/chore-chart'/);
  });

  it('every Club tool is a page that hosts the public component in handoff mode', () => {
    for (const t of Object.values(clubTools)) {
      const page = readFileSync(`src/pages${t.path}.astro`, 'utf8');
      expect(page, t.id).toMatch(/ClubLayout/);
      expect(page, t.id).toMatch(/ handoff\b/);
    }
  });
});

describe('tool handoff', () => {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  afterEach(() => store.clear());

  it('hands a child and a starting routine to the tool it’s for, and only that tool', () => {
    setToolHandoff({ tool: 'routine-chart', key: 'sample-rivera-mateo-afterschool', name: 'Mateo', age: 8, variant: 'afterschool', back: { href: '/club/kits/2027-08-school-year', label: 'Ready for the School Year' } });
    expect(readToolHandoff('routine-chart', 'rivera')).toEqual({
      tool: 'routine-chart', key: 'sample-rivera-mateo-afterschool', name: 'Mateo', age: 8, variant: 'afterschool',
      back: { href: '/club/kits/2027-08-school-year', label: 'Ready for the School Year' },
    });
    expect(readToolHandoff('chore-chart', 'rivera')).toBeNull();
    // Opened as another sample family (or as a member) in the same tab: not theirs, so nothing carries over.
    expect(readToolHandoff('routine-chart', 'brooks')).toBeNull();
    expect(readToolHandoff('routine-chart', null)).toBeNull();
  });

  it('drops anything malformed: bad keys, odd ages, off-site back links', () => {
    store.set('omc:tool-handoff', JSON.stringify({ tool: 'routine-chart', key: 'k1', name: '  Ava   Rose  ', age: 4.5, variant: 'bed time', back: { href: '//evil.example', label: 'x' } }));
    expect(readToolHandoff('routine-chart')).toEqual({ tool: 'routine-chart', key: 'k1', name: 'Ava Rose' });
    store.set('omc:tool-handoff', JSON.stringify({ tool: 'routine-chart', key: 'has spaces' }));
    expect(readToolHandoff('routine-chart')).toBeNull();
    store.set('omc:tool-handoff', '{not json');
    expect(readToolHandoff('routine-chart')).toBeNull();
  });
});
