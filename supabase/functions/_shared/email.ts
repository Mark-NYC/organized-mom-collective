/**
 * Transactional emails: order confirmation (the receipt), shipping, refund/cancellation,
 * and companion access instructions. Sent through Resend's HTTP API; without
 * RESEND_API_KEY they're logged as "skipped" so test orders still work.
 *
 * Copy rules: the purchase is the printed calendar plus the existing, free cleaning
 * companion website. Never promise accounts, sync, or features that don't exist, and
 * never promise delivery dates.
 */
import type { Address, Db, OrderRow } from './db.ts';
import { loadOrder } from './db.ts';

export type EmailKind = 'confirmation' | 'shipped' | 'refund' | 'access';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  configured: boolean;
  /** `idempotencyKey`: Resend sends at most one email per key (24 hours), so a retry after a timeout can't send a second copy. */
  send(to: string, msg: EmailMessage, idempotencyKey?: string): Promise<{ id: string }>;
}

export function createResendMailer(opts: { apiKey: string; from: string; replyTo?: string; fetch?: typeof fetch }): Mailer {
  const fetchFn = opts.fetch ?? fetch;
  return {
    configured: Boolean(opts.apiKey),
    async send(to, msg, idempotencyKey) {
      const res = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({ from: opts.from, to: [to], reply_to: opts.replyTo || undefined, subject: msg.subject, html: msg.html, text: msg.text }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? `resend_${res.status}`);
      return { id: data.id ?? '' };
    },
  };
}

// ------------------------------------------------------------------ rendering

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const money = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toFixed(2)}`;
export const orderLabel = (o: Pick<OrderRow, 'order_number'>) => (o.order_number ? `#${o.order_number}` : '');
const firstName = (o: OrderRow) => (o.customer_name ?? o.shipping_name ?? '').trim().split(/\s+/)[0] ?? '';

export function addressLines(name: string | null, a: Address | null): string[] {
  if (!a) return [];
  return [
    name ?? '',
    a.line1 ?? '',
    a.line2 ?? '',
    [a.city, [a.state, a.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    a.country && a.country !== 'US' ? a.country : '',
  ].filter((l) => l.trim());
}

/** A carrier's public tracking page, when we know its URL pattern. */
export function trackingLink(carrier: string | null, tracking: string | null, explicit: string | null): string | null {
  if (explicit && /^https:\/\//.test(explicit)) return explicit;
  if (!tracking) return null;
  const n = encodeURIComponent(tracking.replace(/\s+/g, ''));
  switch ((carrier ?? '').trim().toLowerCase()) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${n}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    default:
      return null;
  }
}

interface Block {
  html: string;
  text: string;
}

const p = (text: string): Block => ({ html: `<p style="margin:0 0 16px">${esc(text)}</p>`, text });
const heading = (text: string): Block => ({
  html: `<p style="margin:28px 0 8px;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase">${esc(text)}</p>`,
  text: `\n${text.toUpperCase()}`,
});
const link = (label: string, href: string): Block => ({
  html: `<p style="margin:0 0 16px"><a href="${esc(href)}" style="color:#545454;font-weight:600">${esc(label)}</a></p>`,
  text: `${label}: ${href}`,
});
const lines = (ls: string[]): Block => ({ html: `<p style="margin:0 0 16px">${ls.map(esc).join('<br>')}</p>`, text: ls.join('\n') });

function summary(o: OrderRow): Block {
  const rows: [string, string][] = o.shop_order_items.map((i) => [`${i.product_name} × ${i.quantity}`, money(i.unit_price_cents * i.quantity)]);
  rows.push(['Subtotal', money(o.subtotal_cents)]);
  if (o.discount_cents) rows.push(['Discount', `−${money(o.discount_cents)}`]);
  rows.push([o.shipping_method ? `Shipping (${o.shipping_method})` : 'Shipping', money(o.shipping_cents)]);
  if (o.tax_cents) rows.push(['Tax', money(o.tax_cents)]);
  rows.push(['Total paid', money(o.total_cents)]);
  const last = rows.length - 1;
  return {
    html:
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">' +
      rows
        .map(
          ([a, b], i) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #c8c8c8${i === last ? ';font-weight:700' : ''}">${esc(a)}</td>` +
            `<td align="right" style="padding:8px 0;border-bottom:1px solid #c8c8c8${i === last ? ';font-weight:700' : ''}">${esc(b)}</td></tr>`,
        )
        .join('') +
      '</table>',
    text: rows.map(([a, b]) => `${a}: ${b}`).join('\n'),
  };
}

function companionBlocks(siteUrl: string): Block[] {
  return [
    heading('Your cleaning companion'),
    p(
      'Your calendar comes with the free cleaning companion website. It shows today’s small Daily Reset and the one area of the house to focus on, matching the cleaning zone printed on your calendar.',
    ),
    p('Scan the QR code printed on your calendar with your phone’s camera, or open it here. No account, no subscription, nothing to install.'),
    link('Open the cleaning companion', `${siteUrl}/app`),
  ];
}

function layout(siteUrl: string, title: string, blocks: Block[], supportEmail: string): Omit<EmailMessage, 'subject'> {
  const all = [...blocks, ...(supportEmail ? [p(`Questions about your order? Reply to this email or write to ${supportEmail}.`)] : [])];
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#545454">
<tr><td style="padding:0 0 24px;border-bottom:2px solid #545454"><img src="${esc(siteUrl)}/brand/omc-badge-160.png" width="64" height="64" alt="Organized Mom Collective"></td></tr>
<tr><td style="padding:24px 0 0"><h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;color:#545454">${esc(title)}</h1>
${all.map((b) => b.html).join('\n')}
</td></tr>
<tr><td style="padding:24px 0 0;border-top:1px solid #c8c8c8;font-size:12px;color:#666666">Organized Mom Collective · <a href="${esc(siteUrl)}" style="color:#666666">organizedmomcollective.com</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, '', ...all.map((b) => b.text), '', `Organized Mom Collective · ${siteUrl}`].join('\n');
  return { html, text };
}

export function renderEmail(kind: EmailKind, o: OrderRow, opts: { siteUrl: string; supportEmail: string; refundCents?: number }): EmailMessage {
  const msg = renderBody(kind, o, opts);
  // Test-mode orders are never mistaken for real ones.
  return o.livemode === false ? { ...msg, subject: `[Test] ${msg.subject}` } : msg;
}

function renderBody(kind: EmailKind, o: OrderRow, opts: { siteUrl: string; supportEmail: string; refundCents?: number }): EmailMessage {
  const n = orderLabel(o);
  const hi = firstName(o);
  const ship = addressLines(o.shipping_name, o.shipping_address);
  switch (kind) {
    case 'confirmation': {
      const m = layout(
        opts.siteUrl,
        hi ? `Thank you, ${hi}. Your order is confirmed.` : 'Thank you. Your order is confirmed.',
        [
          p(`Order ${n} · paid ${money(o.total_cents)}. This email is your receipt.`),
          summary(o),
          ...(ship.length ? [heading('Shipping to'), lines(ship)] : []),
          heading('What happens next'),
          p('We pack each order by hand. When yours ships, we’ll email you the tracking number.'),
          ...companionBlocks(opts.siteUrl),
        ],
        opts.supportEmail,
      );
      return { ...m, subject: `Your Organized Mom Collective order ${n}` };
    }
    case 'shipped': {
      const url = trackingLink(o.carrier, o.tracking_number, o.tracking_url);
      const m = layout(
        opts.siteUrl,
        `Your order ${n} is on its way`,
        [
          p(hi ? `Good news, ${hi}: your calendar has shipped.` : 'Good news: your calendar has shipped.'),
          lines([o.carrier ? `Carrier: ${o.carrier}` : '', o.tracking_number ? `Tracking number: ${o.tracking_number}` : ''].filter(Boolean)),
          ...(url ? [link('Track your package', url)] : []),
          ...(ship.length ? [heading('Shipping to'), lines(ship)] : []),
          ...companionBlocks(opts.siteUrl),
        ],
        opts.supportEmail,
      );
      return { ...m, subject: `Your order ${n} has shipped` };
    }
    case 'refund': {
      const full = o.payment_status === 'refunded';
      const canceled = full && o.fulfillment_status === 'canceled';
      const amount = opts.refundCents ?? o.refunded_cents;
      const m = layout(
        opts.siteUrl,
        canceled ? `Your order ${n} has been canceled` : `We’ve refunded ${money(amount)} for order ${n}`,
        [
          p(
            canceled
              ? `Your order has been canceled and refunded in full: ${money(o.refunded_cents)} back to your original payment method.`
              : `${money(amount)} is on its way back to your original payment method.${full ? '' : ` Total refunded so far: ${money(o.refunded_cents)}.`}`,
          ),
          p('Refunds usually take 5–10 business days to appear, depending on your bank.'),
        ],
        opts.supportEmail,
      );
      return { ...m, subject: canceled ? `Order ${n} canceled and refunded` : `Refund for order ${n}` };
    }
    case 'access': {
      const m = layout(
        opts.siteUrl,
        'How to use your cleaning companion',
        [
          p(hi ? `Hi ${hi}, here’s how to open the cleaning companion that comes with your calendar.` : 'Here’s how to open the cleaning companion that comes with your calendar.'),
          link('Open the cleaning companion', `${opts.siteUrl}/app`),
          p('Or scan the QR code printed on your calendar with your phone’s camera. It opens on Today: a small Daily Reset and one area of the house to focus on.'),
          p('It’s free with your calendar. No account, no subscription, nothing to install. Your checkmarks are saved in your phone’s browser, and you can add it to your Home Screen from Settings.'),
          link('See how it works', `${opts.siteUrl}/companion`),
        ],
        opts.supportEmail,
      );
      return { ...m, subject: 'Your cleaning companion: how to get started' };
    }
  }
}

// ------------------------------------------------------------------ delivery

/** What happened to one email. Only "sent" means the provider accepted it. */
export type EmailOutcome =
  | 'sent' // Resend accepted it
  | 'skipped' // no email provider configured: nothing went out
  | 'failed' // the provider refused it or couldn't be reached: nothing went out (or we can't tell)
  | 'duplicate' // that email is already sent or being sent: not sent again
  | 'no_email'; // the order has no customer email

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sends one email for an order at most once per `key` (shop_email_claim). Never throws:
 * failures are logged on the order, where the dashboard offers a retry.
 *
 * A retry of a failed or skipped email reuses its key (the same log row), and the provider
 * gets an idempotency key made from that key and the message itself: if a "failed" attempt
 * actually reached Resend (a timeout), the retry returns the original instead of a second copy.
 */
export async function deliverEmail(
  deps: { db: Db; mailer: Mailer; siteUrl: string; supportEmail: string },
  orderId: string,
  kind: EmailKind,
  key: string,
  extra: { refundCents?: number } = {},
): Promise<EmailOutcome> {
  try {
    const order = await loadOrder(deps.db, orderId);
    if (!order?.email) return 'no_email';
    const claim = await deps.db.rpc<number | null>('shop_email_claim', { p_order: orderId, p_kind: kind, p_key: key, p_to: order.email });
    if (claim == null) return 'duplicate';
    if (!deps.mailer.configured) {
      await deps.db.rpc('shop_email_result', { p_id: claim, p_status: 'skipped', p_provider_id: null, p_error: 'Email provider not configured' });
      return 'skipped';
    }
    try {
      const msg = renderEmail(kind, order, { siteUrl: deps.siteUrl, supportEmail: deps.supportEmail, ...extra });
      const idem = `${key}/${(await sha256Hex(`${order.email}\n${msg.subject}\n${msg.text}`)).slice(0, 24)}`;
      const { id } = await deps.mailer.send(order.email, msg, idem.slice(0, 256));
      await deps.db.rpc('shop_email_result', { p_id: claim, p_status: 'sent', p_provider_id: id, p_error: null });
      return 'sent';
    } catch (err) {
      await deps.db.rpc('shop_email_result', { p_id: claim, p_status: 'failed', p_provider_id: null, p_error: (err as Error).message });
      return 'failed';
    }
  } catch (err) {
    console.error('email', kind, orderId, err);
    return 'failed';
  }
}
