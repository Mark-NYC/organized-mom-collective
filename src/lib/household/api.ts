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
export const removePartner = () => accountRpc<null>('household_partner_remove');
export const leaveHousehold = () => accountRpc<null>('household_leave');

/** Plain words for the database's refusals. */
export function householdErrorText(code: string): string {
  switch (code) {
    case 'invite_invalid': return 'This invitation can’t be used. It may have been replaced, cancelled or already accepted. Ask for a new one.';
    case 'invite_expired': return 'This invitation has expired (they last 7 days). Ask for a new one.';
    case 'invite_wrong_email': return 'You’re signed in with a different email from the one this invitation was sent to. Sign out and sign in with that email.';
    case 'already_in_household': return 'This account already belongs to a household. Leave it first (Account → Family sharing) to join this one.';
    case 'invite_member_invalid': return 'Pick a grown-up in your family who doesn’t have their own sign-in yet, and use their email, not yours.';
    case 'too_many_invites': return 'You have 5 invitations waiting. Cancel one before sending another.';
    case 'owner_only': return 'Only the person who set up the family can do that.';
    case 'owner_cannot_leave': return 'You set up this family, so you can’t leave it. You can remove the other adult instead.';
    case 'invalid': return 'That doesn’t look like an email address.';
    default: return 'Something went wrong. Check your connection and try again.';
  }
}

/** Remember an invite code across the sign-in step (this tab only). */
const PENDING = 'omc:household:pending-invite';
export const rememberInviteCode = (code: string) => { try { sessionStorage.setItem(PENDING, code); } catch { /* fine */ } };
export const pendingInviteCode = (): string | null => { try { return sessionStorage.getItem(PENDING); } catch { return null; } };
export const clearInviteCode = () => { try { sessionStorage.removeItem(PENDING); } catch { /* fine */ } };
