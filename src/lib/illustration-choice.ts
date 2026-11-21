/**
 * Reusable illustration choice for OMC printable tools.
 * Only mapped, user-approved v2 actions receive color artwork. All others keep
 * the existing simple/hand-drawn artwork. The choice is per tool, not global.
 */
const colorBase = '/assets/icons/ofc/v2/routines/';
const approved = new Set([
  'feed-pets','put-away-toys','unpack-backpack','clear-dishes','comb-hair','get-dressed',
  'eat-breakfast','take-out-trash','set-table','wipe-counter','clothes-in-hamper',
  'dust-furniture','eat-a-snack','homework-and-reading','free-play','lay-out-clothes',
  'grocery-shopping','fill-water-bottle','plan-the-week','clean-floor',
]);
const matches: [RegExp, string][] = [
  [/\bunpack\b.*\b(backpack|lunch box)\b/i,'unpack-backpack'],
  [/\b(pack|packing)\b.*\bbackpack\b/i,''], // Never confuse pack and unpack.
  [/\b(fill|filled)\b.*\bwater bottle\b/i,'fill-water-bottle'],
  [/\b(clothes|laundry)\b.*\bhamper\b|dirty clothes.*basket/i,'clothes-in-hamper'],
  [/\bdust\b/i,'dust-furniture'],
  [/\b(homework|schoolwork)\b/i,'homework-and-reading'],
  [/\b(grocery|groceries)\b/i,'grocery-shopping'],
  [/\b(plan the week|weekly plan|week's plan)\b/i,'plan-the-week'],
  [/\b(lay out|set out)\b.*\bclothes\b/i,'lay-out-clothes'],
  [/\b(free play|play time)\b/i,'free-play'],
  [/\b(pick up|put away|tidy)\b.*\btoys\b/i,'put-away-toys'],
  [/\b(get dressed|dress myself)\b/i,'get-dressed'],
  [/\b(comb|brush)\b.*\bhair\b/i,'comb-hair'],
  [/\b(eat|have)\b.*\bbreakfast\b/i,'eat-breakfast'],
  [/\b(set)\b.*\btable\b/i,'set-table'],
  [/\b(clear)\b.*\b(dishes|table)\b/i,'clear-dishes'],
  [/\b(wipe)\b.*\b(counter|surface)\b/i,'wipe-counter'],
  [/\b(take out|empty)\b.*\btrash\b/i,'take-out-trash'],
  [/\b(clean|vacuum|sweep|mop)\b.*\bfloor\b/i,'clean-floor'],
  [/\b(feed)\b.*\b(pet|dog|cat)\b/i,'feed-pets'],
  [/\b(snack)\b/i,'eat-a-snack'],
];
export function colorIconFor(text: string, slug = ''): string | null {
  const exact = approved.has(slug) ? slug : '';
  const inferred = matches.find(([test]) => test.test(text))?.[1];
  const match = inferred === '' ? '' : (inferred || exact);
  return match && approved.has(match) ? colorBase + match + '.png' : null;
}

type ChoiceOptions = {
  host: HTMLElement;
  controls: HTMLElement;
  key: string;
  entries: () => Array<{ element: HTMLElement; title: string; slug?: string; image?: HTMLImageElement | null }>;
  originalLabel?: string;
};
export function initIllustrationChoice({ host, controls, key, entries, originalLabel = 'Simple / hand-drawn' }: ChoiceOptions) {
  const label = document.createElement('div');
  label.className = 'omc-illustration-choice';
  label.setAttribute('role', 'group');
  label.setAttribute('aria-label', 'Illustration style');
  label.innerHTML = '<span class="omc-illustration-label">Illustrations</span><button type="button" data-icon-choice="simple"></button><button type="button" data-icon-choice="color">Soft color</button>';
  label.querySelector<HTMLButtonElement>('[data-icon-choice="simple"]')!.textContent = originalLabel;
  controls.prepend(label);
  if (!document.getElementById('omc-illustration-choice-css')) {
    const style = document.createElement('style');
    style.id = 'omc-illustration-choice-css';
    style.textContent = '.omc-illustration-choice{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 12px;width:100%;font:500 12px Montserrat,sans-serif;color:#545454}.omc-illustration-label{font-weight:700}.omc-illustration-choice button{border:1px solid #c7c7c1;background:white;color:#545454;border-radius:4px;padding:8px 12px;cursor:pointer}.omc-illustration-choice button[aria-pressed="true"]{background:#D4DFC4;border-color:#9ba98f;font-weight:700}.omc-color-task-icon{width:30px;height:30px;flex:0 0 30px;object-fit:contain;vertical-align:middle;margin-right:6px}.omc-color-task-icon[hidden]{display:none!important}';
    document.head.appendChild(style);
  }
  let choice: 'simple' | 'color' = 'simple';
  try { if (localStorage.getItem(key) === 'color') choice = 'color'; } catch {}
  const original = new WeakMap<HTMLImageElement, string>();
  const refresh = () => {
    for (const item of entries()) {
      const url = colorIconFor(item.title, item.slug);
      if (item.image) {
        if (!original.has(item.image)) original.set(item.image, item.image.getAttribute('src') || '');
        item.image.src = choice === 'color' && url ? url : original.get(item.image)!;
      } else {
        let img = item.element.querySelector<HTMLImageElement>(':scope > .omc-color-task-icon');
        if (!img && url) {
          img = document.createElement('img');
          img.className = 'omc-color-task-icon';
          img.alt = '';
          img.setAttribute('aria-hidden', 'true');
          item.element.prepend(img);
        }
        if (img) {
          img.hidden = choice !== 'color' || !url;
          if (url) img.src = url;
        }
      }
    }
    label.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.iconChoice === choice)));
    host.dataset.illustrationStyle = choice;
  };
  label.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
    choice = button.dataset.iconChoice as 'simple' | 'color';
    try { localStorage.setItem(key, choice); } catch {}
    refresh();
  }));
  refresh();
  return refresh;
}
