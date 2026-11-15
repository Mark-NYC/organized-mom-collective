/**
 * The shared household, as the signed-in adult (docs/ios/HOUSEHOLD_ARCHITECTURE.md). Thin wrappers over the database
 * functions in supabase/migrations/20261124000000_household_shared.sql. The family itself (people, colors) still loads
 * and saves through the Club store (src/lib/club/store.ts → club_household / household_save): one family, one path.
 */
import { accountRpc } from '../account';
import { routes } from '../../routes';
import { SITE } from '../native/links';

export type AdultRole = 'owner' | 'partner';
export interface HouseholdAdult { role: AdultRole; memberId: string | null; me: boolean }
export interface HouseholdAccess { householdId: string; myRole: AdultRole; myMemberId: string | null; adults: HouseholdAdult[] }

interface DbAccess {
  id: string;
  my_role?: AdultRole;
  my_member_id?: string | null;
  adults?: { role: AdultRole; member_id: string | null; me: boolean }[];
}

/** Who shares the household (null: no household yet). A database without 20261124 reports her as the only owner. */
export async function householdAccess(): Promise<HouseholdAccess | null> {
  const r = await accountRpc<DbAccess | null>('club_household');
  if (!r) return null;
  return {
    householdId: r.id,
    myRole: r.my_role ?? 'owner',
    myMemberId: r.my_member_id ?? null,
    adults: (r.adults ?? [{ role: 'owner', member_id: null, me: true }]).map((a) => ({ role: a.role, memberId: a.member_id, me: a.me })),
  };
}

export interface Invite { id: string; memberId: string; email: string; createdAt: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; open: boolean }
interface DbInvite { id: string; member_id: string; email: string; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; open: boolean }

export const listInvites = () =>
  accountRpc<DbInvite[]>('household_invites').then((rows) => rows.map((i) => ({
    id: i.id, memberId: i.member_id, email: i.email, createdAt: i.created_at, expiresAt: i.expires_at,
    acceptedAt: i.accepted_at, revokedAt: i.revoked_at, open: i.open,
  })));

export interface NewInvite { id: string; code: string; email: string; memberId: string; expiresAt: string; link: string }

/** The link the partner opens. Always the website's address, so it works from a text message or email on any phone. */
export const inviteLink = (code: string) => `${SITE}${routes.householdJoin}?code=${encodeURIComponent(code)}`;

export async function createInvite(memberId: string, email: string): Promise<NewInvite> {
  const r = await accountRpc<{ id: string; code: string; email: string; member_id: string; expires_at: string }>('household_invite_create', { p_member_id: memberId, p_email: email });
  return { id: r.id, code: r.code, email: r.email, memberId: r.member_id, expiresAt: r.expires_at, link: inviteLink(r.code) };
}
export const revokeInvite = (id: string) => accountRpc<null>('household_invite_revoke', { p_id: id });
export const acceptInvite = (code: string) => accountRpc<DbAccess>('household_invite_accept', { p_code: code });

/**
 * What accepting would mean for the signed-in account (20261130_household_join_from_own): 'ready', already 'joined',
 * 'leave_own' (they already have a family on this account: `mine` says what's in it, ask first) or 'blocked'.
 */
export interface InvitePreview {
  status: 'ready' | 'leave_own' | 'blocked' | 'joined';
  reason?: 'own_household_shared' | 'own_household_membership';
  invitedAs: string | null;
  family: string | null;
  mine?: { id: string; role: AdultRole; family: string | null; people: string[]; events: number; agreements: number };
}
interface DbPreview { status: InvitePreview['status']; reason?: InvitePreview['reason']; invited_as: string | null; family: string | null; mine?: InvitePreview['mine'] }
/** Null on a database without 20261130 (the plain accept then decides). Invalid codes throw the usual invite errors. */
export async function previewInvite(code: string): Promise<InvitePreview | null> {
  try {
    const r = await accountRpc<DbPreview>('household_invite_preview', { p_code: code });
    return { status: r.status, reason: r.reason, invitedAs: r.invited_as, family: r.family, mine: r.mine };
  } catch (e) {
    if (/schema cache|could not find the function|request_failed_404/i.test((e as Error).message)) return null;
    throw e;
  }
}
/**
 * Accept, leaving the family this account is in now. `leaving` is the household the confirmation screen showed
 * (preview.mine.id): the database refuses anything else. `keepEvents`: her calendar plans come with her. A copy of
 * everything she set up is kept for 90 days either way.
 */
export const acceptInviteLeaving = (code: string, leaving: string, keepEvents: boolean) =>
  accountRpc<DbAccess & { brought_events?: number }>('household_invite_accept_leaving', { p_code: code, p_leaving: leaving, p_keep_events: keepEvents });

/** The code in whatever they pasted: the invitation link, the whole message, or the code itself. */
export function inviteCodeFrom(text: string): string | null {
  const m = /(?:^|[^0-9a-f])([0-9a-f]{32})(?![0-9a-f])/i.exec(text.trim());
  return m ? m[1].toLowerCase() : null;
}
export const removePartner = () => accountRpc<null>('household_partner_remove');
export const leaveHousehold = () => accountRpc<null>('household_leave');

/** Plain words for the database's refusals. */
export function householdErrorText(code: string): string {
  switch (code) {
    case 'invite_invalid': return 'This invitation can’t be used. It may have been replaced, cancelled or already accepted. Ask for a new one.';
    case 'invite_expired': return 'This invitation has expired (they last 7 days). Ask for a new one.';
    case 'invite_wrong_email': return 'You’re signed in with a different email from the one this invitation was sent to. Sign out and sign in with that email.';
    case 'already_in_household': return 'This account already has a family set up, so it can’t join another one yet. Contact us and we’ll sort it out.';
    case 'leaving_mismatch': return 'Your family changed while this was open. Open your invitation again to see what joining means now.';
    case 'own_household_shared': return 'Another grown-up shares the family on this account. Remove their access first (Account → Family sharing), then open your invitation again.';
    case 'own_household_membership': return 'The family on this account has a Family Meeting Club membership, so we won’t replace it automatically. Contact us and we’ll move you over.';
    case 'invite_member_invalid': return 'Pick a grown-up in your family who doesn’t have their own sign-in yet, and use their email, not yours.';
    case 'too_many_invites': return 'You have 5 invitations waiting. Cancel one before sending another.';
    case 'household_full': return 'Your family already has two grown-ups with their own sign-in. Remove one before inviting someone new.';
    case 'owner_only': return 'Only the person who set up the family can do that.';
    case 'owner_cannot_leave': return 'You set up this family, so you can’t leave it. You can remove the other adult instead.';
    case 'invalid': return 'That doesn’t look like an email address.';
    case 'signed_out': return 'Your sign-in ended. Open your invitation again and sign in.';
    default:
      // A backend that doesn't have family sharing yet (the function isn't there).
      if (/schema cache|could not find the function|request_failed_404/i.test(code)) return 'Family sharing isn’t switched on yet. Your invitation will work as soon as it is; nothing is wrong with your link.';
      return 'Something went wrong. Check your connection and try again.';
  }
}

/** Remember an invite code across the sign-in step (this tab only). */
const PENDING = 'omc:household:pending-invite';
export const rememberInviteCode = (code: string) => { try { sessionStorage.setItem(PENDING, code); } catch { /* fine */ } };
export const pendingInviteCode = (): string | null => { try { return sessionStorage.getItem(PENDING); } catch { return null; } };
export const clearInviteCode = () => { try { sessionStorage.removeItem(PENDING); } catch { /* fine */ } };
