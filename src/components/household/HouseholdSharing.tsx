/**
 * Account → Family sharing (docs/ios/HOUSEHOLD_ARCHITECTURE.md). Both grown-ups manage the same family, calendar and
 * weekly plan from their own accounts; children never get accounts.
 *
 * Owner: invite the other grown-up already in the family (no second profile: the invitation is for "Luis", the row
 * that's already there), share the one-time link, see and cancel waiting invitations, remove the partner.
 * Partner: sees who set it up, can leave. Billing stays with the owner's account.
 */
import { useEffect, useState } from 'react';
import type { Household } from '../../lib/club/profile';
import { memberColors } from '../../data/club/family-colors';
import {
  createInvite, householdErrorText, leaveHousehold, listInvites, removePartner, revokeInvite,
  type HouseholdAccess, type Invite, type NewInvite,
} from '../../lib/household/api';

export default function HouseholdSharing({ household, access }: { household: Household; access: HouseholdAccess }) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [created, setCreated] = useState<NewInvite | null>(null);
  const [error, setError] = useState('');
  const owner = access.myRole === 'owner';
  const people = household.members.filter((m) => !m.archived);
  const colors = memberColors(household);
  const nameOf = (id: string | null) => people.find((m) => m.id === id)?.firstName ?? null;
  const partner = access.adults.find((a) => a.role === 'partner') ?? null;
  const ownerAdult = access.adults.find((a) => a.role === 'owner') ?? null;
  const linked = new Set(access.adults.map((a) => a.memberId).filter(Boolean));
  const invitable = people.filter((m) => m.kind === 'adult' && !linked.has(m.id) && m.id !== access.myMemberId && !m.isAccountHolder);

  const refresh = () => listInvites().then(setInvites).catch(() => setInvites([]));
  useEffect(() => { if (owner) void refresh(); }, [owner]);

  const act = (f: () => Promise<unknown>) => async () => {
    setError('');
    try { await f(); location.reload(); } catch (e) { setError(householdErrorText((e as Error).message)); }
  };

  return (
    <section className="family-panel mt-5" data-household-sharing aria-labelledby="sharing-h">
      <p className="label">FAMILY SHARING</p>
      <h2 id="sharing-h" className="family-panel-title mt-4">{partner ? 'You share this family' : 'Share with the other grown-up'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-warm-soft">
        Both of you see and change the same family, calendar, weekly plan and who does what, each from your own phone and sign-in. Kids don’t need accounts.
      </p>

      <ul className="mt-5 divide-y divide-warm-rule" data-household-adults>
        {access.adults.map((a) => (
          <li key={`${a.role}-${a.memberId}`} className="flex min-h-14 items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3">
              {a.memberId && <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: colors[a.memberId]?.hex }} />}
              <span className="font-semibold">{nameOf(a.memberId) ?? (a.me ? 'You' : 'Grown-up')}{a.me ? ' (you)' : ''}</span>
            </span>
            <span className="text-sm text-warm-soft">{a.role === 'owner' ? 'Set up the family' : 'Shares the family'}</span>
          </li>
        ))}
      </ul>

      {owner && !partner && <InviteForm candidates={invitable} onCreated={(c) => { setCreated(c); void refresh(); }} />}
      {created && <ShareInvite invite={created} name={nameOf(created.memberId) ?? 'them'} />}

      {owner && invites && invites.some((i) => i.open) && (
        <div className="mt-6" data-household-invites>
          <p className="label">WAITING</p>
          <ul className="mt-2 divide-y divide-warm-rule">
            {invites.filter((i) => i.open).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{nameOf(i.memberId) ?? 'Grown-up'} · {i.email} · until {new Date(i.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <button type="button" className="family-link" onClick={act(() => revokeInvite(i.id))}>Cancel</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {owner && partner && (
        <button type="button" className="family-link mt-6" data-remove-partner onClick={() => {
          if (confirm(`Remove ${nameOf(partner.memberId) ?? 'the other grown-up'}'s access? Your family and everything you've planned stays.`)) void act(removePartner)();
        }}>Remove {nameOf(partner.memberId) ?? 'their'} access</button>
      )}
      {!owner && (
        <>
          <p className="mt-5 text-sm text-warm-soft">{nameOf(ownerAdult?.memberId ?? null) ?? 'The other grown-up'} set up this family and manages its Club membership and billing.</p>
          <button type="button" className="family-link mt-3" data-leave-household onClick={() => {
            if (confirm('Leave this family? You’ll stop seeing its calendar and plans. Nothing they’ve planned is deleted.')) void act(leaveHousehold)();
          }}>Leave this family</button>
        </>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-warm-ink">{error}</p>}
    </section>
  );
}

function InviteForm({ candidates, onCreated }: { candidates: Household['members']; onCreated: (i: NewInvite) => void }) {
  const [memberId, setMemberId] = useState(candidates[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!candidates.length) {
    return (
      <p className="mt-5 text-sm text-warm-soft" data-invite-needs-adult>
        To invite the other grown-up, first add them to your family (Edit our family → add a grown-up). Then come back here.
      </p>
    );
  }
  return (
    <form className="mt-6 space-y-4" data-invite-form onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setError('');
      try { onCreated(await createInvite(memberId, email)); setEmail(''); } catch (err) { setError(householdErrorText((err as Error).message)); }
      setBusy(false);
    }}>
      <label className="block">
        <span className="label">WHO</span>
        <select className="mt-2 block min-h-12 w-full border border-warm-rule bg-white px-3" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {candidates.map((m) => <option key={m.id} value={m.id}>{m.firstName}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">THEIR EMAIL</span>
        <input type="email" required autoComplete="off" inputMode="email" className="mt-2 block min-h-12 w-full border border-warm-rule bg-white px-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <span className="mt-1 block text-xs text-warm-soft">They sign in with this email to join. The invitation works once and lasts 7 days.</span>
      </label>
      <button type="submit" disabled={busy} className="family-action">{busy ? 'Creating…' : 'Create invitation'}</button>
      {error && <p role="alert" className="text-sm text-warm-ink">{error}</p>}
    </form>
  );
}

function ShareInvite({ invite, name }: { invite: NewInvite; name: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Join our family on Organized Mom: ${invite.link}`;
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title: 'Join our family', text, url: invite.link });
    } catch { /* closed the share sheet */ return; }
    await navigator.clipboard?.writeText(invite.link).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <div className="family-note mt-6" data-invite-created>
      <strong className="text-sm">Invitation ready for {name}</strong>
      <p className="mt-1 text-sm leading-relaxed">Send this link by text or email. {name} signs in with {invite.email} to join. It works once and expires {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. It won’t be shown again.</p>
      <p className="mt-3 break-all rounded-[3px] bg-white px-3 py-2 font-mono text-xs" data-invite-link>{invite.link}</p>
      <button type="button" className="family-action mt-4" onClick={share}>{copied ? 'Link copied' : 'Share invitation'}</button>
    </div>
  );
}
