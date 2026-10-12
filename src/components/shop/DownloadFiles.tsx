import { useEffect, useState } from 'react';
import { requestDownload, type DownloadError, type DownloadFiles as Files } from '../../lib/shop';
import { weeklyReset } from '../../data/weekly-reset';
import { TAKE_BACK_CONTROL_SLUG } from '../../data/take-back-control';
import { PLANNER_PLUS_PATH } from '../../data/planner';

/**
 * /download?t=TOKEN — the link in a digital order's emails. Trades the token for short-lived
 * links to the files (they're never public), so each visit asks for fresh ones. Nothing here
 * proves a purchase: the server checks the token, the payment and the expiry every time.
 */
export default function DownloadFiles() {
  const [state, setState] = useState<Files | { error: DownloadError } | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('t') ?? '';
    if (!/^[0-9a-f]{48}$/.test(token)) {
      setState({ error: 'invalid_link' });
      return;
    }
    requestDownload(token).then(setState);
  }, []);

  if (!state) return <p className="py-10 text-center text-soft">Getting your files ready…</p>;

  if ('error' in state) {
    const { title, body } = errorCopy(state.error);
    return (
      <div className="py-6">
        <h1 className="page-title">{title}</h1>
        <p className="lede mt-4">{body}</p>
        <p className="mt-6 leading-relaxed">
          Write to{' '}
          <a href={`mailto:${weeklyReset.contactEmail}`} className="font-semibold underline underline-offset-2">
            {weeklyReset.contactEmail}
          </a>{' '}
          with the email address you used at checkout, and we’ll send you a fresh link.
        </p>
      </div>
    );
  }

  const until = new Date(state.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const missing = state.files.some((f) => !f.url);

  return (
    <div className="py-6">
      {state.test && (
        <p className="mb-6 rounded-[3px] border border-dashed border-rule-strong bg-band px-4 py-3 text-[0.9rem] leading-snug">
          <span className="font-semibold">Test order.</span> Stripe test mode: no real payment was taken.
        </p>
      )}
      {state.order_number && <p className="label text-soft">Order #{state.order_number}</p>}
      <h1 className="page-title mt-3">Your Downloads</h1>
      <p className="lede mt-4">Save each file to your phone or computer. The PDFs print at home on regular paper, and the audio plays anywhere.</p>

      <ul className="mt-8 border-t border-rule">
        {state.files.map((f) => (
          <li key={f.label} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule py-4">
            <span className="font-semibold">{f.label}</span>
            {f.url ? (
              <a href={f.url} className="btn-primary min-h-12 px-6" download>
                Download
              </a>
            ) : (
              <span className="text-[0.9rem] text-soft">Not available right now</span>
            )}
          </li>
        ))}
      </ul>

      {state.files.some((f) => f.product === TAKE_BACK_CONTROL_SLUG) && (
        <section aria-labelledby="tools-h" className="mt-10 rounded-[3px] bg-band px-5 py-5">
          <h2 id="tools-h" className="text-[1.15rem] font-bold">
            Your Website Tools
          </h2>
          <p className="mt-2 leading-relaxed">
            These live on our website, not in a file. <strong>Bookmark them now</strong>: this download page stops working after {until}, but the tools don’t.
          </p>
          <p className="mt-4">
            <a href={PLANNER_PLUS_PATH} className="btn-primary min-h-12 px-6">
              Open the Weekly Planner Generator
            </a>
          </p>
        </section>
      )}

      {missing && (
        <p role="alert" className="mt-4 border-l-[3px] border-month bg-band px-4 py-3">
          One of your files couldn’t be prepared. Please write to {weeklyReset.contactEmail} and we’ll send it to you.
        </p>
      )}
      <p className="mt-6 text-[0.95rem] leading-relaxed text-soft">
        This page works until {until}. Each download button works for a few minutes; reload the page for fresh ones. Need the files again after that? Email{' '}
        {weeklyReset.contactEmail}.
      </p>
    </div>
  );
}

function errorCopy(e: DownloadError): { title: string; body: string } {
  switch (e) {
    case 'link_expired':
      return { title: 'This Download Link Has Expired', body: 'Download links work for 7 days. No problem: we’ll send you a new one.' };
    case 'access_revoked':
      return { title: 'This Download Link No Longer Works', body: 'This order was refunded, so its download link was turned off.' };
    case 'rate_limited':
      return { title: 'Too Many Tries', body: 'Please wait a few minutes and reload this page.' };
    case 'invalid_link':
      return { title: 'We Couldn’t Find That Download', body: 'The link may be incomplete. Open it straight from your email, or ask us for a new one.' };
    default:
      return { title: 'Downloads Aren’t Available Right Now', body: 'Please try again in a few minutes.' };
  }
}
