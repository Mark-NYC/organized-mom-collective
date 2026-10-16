-- Return approvals on support requests. Requires 20261019000000_support_requests.sql.
-- Setup and the owner's steps: supabase/SUPPORT.md → Approving a return.
--
-- The owner approves a return by setting return_status = 'approved' on the request (Table Editor).
-- A Supabase Database Webhook then calls the support-return Edge Function, which emails that
-- customer the return instructions once. The return address itself is NEVER stored here: it lives
-- only in the Edge Function secret RETURN_ADDRESS. These columns record status and timing only.
begin;

alter table public.support_requests
  add column return_status text check (return_status in ('requested', 'approved', 'received', 'refunded', 'declined')),
  -- Set when the instructions email is claimed; cleared again if sending fails, so saving the row retries.
  add column return_instructions_sent_at timestamptz,
  add column return_instructions_status text check (return_instructions_status in ('sent', 'failed', 'no_address'));

-- Claims the one instructions email for an approved return. Returns the customer details the email
-- needs, or nothing if the request isn't approved or the email already went out.
create function public.support_return_claim(p_id uuid)
returns table (reference text, name text, email text, order_number text, topic text)
language sql security definer set search_path = '' as $$
  update public.support_requests r
     set return_instructions_sent_at = now(), return_instructions_status = null
   where r.id = p_id and r.return_status = 'approved' and r.return_instructions_sent_at is null
  returning r.reference, r.name, r.email, r.order_number, r.topic;
$$;

-- Records the outcome. Anything but 'sent' releases the claim so a later save of the row can retry.
create function public.support_return_result(p_id uuid, p_status text)
returns void language sql security definer set search_path = '' as $$
  update public.support_requests
     set return_instructions_status = p_status,
         return_instructions_sent_at = case when p_status = 'sent' then return_instructions_sent_at end
   where id = p_id and p_status in ('sent', 'failed', 'no_address');
$$;

-- Unresolved requests, now with their return state.
create or replace view public.support_open with (security_invoker = true) as
  select reference, created_at, status, topic, name, email, order_number, has_photo, notify_status, left(message, 200) as message_start, notes,
         return_status, return_instructions_status
    from public.support_requests
   where status <> 'resolved'
   order by created_at;
revoke all on public.support_open from public, anon, authenticated;
grant select on public.support_open to service_role;

revoke execute on function public.support_return_claim(uuid) from public, anon, authenticated;
revoke execute on function public.support_return_result(uuid, text) from public, anon, authenticated;
grant execute on function public.support_return_claim(uuid) to service_role;
grant execute on function public.support_return_result(uuid, text) to service_role;
commit;
