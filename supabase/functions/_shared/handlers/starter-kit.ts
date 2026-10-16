/**
 * POST /functions/v1/starter-kit-signup   { email, marketing, website } →
 *   { status: 'ok', email: 'sent' | 'failed' | 'skipped' | 'recent' } | { status: 'invalid' | 'rate_limited' }
 *
 * The /starter-kit form calls this. The database (starter_kit_signup) validates, throttles by
 * salted IP, saves the contact with its optional marketing consent, and claims the one kit email
 * (once per address per 24 hours: 'recent' means one already went out). The email is transactional:
 * the kit link the visitor asked for, nothing promotional. The page opens the kit whatever happens
 * here, so a failed email never blocks the kit.
 *
 * Sender: STARTER_KIT_EMAIL_FROM (default hello@organizedmomcollective.com). If Resend refuses that
 * sender, it falls back once to the shop's verified sender (SHOP_EMAIL_FROM).
 */
import type { ShopDeps } from '../deps.ts';
import { C, SANS, SERIF, button, esc, eyebrowStyle, p, small, type Block, type EmailMessage } from '../email.ts';
import { clientIp, corsHeaders, json, readJson, type Handler } from '../http.ts';
import { STARTER_KIT_KIT_PATH, STARTER_KIT_NAME, starterKitSteps } from '../../../../src/data/starter-kit.ts';

interface SignupResult {
  status: 'ok' | 'invalid' | 'rate_limited';
  send: boolean;
}

export function starterKitEmail(siteUrl: string, supportEmail: string): EmailMessage {
  const link = `${siteUrl}${STARTER_KIT_KIT_PATH}?source=email`;
  const subject = `Your ${STARTER_KIT_NAME} is here`;
  const steps: Block = {
    html:
      `<ol style="margin:0 0 18px;padding-left:22px">` +
      starterKitSteps.map((s) => `<li style="margin:0 0 8px"><strong>${esc(s.title)}</strong><br><span style="font-size:14px;color:${C.soft}">${esc(s.tool)} · ${esc(s.when)}</span></li>`).join('') +
      `</ol>`,
    text: starterKitSteps.map((s, i) => `${i + 1}. ${s.title} (${s.tool}, ${s.when.toLowerCase()})`).join('\n'),
  };
  const blocks: Block[] = [
    p('Here’s the link to your kit. Keep this email so you can come back to it anytime.'),
    button('Open your Starter Kit', link),
    p('Five free printables, in order. Spread them across a week; each one hands a little more to the family.', 'font-size:15px'),
    steps,
    small('Each one fills in on your phone or computer and saves in that browser, then downloads to print. No account or password.'),
  ];
  const support = supportEmail
    ? `Questions? Reply to this email or write to <a href="mailto:${esc(supportEmail)}" style="color:${C.accent}">${esc(supportEmail)}</a>.`
    : 'Questions? Reply to this email.';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Your five free printables, in order, plus the link to come back anytime.&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:4px 0 20px"><a href="${esc(siteUrl)}"><img src="${esc(siteUrl)}/email/omc-badge-144.png" width="72" height="72" alt="Organized Mom Collective" style="display:block;width:72px;height:72px;border:0"></a></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.rule};border-radius:10px;padding:32px 24px 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink}">
<p style="${eyebrowStyle}">Your free kit</p>
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:27px;line-height:1.25;font-weight:700;color:${C.ink}">${esc(STARTER_KIT_NAME)}</h1>
${blocks.map((b) => b.html).join('\n')}
</td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
<p style="margin:0 0 10px">You’re getting this because you asked for the ${esc(STARTER_KIT_NAME)} at organizedmomcollective.com. This is a one-time delivery email.</p>
<p style="margin:0 0 10px">${support}</p>
<p style="margin:0">Organized Mom Collective · <a href="${esc(siteUrl)}" style="color:${C.muted}">organizedmomcollective.com</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    'YOUR FREE KIT',
    STARTER_KIT_NAME,
    '',
    ...blocks.map((b) => b.text),
    '',
    `You’re getting this because you asked for the ${STARTER_KIT_NAME} at organizedmomcollective.com. This is a one-time delivery email.`,
    supportEmail ? `Questions? Reply to this email or write to ${supportEmail}.` : 'Questions? Reply to this email.',
    `Organized Mom Collective · ${siteUrl}`,
  ].join('\n');
  return { subject, html, text };
}

/** Resend refuses an unverified sender with a 403 "domain is not verified" style message. */
const senderRefused = (err: unknown) => /verif|domain|not allowed/i.test((err as Error)?.message ?? '');

export function createStarterKitHandler(deps: ShopDeps): Handler {
  const starterFrom = deps.env.starterKitEmailFrom;
  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    const body = await readJson(req, 2_000);
    if (!body || typeof body.email !== 'string' || typeof body.marketing !== 'boolean') return json({ status: 'invalid' }, 400, cors);

    let result: SignupResult;
    try {
      result = await deps.db.rpc<SignupResult>('starter_kit_signup', {
        p_email: body.email,
        p_marketing: body.marketing,
        p_client: clientIp(req),
        p_website: typeof body.website === 'string' ? body.website : '',
      });
    } catch (err) {
      console.error('starter-kit-signup', err);
      return json({ error: 'server_error' }, 500, cors);
    }
    if (result.status !== 'ok') return json({ status: result.status }, result.status === 'rate_limited' ? 429 : 400, cors);
    if (!result.send) return json({ status: 'ok', email: 'recent' }, 200, cors);

    const email = String(body.email).trim().toLowerCase();
    const record = (status: 'sent' | 'failed' | 'skipped', id: string | null = null) =>
      deps.db.rpc('starter_kit_email_result', { p_email: email, p_status: status, p_provider_id: id }).catch((err) => console.error('starter-kit-signup: result', err));

    if (!deps.mailer.configured) {
      await record('skipped');
      return json({ status: 'ok', email: 'skipped' }, 200, cors);
    }
    const msg = starterKitEmail(deps.env.siteUrl, deps.env.emailReplyTo);
    const day = new Date(deps.now() * 1000).toISOString().slice(0, 10);
    const idem = `starter-kit/${email}/${day}`.slice(0, 256);
    try {
      let sent: { id: string };
      try {
        sent = await deps.mailer.send(email, msg, idem, { from: starterFrom });
      } catch (err) {
        if (!senderRefused(err) || starterFrom === deps.env.emailFrom) throw err;
        console.warn('starter-kit-signup: sender refused, using the shop sender', (err as Error).message);
        sent = await deps.mailer.send(email, msg, `${idem}/shop-sender`.slice(0, 256));
      }
      await record('sent', sent.id);
      return json({ status: 'ok', email: 'sent' }, 200, cors);
    } catch (err) {
      console.error('starter-kit-signup: send', (err as Error).message);
      await record('failed');
      return json({ status: 'ok', email: 'failed' }, 200, cors);
    }
  };
}
