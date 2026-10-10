/**
 * The homepage entryway scene (src/components/site/EntrywayScene.astro): a still photo of the
 * real calendar above a console table, with the family's things fading in over a 12-second loop.
 * Photos and boxes come from scripts/entryway-scene.py (spec: design/entryway/README.md).
 * The scene stays off the page until the background and every item below exist.
 *
 * Timeline: 0–2 s empty table, then one beat every 2 s, 10–12 s everything fades back out.
 * Items are listed in paint order (later ones sit in front).
 */
export interface SceneItem {
  /** File name in design/entryway/items/ without .png */
  id: string;
  /** Beat: 0 = 2–4 s, 1 = 4–6 s, 2 = 6–8 s, 3 = 8–10 s */
  beat: 0 | 1 | 2 | 3;
  /** Extra start delay within the beat, in seconds (0–0.6), so items don't move in lockstep. */
  stagger: number;
}

export const SCENE_ITEMS: SceneItem[] = [
  { id: 'backpack', beat: 0, stagger: 0 },
  { id: 'soccer-ball', beat: 0, stagger: 0.4 },
  { id: 'ballet-bag', beat: 1, stagger: 0 },
  { id: 'ballet-shoes', beat: 1, stagger: 0.4 },
  { id: 'work-tools', beat: 2, stagger: 0 },
  { id: 'lunchbox', beat: 2, stagger: 0.3 },
  { id: 'keys', beat: 2, stagger: 0.6 },
  { id: 'grocery-bag', beat: 3, stagger: 0 },
  { id: 'school-papers', beat: 3, stagger: 0.4 },
];

export const SCENE_ALT =
  'A family entryway with the Organized Mom Collective weekly wall calendar hanging above a narrow console table, where a backpack, soccer ball, ballet bag and shoes, keys, a lunchbox, work things, groceries and school papers pile up and clear away.';
