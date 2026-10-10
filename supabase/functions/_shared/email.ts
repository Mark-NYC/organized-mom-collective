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

// Email-safe HTML: tables for layout, inline styles only (no <style> block, which some Gmail
// views drop), fixed image sizes, a single fluid 560px column that needs no media queries on
// phones, and well under Gmail's ~102 KB clipping limit. Colors are the site's warm palette.
const C = {
  page: '#fbf7f1', // cream
  card: '#ffffff',
  ink: '#3d3834', // warm charcoal (articles)
  soft: '#5c5550',
  muted: '#6e6461',
  rule: '#e7ddd4',
  accent: '#96666b', // rose-deep
  sage: '#f1f4ec',
  sageRule: '#dde4d3',
  rose: '#f8eeec',
  button: '#4a3f3e',
};
const SANS = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

interface Block {
  html: string;
  text: string;
}

const p = (text: string, style = ''): Block => ({ html: `<p style="margin:0 0 16px;${style}">${esc(text)}</p>`, text });
const small = (text: string): Block => p(text, `font-size:13px;line-height:1.55;color:${C.muted}`);
const eyebrowStyle = `margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${C.accent}`;
const heading = (text: string): Block => ({
  html: `<p style="${eyebrowStyle};margin-top:28px;color:${C.muted}">${esc(text)}</p>`,
  text: `\n${text.toUpperCase()}`,
});
const lines = (ls: string[]): Block => ({ html: `<p style="margin:0 0 16px">${ls.map(esc).join('<br>')}</p>`, text: ls.join('\n') });
const textLink = (label: string, href: string): Block => ({
  html: `<p style="margin:0 0 16px"><a href="${esc(href)}" style="color:${C.accent};font-weight:600;text-decoration:underline">${esc(label)}</a></p>`,
  text: `${label}: ${href}`,
});
/** A "bulletproof" button: a colored cell with a padded link, which every client renders. */
const button = (label: string, href: string): Block => ({
  html:
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px"><tr>` +
    `<td bgcolor="${C.button}" style="border-radius:6px;background:${C.button}">` +
    `<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px">${esc(label)}</a>` +
    `</td></tr></table>`,
  text: `${label}: ${href}`,
});
const panel = (bg: string, border: string, blocks: Block[]): Block => ({
  html:
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;border-collapse:separate">` +
    `<tr><td bgcolor="${bg}" style="background:${bg};border:1px solid ${border};border-radius:8px;padding:20px 20px 6px">${blocks.map((b) => b.html).join('')}</td></tr></table>`,
  text: blocks.map((b) => b.text).join('\n'),
});
const panelTitle = (text: string): Block => ({
  html: `<p style="margin:0 0 8px;font-family:${SERIF};font-size:19px;line-height:1.3;color:${C.ink}">${esc(text)}</p>`,
  text: `\n${text}`,
});

/** "26-Week Family Wall Calendar (January–June 2027)" → name and edition. */
function splitName(name: string): [string, string | null] {
  const m = name.match(/^(.*) \(([^()]+)\)$/);
  return m ? [m[1], m[2]] : [name, null];
}

/** Real product photos, resized to JPEG for email (WebP isn't safe everywhere): public/email/. */
const THUMBS = new Set(['calendar-26-week', 'calendar-52-week']);
const thumb = (slug: string, siteUrl: string) => `${siteUrl}/email/${THUMBS.has(slug) ? slug : 'calendar-26-week'}.jpg`;

function itemRows(o: OrderRow, siteUrl: string, withPrices: boolean): Block {
  const html = o.shop_order_items
    .map((i) => {
      const [name, edition] = splitName(i.product_name);
      return (
        `<tr>` +
        `<td width="64" valign="top" style="padding:14px 14px 14px 0;border-bottom:1px solid ${C.rule}">` +
        `<img src="${esc(thumb(i.product_slug, siteUrl))}" width="56" alt="" style="display:block;width:56px;height:auto;border:1px solid ${C.rule};border-radius:4px"></td>` +
        `<td valign="top" style="padding:14px 0;border-bottom:1px solid ${C.rule}">` +
        `<p style="margin:0;font-weight:600;color:${C.ink}">${esc(name)}</p>` +
        (edition ? `<p style="margin:2px 0 0;font-size:14px;color:${C.soft}">${esc(edition)}</p>` : '') +
        `<p style="margin:4px 0 0;font-size:13px;color:${C.muted}">Qty ${i.quantity}${withPrices && i.quantity > 1 ? ` × ${money(i.unit_price_cents)}` : ''} · includes the cleaning companion website</p></td>` +
        (withPrices
          ? `<td valign="top" align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid ${C.rule};white-space:nowrap;color:${C.ink}">${money(i.unit_price_cents * i.quantity)}</td>`
          : '') +
        `</tr>`
      );
    })
    .join('');
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${C.rule}">${html}</table>`,
    text: o.shop_order_items.map((i) => `${i.product_name} × ${i.quantity}${withPrices ? `: ${money(i.unit_price_cents * i.quantity)}` : ''}`).join('\n'),
  };
}

function totals(o: OrderRow): Block {
  const rows: [string, string, boolean?][] = [['Subtotal', money(o.subtotal_cents)]];
  if (o.discount_cents) rows.push([o.promotion_code ? `Discount (${o.promotion_code})` : 'Discount', `−${money(o.discount_cents)}`]);
  rows.push([o.shipping_method || 'Shipping', o.shipping_cents ? money(o.shipping_cents) : 'Free']);
  if (o.tax_cents) rows.push(['Sales tax', money(o.tax_cents)]);
  rows.push(['Total paid', money(o.total_cents), true]);
  return {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:6px 0 20px">` +
      rows
        .map(([a, b, strong]) =>
          strong
            ? `<tr><td style="padding:12px 0 0;border-top:2px solid ${C.ink};font-family:${SERIF};font-size:18px;color:${C.ink}">${esc(a)}</td>` +
              `<td align="right" style="padding:12px 0 0;border-top:2px solid ${C.ink};font-family:${SERIF};font-size:18px;font-weight:700;color:${C.ink};white-space:nowrap">${esc(b)}</td></tr>`
            : `<tr><td style="padding:5px 0;font-size:14px;color:${C.soft}">${esc(a)}</td><td align="right" style="padding:5px 0;font-size:14px;color:${C.soft};white-space:nowrap">${esc(b)}</td></tr>`,
        )
        .join('') +
      `</table>`,
    text: rows.map(([a, b]) => `${a}: ${b}`).join('\n'),
  };
}

function companionPanel(siteUrl: string): Block {
  return panel(C.sage, C.sageRule, [
    panelTitle('Your cleaning companion'),
    p('Your calendar comes with the free cleaning companion website. Each day it shows a small Daily Reset and one area of the house to focus on, matching the cleaning zone printed on your calendar.', 'font-size:15px'),
    button('Open the cleaning companion', `${siteUrl}/app`),
    small('Or scan the QR code printed on your calendar with your phone’s camera. No account, no subscription, nothing to install.'),
  ]);
}

interface Body {
  subject: string;
  /** Inbox preview text. */
  preheader: string;
  eyebrow: string;
  title: string;
  blocks: Block[];
}

function layout(b: Body, o: OrderRow, opts: { siteUrl: string; supportEmail: string }): EmailMessage {
  const test = o.livemode === false;
  const site = opts.siteUrl;
  const testBanner = test
    ? `<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td bgcolor="${C.rose}" style="background:${C.rose};border:1px dashed ${C.accent};border-radius:8px;padding:12px 16px;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.ink}">` +
      `<strong style="letter-spacing:0.12em;text-transform:uppercase">Test order</strong> · Stripe test mode. No real payment was taken.</td></tr></table></td></tr>`
    : '';
  const support = opts.supportEmail
    ? `Questions about your order? Reply to this email or write to <a href="mailto:${esc(opts.supportEmail)}" style="color:${C.accent}">${esc(opts.supportEmail)}</a>.`
    : 'Questions about your order? Reply to this email.';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(b.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(b.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:4px 0 20px"><a href="${esc(site)}"><img src="${esc(site)}/email/omc-badge-144.png" width="72" height="72" alt="Organized Mom Collective" style="display:block;width:72px;height:72px;border:0"></a></td></tr>
${testBanner}
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.rule};border-radius:10px;padding:32px 24px 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink}">
<p style="${eyebrowStyle}">${esc(b.eyebrow)}</p>
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:27px;line-height:1.25;font-weight:700;color:${C.ink}">${esc(b.title)}</h1>
${b.blocks.map((x) => x.html).join('\n')}
</td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
<p style="margin:0 0 10px">${support}</p>
<p style="margin:0">Organized Mom Collective · <a href="${esc(site)}" style="color:${C.muted}">organizedmomcollective.com</a></p>
${test ? `<p style="margin:10px 0 0">This is a test email from a test-mode order.</p>` : ''}
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    ...(test ? ['[TEST ORDER: Stripe test mode. No real payment was taken.]', ''] : []),
    b.eyebrow.toUpperCase(),
    b.title,
    '',
    ...b.blocks.map((x) => x.text),
    '',
    opts.supportEmail ? `Questions about your order? Reply to this email or write to ${opts.supportEmail}.` : 'Questions about your order? Reply to this email.',
    `Organized Mom Collective · ${site}`,
  ].join('\n');
  // Test-mode orders are never mistaken for real ones.
  return { subject: test ? `[Test] ${b.subject}` : b.subject, html, text };
}

export function renderEmail(kind: EmailKind, o: OrderRow, opts: { siteUrl: string; supportEmail: string; refundCents?: number }): EmailMessage {
  return layout(renderBody(kind, o, opts), o, opts);
}

function renderBody(kind: EmailKind, o: OrderRow, opts: { siteUrl: string; supportEmail: string; refundCents?: number }): Body {
  const n = orderLabel(o);
  const hi = firstName(o);
  const ship = addressLines(o.shipping_name, o.shipping_address);
  const shipTo = ship.length ? [heading('Shipping to'), lines(ship)] : [];
  switch (kind) {
    case 'confirmation':
      return {
        subject: `Your Organized Mom Collective order ${n}`,
        preheader: `Order ${n} · ${money(o.total_cents)} paid. We’ll email your tracking number when it ships.`,
        eyebrow: `Order ${n} confirmed`,
        title: hi ? `Thank you, ${hi}.` : 'Thank you for your order.',
        blocks: [
          p('Your order is confirmed, and this email is your receipt. We pack each order by hand and will email you the tracking number as soon as it ships.'),
          heading('Your order'),
          itemRows(o, opts.siteUrl, true),
          totals(o),
          ...shipTo,
          companionPanel(opts.siteUrl),
        ],
      };
    case 'shipped': {
      const url = trackingLink(o.carrier, o.tracking_number, o.tracking_url);
      return {
        subject: `Your order ${n} has shipped`,
        preheader: `${o.carrier ?? 'Your package'}${o.tracking_number ? ` · tracking ${o.tracking_number}` : ''}`,
        eyebrow: `Order ${n} shipped`,
        title: 'Your order is on its way',
        blocks: [
          p(hi ? `Good news, ${hi}: your calendar has shipped.` : 'Good news: your calendar has shipped.'),
          panel(C.page, C.rule, [
            ...(o.carrier ? [p(`Carrier: ${o.carrier}`, 'margin:0 0 4px;font-size:15px')] : []),
            ...(o.tracking_number ? [p(`Tracking number: ${o.tracking_number}`, 'margin:0 0 14px;font-size:15px;font-weight:600;word-break:break-all')] : []),
            ...(url ? [button('Track your package', url)] : [small('Use the tracking number on the carrier’s website.')]),
          ]),
          small('It can take a day for the first tracking update to appear.'),
          ...shipTo,
          heading('In this package'),
          itemRows(o, opts.siteUrl, false),
          p(''),
          companionPanel(opts.siteUrl),
        ],
      };
    }
    case 'refund': {
      const full = o.payment_status === 'refunded';
      const canceled = full && o.fulfillment_status === 'canceled';
      const amount = opts.refundCents ?? o.refunded_cents;
      return {
        subject: canceled ? `Order ${n} canceled and refunded` : `Refund for order ${n}`,
        preheader: `${money(canceled ? o.refunded_cents : amount)} is on its way back to your original payment method.`,
        eyebrow: canceled ? `Order ${n} canceled` : `Order ${n} refund`,
        title: canceled ? 'Your order has been canceled' : 'Your refund is on its way',
        blocks: [
          ...(canceled ? [p('Your order has been canceled and won’t be shipped. You’ve been refunded in full.')] : []),
          panel(C.page, C.rule, [
            p('Refunded', `margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${C.muted}`),
            p(money(canceled ? o.refunded_cents : amount), `margin:2px 0 6px;font-family:${SERIF};font-size:30px;line-height:1.2;color:${C.ink}`),
            p(
              `To your original payment method.${!canceled && o.refunded_cents !== amount ? ` Total refunded on this order: ${money(o.refunded_cents)} of ${money(o.total_cents)}.` : ''}`,
              `font-size:14px;color:${C.soft}`,
            ),
          ]),
          p('Refunds usually take 5–10 business days to appear, depending on your bank.'),
        ],
      };
    }
    case 'access':
      return {
        subject: 'Your cleaning companion: how to get started',
        preheader: 'Open it from this email or scan the QR code on your calendar. No account, no subscription.',
        eyebrow: 'Your cleaning companion',
        title: 'How to use your cleaning companion',
        blocks: [
          p(hi ? `Hi ${hi}, here’s how to open the cleaning companion website that comes with your calendar.` : 'Here’s how to open the cleaning companion website that comes with your calendar.'),
          button('Open the cleaning companion', `${opts.siteUrl}/app`),
          lines([
            '1. Open it with the button above, or scan the QR code printed on your calendar with your phone’s camera.',
            '2. It opens on Today: a small Daily Reset and one area of the house to focus on.',
            '3. Check things off as you go. Your checkmarks are saved in your phone’s browser.',
            '4. To keep it handy, add it to your Home Screen from Settings.',
          ]),
          p('It’s free with your calendar. No account, no subscription, nothing to install.'),
          textLink('See how it works', `${opts.siteUrl}/companion`),
        ],
      };
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
