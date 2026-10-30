/** The Welcome Kit's three steps (src/lib/club/onboarding.ts → kitProgress): her family, her print, her first resource. */
import type { KitProgress } from '../../lib/club/onboarding';

export default function KitSteps({ steps, className = '' }: { steps: KitProgress; className?: string }) {
  return (
    <ol aria-label="Your Welcome Kit" className={`kit-steps ${className}`}>
      {steps.map((s, i) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span aria-hidden="true">{s.state === 'done' ? '✓' : i + 1}</span>
          {s.label}
          {s.state === 'done' && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
  );
}
