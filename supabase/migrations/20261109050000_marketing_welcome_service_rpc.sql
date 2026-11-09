-- Service-role-only PostgREST RPC wrappers for the welcome worker.
-- The underlying atomic queue functions live in marketing_private.
begin;
create or replace function public.marketing_claim_welcome(p_token text)
returns jsonb language sql security invoker set search_path = '' as $$
 select marketing_private.claim_welcome(p_token);
$$;
create or replace function public.marketing_finish_welcome(p_token text,p_status text,p_message_id text default null,p_error text default null)
returns boolean language sql security invoker set search_path = '' as $$
 select marketing_private.finish_welcome(p_token,p_status,p_message_id,p_error);
$$;
revoke all on function public.marketing_claim_welcome(text) from public, anon, authenticated;
revoke all on function public.marketing_finish_welcome(text,text,text,text) from public, anon, authenticated;
grant execute on function public.marketing_claim_welcome(text) to service_role;
grant execute on function public.marketing_finish_welcome(text,text,text,text) to service_role;
commit;
