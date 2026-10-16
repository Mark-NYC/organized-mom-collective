/**
 * POST /functions/v1/support-return — called only by a Supabase Database Webhook on
 * support_requests UPDATE, with the shared secret in x-webhook-secret (SUPPORT_WEBHOOK_SECRET).
 *
 * When the owner sets a request's return_status to 'approved', this emails that customer the
 * return instructions, once (support_return_claim). It's the ONLY place the return address
 * (RETURN_ADDRESS, an Edge Function secret) is ever used: never in the database, the site, the
 * repository, logs, the acknowledgment or the support-inbox copy. No address configured → nothing
 * is sent and the row says no_address. Setup: supabase/SUPPORT.md → Approving a return.
 */
import type { ShopDeps } from '../deps.ts';
import { C, SERIF, esc, p, small, type Block, type EmailMessage } from '../email.ts';
import { json, readJson, safeEqual, type Handler } from '../http.ts';
import { POLICY, greetingName } from '../../../../src/data/support.ts';
import { senderRefused, shell } from './support.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Claimed {
  reference: string;
  name: string;
  email: string;
  order_number: string | null;
  topic: string;
}

/** "Name|Street|City, ST 00000" or one line per row → trimmed lines; null unless it looks like an address. */
export function addressLines(raw: string): string[] | null {
  const lines = raw
    .split(/\r?\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2 || lines.length > 6 || lines.some((l) => l.length > 120)) return null;
  return lines;
}

/** The approved return instructions: short, personal, and the only email that carries the address. */
export function returnInstructionsEmail(c: Claimed, address: string[], siteUrl: string): EmailMessage {
  const hi = greetingName(c.name);
  const damaged = c.topic === 'damaged';
  const addressBlock: Block = {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr>` +
      `<td bgcolor="${C.sage}" style="background:${C.sage};border:1px solid ${C.sageRule};border-radius:8px;padding:16px 18px;font-family:${SERIF};font-size:17px;line-height:1.5;color:${C.ink}">` +
      `${address.map(esc).join('<br>')}</td></tr></table>`,
    text: address.join('\n'),
  };
  const notes: string[] = [
    `Please pop a note in the box with your reference, ${c.reference}${c.order_number ? `, or your order number, ${c.order_number}` : ''}, so we can match it to you.`,
    damaged
      ? 'Since this is about a damaged or incorrect order, you won’t pay for postage: reply to this email before you ship and we’ll sort out the label with you.'
      : 'Return postage is yours to cover. A trackable service protects you if anything goes astray.',
    damaged
      ? 'Once it’s on its way, we’ll send your replacement or refund as we agreed.'
      : `We’ll let you know when it arrives and start your refund within ${POLICY.refundStartBusinessDays} business days, back through the platform you bought on.`,
  ];
  return shell({
    subject: `Your return is approved (${c.reference}) | Organized Mom Collective`,
    preheader: 'Here’s where to send your calendar.',
    eyebrow: 'Return approved',
    title: hi ? `Hi ${hi},` : 'Hi there,',
    blocks: [
      p('Your return is approved. Here’s where to send your calendar:'),
      addressBlock,
      {
        html: `<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.6">${notes.map((n) => `<li style="margin:0 0 8px">${esc(n)}</li>`).join('')}</ul>`,
        text: notes.map((n) => `- ${n}`).join('\n'),
      },
      p('Questions? Just reply to this email.'),
      small('Please keep this address to yourself: it’s just for your return.'),
    ],
    footer: [`You’re getting this because you asked us about a return (reference ${esc(c.reference)}).`],
    siteUrl,
  });
}

export function createSupportReturnHandler(deps: ShopDeps): Handler {
  const { supportWebhookSecret: secret, returnAddress, supportEmailFrom: from, supportInbox, siteUrl } = deps.env;
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    // Refuse everything until the secret is configured, and anything without it.
    if (!secret) return json({ error: 'not_configured' }, 503);
    if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) return json({ error: 'unauthorized' }, 401);

    const body = await readJson(req, 50_000);
    const record = (body?.record ?? null) as { id?: unknown; return_status?: unknown } | null;
    if (body?.table !== 'support_requests' || body?.type !== 'UPDATE' || !record || typeof record.id !== 'string' || !UUID.test(record.id)) {
      return json({ status: 'ignored' });
    }
    if (record.return_status !== 'approved') return json({ status: 'ignored' });
    const id = record.id;

    let claimed: Claimed | undefined;
    try {
      [claimed] = await deps.db.rpc<Claimed[]>('support_return_claim', { p_id: id });
    } catch (err) {
      console.error('support-return: claim', (err as Error).message);
      return json({ error: 'server_error' }, 500);
    }
    // Not approved any more, or already sent: nothing to do.
    if (!claimed) return json({ status: 'already_sent' });

    const result = (status: 'sent' | 'failed' | 'no_address') =>
      deps.db.rpc('support_return_result', { p_id: id, p_status: status }).catch((err) => console.error('support-return: result', (err as Error).message));

    const address = addressLines(returnAddress);
    if (!address) {
      console.error('support-return: RETURN_ADDRESS is not set (or not a usable address); nothing sent');
      await result('no_address');
      return json({ status: 'no_address' });
    }
    if (!deps.mailer.configured) {
      await result('failed');
      return json({ status: 'failed' });
    }

    const msg = returnInstructionsEmail(claimed, address, siteUrl);
    const key = `support-return/${id}`;
    try {
      try {
        await deps.mailer.send(claimed.email, msg, key, { from, replyTo: supportInbox });
      } catch (err) {
        if (!senderRefused(err) || from === deps.env.emailFrom) throw err;
        await deps.mailer.send(claimed.email, msg, `${key}/shop-sender`, { replyTo: supportInbox });
      }
    } catch (err) {
      // Never log the message itself: it contains the address.
      console.error('support-return: send failed', (err as Error).message);
      await result('failed');
      return json({ status: 'failed' });
    }
    await result('sent');
    return json({ status: 'sent', reference: claimed.reference });
  };
}
