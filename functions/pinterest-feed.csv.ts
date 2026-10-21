/**
 * Cloudflare Pages Function for the Pinterest catalog feed.
 * Reuses the existing live Supabase-backed CSV implementation.
 * Keeps /pinterest-feed.csv working when migrating off Vercel.
 */
import { handleFeed } from '../api/pinterest-feed';

interface PagesContext {
  request: Request;
  env: {
    PUBLIC_SUPABASE_URL?: string;
    PUBLIC_SUPABASE_ANON_KEY?: string;
  };
}

export const onRequestGet = ({ request, env }: PagesContext) =>
  handleFeed(request, {
    PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: env.PUBLIC_SUPABASE_ANON_KEY,
  });

export const onRequestHead = ({ request, env }: PagesContext) =>
  handleFeed(request, {
    PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: env.PUBLIC_SUPABASE_ANON_KEY,
  });
