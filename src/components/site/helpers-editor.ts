/**
 * The "Who's helping?" editor's behavior (src/components/site/HelpersEditor.astro), shared by the family job planners.
 * It edits the list in place and tells the host tool what changed; the tool re-plans and re-renders.
 */
import { groupFor, groupLabel, newHelper, type Group, type Helper } from '../../lib/household-helpers';

export type HelperChange = 'name' | 'group' | 'age' | 'limits' | 'add' | 'remove';

export interface HelpersEditorOptions {
  helpers: () => Helper[];
  setHelpers: (next: Helper[]) => void;
  /** The tool's own limits. */
  limits: readonly { id: string; label: string }[];
  newId: () => string;
  /** After a change: the tool re-plans (not for a name) and calls render(). */
  onChange: (change: HelperChange, helper: Helper) => void;
  say: (text: string) => void;
}

export function initHelpersEditor(root: HTMLElement, o: HelpersEditorOptions) {
  const list = root.querySelector<HTMLUListElement>('[data-hp-people]')!;
  const tpl = root.querySelector<HTMLTemplateElement>('[data-hp-person]')!;
  const q = <T extends Element>(sel: string, el: ParentNode) => el.querySelector<T>(sel)!;

  function render() {
    list.replaceChildren(...o.helpers().map((h) => {
      const li = (tpl.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
      li.dataset.hpHelper = h.id;
      const name = q<HTMLInputElement>('[data-hp-name]', li);
      const group = q<HTMLSelectElement>('[data-hp-group]', li);
      const age = q<HTMLInputElement>('[data-hp-age]', li);
      const box = q<HTMLElement>('[data-hp-limits]', li);
      const toggle = q<HTMLButtonElement>('[data-hp-limits-toggle]', li);
      name.value = h.name;
      name.setAttribute('aria-label', `Name (${groupLabel[h.group]})`);
      group.value = h.group;
      age.value = h.age === null ? '' : String(h.age);
      age.hidden = h.group === 'adult';
      toggle.textContent = h.limits.length ? `Limits (${h.limits.length})` : 'Limits';
      toggle.setAttribute('aria-label', `Limits for ${h.name}`);
      q<HTMLButtonElement>('[data-hp-remove]', li).setAttribute('aria-label', `Remove ${h.name}`);
      box.replaceChildren(...o.limits.map((l) => {
        const check = Object.assign(document.createElement('input'), { type: 'checkbox', checked: h.limits.includes(l.id) });
        check.addEventListener('change', () => {
          h.limits = check.checked ? [...h.limits, l.id] : h.limits.filter((x) => x !== l.id);
          o.onChange('limits', h);
        });
        const label = document.createElement('label');
        label.append(check, l.label);
        return label;
      }));
      toggle.addEventListener('click', () => {
        box.hidden = !box.hidden;
        toggle.setAttribute('aria-expanded', String(!box.hidden));
      });
      name.addEventListener('input', () => {
        h.name = name.value.slice(0, 30) || groupLabel[h.group];
        o.onChange('name', h);
      });
      group.addEventListener('change', () => {
        h.group = group.value as Group;
        if (h.group === 'adult') h.age = null;
        else if (h.age !== null && groupFor(h.age) !== h.group) h.age = null;
        o.onChange('group', h);
      });
      age.addEventListener('change', () => {
        const n = Number(age.value);
        h.age = age.value && Number.isInteger(n) && n >= 2 && n < 18 ? n : null;
        if (h.age !== null) h.group = groupFor(h.age);
        o.onChange('age', h);
      });
      q<HTMLButtonElement>('[data-hp-remove]', li).addEventListener('click', () => {
        if (o.helpers().length === 1) return o.say('Keep at least one person. Add someone else first.');
        o.setHelpers(o.helpers().filter((x) => x !== h));
        o.say(`${h.name} is off the plan.`);
        o.onChange('remove', h);
      });
      return li;
    }));
  }

  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-hp-add]')) {
    b.addEventListener('click', () => {
      const h = newHelper(b.dataset.hpAdd as Group, o.helpers(), o.newId());
      o.setHelpers([...o.helpers(), h]);
      o.onChange('add', h);
      list.querySelectorAll<HTMLInputElement>('[data-hp-name]')[o.helpers().length - 1]?.select();
    });
  }
  return { render };
}
