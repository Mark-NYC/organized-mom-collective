/**
 * POST /functions/v1/support-request
 *   { name, email, order, topic, message, website, photo?: { name, data } } →
 *   { status: 'ok', reference, acknowledged } | { status: 'invalid', fields } | { status: 'photo' | 'rate_limited' }
 *
 * The /support form calls this. The database (support_submit) validates, throttles by salted IP and
 * by email address, and saves the request with a reference like OMC-7K3QX9. Then two emails:
 *   1. to the support inbox (SUPPORT_INBOX), reply-to the customer, with her photo attached if she
 *      added one (the photo is never stored);
 *   2. an acknowledgment to her, reply-to the support inbox. It never repeats her message, so the
 *      form can't be used to send someone else's words to a stranger; at most 3 per address a day.
 * A saved request is a success even if an email fails: it's in support_requests (notify_status
 * says what happened), and the owner checks support_open. Setup: supabase/SUPPORT.md.
 */
import type { ShopDeps } from '../deps.ts';
import { C, SANS, SERIF, esc, eyebrowStyle, p, small, type Block, type EmailMessage, type SendOptions } from '../email.ts';
import { clientIp, corsHeaders, json, readJson, type Handler } from '../http.ts';
import { LIMITS, RESPONSE_TIME, greetingName, normalizeSupport, topicLabel, validateSupport, type SupportInput } from '../../../../src/data/support.ts';

interface SubmitResult {
  status: 'ok' | 'invalid' | 'rate_limited';
  id?: string;
  reference?: string;
  ack?: boolean;
}

interface Photo {
  filename: string;
  content: string;
}

/** The browser sends a resized JPEG as base64. Anything else is refused. */
export function readPhoto(raw: unknown): Photo | null | 'bad' {
  if (raw == null) return null;
  if (typeof raw !== 'object') return 'bad';
  const { name, data } = raw as { name?: unknown; data?: unknown };
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return 'bad';
  const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (bytes < 100 || bytes > LIMITS.photoBytes) return 'bad';
  // JPEG starts FF D8 FF, which is "/9j/" in base64.
  if (!data.startsWith('/9j/')) return 'bad';
  const base = typeof name === 'string' ? name.toLowerCase().replace(/\.[^.]*$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : '';
  return { filename: `${base || 'photo'}.jpg`, content: data };
}

/** The support emails' layout (shared with handlers/support-return.ts). */
export function shell(opts: { subject: string; preheader: string; eyebrow: string; title: string; blocks: Block[]; footer: string[]; siteUrl: string }): EmailMessage {
  const { subject, preheader, eyebrow, title, blocks, footer, siteUrl } = opts;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:4px 0 20px"><a href="${esc(siteUrl)}"><img src="${esc(siteUrl)}/email/omc-badge-144.png" width="72" height="72" alt="Organized Mom Collective" style="display:block;width:72px;height:72px;border:0"></a></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.rule};border-radius:10px;padding:32px 24px 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink}">
<p style="${eyebrowStyle}">${esc(eyebrow)}</p>
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:27px;line-height:1.25;font-weight:700;color:${C.ink}">${esc(title)}</h1>
${blocks.map((b) => b.html).join('\n')}
</td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
${footer.map((f) => `<p style="margin:0 0 10px">${f}</p>`).join('\n')}
<p style="margin:0">Organized Mom Collective · <a href="${esc(siteUrl)}" style="color:${C.muted}">organizedmomcollective.com</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [eyebrow.toUpperCase(), title, '', ...blocks.map((b) => b.text), '', ...footer.map((f) => f.replace(/<[^>]+>/g, '')), `Organized Mom Collective · ${siteUrl}`].join('\n');
  return { subject, html, text };
}

/** The customer's acknowledgment. Never echoes what she typed beyond a plain first name. */
export function acknowledgmentEmail(input: Pick<SupportInput, 'name' | 'topic'>, reference: string, siteUrl: string): EmailMessage {
  const hi = greetingName(input.name);
  return shell({
    subject: 'We received your message | Organized Mom Collective',
    preheader: `Reference ${reference}. ${RESPONSE_TIME}`,
    eyebrow: 'Message received',
    title: hi ? `Hi ${hi},` : 'Hi there,',
    blocks: [
      p('Thanks for reaching out! We’ve received your message and will take a look.'),
      p(RESPONSE_TIME),
      {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr><td bgcolor="${C.sage}" style="background:${C.sage};border:1px solid ${C.sageRule};border-radius:8px;padding:14px 18px;font-size:15px;color:${C.ink}">Your reference: <strong style="letter-spacing:0.04em">${esc(reference)}</strong><br><span style="font-size:13px;color:${C.soft}">Topic: ${esc(topicLabel(input.topic))}</span></td></tr></table>`,
        text: `Your reference: ${reference}\nTopic: ${topicLabel(input.topic)}`,
      },
      p('Thanks for being part of Organized Mom Collective!'),
      small('Need to add something? Just reply to this email.'),
    ],
    footer: ['You’re getting this one email because you sent us a message through our Help &amp; Support page. It doesn’t sign you up for anything.'],
    siteUrl,
  });
}

/** The copy for the support inbox. Everything she typed is escaped. */
export function inboxEmail(input: SupportInput, reference: string, hasPhoto: boolean, siteUrl: string): EmailMessage {
  const rows: [string, string][] = [
    ['Reference', reference],
    ['Topic', topicLabel(input.topic)],
    ['Name', input.name],
    ['Email', input.email],
    ['Order number', input.order || '(none given)'],
    ['Photo', hasPhoto ? 'Attached' : 'None'],
  ];
  const table: Block = {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 18px">` +
      rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:15px;color:${C.ink};word-break:break-word">${esc(v)}</td></tr>`).join('') +
      `</table>`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
  };
  const message: Block = {
    html: `<div style="margin:0 0 18px;padding:16px 18px;background:${C.page};border:1px solid ${C.rule};border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap;word-break:break-word">${esc(input.message)}</div>`,
    text: `Message:\n${input.message}`,
  };
  return shell({
    subject: `[${reference}] ${topicLabel(input.topic)}: ${input.name.slice(0, 60)}`,
    preheader: input.message.slice(0, 90),
    eyebrow: 'New support request',
    title: topicLabel(input.topic),
    blocks: [table, message, small(`Hit Reply to answer ${input.name.slice(0, 60)} directly. When it’s sorted, set its status to resolved in Supabase → support_requests.`)],
    footer: ['Sent from the Help &amp; Support form. The customer also got an automatic acknowledgment with this reference.'],
    siteUrl,
  });
}

/** Resend refuses an unverified sender with a 403 "domain is not verified" style message. */
export const senderRefused = (err: unknown) => /verif|domain|not allowed/i.test((err as Error)?.message ?? '');

export function createSupportHandler(deps: ShopDeps): Handler {
  const { supportEmailFrom: from, supportInbox, siteUrl } = deps.env;

  /** Sends with the support sender, falling back once to the shop's verified sender if Resend refuses it. */
  async function send(to: string, msg: EmailMessage, key: string, opts: SendOptions): Promise<'sent' | 'failed'> {
    try {
      try {
        await deps.mailer.send(to, msg, key, { ...opts, from });
      } catch (err) {
        if (!senderRefused(err) || from === deps.env.emailFrom) throw err;
        console.warn('support-request: sender refused, using the shop sender', (err as Error).message);
        await deps.mailer.send(to, msg, `${key}/shop-sender`, opts);
      }
      return 'sent';
    } catch (err) {
      console.error('support-request: send', (err as Error).message);
      return 'failed';
    }
  }

  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    const body = await readJson(req, Math.ceil(LIMITS.photoBytes * 1.4) + 20_000);
    if (!body) return json({ status: 'invalid', fields: {} }, 400, cors);

    const input = normalizeSupport(body);
    const fields = validateSupport(input);
    if (Object.keys(fields).length) return json({ status: 'invalid', fields }, 400, cors);
    const photo = readPhoto(body.photo);
    if (photo === 'bad') return json({ status: 'photo' }, 400, cors);

    let result: SubmitResult;
    try {
      result = await deps.db.rpc<SubmitResult>('support_submit', {
        p_name: input.name,
        p_email: input.email,
        p_order: input.order,
        p_topic: input.topic,
        p_message: input.message,
        p_has_photo: Boolean(photo),
        p_client: clientIp(req),
        p_website: typeof body.website === 'string' ? body.website : '',
      });
    } catch (err) {
      console.error('support-request', err);
      return json({ error: 'server_error' }, 500, cors);
    }
    if (result.status !== 'ok' || !result.id || !result.reference) {
      const status = result.status === 'rate_limited' ? 'rate_limited' : 'invalid';
      return json(status === 'invalid' ? { status, fields: {} } : { status }, status === 'rate_limited' ? 429 : 400, cors);
    }
    const { id, reference } = result;
    const record = (kind: 'notify' | 'ack', status: string) =>
      deps.db.rpc('support_email_result', { p_id: id, p_kind: kind, p_status: status }).catch((err) => console.error('support-request: result', err));

    if (!deps.mailer.configured) {
      await Promise.all([record('notify', 'skipped'), record('ack', 'skipped')]);
      return json({ status: 'ok', reference, acknowledged: false }, 200, cors);
    }

    const [notify, ack] = await Promise.all([
      send(supportInbox, inboxEmail(input, reference, Boolean(photo), siteUrl), `support/${id}/notify`, {
        replyTo: input.email,
        attachments: photo ? [photo] : undefined,
      }),
      result.ack
        ? send(input.email, acknowledgmentEmail(input, reference, siteUrl), `support/${id}/ack`, { replyTo: supportInbox })
        : Promise.resolve('limited' as const),
    ]);
    await Promise.all([record('notify', notify), record('ack', ack)]);
    return json({ status: 'ok', reference, acknowledged: ack === 'sent' }, 200, cors);
  };
}
