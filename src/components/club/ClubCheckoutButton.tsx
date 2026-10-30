import { useState } from 'react';
import { startCheckout, billingErrorText } from '../../lib/club/membership';

/** Direct Stripe checkout from the Club offer. Stripe collects guest email and shipping. */
export default function ClubCheckoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { url } = await startCheckout('monthly');
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      setError(billingErrorText((err as Error).message));
    }
  };
  return (
    <>
      <button type="button" className="primary" onClick={go} disabled={busy}>
        {busy ? 'Opening secure checkout…' : 'Get My First Month Free →'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </>
  );
}
