/**
 * Customer support: the contact address, the official return policy for physical calendars,
 * the help topics and the FAQs. Shared by /support, /returns, the support form and the
 * support-request Edge Function (supabase/functions/_shared/handlers/support.ts), so the
 * browser and the server validate the same way.
 *
 * Policy and operating notes: docs/operations/CUSTOMER_SUPPORT.md. Only describe features
 * that exist (the cleaning companion is a website, never an app), and change the policy terms
 * here only when the owner approves new ones: the pages read them from POLICY.
 */
import { ETSY_SHOP_URL } from './reviews';
import { routes } from '../routes';

/** The customer-facing address, already published across the site. Replies reach the owner. */
export const SUPPORT_EMAIL = 'contact@organizedmomcollective.com';

/** Etsy: the shop, and Etsy's own Purchases page, where a buyer finds an order and messages the seller. */
export const ETSY = {
  shop: ETSY_SHOP_URL,
  purchases: 'https://www.etsy.com/your/purchases',
};

/** What we aim for, never a guarantee. */
export const RESPONSE_TIME = 'We aim to respond within one business day.';

/**
 * The official return policy for physical wall calendars, approved by the owner on 2026-10-16.
 * Other physical goods, personalized products and digital downloads need their own terms.
 */
export const POLICY = {
  /** YYYY-MM-DD. Change it whenever the terms change. */
  effective: '2026-10-16',
  /** Calendar days from confirmed delivery. */
  returnWindowDays: 14,
  /** Business days after the returned calendar is received and inspected. */
  refundStartBusinessDays: 5,
} as const;

/** The one line by a calendar's buy buttons (/calendar). Physical calendars only. */
export const RETURNS_LINE = `${POLICY.returnWindowDays}-day returns on unused calendars. If your order arrives damaged or incorrect, we’ll make it right.`;

/** "October 16, 2026" */
export const policyDate = (iso: string = POLICY.effective) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** The six help topics, in page order. Ids are stored with each request: add new ones, don't rename. */
export const SUPPORT_TOPICS = [
  { id: 'orders', label: 'Orders & Shipping', blurb: 'Tracking, delivery and changes before your order ships.' },
  { id: 'returns', label: 'Returns & Refunds', blurb: 'Our 14-day window, how to start a return and when refunds land.' },
  { id: 'damaged', label: 'Damaged or Incorrect Orders', blurb: 'Bent, misprinted or not what you ordered. We’ll make it right.' },
  { id: 'calendar', label: 'Using Your Calendar', blurb: 'Size, start dates and what’s on each page.' },
  { id: 'companion', label: 'Cleaning Companion Website', blurb: 'Opening it, saving it to your phone and where checkmarks are kept.' },
  { id: 'other', label: 'Other Questions', blurb: 'Anything else. A real person reads every message.' },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]['id'];
export const TOPIC_IDS: readonly string[] = SUPPORT_TOPICS.map((t) => t.id);
export const topicLabel = (id: string) => SUPPORT_TOPICS.find((t) => t.id === id)?.label ?? 'Other Questions';

/** Field limits, enforced in the form, the Edge Function and the database. */
export const LIMITS = {
  name: 80,
  email: 254,
  order: 40,
  message: 4000,
  /** Shortest message worth sending. */
  messageMin: 10,
  /** The photo after it's resized in the browser (JPEG). */
  photoBytes: 1_500_000,
  /** Longest edge the browser resizes a photo to. */
  photoEdge: 1600,
} as const;

export interface SupportInput {
  name: string;
  email: string;
  order: string;
  topic: string;
  message: string;
}

export type SupportField = keyof SupportInput;

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\r\n?/g, '\n').trim() : '');

/** Trims and normalizes what the form sends. */
export function normalizeSupport(raw: Partial<Record<SupportField, unknown>>): SupportInput {
  return {
    name: clean(raw.name).replace(/\s+/g, ' '),
    email: clean(raw.email).toLowerCase(),
    order: clean(raw.order).replace(/\s+/g, ' '),
    topic: clean(raw.topic),
    message: clean(raw.message),
  };
}

/** Field → what to tell her. Empty when the request is valid. */
export function validateSupport(v: SupportInput): Partial<Record<SupportField, string>> {
  const errors: Partial<Record<SupportField, string>> = {};
  if (!v.name) errors.name = 'Please add your name.';
  else if (v.name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;
  if (!v.email || v.email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Please check your email address so we can reply.';
  if (v.order.length > LIMITS.order || /[<>]/.test(v.order)) errors.order = 'Please check your order number.';
  if (!TOPIC_IDS.includes(v.topic)) errors.topic = 'Please choose a topic.';
  if (v.message.length < LIMITS.messageMin) errors.message = 'Please tell us a little more so we can help.';
  else if (v.message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;
  return errors;
}

/**
 * The first name for "Hi …" in the acknowledgment. Only plain letters, so the form can't be used to
 * put someone else's words into an email we send.
 */
export function greetingName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return /^[\p{L}][\p{L}'’.-]{0,29}$/u.test(first) ? first : '';
}

export interface Faq {
  q: string;
  /** Plain sentences. Links go in `link`. */
  a: string;
  link?: { href: string; label: string; external?: boolean };
  topic: SupportTopic;
}

const days = POLICY.returnWindowDays;

/** Every answer describes something that exists today. */
export const FAQS: Faq[] = [
  {
    topic: 'orders',
    q: 'How do I track my order?',
    a: 'If you bought on Etsy, open Purchases in your Etsy account: tracking appears there once your calendar ships, and Etsy emails it to you too. If you ordered on this website, we email your tracking number as soon as your order ships.',
    link: { href: ETSY.purchases, label: 'Open your Etsy purchases', external: true },
  },
  {
    topic: 'orders',
    q: 'Can I cancel my order?',
    a: 'Yes, if it hasn’t shipped yet. Message us as soon as you can and we’ll check where your order is. If it has already shipped, it can come back as a return instead.',
  },
  {
    topic: 'returns',
    q: 'How do I return my calendar?',
    a: `Contact us within ${days} days of delivery with your order number. Once we approve your return, we’ll send you the return address. The calendar needs to be unused and in its original, resalable condition.`,
    link: { href: routes.returns, label: 'Read the full return policy' },
  },
  {
    topic: 'returns',
    q: 'When will I receive my refund?',
    a: `We start your refund within ${POLICY.refundStartBusinessDays} business days of receiving and checking the returned calendar. It goes back to your original payment method; your bank or Etsy may take a few more days to show it.`,
  },
  {
    topic: 'returns',
    q: 'Can I exchange my calendar?',
    a: `We don’t do direct swaps. If your calendar is unused and you’re within ${days} days of delivery, you can return it and order the one you want. If we sent the wrong calendar, we’ll replace it at no cost to you.`,
  },
  {
    topic: 'damaged',
    q: 'What if my calendar arrives damaged?',
    a: 'We’re sorry, and we’ll make it right. Send us your order number and, if you can, a photo of the damage. We’ll send a replacement or a refund at no cost to you, and you usually won’t need to send the damaged calendar back.',
  },
  {
    topic: 'calendar',
    q: 'How big is the calendar, and when does it start?',
    a: 'It’s 11 × 17 inches, one week per page, hanging from its Wire-O binding. The first page of the January–June 2027 calendar is the week of Monday, December 28, 2026.',
    link: { href: routes.calendar, label: 'See what’s on each page' },
  },
  {
    topic: 'companion',
    q: 'How do I access the cleaning companion website?',
    a: 'Scan the QR code printed on your calendar with your phone’s camera. It opens on Today: a small Daily Reset and the area to focus on, matching the cleaning zone on your calendar.',
    link: { href: routes.companion, label: 'See how the cleaning companion works' },
  },
  {
    topic: 'companion',
    q: 'Is the companion website included with my calendar?',
    a: 'Yes. It comes with your calendar at no extra cost. There’s no account to create and nothing to subscribe to.',
  },
  {
    topic: 'companion',
    q: 'Do I need to download an app?',
    a: 'No. The cleaning companion is a website that opens in your phone’s browser. You can add it to your Home Screen from its Settings page so it’s one tap away. Your checkmarks are saved on that phone.',
  },
  {
    topic: 'other',
    q: 'How do I contact someone?',
    a: `Use the form on this page or email ${SUPPORT_EMAIL}. If you bought on Etsy, Etsy Messages is the quickest way to reach us about that order. ${RESPONSE_TIME}`,
  },
];
