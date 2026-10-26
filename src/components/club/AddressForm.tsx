/** Her mailing address for the printed mailing (US only), with "skip printed mailings" for families who want digital only. */
import { useState } from 'react';
import type { Address } from '../../lib/club/membership';

const input = 'mt-1.5 block min-h-12 w-full rounded-[4px] border border-warm-rule bg-white px-3 text-[1rem] text-warm-ink focus:border-warm-ink focus:outline-none';
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

export default function AddressForm({ address, submitLabel, onSave }: { address: Address | null; submitLabel: string; onSave: (a: Address) => Promise<void> }) {
  const [a, setA] = useState<Address>(address ?? { name: '', line1: '', line2: '', city: '', state: '', postal_code: '', paused: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof Address) => (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value });

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError('');
    if (!a.name.trim() || !a.line1.trim() || !a.city.trim() || !STATES.includes(a.state.toUpperCase()) || !/^\d{5}(-\d{4})?$/.test(a.postal_code.trim())) {
      return setError('Fill in the name, street, city, state and a 5-digit ZIP code.');
    }
    setBusy(true);
    try {
      await onSave({ ...a, state: a.state.toUpperCase(), postal_code: a.postal_code.trim() });
    } catch {
      setError('We couldn’t save the address. Check it and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <label className="block"><span className="label text-warm-soft">Name on the envelope</span><input className={input} autoComplete="name" value={a.name} onChange={set('name')} /></label>
      <label className="mt-4 block"><span className="label text-warm-soft">Street address</span><input className={input} autoComplete="address-line1" value={a.line1} onChange={set('line1')} /></label>
      <label className="mt-4 block"><span className="label text-warm-soft">Apartment, unit (optional)</span><input className={input} autoComplete="address-line2" value={a.line2 ?? ''} onChange={set('line2')} /></label>
      <div className="mt-4 grid grid-cols-[1fr_6rem_8rem] gap-3">
        <label className="block"><span className="label text-warm-soft">City</span><input className={input} autoComplete="address-level2" value={a.city} onChange={set('city')} /></label>
        <label className="block"><span className="label text-warm-soft">State</span>
          <select className={input} autoComplete="address-level1" value={a.state.toUpperCase()} onChange={set('state')}>
            <option value="">–</option>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block"><span className="label text-warm-soft">ZIP</span><input className={input} inputMode="numeric" autoComplete="postal-code" value={a.postal_code} onChange={set('postal_code')} /></label>
      </div>
      <label className="mt-5 flex items-start gap-3 text-[0.95rem] text-warm-ink">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={Boolean(a.paused)} onChange={(e) => setA({ ...a, paused: e.target.checked })} />
        <span>Skip printed mailings for now. Your monthly resources stay in your account.</span>
      </label>
      {error && <p role="alert" className="mt-4 border-l-[3px] border-rose bg-rose-wash px-4 py-3">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary mt-6 w-full sm:w-auto">{busy ? 'Saving…' : submitLabel}</button>
      <p className="mt-3 text-[0.85rem] text-warm-soft">We mail within the US only.</p>
    </form>
  );
}
