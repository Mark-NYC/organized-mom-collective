/**
 * The Club's emails: welcome (purchase), profile reminder, resource ready, review before printing, failed payment,
 * cancellation. Short, warm and practical (docs/editorial/BRAND_VOICE.md). Each one is sent at most once per
 * dedupe key (club_email_log), so webhook retries and double clicks can't repeat it. Sign-in itself is Supabase
 * Auth's own 6-digit code email; these emails link to /club/login with her address filled in.
 *
 * Copy rules: no delivery dates, nothing unbuilt, "website" not "app", months she already has stay hers.
 */
import { button, C, esc, eyebrowStyle, p, panel, panelTitle, SANS, SERIF, small, type Block, type EmailMessage } from '../email.ts';
import type { ClubDeps } from './deps.ts';

export type ClubEmailKind = 'welcome' | 'profile_reminder' | 'resource_ready' | 'review' | 'payment_failed' | 'canceled' | 'kit_reminder';

export interface ClubEmailData {
  plan?: 'monthly' | 'annual' | null;
  /** "November 2026" */
  monthLabel?: string;
  kitSlug?: string | null;
  /** "December 2, 2026" */
  endsOn?: string | null;
  ended?: boolean;
  /** Welcome on a trial: her free month ("January 2027"), if she has one, and the first charge ("February 1, 2027"). */
  freeMonth?: string | null;
  firstCharge?: string | null;
  test?: boolean;
}

export const monthLabel = (isoMonth: string) =>
  new Date(`${isoMonth.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

/** Her first mailing: her first month's resource and the welcome print in one package. No dates: none are promised. */
const WELCOME_KIT = 'Your first mailing is your Welcome Kit: your family’s first resource, plus a personalized Family Vision watercolor print for your wall, our gift. We prepare them together and mail them to your door in one package.';

const steps = (items: string[]): Block => ({
  html: `<ol style="margin:0 0 18px;padding-left:22px">${items.map((t) => `<li style="margin:0 0 8px">${esc(t)}</li>`).join('')}</ol>`,
  text: items.map((t, i) => `${i + 1}. ${t}`).join('\n'),
});

interface Body {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  blocks: Block[];
}

export function renderClubEmail(kind: ClubEmailKind, to: string, d: ClubEmailData, siteUrl: string): EmailMessage {
  const login = `${siteUrl}/club/login?email=${encodeURIComponent(to)}`;
  const dash = `${siteUrl}/club/dashboard`;
  const resource = d.kitSlug ? `${siteUrl}/club/resources/${d.kitSlug}` : dash;
  let b: Body;
  switch (kind) {
    case 'welcome':
      if (d.firstCharge) {
        // Nothing charged yet: what's free, and exactly when the first $5.90 is.
        b = {
          subject: 'Welcome to the Organized Family Club',
          preheader: d.freeMonth ? `${d.freeMonth} is on us. Your first $5.90 payment is ${d.firstCharge}.` : `Your first $5.90 payment is ${d.firstCharge}.`,
          eyebrow: d.freeMonth ? 'Your first month is free' : 'Monthly membership',
          title: 'Welcome. You’re in.',
          blocks: [
            p(d.freeMonth
              ? `Thank you for joining. Your first month is free: your family’s personalized ${d.freeMonth} plan, printed and mailed to your door, on us.`
              : 'Thank you for joining.'),
            p(WELCOME_KIT),
            p(`Your first $5.90 payment is on ${d.firstCharge}, then $5.90 a month. Cancel any time before then from your account and you won’t pay anything.`),
            panel(C.sage, C.sageRule, [
              panelTitle('Two minutes to get started'),
              steps([
                'Sign in with this email address. We’ll send a 6-digit code; there’s no password.',
                'Tell us who’s in your family: first names and the kids’ ages. That’s what we use to prepare everything.',
                'Approve your Family Vision print, look over your first resource, and we’ll prepare your Welcome Kit.',
              ]),
              button('Sign in to your account', login),
            ]),
            small('Stripe emails your receipts. You can manage or cancel your membership any time from your account.'),
          ],
        };
        break;
      }
      b = {
        subject: 'Welcome to the Organized Family Club',
        preheader: d.plan === 'annual' ? 'Your year of family resources is ready.' : 'Your first month is ready for your family.',
        eyebrow: d.plan === 'annual' ? 'Annual membership' : 'Monthly membership',
        title: 'Welcome. You’re in.',
        blocks: [
          p(d.plan === 'annual'
            ? 'Thank you for joining for the year. Your twelve monthly resources are in your account, with a printed mailing each month.'
            : 'Thank you for joining. Each paid month brings that month’s resource, prepared for your family, with a printed copy in the mail.'),
          p(WELCOME_KIT),
          panel(C.sage, C.sageRule, [
            panelTitle('Two minutes to get started'),
            steps([
              'Sign in with this email address. We’ll send a 6-digit code; there’s no password.',
              'Tell us who’s in your family: first names and the kids’ ages. That’s what we use to prepare everything.',
              'Approve your Family Vision print, look over your first resource, and we’ll prepare your Welcome Kit.',
            ]),
            button('Sign in to your account', login),
          ]),
          small('Stripe emails your receipt separately. You can manage or cancel your membership any time from your account.'),
        ],
      };
      break;
    case 'profile_reminder':
      b = {
        subject: 'One quick step for your family’s plan',
        preheader: 'Add your family’s first names and ages so we can prepare your resources.',
        eyebrow: 'Organized Family Club',
        title: 'We just need your family',
        blocks: [
          p('Your membership is active, but we don’t have your family yet. Add first names and the kids’ ages (about two minutes) and we’ll prepare your resources and printed mailing with them.'),
          button('Add your family', login),
          small('Already done it? Thank you, you can ignore this email.'),
        ],
      };
      break;
    case 'resource_ready':
      b = {
        subject: `${d.monthLabel ?? 'This month'} is ready for your family`,
        preheader: 'Prepared with your family’s names. Open it, adjust anything, print it.',
        eyebrow: d.monthLabel ?? 'New this month',
        title: 'Your new resource is ready',
        blocks: [
          p(`Your ${d.monthLabel ?? ''} resource is in your account, already prepared with your family’s names. Open it, change anything that doesn’t fit, and print it if you’d like a copy now.`.replace('  ', ' ')),
          button('Open it', resource),
        ],
      };
      break;
    case 'review':
      b = {
        subject: `Take a look before we print ${d.monthLabel ?? 'your mailing'}`,
        preheader: 'A quick check of names and details before it goes in the mail.',
        eyebrow: 'Before we print',
        title: 'Does this look right?',
        blocks: [
          p(`Your ${d.monthLabel ?? ''} printable is prepared with your family’s names. Take a quick look, change anything you’d like, then tap “Looks good, print it”.`.replace('  ', ' ')),
          button('Review it', resource),
          small('No time? That’s fine. If we don’t hear from you, we’ll print it as it is.'),
        ],
      };
      break;
    case 'kit_reminder':
      // Two days after she approved her print; the third day confirms her prepared resource for her (club_fulfillment_queue).
      b = {
        subject: 'One quick look before we prepare your Welcome Kit',
        preheader: 'Your first family resource is ready for a quick look before we print it.',
        eyebrow: 'Your Welcome Kit',
        title: 'Does your first resource look right?',
        blocks: [
          p(`Your Family Vision print is approved. Before we print your Welcome Kit, take a quick look at your ${d.monthLabel ?? 'first'} resource. It’s already prepared with your family’s names; change anything that doesn’t fit, then confirm it.`),
          button('Take a look', resource),
          small('No time? That’s fine. If we don’t hear from you within a day, we’ll prepare it as it is.'),
        ],
      };
      break;
    case 'payment_failed':
      b = {
        subject: 'Your Organized Family Club payment didn’t go through',
        preheader: 'Update your card from your account. Months you already have stay yours.',
        eyebrow: 'Payment problem',
        title: 'Your payment didn’t go through',
        blocks: [
          p('We couldn’t take this month’s payment. Stripe will try again over the next few days. To fix it now, sign in and choose Manage billing to update your card.'),
          button('Update your card', dash),
          small('Months you’ve already received stay in your account. This month opens, and its mailing is prepared, once the payment goes through.'),
        ],
      };
      break;
    case 'canceled':
      b = d.ended
        ? {
            subject: 'Your Organized Family Club membership has ended',
            preheader: 'Everything you received stays in your account to view and print.',
            eyebrow: 'Membership ended',
            title: 'Thank you for being a member',
            blocks: [
              p('Your membership has ended and you won’t be charged again. Every resource you received stays in your account to view and print.'),
              button('Open your account', dash),
              small('Changed your mind? You can join again any time from your account.'),
            ],
          }
        : {
            subject: 'Your membership is set to end',
            preheader: d.endsOn ? `It ends on ${d.endsOn}. Nothing else to do.` : 'Nothing else to do.',
            eyebrow: 'Cancellation confirmed',
            title: 'Your cancellation is confirmed',
            blocks: [
              p(`Your membership ends${d.endsOn ? ` on ${d.endsOn}` : ' at the end of the period you paid for'}, and you won’t be charged again. Until then nothing changes, and every resource you received stays in your account afterwards.`),
              button('Open your account', dash),
              small('Changed your mind? Choose Manage billing in your account before then to keep your membership.'),
            ],
          };
      break;
  }
  return layout(b, d.test === true, siteUrl);
}

function layout(b: Body, test: boolean, site: string): EmailMessage {
  const banner = test
    ? `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.rose}" style="background:${C.rose};border:1px dashed ${C.accent};border-radius:8px;padding:12px 16px;font-family:${SANS};font-size:13px;color:${C.ink}"><strong>Test</strong> · Stripe test mode. No real payment was taken.</td></tr></table></td></tr>`
    : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(b.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(b.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:4px 0 20px"><a href="${esc(site)}/club"><img src="${esc(site)}/email/omc-badge-144.png" width="72" height="72" alt="Organized Family Club" style="display:block;width:72px;height:72px;border:0"></a></td></tr>
${banner}
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.rule};border-radius:10px;padding:32px 24px 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink}">
<p style="${eyebrowStyle}">${esc(b.eyebrow)}</p>
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:27px;line-height:1.25;font-weight:700;color:${C.ink}">${esc(b.title)}</h1>
${b.blocks.map((x) => x.html).join('\n')}
</td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
<p style="margin:0 0 10px">Questions? Reply to this email.</p>
<p style="margin:0">Organized Family Club · <a href="${esc(site)}" style="color:${C.muted}">Organized Mom Collective</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [...(test ? ['[TEST: Stripe test mode. No real payment was taken.]', ''] : []), b.title, '', ...b.blocks.map((x) => x.text), '', 'Questions? Reply to this email.', `Organized Family Club · ${site}`].join('\n');
  return { subject: test ? `[Test] ${b.subject}` : b.subject, html, text };
}

export type ClubEmailOutcome = 'sent' | 'skipped' | 'failed' | 'duplicate';

/** Sends one Club email at most once per key. Never throws: the outcome is returned and logged. */
export async function sendClubEmail(
  deps: ClubDeps,
  key: string,
  kind: ClubEmailKind,
  userId: string | null,
  to: string,
  data: ClubEmailData,
): Promise<ClubEmailOutcome> {
  try {
    const state = await deps.db.rpc<'new' | 'done'>('club_email_begin', { p_key: key, p_kind: kind, p_user: userId, p_to: to });
    if (state === 'done') return 'duplicate';
    if (!deps.mailer.configured) {
      await deps.db.rpc('club_email_finish', { p_key: key, p_status: 'skipped', p_error: 'RESEND_API_KEY not set' });
      return 'skipped';
    }
    const msg = renderClubEmail(kind, to, { ...data, test: data.test ?? deps.stripe.mode === 'test' }, deps.env.siteUrl);
    try {
      const r = await deps.mailer.send(to, msg, `club:${key}`);
      await deps.db.rpc('club_email_finish', { p_key: key, p_status: 'sent', p_resend_id: r.id });
      return 'sent';
    } catch (err) {
      await deps.db.rpc('club_email_finish', { p_key: key, p_status: 'failed', p_error: err instanceof Error ? err.message : String(err) });
      return 'failed';
    }
  } catch (err) {
    console.error('club email', kind, err);
    return 'failed';
  }
}
