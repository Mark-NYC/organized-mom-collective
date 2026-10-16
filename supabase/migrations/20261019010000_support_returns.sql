-- Return tracking on support requests. Requires 20261019000000_support_requests.sql. Applied 2026-10-16.
--
-- The owner tracks each return by hand with return_status (requested → approved → received →
-- refunded, or declined) in the Table Editor. Return instructions and the address are sent MANUALLY
-- by private email or Etsy Messages (docs/operations/CUSTOMER_SUPPORT.md); the address is never
-- stored here or anywhere in the code.
--
-- return_instructions_* and support_return_claim / support_return_result were written for an
-- automated approval email that the owner decided against (2026-10-16). They're unused; they stay in
-- this file only because it matches what was applied to production. Don't build on them.
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
