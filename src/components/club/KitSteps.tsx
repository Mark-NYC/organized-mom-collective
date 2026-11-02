/**
 * Her Welcome Kit journey, three phases (src/lib/club/onboarding.ts → JOURNEY, kitProgress): Tell us about your family,
 * Make it yours, Confirm your Welcome Kit. Compact enough for the onboarding header (ClubNav); short labels on phones.
 */
import type { KitProgress } from '../../lib/club/onboarding';

export default function KitSteps({ steps, className = '' }: { steps: KitProgress; className?: string }) {
  return (
    <ol aria-label="Your Welcome Kit" className={`kit-steps ${className}`}>
      {steps.map((s, i) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span aria-hidden="true">{s.state === 'done' ? '✓' : i + 1}</span>
          <span className="kit-steps-label"><span className="sm:hidden">{s.short}</span><span className="max-sm:hidden">{s.label}</span></span>
          {s.state === 'done' && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
  );
}
