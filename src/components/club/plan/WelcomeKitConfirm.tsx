/**
 * Her Welcome Kit's last step, on her first month's real tool (/app/club/<month>, the page stepHref sends her to):
 * look the plan over, change anything (it saves to her account, ./account.ts), then confirm it herself with
 * "Looks good. Prepare my Welcome Kit" (club_fulfillment_approve, the same call /club/resources/<slug> makes).
 * Shown only to a signed-in member whose kit carries this month and still waits on her; nothing is confirmed for her.
 * Before her print is approved it points her back to it. Never on samples or previews.
 */
import { useEffect, useState } from 'react';
import { clubAccountsEnabled } from '../../../data/club/config';
import { clubResourceBySlug } from '../../../data/club/resources';
import { getSession } from '../../../lib/account';
import { approveResource, loadMembership, monthName, type Membership } from '../../../lib/club/membership';
import { kitProgress, welcomeKitView, type WelcomeKitView as View } from '../../../lib/club/onboarding';
import { routes } from '../../../routes';
import KitSteps from '../KitSteps';
import { PLAN_SAVE } from '../../../lib/club/plan/account';

export default function WelcomeKitConfirm({ kitSlug }: { kitSlug: string }) {
  const [view, setView] = useState<View>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clubAccountsEnabled() || new URLSearchParams(location.search).get('sample')) return;
    let member = false;
    const refresh = () => loadMembership().then((me) => setView((was) => {
      const now = welcomeKitView(me, kitSlug);
      // A change after she confirmed asks her to confirm again (club_resource_save clears the approval).
      return now === 'none' && was === 'done' ? 'done' : now;
    }), () => undefined);
    getSession().then((s) => {
      if (!s) return;
      member = true;
      return refresh();
    }).catch(() => undefined);
    const root = document.querySelector<HTMLElement>(`.club-plan[data-kit-slug="${kitSlug}"]`);
    const onSave = () => { if (member && root?.dataset.planSave === 'saved') refresh(); };
    root?.addEventListener(PLAN_SAVE, onSave);
    return () => root?.removeEventListener(PLAN_SAVE, onSave);
  }, [kitSlug]);

  if (view === 'none') return null;
  const r = clubResourceBySlug(kitSlug);
  const month = r ? monthName(`${r.month}-01`).split(' ')[0] : 'your first month';
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await approveResource(kitSlug);
      const me = await loadMembership();
      setView(welcomeKitView(me, kitSlug) === 'confirm' ? 'confirm' : 'done');
    } catch {
      setError('We couldn’t save that just now. Nothing was sent to print. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-welcome-kit-confirm data-club-chrome aria-labelledby="wk-confirm-title" className="mx-auto mt-4 mb-2 max-w-5xl px-4 print:hidden sm:px-8">
      <div className="rounded-[12px] border border-[#dde4dc] bg-[#eaf2eb] p-5 sm:p-7">
        {view === 'print_first' && (
          <>
            <KitSteps steps={kitProgress('print')} />
            <h2 id="wk-confirm-title" className="font-serif text-[1.5rem] leading-tight text-warm-ink">This comes in your Welcome Kit</h2>
            <p className="mt-2 text-warm-soft">{month} is mailed together with your Family Vision print. Approve your print first, then come back here to confirm {month}.</p>
            <a className="btn-primary mt-4 inline-block" href={routes.clubFamilyVision}>Approve your print</a>
          </>
        )}
        {view === 'confirm' && (
          <>
            <KitSteps steps={kitProgress('first_resource')} />
            <p className="label text-warm-soft">Your first family resource · {r ? monthName(`${r.month}-01`) : ''}</p>
            {/* The plan below is the tool itself; its title is on it (the registry's title can differ, PR #268). */}
            <h2 id="wk-confirm-title" className="mt-1 font-serif text-[1.6rem] leading-tight text-warm-ink sm:text-[1.9rem]">Your {month} plan</h2>
            {/* On a phone the tool's own bar covers the bottom of the screen: the button comes before the details there. */}
            <div className="flex flex-col">
            <dl className="mt-3 grid gap-3 text-[0.95rem] max-sm:order-last sm:grid-cols-2">
              <div><dt className="font-semibold text-warm-ink">In your Welcome Kit</dt><dd className="text-warm-soft">Your printed {month} resource and your Family Vision print, mailed together in one package.</dd></div>
              <div><dt className="font-semibold text-warm-ink">Before you confirm</dt><dd className="text-warm-soft">Look over the plan below. It’s filled in with your family’s names; change anything that doesn’t fit. It saves as you go. The tool’s own “Approve this plan” only marks it on this device; this button is what prepares your Welcome Kit.</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Looks good. Prepare my Welcome Kit'}</button>
              <a className="underline underline-offset-4" href={routes.clubFamilyVision}>Back to my print</a>
            </div>
            </div>
            {error && <p role="alert" className="mt-3 border-l-[3px] border-rose bg-rose-wash px-4 py-3 text-warm-ink">{error}</p>}
          </>
        )}
        {view === 'done' && (
          <div role="status">
            <h2 id="wk-confirm-title" className="font-serif text-[1.6rem] leading-tight text-warm-ink"><span aria-hidden="true">✓ </span>It’s all set!</h2>
            <p className="mt-2 max-w-2xl text-warm-ink">Your Welcome Kit is being prepared: your Family Vision print and your {month} resource, printed together and mailed to you in one package. You’ll see when it ships on Club Home.</p>
            <a className="btn-primary mt-4 inline-block" href={routes.appClub}>Go to Club Home</a>
          </div>
        )}
      </div>
    </section>
  );
}
