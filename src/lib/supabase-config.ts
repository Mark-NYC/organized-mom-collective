/**
 * The browser's Supabase project: URL and publishable key, read by every client module.
 *
 * Both values are public by design (they ship in every production page; RLS and checked functions decide access).
 * The build's PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY win when set; otherwise the project's own values below,
 * so a build whose variables didn't reach it (a Cloudflare Pages preview) still talks to the right project instead
 * of compiling empty strings. PUBLIC_SUPABASE_DISABLED=true builds without Supabase (the hosted sample preview).
 * Never put a service_role or secret key here.
 */
const PROJECT_URL = 'https://uvqhmlqwmgnohhduttip.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_MYnJK0dAeERmZFVaRwDuJg_HUZn56Oa';

const off = import.meta.env.PUBLIC_SUPABASE_DISABLED === 'true';

export const SUPABASE_URL = off ? '' : (import.meta.env.PUBLIC_SUPABASE_URL || PROJECT_URL).replace(/\/$/, '');
export const SUPABASE_ANON_KEY = off ? '' : import.meta.env.PUBLIC_SUPABASE_ANON_KEY || PUBLISHABLE_KEY;
