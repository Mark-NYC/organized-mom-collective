/**
 * The Club's frame around one of the site's tools (src/pages/club/tools/<tool>.astro): the member header, the way
 * back to the kit, and who the tool was opened for. The tool itself is the site's own component, below this island.
 */
import { useState } from 'react';
import { readToolHandoff } from '../../lib/tool-handoff';
import { routes } from '../../routes';
import ClubGate from './ClubGate';

export default function ClubToolBar({ tool, title }: { tool: string; title: string }) {
  const [handoff] = useState(() => readToolHandoff(tool));
  return (
    <ClubGate page="tool">
      {({ href }) => (
        <div className="max-w-3xl">
          <a href={handoff?.back?.href ?? href(routes.clubDashboard)} className="inline-block min-h-11 py-2 text-[0.92rem] text-warm-soft underline underline-offset-4">
            ← Back to {handoff?.back?.label ?? 'your kits'}
          </a>
          <h1 className="mt-2 font-serif text-[2rem] leading-tight text-warm-ink sm:text-[2.4rem]">
            {handoff?.name ? `${handoff.name}’s ${title.toLowerCase()}` : title}
          </h1>
          <p className="mt-2 leading-relaxed text-warm-soft">
            {handoff?.name ? `It starts with ${handoff.name}’s name on it${handoff.age !== undefined ? `, and the jobs suited to age ${handoff.age} come first` : ''}. ` : ''}
            Tap illustrated steps, put them in order, add times, then download it to print. It saves in this browser.
          </p>
        </div>
      )}
    </ClubGate>
  );
}
